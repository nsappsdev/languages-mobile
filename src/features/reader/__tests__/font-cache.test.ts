import { loadReaderFont, readerFontFamily, resolveReaderFonts } from '../font-cache';
import type { AppSettings, ReaderFont } from '@/src/types/domain';
import { apiClient } from '@/src/shared/api/client';
import * as Font from 'expo-font';

let mockOS='web';
const mockFiles=new Map<string,Uint8Array>();
const mockBrowserFontLoad=jest.fn(async()=>({}));
const mockBrowserFontAdd=jest.fn();
const mockFontFace=jest.fn(()=>({load:mockBrowserFontLoad}));
jest.mock('react-native',()=>({Platform:{get OS(){return mockOS;}}}));
jest.mock('@/src/config/env',()=>({API_BASE_URL:'https://example.test/api'}));
jest.mock('@/src/shared/api/client',()=>({apiClient:{getReaderFontBytes:jest.fn()}}));
jest.mock('expo-font',()=>({isLoaded:jest.fn(()=>false),loadAsync:jest.fn(async()=>{})}));
jest.mock('expo-file-system',()=>({File:class{uri:string;constructor(uri:string){this.uri=uri;}create(){mockFiles.set(this.uri,new Uint8Array());}write(bytes:Uint8Array){mockFiles.set(this.uri,bytes);}async bytes(){return mockFiles.get(this.uri)!;}}}));
jest.mock('expo-file-system/legacy',()=>({cacheDirectory:'file:///cache/',
  getInfoAsync:jest.fn(async(uri:string)=>({exists:mockFiles.has(uri),size:mockFiles.get(uri)?.byteLength,isDirectory:false})),
  makeDirectoryAsync:jest.fn(async()=>{}),deleteAsync:jest.fn(async(uri:string)=>{mockFiles.delete(uri);}),
  moveAsync:jest.fn(async({from,to}:{from:string;to:string})=>{mockFiles.set(to,mockFiles.get(from)!);mockFiles.delete(from);}),
}));
const base:ReaderFont={id:'font-a',label:'Noto',format:'ttf',sha256:'a'.repeat(64),byteLength:8,supportsEnglish:true,supportsArmenian:true,available:true};
const bytes=new Uint8Array([0,1,0,0,1,2,3,4]);
const settings={mainTextFontFamily:'System',translationFontFamily:'System',mainTextFontId:base.id,translationFontId:base.id,readerFonts:{mainText:base,translation:base}} as AppSettings;
beforeEach(()=>{jest.clearAllMocks();mockOS='web';mockFiles.clear();jest.mocked(apiClient.getReaderFontBytes).mockResolvedValue(bytes);URL.createObjectURL=jest.fn(()=>'blob:font');URL.revokeObjectURL=jest.fn();
  Object.defineProperty(globalThis,'document',{configurable:true,value:{fonts:{add:mockBrowserFontAdd}}});
  Object.defineProperty(globalThis,'FontFace',{configurable:true,value:mockFontFace});
});

it('deduplicates parallel loading of the same immutable font for both languages',async()=>{
  const resolved=await resolveReaderFonts(settings,'token');
  expect(apiClient.getReaderFontBytes).toHaveBeenCalledTimes(1);expect(mockFontFace).toHaveBeenCalledTimes(1);expect(mockBrowserFontAdd).toHaveBeenCalledTimes(1);
  expect(resolved.settings.mainTextFontFamily).toBe(readerFontFamily(base));
  expect(resolved.settings.translationFontFamily).toBe(readerFontFamily(base));expect(resolved.fontNotice).toBe('');
});
it('uses a system fallback when files are unavailable and does not block reading',async()=>{
  const font={...base,id:'font-failed',sha256:'b'.repeat(64)};
  jest.mocked(apiClient.getReaderFontBytes).mockRejectedValue(new Error('offline'));
  const resolved=await resolveReaderFonts({...settings,mainTextFontId:font.id,translationFontId:null,readerFonts:{mainText:font,translation:null}},'token');
  expect(resolved.settings.mainTextFontFamily).toBe('System');expect(resolved.fontNotice).toContain('system font');
  await resolveReaderFonts({...settings,mainTextFontId:font.id,translationFontId:null,readerFonts:{mainText:font,translation:null}},'token');
  expect(apiClient.getReaderFontBytes).toHaveBeenCalledTimes(2);
});
it('rejects incomplete font downloads instead of registering them',async()=>{
  jest.mocked(apiClient.getReaderFontBytes).mockResolvedValue(new Uint8Array([0,1]));
  await expect(loadReaderFont({...base,id:'bad-font'},'token')).rejects.toThrow('Incomplete font');
  expect(Font.loadAsync).not.toHaveBeenCalled();
});
it('loads an existing validated native cache file without a download',async()=>{
  mockOS='ios';const font={...base,id:'cached-font',sha256:'c'.repeat(64)};
  const key=encodeURIComponent(`https://example.test/api:${readerFontFamily(font)}`);
  const path=`file:///cache/reader-fonts/${key}.ttf`;mockFiles.set(path,bytes);
  await expect(loadReaderFont(font,'token')).resolves.toBe(readerFontFamily(font));
  expect(apiClient.getReaderFontBytes).not.toHaveBeenCalled();expect(Font.loadAsync).toHaveBeenCalledWith(readerFontFamily(font),path);
});
it('downloads and promotes a native file before loading it',async()=>{
  mockOS='android';const font={...base,id:'new-native',sha256:'d'.repeat(64)};
  await loadReaderFont(font,'token');
  expect([...mockFiles.keys()].some(key=>key.endsWith('.partial'))).toBe(false);
  expect([...mockFiles.keys()].some(key=>key.endsWith('.ttf'))).toBe(true);
  expect(Font.loadAsync).toHaveBeenCalledWith(readerFontFamily(font),expect.stringContaining('reader-fonts/'));
});

it('waits for WebKit to load actual font bytes before registering a browser font',async()=>{
  let releaseFont!:(face:object)=>void;
  let started!:()=>void;
  const loadingStarted=new Promise<void>(resolve=>{started=resolve;});
  mockBrowserFontLoad.mockImplementationOnce(()=>{started();return new Promise<object>(resolve=>{releaseFont=resolve;});});
  const font={...base,id:'webkit-font',sha256:'e'.repeat(64)};
  const pending=loadReaderFont(font,'token');
  await loadingStarted;
  expect(mockBrowserFontAdd).not.toHaveBeenCalled();
  releaseFont({});
  await expect(pending).resolves.toBe(readerFontFamily(font));
  expect(mockFontFace).toHaveBeenCalledWith(readerFontFamily(font),new Uint8Array(bytes).buffer);
  expect(mockBrowserFontAdd).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
