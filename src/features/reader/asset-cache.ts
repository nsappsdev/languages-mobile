import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL } from '@/src/config/env';
import { apiClient } from '@/src/shared/api/client';
import type { ReaderAsset } from './types';
import { clearBrowserAudio, readBrowserAudio, saveBrowserAudio } from './browser-audio-cache';

const assets = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();
const memorySizes = new Map<string, { bytes: number; uri: string }>();
const MAX_MEMORY_BYTES = 96 * 1024 * 1024;
const MAX_DISK_BYTES = 256 * 1024 * 1024;
let maintenance: Promise<unknown> = Promise.resolve();
let epoch = 0;
const root = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}reader-v2/` : null;

export function assetCacheKey(userId: string, _publicationId: string, asset: ReaderAsset) {
  // A republish can keep the same immutable recording. Its verified manifest
  // grants access; storage identity depends on the account and recording bytes.
  return encodeURIComponent(`${API_BASE_URL}:${userId}:${asset.id}:${asset.sha256}`).replace(/%/g, '_');
}

export async function clearReaderAudio() {
  epoch++;
  assets.clear();
  memorySizes.clear();
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  await clearBrowserAudio();
  await maintenance.catch(() => undefined);
  if (Platform.OS !== 'web' && root) await FileSystem.deleteAsync(root, { idempotent: true });
}

function remember(key: string, uri: string, bytes: number) {
  memorySizes.delete(key); memorySizes.set(key, { uri, bytes });
  let total = [...memorySizes.values()].reduce((sum, item) => sum + item.bytes, 0);
  for (const [oldKey, item] of memorySizes) {
    if (total <= MAX_MEMORY_BYTES || memorySizes.size <= 3) break;
    assets.delete(oldKey); memorySizes.delete(oldKey); total -= item.bytes;
    if (item.uri.startsWith('blob:')) { URL.revokeObjectURL(item.uri); objectUrls.delete(item.uri); }
  }
}

function trimDisk(generation: number) {
  if (Platform.OS === 'web' || !root) return;
  maintenance = maintenance.catch(() => undefined).then(async () => {
    if (generation !== epoch) return;
    const files = await FileSystem.readDirectoryAsync(root);
    const entries = await Promise.all(files.filter(name => name.endsWith('.wav') && !name.startsWith('track-')).map(async name => {
      const uri = root + name; const info = await FileSystem.getInfoAsync(uri);
      return info.exists && !info.isDirectory ? { name, uri, size: info.size, time: info.modificationTime } : null;
    }));
    const present = entries.filter((item): item is NonNullable<typeof item> => !!item);
    let total = present.reduce((sum, item) => sum + item.size, 0);
    for (const item of present.sort((a, b) => a.time - b.time)) {
      if (total <= MAX_DISK_BYTES || generation !== epoch) break;
      if (assets.has(item.name.slice(0, -4))) continue;
      await FileSystem.deleteAsync(item.uri, { idempotent: true }); total -= item.size;
    }
  }).catch(() => undefined);
}

export async function readerAudio(token: string, userId: string, publicationId: string, asset: ReaderAsset): Promise<string> {
  const began = Date.now();
  let origin = 'network';
  const key = assetCacheKey(userId, publicationId, asset);
  const existing = assets.get(key);
  if (existing) {
    const held = memorySizes.get(key);
    if (held) { memorySizes.delete(key); memorySizes.set(key, held); }
    return existing;
  }
  const generation = epoch;
  const load = async () => {
    const target = root ? `${root}${key}.wav` : null;
    if (Platform.OS !== 'web' && target) {
      const info = await FileSystem.getInfoAsync(target);
      if (generation !== epoch) throw new Error('Session changed');
      if (info.exists && !info.isDirectory && info.size === asset.byteLength) { origin = 'device'; return target; }
    }
    if (Platform.OS === 'web') {
      const cached = await readBrowserAudio(key, asset.byteLength);
      if (cached) origin = 'browser';
      const blob = cached ?? await apiClient.getReaderAudio(token, publicationId, asset.id);
      if (generation !== epoch) throw new Error('Session changed');
      if (blob.size !== asset.byteLength || !blob.type.startsWith('audio/')) throw new Error('Audio download is incomplete. Try again.');
      const uri = URL.createObjectURL(blob);
      objectUrls.add(uri);
      if (!cached) void saveBrowserAudio(key, blob, () => generation === epoch);
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
  const promise = load().then(uri => {
    if (generation !== epoch) throw new Error('Session changed');
    if (__DEV__) console.info('[reader-audio] source', JSON.stringify({ assetId: asset.id, cache: origin, elapsedMs: Date.now() - began, bytes: asset.byteLength }));
    remember(key, uri, asset.byteLength); trimDisk(generation); return uri;
  }).catch(error => { assets.delete(key); throw error; });
  assets.set(key, promise);
  return promise;
}
