import { apiClient } from '@/src/shared/api/client';
import { assetCacheKey, clearReaderAudio, readerAudio } from '../asset-cache';
import { fixture } from '../testing/fixture';
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/src/config/env', () => ({ API_BASE_URL: 'http://localhost:4000/api' }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: null }));
jest.mock('@/src/shared/api/client', () => ({ apiClient: { getReaderAudio: jest.fn() } }));
const fetchAudio = apiClient.getReaderAudio as jest.Mock;
const asset = { ...fixture.narration, byteLength: 4 };
beforeEach(async () => {
  URL.createObjectURL = jest.fn(() => 'blob:test-audio'); URL.revokeObjectURL = jest.fn();
  await clearReaderAudio(); fetchAudio.mockReset();
  fetchAudio.mockResolvedValue(new Blob(['RIFF'], { type: 'audio/wav' }));
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
