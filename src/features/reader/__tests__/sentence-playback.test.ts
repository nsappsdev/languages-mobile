import { SentencePlayback, initialPlaybackState, type PlaybackState } from '../sentence-playback';
import { prepareAudio, type PreparedAudio } from '../prepared-audio';
import type { PlaybackStep } from '../model';
import { createAudioPlaylist } from 'expo-audio';

jest.mock('../prepared-audio', () => ({ prepareAudio: jest.fn() }));
jest.mock('expo-audio', () => ({ createAudioPlaylist: jest.fn((options: { sources: { uri: string }[] }) => {
  const playlist = new MockPlaylist(options.sources); mockPlayers.push(playlist); return playlist;
}), setAudioModeAsync: jest.fn(async () => undefined) }));
const mockTracks = new Map<string, PreparedAudio>();
const mockPlayers: MockPlaylist[] = [];
let mockSeekDelay = 0;
class MockPlaylist {
  currentIndex = 0; currentTime = 0; isLoaded = true; playing = false; destroyed = false;
  timer?: ReturnType<typeof setInterval>;
  listeners = new Set<(event?: any) => void>();
  constructor(public sources: { uri: string }[]) {}
  addListener = jest.fn((_event: string, fn: (event?: any) => void) => { this.listeners.add(fn); return { remove: () => this.listeners.delete(fn) }; });
  emit(event?: any) { this.listeners.forEach(fn => fn(event)); }
  pause = jest.fn(() => { this.playing = false; clearInterval(this.timer); });
  play = jest.fn(() => {
    if (this.destroyed) throw new Error('Destroyed playlist');
    this.playing = true; clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.currentTime += 0.01;
      const track = mockTracks.get(this.sources[this.currentIndex].uri)!;
      if (this.currentTime >= track.frameCount / track.sampleRate) {
        if (this.currentIndex + 1 < this.sources.length) { this.currentIndex++; this.currentTime = 0; this.emit(); }
        else { this.pause(); this.emit({ didJustFinish: true }); }
      } else this.emit();
    }, 10);
  });
  skipTo = jest.fn((index: number) => { if (index !== this.currentIndex) { this.currentIndex = index; this.currentTime = 0; this.emit(); } });
  seekTo = jest.fn(async (seconds: number) => {
    if (mockSeekDelay) setTimeout(() => { this.currentTime = seconds; }, mockSeekDelay);
    else this.currentTime = seconds;
  });
  add = jest.fn((source: { uri: string }) => { this.sources.push(source); this.emit(); });
  remove = jest.fn((index: number) => { this.sources.splice(index, 1); if (this.currentIndex > index) this.currentIndex--; this.emit(); });
  destroy = jest.fn(() => { this.pause(); this.listeners.clear(); this.destroyed = true; });
}
function steps(count = 5): PlaybackStep[] {
  return Array.from({ length: count }, (_, index) => ({ segmentId: `sentence-${index}`, channel: 'narration',
    asset: { id: `audio-${index}`, sha256: `hash-${index}`, mimeType: 'audio/wav', byteLength: 2044, sampleRate: 1000, frameCount: 1000 },
    startSample: 0, endSample: 1000, narrationSample: index * 1000, timelineOffset: index * 1000 }));
}
const drills = (): PlaybackStep[] => [1, 2, 3].map(index => ({ ...steps(1)[0], channel: 'drill',
  endSample: 100, narrationSample: 200, occurrenceId: 'cat', pauseAfter: index < 3,
  repetition: { kind: 'word', label: 'cat', index, total: 3 } }));
function prepared(input: PlaybackStep[], pause = 0, padEnd = false) {
  const spans: PreparedAudio['spans'] = []; let frameCount = 0;
  for (const [index, step] of input.entries()) {
    if (index && (step.pauseBefore || input[index - 1].pauseAfter)) {
      const previous = input[index - 1];
      spans.push({ start: frameCount, end: frameCount + pause, sourceStart: previous.endSample, sourceEnd: previous.endSample, step: previous, silence: true }); frameCount += pause;
    }
    const length = step.endSample - step.startSample;
    spans.push({ start: frameCount, end: frameCount + length, sourceStart: step.startSample, sourceEnd: step.endSample, step }); frameCount += length;
  }
  if (padEnd) frameCount += pause;
  const track: PreparedAudio = { uri: `blob:track-${mockTracks.size}`, sampleRate: 1000, frameCount, spans, dispose: jest.fn() };
  mockTracks.set(track.uri, track); return track;
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
let engine: SentencePlayback, state: PlaybackState;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); mockTracks.clear(); mockPlayers.length = 0; mockSeekDelay = 0;
  state = { ...initialPlaybackState };
  engine = new SentencePlayback('token', 'user', next => { state = next; });
  jest.mocked(prepareAudio).mockImplementation(async (input, pause, _token, _user, _pub, _signal, pad) => prepared(input, pause, pad));
});
afterEach(() => { engine.dispose(); jest.useRealTimers(); });

it('does not allocate players when an idle reader is stopped', () => {
  engine.stop(); engine.stop(); expect(createAudioPlaylist).not.toHaveBeenCalled();
});
it('warms only the current sentence and two ahead without starting playback', async () => {
  engine.warm([steps(20)], 400, 'pub'); await flush();
  expect(prepareAudio).toHaveBeenCalledTimes(3);
  expect(mockPlayers[0].play).not.toHaveBeenCalled();
  await engine.play(steps(20), 400, 'pub');
  expect(prepareAudio).toHaveBeenCalledTimes(3);
  expect(state.playing).toBe(true);
});
it('starts a warm queue synchronously without rebuilding its current native item', async () => {
  engine.warm([steps()], 400, 'pub'); await flush();
  const playing = engine.play(steps(), 400, 'pub');
  expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
  expect(mockPlayers[0].skipTo).not.toHaveBeenCalled();
  await playing;
});
it('preserves completed progress when the native queue clears its final item', async () => {
  await engine.play(steps(1), 400, 'pub');
  mockPlayers[0].currentTime = 0;
  mockPlayers[0].emit({ didJustFinish: true });
  expect(state.playing).toBe(false); expect(state.sample).toBe(1000);
});
it('starts the first sentence even while later downloads are still pending', async () => {
  jest.mocked(prepareAudio).mockImplementation(async input => input[0].segmentId === 'sentence-0' ? prepared(input) : new Promise(() => undefined));
  await engine.play(steps(), 400, 'pub');
  expect(state.playing).toBe(true); expect(state.loading).toBe(false);
  expect(mockPlayers[0].sources).toHaveLength(1);
});
it('keeps all word repetitions and pauses in one uninterrupted sentence segment', async () => {
  await engine.play(drills(), 200, 'pub');
  await jest.advanceTimersByTimeAsync(350);
  expect(state.repetition?.index).toBe(2); expect(state.sample).toBe(200);
  engine.pause(); const position = mockPlayers[0].currentTime;
  await jest.advanceTimersByTimeAsync(1000); await engine.resume();
  expect(mockPlayers[0].currentTime).toBe(position);
  await jest.advanceTimersByTimeAsync(400);
  expect(state.playing).toBe(false); expect(state.canResume).toBe(false);
  expect(mockPlayers[0].seekTo).not.toHaveBeenCalled(); expect(prepareAudio).toHaveBeenCalledTimes(1);
});
it('retains prepared audio and loaded queues across mode switches', async () => {
  const a = drills(), b = drills().slice(0, 2);
  engine.warm([a, b], 200, 'pub'); await flush();
  await engine.play(a, 200, 'pub'); await jest.advanceTimersByTimeAsync(150); engine.stop();
  await engine.play(b, 200, 'pub'); engine.stop(); await engine.play(a, 200, 'pub');
  expect(prepareAudio).toHaveBeenCalledTimes(2);
  expect(createAudioPlaylist).toHaveBeenCalledTimes(2);
  expect([...mockTracks.values()].every(track => !jest.mocked(track.dispose).mock.calls.length)).toBe(true);
});
it('seeks into an already prepared sentence with correct global progress', async () => {
  engine.warm([steps()], 400, 'pub', 1500); await flush();
  await engine.play(steps(), 400, 'pub', 1500);
  expect(mockPlayers[0].seekTo).toHaveBeenCalledWith(0.5);
  await jest.advanceTimersByTimeAsync(100);
  expect(state.sample).toBeGreaterThanOrEqual(1590);
  expect(prepareAudio).toHaveBeenCalledTimes(3);
});
it('waits for native seek completion before starting', async () => {
  engine.warm([steps()], 400, 'pub', 500); await flush(); mockSeekDelay = 40;
  const playing = engine.play(steps(), 400, 'pub', 500); await flush();
  await jest.advanceTimersByTimeAsync(30); expect(mockPlayers[0].play).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(30); await playing;
  expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
});
it('lets the newest jump win when old preparation finishes late', async () => {
  let resolve!: (track: PreparedAudio) => void;
  jest.mocked(prepareAudio).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const older = engine.play(steps(1), 400, 'pub'); await flush();
  const laterSteps = steps(1).map(step => ({ ...step, asset: { ...step.asset, id: 'new' } }));
  await engine.play(laterSteps, 400, 'pub');
  resolve(prepared(steps(1))); await older; await flush();
  expect(mockPlayers.filter(player => player.play.mock.calls.length)).toHaveLength(1);
  expect(state.playing).toBe(true); expect(state.error).toBeNull();
});
it('appends the next ready sentence without waiting for a slower sentence after it', async () => {
  let second!: (track: PreparedAudio) => void;
  jest.mocked(prepareAudio).mockImplementation(async input => input[0].segmentId === 'sentence-0' ? prepared(input)
    : input[0].segmentId === 'sentence-1' ? new Promise(r => { second = r; }) : new Promise(() => undefined));
  await engine.play(steps(), 400, 'pub'); await jest.advanceTimersByTimeAsync(1100);
  expect(state.loading).toBe(true);
  second(prepared([steps()[1]])); await flush();
  expect(mockPlayers[0].currentIndex).toBe(1); expect(state.playing).toBe(true);
  engine.pause(); await jest.advanceTimersByTimeAsync(1000); expect(mockPlayers[0].playing).toBe(false);
});
it('surfaces a missing next sentence and retries it without skipping forward', async () => {
  let fail = true;
  jest.mocked(prepareAudio).mockImplementation(async input => {
    if (input[0].segmentId === 'sentence-1' && fail) throw new Error('Network unavailable');
    return prepared(input);
  });
  await engine.play(steps(3), 400, 'pub'); await flush(); await jest.advanceTimersByTimeAsync(1100);
  expect(state.error).toBe('Network unavailable'); expect(state.canResume).toBe(true);
  fail = false; await engine.resume(); await flush(); await jest.advanceTimersByTimeAsync(100);
  expect(state.error).toBeNull(); expect(state.sample).toBeGreaterThan(1000); expect(state.sample).toBeLessThan(2000);
});
it('keeps the active playlist bounded during a long lesson', async () => {
  await engine.play(steps(20), 400, 'pub'); await jest.advanceTimersByTimeAsync(11000);
  expect(state.sample).toBeGreaterThan(10000);
  expect(mockPlayers[0].sources.length).toBeLessThanOrEqual(4);
  expect(mockPlayers[0].remove).toHaveBeenCalled();
});
it('disposes late warm-up results and never creates a player after leaving', async () => {
  let resolve!: (track: PreparedAudio) => void;
  jest.mocked(prepareAudio).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  engine.warm([steps(1)], 400, 'pub'); await flush(); engine.dispose();
  const track = prepared(steps(1)); resolve(track); await flush();
  expect(track.dispose).toHaveBeenCalledTimes(1); expect(createAudioPlaylist).not.toHaveBeenCalled();
});

it('preloads library clips with two workers and reuses them without starting audio', async () => {
  const waiting: (() => void)[] = [];
  jest.mocked(prepareAudio).mockImplementation(input => new Promise(resolve => { waiting.push(() => resolve(prepared(input))); }));
  engine.preload(steps(5).map(step => [step]), 0, 'pub'); await flush();
  expect(prepareAudio).toHaveBeenCalledTimes(2); expect(createAudioPlaylist).not.toHaveBeenCalled();
  waiting.splice(0).forEach(resolve => resolve()); await jest.advanceTimersByTimeAsync(1);
  expect(prepareAudio).toHaveBeenCalledTimes(4);
  waiting.splice(0).forEach(resolve => resolve()); await jest.advanceTimersByTimeAsync(1);
  waiting.splice(0).forEach(resolve => resolve()); await flush();
  expect(prepareAudio).toHaveBeenCalledTimes(5); expect(createAudioPlaylist).not.toHaveBeenCalled();
  await engine.play([steps(5)[3]], 0, 'pub');
  expect(prepareAudio).toHaveBeenCalledTimes(5); expect(state.playing).toBe(true);
});

it('stops queued library preparation when leaving and retries failed clips on demand', async () => {
  let finish!: () => void;
  jest.mocked(prepareAudio).mockImplementationOnce(input => new Promise(resolve => { finish = () => resolve(prepared(input)); }))
    .mockRejectedValueOnce(new Error('Offline'));
  const cancel = engine.preload(steps(5).map(step => [step]), 0, 'pub'); await flush();
  cancel(); finish(); await jest.advanceTimersByTimeAsync(1);
  expect(prepareAudio).toHaveBeenCalledTimes(2);
  await engine.play([steps(5)[1]], 0, 'pub');
  expect(state.error).toBeNull(); expect(state.playing).toBe(true);
  expect(prepareAudio).toHaveBeenCalledTimes(3);
});
