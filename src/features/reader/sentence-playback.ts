import { createAudioPlaylist, setAudioModeAsync, type AudioPlaylistStatus } from 'expo-audio';
import type { PlaybackStep } from './model';
import { prepareAudio, type PreparedAudio } from './prepared-audio';
import { trackPosition } from './playback-track';
import { frameAtSample, playbackSegments, segmentAt, segmentKey, type PlaybackSegment } from './playback-segments';

export type PlaybackState = {
  playing: boolean; loading: boolean; sample: number; occurrenceId: string | null;
  error: string | null; repetition?: PlaybackStep['repetition']; canResume: boolean;
};
export const initialPlaybackState: PlaybackState = {
  playing: false, loading: false, sample: 0, occurrenceId: null, error: null, canResume: false,
};
type Cached = { promise: Promise<PreparedAudio>; track?: PreparedAudio; refs: number };
type Lease = { track: PreparedAudio; release: () => void };
type Queued = Lease & { index: number };
type Session = {
  key: string; segments: PlaybackSegment[]; pauseMs: number; publicationId: string;
  queue: Queued[]; next: number; startIndex: number; playlist?: ReturnType<typeof createAudioPlaylist>;
  ready: Promise<void>; filling?: Promise<void>; removeListeners: (() => void)[];
  destroyed: boolean; mutating: boolean; waiting: boolean; started: boolean; failure?: Error;
};
const LOOK_AHEAD = 2;
const MAX_PREPARED_BYTES = 64 * 1024 * 1024;

/** Sentence queues keep expensive preparation off the Play path. Mode switches
 * reuse prepared files and loaded queues; speech timing stays inside each WAV. */
export class SentencePlayback {
  private state: PlaybackState = { ...initialPlaybackState };
  private cached = new Map<string, Cached>();
  private sessions = new Map<string, Session>();
  private lifetime = new AbortController();
  private active?: Session;
  private generation = 0;
  private wantsPlay = false;
  private timer?: ReturnType<typeof setInterval>;
  private audioMode?: Promise<void>;
  private audioModeReady = false;
  private lastClock = -1;
  private lastMovement = 0;
  private measurement?: { tappedAt: number; preparedAt: number; readyAt: number; from: number; cached: boolean };

  constructor(private token: string, private userId: string, private onChange: (state: PlaybackState) => void) {}
  private emit(change: Partial<PlaybackState>) {
    this.state = { ...this.state, ...change };
    if (!this.lifetime.signal.aborted) this.onChange(this.state);
  }
  private trim() {
    let total = [...this.cached.values()].reduce((sum, entry) => sum + (entry.track?.frameCount ?? 0) * 2, 0);
    for (const [key, entry] of this.cached) {
      if (total <= MAX_PREPARED_BYTES && this.cached.size <= 48) break;
      if (entry.refs || !entry.track) continue;
      total -= entry.track.frameCount * 2; entry.track.dispose(); this.cached.delete(key);
    }
  }
  private async acquire(segment: PlaybackSegment, pauseMs: number, publicationId: string): Promise<Lease> {
    const key = segmentKey(segment, pauseMs, publicationId);
    let entry = this.cached.get(key);
    if (!entry) {
      const created: Cached = { refs: 0, promise: Promise.resolve().then(() =>
        prepareAudio(segment.steps, pauseMs, this.token, this.userId, publicationId, this.lifetime.signal, segment.padEnd))
        .then(track => {
          if (this.lifetime.signal.aborted) { track.dispose(); throw new Error('Playback cancelled'); }
          created.track = track; this.trim(); return track;
        }).catch(error => { this.cached.delete(key); throw error; }) };
      entry = created; this.cached.set(key, entry);
    } else { this.cached.delete(key); this.cached.set(key, entry); }
    entry.refs++;
    let released = false;
    const release = () => { if (!released) { released = true; entry!.refs--; this.trim(); } };
    try { return { track: await entry.promise, release }; }
    catch (error) { release(); throw error; }
  }
  private destroySession(session: Session) {
    session.destroyed = true;
    session.removeListeners.forEach(remove => remove());
    session.playlist?.pause(); session.playlist?.destroy();
    session.queue.forEach(item => item.release()); session.queue = [];
    this.sessions.delete(session.key);
  }
  private getSession(steps: PlaybackStep[], pauseMs: number, publicationId: string, from: number) {
    const segments = playbackSegments(steps), startIndex = segmentAt(segments, from);
    const key = JSON.stringify([publicationId, pauseMs, startIndex, steps]);
    let existing = this.sessions.get(key);
    if (existing && existing.queue.length && existing.queue[0].index > startIndex) {
      this.destroySession(existing); existing = undefined;
    }
    if (existing) { this.sessions.delete(key); this.sessions.set(key, existing); return existing; }
    const session: Session = { key, segments, startIndex, pauseMs, publicationId, next: startIndex,
      queue: [], ready: Promise.resolve(), removeListeners: [], destroyed: false, mutating: false, waiting: false, started: false };
    this.sessions.set(key, session);
    session.ready = (async () => {
      const head = await this.acquire(segments[startIndex], pauseMs, publicationId);
      if (session.destroyed) { head.release(); return; }
      session.queue.push({ ...head, index: startIndex }); session.next++;
      const playlist = createAudioPlaylist({ sources: [{ uri: head.track.uri }], updateInterval: 50 });
      session.playlist = playlist;
      const subscription = playlist.addListener('playlistStatusUpdate', status => this.update(session, status));
      const transition = playlist.addListener('trackChanged', () => this.update(session));
      session.removeListeners.push(() => subscription.remove(), () => transition.remove());
      this.fill(session);
    })().catch(error => { session.failure = error instanceof Error ? error : new Error('Unable to prepare audio'); throw error; });
    void session.ready.catch(() => undefined);
    for (const other of this.sessions.values()) {
      if (this.sessions.size <= 3) break;
      if (other !== this.active && other !== session) this.destroySession(other);
    }
    return session;
  }
  private fill(session: Session) {
    if (session.filling || session.destroyed || session.failure || !session.playlist) return;
    const current = session.queue[session.playlist.currentIndex]?.index ?? session.startIndex;
    const end = Math.min(session.segments.length, current + LOOK_AHEAD + 1);
    if (session.next >= end) return;
    const begin = session.next;
    session.filling = (async () => {
      const pending = Array.from({ length: end - begin }, (_, offset) =>
        this.acquire(session.segments[begin + offset], session.pauseMs, session.publicationId)
          .then(value => ({ status: 'fulfilled' as const, value }), reason => ({ status: 'rejected' as const, reason })));
      for (let offset = 0; offset < pending.length; offset++) {
        const result = await pending[offset];
        if (result.status === 'rejected') {
          session.failure = result.reason instanceof Error ? result.reason : new Error('Unable to download the next sentence');
          pending.slice(offset + 1).forEach(later => { void later.then(value => { if (value.status === 'fulfilled') value.value.release(); }); });
          break;
        }
        if (session.destroyed) { result.value.release(); continue; }
        session.mutating = true;
        session.queue.push({ ...result.value, index: begin + offset }); session.next++;
        try { session.playlist!.add({ uri: result.value.track.uri }); }
        finally { session.mutating = false; }
        this.continueWaiting(session);
      }
    })().catch(error => { session.failure = error instanceof Error ? error : new Error('Unable to load the next sentence'); })
      .finally(() => {
        session.filling = undefined;
        if (session.destroyed) return;
        this.continueWaiting(session);
        if (this.active === session && this.wantsPlay) this.fill(session);
      });
  }
  private continueWaiting(session: Session) {
    if (!session.waiting || this.active !== session || !this.wantsPlay) return;
    const player = session.playlist!;
    if (player.currentIndex + 1 < session.queue.length) {
      session.waiting = false; player.skipTo(player.currentIndex + 1); player.play();
      this.lastMovement = Date.now(); this.emit({ playing: true, loading: false });
    } else if (session.failure) this.fail(session.failure);
  }
  private update(session: Session, event?: AudioPlaylistStatus) {
    if (session.destroyed || session.mutating || !session.started || !session.playlist || session !== this.active) return;
    if (session.waiting) { this.continueWaiting(session); return; }
    const player = session.playlist, item = session.queue[player.currentIndex];
    if (!item) return;
    const frame = event?.didJustFinish ? item.track.frameCount
      : Math.min(item.track.frameCount, Math.max(0, Math.round(player.currentTime * item.track.sampleRate)));
    const current = trackPosition(item.track, frame);
    this.emit({ ...current, occurrenceId: this.wantsPlay ? current.occurrenceId : null });
    const clock = item.index * 1e9 + frame;
    if (clock !== this.lastClock) { this.lastClock = clock; this.lastMovement = Date.now(); }
    if (this.measurement && this.wantsPlay && player.currentTime > this.measurement.from + 0.002) {
      if (__DEV__) console.info('[reader-playback] started', JSON.stringify({ tapToAudioMs: Date.now() - this.measurement.tappedAt,
        preparationMs: this.measurement.preparedAt - this.measurement.tappedAt, playerLoadMs: this.measurement.readyAt - this.measurement.preparedAt,
        warmed: this.measurement.cached, sentence: item.index + 1 }));
      this.measurement = undefined;
    }
    if (!this.wantsPlay) return;
    if (event?.didJustFinish || (frame >= item.track.frameCount && player.currentIndex === session.queue.length - 1)) {
      if (item.index === session.segments.length - 1) {
        this.wantsPlay = false; session.started = false; player.pause(); clearInterval(this.timer);
        this.emit({ sample: session.segments[item.index].end, playing: false, loading: false, canResume: false, occurrenceId: null, repetition: undefined }); return;
      }
      if (player.currentIndex + 1 < session.queue.length) { player.skipTo(player.currentIndex + 1); player.play(); }
      else {
        session.waiting = true; this.emit({ loading: true, playing: false });
        if (session.failure) { this.fail(session.failure); return; }
      }
    }
    while (player.currentIndex > 1) {
      session.mutating = true; player.remove(0); session.queue.shift()!.release(); session.mutating = false;
    }
    this.fill(session);
    if (Date.now() - this.lastMovement > 20000 && !session.filling) this.fail(new Error('Audio paused while loading. Tap Resume to retry.'));
  }
  private fail(error: Error) { this.pause(); this.emit({ error: error.message, canResume: !!this.active }); }
  private async waitFor(predicate: () => boolean, ticket: number, message: string) {
    const start = Date.now();
    while (!predicate()) {
      if (ticket !== this.generation || this.lifetime.signal.aborted) throw new Error('Playback cancelled');
      if (Date.now() - start > 15000) throw new Error(message);
      await new Promise<void>(resolve => setTimeout(resolve, 20));
    }
  }
  private ensureAudioMode() {
    this.audioMode ??= setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false })
      .then(() => { this.audioModeReady = true; })
      .catch(() => { this.audioMode = undefined; });
    return this.audioMode;
  }
  warm(plans: PlaybackStep[][], pauseMs: number, publicationId: string, sample = 0) {
    if (this.lifetime.signal.aborted) return;
    void this.ensureAudioMode();
    for (const steps of plans.slice(0, 3)) if (steps.length) {
      const session = this.getSession(steps, pauseMs, publicationId, sample);
      void session.ready.catch(() => undefined);
    }
  }
  async play(steps: PlaybackStep[], pauseMs: number, publicationId: string, sample = steps[0]?.narrationSample ?? 0) {
    const tappedAt = Date.now(); this.halt();
    if (!steps.length || this.lifetime.signal.aborted) { this.emit({ playing: false, loading: false }); return; }
    const ticket = ++this.generation;
    let session = this.getSession(steps, pauseMs, publicationId, sample);
    if (session.failure && !session.playlist) { this.destroySession(session); session = this.getSession(steps, pauseMs, publicationId, sample); }
    const warmed = !!session.playlist?.isLoaded;
    this.active = session; session.waiting = false; session.started = false; this.wantsPlay = true;
    try {
      // A ready queue starts before React redraws the passage. Yielding even to
      // an already-resolved promise would put that expensive render before audio.
      if (!session.playlist || !this.audioModeReady) {
        this.emit({ sample, loading: true, playing: false, canResume: false, repetition: undefined, occurrenceId: null, error: null });
        await Promise.all([session.ready, this.ensureAudioMode()]);
      }
      const preparedAt = Date.now();
      if (ticket !== this.generation || session.destroyed) return;
      const player = session.playlist!;
      // iOS rebuilds the queue even when skipTo targets its current item.
      if (player.currentIndex !== 0) player.skipTo(0);
      if (!player.isLoaded) {
        this.emit({ sample, loading: true, playing: false });
        await this.waitFor(() => player.isLoaded, ticket, 'Audio took too long to load. Tap Play to retry.');
      }
      if (ticket !== this.generation) return;
      const track = session.queue[0].track, target = frameAtSample(track, sample) / track.sampleRate;
      if (Math.abs(player.currentTime - target) > 0.005) {
        await player.seekTo(target);
        await this.waitFor(() => Math.abs(player.currentTime - target) < 0.025, ticket, 'Audio could not seek. Tap Play to retry.');
      }
      if (ticket !== this.generation) return;
      this.measurement = { tappedAt, preparedAt, readyAt: Date.now(), from: target, cached: warmed };
      this.lastMovement = Date.now(); this.lastClock = -1;
      session.started = true; player.play();
      this.emit({ sample, playing: true, loading: false, canResume: false, repetition: undefined, occurrenceId: null, error: null });
      clearInterval(this.timer); this.timer = setInterval(() => this.update(session), 50); this.fill(session);
    } catch (error) {
      if (ticket === this.generation && !this.lifetime.signal.aborted) this.fail(error instanceof Error ? error : new Error('Unable to play audio'));
    }
  }
  private halt() {
    ++this.generation; const session = this.active;
    this.wantsPlay = false; this.measurement = undefined; clearInterval(this.timer);
    if (session) {
      session.mutating = true;
      try { session.playlist?.pause(); } finally { session.mutating = false; }
    }
  }
  pause() {
    this.halt();
    if (this.active) this.update(this.active);
    this.emit({ playing: false, loading: false, canResume: !!this.active, occurrenceId: null });
  }
  async resume() {
    const session = this.active;
    if (!session || this.lifetime.signal.aborted) return;
    if (!session.playlist || !session.started) return this.play(session.segments.flatMap(s => s.steps), session.pauseMs, session.publicationId, this.state.sample);
    session.failure = undefined; this.wantsPlay = true; this.lastMovement = Date.now();
    if (session.waiting) {
      this.emit({ error: null, loading: true, canResume: false });
      clearInterval(this.timer); this.timer = setInterval(() => this.update(session), 50);
      this.continueWaiting(session); this.fill(session); return;
    }
    session.playlist.play(); this.emit({ error: null, playing: true, loading: false, canResume: false });
    clearInterval(this.timer); this.timer = setInterval(() => this.update(session), 50); this.fill(session);
  }
  stop() { this.pause(); this.active = undefined; this.emit({ canResume: false, repetition: undefined }); }
  dispose() {
    this.lifetime.abort(); this.pause();
    for (const session of [...this.sessions.values()]) this.destroySession(session);
    for (const entry of this.cached.values()) entry.track?.dispose();
    this.cached.clear(); this.active = undefined;
  }
}
