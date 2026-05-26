import type {
  LessonVocabularyPayload,
  LessonVocabularyReviewState,
  LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';

const SECTION_STORAGE_KEY_PREFIX = 'language-lesson-vocabulary-sections-v1';
const STATE_STORAGE_KEY_PREFIX = 'language-lesson-vocabulary-review-state-v1';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryFallbackStore = new Map<string, string>();
const sectionRuntimeCache = new Map<string, LessonVocabularySection[]>();
const stateRuntimeCache = new Map<string, LessonVocabularyReviewState[]>();
const payloadRuntimeCache = new Map<string, Record<string, LessonVocabularyPayload>>();
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
    const probeKey = `${SECTION_STORAGE_KEY_PREFIX}:probe`;
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

function sectionKey(userId: string) {
  return `${SECTION_STORAGE_KEY_PREFIX}:${userId}`;
}

function stateKey(userId: string) {
  return `${STATE_STORAGE_KEY_PREFIX}:${userId}`;
}

function payloadKey(userId: string) {
  return `${SECTION_STORAGE_KEY_PREFIX}:payload:${userId}`;
}

export async function getCachedLessonVocabularySections(
  userId: string,
): Promise<LessonVocabularySection[]> {
  const cached = sectionRuntimeCache.get(userId);
  if (cached) return cached;

  const parsed = await readJson<LessonVocabularySection[]>(sectionKey(userId), []);
  sectionRuntimeCache.set(userId, parsed);
  return parsed;
}

export async function setCachedLessonVocabularySections(
  userId: string,
  sections: LessonVocabularySection[],
) {
  sectionRuntimeCache.set(userId, sections);
  await storage.setItem(sectionKey(userId), JSON.stringify(sections));
  return sections;
}

export async function getCachedLessonVocabularyPayloads(
  userId: string,
): Promise<Record<string, LessonVocabularyPayload>> {
  const cached = payloadRuntimeCache.get(userId);
  if (cached) return cached;

  const parsed = await readJson<Record<string, LessonVocabularyPayload>>(payloadKey(userId), {});
  payloadRuntimeCache.set(userId, parsed);
  return parsed;
}

export async function setCachedLessonVocabularyPayloads(
  userId: string,
  payloads: Record<string, LessonVocabularyPayload>,
) {
  payloadRuntimeCache.set(userId, payloads);
  await storage.setItem(payloadKey(userId), JSON.stringify(payloads));
  return payloads;
}

export async function getVocabularyReviewStates(
  userId: string,
): Promise<LessonVocabularyReviewState[]> {
  const cached = stateRuntimeCache.get(userId);
  if (cached) return cached;

  const parsed = await readJson<LessonVocabularyReviewState[]>(stateKey(userId), []);
  stateRuntimeCache.set(userId, parsed);
  return parsed;
}

export async function setVocabularyReviewState(
  userId: string,
  state: LessonVocabularyReviewState,
) {
  const states = await getVocabularyReviewStates(userId);
  const next = [state, ...states.filter((item) => item.entryId !== state.entryId)];
  stateRuntimeCache.set(userId, next);
  await storage.setItem(stateKey(userId), JSON.stringify(next));
  return next;
}

export async function markVocabularyReviewStateSynced(userId: string, entryId: string) {
  const states = await getVocabularyReviewStates(userId);
  const next = states.map((state) =>
    state.entryId === entryId ? { ...state, pending: false } : state,
  );
  stateRuntimeCache.set(userId, next);
  await storage.setItem(stateKey(userId), JSON.stringify(next));
  return next;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
