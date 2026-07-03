import {
  playUntilPosition,
  seekToVerifiedPosition,
  type PlaybackStatusSnapshot,
  type PositionAwarePlayer,
} from '../reading-mode-player';

class FakePlayer implements PositionAwarePlayer {
  currentStatus: PlaybackStatusSnapshot = { currentTime: 0, isBuffering: false, isLoaded: true };
  listeners = new Set<(status: PlaybackStatusSnapshot) => void>();
  pause = jest.fn();
  play = jest.fn();
  seekAttempts: number[] = [];
  seekPositions: number[] = [];

  async seekTo(seconds: number) {
    this.seekPositions.push(seconds);
    const next = this.seekAttempts.shift() ?? seconds;
    this.emit({ currentTime: next });
  }

  addListener(_eventName: 'playbackStatusUpdate', listener: (status: PlaybackStatusSnapshot) => void) {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }

  emit(status: Partial<PlaybackStatusSnapshot>) {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.listeners.forEach((listener) => listener(this.currentStatus));
  }
}

describe('reading mode player', () => {
  it('retries a seek until the actual player position matches', async () => {
    const player = new FakePlayer();
    player.seekAttempts = [0.8, 1];

    await expect(seekToVerifiedPosition({
      isCancelled: () => false,
      player,
      positionMs: 1000,
      retries: 1,
    })).resolves.toBe(true);
    expect(player.seekPositions).toEqual([1, 1]);
  });

  it('does not finish a range while buffering or before the real end position', async () => {
    const player = new FakePlayer();
    const result = playUntilPosition({ endMs: 1000, isCancelled: () => false, player });

    player.emit({ currentTime: 1.1, isBuffering: true });
    expect(player.pause).not.toHaveBeenCalled();
    player.emit({ currentTime: 0.9, isBuffering: false });
    expect(player.pause).not.toHaveBeenCalled();
    player.emit({ currentTime: 1, isBuffering: false });

    await expect(result).resolves.toBe(true);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('samples the player clock between sparse status events', async () => {
    jest.useFakeTimers();
    const player = new FakePlayer();
    const result = playUntilPosition({ endMs: 1000, isCancelled: () => false, player });

    player.currentStatus = { ...player.currentStatus, currentTime: 1 };
    await jest.advanceTimersByTimeAsync(10);

    await expect(result).resolves.toBe(true);
    expect(player.pause).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('does not pause playback when the range is cancelled by a newer run', async () => {
    let cancelled = false;
    const player = new FakePlayer();
    const result = playUntilPosition({ endMs: 1000, isCancelled: () => cancelled, player });

    cancelled = true;
    player.emit({ currentTime: 0.4, isBuffering: false });

    await expect(result).resolves.toBe(false);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
  });
});
