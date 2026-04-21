import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import type { Lesson } from '@/src/types/domain';

function createLesson(input: {
  id: string;
  title: string;
  createdAt: string;
}): Lesson {
  return {
    id: input.id,
    title: input.title,
    status: 'PUBLISHED',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    items: [],
  };
}

describe('sortLessonsByLevelOrder', () => {
  it('sorts by creation date and falls back to title for equal timestamps', () => {
    const unsorted = [
      createLesson({
        id: 'lesson-b',
        title: 'Bravo',
        createdAt: '2026-02-20T11:00:00.000Z',
      }),
      createLesson({
        id: 'lesson-c',
        title: 'Charlie',
        createdAt: '2026-02-20T10:00:00.000Z',
      }),
      createLesson({
        id: 'lesson-a',
        title: 'Alpha',
        createdAt: '2026-02-20T11:00:00.000Z',
      }),
    ];

    const sorted = [...unsorted].sort(sortLessonsByLevelOrder);

    expect(sorted.map((lesson) => lesson.id)).toEqual(['lesson-c', 'lesson-a', 'lesson-b']);
  });
});
