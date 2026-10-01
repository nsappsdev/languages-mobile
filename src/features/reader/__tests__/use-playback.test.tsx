import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { usePlayback } from '../use-playback';
import { buildPlayback, DEFAULT_MODES, type PlaybackStep } from '../model';
import { fixture } from '../testing/fixture';

jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]) }));
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: jest.fn() }) } }));
jest.mock('../asset-cache', () => ({ readerAudio: jest.fn(async (_t, _u, _p, asset) => asset.id) }));
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => mockPlayers[mockAudioHookCall++ % 2],
  setAudioModeAsync: jest.fn(async () => undefined),
}));

// Explicit automated-test player: a clock advances the audio position without
// making network/provider calls. Exercise the real hook's queue and cancellation.
let mockAudioHookCall = 0;
let mockPlayStartedAt: { channel: string; time: number }[] = [];
let mockSeekDelayMs = 0;
function makeMockPlayer(channel: string) {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let released = false;
  const player = {
    currentTime: 0, isLoaded: true, currentStatus: { didJustFinish: false, playbackState: 'readyToPlay' },
    pause: jest.fn(() => { if (released) throw new Error('Player already released'); clearInterval(timer); }),
    replace: jest.fn(() => { player.currentTime = 0; player.isLoaded = true; }),
    seekTo: jest.fn(async (seconds: number) => {
      if (mockSeekDelayMs) setTimeout(() => { player.currentTime = seconds; }, mockSeekDelayMs);
      else player.currentTime = seconds;
    }),
    addListener: jest.fn((_event: string, listener: () => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; }),
    play: jest.fn(() => {
      if (released) throw new Error('Player already released');
      mockPlayStartedAt.push({ channel, time: Date.now() });
      clearInterval(timer);
      timer = setInterval(() => { player.currentTime += 0.01; listeners.forEach(listener => listener()); }, 10);
    }),
    release: jest.fn(() => { clearInterval(timer); listeners.clear(); released = true; }),
    reset: () => { clearInterval(timer); listeners.clear(); released = false; player.currentTime = 0; player.isLoaded = true; },
  };
  return player;
}
const mockNarrationPlayer = makeMockPlayer('narration');
const mockDrillPlayer = makeMockPlayer('drill');
const mockPlayers = [mockNarrationPlayer, mockDrillPlayer];
let audio: ReturnType<typeof usePlayback>;
let renderer: ReactTestRenderer;
function Harness() { audio = usePlayback('test-token', 'test-user', 'test-publication'); return null; }
const steps = (): PlaybackStep[] => [1, 2, 3].map(index => ({
  asset: { ...fixture.occurrences[1].learning!.clip, sampleRate: 1000 },
  channel: 'drill', startSample: 0, endSample: 100, narrationSample: 200, occurrenceId: 'cat1', pauseAfter: index < 3,
  repetition: { kind: 'word', label: 'cat', index, total: 3 },
}));
const tick = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); mockAudioHookCall = 0; mockPlayStartedAt = []; mockSeekDelayMs = 0;
  mockNarrationPlayer.reset(); mockDrillPlayer.reset();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { renderer = create(<Harness />); });
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.useRealTimers(); });

it('plays the requested sequence once and reuses the loaded clip between repetitions', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(1000);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(3);
  expect(mockNarrationPlayer.play).not.toHaveBeenCalled();
  expect(mockPlayStartedAt).toEqual([{ channel: 'drill', time: 0 }, { channel: 'drill', time: 300 }, { channel: 'drill', time: 600 }]);
  expect(mockDrillPlayer.replace).toHaveBeenCalledTimes(1);
  expect(audio.playing).toBe(false);
  expect(audio.canResume).toBe(false);
  expect(audio.error).toBeNull();
});

it('pauses between repeats without replaying a completed repetition or skipping the rest', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(150); // First clip finished; waiting before the second.
  await act(async () => audio.pause());
  expect(audio.canResume).toBe(true);
  await tick(1000);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { void audio.resume(); });
  expect(audio.repetition?.index).toBe(2);
  await tick(700);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(3);
  expect(audio.canResume).toBe(false);
});

it('resumes an interrupted clip at its saved position and retains its repeat number', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(350);
  expect(audio.repetition?.index).toBe(2);
  await act(async () => audio.pause());
  const position = mockDrillPlayer.currentTime;
  await act(async () => { void audio.resume(); });
  expect(audio.repetition?.index).toBe(2);
  expect(mockDrillPlayer.currentTime).toBe(position);
  await tick(700);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(4); // Three plays plus the interrupted second's continuation.
  expect(audio.playing).toBe(false);
});

it('cancels a paused queue when starting another playback sequence', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(150);
  await act(async () => audio.pause());
  await act(async () => { void audio.play([{ asset: fixture.narration, startSample: 0, endSample: 10, narrationSample: 0 }]); });
  await tick(1000);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockNarrationPlayer.play).toHaveBeenCalledTimes(1);
  expect(audio.canResume).toBe(false);
});

it('waits for the native seek position before starting a repetition', async () => {
  mockSeekDelayMs = 40;
  const step = { ...steps()[0], startSample: 50, endSample: 150 };
  await act(async () => { void audio.play([step]); });
  await tick(30);
  expect(mockDrillPlayer.play).not.toHaveBeenCalled();
  await tick(20);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockPlayStartedAt[0].time).toBeGreaterThanOrEqual(40);
  await tick(200);
  expect(audio.error).toBeNull();
});

it('parks the narration, drills on the second player, then resumes forward without seeking the narration', async () => {
  const schedule = buildPlayback(fixture, { ...DEFAULT_MODES[1], unknownWordRepetitions: 2 }, { 'release-a:cat1': 'LEARNING' });
  await act(async () => { void audio.play(schedule, 200); });
  await tick(18000);
  expect(mockNarrationPlayer.play).toHaveBeenCalledTimes(2);
  expect(mockDrillPlayer.play).toHaveBeenCalledTimes(2);
  expect(mockNarrationPlayer.seekTo).not.toHaveBeenCalled();
  expect(mockPlayStartedAt).toEqual([
    { channel: 'narration', time: 0 },
    { channel: 'drill', time: 2200 },
    { channel: 'drill', time: 5400 },
    { channel: 'narration', time: 8600 },
  ]);
  expect(audio.error).toBeNull();
});

it('cancels playback before explicitly releasing native players on unmount', async () => {
  await act(async () => { void audio.play(steps(), 200); });
  await tick(50);
  await act(async () => renderer.unmount());
  expect(mockNarrationPlayer.release).toHaveBeenCalledTimes(1);
  expect(mockDrillPlayer.release).toHaveBeenCalledTimes(1);
});
