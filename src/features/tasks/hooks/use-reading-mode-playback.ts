import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { CONTIGUOUS_RANGE_TOLERANCE_MS } from '@/src/features/tasks/constants/task-runner';
import {
  buildReadingModeScript,
  resumePlaybackRanges,
  type PlaybackRange,
} from '@/src/features/tasks/services/reading-mode-script';
import {
  playUntilPosition,
  seekToVerifiedPosition,
  traceReadingModePlayback,
  type PositionAwarePlayer,
} from '@/src/features/tasks/services/reading-mode-player';
import { buildPulseSchedule } from '@/src/features/tasks/services/reading-mode-playback-schedule';
import { wait } from '@/src/features/tasks/services/task-runner-helpers';
import type { LessonItem, ReadingModeId, ReadingModeSettings } from '@/src/types/domain';

type AudioPlayer = ReturnType<typeof useAudioPlayer>;
type AudioPlayerStatus = {
  currentTime: number;
  didJustFinish: boolean;
  duration: number;
  playing: boolean;
};

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
    stepId: string;
  } | null>(null);
  const activeModeSettingsRef = useRef<ReadingModeSettings | null>(null);

  const cancelModePlayback = useCallback(
    ({ pause = true }: { pause?: boolean } = {}) => {
      modePlaybackRunIdRef.current += 1;
      if (pause) {
        player.pause();
      }
      setActiveModeId(null);
      modePlaybackProgressRef.current = null;
      activeModeSettingsRef.current = null;
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
    ) => {
      let previousEndMs: number | null = null;
      for (let rangeOffset = 0; rangeOffset < ranges.length; rangeOffset += 1) {
        const range = ranges[rangeOffset];
        if (modePlaybackRunIdRef.current !== runId) return;
        modePlaybackProgressRef.current = {
          modeId,
          stepId: range.id,
        };
        traceReadingModePlayback('step-start', {
          actualPositionMs: Math.round(player.currentStatus.currentTime * 1000),
          endMs: range.endMs,
          kind: range.kind,
          modeId,
          startMs: range.startMs,
          stepId: range.id,
        });
        scrollToSegment(getSegmentIdAtMs(range.startMs));
        const positionMs = player.currentStatus.currentTime * 1000;
        const canContinueFromPrevious =
          previousEndMs !== null &&
          Math.abs(previousEndMs - range.startMs) <= CONTIGUOUS_RANGE_TOLERANCE_MS &&
          Math.abs(positionMs - range.startMs) <= CONTIGUOUS_RANGE_TOLERANCE_MS;
        if (!canContinueFromPrevious) {
          const positioned = await seekToVerifiedPosition({
            isCancelled: () => modePlaybackRunIdRef.current !== runId,
            player: player as PositionAwarePlayer,
            positionMs: range.startMs,
          });
          if (!positioned) {
            traceReadingModePlayback('seek-failed', {
              actualPositionMs: Math.round(player.currentStatus.currentTime * 1000),
              requestedPositionMs: range.startMs,
              stepId: range.id,
            });
            if (modePlaybackRunIdRef.current === runId) {
              setNotice('Audio could not reach the requested timing. Please retry.');
              cancelModePlayback();
            }
            return;
          }
        }
        if (modePlaybackRunIdRef.current !== runId) return;
        const pulseTimers: ReturnType<typeof setTimeout>[] = [];
        for (const pulse of buildPulseSchedule(range)) {
          if (pulse.immediate) {
            triggerTranslationHeartbeat(pulse.target.normalizedWord, pulse.durationMs);
            continue;
          }

          const timer = setTimeout(() => {
            if (modePlaybackRunIdRef.current !== runId) return;
            triggerTranslationHeartbeat(pulse.target.normalizedWord, pulse.durationMs);
          }, pulse.delayMs);
          pulseTimers.push(timer);
        }
        const reachedEnd = await playUntilPosition({
          endMs: range.endMs,
          isCancelled: () => modePlaybackRunIdRef.current !== runId,
          player: player as PositionAwarePlayer,
        });
        pulseTimers.forEach(clearTimeout);
        if (modePlaybackRunIdRef.current !== runId) return;
        if (!reachedEnd) {
          traceReadingModePlayback('range-failed', {
            actualPositionMs: Math.round(player.currentStatus.currentTime * 1000),
            expectedEndMs: range.endMs,
            stepId: range.id,
          });
          setNotice('Audio playback did not reach the expected timing. Please retry.');
          cancelModePlayback();
          return;
        }
        traceReadingModePlayback('range-end', {
          actualPositionMs: Math.round(player.currentStatus.currentTime * 1000),
          expectedEndMs: range.endMs,
          stepId: range.id,
        });
        if (range.pauseAfterMs && range.pauseAfterMs > 0) {
          await wait(range.pauseAfterMs);
          if (modePlaybackRunIdRef.current !== runId) return;
        }
        previousEndMs = range.endMs;
      }
      player.pause();
      if (modePlaybackRunIdRef.current === runId) {
        setActiveModeId(null);
        modePlaybackProgressRef.current = null;
        activeModeSettingsRef.current = null;
      }
    },
    [
      cancelModePlayback,
      getSegmentIdAtMs,
      player,
      scrollToSegment,
      setNotice,
      triggerTranslationHeartbeat,
    ],
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
        activeModeSettingsRef.current = mode;

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
        const resumeMs = Math.max(0, Math.round(player.currentStatus.currentTime * 1000));
        const progress = modePlaybackProgressRef.current;
        const resumed = resumePlaybackRanges({
          preferredStepId: progress?.modeId === mode.id ? progress.stepId : null,
          ranges,
          resumeMs,
        });

        if (!resumed.ranges.length) {
          setActiveModeId(null);
          modePlaybackProgressRef.current = null;
          return;
        }

        scrollToSegment(getSegmentIdAtMs(resumed.ranges[0].startMs), false);
        void runRangeScript(mode.id, resumed.ranges, runId);
        return;
      }

      setNotice(null);
      setActiveModeId(mode.id);
      activeModeSettingsRef.current = mode;
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
        activeModeSettingsRef.current = null;
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
      playbackStatus.playing,
      runRangeScript,
      scrollToSegment,
      setNotice,
      unknownNormalizedWords,
      wordRepetitionPauseMs,
    ],
  );

  const seekActiveModeToMs = useCallback(
    (positionMs: number) => {
      const mode = activeModeSettingsRef.current;
      if (!mode || !currentItem) {
        return false;
      }

      modePlaybackRunIdRef.current += 1;
      const runId = modePlaybackRunIdRef.current;
      setNotice(null);
      setActiveModeId(mode.id);

      if (mode.id === 'introduction') {
        scrollToSegment(getSegmentIdAtMs(positionMs), false);
        void player.seekTo(positionMs / 1000).then(() => {
          if (modePlaybackRunIdRef.current !== runId) return;
          player.play();
        });
        return true;
      }

      const ranges = buildReadingModeScript({
        currentItem,
        durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
        focusNormalizedByText,
        mode,
        unknownNormalizedWords,
        wordRepetitionPauseMs,
      });
      const resumed = resumePlaybackRanges({
        ranges,
        resumeMs: Math.max(0, positionMs),
      });

      if (!resumed.ranges.length) {
        setActiveModeId(null);
        modePlaybackProgressRef.current = null;
        activeModeSettingsRef.current = null;
        return false;
      }

      scrollToSegment(getSegmentIdAtMs(resumed.ranges[0].startMs), false);
      void runRangeScript(mode.id, resumed.ranges, runId);
      return true;
    },
    [
      currentItem,
      durationSeconds,
      focusNormalizedByText,
      getSegmentIdAtMs,
      player,
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
    seekActiveModeToMs,
  };
}
