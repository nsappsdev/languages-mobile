import { prepareAudio } from '../prepared-audio';
import { decodeReaderWav, wavHeader, TRACK_SAMPLE_RATE } from '../playback-track';
import { readerAudio } from '../asset-cache';
import type { PlaybackStep } from '../model';

let mockOS = 'android';
let mockTruncate = false;
let mockThrowWrite = false;
const mockFiles = new Map<string, Uint8Array>();
const mockClosed: string[] = [];
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('../asset-cache', () => ({ readerAudio: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', makeDirectoryAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({ File: class {
  uri: string;
  constructor(uri: string) { this.uri = uri; }
  get exists() { return mockFiles.has(this.uri); }
  get size() { return (mockFiles.get(this.uri)?.length ?? 0) - (mockTruncate ? 1 : 0); }
  bytes() { return Promise.resolve(mockFiles.get(this.uri)!); }
  create() { mockFiles.set(this.uri, new Uint8Array()); }
  delete() { mockFiles.delete(this.uri); }
  open() { const uri = this.uri; return {
    writeBytes(bytes: Uint8Array) {
      if (mockThrowWrite) throw new Error('disk full');
      const old = mockFiles.get(uri)!; const next = new Uint8Array(old.length + bytes.length);
      next.set(old); next.set(bytes, old.length); mockFiles.set(uri, next);
    }, close() { mockClosed.push(uri); },
  }; }
} }));
const samples = new Int16Array(2400).fill(1000);
const bytes = new Uint8Array(44 + samples.byteLength); bytes.set(wavHeader(samples.length)); bytes.set(new Uint8Array(samples.buffer), 44);
const asset = { id: 'asset', sha256: 'test', mimeType: 'audio/wav', sampleRate: TRACK_SAMPLE_RATE, frameCount: 2400, byteLength: bytes.length };
const steps: PlaybackStep[] = [1, 2].map(index => ({ asset, channel: 'drill', startSample: 0, endSample: 2400, narrationSample: 10,
  repetition: { kind: 'word', label: 'test', index, total: 2 }, pauseAfter: true }));

beforeEach(() => {
  mockOS = 'android'; mockTruncate = false; mockThrowWrite = false; mockFiles.clear(); mockClosed.length = 0;
  mockFiles.set('file:///original.wav', bytes);
  jest.mocked(readerAudio).mockResolvedValue('file:///original.wav');
});

it('writes a valid continuous native WAV, verifies its size and cleans up only that temporary file', async () => {
  const track = await prepareAudio(steps, 400, 'token', 'user', 'publication', new AbortController().signal);
  const rendered = decodeReaderWav(mockFiles.get(track.uri)!);
  expect(rendered.frameCount).toBe(14400);
  expect(mockClosed).toContain(track.uri);
  track.dispose();
  expect(mockFiles.has(track.uri)).toBe(false);
  expect(mockFiles.get('file:///original.wav')).toBe(bytes);
});

it.each(['truncated', 'write failure'])('removes partial output after %s', async kind => {
  mockTruncate = kind === 'truncated'; mockThrowWrite = kind === 'write failure';
  await expect(prepareAudio(steps, 400, 't', 'u', 'p', new AbortController().signal)).rejects.toThrow();
  expect([...mockFiles.keys()]).toEqual(['file:///original.wav']);
});

it('cancels before writing if a pending authenticated source read finishes late', async () => {
  const controller = new AbortController();
  jest.mocked(readerAudio).mockImplementationOnce(async () => { controller.abort(); return 'file:///original.wav'; });
  await expect(prepareAudio(steps, 400, 't', 'u', 'p', controller.signal)).rejects.toThrow('cancelled');
  expect([...mockFiles.keys()]).toEqual(['file:///original.wav']);
});
