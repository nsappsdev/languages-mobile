import { API_BASE_URL } from '@/src/config/env';
import type {
  GoogleSignInResponse,
  LearnerVocabularyItem,
  LearnerVocabularyStatus,
  LessonVocabularyReviewItem,
  VocabularyLessonSummary,
  VocabularyReviewDecision,
  Lesson,
  LoginResponse,
  AppSettings,
  AppPlatform,
  AppVersionResponse,
  ProgressEvent,
  ResendVerificationResponse,
  SignupResponse,
  User,
  VerificationStatusResponse,
  VocabularyEntry,
  VocabularyKind,
} from '@/src/types/domain';

export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: unknown;

  constructor(message: string, status: number, code?: string, issues?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

export const API_REQUEST_TIMEOUT_MS = 20_000;

type AuthRefreshHandler = (
  staleToken: string,
  error: ApiError,
) => string | null | Promise<string | null>;
type UnauthorizedHandler = (error: ApiError) => void | Promise<void>;

let authRefreshHandler: AuthRefreshHandler | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setApiAuthRefreshHandler(handler: AuthRefreshHandler | null) {
  authRefreshHandler = handler;
}

export function setApiUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const execute = async (currentToken: string | null, allowRefresh: boolean): Promise<T> => {
    const headers = new Headers(init.headers);
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    let timedOut = false;
    const abortFromUpstream = () => controller.abort();

    if (upstreamSignal?.aborted) {
      abortFromUpstream();
    } else {
      upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, API_REQUEST_TIMEOUT_MS);

    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    const hasBody = init.body !== undefined && init.body !== null;
    if (hasBody && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch {
      if (timedOut) {
        throw new ApiError('Request timed out. Check your connection and try again.', 0, 'TIMEOUT');
      }
      throw new ApiError(
        `Network request failed. Cannot reach ${API_BASE_URL}. Ensure backend is running and reachable from this device.`,
        0,
      );
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }

    const text = await response.text();
    const payload = text ? tryParseJson(text) : null;

    if (!response.ok) {
      const message = extractErrorMessage(payload, response.status);
      const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined;
      const issues = isRecord(payload) ? payload.issues : undefined;
      const error = new ApiError(message, response.status, code, issues);

      if (response.status === 401 && currentToken && allowRefresh && authRefreshHandler) {
        const refreshedToken = await authRefreshHandler(currentToken, error);
        if (refreshedToken && refreshedToken !== currentToken) {
          return execute(refreshedToken, false);
        }
      }

      if (response.status === 401 && currentToken && unauthorizedHandler) {
        void Promise.resolve(unauthorizedHandler(error)).catch(() => null);
      }

      throw error;
    }

    if (!text) {
      return {} as T;
    }

    return payload as T;
  };

  return execute(token ?? null, true);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }
  return `Request failed with status ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const apiClient = {
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signup(name: string, email: string, password: string) {
    return request<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  resendVerification(token: string) {
    return request<ResendVerificationResponse>('/auth/resend-verification', {
      method: 'POST',
      token,
    });
  },

  verificationStatus(token: string) {
    return request<VerificationStatusResponse>('/auth/verification-status', {
      method: 'GET',
      token,
    });
  },

  googleSignIn(idToken: string) {
    return request<GoogleSignInResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  },

  refreshSession(refreshToken: string) {
    return request<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  profile(token: string) {
    return request<{ user: User }>('/auth/profile', {
      method: 'GET',
      token,
    });
  },

  updateProfile(token: string, input: { name: string }) {
    return request<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    });
  },

  logout(token: string, refreshToken?: string | null) {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
      token,
      body: JSON.stringify(
        refreshToken
          ? {
              refreshToken,
            }
          : {},
      ),
    });
  },

  getLessons(token: string) {
    return request<{ lessons: Lesson[] }>('/lessons', {
      method: 'GET',
      token,
    });
  },

  getLesson(token: string, lessonId: string) {
    const freshness = Date.now();
    return request<{ lesson: Lesson }>(`/lessons/${lessonId}?fresh=${freshness}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      method: 'GET',
      token,
    });
  },

  getSettings(token: string) {
    return request<{ settings: AppSettings }>('/settings', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      method: 'GET',
      token,
    });
  },

  getAppVersion(token: string, platform: AppPlatform, buildNumber: number) {
    const params = new URLSearchParams({
      platform,
      buildNumber: String(buildNumber),
    });
    return request<AppVersionResponse>(`/app-version?${params.toString()}`, {
      method: 'GET',
      token,
    });
  },

  sendProgressEvents(token: string, events: ProgressEvent[]) {
    return request<{ accepted: number; received: number }>('/me/progress/events', {
      method: 'POST',
      token,
      body: JSON.stringify({ events }),
    });
  },

  getVocabularyEntries(token: string) {
    return request<{
      entries: VocabularyEntry[];
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
    }>('/vocabulary?page=1&pageSize=10', {
      method: 'GET',
      token,
    });
  },

  lookupVocabularyEntries(token: string, items: string[]) {
    return request<{
      entries: VocabularyEntry[];
      resolved: number;
      requested: number;
    }>('/vocabulary/lookup', {
      method: 'POST',
      token,
      body: JSON.stringify({ items }),
    });
  },

  createVocabularyEntry(
    token: string,
    input: {
      englishText: string;
      kind?: VocabularyKind;
      tags?: string[];
      notes?: string;
    },
  ) {
    return request<{ entry: VocabularyEntry }>('/vocabulary', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    });
  },

  getMyVocabulary(token: string) {
    return request<{ vocabulary: LearnerVocabularyItem[] }>('/me/vocabulary', {
      method: 'GET',
      token,
    });
  },

  addVocabularyToLearner(token: string, entryId: string) {
    return request<{ vocabulary: LearnerVocabularyItem }>(`/me/vocabulary/${entryId}`, {
      method: 'POST',
      token,
    });
  },

  removeVocabularyFromLearner(token: string, entryId: string) {
    return request<{ message?: string }>(`/me/vocabulary/${entryId}`, {
      method: 'DELETE',
      token,
    });
  },

  updateVocabularyStatus(token: string, entryId: string, status: LearnerVocabularyStatus) {
    return request<{ vocabulary: LearnerVocabularyItem }>(`/me/vocabulary/${entryId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
  },

  updateVocabularyStatusBulk(
    token: string,
    items: { entryId: string; status: LearnerVocabularyStatus }[],
  ) {
    return request<{
      vocabulary: LearnerVocabularyItem[];
      received: number;
      applied: number;
    }>('/me/vocabulary/bulk-status', {
      method: 'POST',
      token,
      body: JSON.stringify({ items }),
    });
  },

  resolveVocabularyPack(token: string, items: string[]) {
    return request<{
      vocabulary: LearnerVocabularyItem[];
      resolved: number;
      received: number;
    }>('/me/vocabulary/pack', {
      method: 'POST',
      token,
      body: JSON.stringify({ items }),
    });
  },

  getLessonVocabulary(token: string, lessonId: string) {
    return request<{
      vocabulary: {
        lessonId: string;
        title: string;
        description?: string | null;
        status: string;
        entries: LessonVocabularyReviewItem[];
      };
    }>(`/me/lessons/${lessonId}/vocabulary`, {
      method: 'GET',
      token,
    });
  },

  getVocabularyLessonSummaries(token: string) {
    return request<{ lessons: VocabularyLessonSummary[] }>('/me/vocabulary/lessons', {
      method: 'GET',
      token,
    });
  },

  reviewLessonVocabulary(
    token: string,
    lessonId: string,
    entryId: string,
    decision: VocabularyReviewDecision,
    idempotencyKey: string,
  ) {
    return request<{ review: LessonVocabularyReviewItem }>(
      `/me/lessons/${lessonId}/vocabulary/${entryId}/review`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ decision, idempotencyKey }),
      },
    );
  },

  updateLessonVocabularyStatus(
    token: string,
    lessonId: string,
    entryId: string,
    status: 'NEW' | 'LEARNING' | 'LEARNED',
  ) {
    return request<{ review: LessonVocabularyReviewItem }>(
      `/me/lessons/${lessonId}/vocabulary/${entryId}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      },
    );
  },
};
