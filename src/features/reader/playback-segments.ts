import type { PlaybackStep } from './model';
import type { PreparedAudio } from './prepared-audio';

export type PlaybackSegment = { steps: PlaybackStep[]; start: number; end: number; padEnd: boolean };

export function playbackSegments(steps: PlaybackStep[]): PlaybackSegment[] {
  const groups: PlaybackStep[][] = [];
  for (const step of steps) {
    if (!groups.length || groups.at(-1)![0].segmentId !== step.segmentId) groups.push([]);
    groups.at(-1)!.push(step);
  }
  return groups.map((group, index) => {
    const natural = group.filter(step => step.channel !== 'drill');
    return { steps: group, start: natural[0]?.narrationSample ?? group[0].narrationSample,
      end: natural.length ? Math.max(...natural.map(step => step.endSample + (step.timelineOffset ?? 0))) : group.at(-1)!.narrationSample,
      padEnd: index < groups.length - 1 && !!group.at(-1)!.pauseAfter };
  });
}

export function segmentAt(segments: PlaybackSegment[], sample: number) {
  const found = segments.findIndex(segment => sample < segment.end);
  return found < 0 ? 0 : found;
}

/** Seek into the first natural pass, skipping drills before the requested word. */
export function frameAtSample(track: PreparedAudio, sample: number) {
  const natural = track.spans.filter(span => !span.silence && span.step.channel !== 'drill');
  const span = natural.find(item => item.sourceEnd + (item.step.timelineOffset ?? 0) > sample);
  if (!span) return natural.length ? track.frameCount : 0;
  return span.start + Math.max(0, sample - (span.step.timelineOffset ?? 0) - span.sourceStart);
}

export function segmentKey(segment: PlaybackSegment, pauseMs: number, publicationId: string) {
  return JSON.stringify([publicationId, pauseMs, segment.padEnd, segment.steps]);
}
