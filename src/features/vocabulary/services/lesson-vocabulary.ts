import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type {
  LearnerLessonVocabularyStatus,
  Lesson,
  LessonItem,
  LessonVocabularyReviewItem,
  VocabularyEntry,
} from '@/src/types/domain';

export type VocabularyReviewDecision = 'learned' | 'not_learned';
export type VocabularyReviewStage =
  | 'first_missed'
  | 'first_learned'
  | 'final_missed'
  | 'final_learned';

export type LessonVocabularyReviewState = {
  entryId: string;
  lessonId: string;
  pending: boolean;
  stage: VocabularyReviewStage;
  status: LearnerLessonVocabularyStatus;
  updatedAt: string;
};

export type LessonVocabularyRow = LessonVocabularyReviewItem & {
  localStage?: VocabularyReviewStage;
};

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

export function buildLessonVocabularySections({
  lessons,
  reviewStates,
  searchQuery = '',
  vocabularyByLessonId,
}: {
  lessons: Lesson[];
  reviewStates: LessonVocabularyReviewState[];
  searchQuery?: string;
  vocabularyByLessonId: Record<string, LessonVocabularyPayload | undefined>;
}): LessonVocabularySection[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const stateByEntryId = new Map(reviewStates.map((state) => [state.entryId, state]));

  return lessons
    .map((lesson) => {
      const payload = vocabularyByLessonId[lesson.id];
      const items = (payload?.entries ?? [])
        .map((item): LessonVocabularyRow | null => {
          const localState = stateByEntryId.get(item.entryId);
          const status = localState?.status ?? item.status;
          const stage = localState?.stage;

          if (status === 'LEARNED' || stage === 'final_learned') {
            return null;
          }
          if (status !== 'LEARNING') {
            return null;
          }
          if (!pickArmenianTranslationText(item.entry.translations)) {
            return null;
          }
          if (normalizedQuery && !matchesVocabularySearch(item, normalizedQuery)) {
            return null;
          }

          return {
            ...item,
            status,
            localStage: stage,
          };
        })
        .filter((item): item is LessonVocabularyRow => Boolean(item));

      if (!items.length) {
        return null;
      }

      return {
        description: payload?.description ?? lesson.description ?? null,
        id: lesson.id,
        items,
        lesson,
        lessonId: lesson.id,
        title: payload?.title ?? lesson.title,
      };
    })
    .filter((section): section is LessonVocabularySection => Boolean(section));
}

export function applyVocabularyReviewStatesToSections(
  sections: LessonVocabularySection[],
  reviewStates: LessonVocabularyReviewState[],
): LessonVocabularySection[] {
  const stateByEntryId = new Map(reviewStates.map((state) => [state.entryId, state]));

  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item): LessonVocabularyRow | null => {
          const localState = stateByEntryId.get(item.entryId);
          const status = localState?.status ?? item.status;
          const stage = localState?.stage ?? item.localStage;

          if (status === 'LEARNED' || stage === 'final_learned') {
            return null;
          }

          return {
            ...item,
            status,
            localStage: stage,
          };
        })
        .filter((item): item is LessonVocabularyRow => Boolean(item)),
    }))
    .filter((section) => section.items.length > 0);
}

export function getNextVocabularyReviewState({
  currentStage,
  decision,
  entryId,
  lessonId,
}: {
  currentStage?: VocabularyReviewStage;
  decision: VocabularyReviewDecision;
  entryId: string;
  lessonId: string;
}): LessonVocabularyReviewState {
  const stage = getNextVocabularyReviewStage(currentStage, decision);
  return {
    entryId,
    lessonId,
    pending: true,
    stage,
    status: stage === 'final_learned' ? 'LEARNED' : 'LEARNING',
    updatedAt: new Date().toISOString(),
  };
}

export function getNextVocabularyReviewStage(
  currentStage: VocabularyReviewStage | undefined,
  decision: VocabularyReviewDecision,
): VocabularyReviewStage {
  if (decision === 'not_learned') {
    return currentStage ? 'final_missed' : 'first_missed';
  }
  return currentStage ? 'final_learned' : 'first_learned';
}

export function shouldRevealVocabularyTranslation(stage?: VocabularyReviewStage) {
  return stage === 'first_learned' || stage === 'final_learned';
}

export function shuffleVocabularyRows<T extends { entryId: string }>(items: T[], seed = Date.now()) {
  return [...items]
    .map((item, index) => ({
      item,
      sort: seededSortValue(`${seed}:${item.entryId}:${index}`),
    }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ item }) => item);
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

function matchesVocabularySearch(item: LessonVocabularyReviewItem, normalizedQuery: string) {
  const english = item.entry.englishText.toLowerCase();
  const translations = item.entry.translations.map((translation) =>
    translation.translation.toLowerCase(),
  );

  return english.includes(normalizedQuery) || translations.some((value) => value.includes(normalizedQuery));
}

function seededSortValue(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
