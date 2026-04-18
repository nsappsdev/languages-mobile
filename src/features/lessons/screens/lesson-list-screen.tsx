import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getLessonProgressState,
  setActiveLesson,
  type LessonProgressState,
} from '@/src/features/lessons/progression-storage';
import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { VerificationBanner } from '@/src/features/auth/components/verification-banner';
import type { Lesson } from '@/src/types/domain';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

const EMPTY_PROGRESS_STATE: LessonProgressState = {
  completedLessonIds: [],
  activeLessonId: null,
  updatedAt: '',
};

export function LessonListScreen() {
  const router = useRouter();
  const { token, user } = useSession();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<LessonProgressState>(EMPTY_PROGRESS_STATE);

  const loadProgressState = useCallback(async () => {
    if (!user?.id) {
      setProgressState(EMPTY_PROGRESS_STATE);
      return EMPTY_PROGRESS_STATE;
    }

    const next = await getLessonProgressState(user.id);
    setProgressState(next);
    return next;
  }, [user?.id]);

  const fetchLessons = useCallback(
    async (isRefresh = false) => {
      if (!token) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      setNotice(null);
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
    fetchLessons().catch(() => null);
  }, [fetchLessons]);

  useFocusEffect(
    useCallback(() => {
      loadProgressState().catch(() => null);
      return undefined;
    }, [loadProgressState]),
  );

  const completedSet = useMemo(() => {
    const validCompleted = progressState.completedLessonIds.filter((lessonId) =>
      lessons.some((lesson) => lesson.id === lessonId),
    );
    return new Set(validCompleted);
  }, [lessons, progressState.completedLessonIds]);

  const firstIncompleteIndex = useMemo(
    () => lessons.findIndex((lesson) => !completedSet.has(lesson.id)),
    [completedSet, lessons],
  );

  const currentLessonId = useMemo(
    () => resolveCurrentLessonId(lessons, progressState.activeLessonId, completedSet),
    [completedSet, lessons, progressState.activeLessonId],
  );

  const totalLessons = lessons.length;
  const completedLessons = completedSet.size;
  const progressPercent = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;
  const currentLesson = currentLessonId
    ? lessons.find((lesson) => lesson.id === currentLessonId) ?? null
    : null;

  const handleOpenLesson = useCallback(
    async (item: Lesson, index: number) => {
      const isLocked = firstIncompleteIndex !== -1 && index > firstIncompleteIndex;
      if (isLocked) {
        setNotice('Finish your current lesson first to unlock the next level.');
        return;
      }

      if (user?.id) {
        await setActiveLesson(user.id, item.id);
        await loadProgressState();
      }

      router.push({ pathname: '/runner/[lessonId]', params: { lessonId: item.id } });
    },
    [firstIncompleteIndex, loadProgressState, router, user?.id],
  );

  if (!token) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.meta}>Please sign in first.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (user && user.emailVerified === false) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.meta}>Verify your email to unlock lessons.</Text>
        </View>
        <VerificationBanner
          title="Lessons are locked"
          body={`We sent a verification link to ${user.email}. Open it to start learning.`}
        />
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Loading lessons...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => fetchLessons().catch(() => null)} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.meta}>Follow levels in order. Finish current level to unlock the next.</Text>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Total Lessons" value={String(totalLessons)} />
        <SummaryCard label="Completed" value={String(completedLessons)} />
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Learning Progress</Text>
          <Text style={styles.progressValue}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.currentLessonMeta}>
          {currentLesson
            ? `Current level: ${currentLesson.title}`
            : totalLessons
              ? 'All levels completed. Great work.'
              : 'No lessons available yet.'}
        </Text>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <FlatList
        data={lessons}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const status = getLessonCardStatus({
            lessonId: item.id,
            index,
            firstIncompleteIndex,
            completedSet,
            currentLessonId,
          });
          const isCompleted = status === 'COMPLETED';
          const isLocked = status === 'LOCKED';
          const isCurrent = status === 'CURRENT';

          return (
            <Pressable
              onPress={() => {
                void handleOpenLesson(item, index);
              }}
              style={({ pressed }) => [
                styles.card,
                isLocked && styles.cardLocked,
                isCurrent && styles.cardCurrent,
                pressed && !isLocked && styles.cardPressed,
              ]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{`Level ${index + 1}: ${item.title}`}</Text>
                <Text
                  style={[
                    styles.status,
                    isCompleted
                      ? styles.statusCompleted
                      : isCurrent
                        ? styles.statusCurrent
                        : isLocked
                          ? styles.statusLocked
                          : styles.statusOpen,
                  ]}>
                  {status}
                </Text>
              </View>

              <Text style={styles.cardDescription}>{item.description || 'No description provided.'}</Text>
              <Text style={styles.cardMeta}>{item.items?.length ?? 0} items</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No lessons yet.</Text>
            <Text style={styles.emptyText}>Published lessons will appear here.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchLessons(true).catch(() => null);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export function resolveCurrentLessonId(
  lessons: Lesson[],
  activeLessonId: string | null,
  completedSet: Set<string>,
) {
  if (!lessons.length) {
    return null;
  }

  if (
    activeLessonId &&
    lessons.some((lesson) => lesson.id === activeLessonId) &&
    !completedSet.has(activeLessonId)
  ) {
    return activeLessonId;
  }

  const next = lessons.find((lesson) => !completedSet.has(lesson.id));
  if (next) {
    return next.id;
  }

  return lessons[lessons.length - 1]?.id ?? null;
}

type LessonCardStatus = 'COMPLETED' | 'CURRENT' | 'LOCKED' | 'OPEN';

export function getLessonCardStatus(input: {
  lessonId: string;
  index: number;
  firstIncompleteIndex: number;
  completedSet: Set<string>;
  currentLessonId: string | null;
}): LessonCardStatus {
  const { lessonId, index, firstIncompleteIndex, completedSet, currentLessonId } = input;

  if (completedSet.has(lessonId)) {
    return 'COMPLETED';
  }

  if (currentLessonId === lessonId) {
    return 'CURRENT';
  }

  if (firstIncompleteIndex !== -1 && index > firstIncompleteIndex) {
    return 'LOCKED';
  }

  return 'OPEN';
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    color: text.primary,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.md,
  },
  error: {
    color: text.error,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  notice: {
    color: '#9a3412',
    fontSize: fontSize.base,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: brand[700],
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: neutral[0],
    fontWeight: fontWeight.semibold,
  },
  header: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  summaryValue: {
    color: text.brand,
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },
  summaryLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  progressCard: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  progressValue: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    backgroundColor: neutral[200],
    borderRadius: radii.full,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: brand[700],
    borderRadius: radii.full,
    height: '100%',
  },
  currentLessonMeta: {
    color: text.secondary,
    fontSize: fontSize.base,
    marginTop: 8,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardCurrent: {
    borderColor: brand[700],
    borderWidth: 2,
  },
  cardLocked: {
    backgroundColor: neutral[100],
    borderColor: border.default,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: text.primary,
    flex: 1,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    marginRight: 12,
  },
  status: {
    borderRadius: radii.full,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusCurrent: {
    backgroundColor: '#ccfbf1',
    color: brand[800],
  },
  statusLocked: {
    backgroundColor: neutral[200],
    color: neutral[700],
  },
  statusOpen: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  cardDescription: {
    color: neutral[700],
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  cardMeta: {
    color: text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  emptyText: {
    color: text.secondary,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
