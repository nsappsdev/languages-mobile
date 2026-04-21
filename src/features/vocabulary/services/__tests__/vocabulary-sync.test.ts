import {
  applyVocabularyStatusOverrides,
  getCachedVocabulary,
  mergeCachedVocabulary,
  setCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import type { LearnerVocabularyItem } from '@/src/types/domain';

function createVocabularyItem(input: {
  id: string;
  userId: string;
  word: string;
  updatedAt: string;
}): LearnerVocabularyItem {
  return {
    id: input.id,
    userId: input.userId,
    entryId: `entry-${input.id}`,
    status: 'NEW',
    addedAt: input.updatedAt,
    updatedAt: input.updatedAt,
    entry: {
      id: `entry-${input.id}`,
      englishText: input.word,
      kind: 'WORD',
      tags: ['test'],
      translations: [],
    },
  };
}

describe('vocabulary-sync service', () => {
  it('stores and returns vocabulary sorted by freshest updatedAt', async () => {
    const userId = 'sync-sort-user';
    const older = createVocabularyItem({
      id: 'old',
      userId,
      word: 'alpha',
      updatedAt: '2026-02-25T10:00:00.000Z',
    });
    const newer = createVocabularyItem({
      id: 'new',
      userId,
      word: 'beta',
      updatedAt: '2026-02-25T11:00:00.000Z',
    });

    await setCachedVocabulary(userId, [older, newer]);

    const cached = await getCachedVocabulary(userId);
    expect(cached.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('merges incoming items and overwrites duplicates by id', async () => {
    const userId = 'sync-merge-user';
    const initial = createVocabularyItem({
      id: 'same-id',
      userId,
      word: 'hello',
      updatedAt: '2026-02-25T10:00:00.000Z',
    });
    const replacement = createVocabularyItem({
      id: 'same-id',
      userId,
      word: 'updated-word',
      updatedAt: '2026-02-25T12:00:00.000Z',
    });
    const second = createVocabularyItem({
      id: 'second-id',
      userId,
      word: 'world',
      updatedAt: '2026-02-25T11:00:00.000Z',
    });

    await setCachedVocabulary(userId, [initial]);
    await mergeCachedVocabulary(userId, [replacement, second]);

    const cached = await getCachedVocabulary(userId);
    expect(cached).toHaveLength(2);
    expect(cached[0].id).toBe('same-id');
    expect(cached[0].entry.englishText).toBe('updated-word');
    expect(cached[1].id).toBe('second-id');
  });

  it('keeps cache isolated per user', async () => {
    const userOneId = 'sync-user-one';
    const userTwoId = 'sync-user-two';

    await setCachedVocabulary(userOneId, [
      createVocabularyItem({
        id: 'u1-item',
        userId: userOneId,
        word: 'apple',
        updatedAt: '2026-02-25T10:00:00.000Z',
      }),
    ]);
    await setCachedVocabulary(userTwoId, [
      createVocabularyItem({
        id: 'u2-item',
        userId: userTwoId,
        word: 'banana',
        updatedAt: '2026-02-25T10:30:00.000Z',
      }),
    ]);

    const userOneCached = await getCachedVocabulary(userOneId);
    const userTwoCached = await getCachedVocabulary(userTwoId);

    expect(userOneCached).toHaveLength(1);
    expect(userOneCached[0].entry.englishText).toBe('apple');
    expect(userTwoCached).toHaveLength(1);
    expect(userTwoCached[0].entry.englishText).toBe('banana');
  });

  it('applies pending status overrides over stale vocabulary payloads', () => {
    const userId = 'sync-status-user';
    const item = createVocabularyItem({
      id: 'status-item',
      userId,
      word: 'years',
      updatedAt: '2026-04-21T10:00:00.000Z',
    });

    const [updated] = applyVocabularyStatusOverrides(
      [item],
      [{ entryId: item.entryId, status: 'MASTERED', updatedAt: 1776772800000 }],
    );

    expect(updated.status).toBe('MASTERED');
    expect(updated.updatedAt).toBe('2026-04-21T12:00:00.000Z');
  });
});
