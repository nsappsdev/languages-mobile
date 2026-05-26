import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { VerificationBanner } from '@/src/features/auth/components/verification-banner';
import { LessonDashboardList } from '@/src/features/lessons/components/lesson-dashboard-list';
import {
  LearningProgressCard,
  LessonDashboardHeader,
  LessonSummaryCards,
} from '@/src/features/lessons/components/lesson-dashboard-summary';
import { LessonDashboardState } from '@/src/features/lessons/components/lesson-dashboard-state';
import { useLessonDashboardData } from '@/src/features/lessons/hooks/use-lesson-dashboard-data';
import { setActiveLesson } from '@/src/features/lessons/progression-storage';
import {
  buildLessonDashboardSummary,
  getLessonCardStatus,
  resolveCurrentLessonId,
} from '@/src/features/lessons/services/lesson-dashboard-helpers';
import { useSession } from '@/src/shared/auth/session-context';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';
import type { Lesson } from '@/src/types/domain';

export { getLessonCardStatus, resolveCurrentLessonId };

export function LessonListScreen() {
  const router = useRouter();
  const { token, user, refreshProfile } = useSession();
  const {
    error,
    fetchLessons,
    isLoading,
    isRefreshing,
    lessons,
    loadProgressState,
    progressState,
  } = useLessonDashboardData({
    refreshProfile,
    token,
    userId: user?.id,
  });
  const summary = useMemo(
    () => buildLessonDashboardSummary(lessons, progressState),
    [lessons, progressState],
  );

  const handleOpenLesson = useCallback(
    async (item: Lesson) => {
      if (user?.id) {
        await setActiveLesson(user.id, item.id);
        await loadProgressState();
      }

      router.push({ pathname: '/runner/[lessonId]', params: { lessonId: item.id } });
    },
    [loadProgressState, router, user?.id],
  );

  if (!token) {
    return (
      <LessonDashboardState>
        <Text style={styles.meta}>Please sign in first.</Text>
      </LessonDashboardState>
    );
  }

  if (user && user.emailVerified !== true) {
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
      <LessonDashboardState>
        <ActivityIndicator size="large" />
        <Text style={styles.meta}>Loading lessons...</Text>
      </LessonDashboardState>
    );
  }

  if (error) {
    return (
      <LessonDashboardState>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => fetchLessons().catch(() => null)} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </LessonDashboardState>
    );
  }

  return (
    <ScreenContainer>
      <LessonDashboardHeader />
      <LessonSummaryCards
        completedLessons={summary.completedLessons}
        totalLessons={summary.totalLessons}
      />
      <LearningProgressCard
        currentLesson={summary.currentLesson}
        progressPercent={summary.progressPercent}
        totalLessons={summary.totalLessons}
      />
      <LessonDashboardList
        completedSet={summary.completedSet}
        currentLessonId={summary.currentLessonId}
        isRefreshing={isRefreshing}
        lessons={lessons}
        onOpenLesson={(lesson) => {
          void handleOpenLesson(lesson);
        }}
        onRefresh={() => {
          fetchLessons(true).catch(() => null);
        }}
      />
    </ScreenContainer>
  );
}
