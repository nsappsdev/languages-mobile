import {
  applyVocabularyReviewStatesToSections,
  buildLessonVocabularySections,
  findContextAudioRange,
  findWordAudioRange,
  getNextVocabularyReviewStage,
  shouldRevealVocabularyTranslation,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import type {
  LearnerLessonVocabularyStatus,
  Lesson,
  LessonVocabularyReviewItem,
  VocabularyEntry,
} from '@/src/types/domain';

function createLesson(): Lesson {
  const words = ['Birds', 'are', 'flying', 'high'];
  return {
    id: 'lesson-1',
    title: 'Flying',
    description: null,
    status: 'PUBLISHED',
    items: [
      {
        id: 'item-1',
        lessonId: 'lesson-1',
        order: 1,
        text: 'Birds are flying high',
        audioUrl: '/audio/flying.mp3',
        segments: [
          {
            id: 'segment-1',
            text: 'Birds are flying high',
            startMs: 0,
            endMs: 1800,
          },
        ],
        sentenceTimings: [
          {
            id: 'sentence-1',
            text: 'Birds are flying high',
            startMs: 0,
            endMs: 1800,
            wordMarkIds: ['word-1', 'word-2', 'word-3', 'word-4'],
            order: 1,
          },
        ],
        wordTimings: words.map((word, index) => ({
          id: `word-${index + 1}`,
          text: word,
          normalizedText: word.toLowerCase(),
          startMs: index * 400,
          endMs: index * 400 + 350,
          order: index + 1,
        })),
      },
    ],
  };
}

function createEntry(id: string, englishText: string, armenian?: string): VocabularyEntry {
  return {
    id,
    englishText,
    normalizedText: englishText.toLowerCase(),
    kind: 'WORD',
    notes: null,
    tags: [],
    translations: armenian
      ? [
          {
            id: `translation-${id}`,
            entryId: id,
            languageCode: 'am',
            translation: armenian,
            usageExample: null,
          },
        ]
      : [],
  };
}

function createReviewItem(
  id: string,
  entry: VocabularyEntry,
  status: LearnerLessonVocabularyStatus,
): LessonVocabularyReviewItem {
  return {
    id: `learner-${id}`,
    lessonId: 'lesson-1',
    entryId: entry.id,
    status,
    rightSwipes: 0,
    leftSwipes: 0,
    lastReviewedAt: null,
    firstSeenAt: null,
    entry,
  };
}

describe('lesson vocabulary sections', () => {
  it('shows only saved unknown lesson terms with Armenian translations', () => {
    const lesson = createLesson();
    const flying = createEntry('entry-flying', 'flying', 'թռչում');
    const birds = createEntry('entry-birds', 'Birds', 'թռչուններ');
    const high = createEntry('entry-high', 'high');

    const sections = buildLessonVocabularySections({
      lessons: [lesson],
      reviewStates: [],
      vocabularyByLessonId: {
        'lesson-1': {
          lessonId: 'lesson-1',
          title: 'Flying',
          description: null,
          status: 'READY',
          entries: [
            createReviewItem('flying', flying, 'LEARNING'),
            createReviewItem('birds', birds, 'NEW'),
            createReviewItem('high', high, 'LEARNING'),
          ],
        },
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.items.map((item) => item.entry.englishText)).toEqual(['flying']);
  });

  it('uses local review state to remove finally learned terms', () => {
    const lesson = createLesson();
    const flying = createEntry('entry-flying', 'flying', 'թռչում');

    const sections = buildLessonVocabularySections({
      lessons: [lesson],
      reviewStates: [
        {
          entryId: 'entry-flying',
          lessonId: 'lesson-1',
          pending: true,
          stage: 'final_learned',
          status: 'LEARNED',
          updatedAt: '2026-05-25T00:00:00.000Z',
        },
      ],
      vocabularyByLessonId: {
        'lesson-1': {
          lessonId: 'lesson-1',
          title: 'Flying',
          description: null,
          status: 'READY',
          entries: [createReviewItem('flying', flying, 'LEARNING')],
        },
      },
    });

    expect(sections).toEqual([]);
  });

  it('applies local review state over cached sections', () => {
    const lesson = createLesson();
    const flying = createEntry('entry-flying', 'flying', 'թռչում');
    const sections = [
      {
        id: 'lesson-1',
        lessonId: 'lesson-1',
        title: 'Flying',
        description: null,
        lesson,
        items: [createReviewItem('flying', flying, 'LEARNING')],
      },
    ];

    expect(
      applyVocabularyReviewStatesToSections(sections, [
        {
          entryId: 'entry-flying',
          lessonId: 'lesson-1',
          pending: true,
          stage: 'final_learned',
          status: 'LEARNED',
          updatedAt: '2026-05-25T00:00:00.000Z',
        },
      ]),
    ).toEqual([]);
  });
});

describe('lesson vocabulary review stages', () => {
  it('reveals translations only after learned decisions', () => {
    expect(getNextVocabularyReviewStage(undefined, 'learned')).toBe('first_learned');
    expect(getNextVocabularyReviewStage('first_learned', 'learned')).toBe('final_learned');
    expect(getNextVocabularyReviewStage(undefined, 'not_learned')).toBe('first_missed');
    expect(getNextVocabularyReviewStage('first_missed', 'not_learned')).toBe('final_missed');
    expect(shouldRevealVocabularyTranslation('first_learned')).toBe(true);
    expect(shouldRevealVocabularyTranslation('first_missed')).toBe(false);
  });
});

describe('lesson vocabulary audio ranges', () => {
  it('finds the exact word audio timing', () => {
    const lesson = createLesson();
    const entry = createEntry('entry-flying', 'flying', 'թռչում');

    expect(findWordAudioRange(lesson, entry)).toEqual({
      audioUrl: '/audio/flying.mp3',
      itemId: 'item-1',
      startMs: 800,
      endMs: 1150,
    });
  });

  it('uses the full sentence when context has fewer than seven words', () => {
    const lesson = createLesson();
    const entry = createEntry('entry-flying', 'flying', 'թռչում');

    expect(findContextAudioRange(lesson, entry)).toEqual({
      audioUrl: '/audio/flying.mp3',
      itemId: 'item-1',
      startMs: 0,
      endMs: 1800,
    });
  });
});
