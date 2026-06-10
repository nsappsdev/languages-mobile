export type PlaybackStatusSnapshot = {
  currentTime: number;
  isBuffering: boolean;
  isLoaded: boolean;
};

export type PlaybackStatusSubscription = { remove: () => void };

export type PositionAwarePlayer = {
  currentStatus: PlaybackStatusSnapshot;
  pause: () => void;
  play: () => void;
  seekTo: (
    seconds: number,
    toleranceMillisBefore?: number,
    toleranceMillisAfter?: number,
  ) => Promise<void>;
  addListener: (
    eventName: 'playbackStatusUpdate',
    listener: (status: PlaybackStatusSnapshot) => void,
  ) => PlaybackStatusSubscription;
};

const SEEK_TOLERANCE_MS = 35;
const RANGE_END_TOLERANCE_MS = 15;
const POSITION_TIMEOUT_MS = 4000;
const POSITION_POLL_INTERVAL_MS = 10;

export function traceReadingModePlayback(
  event: string,
  details: Record<string, string | number | boolean | null>,
) {
  if (__DEV__) {
    console.debug(`[reading-mode] ${event}`, details);
  }
}

export async function seekToVerifiedPosition({
  isCancelled,
  player,
  positionMs,
  retries = 2,
}: {
  isCancelled: () => boolean;
  player: PositionAwarePlayer;
  positionMs: number;
  retries?: number;
}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (isCancelled()) return false;
    player.pause();
    await player.seekTo(positionMs / 1000, 0, 0);
    const reached = await waitForPosition({
      isCancelled,
      player,
      predicate: (status) =>
        status.isLoaded &&
        Math.abs(status.currentTime * 1000 - positionMs) <= SEEK_TOLERANCE_MS,
      timeoutMs: POSITION_TIMEOUT_MS,
    });
    if (reached) return true;
  }
  return false;
}

export async function playUntilPosition({
  endMs,
  isCancelled,
  player,
}: {
  endMs: number;
  isCancelled: () => boolean;
  player: PositionAwarePlayer;
}) {
  if (isCancelled()) return false;
  player.play();
  const reached = await waitForPosition({
    isCancelled,
    player,
    predicate: (status) =>
      status.isLoaded &&
      !status.isBuffering &&
      status.currentTime * 1000 >= endMs - RANGE_END_TOLERANCE_MS,
    timeoutMs: Math.max(POSITION_TIMEOUT_MS, endMs - player.currentStatus.currentTime * 1000 + 5000),
  });
  player.pause();
  return reached;
}

function waitForPosition({
  isCancelled,
  player,
  predicate,
  timeoutMs,
}: {
  isCancelled: () => boolean;
  player: PositionAwarePlayer;
  predicate: (status: PlaybackStatusSnapshot) => boolean;
  timeoutMs: number;
}) {
  return new Promise<boolean>((resolve) => {
    let finished = false;
    let subscription: PlaybackStatusSubscription | null = null;
    const finish = (result: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearInterval(positionPoll);
      subscription?.remove();
      resolve(result);
    };
    const inspect = (status: PlaybackStatusSnapshot) => {
      if (isCancelled()) {
        finish(false);
      } else if (predicate(status)) {
        finish(true);
      }
    };
    const timeout = setTimeout(() => finish(false), timeoutMs);
    const positionPoll = setInterval(() => {
      inspect(player.currentStatus);
    }, POSITION_POLL_INTERVAL_MS);
    subscription = player.addListener('playbackStatusUpdate', inspect);
    inspect(player.currentStatus);
  });
}
