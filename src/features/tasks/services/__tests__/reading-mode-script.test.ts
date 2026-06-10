import {
  buildReadingModeScript,
  getPulseDurationMs,
  resumePlaybackRanges,
  type PlaybackRange,
} from '../reading-mode-script';
import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

const teachingMode: ReadingModeSettings = {
  id: 'teaching',
  enabled: true,
  displayName: 'Teaching',
  order: 1,
  unknownWordRepetitions: 3,
};

const baseItem: LessonItem = {
  id: 'item-1',
  lessonId: 'lesson-1',
  order: 0,
  text: 'We went to the beach.',
  audioUrl: '/media/audio/test.mp3',
  segments: [{ id: 's1', text: 'We went to the beach.', startMs: 0, endMs: 2500 }],
  chunkTimings: [],
  wordTimings: [
    { id: 'we', text: 'We', normalizedText: 'we', startMs: 0, endMs: 250, order: 0 },
    { id: 'beach', text: 'beach', normalizedText: 'beach', startMs: 1800, endMs: 2200, order: 1 },
  ],
  sentenceTimings: [
    { id: 's1', text: 'We went to the beach.', startMs: 0, endMs: 2500, wordMarkIds: ['we', 'beach'], order: 0 },
  ],
};

describe('buildReadingModeScript', () => {
  it('builds stable teaching steps with the configured total word plays', () => {
    const ranges = buildReadingModeScript({
      currentItem: baseItem,
      durationMs: 2500,
      mode: teachingMode,
      unknownNormalizedWords: new Set(['beach']),
      wordRepetitionPauseMs: 800,
    });

    expect(ranges.map(({ id, kind, startMs, endMs, pauseAfterMs }) => ({ id, kind, startMs, endMs, pauseAfterMs }))).toEqual([
      { id: 'continuous:0:1800', kind: 'continuous', startMs: 0, endMs: 1800, pauseAfterMs: undefined },
      { id: 'word:beach:1', kind: 'word_repeat', startMs: 1800, endMs: 2200, pauseAfterMs: 800 },
      { id: 'word:beach:2', kind: 'word_repeat', startMs: 1800, endMs: 2200, pauseAfterMs: 800 },
      { id: 'word:beach:3', kind: 'word_repeat', startMs: 1800, endMs: 2200, pauseAfterMs: undefined },
      { id: 'continuous:2200:2500', kind: 'continuous', startMs: 2200, endMs: 2500, pauseAfterMs: undefined },
    ]);
  });

  it('uses the latest edited end millisecond for each repeated word', () => {
    const item: LessonItem = {
      ...baseItem,
      text: 'Everyone has insecurities.',
      segments: [{ id: 'sentence-1', text: 'Everyone has insecurities.', startMs: 0, endMs: 1840 }],
      wordTimings: [
        { id: 'everyone', text: 'Everyone', normalizedText: 'everyone', startMs: 0, endMs: 700, order: 0 },
        { id: 'has', text: 'has', normalizedText: 'has', startMs: 760, endMs: 1120, order: 1 },
        { id: 'insecurities', text: 'insecurities', normalizedText: 'insecurities', startMs: 1120, endMs: 1840, order: 2 },
      ],
      sentenceTimings: [
        {
          id: 'sentence-1',
          text: 'Everyone has insecurities.',
          startMs: 0,
          endMs: 1840,
          wordMarkIds: ['everyone', 'has', 'insecurities'],
          order: 0,
        },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: item,
      durationMs: 1840,
      mode: { ...teachingMode, unknownWordRepetitions: 3 },
      unknownNormalizedWords: new Set(['everyone']),
    });

    expect(ranges.filter((range) => range.kind === 'word_repeat')).toEqual([
      expect.objectContaining({ id: 'word:everyone:1', startMs: 0, endMs: 700 }),
      expect.objectContaining({ id: 'word:everyone:2', startMs: 0, endMs: 700 }),
      expect.objectContaining({ id: 'word:everyone:3', startMs: 0, endMs: 700 }),
    ]);
  });

  it('derives phrases from word timings and ignores stale logical chunks', () => {
    const item: LessonItem = {
      ...baseItem,
      text: 'They naturally stir up attention.',
      segments: [{ id: 's1', text: 'They naturally stir up attention.', startMs: 0, endMs: 2000 }],
      chunkTimings: [{ id: 'old', text: 'naturally stir up', normalizedText: 'naturally stir up', startMs: 450, endMs: 1400, wordMarkIds: ['old-1'], order: 0 }],
      wordTimings: [
        { id: 'naturally', text: 'naturally', normalizedText: 'naturally', startMs: 500, endMs: 900, order: 0 },
        { id: 'stir', text: 'stir', normalizedText: 'stir', startMs: 900, endMs: 1150, order: 1 },
        { id: 'up', text: 'up', normalizedText: 'up', startMs: 1150, endMs: 1350, order: 2 },
      ],
      sentenceTimings: [{ id: 's1', text: itemText(), startMs: 0, endMs: 2000, wordMarkIds: ['naturally', 'stir', 'up'], order: 0 }],
    };

    const ranges = buildReadingModeScript({
      currentItem: item,
      durationMs: 2000,
      focusNormalizedByText: { 'naturally stir up': 'stir' },
      mode: { ...teachingMode, unknownWordRepetitions: 1 },
      unknownNormalizedWords: new Set(['naturally stir up']),
    });

    expect(ranges[1]).toMatchObject({
      id: 'word:naturally:stir:up:1',
      startMs: 500,
      endMs: 1350,
      pulseTargets: [{ normalizedWord: 'stir', startMs: 900, endMs: 1150 }],
    });
  });

  it('repeats every phrase occurrence and prefers the longest overlapping term', () => {
    const item: LessonItem = {
      ...baseItem,
      text: 'Stir up and stir up.',
      segments: [{ id: 's1', text: 'Stir up and stir up.', startMs: 0, endMs: 1800 }],
      wordTimings: [
        { id: 'stir-1', text: 'Stir', normalizedText: 'stir', startMs: 100, endMs: 300, order: 0 },
        { id: 'up-1', text: 'up', normalizedText: 'up', startMs: 300, endMs: 450, order: 1 },
        { id: 'and', text: 'and', normalizedText: 'and', startMs: 600, endMs: 750, order: 2 },
        { id: 'stir-2', text: 'stir', normalizedText: 'stir', startMs: 900, endMs: 1100, order: 3 },
        { id: 'up-2', text: 'up', normalizedText: 'up', startMs: 1100, endMs: 1250, order: 4 },
      ],
      sentenceTimings: [{ id: 's1', text: 'Stir up and stir up.', startMs: 0, endMs: 1800, wordMarkIds: ['stir-1', 'up-1', 'and', 'stir-2', 'up-2'], order: 0 }],
    };

    const ranges = buildReadingModeScript({
      currentItem: item,
      durationMs: 1800,
      mode: { ...teachingMode, unknownWordRepetitions: 1 },
      unknownNormalizedWords: new Set(['stir', 'stir up']),
    });

    expect(ranges.filter((range) => range.kind === 'word_repeat').map((range) => range.id)).toEqual([
      'word:stir-1:up-1:1',
      'word:stir-2:up-2:1',
    ]);
  });

  it('repeats qualifying deep-learning sentences immediately after their word work', () => {
    const item: LessonItem = {
      ...baseItem,
      text: 'First hard words. Then continue.',
      segments: [
        { id: 's1', text: 'First hard words.', startMs: 0, endMs: 1200 },
        { id: 's2', text: 'Then continue.', startMs: 1200, endMs: 2200 },
      ],
      wordTimings: [
        { id: 'hard', text: 'hard', normalizedText: 'hard', startMs: 300, endMs: 500, order: 0 },
        { id: 'words', text: 'words', normalizedText: 'words', startMs: 550, endMs: 800, order: 1 },
        { id: 'continue', text: 'continue', normalizedText: 'continue', startMs: 1500, endMs: 1800, order: 2 },
      ],
      sentenceTimings: [
        { id: 's1', text: 'First hard words.', startMs: 0, endMs: 1200, wordMarkIds: ['hard', 'words'], order: 0 },
        { id: 's2', text: 'Then continue.', startMs: 1200, endMs: 2200, wordMarkIds: ['continue'], order: 1 },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: item,
      durationMs: 2200,
      mode: { ...teachingMode, id: 'deep_learning', repeatSentenceWhenUnknownCountAtLeast: 2, sentenceRepetitions: 2 },
      unknownNormalizedWords: new Set(['hard', 'words', 'continue']),
    });

    const firstSecondSentenceStep = ranges.findIndex((range) => range.startMs >= 1200 && range.kind !== 'sentence_repeat');
    expect(ranges.slice(firstSecondSentenceStep - 2, firstSecondSentenceStep).map((range) => range.id)).toEqual([
      'sentence:s1:1',
      'sentence:s1:2',
    ]);
    expect(ranges.filter((range) => range.kind === 'sentence_repeat').map((range) => range.id)).toEqual([
      'sentence:s1:1',
      'sentence:s1:2',
    ]);
  });
});

describe('resumePlaybackRanges', () => {
  const ranges: PlaybackRange[] = [
    { id: 'continuous', kind: 'continuous', startMs: 0, endMs: 1000 },
    { id: 'repeat-1', kind: 'word_repeat', startMs: 1000, endMs: 1500 },
    { id: 'repeat-2', kind: 'word_repeat', startMs: 1000, endMs: 1500 },
    { id: 'tail', kind: 'continuous', startMs: 1500, endMs: 2200 },
  ];

  it('resumes a continuous step from the current position', () => {
    expect(resumePlaybackRanges({ ranges, resumeMs: 1800 }).ranges[0]).toEqual({
      id: 'tail', kind: 'continuous', startMs: 1800, endMs: 2200,
    });
  });

  it('restarts the exact repeated step by stable id', () => {
    expect(resumePlaybackRanges({ preferredStepId: 'repeat-2', ranges, resumeMs: 1200 })).toEqual({
      startIndex: 2,
      ranges: [ranges[2], ranges[3]],
    });
  });
});

describe('getPulseDurationMs', () => {
  it('keeps the pulse active through the repeat pause', () => {
    expect(getPulseDurationMs(
      { id: 'repeat', kind: 'word_repeat', startMs: 500, endMs: 1350, pauseAfterMs: 800 },
      { normalizedWord: 'naturally', startMs: 500, endMs: 900 },
    )).toBe(1650);
  });
});

function itemText() {
  return 'They naturally stir up attention.';
}
