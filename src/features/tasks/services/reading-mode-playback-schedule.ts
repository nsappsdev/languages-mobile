import { CONTIGUOUS_RANGE_TOLERANCE_MS } from '@/src/features/tasks/constants/task-runner';
import {
  getPulseDurationMs,
  type PlaybackRange,
  type PulseTarget,
} from '@/src/features/tasks/services/reading-mode-script';

export type PulseScheduleItem = {
  delayMs: number;
  durationMs: number;
  immediate: boolean;
  target: PulseTarget;
};

export function buildPulseSchedule(range: PlaybackRange): PulseScheduleItem[] {
  return (range.pulseTargets ?? []).map((target) => {
    const delayMs = Math.max(0, target.startMs - range.startMs);
    return {
      delayMs,
      durationMs: getPulseDurationMs(range, target),
      immediate: delayMs <= CONTIGUOUS_RANGE_TOLERANCE_MS,
      target,
    };
  });
}
