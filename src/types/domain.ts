export type LessonStatus = 'DRAFT' | 'PUBLISHED';
export type TaskType = 'PICK_ONE' | 'FILL_IN_BLANK' | 'MATCH' | 'LISTENING_TEXT';
export type VocabularyKind = 'WORD' | 'PHRASE' | 'SENTENCE';
export type LearnerVocabularyStatus = 'NEW' | 'REVIEWING' | 'MASTERED';

export interface TaskOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface TaskConfig {
  correctAnswers?: string[];
  audioUrl?: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  lessonId: string;
  prompt: string;
  type: TaskType;
  order: number;
  config: TaskConfig;
  options: TaskOption[];
}

export interface Lesson {
  id: string;
  title: string;
  description?: string | null;
  status: LessonStatus;
  createdAt?: string;
  updatedAt?: string;
  tasks: Task[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export type LoginResponse = AuthResponse;
export type SignupResponse = AuthResponse;

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

export type ProgressEventType = 'TASK_ATTEMPT' | 'TASK_COMPLETED' | 'LESSON_COMPLETED';

export interface ProgressEvent {
  idempotencyKey: string;
  lessonId: string;
  taskId?: string;
  eventType: ProgressEventType;
  attemptNumber?: number;
  isCorrect?: boolean;
  score?: number;
  completion?: number;
  clientTimestamp?: string;
  payload?: Record<string, unknown>;
}
