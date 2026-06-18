import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  applyVocabularyReviewDecisionLocally,
  buildLessonVocabularySection,
  createVocabularyReviewIdempotencyKey,
  restoreVocabularyRow,
  type LessonVocabularyRow,
  type LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  getCachedLessonVocabularySections,
  getCachedVocabularyLessonSummaries,
  setCachedLessonVocabularySection,
  setCachedVocabularyLessonSummaries,
} from '@/src/features/vocabulary/services/lesson-vocabulary-cache';
import {
  getPendingVocabularyReviewEvents,
  queueVocabularyReviewDecision,
} from '@/src/features/vocabulary/services/vocabulary-review-sync';
import { apiClient, ApiError } from '@/src/shared/api/client';
import type {
  VocabularyLessonSummary,
  VocabularyReviewDecision,
  VocabularyReviewEvent,
} from '@/src/types/domain';

export function useVocabularyData({
  token,
  userId,
}: {
  token: string | null;
  userId: string | undefined;
}) {
  const [summaries, setSummaries] = useState<VocabularyLessonSummary[]>([]);
  const [selectedSection, setSelectedSection] = useState<LessonVocabularySection | null>(null);
  const [archiveSections, setArchiveSections] = useState<LessonVocabularySection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<string | null>(null);

  const loadSection = useCallback(
    async (lessonId: string) => {
      if (!token || !userId) return null;
      const [lessonResponse, vocabularyResponse, pending] = await Promise.all([
        apiClient.getLesson(token, lessonId),
        apiClient.getLessonVocabulary(token, lessonId),
        getPendingVocabularyReviewEvents(userId),
      ]);
      const section = buildLessonVocabularySection({
        lesson: lessonResponse.lesson,
        payload: vocabularyResponse.vocabulary,
        pendingDecisions: pending.filter((event) => event.lessonId === lessonId),
      });
      await setCachedLessonVocabularySection(userId, section);
      return section;
    },
    [token, userId],
  );

  const fetchSummaries = useCallback(
    async (refresh = false) => {
      if (!token || !userId) return;
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await apiClient.getVocabularyLessonSummaries(token);
        setSummaries(response.lessons);
        await setCachedVocabularyLessonSummaries(userId, response.lessons);
        setSyncMeta(null);
      } catch (err) {
        const cached = await getCachedVocabularyLessonSummaries(userId);
        if (cached.length) {
          setSummaries(cached);
          setSyncMeta('Showing the last saved vocabulary snapshot.');
        } else if (err instanceof ApiError && err.status !== 401) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, userId],
  );

  const openLesson = useCallback(
    async (lessonId: string) => {
      if (!userId) return;
      setError(null);
      setIsLoadingView(true);
      const cached = (await getCachedLessonVocabularySections(userId)).find(
        (section) => section.lessonId === lessonId,
      );
      if (cached) {
        setSelectedSection(cached);
      }
      try {
        const section = await loadSection(lessonId);
        if (section) setSelectedSection(section);
      } catch (err) {
        if (!cached) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson vocabulary.');
        } else {
          setSyncMeta('Showing the last saved vocabulary snapshot.');
        }
      } finally {
        setIsLoadingView(false);
      }
    },
    [loadSection, userId],
  );

  const openArchive = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setIsLoadingView(true);
    const lessonIds = summaries
      .filter((summary) => summary.learnedCount > 0)
      .map((summary) => summary.lessonId);
    const cached = await getCachedLessonVocabularySections(userId);
    setArchiveSections(
      cached
        .filter((section) => lessonIds.includes(section.lessonId))
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.status === 'LEARNED'),
        }))
        .filter((section) => section.items.length > 0),
    );
    try {
      const loaded = await Promise.all(lessonIds.map((lessonId) => loadSection(lessonId)));
      setArchiveSections(
        loaded
          .filter((section): section is LessonVocabularySection => Boolean(section))
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => item.status === 'LEARNED'),
          }))
          .filter((section) => section.items.length > 0),
      );
    } catch (err) {
      setSyncMeta(
        err instanceof Error
          ? `Archive refresh failed: ${err.message}`
          : 'Archive refresh failed. Showing saved words.',
      );
    } finally {
      setIsLoadingView(false);
    }
  }, [loadSection, summaries, userId]);

  const reviewWord = useCallback(
    (row: LessonVocabularyRow, decision: VocabularyReviewDecision) => {
      if (!selectedSection || !userId) return;
      const updated = applyVocabularyReviewDecisionLocally(row, decision);
      const event: VocabularyReviewEvent = {
        lessonId: row.lessonId,
        entryId: row.entryId,
        decision,
        idempotencyKey: createVocabularyReviewIdempotencyKey(
          row.lessonId,
          row.entryId,
          decision,
        ),
        createdAt: new Date().toISOString(),
      };

      const nextSection = {
        ...selectedSection,
        items: [
          ...selectedSection.items.filter((item) => item.entryId !== row.entryId),
          updated,
        ],
      };
      setSelectedSection(nextSection);
      void setCachedLessonVocabularySection(userId, nextSection);

      if (updated.status === 'LEARNED') {
        setSummaries((current) =>
          current.map((summary) =>
            summary.lessonId === row.lessonId
              ? {
                  ...summary,
                  activeCount: Math.max(0, summary.activeCount - 1),
                  learnedCount: summary.learnedCount + 1,
                }
              : summary,
          ),
        );
      }

      void queueVocabularyReviewDecision(event).then((result) => {
        setSyncMeta(
          result.ok && result.pending === 0
            ? null
            : (result.message ?? 'Review changes are saved locally and still syncing.'),
        );
      });
    },
    [selectedSection, userId],
  );

  const restoreWord = useCallback(
    async (section: LessonVocabularySection, row: LessonVocabularyRow) => {
      if (!token || !userId) return;
      const restored = restoreVocabularyRow(row);
      await apiClient.updateLessonVocabularyStatus(token, row.lessonId, row.entryId, 'LEARNING');
      setArchiveSections((current) =>
        current
          .map((item) =>
            item.lessonId === section.lessonId
              ? { ...item, items: item.items.filter((entry) => entry.entryId !== row.entryId) }
              : item,
          )
          .filter((item) => item.items.length > 0),
      );
      const cached = await getCachedLessonVocabularySections(userId);
      const cachedSection = cached.find((item) => item.lessonId === section.lessonId) ?? section;
      await setCachedLessonVocabularySection(userId, {
        ...cachedSection,
        items: [
          ...cachedSection.items.filter((item) => item.entryId !== row.entryId),
          restored,
        ],
      });
      setSummaries((current) =>
        current.map((summary) =>
          summary.lessonId === row.lessonId
            ? {
                ...summary,
                activeCount: summary.activeCount + 1,
                learnedCount: Math.max(0, summary.learnedCount - 1),
              }
            : summary,
        ),
      );
    },
    [token, userId],
  );

  useEffect(() => {
    if (!token || !userId) {
      setSummaries([]);
      setIsLoading(false);
      return;
    }
    void getCachedVocabularyLessonSummaries(userId).then((cached) => {
      if (cached.length) {
        setSummaries(cached);
        setIsLoading(false);
      }
    });
    void fetchSummaries();
  }, [fetchSummaries, token, userId]);

  useFocusEffect(
    useCallback(() => {
      void fetchSummaries(true);
      return undefined;
    }, [fetchSummaries]),
  );

  return {
    archiveSections,
    error,
    fetchSummaries,
    isLoading,
    isLoadingView,
    isRefreshing,
    openArchive,
    openLesson,
    restoreWord,
    reviewWord,
    selectedSection,
    setSelectedSection,
    summaries,
    syncMeta,
  };
}
