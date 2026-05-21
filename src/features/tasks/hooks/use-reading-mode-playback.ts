import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { CONTIGUOUS_RANGE_TOLERANCE_MS } from '@/src/features/tasks/constants/task-runner';
import {
  buildReadingModeScript,
  type PlaybackRange,
} from '@/src/features/tasks/services/reading-mode-script';
import { wait } from '@/src/features/tasks/services/task-runner-helpers';
import type { LessonItem, ReadingModeId, ReadingModeSettings } from '@/src/types/domain';

type AudioPlayer = ReturnType<typeof useAudioPlayer>;
type AudioPlayerStatus = ReturnType<typeof useAudioPlayerStatus>;

export function useReadingModePlayback({
  currentItem,
  durationSeconds,
  getSegmentIdAtMs,
  playableAudioUrl,
  player,
  playbackStatus,
  scrollToSegment,
  setNotice,
  triggerTranslationHeartbeat,
  unknownNormalizedWords,
}: {
  currentItem: LessonItem | undefined;
  durationSeconds: number;
  getSegmentIdAtMs: (positionMs: number) => string | null;
  playableAudioUrl: string | null;
  player: AudioPlayer;
  playbackStatus: AudioPlayerStatus;
  scrollToSegment: (segmentId: string | null, animated?: boolean) => void;
  setNotice: (notice: string | null) => void;
  triggerTranslationHeartbeat: (normalizedWord: string, durationMs: number) => void;
  unknownNormalizedWords: Set<string>;
}) {
  const [activeModeId, setActiveModeId] = useState<ReadingModeId | null>(null);
  const modePlaybackRunIdRef = useRef(0);

  const cancelModePlayback = useCallback(
    ({ pause = true }: { pause?: boolean } = {}) => {
      modePlaybackRunIdRef.current += 1;
      if (pause) {
        player.pause();
      }
      setActiveModeId(null);
    },
    [player],
  );

  useEffect(() => {
    if (playbackStatus.didJustFinish) {
      cancelModePlayback({ pause: false });
    }
  }, [cancelModePlayback, playbackStatus.didJustFinish]);

  const getModeDisabledReason = useCallback(
    (modeId: ReadingModeId) => {
      if (!playableAudioUrl) {
        return 'This item does not have a playable audio source yet.';
      }
      if (modeId === 'teaching' && !currentItem?.wordTimings?.length) {
        return 'Teaching needs word timing ranges for this item.';
      }
      if (
        modeId === 'deep_learning' &&
        (!currentItem?.wordTimings?.length || !currentItem?.sentenceTimings?.length)
      ) {
        return 'Deep Learning needs word and sentence timing ranges for this item.';
      }
      return null;
    },
    [currentItem?.sentenceTimings?.length, currentItem?.wordTimings?.length, playableAudioUrl],
  );

  const runRangeScript = useCallback(
    async (ranges: PlaybackRange[], runId: number) => {
      let previousEndMs: number | null = null;
      for (const range of ranges) {
        if (modePlaybackRunIdRef.current !== runId) return;
        scrollToSegment(getSegmentIdAtMs(range.startMs));
        const canContinueFromPrevious =
          previousEndMs !== null &&
          Math.abs(previousEndMs - range.startMs) <= CONTIGUOUS_RANGE_TOLERANCE_MS;
        if (!canContinueFromPrevious) {
          player.pause();
          await player.seekTo(range.startMs / 1000, 0, 0);
        }
        if (modePlaybackRunIdRef.current !== runId) return;
        const pulseTimers: ReturnType<typeof setTimeout>[] = [];
        if (range.pulseTargets?.length) {
          for (const target of range.pulseTargets) {
            const delayMs = Math.max(0, target.startMs - range.startMs);
            const pulseDurationMs = Math.max(1, target.endMs - target.startMs);
            const timer = setTimeout(() => {
              if (modePlaybackRunIdRef.current !== runId) return;
              triggerTranslationHeartbeat(target.normalizedWord, pulseDurationMs);
            }, delayMs);
            pulseTimers.push(timer);
          }
        }
        player.play();
        await wait(range.endMs - range.startMs);
        pulseTimers.forEach(clearTimeout);
        if (modePlaybackRunIdRef.current !== runId) return;
        previousEndMs = range.endMs;
      }
      player.pause();
      if (modePlaybackRunIdRef.current === runId) {
        setActiveModeId(null);
      }
    },
    [getSegmentIdAtMs, player, scrollToSegment, triggerTranslationHeartbeat],
  );

  const handleToggleReadingMode = useCallback(
    (mode: ReadingModeSettings) => {
      const disabledReason = getModeDisabledReason(mode.id);
      if (disabledReason) {
        setNotice(disabledReason);
        return;
      }

      modePlaybackRunIdRef.current += 1;
      const runId = modePlaybackRunIdRef.current;

      if (activeModeId === mode.id) {
        player.pause();
        setActiveModeId(null);
        return;
      }

      setNotice(null);
      setActiveModeId(mode.id);

      if (mode.id === 'introduction') {
        scrollToSegment(getSegmentIdAtMs(0), false);
        void player.seekTo(0).then(() => {
          if (modePlaybackRunIdRef.current !== runId) return;
          player.play();
        });
        return;
      }

      const ranges = currentItem
        ? buildReadingModeScript({
            currentItem,
            durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
            mode,
            unknownNormalizedWords,
          })
        : [];

      if (!ranges.length) {
        setNotice('This mode needs timing ranges before it can play.');
        setActiveModeId(null);
        return;
      }

      scrollToSegment(getSegmentIdAtMs(ranges[0].startMs), false);
      void runRangeScript(ranges, runId);
    },
    [
      activeModeId,
      currentItem,
      durationSeconds,
      getModeDisabledReason,
      getSegmentIdAtMs,
      player,
      runRangeScript,
      scrollToSegment,
      setNotice,
      unknownNormalizedWords,
    ],
  );

  return {
    activeModeId,
    cancelModePlayback,
    getModeDisabledReason,
    handleToggleReadingMode,
  };
}
