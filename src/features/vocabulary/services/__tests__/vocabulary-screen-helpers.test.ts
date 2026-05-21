import {
  applyVocabularyReviewStatus,
  buildVocabularySummary,
  getActiveVocabularyItems,
} from '../vocabulary-screen-helpers';
import type { LearnerVocabularyItem, LearnerVocabularyStatus } from '@/src/types/domain';

function createVocabularyItem(
  id: string,
  status: LearnerVocabularyStatus,
): LearnerVocabularyItem {
  return {
    id,
    userId: 'user-1',
    entryId: `entry-${id}`,
    status,
    addedAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    entry: {
      id: `entry-${id}`,
      englishText: id,
      kind: 'WORD',
      notes: null,
      tags: [],
      translations: [],
    },
  };
}

describe('vocabulary screen helpers', () => {
  it('counts learned words separately while excluding them from active total', () => {
    const summary = buildVocabularySummary([
      createVocabularyItem('one', 'NEW'),
      createVocabularyItem('two', 'REVIEWING'),
      createVocabularyItem('three', 'MASTERED'),
    ]);

    expect(summary).toEqual({
      total: 2,
      NEW: 1,
      REVIEWING: 1,
      MASTERED: 1,
    });
  });

  it('returns only non-mastered active vocabulary items', () => {
    const active = getActiveVocabularyItems([
      createVocabularyItem('one', 'NEW'),
      createVocabularyItem('two', 'MASTERED'),
    ]);

    expect(active.map((item) => item.id)).toEqual(['one']);
  });

  it('updates only the reviewed entry status', () => {
    const items = [
      createVocabularyItem('one', 'NEW'),
      createVocabularyItem('two', 'NEW'),
    ];

    const updated = applyVocabularyReviewStatus({
      entryId: 'entry-two',
      items,
      status: 'MASTERED',
      updatedAt: '2026-05-21T10:00:00.000Z',
    });

    expect(updated[0]).toBe(items[0]);
    expect(updated[1].status).toBe('MASTERED');
    expect(updated[1].updatedAt).toBe('2026-05-21T10:00:00.000Z');
  });
});
