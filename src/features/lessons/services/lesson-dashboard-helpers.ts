import type { LessonProgressState } from '@/src/features/lessons/progression-storage';
import type { Lesson } from '@/src/types/domain';

export const EMPTY_PROGRESS_STATE: LessonProgressState = {
  completedLessonIds: [],
  activeLessonId: null,
  updatedAt: '',
};

export type LessonCardStatus = 'COMPLETED' | 'CURRENT' | 'OPEN';

export type LessonDashboardSummary = {
  completedLessons: number;
  completedSet: Set<string>;
  currentLesson: Lesson | null;
  currentLessonId: string | null;
  progressPercent: number;
  totalLessons: number;
};

export function buildCompletedLessonSet(lessons: Lesson[], completedLessonIds: string[]) {
  const validCompleted = completedLessonIds.filter((lessonId) =>
    lessons.some((lesson) => lesson.id === lessonId),
  );
  return new Set(validCompleted);
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

export function getLessonCardStatus(input: {
  lessonId: string;
  completedSet: Set<string>;
  currentLessonId: string | null;
}): LessonCardStatus {
  const { lessonId, completedSet, currentLessonId } = input;

  if (completedSet.has(lessonId)) {
    return 'COMPLETED';
  }

  if (currentLessonId === lessonId) {
    return 'CURRENT';
  }

  return 'OPEN';
}

export function buildLessonDashboardSummary(
  lessons: Lesson[],
  progressState: LessonProgressState,
): LessonDashboardSummary {
  const completedSet = buildCompletedLessonSet(lessons, progressState.completedLessonIds);
  const currentLessonId = resolveCurrentLessonId(
    lessons,
    progressState.activeLessonId,
    completedSet,
  );
  const totalLessons = lessons.length;
  const completedLessons = completedSet.size;
  const progressPercent = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;
  const currentLesson = currentLessonId
    ? lessons.find((lesson) => lesson.id === currentLessonId) ?? null
    : null;

  return {
    completedLessons,
    completedSet,
    currentLesson,
    currentLessonId,
    progressPercent,
    totalLessons,
  };
}
