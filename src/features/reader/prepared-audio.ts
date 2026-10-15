import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { readerAudio } from './asset-cache';
import type { PlaybackStep } from './model';
import { createPlaybackTrack, decodeReaderWav, type PlaybackTrack } from './playback-track';

export type PreparedAudio = Omit<PlaybackTrack, 'parts'> & { uri: string; dispose: () => void };

export async function prepareAudio(steps: PlaybackStep[], pauseMs: number, token: string, userId: string,
  publicationId: string, signal: AbortSignal): Promise<PreparedAudio> {
  const check = () => { if (signal.aborted) throw new Error('Playback cancelled'); };
  check();
  const assets = [...new Map(steps.map(step => [step.asset.id, step.asset])).values()];
  const decoded = new Map<string, ReturnType<typeof decodeReaderWav>>();
  // Sequential reads bound peak allocation and give cancellation a chance
  // between assets. readerAudio retains authenticated, per-user cache checks.
  for (const asset of assets) {
    const uri = await readerAudio(token, userId, publicationId, asset);
    check();
    const bytes = Platform.OS === 'web' ? new Uint8Array(await (await fetch(uri, { signal })).arrayBuffer()) : await new File(uri).bytes();
    check();
    decoded.set(asset.id, decodeReaderWav(bytes));
  }
  const { parts, ...track } = createPlaybackTrack(steps, decoded, pauseMs);
  check();
  if (Platform.OS === 'web') {
    const uri = URL.createObjectURL(new Blob(parts as BlobPart[], { type: 'audio/wav' }));
    return { ...track, uri, dispose: () => URL.revokeObjectURL(uri) };
  }
  if (!FileSystem.cacheDirectory) throw new Error('Audio storage is unavailable on this device');
  // Keep temporary tracks inside the private cache cleared on logout, including
  // files left by an OS termination before normal playback cleanup could run.
  const root = `${FileSystem.cacheDirectory}reader-v2/`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  check();
  const file = new File(`${root}track-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  file.create();
  const handle = file.open();
  try {
    let writes = 0;
    for (const part of parts) for (let offset = 0; offset < part.length; offset += 256 * 1024) {
      check();
      handle.writeBytes(part.subarray(offset, offset + 256 * 1024));
      if (++writes % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    handle.close();
    check();
    if (file.size !== 44 + track.frameCount * 2) throw new Error('Prepared audio is incomplete');
    return { ...track, uri: file.uri, dispose: () => { if (file.exists) file.delete(); } };
  } catch (error) {
    try { handle.close(); } catch { /* Already closed. */ }
    if (file.exists) file.delete();
    throw error;
  }
}
