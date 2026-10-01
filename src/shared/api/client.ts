import { API_BASE_URL } from '@/src/config/env';
import type { GoogleSignInResponse, LoginResponse, AppSettings, AppPlatform, AppVersionResponse,
  ResendVerificationResponse, SignupResponse, User, VerificationStatusResponse } from '@/src/types/domain';
import type { ReaderLessonSummary, ReaderResponse, ReaderWord, ReaderChange } from '@/src/features/reader/types';

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
  responseType?: 'blob' | 'bytes';
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
  const { token, responseType, ...init } = options;

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
      const url = `${API_BASE_URL}${path}`;
      const requestInit = { ...init, headers, signal: controller.signal };
      if (responseType === 'bytes') {
        const { fetch: expoFetch } = await import('expo/fetch');
        response = await expoFetch(url, requestInit);
      } else {
        response = await fetch(url, requestInit);
      }
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

    if (response.ok && responseType === 'blob') return await response.blob() as T;
    if (response.ok && responseType === 'bytes') {
      return await (response as Response & { bytes(): Promise<Uint8Array> }).bytes() as T;
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
    return request<{ lessons: ReaderLessonSummary[] }>('/learner/lessons', { token, cache: 'no-store' });
  },
  getLesson(token: string, lessonId: string) {
    return request<ReaderResponse>(`/learner/lessons/${encodeURIComponent(lessonId)}/manifest`, { token, cache: 'no-store' });
  },
  getPublication(token: string, publicationId: string) {
    return request<ReaderResponse>(`/learner/publications/${encodeURIComponent(publicationId)}`, { token, cache: 'no-store' });
  },
  getWords(token: string) {
    return request<{ words: ReaderWord[] }>('/learner/words', { token, cache: 'no-store' });
  },
  saveReaderChange(token: string, change: ReaderChange) {
    const { kind, ...body } = change;
    return request(kind === 'word' ? '/learner/word-state' : '/learner/reader-progress', {
      method: 'PUT', token, body: JSON.stringify(body),
    });
  },
  getReaderAudio(token: string, publicationId: string, assetId: string) {
    return request<Blob>(`/learner/audio-assets/${encodeURIComponent(assetId)}/content?publicationId=${encodeURIComponent(publicationId)}`, {
      token, responseType: 'blob', cache: 'no-store',
    });
  },
  getReaderAudioBytes(token: string, publicationId: string, assetId: string) {
    return request<Uint8Array>(`/learner/audio-assets/${encodeURIComponent(assetId)}/content?publicationId=${encodeURIComponent(publicationId)}`, {
      token, responseType: 'bytes', cache: 'no-store',
    });
  },
  getSettings(token: string) {
    return request<{ settings: AppSettings }>('/settings', { token, cache: 'no-store' });
  },
  getAppVersion(token: string, platform: AppPlatform, buildNumber: number) {
    const params = new URLSearchParams({ platform, buildNumber: String(buildNumber) });
    return request<AppVersionResponse>(`/app-version?${params}`, { token });
  },
};
