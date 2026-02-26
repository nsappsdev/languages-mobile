const STORAGE_KEY_PREFIX = 'language-lesson-progression-v1';

export interface LessonProgressState {
  completedLessonIds: string[];
  activeLessonId: string | null;
  updatedAt: string;
}

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

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

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function createDefaultState(): LessonProgressState {
  return {
    completedLessonIds: [],
    activeLessonId: null,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeState(value: unknown): LessonProgressState {
  if (!value || typeof value !== 'object') {
    return createDefaultState();
  }

  const record = value as Record<string, unknown>;
  const completedRaw = Array.isArray(record.completedLessonIds)
    ? record.completedLessonIds
    : [];
  const completedLessonIds = completedRaw.filter(
    (lessonId): lessonId is string => typeof lessonId === 'string' && lessonId.length > 0,
  );
  const activeLessonId =
    typeof record.activeLessonId === 'string' && record.activeLessonId.length > 0
      ? record.activeLessonId
      : null;
  const updatedAt =
    typeof record.updatedAt === 'string' && record.updatedAt.length > 0
      ? record.updatedAt
      : new Date().toISOString();

  return {
    completedLessonIds: Array.from(new Set(completedLessonIds)),
    activeLessonId,
    updatedAt,
  };
}

async function readState(userId: string): Promise<LessonProgressState> {
  try {
    const raw = await storage.getItem(getStorageKey(userId));
    if (!raw) {
      return createDefaultState();
    }

    return sanitizeState(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultState();
  }
}

async function writeState(userId: string, state: LessonProgressState) {
  await storage.setItem(getStorageKey(userId), JSON.stringify(state));
}

export async function getLessonProgressState(userId: string): Promise<LessonProgressState> {
  return readState(userId);
}

export async function setActiveLesson(userId: string, lessonId: string): Promise<LessonProgressState> {
  const current = await readState(userId);
  const next: LessonProgressState = {
    ...current,
    activeLessonId: lessonId,
    updatedAt: new Date().toISOString(),
  };
  await writeState(userId, next);
  return next;
}

export async function markLessonCompleted(
  userId: string,
  lessonId: string,
): Promise<LessonProgressState> {
  const current = await readState(userId);
  const next: LessonProgressState = {
    completedLessonIds: Array.from(new Set([...current.completedLessonIds, lessonId])),
    activeLessonId: current.activeLessonId === lessonId ? null : current.activeLessonId,
    updatedAt: new Date().toISOString(),
  };
  await writeState(userId, next);
  return next;
}
