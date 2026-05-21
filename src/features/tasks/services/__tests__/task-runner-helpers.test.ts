import {
  buildEntryCacheByText,
  calculateCompletion,
  calculateCenteredSegmentScrollOffset,
  createVocabularyLookup,
  formatSeconds,
} from '../task-runner-helpers';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';

const entry = {
  id: 'entry-1',
  englishText: 'Hello!',
  kind: 'WORD',
  notes: null,
  tags: [],
  translations: [],
} satisfies VocabularyEntry;

describe('task runner helpers', () => {
  it('builds normalized vocabulary lookups for tap-to-reveal words', () => {
    const item = {
      id: 'vocab-1',
      userId: 'user-1',
      entryId: entry.id,
      status: 'NEW',
      addedAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      entry,
    } satisfies LearnerVocabularyItem;

    expect(createVocabularyLookup([item])).toEqual({ hello: item });
    expect(buildEntryCacheByText([entry])).toEqual({ hello: entry });
  });

  it('calculates item completion as a rounded percentage', () => {
    expect(calculateCompletion({}, 0)).toBe(0);
    expect(calculateCompletion({ one: true }, 3)).toBe(33);
    expect(calculateCompletion({ one: true, two: true }, 3)).toBe(67);
  });

  it('formats playback seconds for the runner audio metadata', () => {
    expect(formatSeconds(-1)).toBe('0:00');
    expect(formatSeconds(Number.NaN)).toBe('0:00');
    expect(formatSeconds(4.9)).toBe('0:04');
    expect(formatSeconds(65.3)).toBe('1:05');
  });

  it('centers the active segment inside the visible scroll area', () => {
    expect(
      calculateCenteredSegmentScrollOffset({
        segmentBottom: 360,
        segmentTop: 300,
        viewportHeight: 400,
        wordFlowOffsetY: 120,
      }),
    ).toBe(250);
  });

  it('does not scroll past the top when centering early segments', () => {
    expect(
      calculateCenteredSegmentScrollOffset({
        segmentBottom: 60,
        segmentTop: 20,
        viewportHeight: 400,
        wordFlowOffsetY: 80,
      }),
    ).toBe(0);
  });
});
