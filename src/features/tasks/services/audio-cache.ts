import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const AUDIO_CACHE_DIR = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}lesson-audio/`
  : null;

async function ensureAudioCacheDir() {
  if (!AUDIO_CACHE_DIR) {
    return null;
  }

  const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
  }

  return AUDIO_CACHE_DIR;
}

function buildCacheFileName(sourceUrl: string) {
  const extensionMatch = sourceUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? 'bin';
  const encoded = encodeURIComponent(sourceUrl).replace(/%/g, '_');
  return `${encoded}.${extension}`;
}

export async function ensureAudioCached(sourceUrl: string) {
  if (!sourceUrl.trim() || Platform.OS === 'web') {
    return sourceUrl;
  }

  const cacheDir = await ensureAudioCacheDir();
  if (!cacheDir) {
    return sourceUrl;
  }

  const targetUri = `${cacheDir}${buildCacheFileName(sourceUrl)}`;
  const fileInfo = await FileSystem.getInfoAsync(targetUri);
  if (fileInfo.exists && !fileInfo.isDirectory && (fileInfo.size ?? 0) > 0) {
    return targetUri;
  }

  const download = await FileSystem.downloadAsync(sourceUrl, targetUri);
  return download.uri;
}

export async function prefetchAudio(sourceUrl: string) {
  try {
    return await ensureAudioCached(sourceUrl);
  } catch {
    return null;
  }
}
