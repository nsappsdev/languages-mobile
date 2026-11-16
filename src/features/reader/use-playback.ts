import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { PlaybackStep } from './model';
import { initialPlaybackState, SentencePlayback } from './sentence-playback';

export function usePlayback(token: string, userId: string, publicationId: string) {
  const [state, setState] = useState(initialPlaybackState);
  const engine = useRef<SentencePlayback | null>(null);
  useEffect(() => {
    const current = new SentencePlayback(token, userId, setState);
    engine.current = current;
    return () => { engine.current = null; current.dispose(); };
  }, [token, userId, publicationId]);
  const pause = useCallback(() => engine.current?.pause(), []);
  const stop = useCallback(() => engine.current?.stop(), []);
  const play = useCallback((steps: PlaybackStep[], pauseMs = 0, activePublication = publicationId, sample?: number) =>
    engine.current?.play(steps, pauseMs, activePublication, sample) ?? Promise.resolve(), [publicationId]);
  const warm = useCallback((plans: PlaybackStep[][], pauseMs = 0, sample = 0) =>
    // Refresh credentials recreate the engine; consumers must warm that new instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    engine.current?.warm(plans, pauseMs, publicationId, sample), [publicationId, token, userId]);
  const preload = useCallback((plans: PlaybackStep[][], pauseMs = 0) =>
    // Like warm, rerun when refreshed credentials recreate the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    engine.current?.preload(plans, pauseMs, publicationId), [publicationId, token, userId]);
  const resume = useCallback(() => engine.current?.resume() ?? Promise.resolve(), []);
  const setSample = useCallback((sample: number) => setState(previous => ({ ...previous, sample })), []);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next !== 'active') pause(); });
    return () => listener.remove();
  }, [pause]);
  return { ...state, play, warm, preload, pause, stop, resume, setSample };
}
