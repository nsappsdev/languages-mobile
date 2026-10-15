import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '@/src/config/env';
import { apiClient } from '@/src/shared/api/client';
import type { ReaderAsset } from './types';

const assets = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();
let epoch = 0;
const root = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}reader-v2/` : null;

export function assetCacheKey(userId: string, publicationId: string, asset: ReaderAsset) {
  return encodeURIComponent(`${API_BASE_URL}:${userId}:${publicationId}:${asset.id}:${asset.sha256}`).replace(/%/g, '_');
}

export async function clearReaderAudio() {
  epoch++;
  assets.clear();
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  if (Platform.OS !== 'web' && root) await FileSystem.deleteAsync(root, { idempotent: true });
}

export async function readerAudio(token: string, userId: string, publicationId: string, asset: ReaderAsset): Promise<string> {
  const key = assetCacheKey(userId, publicationId, asset);
  const existing = assets.get(key);
  if (existing) return existing;
  const generation = epoch;
  const load = async () => {
    const target = root ? `${root}${key}.wav` : null;
    if (Platform.OS !== 'web' && target) {
      const info = await FileSystem.getInfoAsync(target);
      if (generation !== epoch) throw new Error('Session changed');
      if (info.exists && !info.isDirectory && info.size === asset.byteLength) return target;
    }
    if (Platform.OS === 'web') {
      const blob = await apiClient.getReaderAudio(token, publicationId, asset.id);
      if (generation !== epoch) throw new Error('Session changed');
      if (blob.size !== asset.byteLength || !blob.type.startsWith('audio/')) throw new Error('Audio download is incomplete. Try again.');
      const uri = URL.createObjectURL(blob);
      objectUrls.add(uri);
      return uri;
    }
    if (!root || !target) throw new Error('Audio storage is unavailable on this device');
    const bytes = await apiClient.getReaderAudioBytes(token, publicationId, asset.id);
    if (generation !== epoch) throw new Error('Session changed');
    if (bytes.byteLength !== asset.byteLength) throw new Error('Audio download is incomplete. Try again.');
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    const temporary = `${target}.partial`;
    await FileSystem.deleteAsync(temporary, { idempotent: true });
    const temporaryFile = new File(temporary);
    temporaryFile.create();
    temporaryFile.write(bytes);
    const downloaded = await FileSystem.getInfoAsync(temporary);
    if (!downloaded.exists || downloaded.isDirectory || downloaded.size !== asset.byteLength) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw new Error('Audio download is incomplete. Try again.');
    }
    if (generation !== epoch) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw new Error('Session changed');
    }
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: target });
    return target;
  };
  const promise = load().catch(error => { assets.delete(key); throw error; });
  assets.set(key, promise);
  return promise;
}
