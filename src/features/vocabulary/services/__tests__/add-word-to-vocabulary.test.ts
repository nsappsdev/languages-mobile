import { addSelectionToVocabulary } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { getCachedVocabulary, setCachedVocabulary } from '@/src/features/vocabulary/services/vocabulary-sync';
import { apiClient } from '@/src/shared/api/client';
import type { LearnerVocabularyItem } from '@/src/types/domain';

jest.mock('@/src/shared/api/client', () => ({
  apiClient: {
    resolveVocabularyPack: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

function createVocabularyItem(input: {
  id: string;
  userId: string;
  word: string;
  translation?: string;
}) {
  const translations = input.translation
    ? [
        {
          id: `tr-${input.id}`,
          entryId: `entry-${input.id}`,
          languageCode: 'hy',
          translation: input.translation,
          usageExample: null,
        },
      ]
    : [];

  return {
    id: input.id,
    userId: input.userId,
    entryId: `entry-${input.id}`,
    status: 'NEW',
    addedAt: '2026-02-25T10:00:00.000Z',
    updatedAt: '2026-02-25T10:00:00.000Z',
    entry: {
      id: `entry-${input.id}`,
      englishText: input.word,
      kind: 'WORD',
      tags: ['mobile-captured'],
      translations,
    },
  } satisfies LearnerVocabularyItem;
}

describe('addSelectionToVocabulary', () => {
  const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid selection without calling backend', async () => {
    const result = await addSelectionToVocabulary('token-invalid', 'user-invalid', '!!!');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Selected text is not valid for vocabulary.');
    expect(mockedApiClient.resolveVocabularyPack).not.toHaveBeenCalled();
  });

  it('adds selection via pack endpoint and merges it into user cache', async () => {
    const userId = 'user-pack-success';
    const vocabularyItem = createVocabularyItem({
      id: 'pack-item',
      userId,
      word: 'hello',
      translation: 'բարեւ',
    });

    mockedApiClient.resolveVocabularyPack.mockResolvedValue({
      vocabulary: [vocabularyItem],
      resolved: 1,
      received: 1,
    });

    const result = await addSelectionToVocabulary('token-pack-success', userId, 'Hello');
    const cached = await getCachedVocabulary(userId);

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Added "hello" to vocabulary');
    expect(result.message).toContain('բարեւ');
    expect(mockedApiClient.resolveVocabularyPack).toHaveBeenCalledTimes(1);
    expect(cached.some((item) => item.id === vocabularyItem.id)).toBe(true);
  });

  it('uses lookup cache for repeated selection within same session', async () => {
    const userId = 'user-cache-hit';
    const vocabularyItem = createVocabularyItem({
      id: 'cache-item',
      userId,
      word: 'focus',
      translation: 'կենտրոնացում',
    });

    mockedApiClient.resolveVocabularyPack.mockResolvedValue({
      vocabulary: [vocabularyItem],
      resolved: 1,
      received: 1,
    });

    const first = await addSelectionToVocabulary('token-cache-hit', userId, 'focus');
    const second = await addSelectionToVocabulary('token-cache-hit', userId, ' focus ');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(mockedApiClient.resolveVocabularyPack).toHaveBeenCalledTimes(1);
  });

  it('returns already-exists message from persisted vocabulary cache without backend call', async () => {
    const userId = 'user-existing-cache';
    const vocabularyItem = createVocabularyItem({
      id: 'existing-item',
      userId,
      word: 'already there',
      translation: 'արդեն կա',
    });

    await setCachedVocabulary(userId, [vocabularyItem]);

    const result = await addSelectionToVocabulary(
      'token-existing-cache',
      userId,
      'already there',
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('already in your vocabulary');
    expect(result.message).toContain('already there');
    expect(mockedApiClient.resolveVocabularyPack).not.toHaveBeenCalled();
  });

  it('uses persisted cache after session token changes', async () => {
    const userId = 'user-cache-reset';
    const vocabularyItem = createVocabularyItem({
      id: 'reset-item',
      userId,
      word: 'repeat',
      translation: 'կրկնել',
    });

    mockedApiClient.resolveVocabularyPack.mockResolvedValue({
      vocabulary: [vocabularyItem],
      resolved: 1,
      received: 1,
    });

    const first = await addSelectionToVocabulary('token-one', userId, 'repeat');
    const second = await addSelectionToVocabulary('token-two', userId, 'repeat');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.message).toContain('already in your vocabulary');
    expect(mockedApiClient.resolveVocabularyPack).toHaveBeenCalledTimes(1);
  });
});
