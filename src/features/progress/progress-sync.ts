import { AppState } from 'react-native';
import { apiClient } from '@/src/shared/api/client';
import type { ProgressEvent } from '@/src/types/domain';

const STORAGE_KEY_PREFIX = 'language-progress-events-v1';
const BATCH_SIZE = 20;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;

type FlushResult = {
  ok: boolean;
  pending: number;
  message?: string;
};

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let queue: ProgressEvent[] = [];
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

function getStorageKeyForUser(userId: string | null) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

async function readQueue(key: string) {
  const raw = await storage.getItem(key);
  if (!raw) return [] as ProgressEvent[];

  try {
    const parsed = JSON.parse(raw) as ProgressEvent[];
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
      void flushProgressQueue({ force: true });
    }
  });
}

async function isNetworkConnected() {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return false;
  }

  try {
    // Optional runtime dependency in React Native builds.
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
    // Ignore and default to optimistic behavior.
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
    void flushProgressQueue({ force: false });
  }, delay);
}

function clearRetryState() {
  retryAttempt = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export async function setProgressSyncSession(input: {
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

  void flushProgressQueue({ force: false });
}

export async function queueProgressEvents(events: ProgressEvent[]): Promise<FlushResult> {
  try {
    await ensureStorageLoaded();

    if (!events.length) {
      return { ok: true, pending: queue.length };
    }

    const existingKeys = new Set(queue.map((event) => event.idempotencyKey));
    for (const event of events) {
      if (!existingKeys.has(event.idempotencyKey)) {
        queue.push(event);
        existingKeys.add(event.idempotencyKey);
      }
    }

    await persistQueue();

    if (queue.length >= BATCH_SIZE) {
      return flushProgressQueue({ force: false });
    }

    return { ok: true, pending: queue.length };
  } catch (error) {
    return {
      ok: false,
      pending: queue.length,
      message: error instanceof Error ? error.message : 'Failed to persist progress queue.',
    };
  }
}

export async function flushProgressQueue(options: { force: boolean }): Promise<FlushResult> {
  await ensureStorageLoaded();
  if (!activeToken) {
    return { ok: false, pending: queue.length, message: 'No active session token for progress sync.' };
  }
  if (!queue.length) {
    clearRetryState();
    return { ok: true, pending: 0 };
  }
  if (!options.force && queue.length < BATCH_SIZE) {
    return { ok: true, pending: queue.length };
  }
  if (isFlushing) {
    return { ok: false, pending: queue.length, message: 'Progress sync already in progress.' };
  }

  const connected = await isNetworkConnected();
  if (!connected) {
    retryAttempt += 1;
    scheduleRetry();
    return { ok: false, pending: queue.length, message: 'Offline. Progress will sync when online.' };
  }

  isFlushing = true;
  try {
    while (queue.length > 0) {
      const size = options.force ? Math.min(queue.length, BATCH_SIZE) : BATCH_SIZE;
      if (!options.force && queue.length < BATCH_SIZE) break;

      const batch = queue.slice(0, size);
      await apiClient.sendProgressEvents(activeToken, batch);
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
      message: error instanceof Error ? error.message : 'Failed to sync progress events.',
    };
  } finally {
    isFlushing = false;
  }
}
