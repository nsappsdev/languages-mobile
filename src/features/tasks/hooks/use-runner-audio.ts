import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { resolveApiAssetUrl } from '@/src/config/env';
import { ACTIVE_SEGMENT_SCROLL_LOOKAHEAD_MS } from '@/src/features/tasks/constants/task-runner';
import {
  ensureAudioCached,
  getCachedAudioUri,
  prefetchAudio,
} from '@/src/features/tasks/services/audio-cache';
import { getActiveWordTimingId } from '@/src/features/tasks/screens/task-runner-word-timings';
import type { LessonItem } from '@/src/types/domain';

type PlaybackUiStatus = {
  activeSegmentId: string | null;
  activeWordTimingId: string | null;
  currentTime: number;
  didJustFinish: boolean;
  duration: number;
  playing: boolean;
  scrollTargetSegmentId: string | null;
};

const EMPTY_STATUS: PlaybackUiStatus = {
  activeSegmentId: null,
  activeWordTimingId: null,
  currentTime: 0,
  didJustFinish: false,
  duration: 0,
  playing: false,
  scrollTargetSegmentId: null,
};

export function useRunnerAudio({
  currentAudioUrl,
  currentItem,
  nextAudioUrl,
}: {
  currentAudioUrl: string | null;
  currentItem: LessonItem | undefined;
  nextAudioUrl: string | null;
}) {
  const [playableAudioUrl, setPlayableAudioUrl] = useState<string | null>(null);
  const [isAudioCaching, setIsAudioCaching] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackUiStatus>(EMPTY_STATUS);
  const lastUiKeyRef = useRef('');
  const player = useAudioPlayer(playableAudioUrl ?? undefined, { updateInterval: 50 });

  useEffect(() => {
    setPlaybackStatus(EMPTY_STATUS);
    lastUiKeyRef.current = '';
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      const positionMs = Math.max(0, Math.round(status.currentTime * 1000));
      const activeSegment = currentItem?.segments.find(
        (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
      );
      const anticipatedMs = positionMs + ACTIVE_SEGMENT_SCROLL_LOOKAHEAD_MS;
      const anticipatedSegment = status.playing
        ? currentItem?.segments.find(
            (segment) => anticipatedMs >= segment.startMs && anticipatedMs < segment.endMs,
          ) ?? activeSegment
        : activeSegment;
      const activeWordTimingId = currentItem
        ? getActiveWordTimingId(currentItem.wordTimings ?? [], positionMs)
        : null;
      const uiKey = [
        activeSegment?.id ?? '',
        activeWordTimingId ?? '',
        anticipatedSegment?.id ?? '',
        Math.floor(status.currentTime),
        Math.round(status.duration),
        status.playing ? '1' : '0',
        status.didJustFinish ? '1' : '0',
      ].join(':');
      if (lastUiKeyRef.current === uiKey) return;
      lastUiKeyRef.current = uiKey;
      setPlaybackStatus({
        activeSegmentId: activeSegment?.id ?? null,
        activeWordTimingId,
        currentTime: status.currentTime,
        didJustFinish: status.didJustFinish,
        duration: status.duration,
        playing: status.playing,
        scrollTargetSegmentId: anticipatedSegment?.id ?? null,
      });
    });
    return () => subscription.remove();
  }, [currentItem, player]);

  useEffect(() => {
    if (!currentAudioUrl) {
      setPlayableAudioUrl(null);
      setIsAudioCaching(false);
      return;
    }

    let cancelled = false;
    const cacheAudio = async () => {
      setIsAudioCaching(true);
      const cachedUri = await getCachedAudioUri(currentAudioUrl);
      if (!cancelled) {
        setPlayableAudioUrl(cachedUri ?? currentAudioUrl);
      }
      if (!cachedUri) {
        await ensureAudioCached(currentAudioUrl).catch(() => null);
      }
      if (!cancelled) {
        setIsAudioCaching(false);
      }
      if (nextAudioUrl) {
        void prefetchAudio(resolveApiAssetUrl(nextAudioUrl));
      }
    };

    void cacheAudio();
    return () => {
      cancelled = true;
    };
  }, [currentAudioUrl, nextAudioUrl]);

  return { isAudioCaching, playableAudioUrl, playbackStatus, player };
}
