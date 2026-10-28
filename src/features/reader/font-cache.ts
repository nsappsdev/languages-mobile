import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Font from 'expo-font';
import { API_BASE_URL } from '@/src/config/env';
import { apiClient } from '@/src/shared/api/client';
import type { AppSettings, ReaderFont } from '@/src/types/domain';

const loaded = new Map<string, Promise<string>>();
const root = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}reader-fonts/` : null;
export const readerFontFamily = (font: ReaderFont) => `reader-${font.id}-${font.sha256.slice(0,16)}`;
const valid = (bytes: Uint8Array, font: ReaderFont) => bytes.byteLength === font.byteLength &&
  ((bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) ||
   String.fromCharCode(...bytes.slice(0,4)) === 'OTTO' || String.fromCharCode(...bytes.slice(0,4)) === 'true');

export async function loadReaderFont(font: ReaderFont, token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(font.sha256) || !/^[a-zA-Z0-9_-]+$/.test(font.id) || !['ttf','otf'].includes(font.format) || font.byteLength > 3*1024*1024)
    throw new Error('Invalid font');
  const family = readerFontFamily(font), key = `${API_BASE_URL}:${family}`;
  if (Platform.OS !== 'web' && Font.isLoaded(family)) return family;
  const existing = loaded.get(key); if (existing) return existing;
  const load = async () => {
    const target = root ? `${root}${encodeURIComponent(key)}.${font.format}` : null;
    if (Platform.OS !== 'web' && target) {
      const info = await FileSystem.getInfoAsync(target);
      if (info.exists && !info.isDirectory && info.size === font.byteLength) {
        try {
          if (valid(await new File(target).bytes(),font)) { await Font.loadAsync(family,target); return family; }
        } catch { /* Replace a damaged or unreadable cache file. */ }
      }
    }
    const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),8000);
    let bytes:Uint8Array;
    try { bytes = await apiClient.getReaderFontBytes(token,font.id,controller.signal); }
    finally { clearTimeout(timeout); }
    if (!valid(bytes,font)) throw new Error('Incomplete font');
    if (Platform.OS === 'web') {
      // Load the bytes directly: Expo's WebKit loader resolves after CSS
      // registration, before a temporary object URL is safe to release.
      const face = new FontFace(family,new Uint8Array(bytes).buffer);
      await face.load();
      document.fonts.add(face);
    } else {
      if (!root || !target) throw new Error('Font storage unavailable');
      await FileSystem.makeDirectoryAsync(root,{intermediates:true});
      const temporary = `${target}.partial`;
      try {
        await FileSystem.deleteAsync(temporary,{idempotent:true});
        const file = new File(temporary); file.create(); file.write(bytes);
        await FileSystem.deleteAsync(target,{idempotent:true});
        await FileSystem.moveAsync({from:temporary,to:target});
        await Font.loadAsync(family,target);
      } finally { await FileSystem.deleteAsync(temporary,{idempotent:true}); }
    }
    return family;
  };
  const promise = load().catch(error=>{loaded.delete(key);throw error;}); loaded.set(key,promise);
  return promise;
}

export async function resolveReaderFonts(settings:AppSettings,token:string) {
  let failed=false;
  const resolve = async (id:string|null|undefined,font:ReaderFont|null|undefined,legacy:string) => {
    if (!id) return legacy;
    if (!font || font.id !== id) { failed=true; return 'System'; }
    try { return await loadReaderFont(font,token); } catch { failed=true; return 'System'; }
  };
  const [mainTextFontFamily,translationFontFamily] = await Promise.all([
    resolve(settings.mainTextFontId,settings.readerFonts?.mainText,settings.mainTextFontFamily),
    resolve(settings.translationFontId,settings.readerFonts?.translation,settings.translationFontFamily),
  ]);
  return { settings:{...settings,mainTextFontFamily,translationFontFamily},fontNotice:failed?'A reading font could not load. Using the system font for now.':'' };
}
