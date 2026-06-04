import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { CONTIGUOUS_RANGE_TOLERANCE_MS } from '@/src/features/tasks/constants/task-runner';
import {
  buildReadingModeScript,
  getPulseDurationMs,
  resumePlaybackRanges,
  type PlaybackRange,
} from '@/src/features/tasks/services/reading-mode-script';
import { wait } from '@/src/features/tasks/services/task-runner-helpers';
import type { LessonItem, ReadingModeId, ReadingModeSettings } from '@/src/types/domain';

type AudioPlayer = ReturnType<typeof useAudioPlayer>;
type AudioPlayerStatus = ReturnType<typeof useAudioPlayerStatus>;

export function useReadingModePlayback({
  currentItem,
  durationSeconds,
  focusNormalizedByText,
  getSegmentIdAtMs,
  playableAudioUrl,
  player,
  playbackStatus,
  scrollToSegment,
  setNotice,
  triggerTranslationHeartbeat,
  unknownNormalizedWords,
  wordRepetitionPauseMs,
}: {
  currentItem: LessonItem | undefined;
  durationSeconds: number;
  focusNormalizedByText: Record<string, string | undefined>;
  getSegmentIdAtMs: (positionMs: number) => string | null;
  playableAudioUrl: string | null;
  player: AudioPlayer;
  playbackStatus: AudioPlayerStatus;
  scrollToSegment: (segmentId: string | null, animated?: boolean) => void;
  setNotice: (notice: string | null) => void;
  triggerTranslationHeartbeat: (normalizedWord: string, durationMs: number) => void;
  unknownNormalizedWords: Set<string>;
  wordRepetitionPauseMs: number;
}) {
  const [activeModeId, setActiveModeId] = useState<ReadingModeId | null>(null);
  const modePlaybackRunIdRef = useRef(0);
  const modePlaybackProgressRef = useRef<{
    modeId: ReadingModeId;
    rangeIndex: number;
  } | null>(null);

  const cancelModePlayback = useCallback(
    ({ pause = true }: { pause?: boolean } = {}) => {
      modePlaybackRunIdRef.current += 1;
      if (pause) {
        player.pause();
      }
      setActiveModeId(null);
      modePlaybackProgressRef.current = null;
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
    async (
      modeId: ReadingModeId,
      ranges: PlaybackRange[],
      runId: number,
      baseRangeIndex = 0,
    ) => {
      let previousEndMs: number | null = null;
      for (let rangeOffset = 0; rangeOffset < ranges.length; rangeOffset += 1) {
        const range = ranges[rangeOffset];
        if (modePlaybackRunIdRef.current !== runId) return;
        modePlaybackProgressRef.current = {
          modeId,
          rangeIndex: baseRangeIndex + rangeOffset,
        };
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
            const pulseDurationMs = getPulseDurationMs(range, target);
            if (delayMs <= CONTIGUOUS_RANGE_TOLERANCE_MS) {
              triggerTranslationHeartbeat(target.normalizedWord, pulseDurationMs);
              continue;
            }

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
        if (range.pauseAfterMs && range.pauseAfterMs > 0) {
          player.pause();
          await wait(range.pauseAfterMs);
          if (modePlaybackRunIdRef.current !== runId) return;
        }
        previousEndMs = range.endMs;
      }
      player.pause();
      if (modePlaybackRunIdRef.current === runId) {
        setActiveModeId(null);
        modePlaybackProgressRef.current = null;
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

      if (activeModeId === mode.id && playbackStatus.playing) {
        player.pause();
        return;
      }

      if (activeModeId === mode.id && !playbackStatus.playing) {
        setNotice(null);

        if (mode.id === 'introduction') {
          player.play();
          return;
        }

        const ranges = currentItem
          ? buildReadingModeScript({
              currentItem,
              durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
              focusNormalizedByText,
              mode,
              unknownNormalizedWords,
              wordRepetitionPauseMs,
            })
          : [];
        const resumeMs = Math.max(0, Math.round((playbackStatus.currentTime ?? 0) * 1000));
        const progress = modePlaybackProgressRef.current;
        const resumed = resumePlaybackRanges({
          preferredRangeIndex: progress?.modeId === mode.id ? progress.rangeIndex : null,
          ranges,
          resumeMs,
        });

        if (!resumed.ranges.length) {
          setActiveModeId(null);
          modePlaybackProgressRef.current = null;
          return;
        }

        scrollToSegment(getSegmentIdAtMs(resumed.ranges[0].startMs), false);
        void runRangeScript(mode.id, resumed.ranges, runId, resumed.startIndex);
        return;
      }

      setNotice(null);
      setActiveModeId(mode.id);
      modePlaybackProgressRef.current = null;

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
            focusNormalizedByText,
            mode,
            unknownNormalizedWords,
            wordRepetitionPauseMs,
          })
        : [];

      if (!ranges.length) {
        setNotice('This mode needs timing ranges before it can play.');
        setActiveModeId(null);
        return;
      }

      scrollToSegment(getSegmentIdAtMs(ranges[0].startMs), false);
      void runRangeScript(mode.id, ranges, runId);
    },
    [
      activeModeId,
      currentItem,
      durationSeconds,
      focusNormalizedByText,
      getModeDisabledReason,
      getSegmentIdAtMs,
      player,
      playbackStatus.currentTime,
      playbackStatus.playing,
      runRangeScript,
      scrollToSegment,
      setNotice,
      unknownNormalizedWords,
      wordRepetitionPauseMs,
    ],
  );

  return {
    activeModeId,
    cancelModePlayback,
    getModeDisabledReason,
    handleToggleReadingMode,
  };
}
