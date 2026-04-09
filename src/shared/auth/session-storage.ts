import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const nativeSecureStore: SessionStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const asyncStorageStore: SessionStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const sessionStore: SessionStore =
  Platform.OS !== 'web'
    ? nativeSecureStore
    : (resolveWebStore() ?? asyncStorageStore);

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
