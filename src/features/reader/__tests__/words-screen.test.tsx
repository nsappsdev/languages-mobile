import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WordsScreen } from '../words-screen';
import { fixture } from '../testing/fixture';
import type { ReaderWord } from '../types';
import type { PlaybackStep } from '../model';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void | (() => void)) => { jest.requireActual<typeof React>('react').useEffect(callback, [callback]); },
}));
jest.mock('@/src/shared/auth/session-context', () => ({ useSession: () => mockSession }));
jest.mock('@/src/shared/api/client', () => ({ apiClient: { getWords: jest.fn() } }));
jest.mock('@/src/shared/ui/screen-container', () => ({ ScreenContainer: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../use-resource', () => ({ useResource: () => ({ value: mockResource, loading: false, error: null }) }));
jest.mock('../use-playback', () => ({ usePlayback: (...args: unknown[]) => { mockPlaybackArgs(...args); return mockAudio; } }));
jest.mock('../sync-notice', () => ({ SyncNotice: () => null }));
jest.mock('../state-store', () => ({ pendingReaderChanges: jest.fn(async () => []) }));

const mockSession = { token: 'token', user: { id: 'user' } };
let mockParams: { textReleaseId?: string } = {};
const makeWord = (id: string, index: number, release = 'release-a'): ReaderWord => ({
  publicationId: `pub-${release}`, lessonId: 'lesson', lessonTitle: 'Garden', textReleaseId: release,
  occurrence: { ...fixture.occurrences[index], id, text: id }, sentence: fixture.text, status: 'LEARNING',
});
const mockWords = [makeWord('later', 3), makeWord('first', 1), makeWord('another', 1, 'release-b')];
const mockResource = { words: mockWords };
const mockCancel = jest.fn(), mockPlaybackArgs = jest.fn();
const mockAudio = { playing: false, loading: false, error: null, play: jest.fn(async () => undefined),
  stop: jest.fn(), warm: jest.fn(), preload: jest.fn((_plans: PlaybackStep[][]) => mockCancel) };
let renderer: ReactTestRenderer;
const buttons = () => renderer.root.findAll(node => typeof node.props.onPress === 'function');
const button = (label: string) => buttons().find(node => node.props.accessibilityLabel === label)!;
const order = () => buttons().filter(node => /^Play word /.test(node.props.accessibilityLabel ?? '')).map(node => node.props.accessibilityLabel);
const render = () => act(async () => { renderer = create(<WordsScreen />); });
const refresh = () => act(async () => renderer.update(<WordsScreen />));
beforeEach(() => {
  jest.clearAllMocks(); mockParams = { textReleaseId: 'release-a' };
  Object.assign(mockAudio, { playing: false, loading: false, error: null });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => { await act(async () => renderer?.unmount()); });

it('opens in text order, prepares only this text, and resets revealed meanings when shuffled', async () => {
  await render();
  expect(order()).toEqual(['Play word first', 'Play word later']);
  expect(mockPlaybackArgs).toHaveBeenLastCalledWith('token', 'user', 'pub-release-a');
  expect(mockAudio.preload.mock.calls.at(-1)![0].flat().map((step: any) => step.occurrenceId)).toEqual(['first', 'later']);
  await act(async () => button('Reveal Armenian translation for first').props.onPress());
  expect(button('Hide Armenian translation for first')).toBeDefined();
  await act(async () => button('Shuffle words').props.onPress());
  expect(order()).toEqual(['Play word later', 'Play word first']);
  expect(button('Reveal Armenian translation for first')).toBeDefined();
  await act(async () => button('Restore text order').props.onPress());
  expect(order()).toEqual(['Play word first', 'Play word later']);
});

it('keeps Stop available after startup resolves and allows replay when the clip ends', async () => {
  await render();
  await act(async () => button('Play word first').props.onPress());
  mockAudio.playing = true; await refresh();
  expect(button('Stop word first')).toBeDefined();
  await act(async () => button('Stop word first').props.onPress());
  expect(mockAudio.stop).toHaveBeenCalled();
  mockAudio.playing = false; await refresh();
  await act(async () => button('Play word first').props.onPress());
  expect(mockAudio.play).toHaveBeenCalledTimes(2);
});

it('cancels preloading and resets order when switching texts', async () => {
  await render();
  await act(async () => button('Shuffle words').props.onPress());
  mockParams = { textReleaseId: 'release-b' }; await refresh();
  expect(mockCancel).toHaveBeenCalled();
  expect(mockPlaybackArgs).toHaveBeenLastCalledWith('token', 'user', 'pub-release-b');
  expect(order()).toEqual(['Play word another']);
  expect(button('Shuffle words').props.disabled).toBe(true);
  expect(button('Restore text order')).toBeUndefined();
});
