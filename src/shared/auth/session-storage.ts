import { Platform } from 'react-native';
import type { User } from '@/src/types/domain';

const SESSION_STORAGE_KEY = 'language-auth-session-v1';

type PersistedSession = {
  token: string;
  refreshToken: string | null;
  user: User;
};

type SessionStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryFallbackStore = new Map<string, string>();

function resolveWebStore(): SessionStore | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = `${SESSION_STORAGE_KEY}:probe`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);

    return {
      async getItem(key: string) {
        return storage.getItem(key);
      },
      async setItem(key: string, value: string) {
        storage.setItem(key, value);
      },
      async removeItem(key: string) {
        storage.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}

function resolveNativeSecureStore(): SessionStore | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // Optional runtime dependency. If unavailable, fallback storage is used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secureStore = require('expo-secure-store') as {
      getItemAsync?: (key: string) => Promise<string | null>;
      setItemAsync?: (key: string, value: string) => Promise<void>;
      deleteItemAsync?: (key: string) => Promise<void>;
    };

    if (
      secureStore?.getItemAsync &&
      secureStore?.setItemAsync &&
      secureStore?.deleteItemAsync
    ) {
      return {
        getItem(key: string) {
          return secureStore.getItemAsync!(key);
        },
        setItem(key: string, value: string) {
          return secureStore.setItemAsync!(key, value);
        },
        removeItem(key: string) {
          return secureStore.deleteItemAsync!(key);
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}

function resolveAsyncStorageStore(): SessionStore | null {
  try {
    // Optional runtime dependency fallback when secure storage is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default as {
      getItem?: (key: string) => Promise<string | null>;
      setItem?: (key: string, value: string) => Promise<void>;
      removeItem?: (key: string) => Promise<void>;
    };

    if (asyncStorage?.getItem && asyncStorage?.setItem && asyncStorage?.removeItem) {
      return {
        getItem(key: string) {
          return asyncStorage.getItem!(key);
        },
        setItem(key: string, value: string) {
          return asyncStorage.setItem!(key, value);
        },
        removeItem(key: string) {
          return asyncStorage.removeItem!(key);
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}

const fallbackStore: SessionStore = {
  async getItem(key: string) {
    return memoryFallbackStore.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    memoryFallbackStore.set(key, value);
  },
  async removeItem(key: string) {
    memoryFallbackStore.delete(key);
  },
};

const sessionStore =
  resolveNativeSecureStore() ??
  resolveWebStore() ??
  resolveAsyncStorageStore() ??
  fallbackStore;

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | undefined;

  return (
    typeof record.token === 'string' &&
    Boolean(record.token) &&
    (typeof record.refreshToken === 'string' ||
      record.refreshToken === null ||
      record.refreshToken === undefined) &&
    Boolean(user) &&
    typeof user?.id === 'string' &&
    typeof user?.email === 'string' &&
    typeof user?.name === 'string' &&
    typeof user?.role === 'string'
  );
}

export async function savePersistedSession(session: PersistedSession): Promise<void> {
  try {
    await sessionStore.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Swallow storage errors to avoid blocking auth state changes.
  }
}

export async function loadPersistedSession(): Promise<PersistedSession | null> {
  try {
    const raw = await sessionStore.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isPersistedSession(parsed)) {
      return {
        ...parsed,
        refreshToken:
          typeof parsed.refreshToken === 'string' && parsed.refreshToken.length > 0
            ? parsed.refreshToken
            : null,
      };
    }

    await sessionStore.removeItem(SESSION_STORAGE_KEY);
    return null;
  } catch {
    await clearPersistedSession();
    return null;
  }
}

export async function clearPersistedSession(): Promise<void> {
  try {
    await sessionStore.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
}
