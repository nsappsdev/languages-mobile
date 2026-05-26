import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import {
  getLessonProgressState,
  type LessonProgressState,
} from '@/src/features/lessons/progression-storage';
import { EMPTY_PROGRESS_STATE } from '@/src/features/lessons/services/lesson-dashboard-helpers';
import { apiClient, ApiError } from '@/src/shared/api/client';
import type { Lesson } from '@/src/types/domain';

export function useLessonDashboardData({
  refreshProfile,
  token,
  userId,
}: {
  refreshProfile: () => Promise<void>;
  token: string | null;
  userId: string | undefined;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<LessonProgressState>(EMPTY_PROGRESS_STATE);

  const loadProgressState = useCallback(async () => {
    if (!userId) {
      setProgressState(EMPTY_PROGRESS_STATE);
      return EMPTY_PROGRESS_STATE;
    }

    const next = await getLessonProgressState(userId);
    setProgressState(next);
    return next;
  }, [userId]);

  const fetchLessons = useCallback(
    async (isRefresh = false) => {
      if (!token) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      try {
        const response = await apiClient.getLessons(token);
        const sortedLessons = [...response.lessons].sort(sortLessonsByLevelOrder);
        setLessons(sortedLessons);
        await loadProgressState();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load lessons.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadProgressState, token],
  );

  useEffect(() => {
    if (!token) return;
    refreshProfile().catch(() => null);
  }, [refreshProfile, token]);

  useEffect(() => {
    fetchLessons().catch(() => null);
  }, [fetchLessons]);

  useFocusEffect(
    useCallback(() => {
      loadProgressState().catch(() => null);
      return undefined;
    }, [loadProgressState]),
  );

  return {
    error,
    fetchLessons,
    isLoading,
    isRefreshing,
    lessons,
    loadProgressState,
    progressState,
  };
}
