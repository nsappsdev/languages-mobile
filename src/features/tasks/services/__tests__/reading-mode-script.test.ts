import {
  buildReadingModeScript,
  getPulseDurationMs,
  resumePlaybackRanges,
} from '../reading-mode-script';
import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

const baseItem: LessonItem = {
  id: 'item-1',
  lessonId: 'lesson-1',
  order: 0,
  text: 'We went to the beach.',
  audioUrl: '/media/audio/test.mp3',
  segments: [{ id: 's1', text: 'We went to the beach.', startMs: 0, endMs: 2500 }],
  chunkTimings: [],
  wordTimings: [
    { id: 'w1', text: 'We', normalizedText: 'we', startMs: 0, endMs: 250, order: 0 },
    { id: 'w2', text: 'beach', normalizedText: 'beach', startMs: 1800, endMs: 2200, order: 1 },
  ],
  sentenceTimings: [
    {
      id: 's1',
      text: 'We went to the beach.',
      startMs: 0,
      endMs: 2500,
      wordMarkIds: ['w1', 'w2'],
      order: 0,
    },
  ],
};

const teachingMode: ReadingModeSettings = {
  id: 'teaching',
  enabled: true,
  displayName: 'Teaching',
  order: 1,
  unknownWordRepetitions: 3,
};

describe('buildReadingModeScript', () => {
  it('plays the unknown word once naturally before seeking back for configured repeats', () => {
    const ranges = buildReadingModeScript({
      currentItem: baseItem,
      durationMs: 2500,
      mode: teachingMode,
      unknownNormalizedWords: new Set(['beach']),
      wordRepetitionPauseMs: 800,
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 1800 },
      {
        startMs: 1800,
        endMs: 2200,
        pauseAfterMs: 800,
        pulseTargets: [{ normalizedWord: 'beach', startMs: 1800, endMs: 2200 }],
      },
      {
        startMs: 1800,
        endMs: 2200,
        pauseAfterMs: 800,
        pulseTargets: [{ normalizedWord: 'beach', startMs: 1800, endMs: 2200 }],
      },
      {
        startMs: 1800,
        endMs: 2200,
        pulseTargets: [{ normalizedWord: 'beach', startMs: 1800, endMs: 2200 }],
      },
      { startMs: 2200, endMs: 2500 },
    ]);
  });

  it('targets each token translation when an unknown phrase repeats', () => {
    const phraseItem: LessonItem = {
      ...baseItem,
      text: 'We ate ice cream.',
      segments: [{ id: 's1', text: 'We ate ice cream.', startMs: 0, endMs: 1800 }],
      chunkTimings: [
        {
          id: 'chunk-1',
          text: 'ice cream',
          normalizedText: 'ice cream',
          startMs: 900,
          endMs: 1500,
          wordMarkIds: ['ice', 'cream'],
          order: 0,
        },
      ],
      wordTimings: [
        {
          id: 'ice',
          text: 'ice',
          normalizedText: 'ice',
          startMs: 900,
          endMs: 1125,
          order: 0,
        },
        {
          id: 'cream',
          text: 'cream',
          normalizedText: 'cream',
          startMs: 1125,
          endMs: 1500,
          order: 1,
        },
      ],
      sentenceTimings: [
        {
          id: 's1',
          text: 'We ate ice cream.',
          startMs: 0,
          endMs: 1800,
          wordMarkIds: ['ice', 'cream'],
          order: 0,
        },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: phraseItem,
      durationMs: 1800,
      focusNormalizedByText: { 'ice cream': 'cream' },
      mode: { ...teachingMode, unknownWordRepetitions: 2 },
      unknownNormalizedWords: new Set(['ice cream']),
      wordRepetitionPauseMs: 1000,
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 900 },
      {
        startMs: 900,
        endMs: 1500,
        pauseAfterMs: 1000,
        pulseTargets: [{ normalizedWord: 'cream', startMs: 1125, endMs: 1500 }],
      },
      {
        startMs: 900,
        endMs: 1500,
        pulseTargets: [{ normalizedWord: 'cream', startMs: 1125, endMs: 1500 }],
      },
      { startMs: 1500, endMs: 1800 },
    ]);
  });

  it('repeats a saved phrase from child word timings when no exact logical chunk exists', () => {
    const phraseItem: LessonItem = {
      ...baseItem,
      text: 'They naturally stir up attention.',
      segments: [{ id: 's1', text: 'They naturally stir up attention.', startMs: 0, endMs: 2600 }],
      chunkTimings: [],
      wordTimings: [
        {
          id: 'naturally',
          text: 'naturally',
          normalizedText: 'naturally',
          startMs: 500,
          endMs: 900,
          order: 0,
        },
        {
          id: 'stir',
          text: 'stir',
          normalizedText: 'stir',
          startMs: 900,
          endMs: 1150,
          order: 1,
        },
        {
          id: 'up',
          text: 'up',
          normalizedText: 'up',
          startMs: 1150,
          endMs: 1350,
          order: 2,
        },
      ],
      sentenceTimings: [
        {
          id: 's1',
          text: 'They naturally stir up attention.',
          startMs: 0,
          endMs: 2600,
          wordMarkIds: ['naturally', 'stir', 'up'],
          order: 0,
        },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: phraseItem,
      durationMs: 2600,
      focusNormalizedByText: { 'naturally stir up': 'naturally' },
      mode: { ...teachingMode, unknownWordRepetitions: 2 },
      unknownNormalizedWords: new Set(['naturally stir up']),
      wordRepetitionPauseMs: 800,
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 500 },
      {
        startMs: 500,
        endMs: 1350,
        pauseAfterMs: 800,
        pulseTargets: [{ normalizedWord: 'naturally', startMs: 500, endMs: 900 }],
      },
      {
        startMs: 500,
        endMs: 1350,
        pulseTargets: [{ normalizedWord: 'naturally', startMs: 500, endMs: 900 }],
      },
      { startMs: 1350, endMs: 2600 },
    ]);
  });

  it('delays phrase pulse until the selected focus word timing starts', () => {
    const phraseItem: LessonItem = {
      ...baseItem,
      text: 'They naturally stir up attention.',
      segments: [{ id: 's1', text: 'They naturally stir up attention.', startMs: 0, endMs: 2600 }],
      chunkTimings: [
        {
          id: 'chunk-1',
          text: 'naturally stir up',
          normalizedText: 'naturally stir up',
          startMs: 450,
          endMs: 1400,
          wordMarkIds: ['stale-naturally', 'stale-stir', 'stale-up'],
          order: 0,
        },
      ],
      wordTimings: [
        {
          id: 'naturally',
          text: 'naturally',
          normalizedText: 'naturally',
          startMs: 500,
          endMs: 900,
          order: 0,
        },
        {
          id: 'stir',
          text: 'stir',
          normalizedText: 'stir',
          startMs: 900,
          endMs: 1150,
          order: 1,
        },
        {
          id: 'up',
          text: 'up',
          normalizedText: 'up',
          startMs: 1150,
          endMs: 1350,
          order: 2,
        },
      ],
      sentenceTimings: [
        {
          id: 's1',
          text: 'They naturally stir up attention.',
          startMs: 0,
          endMs: 2600,
          wordMarkIds: ['naturally', 'stir', 'up'],
          order: 0,
        },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: phraseItem,
      durationMs: 2600,
      focusNormalizedByText: { 'naturally stir up': 'stir' },
      mode: { ...teachingMode, unknownWordRepetitions: 1 },
      unknownNormalizedWords: new Set(['naturally stir up']),
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 450 },
      {
        startMs: 450,
        endMs: 1400,
        pulseTargets: [{ normalizedWord: 'stir', startMs: 900, endMs: 1150 }],
      },
      { startMs: 1400, endMs: 2600 },
    ]);
  });
});

describe('resumePlaybackRanges', () => {
  it('continues from the paused range instead of restarting the script', () => {
    const ranges = [
      { startMs: 0, endMs: 1000 },
      { startMs: 1000, endMs: 1500 },
      { startMs: 1000, endMs: 1500 },
      { startMs: 1500, endMs: 2200 },
    ];

    expect(
      resumePlaybackRanges({
        preferredRangeIndex: 2,
        ranges,
        resumeMs: 1200,
      }),
    ).toEqual({
      startIndex: 2,
      ranges: [
        { startMs: 1200, endMs: 1500 },
        { startMs: 1500, endMs: 2200 },
      ],
    });
  });

  it('falls back to the current audio position when no paused range index is available', () => {
    expect(
      resumePlaybackRanges({
        ranges: [
          { startMs: 0, endMs: 1000 },
          { startMs: 1000, endMs: 2000 },
        ],
        resumeMs: 1500,
      }),
    ).toEqual({
      startIndex: 1,
      ranges: [{ startMs: 1500, endMs: 2000 }],
    });
  });
});

describe('getPulseDurationMs', () => {
  it('keeps the pulse active through the repeated phrase and configured pause', () => {
    expect(
      getPulseDurationMs(
        {
          startMs: 500,
          endMs: 1350,
          pauseAfterMs: 800,
        },
        {
          normalizedWord: 'naturally',
          startMs: 500,
          endMs: 900,
        },
      ),
    ).toBe(1650);
  });

  it('starts duration from the focus word when it begins inside the phrase', () => {
    expect(
      getPulseDurationMs(
        {
          startMs: 450,
          endMs: 1400,
          pauseAfterMs: 800,
        },
        {
          normalizedWord: 'stir',
          startMs: 900,
          endMs: 1150,
        },
      ),
    ).toBe(1300);
  });
});
