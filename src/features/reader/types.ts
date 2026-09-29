export interface ReaderAsset {
  id: string;
  sha256: string;
  mimeType: string;
  byteLength: number;
  sampleRate: number;
  frameCount: number;
}

export interface ReaderOccurrence {
  id: string;
  ordinal: number;
  text: string;
  charStart: number;
  charEnd: number;
  sentenceId: string;
  startSample: number;
  endSample: number;
  learning: null | {
    entryId: string;
    translations: { languageCode: string; translation: string }[];
    clip: ReaderAsset;
    cutStartSample: number;
    cutEndSample: number;
  };
}

export interface ReaderText {
  textId: string;
  textReleaseId: string;
  contentRevisionId: string;
  narrationId: string;
  alignmentId: string;
  text: string;
  sourceLanguage: string;
  narration: ReaderAsset;
  sentences: { id: string; text: string; charStart: number; charEnd: number; startSample: number; endSample: number }[];
  occurrences: ReaderOccurrence[];
}

export interface ReaderManifest {
  schemaVersion: 2;
  lessonId: string;
  title: string;
  description: string | null;
  texts: ReaderText[];
}

export type WordStatus = 'NEW' | 'LEARNING' | 'LEARNED';
export interface ReaderLessonSummary {
  id: string;
  publicationId: string;
  title: string;
  description: string | null;
  textCount: number;
  wordCount: number;
  durationSeconds: number;
  completedTexts: number;
}
export interface ReaderResponse {
  publicationId: string;
  manifest: ReaderManifest;
  words: { textReleaseId: string; occurrenceId: string; status: WordStatus; clientUpdatedAt: string }[];
  progress: { textReleaseId: string; lastSample: number; completed: boolean; clientUpdatedAt: string }[];
}
export interface ReaderWord {
  publicationId: string;
  lessonId: string;
  lessonTitle: string;
  textReleaseId: string;
  occurrence: ReaderOccurrence;
  sentence: string;
  status: WordStatus;
}
export type ReaderChange = { publicationId: string; textReleaseId: string; clientUpdatedAt: string } & (
  { kind: 'word'; occurrenceId: string; status: WordStatus } |
  { kind: 'progress'; lastSample: number; completed: boolean }
);
