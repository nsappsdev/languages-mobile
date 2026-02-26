import { apiClient, ApiError } from '@/src/shared/api/client';
import type { LearnerVocabularyItem } from '@/src/types/domain';
import {
  getCachedVocabulary,
  mergeCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';

type AddSelectionResult = {
  ok: boolean;
  message: string;
  vocabulary?: LearnerVocabularyItem;
};

type VocabularyCacheRecord = {
  item: LearnerVocabularyItem;
  cachedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const vocabularyLookupCache = new Map<string, VocabularyCacheRecord>();
let activeToken: string | null = null;
let activeUserId: string | null = null;

export async function addSelectionToVocabulary(
  token: string,
  userId: string,
  rawSelection: string,
): Promise<AddSelectionResult> {
  const normalizedSelection = normalizeVocabularySelection(rawSelection);

  if (!normalizedSelection) {
    return {
      ok: false,
      message: 'Selected text is not valid for vocabulary.',
    };
  }

  resetCacheIfSessionChanged(token, userId);

  const cacheKey = normalizedSelection.toLowerCase();
  const cached = vocabularyLookupCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= CACHE_TTL_MS) {
    return {
      ok: true,
      message: buildAlreadyExistsMessage(
        cached.item.entry.englishText,
        cached.item.entry.translations[0]?.translation,
      ),
      vocabulary: cached.item,
    };
  }

  const cachedVocabulary = await getCachedVocabulary(userId);
  const existingVocabularyItem = cachedVocabulary.find(
    (item) => item.entry.englishText.trim().toLowerCase() === cacheKey,
  );
  if (existingVocabularyItem) {
    vocabularyLookupCache.set(cacheKey, {
      item: existingVocabularyItem,
      cachedAt: Date.now(),
    });

    return {
      ok: true,
      message: buildAlreadyExistsMessage(
        existingVocabularyItem.entry.englishText,
        existingVocabularyItem.entry.translations[0]?.translation,
      ),
      vocabulary: existingVocabularyItem,
    };
  }

  try {
    const packResponse = await apiClient.resolveVocabularyPack(token, [normalizedSelection]);
    const vocabularyItem = packResponse.vocabulary[0];

    if (!vocabularyItem) {
      return {
        ok: false,
        message: 'Failed to resolve vocabulary selection.',
      };
    }

    await mergeCachedVocabulary(userId, packResponse.vocabulary);

    for (const item of packResponse.vocabulary) {
      vocabularyLookupCache.set(item.entry.englishText.toLowerCase(), {
        item,
        cachedAt: Date.now(),
      });
    }

    vocabularyLookupCache.set(cacheKey, {
      item: vocabularyItem,
      cachedAt: Date.now(),
    });

    return {
      ok: true,
      message: buildSuccessMessage(
        vocabularyItem.entry.englishText,
        vocabularyItem.entry.translations[0]?.translation,
      ),
      vocabulary: vocabularyItem,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: error.message,
      };
    }

    return {
      ok: false,
      message: 'Failed to save selected text to vocabulary.',
    };
  }
}

function normalizeVocabularySelection(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .toLowerCase();

  if (cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

function resetCacheIfSessionChanged(token: string, userId: string) {
  if (activeToken === token && activeUserId === userId) {
    return;
  }

  activeToken = token;
  activeUserId = userId;
  vocabularyLookupCache.clear();
}

function buildSuccessMessage(entryText: string, translation?: string | null) {
  if (translation) {
    return `Added "${entryText}" to vocabulary. Translation: ${translation}`;
  }

  return `Added "${entryText}" to vocabulary.`;
}

function buildAlreadyExistsMessage(entryText: string, translation?: string | null) {
  if (translation) {
    return `"${entryText}" is already in your vocabulary. Translation: ${translation}`;
  }

  return `"${entryText}" is already in your vocabulary.`;
}
