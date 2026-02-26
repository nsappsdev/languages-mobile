import { getLessonAccess, sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import { getLessonProgressState } from '@/src/features/lessons/progression-storage';
import { apiClient } from '@/src/shared/api/client';
import type { Lesson } from '@/src/types/domain';

jest.mock('@/src/shared/api/client', () => ({
  apiClient: {
    getLessons: jest.fn(),
  },
}));

jest.mock('@/src/features/lessons/progression-storage', () => ({
  getLessonProgressState: jest.fn(),
}));

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
    tasks: [],
  };
}

describe('lesson-locking', () => {
  const mockedGetLessons = apiClient.getLessons as jest.MockedFunction<typeof apiClient.getLessons>;
  const mockedGetLessonProgressState = getLessonProgressState as jest.MockedFunction<
    typeof getLessonProgressState
  >;

  const lessons = [
    createLesson({
      id: 'lesson-1',
      title: 'Level 1',
      createdAt: '2026-02-20T10:00:00.000Z',
    }),
    createLesson({
      id: 'lesson-2',
      title: 'Level 2',
      createdAt: '2026-02-20T11:00:00.000Z',
    }),
    createLesson({
      id: 'lesson-3',
      title: 'Level 3',
      createdAt: '2026-02-20T12:00:00.000Z',
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLessons.mockResolvedValue({ lessons });
  });

  it('allows access to current lesson when previous one is completed', async () => {
    mockedGetLessonProgressState.mockResolvedValue({
      completedLessonIds: ['lesson-1'],
      activeLessonId: 'lesson-2',
      updatedAt: '2026-02-25T10:00:00.000Z',
    });

    const result = await getLessonAccess('token', 'user-1', 'lesson-2');

    expect(result.allowed).toBe(true);
  });

  it('blocks access to future lesson and points to current unlocked lesson', async () => {
    mockedGetLessonProgressState.mockResolvedValue({
      completedLessonIds: ['lesson-1'],
      activeLessonId: 'lesson-2',
      updatedAt: '2026-02-25T10:00:00.000Z',
    });

    const result = await getLessonAccess('token', 'user-1', 'lesson-3');

    expect(result.allowed).toBe(false);
    expect(result.currentLessonId).toBe('lesson-2');
    expect(result.message).toContain('Level 2');
  });

  it('returns not available when target lesson is missing', async () => {
    mockedGetLessonProgressState.mockResolvedValue({
      completedLessonIds: ['lesson-1'],
      activeLessonId: 'lesson-2',
      updatedAt: '2026-02-25T10:00:00.000Z',
    });

    const result = await getLessonAccess('token', 'user-1', 'lesson-999');

    expect(result.allowed).toBe(false);
    expect(result.message).toBe('Lesson is not available.');
  });

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
