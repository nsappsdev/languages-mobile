import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { usePlayback } from '../use-playback';
import type { PlaybackStep } from '../model';
import { prepareAudio, type PreparedAudio } from '../prepared-audio';
import { fixture } from '../testing/fixture';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]) }));
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: jest.fn() }) } }));
jest.mock('../prepared-audio', () => ({ prepareAudio: jest.fn() }));
jest.mock('expo-audio', () => ({ createAudioPlayer: () => mockPlayer, setAudioModeAsync: jest.fn(async () => undefined) }));

let mockSeekDelayMs = 0;
let mockTimer: ReturnType<typeof setInterval> | undefined;
let mockReleased = false;
const mockListeners = new Set<() => void>();
const mockPlayer = {
  currentTime: 0, isLoaded: true, currentStatus: { didJustFinish: false, playbackState: 'readyToPlay' },
  pause: jest.fn(() => { if (mockReleased) throw new Error('Player already released'); clearInterval(mockTimer); }),
  replace: jest.fn(() => { mockPlayer.currentTime = 0; mockPlayer.isLoaded = true; }),
  seekTo: jest.fn(async (seconds: number) => {
    if (mockSeekDelayMs) setTimeout(() => { mockPlayer.currentTime = seconds; }, mockSeekDelayMs);
    else mockPlayer.currentTime = seconds;
  }),
  addListener: jest.fn((_event: string, listener: () => void) => { mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) }; }),
  play: jest.fn(() => {
    if (mockReleased) throw new Error('Player already released');
    clearInterval(mockTimer);
    mockTimer = setInterval(() => { mockPlayer.currentTime += 0.01; mockListeners.forEach(listener => listener()); }, 10);
  }),
  release: jest.fn(() => { clearInterval(mockTimer); mockListeners.clear(); mockReleased = true; }),
};
const steps = (): PlaybackStep[] => [1, 2, 3].map(index => ({
  asset: { ...fixture.occurrences[1].learning!.clip, sampleRate: 1000 },
  channel: 'drill', startSample: 0, endSample: 100, narrationSample: 200, occurrenceId: 'cat1', pauseAfter: index < 3,
  repetition: { kind: 'word', label: 'cat', index, total: 3 },
}));
let audio: ReturnType<typeof usePlayback>;
let renderer: ReactTestRenderer;
let track: PreparedAudio;
function Harness() { audio = usePlayback('test-token', 'test-user', 'test-publication'); return null; }
const tick = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); mockSeekDelayMs = 0;
  mockReleased = false; clearInterval(mockTimer); mockListeners.clear(); mockPlayer.currentTime = 0; mockPlayer.isLoaded = true;
  track = { uri: 'blob:prepared', sampleRate: 1000, frameCount: 700, dispose: jest.fn(), spans: steps().flatMap((step, i) => [
    { step, start: i * 300, end: i * 300 + 100, sourceStart: 0, sourceEnd: 100 },
    ...(i < 2 ? [{ step, start: i * 300 + 100, end: i * 300 + 300, sourceStart: 100, sourceEnd: 100, silence: true }] : []),
  ]) };
  jest.mocked(prepareAudio).mockResolvedValue(track);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { renderer = create(<Harness />); });
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.useRealTimers(); });

it('uses one continuous play with no seek or reload at repetition boundaries', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(350);
  expect(audio.repetition?.index).toBe(2);
  expect(audio.sample).toBe(200);
  await tick(500);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockPlayer.seekTo).not.toHaveBeenCalled();
  expect(prepareAudio).toHaveBeenCalledWith(steps(), 200, 'test-token', 'test-user', 'test-publication', expect.any(AbortSignal));
  expect(audio.playing).toBe(false); expect(audio.canResume).toBe(false);
  expect(track.dispose).toHaveBeenCalledTimes(1);
});

it('resumes in the remaining silence without restarting the gap or repeating a completed word', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(150);
  await act(async () => audio.pause());
  expect(audio.canResume).toBe(true);
  await tick(1000);
  await act(async () => { void audio.resume(); });
  await tick(160);
  expect(audio.repetition?.index).toBe(2);
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  expect(prepareAudio).toHaveBeenCalledTimes(1);
  await tick(500); expect(audio.canResume).toBe(false);
});

it('captures the player clock and resumes the same word at the same point', async () => {
  await act(async () => { void audio.play(steps(), 200); }); await tick(350);
  await act(async () => audio.pause());
  const position = mockPlayer.currentTime;
  mockPlayer.currentTime = 0; mockSeekDelayMs = 40;
  await act(async () => { void audio.resume(); }); await tick(30);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await tick(20);
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  expect(mockPlayer.seekTo.mock.calls[0][0]).toBeCloseTo(position, 3);
  expect(audio.repetition?.index).toBe(2);
});

it('disposes the old prepared track when starting a new sequence', async () => {
  await act(async () => { void audio.play(steps(), 200); }); await tick(150);
  await act(async () => audio.pause());
  const next = { ...track, uri: 'blob:new', dispose: jest.fn() };
  jest.mocked(prepareAudio).mockResolvedValue(next);
  await act(async () => { void audio.play(steps(), 400); });
  expect(track.dispose).toHaveBeenCalledTimes(1);
  expect(prepareAudio).toHaveBeenLastCalledWith(steps(), 400, 'test-token', 'test-user', 'test-publication', expect.any(AbortSignal));
  await tick(800); expect(next.dispose).toHaveBeenCalledTimes(1);
});

it('never plays a track that finishes preparing after cancellation', async () => {
  let resolve!: (value: PreparedAudio) => void;
  jest.mocked(prepareAudio).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await act(async () => { void audio.play(steps(), 200); });
  await act(async () => audio.stop());
  await act(async () => resolve(track));
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(track.dispose).toHaveBeenCalledTimes(1);
  expect(audio.canResume).toBe(false);
});

it('cancels listeners before releasing native players and temporary audio on unmount', async () => {
  await act(async () => { void audio.play(steps(), 200); }); await tick(50);
  await act(async () => renderer.unmount());
  expect(mockPlayer.release).toHaveBeenCalledTimes(1);
  expect(track.dispose).toHaveBeenCalledTimes(1);
  expect(mockListeners.size).toBe(0);
  await tick(1000);
});
