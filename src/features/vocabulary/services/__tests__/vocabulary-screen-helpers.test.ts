import {
  applyVocabularyReviewStatus,
  buildLessonDictionarySummary,
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
      LEARNING: 0,
      LEARNED: 0,
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

  it('summarizes lesson dictionary rows by active review stage', () => {
    const summary = buildLessonDictionarySummary([
      {
        id: 'lesson-1',
        lessonId: 'lesson-1',
        title: 'Lesson 1',
        description: null,
        lesson: {
          id: 'lesson-1',
          title: 'Lesson 1',
          description: null,
          status: 'PUBLISHED',
          items: [],
        },
        items: [
          {
            ...createVocabularyItem('one', 'LEARNING'),
            status: 'LEARNING',
            lessonId: 'lesson-1',
            rightSwipes: 0,
            leftSwipes: 0,
            lastReviewedAt: null,
            firstSeenAt: null,
            localStage: 'first_learned',
          },
          {
            ...createVocabularyItem('two', 'LEARNING'),
            status: 'LEARNING',
            lessonId: 'lesson-1',
            rightSwipes: 0,
            leftSwipes: 0,
            lastReviewedAt: null,
            firstSeenAt: null,
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      firstLearned: 1,
      lessons: 1,
      needsReview: 1,
      total: 2,
    });
  });
});
