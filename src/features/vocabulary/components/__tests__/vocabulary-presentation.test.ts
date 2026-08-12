import {
  buildHiddenTranslation,
  filterLearnedVocabularySections,
  filterVocabularyLessonSummaries,
} from '@/src/features/vocabulary/components/vocabulary-presentation';
import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyLessonSummary } from '@/src/types/domain';

const summaries: VocabularyLessonSummary[] = [
  {
    activeCount: 2,
    description: null,
    learnedCount: 1,
    lessonId: 'travel',
    title: 'Travel English',
  },
  {
    activeCount: 0,
    description: null,
    learnedCount: 3,
    lessonId: 'complete',
    title: 'Completed lesson',
  },
];

describe('vocabulary presentation helpers', () => {
  test('keeps only active lesson summaries and searches their titles', () => {
    expect(filterVocabularyLessonSummaries(summaries, '')).toHaveLength(1);
    expect(filterVocabularyLessonSummaries(summaries, '  TRAVEL ')).toEqual([summaries[0]]);
    expect(filterVocabularyLessonSummaries(summaries, 'missing')).toEqual([]);
  });

  test('searches learned words in English and Armenian while preserving sections', () => {
    const sections = [buildSection()];

    expect(filterLearnedVocabularySections(sections, 'ticket')[0].items).toHaveLength(1);
    expect(filterLearnedVocabularySections(sections, 'շնորհակալություն')[0].items[0].entryId).toBe(
      'thanks',
    );
    expect(filterLearnedVocabularySections(sections, 'missing')).toEqual([]);
  });

  test('masks translations without exposing their exact long length', () => {
    expect(buildHiddenTranslation('')).toBe('●'.repeat(8));
    expect(buildHiddenTranslation('բառ')).toBe('●'.repeat(6));
    expect(buildHiddenTranslation('շատ երկար թարգմանություն')).toBe('●'.repeat(14));
  });
});

function buildSection(): LessonVocabularySection {
  return {
    description: null,
    id: 'lesson',
    items: [
      buildRow('ticket', 'Ticket', 'տոմս'),
      buildRow('thanks', 'Thank you', 'շնորհակալություն'),
    ],
    lesson: {
      id: 'lesson',
      items: [],
      status: 'PUBLISHED',
      title: 'Travel English',
    },
    lessonId: 'lesson',
    title: 'Travel English',
  };
}

function buildRow(entryId: string, englishText: string, translation: string) {
  return {
    correctStreak: 2,
    entry: {
      englishText,
      id: entryId,
      kind: 'WORD' as const,
      tags: [],
      translations: [
        {
          entryId,
          id: `${entryId}-hy`,
          languageCode: 'hy',
          translation,
        },
      ],
    },
    entryId,
    firstSeenAt: null,
    id: `review-${entryId}`,
    lastReviewedAt: null,
    leftSwipes: 0,
    lessonId: 'lesson',
    rightSwipes: 2,
    status: 'LEARNED' as const,
  };
}
