import {
  buildEntryCacheByText,
  calculateCompletion,
  calculateTopSegmentScrollOffset,
  createVocabularyLookup,
  formatSeconds,
  getAnticipatedSegmentId,
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

  it('positions the active segment near the top of the visible text area', () => {
    expect(
      calculateTopSegmentScrollOffset({
        segmentTop: 300,
        topPadding: 24,
        wordFlowOffsetY: 120,
      }),
    ).toBe(396);
  });

  it('does not scroll past the top when top-aligning early segments', () => {
    expect(
      calculateTopSegmentScrollOffset({
        segmentTop: 20,
        topPadding: 24,
        wordFlowOffsetY: 0,
      }),
    ).toBe(0);
  });

  it('selects the upcoming segment before it starts when lookahead reaches it', () => {
    expect(
      getAnticipatedSegmentId({
        lookaheadMs: 650,
        positionMs: 1400,
        segments: [
          { id: 'one', text: 'First sentence', startMs: 0, endMs: 1800 },
          { id: 'two', text: 'Second sentence', startMs: 2000, endMs: 3200 },
        ],
      }),
    ).toBe('two');
  });

  it('keeps current segment when lookahead does not reach a later segment', () => {
    expect(
      getAnticipatedSegmentId({
        lookaheadMs: 300,
        positionMs: 900,
        segments: [
          { id: 'one', text: 'First sentence', startMs: 0, endMs: 1800 },
          { id: 'two', text: 'Second sentence', startMs: 2000, endMs: 3200 },
        ],
      }),
    ).toBe('one');
  });
});
