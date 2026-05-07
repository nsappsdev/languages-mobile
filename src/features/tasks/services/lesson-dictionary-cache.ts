import type { VocabularyEntry } from '@/src/types/domain';

const STORAGE_KEY_PREFIX = 'language-lesson-dict-v1';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryFallback = new Map<string, string>();
const runtimeCache = new Map<string, VocabularyEntry[]>();
const storage = resolveStorage();

function resolveWebStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const probeKey = `${STORAGE_KEY_PREFIX}:probe`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(): StorageLike {
  const web = resolveWebStorage();
  if (web) {
    return {
      async getItem(key) {
        return web.getItem(key);
      },
      async setItem(key, value) {
        web.setItem(key, value);
      },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    if (asyncStorage?.getItem && asyncStorage?.setItem) {
      return asyncStorage as StorageLike;
    }
  } catch {
    // memory fallback
  }

  return {
    async getItem(key) {
      return memoryFallback.get(key) ?? null;
    },
    async setItem(key, value) {
      memoryFallback.set(key, value);
    },
  };
}

function key(lessonId: string) {
  return `${STORAGE_KEY_PREFIX}:${lessonId}`;
}

export async function getCachedLessonDictionary(lessonId: string): Promise<VocabularyEntry[]> {
  const runtime = runtimeCache.get(lessonId);
  if (runtime) return runtime;

  try {
    const raw = await storage.getItem(key(lessonId));
    if (!raw) {
      runtimeCache.set(lessonId, []);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      runtimeCache.set(lessonId, []);
      return [];
    }
    runtimeCache.set(lessonId, parsed);
    return parsed;
  } catch {
    runtimeCache.set(lessonId, []);
    return [];
  }
}

export async function setCachedLessonDictionary(
  lessonId: string,
  entries: VocabularyEntry[],
): Promise<void> {
  runtimeCache.set(lessonId, entries);
  try {
    await storage.setItem(key(lessonId), JSON.stringify(entries));
  } catch {
    // best-effort
  }
}
