import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
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

export function LessonListScreen({
  experience = 'continuous',
}: {
  experience?: 'continuous' | 'paged';
}) {
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

      router.push({
        pathname: experience === 'paged' ? '/runner-2/[lessonId]' : '/runner/[lessonId]',
        params: { lessonId: item.id },
      });
    },
    [experience, loadProgressState, router, user?.id],
  );

  if (!token) {
    return (
      <LessonDashboardState
        message="Sign in to see your learning path and continue your lessons."
        title="Sign in to view lessons"
      />
    );
  }

  if (user && user.emailVerified !== true) {
    return (
      <ScreenContainer scroll>
        <View style={styles.verificationContent}>
          <LessonDashboardHeader subtitle="Verify your email to unlock lessons and start learning." />
          <VerificationBanner
            title="Lessons are locked"
            body={`We sent a verification link to ${user.email}. Open it to start learning.`}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <LessonDashboardState
        loading
        message="Preparing your lesson library and latest progress."
        title="Loading lessons"
      />
    );
  }

  if (error) {
    return (
      <LessonDashboardState
        actionLabel="Try again"
        message={error}
        onAction={() => fetchLessons().catch(() => null)}
        title="Lessons couldn't load"
      />
    );
  }

  return (
    <ScreenContainer>
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
        }}>
        <LessonDashboardHeader
          eyebrow={experience === 'paged' ? 'BOOK READER' : undefined}
          subtitle={
            experience === 'paged'
              ? 'Open the same lessons one sentence at a time, like turning pages in a book.'
              : undefined
          }
          title={experience === 'paged' ? 'Lessons 2' : undefined}
        />
        <LessonSummaryCards
          completedLessons={summary.completedLessons}
          totalLessons={summary.totalLessons}
        />
        <LearningProgressCard
          completedLessons={summary.completedLessons}
          currentLesson={summary.currentLesson}
          progressPercent={summary.progressPercent}
          totalLessons={summary.totalLessons}
        />
      </LessonDashboardList>
    </ScreenContainer>
  );
}
