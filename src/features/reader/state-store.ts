import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/src/config/env';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { changeKey } from './model';
import type { ReaderChange } from './types';

type Store = { pending: ReaderChange[]; loaded: boolean; loading?: Promise<void>; flushing?: Promise<void>; error: string | null };
const stores = new Map<string, Store>();
let token: string | null = null;
let user: string | null = null;
let session = 0;
let lastTimestamp = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const storageKey = (id: string) => `reader-v2:${API_BASE_URL}:${id}`;
const storeFor = (id: string) => {
  if (!stores.has(id)) stores.set(id, { pending: [], loaded: false, error: null });
  return stores.get(id)!;
};
async function load(id: string) {
  const store = storeFor(id);
  if (!store.loaded) {
    store.loading ??= AsyncStorage.getItem(storageKey(id)).then(value => {
      store.pending = value ? JSON.parse(value) : [];
      store.loaded = true;
    }).catch(() => { store.loaded = true; store.error = 'Local reading progress could not be restored.'; });
    await store.loading;
  }
  return store;
}
export const readerTimestamp = () => { lastTimestamp = Math.max(Date.now(), lastTimestamp + 1); return new Date(lastTimestamp).toISOString(); };
export function subscribeReaderState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function readerSyncState(id: string) { const store = storeFor(id); return { pending: store.pending.length, error: store.error }; }
export async function pendingReaderChanges(id: string) { return [...(await load(id)).pending]; }

export function setReaderSession(nextToken: string | null, nextUser: string | null) {
  if (nextUser !== user) session++;
  token = nextToken; user = nextUser;
  if (user && token) void flushReaderChanges().catch(() => undefined);
}

export async function saveReaderChange(id: string, change: ReaderChange) {
  const store = await load(id);
  const previous = store.pending.find(item => changeKey(item) === changeKey(change));
  // A delayed pause cannot erase an already queued completion.
  if (change.kind === 'progress' && previous?.kind === 'progress' && previous.completed) change = { ...change, completed: true };
  store.pending = [...store.pending.filter(item => changeKey(item) !== changeKey(change)), change];
  try { await AsyncStorage.setItem(storageKey(id), JSON.stringify(store.pending)); }
  catch { store.error = 'Progress is held in memory. Keep this page open until it syncs.'; }
  notify();
  if (id === user) void flushReaderChanges().catch(() => undefined);
}

export async function flushReaderChanges() {
  if (!user || !token) return;
  const id = user;
  const currentSession = session;
  const store = await load(id);
  if (store.flushing) return store.flushing;
  store.flushing = (async () => {
    store.error = null;
    while (store.pending.length && user === id && currentSession === session && token) {
      const change = store.pending[0];
      try {
        await apiClient.saveReaderChange(token, change);
        store.pending = store.pending.filter(item => item !== change);
        await AsyncStorage.setItem(storageKey(id), JSON.stringify(store.pending));
      } catch (error) {
        store.error = error instanceof ApiError && [400, 404, 409].includes(error.status)
          ? 'A saved version is unavailable. Your pending changes are retained; retry after restoring access.'
          : 'Changes saved on this device. Retry when you are connected.';
        break;
      }
    }
  })().finally(() => { store.flushing = undefined; notify(); });
  notify();
  return store.flushing;
}
