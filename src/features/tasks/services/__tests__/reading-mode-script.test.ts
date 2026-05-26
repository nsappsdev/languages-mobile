import { buildReadingModeScript, resumePlaybackRanges } from '../reading-mode-script';
import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

const baseItem: LessonItem = {
  id: 'item-1',
  lessonId: 'lesson-1',
  order: 0,
  text: 'We went to the beach.',
  audioUrl: '/media/audio/test.mp3',
  segments: [{ id: 's1', text: 'We went to the beach.', startMs: 0, endMs: 2500 }],
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
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 1800 },
      {
        startMs: 1800,
        endMs: 2200,
        pulseTargets: [{ normalizedWord: 'beach', startMs: 1800, endMs: 2200 }],
      },
      {
        startMs: 1800,
        endMs: 2200,
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
      wordTimings: [
        {
          id: 'phrase-1',
          text: 'ice cream',
          normalizedText: 'ice cream',
          startMs: 900,
          endMs: 1500,
          order: 0,
        },
      ],
      sentenceTimings: [
        {
          id: 's1',
          text: 'We ate ice cream.',
          startMs: 0,
          endMs: 1800,
          wordMarkIds: ['phrase-1'],
          order: 0,
        },
      ],
    };

    const ranges = buildReadingModeScript({
      currentItem: phraseItem,
      durationMs: 1800,
      mode: { ...teachingMode, unknownWordRepetitions: 2 },
      unknownNormalizedWords: new Set(['ice cream']),
    });

    expect(ranges).toEqual([
      { startMs: 0, endMs: 900 },
      {
        startMs: 900,
        endMs: 1500,
        pulseTargets: [
          { normalizedWord: 'ice', startMs: 900, endMs: 1125 },
          { normalizedWord: 'cream', startMs: 1125, endMs: 1500 },
        ],
      },
      {
        startMs: 900,
        endMs: 1500,
        pulseTargets: [
          { normalizedWord: 'ice', startMs: 900, endMs: 1125 },
          { normalizedWord: 'cream', startMs: 1125, endMs: 1500 },
        ],
      },
      { startMs: 1500, endMs: 1800 },
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
