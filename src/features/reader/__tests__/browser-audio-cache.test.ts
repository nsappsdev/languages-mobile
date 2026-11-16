import { clearBrowserAudio, readBrowserAudio, saveBrowserAudio } from '../browser-audio-cache';

const entries = new Map<string, Response>();
const url = (request: RequestInfo) => typeof request === 'string' ? request : request.url;
const cache = {
  match: jest.fn(async (request: RequestInfo) => entries.get(url(request))?.clone()),
  put: jest.fn(async (request: RequestInfo, response: Response) => { entries.set(url(request), response); }),
  delete: jest.fn(async (request: RequestInfo) => entries.delete(url(request))),
  keys: jest.fn(async () => [...entries.keys()].map(key => ({ url: key }))),
};
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
beforeEach(() => {
  entries.clear(); jest.clearAllMocks();
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'http://localhost:8090' } });
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { open: jest.fn(async () => cache), delete: jest.fn(async () => { entries.clear(); return true; }) } });
});
afterAll(() => {
  if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches); else Reflect.deleteProperty(globalThis, 'caches');
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation); else Reflect.deleteProperty(globalThis, 'location');
});
it('persists an audio response so a fresh page can read it without downloading', async () => {
  const blob = new Blob(['RIFF'], { type: 'audio/wav' });
  await saveBrowserAudio('user-and-hash', blob, () => true);
  const saved = await readBrowserAudio('user-and-hash', 4);
  expect(saved?.size).toBe(4); expect(saved?.type).toBe('audio/wav');
  expect(await readBrowserAudio('another-user', 4)).toBeNull();
});
it('removes truncated entries and clears private audio on logout', async () => {
  await saveBrowserAudio('key', new Blob(['bad'], { type: 'audio/wav' }), () => true);
  expect(await readBrowserAudio('key', 4)).toBeNull(); expect(entries.size).toBe(0);
  await saveBrowserAudio('key', new Blob(['RIFF'], { type: 'audio/wav' }), () => true);
  await clearBrowserAudio(); expect(entries.size).toBe(0);
});
it('does not persist data from an ended session and tolerates denied storage', async () => {
  await saveBrowserAudio('key', new Blob(['RIFF']), () => false); expect(entries.size).toBe(0);
  jest.mocked(caches.open).mockRejectedValueOnce(new Error('Private browsing'));
  expect(await readBrowserAudio('key', 4)).toBeNull();
});
it('evicts old entries when the disk budget is exceeded', async () => {
  for (let index = 0; index < 3; index++) entries.set(`http://localhost:8090/old-${index}`, new Response('old', {
    headers: { 'Content-Length': String(100 * 1024 * 1024), 'X-Cached-At': String(index) },
  }));
  await saveBrowserAudio('latest', new Blob(['RIFF'], { type: 'audio/wav' }), () => true);
  expect(entries.has('http://localhost:8090/old-0')).toBe(false);
  expect(await readBrowserAudio('latest', 4)).not.toBeNull();
});
