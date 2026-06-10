import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
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
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    try {
      const [lessonResponse, settingsResponse] = await Promise.all([
        apiClient.getLesson(token, lessonId),
        apiClient.getSettings(token),
      ]);
      if (requestIdRef.current !== requestId) return;

      const dictionary = lessonResponse.lesson.vocabulary ?? lessonResponse.lesson.dictionary ?? [];
      setLesson(lessonResponse.lesson);
      setAppSettings(settingsResponse.settings);
      setEntryCacheByText(buildEntryCacheByText(dictionary));
      void setCachedLessonDictionary(lessonId, dictionary);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      if (err instanceof ApiError || err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load lesson.');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [lessonId, token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getCachedLessonDictionary(lessonId).then((cached) => {
        if (active && cached.length) {
          setEntryCacheByText(buildEntryCacheByText(cached));
        }
      });
      void load();
      return () => {
        active = false;
        requestIdRef.current += 1;
      };
    }, [lessonId, load]),
  );

  return {
    appSettings,
    entryCacheByText,
    error,
    isLoading,
    lesson,
    reload: load,
  };
}
