import type { Lesson } from '@/src/types/domain';

export function sortLessonsByLevelOrder(left: Lesson, right: Lesson) {
  const leftDate = Date.parse(left.createdAt ?? left.updatedAt ?? '1970-01-01T00:00:00.000Z');
  const rightDate = Date.parse(right.createdAt ?? right.updatedAt ?? '1970-01-01T00:00:00.000Z');

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return left.title.localeCompare(right.title);
}
