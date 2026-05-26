import { useCallback, useEffect, useState } from 'react';
import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import { createSavedUnknownVocabularyLookup } from '@/src/features/tasks/services/task-runner-helpers';
import { apiClient } from '@/src/shared/api/client';
import type { LearnerVocabularyItem, LessonVocabularyReviewItem, VocabularyEntry } from '@/src/types/domain';

export function useRunnerVocabulary({
  entryCacheByText,
  lessonId,
  token,
  userId,
}: {
  entryCacheByText: Record<string, VocabularyEntry>;
  lessonId: string;
  token: string | null;
  userId: string | undefined;
}) {
  const [vocabularyNotice, setVocabularyNotice] = useState<string | null>(null);
  const [vocabularyByText, setVocabularyByText] = useState<Record<string, LearnerVocabularyItem>>({});
  const [pendingWords, setPendingWords] = useState<Record<string, true>>({});
  const [unknownTaps, setUnknownTaps] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!token || !userId || !lessonId) {
      setVocabularyByText({});
      return;
    }

    let cancelled = false;

    const loadVocabulary = async () => {
      try {
        const response = await apiClient.getLessonVocabulary(token, lessonId);
        if (!cancelled) {
          setVocabularyByText(
            createSavedUnknownVocabularyLookup(
              response.vocabulary.entries.map(toLearnerVocabularyItem),
            ),
          );
        }
      } catch {
        // Lesson text still has entryCacheByText for translations; status can refresh later.
      }
    };

    loadVocabulary().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [lessonId, token, userId]);

  const resetForItem = useCallback(() => {
    setVocabularyNotice(null);
    setUnknownTaps({});
  }, []);

  const handleToggleWordVocabulary = useCallback(
    (rawWord: string, normalizedWord: string | null) => {
      if (!normalizedWord || !token || !userId || !lessonId) {
        return;
      }

      if (pendingWords[normalizedWord]) {
        return;
      }

      const existingItem = vocabularyByText[normalizedWord];
      const prefetched = entryCacheByText[normalizedWord];
      if (!prefetched && !existingItem) {
        return;
      }

      const entry = existingItem?.entry ?? prefetched;
      const isSelected = Boolean(existingItem);
      const nextStatus = isSelected ? 'NEW' : 'LEARNING';

      if (isSelected) {
        setVocabularyByText((prev) => {
          const next = { ...prev };
          delete next[normalizedWord];
          return next;
        });
        setUnknownTaps((prev) => {
          const next = { ...prev };
          delete next[normalizedWord];
          return next;
        });
        setVocabularyNotice(`Removed "${entry.englishText}" from unknown words.`);
      } else {
        const nowIso = new Date().toISOString();
        const optimisticItem: LearnerVocabularyItem = {
          id: `optimistic:${entry.id}`,
          userId,
          entryId: entry.id,
          status: 'LEARNING',
          addedAt: nowIso,
          updatedAt: nowIso,
          entry,
        };
        setVocabularyByText((prev) => ({ ...prev, [normalizedWord]: optimisticItem }));
        setUnknownTaps((prev) => ({ ...prev, [normalizedWord]: true }));
        const translation = pickArmenianTranslationText(entry.translations);
        setVocabularyNotice(
          translation
            ? `Marked "${entry.englishText}" as unknown. Translation: ${translation}`
            : `Marked "${entry.englishText}" as unknown. No Armenian translation yet.`,
        );
      }

      setPendingWords((prev) => ({ ...prev, [normalizedWord]: true }));

      void apiClient
        .updateLessonVocabularyStatus(token, lessonId, entry.id, nextStatus)
        .then((response) => {
          const updated = toLearnerVocabularyItem(response.review);
          const normalizedEntryKey =
            updated.entry.normalizedText ?? normalizeVocabularySelection(updated.entry.englishText);
          if (nextStatus === 'NEW') {
            return;
          }
          setVocabularyByText((prev) => ({
            ...prev,
            ...(normalizedEntryKey ? { [normalizedEntryKey]: updated } : {}),
          }));
        })
        .catch((error) => {
          setVocabularyByText((prev) => {
            if (!prev[normalizedWord]?.id.startsWith('optimistic:')) return prev;
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
          setUnknownTaps((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
          setVocabularyNotice(
            error instanceof Error
              ? error.message
              : `Failed to update learner vocabulary for "${rawWord}".`,
          );
        })
        .finally(() => {
          setPendingWords((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
        });
    },
    [entryCacheByText, lessonId, pendingWords, token, userId, vocabularyByText],
  );

  return {
    handleToggleWordVocabulary,
    pendingWords,
    resetForItem,
    setVocabularyNotice,
    unknownTaps,
    vocabularyByText,
    vocabularyNotice,
  };
}

function toLearnerVocabularyItem(item: LessonVocabularyReviewItem): LearnerVocabularyItem {
  return {
    id: item.id,
    userId: '',
    entryId: item.entryId,
    status: item.status,
    addedAt: item.firstSeenAt ?? new Date().toISOString(),
    updatedAt: item.lastReviewedAt ?? item.firstSeenAt ?? new Date().toISOString(),
    entry: item.entry,
  };
}
