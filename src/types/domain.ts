export type LessonStatus = 'DRAFT' | 'PUBLISHED';
export type VocabularyKind = 'WORD' | 'PHRASE' | 'SENTENCE';
export type LearnerVocabularyStatus = 'NEW' | 'REVIEWING' | 'MASTERED';

export interface LessonItemSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface LessonItem {
  id: string;
  lessonId: string;
  order: number;
  text: string;
  audioUrl: string;
  segments: LessonItemSegment[];
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  status: LessonStatus;
  createdAt?: string;
  updatedAt?: string;
  items: LessonItem[];
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
  englishText: string;
  kind: VocabularyKind;
  notes?: string | null;
  tags: string[];
  translations: VocabularyTranslation[];
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
