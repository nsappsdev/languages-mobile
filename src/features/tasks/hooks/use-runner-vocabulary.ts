import { useCallback, useEffect, useState } from 'react';
import { normalizeVocabularySelection, addSelectionToVocabulary } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import {
  getCachedVocabulary,
  mergeCachedVocabulary,
  removeCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import { createVocabularyLookup } from '@/src/features/tasks/services/task-runner-helpers';
import { apiClient, ApiError } from '@/src/shared/api/client';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';

export function useRunnerVocabulary({
  entryCacheByText,
  token,
  userId,
}: {
  entryCacheByText: Record<string, VocabularyEntry>;
  token: string | null;
  userId: string | undefined;
}) {
  const [vocabularyNotice, setVocabularyNotice] = useState<string | null>(null);
  const [vocabularyByText, setVocabularyByText] = useState<Record<string, LearnerVocabularyItem>>(
    {},
  );
  const [pendingWords, setPendingWords] = useState<Record<string, true>>({});
  const [unknownTaps, setUnknownTaps] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!token || !userId) {
      setVocabularyByText({});
      return;
    }

    let cancelled = false;

    const loadVocabulary = async () => {
      const cached = await getCachedVocabulary(userId);
      if (!cancelled) {
        setVocabularyByText(createVocabularyLookup(cached));
      }

      try {
        const response = await apiClient.getMyVocabulary(token);
        await mergeCachedVocabulary(userId, response.vocabulary);
        if (!cancelled) {
          setVocabularyByText(createVocabularyLookup(response.vocabulary));
        }
      } catch {
        // Keep cached state if refresh fails.
      }
    };

    loadVocabulary().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  const resetForItem = useCallback(() => {
    setVocabularyNotice(null);
    setUnknownTaps({});
  }, []);

  const handleToggleWordVocabulary = useCallback(
    (rawWord: string, normalizedWord: string | null) => {
      if (!normalizedWord || !token || !userId) {
        return;
      }

      if (pendingWords[normalizedWord]) {
        return;
      }

      const existingItem = vocabularyByText[normalizedWord];

      if (existingItem) {
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
        setVocabularyNotice(`Removed "${existingItem.entry.englishText}" from vocabulary.`);

        void removeCachedVocabulary(userId, existingItem.entryId).catch(() => null);
        void apiClient.removeVocabularyFromLearner(token, existingItem.entryId).catch((error) => {
          if (error instanceof ApiError && error.status === 404) return;
        });
        return;
      }

      const prefetched = entryCacheByText[normalizedWord];

      if (prefetched) {
        const nowIso = new Date().toISOString();
        const optimisticItem: LearnerVocabularyItem = {
          id: `optimistic:${prefetched.id}`,
          userId,
          entryId: prefetched.id,
          status: 'NEW',
          addedAt: nowIso,
          updatedAt: nowIso,
          entry: prefetched,
        };
        setVocabularyByText((prev) => ({ ...prev, [normalizedWord]: optimisticItem }));
        setUnknownTaps((prev) => ({ ...prev, [normalizedWord]: true }));
        const translation = pickArmenianTranslationText(prefetched.translations);
        setVocabularyNotice(
          translation
            ? `Marked "${prefetched.englishText}" as unknown. Translation: ${translation}`
            : `Marked "${prefetched.englishText}" as unknown. No Armenian translation yet.`,
        );
      } else {
        setUnknownTaps((prev) => ({ ...prev, [normalizedWord]: true }));
        setVocabularyNotice(`Marked "${rawWord}" as unknown. No translation available yet.`);
      }

      setPendingWords((prev) => ({ ...prev, [normalizedWord]: true }));

      void (async () => {
        try {
          if (prefetched) {
            const response = await apiClient.addVocabularyToLearner(token, prefetched.id);
            const added = response.vocabulary;
            const normalizedEntryKey = normalizeVocabularySelection(added.entry.englishText);
            setVocabularyByText((prev) => ({
              ...prev,
              ...(normalizedEntryKey ? { [normalizedEntryKey]: added } : {}),
            }));
            await mergeCachedVocabulary(userId, [added]);
            return;
          }
          const result = await addSelectionToVocabulary(token, userId, rawWord);
          if (!result.ok || !result.vocabulary) {
            throw new Error(result.message);
          }

          const addedVocabulary = result.vocabulary;
          const normalizedEntryKey = normalizeVocabularySelection(addedVocabulary.entry.englishText);
          setVocabularyByText((prev) => ({
            ...prev,
            ...(normalizedEntryKey ? { [normalizedEntryKey]: addedVocabulary } : {}),
          }));
        } catch (error) {
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
              : 'Failed to update learner vocabulary for this word.',
          );
        } finally {
          setPendingWords((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
        }
      })();
    },
    [entryCacheByText, pendingWords, token, userId, vocabularyByText],
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
