import { AppState } from 'react-native';
import { apiClient } from '@/src/shared/api/client';
import { mergeCachedVocabulary } from '@/src/features/vocabulary/services/vocabulary-sync';
import type { LearnerVocabularyStatus } from '@/src/types/domain';

const STORAGE_KEY_PREFIX = 'language-vocabulary-status-sync-v1';
const BATCH_SIZE = 20;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;

export type QueuedStatusUpdate = {
  entryId: string;
  status: LearnerVocabularyStatus;
  queuedAt: number;
};

type FlushResult = {
  ok: boolean;
  pending: number;
  message?: string;
};

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let queue: QueuedStatusUpdate[] = [];
let isStorageLoaded = false;
let loadedStorageKey: string | null = null;
let isFlushing = false;
let activeToken: string | null = null;
let activeUserId: string | null = null;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let hasAppStateListener = false;
const memoryFallbackStore = new Map<string, string>();

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default;
    if (asyncStorage?.getItem && asyncStorage?.setItem) {
      return asyncStorage as StorageLike;
    }
  } catch {
    // fall through
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

function getStorageKeyForUser(userId: string | null) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

async function readQueue(key: string): Promise<QueuedStatusUpdate[]> {
  const raw = await storage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as QueuedStatusUpdate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function ensureStorageLoaded() {
  const targetStorageKey = getStorageKeyForUser(activeUserId);
  if (isStorageLoaded && loadedStorageKey === targetStorageKey) {
    return;
  }

  if (loadedStorageKey) {
    await storage.setItem(loadedStorageKey, JSON.stringify(queue));
  }

  queue = await readQueue(targetStorageKey);
  loadedStorageKey = targetStorageKey;
  isStorageLoaded = true;
}

async function persistQueue() {
  await ensureStorageLoaded();
  if (!loadedStorageKey) return;
  await storage.setItem(loadedStorageKey, JSON.stringify(queue));
}

function ensureForegroundFlushListener() {
  if (hasAppStateListener) return;
  if (typeof AppState?.addEventListener !== 'function') return;
  hasAppStateListener = true;

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void flushVocabularyStatusQueue({ force: true });
    }
  });
}

async function isNetworkConnected() {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const networkModule = require('expo-network') as {
      getNetworkStateAsync?: () => Promise<{
        isConnected?: boolean;
        isInternetReachable?: boolean | null;
      }>;
    };
    if (networkModule?.getNetworkStateAsync) {
      const state = await networkModule.getNetworkStateAsync();
      if (state.isConnected === false) return false;
      if (state.isInternetReachable === false) return false;
    }
  } catch {
    // default optimistic
  }

  return true;
}

function scheduleRetry() {
  if (!activeToken || retryTimer) return;

  const exponent = Math.min(retryAttempt, 5);
  const delayBase = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
  const jitter = Math.floor(Math.random() * 500);
  const delay = Math.min(RETRY_MAX_DELAY_MS, delayBase + jitter);

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushVocabularyStatusQueue({ force: false });
  }, delay);
}

function clearRetryState() {
  retryAttempt = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function dedupeLatestPerEntry(items: QueuedStatusUpdate[]): QueuedStatusUpdate[] {
  const latestByEntry = new Map<string, QueuedStatusUpdate>();
  for (const item of items) {
    const existing = latestByEntry.get(item.entryId);
    if (!existing || existing.queuedAt <= item.queuedAt) {
      latestByEntry.set(item.entryId, item);
    }
  }
  return Array.from(latestByEntry.values());
}

export async function setVocabularyStatusSyncSession(input: {
  token: string | null;
  userId: string | null;
}) {
  activeToken = input.token;
  activeUserId = input.userId;
  ensureForegroundFlushListener();
  await ensureStorageLoaded();

  if (!activeToken) {
    await persistQueue();
    clearRetryState();
    return;
  }

  void flushVocabularyStatusQueue({ force: false });
}

export async function queueVocabularyStatusUpdate(
  input: { entryId: string; status: LearnerVocabularyStatus },
): Promise<FlushResult> {
  try {
    await ensureStorageLoaded();

    const now = Date.now();
    queue = queue.filter((item) => item.entryId !== input.entryId);
    queue.push({ entryId: input.entryId, status: input.status, queuedAt: now });

    await persistQueue();

    if (queue.length >= BATCH_SIZE) {
      return flushVocabularyStatusQueue({ force: false });
    }

    return { ok: true, pending: queue.length };
  } catch (error) {
    return {
      ok: false,
      pending: queue.length,
      message:
        error instanceof Error ? error.message : 'Failed to persist vocabulary status queue.',
    };
  }
}

export async function flushVocabularyStatusQueue(options: {
  force: boolean;
}): Promise<FlushResult> {
  await ensureStorageLoaded();

  if (!activeToken) {
    return {
      ok: false,
      pending: queue.length,
      message: 'No active session token for vocabulary sync.',
    };
  }
  if (!queue.length) {
    clearRetryState();
    return { ok: true, pending: 0 };
  }
  if (!options.force && queue.length < BATCH_SIZE) {
    return { ok: true, pending: queue.length };
  }
  if (isFlushing) {
    return {
      ok: false,
      pending: queue.length,
      message: 'Vocabulary sync already in progress.',
    };
  }

  const connected = await isNetworkConnected();
  if (!connected) {
    retryAttempt += 1;
    scheduleRetry();
    return {
      ok: false,
      pending: queue.length,
      message: 'Offline. Vocabulary status will sync when online.',
    };
  }

  isFlushing = true;
  const tokenAtFlushStart = activeToken;
  const userIdAtFlushStart = activeUserId;
  try {
    while (queue.length > 0) {
      const size = options.force ? Math.min(queue.length, BATCH_SIZE) : BATCH_SIZE;
      if (!options.force && queue.length < BATCH_SIZE) break;

      const batch = dedupeLatestPerEntry(queue.slice(0, size));
      const response = await apiClient.updateVocabularyStatusBulk(
        tokenAtFlushStart,
        batch.map((item) => ({ entryId: item.entryId, status: item.status })),
      );

      if (userIdAtFlushStart && response.vocabulary.length > 0) {
        await mergeCachedVocabulary(userIdAtFlushStart, response.vocabulary);
      }

      queue = queue.slice(size);
      await persistQueue();
      clearRetryState();

      if (!options.force) break;
    }

    return { ok: true, pending: queue.length };
  } catch (error) {
    retryAttempt += 1;
    scheduleRetry();
    return {
      ok: false,
      pending: queue.length,
      message:
        error instanceof Error ? error.message : 'Failed to sync vocabulary status updates.',
    };
  } finally {
    isFlushing = false;
  }
}
