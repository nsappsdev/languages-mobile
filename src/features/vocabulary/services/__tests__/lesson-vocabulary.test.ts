import {
  applyPendingVocabularyReviews,
  applyVocabularyReviewDecisionLocally,
  buildLessonVocabularySection,
  findContextAudioRange,
  findWordAudioRange,
  restoreVocabularyRow,
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
        segments: [{ id: 'segment-1', text: 'Birds are flying high', startMs: 0, endMs: 1800 }],
        chunkTimings: [],
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
  status: LearnerLessonVocabularyStatus = 'LEARNING',
  correctStreak = 0,
): LessonVocabularyReviewItem {
  return {
    id: `learner-${id}`,
    lessonId: 'lesson-1',
    entryId: entry.id,
    status,
    correctStreak,
    rightSwipes: 0,
    leftSwipes: 0,
    lastReviewedAt: null,
    firstSeenAt: null,
    entry,
  };
}

describe('lesson vocabulary review state', () => {
  it('requires two know decisions and resets the streak after again', () => {
    const row = createReviewItem(
      'flying',
      createEntry('entry-flying', 'flying', 'թռչում'),
    );
    const firstKnow = applyVocabularyReviewDecisionLocally(row, 'KNOW');
    const secondKnow = applyVocabularyReviewDecisionLocally(firstKnow, 'KNOW');
    const reset = applyVocabularyReviewDecisionLocally(firstKnow, 'AGAIN');

    expect(firstKnow).toMatchObject({ status: 'LEARNING', correctStreak: 1, rightSwipes: 1 });
    expect(secondKnow).toMatchObject({ status: 'LEARNED', correctStreak: 2, rightSwipes: 2 });
    expect(reset).toMatchObject({ status: 'LEARNING', correctStreak: 0, leftSwipes: 1 });
  });

  it('applies queued decisions in order after an offline restart', () => {
    const row = createReviewItem(
      'flying',
      createEntry('entry-flying', 'flying', 'թռչում'),
    );

    expect(
      applyPendingVocabularyReviews(
        [row],
        [
          {
            lessonId: 'lesson-1',
            entryId: row.entryId,
            decision: 'KNOW',
            idempotencyKey: 'review-one',
            createdAt: '2026-06-13T00:00:00.000Z',
          },
          {
            lessonId: 'lesson-1',
            entryId: row.entryId,
            decision: 'KNOW',
            idempotencyKey: 'review-two',
            createdAt: '2026-06-13T00:00:01.000Z',
          },
        ],
      )[0],
    ).toMatchObject({ status: 'LEARNED', correctStreak: 2 });
  });

  it('restores a learned word with a clean streak', () => {
    const learned = createReviewItem(
      'flying',
      createEntry('entry-flying', 'flying', 'թռչում'),
      'LEARNED',
      2,
    );

    expect(restoreVocabularyRow(learned)).toMatchObject({
      status: 'LEARNING',
      correctStreak: 0,
    });
  });
});

describe('lesson vocabulary data', () => {
  it('keeps translated active and learned rows while excluding untranslated rows', () => {
    const lesson = createLesson();
    const active = createReviewItem(
      'flying',
      createEntry('entry-flying', 'flying', 'թռչում'),
    );
    const learned = createReviewItem(
      'birds',
      createEntry('entry-birds', 'Birds', 'թռչուններ'),
      'LEARNED',
      2,
    );
    const untranslated = createReviewItem('high', createEntry('entry-high', 'high'));

    const section = buildLessonVocabularySection({
      lesson,
      payload: {
        lessonId: lesson.id,
        title: lesson.title,
        description: null,
        status: 'PUBLISHED',
        entries: [active, learned, untranslated],
      },
    });

    expect(section.items.map((item) => item.entry.englishText)).toEqual(['flying', 'Birds']);
  });
});

describe('lesson vocabulary audio ranges', () => {
  it('finds exact word and short-sentence context timings', () => {
    const lesson = createLesson();
    const entry = createEntry('entry-flying', 'flying', 'թռչում');

    expect(findWordAudioRange(lesson, entry)).toEqual({
      audioUrl: '/audio/flying.mp3',
      itemId: 'item-1',
      startMs: 800,
      endMs: 1150,
    });
    expect(findContextAudioRange(lesson, entry)).toEqual({
      audioUrl: '/audio/flying.mp3',
      itemId: 'item-1',
      startMs: 0,
      endMs: 1800,
    });
  });
});
