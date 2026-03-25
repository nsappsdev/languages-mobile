import { buildLessonVocabularySections } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { LearnerVocabularyItem, Lesson } from '@/src/types/domain';

function createLesson(id: string, title: string, text: string): Lesson {
  return {
    id,
    title,
    description: null,
    status: 'PUBLISHED',
    items: [
      {
        id: `${id}-item-1`,
        lessonId: id,
        order: 1,
        text,
        audioUrl: '',
        segments: [],
      },
    ],
  };
}

function createVocabularyItem(id: string, englishText: string, armenian: string): LearnerVocabularyItem {
  return {
    id,
    userId: 'user-1',
    entryId: `entry-${id}`,
    status: 'NEW',
    addedAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
    entry: {
      id: `entry-${id}`,
      englishText,
      kind: 'WORD',
      notes: null,
      tags: [],
      translations: [
        {
          id: `translation-${id}`,
          entryId: `entry-${id}`,
          languageCode: 'am',
          translation: armenian,
          usageExample: null,
        },
      ],
    },
  };
}

describe('buildLessonVocabularySections', () => {
  it('groups saved words under the first lesson that contains them', () => {
    const lessons = [
      createLesson('lesson-1', 'Daily Routine', 'I wake up and drink coffee'),
      createLesson('lesson-2', 'At the Grocery Store', 'I buy milk and bread'),
    ];
    const vocabulary = [
      createVocabularyItem('1', 'coffee', 'սուրճ'),
      createVocabularyItem('2', 'milk', 'կաթ'),
    ];

    const sections = buildLessonVocabularySections(lessons, vocabulary);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe('Daily Routine');
    expect(sections[0]?.items.map((item) => item.entry.englishText)).toEqual(['coffee']);
    expect(sections[1]?.title).toBe('At the Grocery Store');
    expect(sections[1]?.items.map((item) => item.entry.englishText)).toEqual(['milk']);
  });

  it('puts unmatched saved words into the fallback section', () => {
    const lessons = [createLesson('lesson-1', 'Daily Routine', 'I wake up early')];
    const vocabulary = [createVocabularyItem('1', 'banana', 'բանան')];

    const sections = buildLessonVocabularySections(lessons, vocabulary);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe('Other Saved Words');
    expect(sections[0]?.items[0]?.entry.englishText).toBe('banana');
  });

  it('filters by English or Armenian search text', () => {
    const lessons = [createLesson('lesson-1', 'Daily Routine', 'I drink coffee and eat eggs')];
    const vocabulary = [
      createVocabularyItem('1', 'coffee', 'սուրճ'),
      createVocabularyItem('2', 'eggs', 'ձու'),
    ];

    const sections = buildLessonVocabularySections(lessons, vocabulary, 'սուր');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.items.map((item) => item.entry.englishText)).toEqual(['coffee']);
  });
});
