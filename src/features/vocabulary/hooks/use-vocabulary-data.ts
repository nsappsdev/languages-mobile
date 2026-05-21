import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import {
  applyVocabularyStatusOverrides,
  getCachedVocabulary,
  setCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import { getQueuedVocabularyStatusUpdates } from '@/src/features/vocabulary/services/vocabulary-status-sync';
import { apiClient, ApiError } from '@/src/shared/api/client';
import type { LearnerVocabularyItem, Lesson } from '@/src/types/domain';

export function useVocabularyData({
  token,
  userId,
}: {
  token: string | null;
  userId: string | undefined;
}) {
  const [items, setItems] = useState<LearnerVocabularyItem[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<string | null>(null);

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
        const [vocabularyResponse, lessonsResponse] = await Promise.all([
          apiClient.getMyVocabulary(token),
          apiClient.getLessons(token),
        ]);
        const sortedLessons = [...lessonsResponse.lessons].sort(sortLessonsByLevelOrder);
        const pendingStatusUpdates = await getQueuedVocabularyStatusUpdates(userId);
        const vocabulary = applyVocabularyStatusOverrides(
          vocabularyResponse.vocabulary,
          pendingStatusUpdates,
        );
        setItems(vocabulary);
        setLessons(sortedLessons);
        await setCachedVocabulary(userId, vocabulary);
        if (pendingStatusUpdates.length > 0) {
          setSyncMeta('Some vocabulary changes are saved locally and still syncing.');
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return;
        }

        const cached = await getCachedVocabulary(userId);
        if (cached.length > 0) {
          setItems(cached);
          setSyncMeta('Showing last synced vocabulary snapshot.');
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load vocabulary.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, userId],
  );

  useEffect(() => {
    if (!token || !userId) {
      setItems([]);
      setLessons([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const bootstrap = async () => {
      setIsLoading(true);
      const cached = await getCachedVocabulary(userId);
      if (isMounted && cached.length > 0) {
        setItems(cached);
        setSyncMeta('Showing last synced vocabulary snapshot.');
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
    items,
    lessons,
    setItems,
    setSyncMeta,
    syncMeta,
  };
}
