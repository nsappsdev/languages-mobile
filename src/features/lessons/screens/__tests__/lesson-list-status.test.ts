import {
  getLessonCardStatus,
  resolveCurrentLessonId,
} from '@/src/features/lessons/screens/lesson-list-screen';
import type { Lesson } from '@/src/types/domain';

function createLesson(input: { id: string; title: string }): Lesson {
  return {
    id: input.id,
    title: input.title,
    status: 'PUBLISHED',
    createdAt: '2026-02-25T10:00:00.000Z',
    updatedAt: '2026-02-25T10:00:00.000Z',
    items: [],
  };
}

describe('lesson list status helpers', () => {
  const lessons = [
    createLesson({ id: 'lesson-1', title: 'Level 1' }),
    createLesson({ id: 'lesson-2', title: 'Level 2' }),
    createLesson({ id: 'lesson-3', title: 'Level 3' }),
  ];

  it('resolves current lesson from active lesson when valid and incomplete', () => {
    const current = resolveCurrentLessonId(lessons, 'lesson-2', new Set(['lesson-1']));
    expect(current).toBe('lesson-2');
  });

  it('falls back to first incomplete lesson when active lesson is completed', () => {
    const current = resolveCurrentLessonId(
      lessons,
      'lesson-1',
      new Set(['lesson-1', 'lesson-2']),
    );
    expect(current).toBe('lesson-3');
  });

  it('returns last lesson when all lessons are completed', () => {
    const current = resolveCurrentLessonId(
      lessons,
      null,
      new Set(['lesson-1', 'lesson-2', 'lesson-3']),
    );
    expect(current).toBe('lesson-3');
  });

  it('returns null when lessons list is empty', () => {
    expect(resolveCurrentLessonId([], null, new Set())).toBeNull();
  });

  it('computes card statuses for completed/current/open', () => {
    const completed = getLessonCardStatus({
      lessonId: 'lesson-1',
      completedSet: new Set(['lesson-1']),
      currentLessonId: 'lesson-2',
    });
    const current = getLessonCardStatus({
      lessonId: 'lesson-2',
      completedSet: new Set(['lesson-1']),
      currentLessonId: 'lesson-2',
    });
    const openAhead = getLessonCardStatus({
      lessonId: 'lesson-3',
      completedSet: new Set(['lesson-1']),
      currentLessonId: 'lesson-2',
    });
    const open = getLessonCardStatus({
      lessonId: 'lesson-1',
      completedSet: new Set<string>(),
      currentLessonId: null,
    });

    expect(completed).toBe('COMPLETED');
    expect(current).toBe('CURRENT');
    expect(openAhead).toBe('OPEN');
    expect(open).toBe('OPEN');
  });
});
