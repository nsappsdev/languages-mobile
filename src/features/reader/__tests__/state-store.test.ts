import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/src/shared/api/client';
import { flushReaderChanges, pendingReaderChanges, readerTimestamp, saveReaderChange, setReaderSession } from '../state-store';
import type { ReaderChange } from '../types';
jest.mock('@/src/shared/api/client', () => ({ apiClient: { saveReaderChange: jest.fn() }, ApiError: class extends Error {} }));

const send = apiClient.saveReaderChange as jest.Mock;
const change = (occurrenceId = 'cat1'): ReaderChange => ({ kind: 'word', publicationId: 'publication', textReleaseId: 'release', occurrenceId, status: 'LEARNING', clientUpdatedAt: readerTimestamp() });
beforeEach(async () => { setReaderSession(null, null); send.mockReset(); send.mockResolvedValue({}); await AsyncStorage.clear(); });

it('coalesces retries per occurrence while retaining a repeated word as a separate entry', async () => {
  await saveReaderChange('user-1', change());
  await saveReaderChange('user-1', { ...change(), kind: 'word', occurrenceId: 'cat1', status: 'LEARNED' });
  await saveReaderChange('user-1', change('cat2'));
  expect(await pendingReaderChanges('user-1')).toHaveLength(2);
  setReaderSession('token-1', 'user-1'); await flushReaderChanges();
  expect(send).toHaveBeenCalledTimes(2);
  expect(await pendingReaderChanges('user-1')).toHaveLength(0);
});

it('retains failed writes for an explicit retry and never sends another user’s queue', async () => {
  await saveReaderChange('user-2', change());
  send.mockRejectedValueOnce(new Error('offline'));
  setReaderSession('token-2', 'user-2'); await flushReaderChanges();
  expect(await pendingReaderChanges('user-2')).toHaveLength(1);
  setReaderSession('token-3', 'user-3'); await flushReaderChanges();
  expect(send).toHaveBeenCalledTimes(1);
  setReaderSession('token-2', 'user-2'); await flushReaderChanges();
  expect(await pendingReaderChanges('user-2')).toHaveLength(0);
});

it('preserves a queued completion when a later blur saves the playback position', async () => {
  const base = { kind: 'progress' as const, publicationId: 'publication', textReleaseId: 'release', lastSample: 1000, clientUpdatedAt: readerTimestamp() };
  await saveReaderChange('user-4', { ...base, completed: true });
  await saveReaderChange('user-4', { ...base, lastSample: 600, clientUpdatedAt: readerTimestamp(), completed: false });
  expect((await pendingReaderChanges('user-4'))[0]).toMatchObject({ completed: true });
});

it('generates strictly ordered mutation timestamps even in the same millisecond', () => {
  const first = readerTimestamp(); const second = readerTimestamp(); expect(second > first).toBe(true);
});
