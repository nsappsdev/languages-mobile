import {
  buildEntryCacheByText,
  buildVocabularyTokenMatches,
  calculateCompletion,
  calculateTopSegmentScrollOffset,
  createSavedUnknownVocabularyLookup,
  createVocabularyLookup,
  formatSeconds,
  getAnticipatedSegmentId,
} from '../task-runner-helpers';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';
import { tokenizeLessonText } from '../../screens/task-runner-words';

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

  it('builds runner display lookups only for saved unknown words', () => {
    const learningItem = {
      id: 'vocab-learning',
      userId: 'user-1',
      entryId: entry.id,
      status: 'LEARNING',
      addedAt: '2026-05-21T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      entry,
    } satisfies LearnerVocabularyItem;
    const newItem = {
      ...learningItem,
      id: 'vocab-new',
      status: 'NEW',
      entry: {
        ...entry,
        id: 'entry-new',
        englishText: 'World',
      },
    } satisfies LearnerVocabularyItem;

    expect(createSavedUnknownVocabularyLookup([learningItem, newItem])).toEqual({
      hello: learningItem,
    });
  });

  it('matches the longest lesson vocabulary phrase across multiple text tokens', () => {
    const phraseEntry = {
      id: 'entry-phrase',
      englishText: 'soap operas',
      normalizedText: 'soap operas',
      kind: 'PHRASE',
      notes: null,
      tags: [],
      translations: [],
    } satisfies VocabularyEntry;
    const wordEntry = {
      ...entry,
      id: 'entry-word',
      englishText: 'soap',
      normalizedText: 'soap',
    } satisfies VocabularyEntry;

    const tokens = tokenizeLessonText('I watch soap operas.');
    const matches = buildVocabularyTokenMatches(tokens, [wordEntry, phraseEntry]);
    const matchedTokens = matches
      .map((match, index) => (match ? `${index}:${match.entry.englishText}` : null))
      .filter(Boolean);

    expect(matchedTokens).toEqual(['4:soap operas', '6:soap operas']);
    expect(matches[4]?.startIndex).toBe(4);
    expect(matches[4]?.endIndex).toBe(6);
  });

  it('does not turn sentence dictionary entries into one oversized token', () => {
    const sentenceEntry = {
      id: 'entry-sentence',
      englishText:
        'Over several weeks Ninon de Lenclos listened patiently to the complaint',
      normalizedText:
        'over several weeks ninon de lenclos listened patiently to the complaint',
      kind: 'SENTENCE',
      notes: null,
      tags: [],
      translations: [],
    } satisfies VocabularyEntry;

    const tokens = tokenizeLessonText(
      'Over several weeks, Ninon de Lenclos listened patiently to the complaint.',
    );
    const matches = buildVocabularyTokenMatches(tokens, [sentenceEntry]);

    expect(matches.every((match) => match === null)).toBe(true);
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
