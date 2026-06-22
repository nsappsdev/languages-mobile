import { AppState } from 'react-native';
import { apiClient } from '@/src/shared/api/client';
import {
  resolveWebStorage,
  type StorageLike,
} from '@/src/shared/storage/web-storage';
import type { VocabularyReviewEvent } from '@/src/types/domain';

const STORAGE_KEY_PREFIX = 'language-vocabulary-review-events-v1';

type SyncResult = {
  ok: boolean;
  pending: number;
  message?: string;
};

let queue: VocabularyReviewEvent[] = [];
let loadedKey: string | null = null;
let activeToken: string | null = null;
let activeUserId: string | null = null;
let isFlushing = false;
let hasAppStateListener = false;
const memoryFallbackStore = new Map<string, string>();
const storage = resolveStorage();

function resolveStorage(): StorageLike {
  const webStorage = resolveWebStorage();
  if (webStorage) return webStorage;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorageModule = require('@react-native-async-storage/async-storage');
    const asyncStorage = asyncStorageModule.default ?? asyncStorageModule;
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

function storageKey(userId: string | null) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

async function ensureLoaded() {
  const nextKey = storageKey(activeUserId);
  if (loadedKey === nextKey) return;
  if (loadedKey) {
    await storage.setItem(loadedKey, JSON.stringify(queue));
  }

  loadedKey = nextKey;
  try {
    const raw = await storage.getItem(nextKey);
    const parsed = raw ? (JSON.parse(raw) as VocabularyReviewEvent[]) : [];
    queue = Array.isArray(parsed) ? parsed : [];
  } catch {
    queue = [];
  }
}

async function persist() {
  await ensureLoaded();
  if (loadedKey) {
    await storage.setItem(loadedKey, JSON.stringify(queue));
  }
}

function ensureForegroundListener() {
  if (hasAppStateListener || typeof AppState?.addEventListener !== 'function') return;
  hasAppStateListener = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void flushVocabularyReviewQueue();
    }
  });
}

export async function setVocabularyReviewSyncSession(input: {
  token: string | null;
  userId: string | null;
}) {
  activeToken = input.token;
  activeUserId = input.userId;
  ensureForegroundListener();
  await ensureLoaded();
  if (activeToken) {
    void flushVocabularyReviewQueue();
  }
}

export async function getPendingVocabularyReviewEvents(userId: string) {
  if (activeUserId !== userId) {
    activeUserId = userId;
  }
  await ensureLoaded();
  return [...queue];
}

export async function queueVocabularyReviewDecision(
  event: VocabularyReviewEvent,
): Promise<SyncResult> {
  await ensureLoaded();
  if (!queue.some((item) => item.idempotencyKey === event.idempotencyKey)) {
    queue.push(event);
    await persist();
  }
  return flushVocabularyReviewQueue();
}

export async function flushVocabularyReviewQueue(): Promise<SyncResult> {
  await ensureLoaded();
  if (!activeToken) {
    return {
      ok: false,
      pending: queue.length,
      message: 'Review changes are saved on this device and will sync after sign in.',
    };
  }
  if (isFlushing) {
    return { ok: true, pending: queue.length };
  }

  isFlushing = true;
  try {
    while (queue.length > 0) {
      const event = queue[0];
      await apiClient.reviewLessonVocabulary(
        activeToken,
        event.lessonId,
        event.entryId,
        event.decision,
        event.idempotencyKey,
      );
      queue = queue.slice(1);
      await persist();
    }
    return { ok: true, pending: 0 };
  } catch (error) {
    return {
      ok: false,
      pending: queue.length,
      message:
        error instanceof Error
          ? error.message
          : 'Review changes are saved locally and will retry automatically.',
    };
  } finally {
    isFlushing = false;
  }
}
