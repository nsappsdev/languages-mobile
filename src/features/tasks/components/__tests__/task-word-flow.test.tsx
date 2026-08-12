import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Animated, StyleSheet, Text } from 'react-native';
import { TaskWordFlow } from '../task-word-flow';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';

const untranslatedEntry: VocabularyEntry = {
  id: 'entry-never',
  englishText: 'never',
  normalizedText: 'never',
  focusNormalizedText: null,
  kind: 'WORD',
  tags: [],
  translations: [],
};

const selectedUntranslatedItem: LearnerVocabularyItem = {
  id: 'learner-entry-never',
  userId: 'user-1',
  entryId: untranslatedEntry.id,
  status: 'LEARNING',
  addedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  entry: untranslatedEntry,
};

const baseProps = {
  activeSegmentId: null,
  entryCacheByText: { never: untranslatedEntry },
  getTokenPulseValue: () => new Animated.Value(0),
  handleSeekToSegment: jest.fn(),
  handleTokenPositionLayout: jest.fn(),
  handleTokenWordLayout: jest.fn(),
  handleToggleWordVocabulary: jest.fn(),
  isPlaying: false,
  isPlaybackNavigationActive: false,
  mainTextFontFamily: undefined,
  mainTextFontSize: 18,
  mainTextLineHeight: 24,
  onLayout: jest.fn(),
  pendingWords: {},
  segmentStartById: { 'segment-1': 0 },
  tokenSegmentIds: ['segment-1'],
  tokenWidths: { '0:never': 52 },
  translationFitSettings: {
    maxFontSize: 15,
    maxLetterSpacing: 0.8,
    minFontSize: 8,
    minLetterSpacing: -0.2,
  },
  translationFontFamily: undefined,
  triggerTokenFeedback: jest.fn(),
  unknownTaps: {},
  vocabularyByText: {},
  vocabularyTokenMatches: [
    {
      entry: untranslatedEntry,
      focusNormalizedText: null,
      focusTokenIndex: null,
      normalizedText: 'never',
      startIndex: 0,
      endIndex: 0,
      tokenIndices: [0],
    },
  ],
  wordTokens: [
    {
      end: 5,
      key: '0:never',
      normalized: 'never',
      start: 0,
      text: 'never',
    },
  ],
};

describe('TaskWordFlow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function expectMissingIconVisible(renderer: ReactTestRenderer) {
    const iconNode = renderer.root
      .findAllByType(Text)
      .find((node) => node.props.children === '∅');
    expect(iconNode).toBeTruthy();
    const style = StyleSheet.flatten(iconNode?.props.style);
    expect(style.fontSize).toBe(15);
    expect(style.lineHeight).toBe(18);
    expect(style.minHeight).toBe(18);
    expect(style.transform?.[0]?.scale).toBeTruthy();
  }

  it('flashes the missing-translation indicator when a selected untranslated word is tapped while paused', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TaskWordFlow
          {...baseProps}
          vocabularyByText={{ never: selectedUntranslatedItem }}
        />,
      );
    });

    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '∅')).toBe(false);

    act(() => {
      const pressTarget = renderer.root.findAll((node) => typeof node.props.onPress === 'function')[0];
      pressTarget.props.onPress();
    });

    expect(baseProps.handleSeekToSegment).not.toHaveBeenCalled();
    expect(baseProps.handleToggleWordVocabulary).not.toHaveBeenCalled();
    expectMissingIconVisible(renderer);

    act(() => {
      jest.advanceTimersByTime(1599);
    });

    expectMissingIconVisible(renderer);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '∅')).toBe(false);
  });

  it('flashes the missing-translation indicator for a plain lesson word with no vocabulary entry', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TaskWordFlow
          {...baseProps}
          entryCacheByText={{}}
          vocabularyTokenMatches={[null]}
        />,
      );
    });

    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '∅')).toBe(false);

    act(() => {
      const pressTarget = renderer.root.findAll((node) => typeof node.props.onPress === 'function')[0];
      pressTarget.props.onPress();
    });

    expect(baseProps.handleSeekToSegment).not.toHaveBeenCalled();
    expect(baseProps.handleToggleWordVocabulary).not.toHaveBeenCalled();
    expectMissingIconVisible(renderer);

    act(() => {
      jest.advanceTimersByTime(1600);
    });

    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '∅')).toBe(false);
  });

  it('seeks instead of showing vocabulary feedback when playback navigation is active', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TaskWordFlow
          {...baseProps}
          entryCacheByText={{}}
          isPlaybackNavigationActive
          vocabularyTokenMatches={[null]}
        />,
      );
    });

    act(() => {
      const pressTarget = renderer.root.findAll((node) => typeof node.props.onPress === 'function')[0];
      pressTarget.props.onPress();
    });

    expect(baseProps.handleSeekToSegment).toHaveBeenCalledWith(0);
    expect(baseProps.handleToggleWordVocabulary).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(Text).some((node) => node.props.children === '∅')).toBe(false);
  });
});
