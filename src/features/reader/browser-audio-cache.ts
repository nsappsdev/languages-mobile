// Private, account-scoped audio only. Network authorization still comes from
// the current lesson manifest; tokens are never written to persistent storage.
const NAME = 'lezoo-reader-audio-v1';
const MAX_BYTES = 256 * 1024 * 1024;
let writes: Promise<unknown> = Promise.resolve();
const requestUrl = (key: string) => new URL(`/__reader_audio_cache__/${key}`, location.origin).href;
const available = () => typeof caches !== 'undefined' && typeof location !== 'undefined';

export async function readBrowserAudio(key: string, size: number): Promise<Blob | null> {
  if (!available()) return null;
  try {
    const cache = await caches.open(NAME);
    const response = await cache.match(requestUrl(key));
    if (!response) return null;
    const blob = await response.blob();
    if (blob.size === size && blob.type.startsWith('audio/')) return blob;
    await cache.delete(requestUrl(key));
  } catch { /* Restricted/private browser storage must not prevent playback. */ }
  return null;
}

export function saveBrowserAudio(key: string, blob: Blob, isCurrent: () => boolean) {
  if (!available()) return Promise.resolve();
  const job = writes.catch(() => undefined).then(async () => {
    if (!isCurrent()) return;
    const cache = await caches.open(NAME);
    if (!isCurrent()) return;
    await cache.put(requestUrl(key), new Response(blob, { headers: {
      'Content-Type': blob.type, 'Content-Length': String(blob.size), 'X-Cached-At': String(Date.now()),
    } }));
    if (!isCurrent()) { await cache.delete(requestUrl(key)); return; }
    const entries = await Promise.all((await cache.keys()).map(async request => {
      const response = await cache.match(request);
      return { request, size: Number(response?.headers.get('Content-Length') ?? 0), time: Number(response?.headers.get('X-Cached-At') ?? 0) };
    }));
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries.sort((a, b) => a.time - b.time)) {
      if (total <= MAX_BYTES) break;
      await cache.delete(entry.request); total -= entry.size;
    }
  }).catch(() => undefined); // Quota/storage failures fall back to memory.
  writes = job;
  return job;
}

export async function clearBrowserAudio() {
  if (!available()) return;
  await writes.catch(() => undefined);
  await caches.delete(NAME);
}
