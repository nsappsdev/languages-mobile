import { API_BASE_URL } from '@/src/config/env';
import type {
  LearnerVocabularyItem,
  LearnerVocabularyStatus,
  Lesson,
  LoginResponse,
  ProgressEvent,
  SignupResponse,
  User,
  VocabularyEntry,
  VocabularyKind,
} from '@/src/types/domain';

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

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
      });
    } catch {
      throw new ApiError(
        `Network request failed. Cannot reach ${API_BASE_URL}. Ensure backend is running and reachable from this device.`,
        0,
      );
    }

    const text = await response.text();
    const payload = text ? tryParseJson(text) : null;

    if (!response.ok) {
      const message = extractErrorMessage(payload, response.status);
      const issues = isRecord(payload) ? payload.issues : undefined;
      const error = new ApiError(message, response.status, issues);

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
    return request<{ lesson: Lesson }>(`/lessons/${lessonId}`, {
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
};
