import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyLessonSummary } from '@/src/types/domain';

const SECTION_STORAGE_KEY_PREFIX = 'language-lesson-vocabulary-sections-v2';
const SUMMARY_STORAGE_KEY_PREFIX = 'language-vocabulary-lesson-summaries-v1';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryFallbackStore = new Map<string, string>();
const sectionRuntimeCache = new Map<string, LessonVocabularySection[]>();
const summaryRuntimeCache = new Map<string, VocabularyLessonSummary[]>();
const storage = resolveStorage();

function resolveStorage(): StorageLike {
  if (typeof window !== 'undefined') {
    try {
      const webStorage = window.localStorage;
      return {
        async getItem(key: string) {
          return webStorage.getItem(key);
        },
        async setItem(key: string, value: string) {
          webStorage.setItem(key, value);
        },
      };
    } catch {
      // Fall through to native or memory storage.
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    if (asyncStorage?.getItem && asyncStorage?.setItem) {
      return asyncStorage as StorageLike;
    }
  } catch {
    // Fall through to memory storage.
  }

  return {
    async getItem(key: string) {
      return memoryFallbackStore.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      memoryFallbackStore.set(key, value);
    },
  };
}

function sectionKey(userId: string) {
  return `${SECTION_STORAGE_KEY_PREFIX}:${userId}`;
}

function summaryKey(userId: string) {
  return `${SUMMARY_STORAGE_KEY_PREFIX}:${userId}`;
}

export async function getCachedLessonVocabularySections(userId: string) {
  const cached = sectionRuntimeCache.get(userId);
  if (cached) return cached;
  const parsed = await readJson<LessonVocabularySection[]>(sectionKey(userId), []);
  sectionRuntimeCache.set(userId, parsed);
  return parsed;
}

export async function setCachedLessonVocabularySection(
  userId: string,
  section: LessonVocabularySection,
) {
  const sections = await getCachedLessonVocabularySections(userId);
  const next = [section, ...sections.filter((item) => item.lessonId !== section.lessonId)];
  sectionRuntimeCache.set(userId, next);
  await storage.setItem(sectionKey(userId), JSON.stringify(next));
  return next;
}

export async function getCachedVocabularyLessonSummaries(userId: string) {
  const cached = summaryRuntimeCache.get(userId);
  if (cached) return cached;
  const parsed = await readJson<VocabularyLessonSummary[]>(summaryKey(userId), []);
  summaryRuntimeCache.set(userId, parsed);
  return parsed;
}

export async function setCachedVocabularyLessonSummaries(
  userId: string,
  summaries: VocabularyLessonSummary[],
) {
  summaryRuntimeCache.set(userId, summaries);
  await storage.setItem(summaryKey(userId), JSON.stringify(summaries));
  return summaries;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
