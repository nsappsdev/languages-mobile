import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { LearnerVocabularyItem, LearnerVocabularyStatus } from '@/src/types/domain';

export type VocabularySummary = {
  total: number;
  NEW: number;
  REVIEWING: number;
  MASTERED: number;
  LEARNING: number;
  LEARNED: number;
};

export type LessonDictionarySummary = {
  firstLearned: number;
  lessons: number;
  needsReview: number;
  total: number;
};

export function buildVocabularySummary(items: LearnerVocabularyItem[]): VocabularySummary {
  return items.reduce<VocabularySummary>(
    (acc, item) => {
      if (item.status !== 'MASTERED' && item.status !== 'LEARNED') {
        acc.total += 1;
      }
      acc[item.status] += 1;
      return acc;
    },
    {
      total: 0,
      NEW: 0,
      REVIEWING: 0,
      MASTERED: 0,
      LEARNING: 0,
      LEARNED: 0,
    },
  );
}

export function getActiveVocabularyItems(items: LearnerVocabularyItem[]) {
  return items.filter((item) => item.status !== 'MASTERED' && item.status !== 'LEARNED');
}

export function applyVocabularyReviewStatus({
  entryId,
  items,
  status,
  updatedAt,
}: {
  entryId: string;
  items: LearnerVocabularyItem[];
  status: LearnerVocabularyStatus;
  updatedAt: string;
}) {
  return items.map((item) =>
    item.entryId === entryId
      ? {
          ...item,
          status,
          updatedAt,
        }
      : item,
  );
}

export function buildLessonDictionarySummary(
  sections: LessonVocabularySection[],
): LessonDictionarySummary {
  return sections.reduce<LessonDictionarySummary>(
    (summary, section) => {
      summary.lessons += 1;
      summary.total += section.items.length;
      section.items.forEach((item) => {
        if (item.localStage === 'first_learned') {
          summary.firstLearned += 1;
        } else {
          summary.needsReview += 1;
        }
      });
      return summary;
    },
    {
      firstLearned: 0,
      lessons: 0,
      needsReview: 0,
      total: 0,
    },
  );
}
