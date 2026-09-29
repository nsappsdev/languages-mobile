import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/src/shared/auth/session-context';

export function useResource<T>(load: (token: string) => Promise<T>) {
  const { token } = useSession();
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    // A manual retry intentionally invalidates this focused request.
    void attempt;
    if (!token) return;
    let active = true;
    setLoading(true); setError(null);
    load(token).then(result => { if (active) setValue(result); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Unable to load content'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, load, token]));
  return { value, setValue, loading, error, retry: () => setAttempt(n => n + 1) };
}
