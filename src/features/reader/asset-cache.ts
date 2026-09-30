import { Platform } from 'react-native';
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
    const blob = await apiClient.getReaderAudio(token, publicationId, asset.id);
    if (generation !== epoch) throw new Error('Session changed');
    if (blob.size !== asset.byteLength || !blob.type.startsWith('audio/')) throw new Error('Audio download is incomplete. Try again.');
    if (Platform.OS === 'web') {
      const uri = URL.createObjectURL(blob);
      objectUrls.add(uri);
      return uri;
    }
    if (!root || !target) throw new Error('Audio storage is unavailable on this device');
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Unable to read downloaded audio'));
      reader.readAsDataURL(blob);
    });
    if (generation !== epoch) throw new Error('Session changed');
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    const temporary = `${target}.partial`;
    await FileSystem.writeAsStringAsync(temporary, base64, { encoding: FileSystem.EncodingType.Base64 });
    if (generation !== epoch) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw new Error('Session changed');
    }
    await FileSystem.moveAsync({ from: temporary, to: target });
    return target;
  };
  const promise = load().catch(error => { assets.delete(key); throw error; });
  assets.set(key, promise);
  return promise;
}
