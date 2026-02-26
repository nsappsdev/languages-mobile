import { getLessonProgressState } from '@/src/features/lessons/progression-storage';
import { apiClient } from '@/src/shared/api/client';
import type { Lesson } from '@/src/types/domain';

export type LessonAccessResult = {
  allowed: boolean;
  message?: string;
  currentLessonId?: string | null;
};

export async function getLessonAccess(
  token: string,
  userId: string,
  targetLessonId: string,
): Promise<LessonAccessResult> {
  const [lessonsResponse, progressState] = await Promise.all([
    apiClient.getLessons(token),
    getLessonProgressState(userId),
  ]);

  const lessons = [...lessonsResponse.lessons].sort(sortLessonsByLevelOrder);
  const targetIndex = lessons.findIndex((lesson) => lesson.id === targetLessonId);
  if (targetIndex === -1) {
    return {
      allowed: false,
      message: 'Lesson is not available.',
    };
  }

  const completedSet = new Set(
    progressState.completedLessonIds.filter((lessonId) =>
      lessons.some((lesson) => lesson.id === lessonId),
    ),
  );
  const firstIncompleteIndex = lessons.findIndex((lesson) => !completedSet.has(lesson.id));
  const maxAllowedIndex =
    firstIncompleteIndex === -1 ? lessons.length - 1 : firstIncompleteIndex;

  if (targetIndex > maxAllowedIndex) {
    const currentLesson = lessons[firstIncompleteIndex];
    return {
      allowed: false,
      currentLessonId: currentLesson?.id ?? null,
      message: currentLesson
        ? `Complete "${currentLesson.title}" first to unlock this level.`
        : 'Finish your current lesson first to unlock this level.',
    };
  }

  return {
    allowed: true,
  };
}

export function sortLessonsByLevelOrder(left: Lesson, right: Lesson) {
  const leftDate = Date.parse(left.createdAt ?? left.updatedAt ?? '1970-01-01T00:00:00.000Z');
  const rightDate = Date.parse(right.createdAt ?? right.updatedAt ?? '1970-01-01T00:00:00.000Z');

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return left.title.localeCompare(right.title);
}
