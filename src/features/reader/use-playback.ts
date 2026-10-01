import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { readerAudio } from './asset-cache';
import type { PlaybackStep } from './model';

type Checkpoint = { steps: PlaybackStep[]; index: number; position: number; pauseMs: number; publicationId: string };

export function usePlayback(token: string, userId: string, publicationId: string) {
  const [narrationPlayer] = useState(() => createAudioPlayer(null, { updateInterval: 50 }));
  const [drillPlayer] = useState(() => createAudioPlayer(null, { updateInterval: 50 }));
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const checkpoint = useRef<Checkpoint | null>(null);
  const loadedUri = useRef<Record<'narration' | 'drill', string | null>>({ narration: null, drill: null });
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState(0);
  const [occurrenceId, setOccurrenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repetition, setRepetition] = useState<PlaybackStep['repetition']>();
  const [canResume, setCanResume] = useState(false);
  const pause = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    narrationPlayer.pause();
    drillPlayer.pause();
    if (mounted.current) { setPlaying(false); setLoading(false); setOccurrenceId(null); setCanResume(!!checkpoint.current); }
  }, [drillPlayer, narrationPlayer]);
  const stop = useCallback(() => {
    checkpoint.current = null;
    pause();
    if (mounted.current) { setRepetition(undefined); setCanResume(false); }
  }, [pause]);

  const run = useCallback(async (saved: Checkpoint) => {
    pause();
    checkpoint.current = saved;
    const controller = new AbortController();
    abort.current = controller;
    const signal = controller.signal;
    const cancelled = () => { if (signal.aborted) throw new Error('Playback cancelled'); };
    const wait = async (milliseconds: number) => {
      if (milliseconds <= 0) return;
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, Math.min(milliseconds, 3000));
        signal.addEventListener('abort', done, { once: true });
      });
      cancelled();
    };
    const seekToVerifiedSample = async (player: typeof narrationPlayer, sample: number, sampleRate: number) => {
      const targetSeconds = sample / sampleRate;
      const toleranceSeconds = 0.025;
      if (player.isLoaded && Number.isFinite(player.currentTime) && Math.abs(player.currentTime - targetSeconds) <= toleranceSeconds) return;
      for (let attempt = 0; attempt < 3; attempt++) {
        await player.seekTo(targetSeconds, 0, 0);
        const reached = await new Promise<boolean>((resolve, reject) => {
          let finished = false;
          const done = (result: boolean, failure?: Error) => {
            if (finished) return; finished = true;
            clearInterval(timer); clearTimeout(timeout); signal.removeEventListener('abort', onAbort);
            if (failure) reject(failure); else resolve(result);
          };
          const inspect = () => {
            if (player.isLoaded && Number.isFinite(player.currentTime) && Math.abs(player.currentTime - targetSeconds) <= toleranceSeconds) done(true);
          };
          const onAbort = () => done(false, new Error('Playback cancelled'));
          const timer = setInterval(inspect, 10);
          const timeout = setTimeout(() => done(false), 1000);
          signal.addEventListener('abort', onAbort, { once: true });
          inspect();
        });
        if (reached) return;
        cancelled();
      }
      throw new Error('Audio could not seek to the repetition. Try again.');
    };
    const ensureLoaded = async (player: typeof narrationPlayer, channel: 'narration' | 'drill', uri: string) => {
      player.pause();
      if (loadedUri.current[channel] === uri && player.isLoaded) return;
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        let timeout: ReturnType<typeof setTimeout>;
        const onAbort = () => done(new Error('Playback cancelled'));
        const subscription = player.addListener('playbackStatusUpdate', status => {
          if (status.isLoaded) done();
          else if (status.playbackState === 'error') done(new Error('Audio could not be loaded'));
        });
        const done = (failure?: Error) => {
          if (finished) return; finished = true;
          clearTimeout(timeout); subscription.remove(); signal.removeEventListener('abort', onAbort);
          if (failure) reject(failure); else { loadedUri.current[channel] = uri; resolve(); }
        };
        signal.addEventListener('abort', onAbort, { once: true });
        timeout = setTimeout(() => done(new Error('Audio took too long to load. Try again.')), 15000);
        player.replace({ uri });
        if (player.isLoaded) done();
      });
    };
    setError(null); setLoading(true); setCanResume(false);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      cancelled();
      const uniqueAssets = [...new Map(saved.steps.map(step => [step.asset.id, step.asset])).values()];
      const assetUris = new Map((await Promise.all(uniqueAssets.map(async asset => [asset.id,
        await readerAudio(token, userId, saved.publicationId, asset)] as const))));
      cancelled();
      for (; saved.index < saved.steps.length; ) {
        const step = saved.steps[saved.index];
        const channel = step.channel ?? 'narration';
        const player = channel === 'drill' ? drillPlayer : narrationPlayer;
        const otherPlayer = channel === 'drill' ? narrationPlayer : drillPlayer;
        const uri = assetUris.get(step.asset.id)!;
        otherPlayer.pause();
        await ensureLoaded(player, channel, uri);
        cancelled();
        if (step.pauseBefore) await wait(saved.pauseMs);
        await seekToVerifiedSample(player, saved.position, step.asset.sampleRate);
        cancelled();
        setOccurrenceId(step.occurrenceId ?? null);
        setRepetition(step.repetition);
        setLoading(false); setPlaying(true);
        await new Promise<void>((resolve, reject) => {
          let finished = false;
          const onAbort = () => done(new Error('Playback cancelled'));
          const update = () => {
            if (finished) return;
            const current = Math.round(player.currentTime * step.asset.sampleRate);
            saved.position = Math.max(step.startSample, Math.min(step.endSample, current));
            if (channel === 'narration' || step.repetition?.kind === 'sentence') setSample(current);
            else setSample(step.narrationSample);
            if (current >= step.endSample || player.currentStatus.didJustFinish) done();
            else if (player.currentStatus.playbackState === 'error') done(new Error('Audio playback failed. Try again.'));
          };
          const subscription = player.addListener('playbackStatusUpdate', update);
          // Also check the native player clock between status notifications for sentence cutoffs.
          const timer = setInterval(update, 10);
          const watchdog = setTimeout(() => done(new Error('Playback stalled. Tap play to retry.')),
            (step.endSample - step.startSample) / step.asset.sampleRate * 1000 + 20000);
          const done = (failure?: Error) => {
            if (finished) return; finished = true;
            clearInterval(timer); clearTimeout(watchdog); subscription.remove(); signal.removeEventListener('abort', onAbort);
            player.pause(); if (failure) reject(failure); else resolve();
          };
          signal.addEventListener('abort', onAbort, { once: true });
          player.play();
        });
        cancelled();
        saved.index++;
        saved.position = saved.steps[saved.index]?.startSample ?? 0;
        if (step.pauseAfter) await wait(saved.pauseMs);
      }
      checkpoint.current = null;
    } catch (failure) {
      if (!signal.aborted && mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to play audio');
    } finally {
      if (abort.current === controller && mounted.current) {
        abort.current = null; setPlaying(false); setLoading(false); setOccurrenceId(null);
        setCanResume(!!checkpoint.current); if (!checkpoint.current) setRepetition(undefined);
      }
    }
  }, [drillPlayer, narrationPlayer, pause, token, userId]);
  const play = useCallback((steps: PlaybackStep[], pauseMs = 0, activePublication = publicationId) => {
    stop();
    return run({ steps, index: 0, position: steps[0]?.startSample ?? 0, pauseMs, publicationId: activePublication });
  }, [publicationId, run, stop]);
  const resume = useCallback(() => checkpoint.current ? run(checkpoint.current) : Promise.resolve(), [run]);

  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    return () => listener.remove();
  }, [pause]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      checkpoint.current = null;
      abort.current?.abort();
      abort.current = null;
      narrationPlayer.release();
      drillPlayer.release();
    };
  }, [drillPlayer, narrationPlayer]);
  return { play, pause, resume, canResume, stop, playing, loading, sample, setSample, occurrenceId, repetition, error };
}
