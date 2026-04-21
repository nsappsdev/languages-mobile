import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setProgressSyncSession } from '@/src/features/progress/progress-sync';
import { setVocabularyStatusSyncSession } from '@/src/features/vocabulary/services/vocabulary-status-sync';
import {
  apiClient,
  ApiError,
  setApiAuthRefreshHandler,
  setApiUnauthorizedHandler,
} from '@/src/shared/api/client';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from '@/src/shared/auth/session-storage';
import type { User } from '@/src/types/domain';

interface SessionContextValue {
  isAuthenticated: boolean;
  isInitializing: boolean;
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: { name: string }) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback((next: {
    token: string | null;
    refreshToken: string | null;
    user: User | null;
  }) => {
    tokenRef.current = next.token;
    refreshTokenRef.current = next.refreshToken;
    setToken(next.token);
    setUser(next.user);
  }, []);

  const clearSession = useCallback(async () => {
    refreshPromiseRef.current = null;
    applySession({
      token: null,
      refreshToken: null,
      user: null,
    });
    setIsInitializing(false);
    await clearPersistedSession();
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.login(email, password);
    applySession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    setIsInitializing(false);
    await savePersistedSession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
  }, [applySession]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const response = await apiClient.signup(name, email, password);
    applySession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    setIsInitializing(false);
    await savePersistedSession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
  }, [applySession]);

  const googleSignIn = useCallback(async (idToken: string) => {
    const response = await apiClient.googleSignIn(idToken);
    applySession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    setIsInitializing(false);
    await savePersistedSession({
      token: response.token,
      refreshToken: response.refreshToken,
      user: response.user,
    });
  }, [applySession]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const currentRefreshToken = refreshTokenRef.current;
    if (!currentRefreshToken) {
      await clearSession();
      return null;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      try {
        const response = await apiClient.refreshSession(currentRefreshToken);
        applySession({
          token: response.token,
          refreshToken: response.refreshToken,
          user: response.user,
        });
        await savePersistedSession({
          token: response.token,
          refreshToken: response.refreshToken,
          user: response.user,
        });
        return response.token;
      } catch {
        await clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [applySession, clearSession]);

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;

    try {
      const response = await apiClient.profile(currentToken);
      setUser(response.user);
      const activeToken = tokenRef.current ?? currentToken;
      await savePersistedSession({
        token: activeToken,
        refreshToken: refreshTokenRef.current,
        user: response.user,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
      }
      throw error;
    }
  }, [clearSession]);

  const updateProfile = useCallback(async (input: { name: string }) => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      throw new Error('Not authenticated');
    }

    const response = await apiClient.updateProfile(currentToken, input);
    setUser(response.user);
    await savePersistedSession({
      token: tokenRef.current ?? currentToken,
      refreshToken: refreshTokenRef.current,
      user: response.user,
    });
  }, []);

  useEffect(() => {
    setApiAuthRefreshHandler(async (_staleToken, error) => {
      if (error.status !== 401) {
        return null;
      }
      return refreshAccessToken();
    });

    setApiUnauthorizedHandler(async (error) => {
      if (error.status !== 401) {
        return;
      }

      await clearSession();
    });

    return () => {
      setApiAuthRefreshHandler(null);
      setApiUnauthorizedHandler(null);
    };
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const persisted = await loadPersistedSession();
        if (!persisted || !isMounted) {
          return;
        }

        applySession({
          token: persisted.token,
          refreshToken: persisted.refreshToken,
          user: persisted.user,
        });

        try {
          const response = await apiClient.profile(persisted.token);
          if (!isMounted) {
            return;
          }
          setUser(response.user);
          const activeToken = tokenRef.current ?? persisted.token;
          await savePersistedSession({
            token: activeToken,
            refreshToken: refreshTokenRef.current,
            user: response.user,
          });
        } catch (error) {
          if (!isMounted) {
            return;
          }
          if (error instanceof ApiError && error.status === 401) {
            await clearSession();
          }
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    hydrateSession().catch(() => {
      if (isMounted) {
        setIsInitializing(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    void setProgressSyncSession({
      token,
      userId: user?.id ?? null,
    });
    void setVocabularyStatusSyncSession({
      token,
      userId: user?.id ?? null,
    });
  }, [token, user?.id]);

  const value = useMemo<SessionContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      isInitializing,
      token,
      user,
      login,
      signup,
      googleSignIn,
      logout,
      refreshProfile,
      updateProfile,
    }),
    [googleSignIn, isInitializing, login, logout, refreshProfile, signup, token, updateProfile, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }

  return value;
}
