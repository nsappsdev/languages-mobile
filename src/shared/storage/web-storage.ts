export type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function createWebStorageAdapter(
  candidate: WebStorageLike | null | undefined,
): StorageLike | null {
  if (
    !candidate ||
    typeof candidate.getItem !== 'function' ||
    typeof candidate.setItem !== 'function'
  ) {
    return null;
  }

  return {
    async getItem(key: string) {
      return candidate.getItem(key);
    },
    async setItem(key: string, value: string) {
      candidate.setItem(key, value);
    },
  };
}

export function resolveWebStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;

  try {
    return createWebStorageAdapter(window.localStorage);
  } catch {
    return null;
  }
}
