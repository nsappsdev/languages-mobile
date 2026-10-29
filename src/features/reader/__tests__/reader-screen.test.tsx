import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AppSettings } from '@/src/types/domain';
import { ReaderScreen } from '../reader-screen';
import { DEFAULT_MODES, type PlaybackStep } from '../model';
import { saveReaderChange } from '../state-store';
import { sentenceFixture } from '../testing/fixture';
import type { ReaderResponse } from '../types';
import { apiClient } from '@/src/shared/api/client';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/src/shared/auth/session-context', () => ({ useSession: () => mockSession }));
jest.mock('@/src/shared/api/client', () => ({ apiClient: { activateLessonVocabulary: jest.fn() } }));
jest.mock('../use-resource', () => ({ useResource: () => ({ value: mockResource, loading: false, error: null }) }));
jest.mock('../use-playback', () => ({ usePlayback: () => mockAudio }));
jest.mock('../sync-notice', () => ({ SyncNotice: () => null }));
jest.mock('../state-store', () => ({
  pendingReaderChanges: jest.fn(async () => []), saveReaderChange: jest.fn(async () => undefined),
  flushReaderChanges: jest.fn(async () => undefined), readerTimestamp: () => '2026-10-15T00:00:00.000Z',
}));

const mockSession = { token: 'test-token', user: { id: 'test-user' } };
const response: ReaderResponse = {
  publicationId: 'test-publication',
  manifest: { schemaVersion: 2, lessonId: 'test-lesson', title: 'Test', description: null, texts: [sentenceFixture] },
  words: [{ textReleaseId: 'release-a', occurrenceId: 'cat2', status: 'LEARNING', clientUpdatedAt: '' }],
  progress: [],
};
const settings: AppSettings = {
  id: 'settings', readingModes: DEFAULT_MODES,
  mainTextFontFamily: 'System', mainTextFontSize: 20,
  translationFontFamily: 'System', translationFontSize: 12, translationFontMinSize: 8, translationFontMaxSize: 12,
  translationLetterSpacingMin: -1, translationLetterSpacingMax: 0,
  wordRepetitionPauseMs: 400, createdAt: '', updatedAt: '',
};
const mockResource = { response, settings };
const mockAudio = {
  playing: true, loading: false, sample: 100, occurrenceId: null, repetition: undefined as PlaybackStep['repetition'],
  error: null, canResume: false, setSample: jest.fn(),
  play: jest.fn(async (_steps: PlaybackStep[], _pauseMs: number) => undefined),
  pause: jest.fn(), stop: jest.fn(), resume: jest.fn(),
};
let renderer: ReactTestRenderer;
const button = (property: string, value: string) => renderer.root.findAll(node => node.props[property] === value && typeof node.props.onPress === 'function')[0];
const tapWord = (id: string) => act(async () => {
  const word = button('testID', `reader-word-${id}`);
  expect(word.props.disabled).toBe(false);
  word.props.onPress();
});
const refresh = () => act(async () => renderer.update(<ReaderScreen lessonId="test-lesson" />));

beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  Object.assign(mockAudio, { playing: true, loading: false, sample: 100, repetition: undefined });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { renderer = create(<ReaderScreen lessonId="test-lesson" />); });
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.useRealTimers(); });

it('marks all unmarked lesson words once and keeps individual word controls working afterward', async () => {
  mockAudio.playing = false;
  await refresh();
  jest.mocked(apiClient.activateLessonVocabulary).mockResolvedValue({ activatedCount: 2, words: [
    { textReleaseId: 'release-a', occurrenceId: 'cat1', status: 'LEARNING', clientUpdatedAt: '' },
    { textReleaseId: 'release-a', occurrenceId: 'cat2', status: 'LEARNING', clientUpdatedAt: '' },
  ] });
  await act(async () => button('accessibilityLabel', 'Mark all lesson words as unknown').props.onPress());
  expect(apiClient.activateLessonVocabulary).toHaveBeenCalledWith('test-token', 'test-publication', expect.any(String));
  expect(button('testID', 'reader-word-cat1').props.accessibilityState.selected).toBe(true);
  expect(button('testID', 'reader-word-cat2').props.accessibilityState.selected).toBe(true);
  jest.mocked(saveReaderChange).mockClear();
  await tapWord('cat1');
  expect(button('testID', 'reader-word-cat1').props.accessibilityState.selected).toBe(false);
  expect(saveReaderChange).toHaveBeenCalledWith('test-user', expect.objectContaining({ occurrenceId: 'cat1', status: 'NEW' }));
  await refresh();
  expect(apiClient.activateLessonVocabulary).toHaveBeenCalledTimes(1);
  expect(button('testID', 'reader-word-cat1').props.accessibilityState.selected).toBe(false);
});

it('leaves word choices unchanged when bulk selection fails', async () => {
  mockAudio.playing = false; await refresh();
  jest.mocked(apiClient.activateLessonVocabulary).mockRejectedValue(new Error('Please reconnect and try again.'));
  await act(async () => button('accessibilityLabel', 'Mark all lesson words as unknown').props.onPress());
  expect(button('testID', 'reader-word-cat1').props.accessibilityState.selected).toBe(false);
  expect(renderer.root.findAll(node => node.props.accessibilityRole === 'alert').some(node => node.props.children === 'Please reconnect and try again.')).toBe(true);
});

it.each(DEFAULT_MODES)('jumps forward and backward without changing vocabulary in $id mode', async mode => {
  await act(async () => button('accessibilityLabel', `Mode ${mode.displayName}`).props.onPress());
  // A selected word late in the next sentence seeks to the sentence, not the word.
  await tapWord('cat2');
  const [steps, pauseMs] = mockAudio.play.mock.calls.at(-1)!;
  expect(steps[0].startSample).toBe(500);
  expect(pauseMs).toBe(400);
  expect(steps.some(step => step.repetition)).toBe(mode.id !== 'introduction');
  mockAudio.sample = 800;
  await refresh();
  // Words without translations work too, including a jump backward.
  await tapWord('a1');
  expect(mockAudio.play.mock.calls.at(-1)![0][0].startSample).toBe(0);
  await tapWord('a2');
  expect(mockAudio.play.mock.calls.at(-1)![0][0].startSample).toBe(500);
  expect(saveReaderChange).not.toHaveBeenCalled();
  expect(button('testID', 'reader-word-cat2').props.accessibilityState.selected).toBe(true);
});

it('accepts word taps during repetitions and while another jump is loading', async () => {
  mockAudio.repetition = { kind: 'word', label: 'cat', index: 2, total: 3 };
  await refresh();
  await tapWord('a2');
  mockAudio.playing = false; mockAudio.loading = true;
  await refresh();
  await tapWord('cat1');
  expect(mockAudio.play.mock.calls.map(([steps]) => steps[0].startSample)).toEqual([500, 0]);
  expect(saveReaderChange).not.toHaveBeenCalled();
});

it('keeps paused word selection and missing-translation feedback', async () => {
  mockAudio.playing = false;
  await refresh();
  jest.mocked(saveReaderChange).mockClear();
  await tapWord('cat1');
  expect(saveReaderChange).toHaveBeenCalledWith('test-user', expect.objectContaining({ kind: 'word', occurrenceId: 'cat1', status: 'LEARNING' }));
  await tapWord('a2');
  expect(renderer.root.findAll(node => node.props.testID === 'missing-translation-a2').length).toBeGreaterThan(0);
  expect(mockAudio.play).not.toHaveBeenCalled();
});

it('applies reader fonts, line heights and both gaps while fitting measured translations', async () => {
  const original = mockResource.settings;
  try {
    mockResource.settings = { ...settings, mainTextFontFamily: 'reader-main', mainTextFontId: 'main', mainTextFontSize: 24, mainTextLineHeight: 1.5,
      translationFontFamily: 'reader-armenian', translationFontId: 'armenian', translationFontMaxSize: 20,
      translationLineHeight: 1.6, translationGap: 7, readingRowGap: 13 };
    await refresh();
    const node = (id: string) => renderer.root.findAll(item => item.props.testID === id)[0];
    const fontScale = Dimensions.get('window').fontScale;
    const translationHeight = Math.ceil(32 * fontScale);
    expect(StyleSheet.flatten(node('reader-word-text-cat2').props.style)).toMatchObject({ fontFamily: 'reader-main', fontSize: 24, lineHeight: 36 });
    expect(StyleSheet.flatten(node('reader-row-gap-cat2').props.style)).toMatchObject({ marginBottom: 13 });
    expect(StyleSheet.flatten(node('reader-translation-gap-cat2').props.style)).toMatchObject({ paddingTop: translationHeight + 7 });
    await act(async () => {
      node('reader-word-text-cat2').props.onLayout({ nativeEvent: { layout: { width: 80 } } });
      node('measure-translation-cat2').props.onLayout({ nativeEvent: { layout: { width: 30 } } });
    });
    expect(StyleSheet.flatten(node('translation-cat2').props.style)).toMatchObject({ fontFamily: 'reader-armenian', fontSize: 20, minHeight: translationHeight, lineHeight: translationHeight / fontScale });
  } finally {
    mockResource.settings = original;
  }
});

it('reserves enough room above the English word for the complete translation', async () => {
  const node = (id: string) => renderer.root.findAll(item => item.props.testID === id)[0];
  await act(async () => {
    node('reader-word-text-cat2').props.onLayout({ nativeEvent: { layout: { width: 24 } } });
    node('measure-translation-cat2').props.onLayout({ nativeEvent: { layout: { width: 1200 } } });
  });
  const label = node('translation-cat2');
  const labelStyle = StyleSheet.flatten(label.props.style);
  expect(label.props.children).toBe('երկրորդ կատու');
  expect(label.props.numberOfLines).toBeUndefined();
  expect(labelStyle.height).toBeUndefined();
  expect(labelStyle.width).toBeLessThanOrEqual(Dimensions.get('window').width - 40);
  expect(StyleSheet.flatten(node('reader-translation-gap-cat2').props.style).minWidth).toBe(labelStyle.width);
  await act(async () => label.props.onLayout({ nativeEvent: { layout: { height: 64 } } }));
  expect(StyleSheet.flatten(node('reader-translation-gap-cat2').props.style).paddingTop).toBe(66);
});
