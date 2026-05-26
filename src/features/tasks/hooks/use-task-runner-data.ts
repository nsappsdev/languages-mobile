import { useEffect, useState } from 'react';
import {
  getCachedLessonDictionary,
  setCachedLessonDictionary,
} from '@/src/features/tasks/services/lesson-dictionary-cache';
import { buildEntryCacheByText } from '@/src/features/tasks/services/task-runner-helpers';
import { apiClient, ApiError } from '@/src/shared/api/client';
import type { AppSettings, Lesson, VocabularyEntry } from '@/src/types/domain';

export function useTaskRunnerData({ lessonId, token }: { lessonId: string; token: string | null }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [entryCacheByText, setEntryCacheByText] = useState<Record<string, VocabularyEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const seedFromCache = async () => {
      const cached = await getCachedLessonDictionary(lessonId);
      if (!cancelled && cached.length) {
        setEntryCacheByText(buildEntryCacheByText(cached));
      }
    };

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [lessonResponse, settingsResponse] = await Promise.all([
          apiClient.getLesson(token, lessonId),
          apiClient.getSettings(token),
        ]);
        if (cancelled) return;
        setLesson(lessonResponse.lesson);
        setAppSettings(settingsResponse.settings);
        const dictionary = lessonResponse.lesson.vocabulary ?? lessonResponse.lesson.dictionary ?? [];
        if (dictionary.length) {
          setEntryCacheByText((prev) => ({ ...prev, ...buildEntryCacheByText(dictionary) }));
          void setCachedLessonDictionary(lessonId, dictionary);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load lesson.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    seedFromCache().catch(() => null);
    load().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [lessonId, token]);

  return {
    appSettings,
    entryCacheByText,
    error,
    isLoading,
    lesson,
  };
}
