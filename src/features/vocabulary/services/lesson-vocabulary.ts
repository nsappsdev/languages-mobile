import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type {
  LearnerLessonVocabularyStatus,
  Lesson,
  LessonItem,
  LessonVocabularyReviewItem,
  VocabularyEntry,
  VocabularyReviewDecision,
  VocabularyReviewEvent,
} from '@/src/types/domain';

export type LessonVocabularyRow = LessonVocabularyReviewItem;

export type LessonVocabularySection = {
  description: string | null;
  id: string;
  items: LessonVocabularyRow[];
  lesson: Lesson;
  lessonId: string;
  title: string;
};

export type VocabularyAudioRange = {
  audioUrl: string;
  endMs: number;
  itemId: string;
  startMs: number;
};

export type LessonVocabularyPayload = {
  description?: string | null;
  entries: LessonVocabularyReviewItem[];
  lessonId: string;
  status: string;
  title: string;
};

export function buildLessonVocabularySection({
  lesson,
  payload,
  pendingDecisions = [],
}: {
  lesson: Lesson;
  payload: LessonVocabularyPayload;
  pendingDecisions?: VocabularyReviewEvent[];
}): LessonVocabularySection {
  return {
    description: payload.description ?? lesson.description ?? null,
    id: lesson.id,
    items: applyPendingVocabularyReviews(payload.entries, pendingDecisions).filter(
      (item) => Boolean(pickArmenianTranslationText(item.entry.translations)),
    ),
    lesson,
    lessonId: lesson.id,
    title: payload.title ?? lesson.title,
  };
}

export function applyVocabularyReviewDecisionLocally(
  row: LessonVocabularyRow,
  decision: VocabularyReviewDecision,
): LessonVocabularyRow {
  if (decision === 'AGAIN') {
    return {
      ...row,
      status: 'LEARNING',
      correctStreak: 0,
      leftSwipes: row.leftSwipes + 1,
    };
  }

  const correctStreak = Math.min(2, row.correctStreak + 1);
  return {
    ...row,
    status: correctStreak >= 2 ? 'LEARNED' : 'LEARNING',
    correctStreak,
    rightSwipes: row.rightSwipes + 1,
  };
}

export function applyPendingVocabularyReviews(
  rows: LessonVocabularyRow[],
  events: VocabularyReviewEvent[],
) {
  const rowsById = new Map(rows.map((row) => [row.entryId, row]));
  events.forEach((event) => {
    const current = rowsById.get(event.entryId);
    if (!current || current.lessonId !== event.lessonId || current.status !== 'LEARNING') {
      return;
    }
    rowsById.set(event.entryId, applyVocabularyReviewDecisionLocally(current, event.decision));
  });
  return rows.map((row) => rowsById.get(row.entryId) ?? row);
}

export function restoreVocabularyRow(row: LessonVocabularyRow): LessonVocabularyRow {
  return {
    ...row,
    status: 'LEARNING',
    correctStreak: 0,
  };
}

export function createVocabularyReviewIdempotencyKey(
  lessonId: string,
  entryId: string,
  decision: VocabularyReviewDecision,
) {
  return `vocabulary:${decision}:${lessonId}:${entryId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function countVocabularyByStatus(
  items: LessonVocabularyRow[],
  status: LearnerLessonVocabularyStatus,
) {
  return items.filter((item) => item.status === status).length;
}

export function findWordAudioRange(
  lesson: Lesson,
  entry: VocabularyEntry,
): VocabularyAudioRange | null {
  const normalizedEntry = entry.normalizedText ?? normalizeVocabularySelection(entry.englishText);
  if (!normalizedEntry) {
    return null;
  }

  for (const item of lesson.items) {
    if (!item.audioUrl) continue;
    const match = findWordTimingMatch(item, normalizedEntry)?.timing;
    if (!match) continue;

    return {
      audioUrl: item.audioUrl,
      endMs: match.endMs,
      itemId: item.id,
      startMs: match.startMs,
    };
  }

  return null;
}

export function findContextAudioRange(
  lesson: Lesson,
  entry: VocabularyEntry,
): VocabularyAudioRange | null {
  const normalizedEntry = entry.normalizedText ?? normalizeVocabularySelection(entry.englishText);
  if (!normalizedEntry) return null;

  for (const item of lesson.items) {
    if (!item.audioUrl) continue;
    const match = findWordTimingMatch(item, normalizedEntry);
    if (!match) continue;

    const sentenceRange = findContainingSentenceRange(item, match.index);
    if (sentenceRange) {
      return {
        audioUrl: item.audioUrl,
        endMs: sentenceRange.endMs,
        itemId: item.id,
        startMs: sentenceRange.startMs,
      };
    }

    const contextTimings = item.wordTimings.slice(
      Math.max(0, match.index - 3),
      Math.min(item.wordTimings.length, match.index + 4),
    );
    if (contextTimings.length > 0) {
      return {
        audioUrl: item.audioUrl,
        endMs: contextTimings[contextTimings.length - 1].endMs,
        itemId: item.id,
        startMs: contextTimings[0].startMs,
      };
    }
  }

  return findWordAudioRange(lesson, entry);
}

function findWordTimingMatch(item: LessonItem, normalizedEntry: string) {
  const index = item.wordTimings.findIndex((timing) => {
    const normalizedTiming = timing.normalizedText || normalizeVocabularySelection(timing.text);
    return normalizedTiming === normalizedEntry;
  });

  if (index === -1) {
    return null;
  }

  return {
    index,
    timing: item.wordTimings[index],
  };
}

function findContainingSentenceRange(item: LessonItem, wordTimingIndex: number) {
  const wordTiming = item.wordTimings[wordTimingIndex];
  if (!wordTiming) return null;

  const sentence = item.sentenceTimings.find((timing) => {
    if (timing.wordMarkIds.includes(wordTiming.id)) {
      return true;
    }
    return wordTiming.startMs >= timing.startMs && wordTiming.startMs < timing.endMs;
  });

  if (!sentence) return null;

  const sentenceWords = item.wordTimings.filter((timing) => {
    if (sentence.wordMarkIds.includes(timing.id)) {
      return true;
    }
    return timing.startMs >= sentence.startMs && timing.endMs <= sentence.endMs;
  });

  if (sentenceWords.length <= 7) {
    return {
      endMs: sentence.endMs,
      startMs: sentence.startMs,
    };
  }

  const sentenceWordIndex = sentenceWords.findIndex((timing) => timing.id === wordTiming.id);
  if (sentenceWordIndex === -1) return null;

  const contextWords = sentenceWords.slice(
    Math.max(0, sentenceWordIndex - 3),
    Math.min(sentenceWords.length, sentenceWordIndex + 4),
  );

  return {
    endMs: contextWords[contextWords.length - 1].endMs,
    startMs: contextWords[0].startMs,
  };
}
