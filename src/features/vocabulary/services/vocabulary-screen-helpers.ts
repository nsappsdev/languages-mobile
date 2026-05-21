import type { LearnerVocabularyItem, LearnerVocabularyStatus } from '@/src/types/domain';

export type VocabularySummary = {
  total: number;
  NEW: number;
  REVIEWING: number;
  MASTERED: number;
};

export function buildVocabularySummary(items: LearnerVocabularyItem[]): VocabularySummary {
  return items.reduce<VocabularySummary>(
    (acc, item) => {
      if (item.status !== 'MASTERED') {
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
    },
  );
}

export function getActiveVocabularyItems(items: LearnerVocabularyItem[]) {
  return items.filter((item) => item.status !== 'MASTERED');
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
