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
  wordRepetitionPauseMs: number;
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
