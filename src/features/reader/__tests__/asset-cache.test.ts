import { apiClient } from '@/src/shared/api/client';
import { assetCacheKey, clearReaderAudio, readerAudio } from '../asset-cache';
import { fixture } from '../testing/fixture';
let mockPlatformOS = 'web';
const mockFiles = new Map<string, Uint8Array>();
jest.mock('react-native', () => ({ Platform: { get OS() { return mockPlatformOS; } } }));
jest.mock('@/src/config/env', () => ({ API_BASE_URL: 'http://localhost:4000/api' }));
jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    create() { mockFiles.set(this.uri, new Uint8Array()); }
    write(bytes: Uint8Array) { mockFiles.set(this.uri, bytes); }
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async (uri: string) => mockFiles.has(uri)
    ? { exists: true, isDirectory: false, size: mockFiles.get(uri)!.byteLength, uri }
    : { exists: false, isDirectory: false, uri }),
  deleteAsync: jest.fn(async (uri: string) => {
    if (uri.endsWith('/')) mockFiles.clear(); else mockFiles.delete(uri);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const value = mockFiles.get(from);
    if (!value) throw new Error('Missing source');
    mockFiles.set(to, value); mockFiles.delete(from);
  }),
}));
jest.mock('@/src/shared/api/client', () => ({ apiClient: { getReaderAudio: jest.fn(), getReaderAudioBytes: jest.fn() } }));
const fetchAudio = apiClient.getReaderAudio as jest.Mock;
const fetchAudioBytes = apiClient.getReaderAudioBytes as jest.Mock;
const asset = { ...fixture.narration, byteLength: 4 };
beforeEach(async () => {
  mockPlatformOS = 'web'; mockFiles.clear();
  URL.createObjectURL = jest.fn(() => 'blob:test-audio'); URL.revokeObjectURL = jest.fn();
  await clearReaderAudio(); fetchAudio.mockReset(); fetchAudioBytes.mockReset();
  fetchAudio.mockResolvedValue(new Blob(['RIFF'], { type: 'audio/wav' }));
  fetchAudioBytes.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));
});
it('deduplicates concurrent authenticated downloads without putting a token in the cache key', async () => {
  const result = await Promise.all([readerAudio('private-token', 'user-a', 'pub-a', asset), readerAudio('private-token', 'user-a', 'pub-a', asset)]);
  expect(result).toEqual(['blob:test-audio', 'blob:test-audio']);
  expect(fetchAudio).toHaveBeenCalledTimes(1);
  expect(fetchAudio).toHaveBeenCalledWith('private-token', 'pub-a', asset.id);
  expect(assetCacheKey('user-a', 'pub-a', asset)).not.toContain('private-token');
});
it('separates users, publications and audio revisions', () => {
  const key = assetCacheKey('user-a', 'pub-a', asset);
  expect(assetCacheKey('user-b', 'pub-a', asset)).not.toBe(key);
  expect(assetCacheKey('user-a', 'pub-b', asset)).not.toBe(key);
  expect(assetCacheKey('user-a', 'pub-a', { ...asset, sha256: 'new-hash' })).not.toBe(key);
});
it('never caches a truncated or non-audio response and allows a retry', async () => {
  fetchAudio.mockResolvedValueOnce(new Blob(['bad'], { type: 'text/html' }));
  await expect(readerAudio('token', 'user-a', 'pub-a', asset)).rejects.toThrow('incomplete');
  await expect(readerAudio('token', 'user-a', 'pub-a', asset)).resolves.toBe('blob:test-audio');
  expect(fetchAudio).toHaveBeenCalledTimes(2);
});
it('revokes private object URLs when the session ends', async () => {
  await readerAudio('token', 'user-a', 'pub-a', asset);
  await clearReaderAudio();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');
  await readerAudio('token', 'user-a', 'pub-a', asset);
  expect(fetchAudio).toHaveBeenCalledTimes(2);
});
it('writes and verifies authenticated audio bytes on native without relying on Blob metadata', async () => {
  mockPlatformOS = 'android';
  const uri = await readerAudio('private-token', 'user-a', 'pub-a', asset);
  expect(uri).toMatch(/^file:\/\/\/cache\/reader-v2\/.+\.wav$/);
  expect(fetchAudioBytes).toHaveBeenCalledWith('private-token', 'pub-a', asset.id);
  expect(fetchAudio).not.toHaveBeenCalled();
  expect(mockFiles.get(uri)).toEqual(new Uint8Array([82, 73, 70, 70]));
});
it('removes a truncated native download and allows a clean retry', async () => {
  mockPlatformOS = 'android';
  fetchAudioBytes
    .mockResolvedValueOnce(new Uint8Array([1, 2, 3]))
    .mockResolvedValueOnce(new Uint8Array([82, 73, 70, 70]));
  await expect(readerAudio('token', 'user-a', 'pub-a', asset)).rejects.toThrow('incomplete');
  await expect(readerAudio('token', 'user-a', 'pub-a', asset)).resolves.toMatch(/\.wav$/);
  expect(fetchAudioBytes).toHaveBeenCalledTimes(2);
});
