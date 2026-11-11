import * as mockFs from 'node:fs';
import * as Font from 'expo-font';
import { apiClient } from '@/src/shared/api/client';
import type { ReaderFont } from '@/src/types/domain';
import { loadReaderFont, readerFontFamily } from '../font-cache';

const mockRoot = `/private/tmp/lezoo-android-font-cache-test-${process.pid}`;
// Android's File(URI) and Uri.path decode escaped separators before file access.
const mockNativePath = (uri: string) => decodeURIComponent(new URL(uri).pathname);
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@/src/config/env', () => ({ API_BASE_URL: 'https://example.test/api' }));
jest.mock('@/src/shared/api/client', () => ({ apiClient: { getReaderFontBytes: jest.fn(async () => new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4])) } }));
jest.mock('expo-font', () => ({ isLoaded: () => false, loadAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({ File: class {
  uri: string;
  constructor(uri: string) { this.uri = uri; }
  create() { mockFs.writeFileSync(mockNativePath(this.uri), new Uint8Array()); }
  write(bytes: Uint8Array) { mockFs.writeFileSync(mockNativePath(this.uri), bytes); }
  async bytes() { return new Uint8Array(mockFs.readFileSync(mockNativePath(this.uri))); }
} }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: `file:///private/tmp/lezoo-android-font-cache-test-${process.pid}/`,
  getInfoAsync: async (uri: string) => {
    try {
      const stat = mockFs.statSync(mockNativePath(uri));
      return { exists: true, size: stat.size, isDirectory: stat.isDirectory() };
    } catch { return { exists: false }; }
  },
  makeDirectoryAsync: async (uri: string) => { mockFs.mkdirSync(mockNativePath(uri), { recursive: true }); },
  deleteAsync: async (uri: string) => { mockFs.rmSync(mockNativePath(uri), { force: true }); },
  moveAsync: async ({ from, to }: { from: string; to: string }) => { mockFs.renameSync(mockNativePath(from), mockNativePath(to)); },
}));

afterEach(() => mockFs.rmSync(mockRoot, { recursive: true, force: true }));

it('downloads an Android font into one file and reuses it after an app restart', async () => {
  const font: ReaderFont = { id: 'android-file-uri', label: 'Fixture', format: 'ttf', sha256: 'a'.repeat(64),
    byteLength: 8, supportsEnglish: true, supportsArmenian: true, available: true };
  await expect(loadReaderFont(font, 'token')).resolves.toBe(readerFontFamily(font));
  expect(apiClient.getReaderFontBytes).toHaveBeenCalledTimes(1);
  expect(Font.loadAsync).toHaveBeenCalledTimes(1);
  const [file] = mockFs.readdirSync(`${mockRoot}/reader-fonts`);
  expect(mockFs.readdirSync(`${mockRoot}/reader-fonts`)).toHaveLength(1);
  expect(file.endsWith('.ttf')).toBe(true);
  expect(mockFs.readFileSync(`${mockRoot}/reader-fonts/${file}`)).toEqual(Buffer.from([0, 1, 0, 0, 1, 2, 3, 4]));

  jest.clearAllMocks();
  let restarted!: typeof import('../font-cache');
  let restartedApi!: typeof apiClient;
  let restartedFont!: typeof Font;
  jest.isolateModules(() => {
    restarted = jest.requireActual('../font-cache');
    restartedApi = jest.requireMock('@/src/shared/api/client').apiClient;
    restartedFont = jest.requireMock('expo-font');
  });
  await expect(restarted.loadReaderFont(font, 'token')).resolves.toBe(readerFontFamily(font));
  expect(restartedApi.getReaderFontBytes).not.toHaveBeenCalled();
  expect(restartedFont.loadAsync).toHaveBeenCalledTimes(1);
});
