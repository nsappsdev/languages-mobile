import type { LearnerVocabularyItem } from '@/src/types/domain';

const STORAGE_KEY_PREFIX = 'language-vocabulary-sync-v1';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryFallbackStore = new Map<string, string>();
const runtimeCacheByUser = new Map<string, LearnerVocabularyItem[]>();
const storage = resolveStorage();

function resolveWebStorage():
  | {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
    }
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const webStorage = window.localStorage;
    const probeKey = `${STORAGE_KEY_PREFIX}:probe`;
    webStorage.setItem(probeKey, '1');
    webStorage.removeItem(probeKey);
    return webStorage;
  } catch {
    return null;
  }
}

function resolveStorage(): StorageLike {
  const webStorage = resolveWebStorage();
  if (webStorage) {
    return {
      async getItem(key: string) {
        return webStorage.getItem(key);
      },
      async setItem(key: string, value: string) {
        webStorage.setItem(key, value);
      },
    };
  }

  try {
    // Optional runtime dependency in React Native builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    if (asyncStorage?.getItem && asyncStorage?.setItem) {
      return asyncStorage as StorageLike;
    }
  } catch {
    // fall through to memory fallback
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

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeList(items: LearnerVocabularyItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? left.addedAt ?? '1970-01-01T00:00:00.000Z');
    const rightTime = Date.parse(right.updatedAt ?? right.addedAt ?? '1970-01-01T00:00:00.000Z');
    return rightTime - leftTime;
  });
}

function sanitizeVocabularyArray(value: unknown): LearnerVocabularyItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is LearnerVocabularyItem => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const record = item as Record<string, unknown>;
    const entry = record.entry as Record<string, unknown> | undefined;

    return (
      typeof record.id === 'string' &&
      typeof record.userId === 'string' &&
      typeof record.entryId === 'string' &&
      typeof record.status === 'string' &&
      typeof record.addedAt === 'string' &&
      typeof record.updatedAt === 'string' &&
      Boolean(entry) &&
      typeof entry?.id === 'string' &&
      typeof entry?.englishText === 'string' &&
      Array.isArray(entry?.translations)
    );
  });
}

async function persist(userId: string, items: LearnerVocabularyItem[]) {
  await storage.setItem(getStorageKey(userId), JSON.stringify(items));
}

export async function getCachedVocabulary(userId: string): Promise<LearnerVocabularyItem[]> {
  const runtimeCached = runtimeCacheByUser.get(userId);
  if (runtimeCached) {
    return runtimeCached;
  }

  try {
    const raw = await storage.getItem(getStorageKey(userId));
    if (!raw) {
      runtimeCacheByUser.set(userId, []);
      return [];
    }

    const parsed = sanitizeVocabularyArray(JSON.parse(raw) as unknown);
    const normalized = normalizeList(parsed);
    runtimeCacheByUser.set(userId, normalized);
    return normalized;
  } catch {
    runtimeCacheByUser.set(userId, []);
    return [];
  }
}

export async function setCachedVocabulary(
  userId: string,
  items: LearnerVocabularyItem[],
): Promise<LearnerVocabularyItem[]> {
  const normalized = normalizeList(items);
  runtimeCacheByUser.set(userId, normalized);
  await persist(userId, normalized);
  return normalized;
}

export async function mergeCachedVocabulary(
  userId: string,
  incomingItems: LearnerVocabularyItem[],
): Promise<LearnerVocabularyItem[]> {
  const existing = await getCachedVocabulary(userId);
  const byId = new Map(existing.map((item) => [item.id, item]));

  for (const incoming of incomingItems) {
    byId.set(incoming.id, incoming);
  }

  return setCachedVocabulary(userId, Array.from(byId.values()));
}
