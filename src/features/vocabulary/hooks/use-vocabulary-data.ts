import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import {
  applyVocabularyReviewStatesToSections,
  buildLessonVocabularySections,
  type LessonVocabularyPayload,
  type LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  getCachedLessonVocabularySections,
  getVocabularyReviewStates,
  markVocabularyReviewStateSynced,
  setCachedLessonVocabularyPayloads,
  setCachedLessonVocabularySections,
} from '@/src/features/vocabulary/services/lesson-vocabulary-cache';
import { apiClient, ApiError } from '@/src/shared/api/client';

export function useVocabularyData({
  token,
  userId,
}: {
  token: string | null;
  userId: string | undefined;
}) {
  const [sections, setSections] = useState<LessonVocabularySection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<string | null>(null);

  const refreshFromCache = useCallback(async () => {
    if (!userId) return;
    const cached = await getCachedLessonVocabularySections(userId);
    if (cached.length) {
      const reviewStates = await getVocabularyReviewStates(userId);
      setSections(applyVocabularyReviewStatesToSections(cached, reviewStates));
      setSyncMeta('Showing last synced dictionary snapshot.');
    }
  }, [userId]);

  const fetchVocabulary = useCallback(
    async (isRefresh = false) => {
      if (!token || !userId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      setSyncMeta(null);
      try {
        const lessonsResponse = await apiClient.getLessons(token);
        const lessons = [...lessonsResponse.lessons].sort(sortLessonsByLevelOrder);
        const reviewStates = await getVocabularyReviewStates(userId);

        await Promise.all(
          reviewStates
            .filter((state) => state.pending)
            .map(async (state) => {
              await apiClient.updateLessonVocabularyStatus(
                token,
                state.lessonId,
                state.entryId,
                state.status,
              );
              await markVocabularyReviewStateSynced(userId, state.entryId);
            }),
        ).catch(() => {
          setSyncMeta('Some dictionary changes are saved locally and still syncing.');
        });

        const latestReviewStates = await getVocabularyReviewStates(userId);
        const vocabularyEntries = await Promise.all(
          lessons.map(async (lesson) => {
            try {
              const response = await apiClient.getLessonVocabulary(token, lesson.id);
              return [lesson.id, response.vocabulary] as const;
            } catch {
              return [lesson.id, undefined] as const;
            }
          }),
        );
        const vocabularyByLessonId = Object.fromEntries(
          vocabularyEntries.filter(
            (entry): entry is readonly [string, LessonVocabularyPayload] => Boolean(entry[1]),
          ),
        );
        const sections = buildLessonVocabularySections({
          lessons,
          reviewStates: latestReviewStates,
          vocabularyByLessonId,
        });

        setSections(sections);
        await setCachedLessonVocabularyPayloads(userId, vocabularyByLessonId);
        await setCachedLessonVocabularySections(userId, sections);
      } catch (err) {
        await refreshFromCache();

        if (err instanceof ApiError && err.status === 401) {
          return;
        }
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load dictionary.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [refreshFromCache, token, userId],
  );

  useEffect(() => {
    if (!token || !userId) {
      setSections([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const bootstrap = async () => {
      setIsLoading(true);
      const cached = await getCachedLessonVocabularySections(userId);
      if (isMounted && cached.length > 0) {
        const reviewStates = await getVocabularyReviewStates(userId);
        setSections(applyVocabularyReviewStatesToSections(cached, reviewStates));
        setSyncMeta('Showing last synced dictionary snapshot.');
        setIsLoading(false);
      }

      await fetchVocabulary();
    };

    bootstrap().catch(() => null);

    return () => {
      isMounted = false;
    };
  }, [fetchVocabulary, token, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchVocabulary(true).catch(() => null);
      return undefined;
    }, [fetchVocabulary]),
  );

  return {
    error,
    fetchVocabulary,
    isLoading,
    isRefreshing,
    sections,
    setSections,
    setSyncMeta,
    syncMeta,
  };
}
