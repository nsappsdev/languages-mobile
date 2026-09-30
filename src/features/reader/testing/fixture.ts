import type { ReaderText } from '../types';

// Synthetic timing metadata for pure unit tests; never served as real audio.
export const fixture: ReaderText = {
  textId: 'text-a', textReleaseId: 'release-a', contentRevisionId: 'revision-a', narrationId: 'narration-a', alignmentId: 'alignment-a',
  text: 'A cat, a cat!', sourceLanguage: 'en',
  narration: { id: 'audio-a', sha256: 'hash-a', mimeType: 'audio/wav', byteLength: 2044, frameCount: 1000, sampleRate: 100 },
  sentences: [{ id: 's1', text: 'A cat, a cat!', charStart: 0, charEnd: 13, startSample: 0, endSample: 900 }],
  occurrences: [
    { id: 'a1', ordinal: 0, text: 'A', charStart: 0, charEnd: 1, sentenceId: 's1', startSample: 0, endSample: 100, learning: null },
    { id: 'cat1', ordinal: 1, text: 'cat', charStart: 2, charEnd: 5, sentenceId: 's1', startSample: 200, endSample: 400,
      learning: { entryId: 'entry1', translations: [{ languageCode: 'hy', translation: 'կատու' }], cutStartSample: 150, cutEndSample: 450,
        clip: { id: 'clip1', sha256: 'hash1', mimeType: 'audio/wav', byteLength: 644, sampleRate: 100, frameCount: 300 } } },
    { id: 'a2', ordinal: 2, text: 'a', charStart: 7, charEnd: 8, sentenceId: 's1', startSample: 500, endSample: 600, learning: null },
    { id: 'cat2', ordinal: 3, text: 'cat', charStart: 9, charEnd: 12, sentenceId: 's1', startSample: 700, endSample: 900,
      learning: { entryId: 'entry2', translations: [{ languageCode: 'hy', translation: 'երկրորդ կատու' }], cutStartSample: 650, cutEndSample: 1000,
        clip: { id: 'clip2', sha256: 'hash2', mimeType: 'audio/wav', byteLength: 744, sampleRate: 100, frameCount: 350 } } },
  ],
};
