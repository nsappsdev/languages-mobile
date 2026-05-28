export type LessonStatus = 'DRAFT' | 'PUBLISHED';
export type VocabularyKind = 'WORD' | 'PHRASE' | 'SENTENCE';
export type LearnerVocabularyStatus = 'NEW' | 'REVIEWING' | 'MASTERED' | 'LEARNING' | 'LEARNED';
export type LearnerLessonVocabularyStatus = 'NEW' | 'LEARNING' | 'LEARNED';

export interface LessonItemSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface LessonItemWordTiming {
  id: string;
  text: string;
  normalizedText: string;
  startMs: number;
  endMs: number;
  order: number;
}

export interface LessonItemSentenceTiming {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  wordMarkIds: string[];
  order: number;
}

export interface LessonItem {
  id: string;
  lessonId: string;
  order: number;
  text: string;
  audioUrl: string;
  segments: LessonItemSegment[];
  wordTimings: LessonItemWordTiming[];
  sentenceTimings: LessonItemSentenceTiming[];
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  status: LessonStatus;
  createdAt?: string;
  updatedAt?: string;
  items: LessonItem[];
  dictionary?: VocabularyEntry[];
  dictionaryCoverage?: LessonDictionaryCoverageItem[];
  vocabulary?: VocabularyEntry[];
  vocabularyCoverage?: LessonDictionaryCoverageItem[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export type LoginResponse = AuthResponse;
export type SignupResponse = AuthResponse;
export type GoogleSignInResponse = AuthResponse;

export interface VerificationStatusResponse {
  emailVerified: boolean;
  canResendAt: string;
  remainingAttempts: number;
  windowMaxAttempts: number;
}

export interface ResendVerificationResponse {
  message: string;
  canResendAt: string;
  remainingAttempts: number;
  windowMaxAttempts: number;
}

export interface VocabularyTranslation {
  id: string;
  entryId: string;
  languageCode: string;
  translation: string;
  usageExample?: string | null;
}

export interface VocabularyEntry {
  id: string;
  lessonId?: string;
  sourceItemId?: string | null;
  englishText: string;
  normalizedText?: string;
  kind: VocabularyKind;
  order?: number;
  notes?: string | null;
  tags: string[];
  translations: VocabularyTranslation[];
}

export interface LessonDictionaryCoverageItem {
  text: string;
  normalizedText: string;
  kind: VocabularyKind;
  entryId: string | null;
  hasTranslation: boolean;
  hasArmenianTranslation: boolean;
  translations: VocabularyTranslation[];
  matched?: boolean;
  matchCount?: number;
}

export interface LearnerVocabularyItem {
  id: string;
  userId: string;
  entryId: string;
  status: LearnerVocabularyStatus;
  addedAt: string;
  updatedAt: string;
  entry: VocabularyEntry;
}

export interface LessonVocabularyReviewItem {
  id: string;
  lessonId: string;
  entryId: string;
  status: LearnerLessonVocabularyStatus;
  rightSwipes: number;
  leftSwipes: number;
  lastReviewedAt: string | null;
  firstSeenAt: string | null;
  entry: VocabularyEntry;
}

export type ProgressEventType = 'ITEM_STARTED' | 'ITEM_COMPLETED' | 'LESSON_COMPLETED';

export interface ProgressEvent {
  idempotencyKey: string;
  lessonId: string;
  lessonItemId?: string;
  eventType: ProgressEventType;
  completion?: number;
  clientTimestamp?: string;
  payload?: Record<string, unknown>;
}

export type ReadingModeId = 'introduction' | 'teaching' | 'deep_learning';

export interface ReadingModeSettings {
  id: ReadingModeId;
  enabled: boolean;
  displayName: string;
  order: number;
  unknownWordRepetitions?: number;
  repeatSentenceWhenUnknownCountAtLeast?: number;
  sentenceRepetitions?: number;
}

export interface AppSettings {
  id: string;
  readingModes: ReadingModeSettings[];
  mainTextFontFamily: string;
  mainTextFontSize: number;
  translationFontFamily: string;
  translationFontSize: number;
  translationFontMinSize: number;
  translationFontMaxSize: number;
  translationLetterSpacingMin: number;
  translationLetterSpacingMax: number;
  createdAt: string;
  updatedAt: string;
}

export type AppPlatform = 'android' | 'ios';

export interface AppVersionPolicy {
  platform: AppPlatform;
  enabled: boolean;
  latestBuildNumber: number;
  minSupportedBuildNumber: number;
  storeUrl: string;
  message: string;
}

export interface AppVersionResponse {
  currentBuildNumber: number;
  policy: AppVersionPolicy;
  update: {
    available: boolean;
    required: boolean;
  };
}
