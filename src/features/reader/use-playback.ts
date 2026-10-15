import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { prepareAudio, type PreparedAudio } from './prepared-audio';
import { trackPosition } from './playback-track';
import type { PlaybackStep } from './model';

type Checkpoint = {
  steps: PlaybackStep[]; position: number; pauseMs: number; publicationId: string;
  track?: PreparedAudio;
};

export function usePlayback(token: string, userId: string, publicationId: string) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const checkpoint = useRef<Checkpoint | null>(null);
  const loadedUri = useRef<string | null>(null);
  const advancing = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState(0);
  const [occurrenceId, setOccurrenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repetition, setRepetition] = useState<PlaybackStep['repetition']>();
  const [canResume, setCanResume] = useState(false);

  const capture = useCallback(() => {
    const saved = checkpoint.current;
    const player = playerRef.current;
    if (!player || !saved?.track || loadedUri.current !== saved.track.uri || !player.isLoaded) return;
    saved.position = Math.max(0, Math.min(saved.track.frameCount, Math.round(player.currentTime * saved.track.sampleRate)));
    if (mounted.current) {
      const current = trackPosition(saved.track, saved.position);
      setSample(current.sample); setOccurrenceId(current.occurrenceId); setRepetition(current.repetition);
    }
  }, []);
  const pause = useCallback(() => {
    if (advancing.current) capture();
    advancing.current = false;
    abort.current?.abort();
    abort.current = null;
    playerRef.current?.pause();
    if (mounted.current) { setPlaying(false); setLoading(false); setOccurrenceId(null); setCanResume(!!checkpoint.current); }
  }, [capture]);
  const dispose = useCallback(() => {
    const previous = checkpoint.current;
    checkpoint.current = null;
    loadedUri.current = null;
    // Android rejects replace(null). Release the player before deleting its
    // source, then create a fresh player when another track is ready to load.
    const player = playerRef.current;
    playerRef.current = null;
    player?.release();
    previous?.track?.dispose();
  }, []);
  const stop = useCallback(() => {
    pause(); dispose();
    if (mounted.current) { setRepetition(undefined); setCanResume(false); }
  }, [dispose, pause]);

  const run = useCallback(async (saved: Checkpoint) => {
    pause();
    checkpoint.current = saved;
    const controller = new AbortController();
    abort.current = controller;
    const signal = controller.signal;
    const check = () => { if (signal.aborted) throw new Error('Playback cancelled'); };
    setError(null); setLoading(true); setCanResume(false);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      check();
      if (!saved.track) {
        const track = await prepareAudio(saved.steps, saved.pauseMs, token, userId, saved.publicationId, signal);
        if (signal.aborted) { track.dispose(); check(); }
        saved.track = track;
      }
      check();
      const track = saved.track;
      const player = playerRef.current ?? createAudioPlayer(null, { updateInterval: 50 });
      playerRef.current = player;
      if (loadedUri.current !== track.uri || !player.isLoaded) {
        await new Promise<void>((resolve, reject) => {
          let finished = false;
          let timeout: ReturnType<typeof setTimeout>;
          const done = (failure?: Error) => {
            if (finished) return; finished = true;
            clearTimeout(timeout); subscription.remove(); signal.removeEventListener('abort', onAbort);
            if (failure) reject(failure); else { loadedUri.current = track.uri; resolve(); }
          };
          const onAbort = () => done(new Error('Playback cancelled'));
          const subscription = player.addListener('playbackStatusUpdate', status => {
            if (status.isLoaded) done();
            else if (status.playbackState === 'error') done(new Error('Audio could not be loaded'));
          });
          signal.addEventListener('abort', onAbort, { once: true });
          timeout = setTimeout(() => done(new Error('Audio took too long to load. Try again.')), 15000);
          try {
            player.replace({ uri: track.uri });
            if (player.isLoaded) done();
          } catch (failure) {
            done(failure instanceof Error ? failure : new Error('Audio could not be loaded'));
          }
        });
      }
      check();
      const target = saved.position / track.sampleRate;
      if (Math.abs(player.currentTime - target) > 0.005) {
        await player.seekTo(target, 0, 0);
        check();
        // Native seek completion can arrive after its promise. Only resume once
        // the clock reaches the saved point; never seek between repetitions.
        await new Promise<void>((resolve, reject) => {
          const done = (failure?: Error) => {
            clearInterval(timer); clearTimeout(timeout); signal.removeEventListener('abort', onAbort);
            if (failure) reject(failure); else resolve();
          };
          const inspect = () => { if (Math.abs(player.currentTime - target) <= 0.025) done(); };
          const onAbort = () => done(new Error('Playback cancelled'));
          const timer = setInterval(inspect, 10);
          const timeout = setTimeout(() => done(new Error('Audio could not resume. Try again.')), 3000);
          signal.addEventListener('abort', onAbort, { once: true });
          inspect();
        });
      }
      check();
      capture(); setLoading(false); setPlaying(true);
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const done = (failure?: Error) => {
          if (finished) return; finished = true;
          clearInterval(timer); clearTimeout(watchdog); subscription.remove(); signal.removeEventListener('abort', onAbort);
          advancing.current = false;
          player.pause(); if (failure) reject(failure); else resolve();
        };
        const update = () => {
          if (finished) return;
          capture();
          if (saved.position >= track.frameCount || player.currentStatus.didJustFinish) {
            saved.position = track.frameCount;
            setSample(trackPosition(track, track.frameCount).sample);
            done();
          } else if (player.currentStatus.playbackState === 'error') done(new Error('Audio playback failed. Try again.'));
        };
        const onAbort = () => done(new Error('Playback cancelled'));
        const subscription = player.addListener('playbackStatusUpdate', update);
        // Polling updates only the UI; audio transitions and pauses live in PCM.
        const timer = setInterval(update, 50);
        const watchdog = setTimeout(() => done(new Error('Playback stalled. Tap play to retry.')),
          (track.frameCount - saved.position) / track.sampleRate * 1000 + 20000);
        signal.addEventListener('abort', onAbort, { once: true });
        advancing.current = true;
        try { player.play(); }
        catch (failure) { done(failure instanceof Error ? failure : new Error('Unable to start audio')); }
      });
      check();
      dispose();
    } catch (failure) {
      if (!signal.aborted && mounted.current) setError(failure instanceof Error ? failure.message : 'Unable to play audio');
    } finally {
      if (abort.current === controller && mounted.current) {
        abort.current = null; setPlaying(false); setLoading(false); setOccurrenceId(null);
        setCanResume(!!checkpoint.current); if (!checkpoint.current) setRepetition(undefined);
      }
    }
  }, [capture, dispose, pause, token, userId]);
  const play = useCallback((steps: PlaybackStep[], pauseMs = 0, activePublication = publicationId) => {
    stop();
    if (!steps.length) return Promise.resolve();
    setSample(steps[0].narrationSample);
    return run({ steps, position: 0, pauseMs, publicationId: activePublication });
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
      // Cancel listeners before releasing the native player or its local file.
      stop();
    };
  }, [stop]);
  return { play, pause, resume, canResume, stop, playing, loading, sample, setSample, occurrenceId, repetition, error };
}
