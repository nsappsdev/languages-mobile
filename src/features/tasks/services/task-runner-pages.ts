import type { LessonItemSegment } from '@/src/types/domain';

export type RunnerSentencePage = {
  endMs: number | null;
  id: string;
  segmentId: string | null;
  startMs: number | null;
  tokenIndices: number[];
};

export function buildRunnerSentencePages({
  segments,
  tokenCount,
  tokenSegmentIds,
}: {
  segments: readonly LessonItemSegment[];
  tokenCount: number;
  tokenSegmentIds: readonly (string | null)[];
}): RunnerSentencePage[] {
  const pages: RunnerSentencePage[] = [];

  for (const segment of [...segments].sort((left, right) => left.startMs - right.startMs)) {
    const tokenIndices: number[] = [];
    for (let index = 0; index < tokenCount; index += 1) {
      if (tokenSegmentIds[index] === segment.id) tokenIndices.push(index);
    }

    if (!tokenIndices.length) continue;
    pages.push({
      endMs: segment.endMs,
      id: segment.id,
      segmentId: segment.id,
      startMs: segment.startMs,
      tokenIndices: fillTokenRange(tokenIndices),
    });
  }

  if (pages.length) return pages;
  if (!tokenCount) return [];

  return [
    {
      endMs: null,
      id: 'full-item',
      segmentId: null,
      startMs: null,
      tokenIndices: Array.from({ length: tokenCount }, (_, index) => index),
    },
  ];
}

export function resolveRunnerSentencePageIndex({
  activeSegmentId,
  currentIndex,
  pages,
}: {
  activeSegmentId: string | null;
  currentIndex: number;
  pages: readonly RunnerSentencePage[];
}) {
  if (!pages.length) return 0;
  const activeIndex = activeSegmentId
    ? pages.findIndex((page) => page.segmentId === activeSegmentId)
    : -1;
  if (activeIndex >= 0) return activeIndex;
  return Math.min(Math.max(currentIndex, 0), pages.length - 1);
}

export function getPagedPlaybackSegmentId({
  positionMs,
  segments,
}: {
  positionMs: number;
  segments: readonly LessonItemSegment[];
}) {
  if (!segments.length) return null;
  const orderedSegments = [...segments].sort((left, right) => left.startMs - right.startMs);
  const active = orderedSegments.find(
    (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
  );
  if (active) return active.id;

  const upcoming = orderedSegments.find((segment) => segment.startMs > positionMs);
  if (upcoming) return upcoming.id;

  return orderedSegments[orderedSegments.length - 1]?.id ?? null;
}

export function getPagedReaderFontSize(wordCount: number, configuredSize: number) {
  const bookSize =
    wordCount > 28
      ? 18
      : wordCount > 20
        ? 19
        : wordCount > 14
          ? 21
          : wordCount > 9
            ? 24
            : wordCount > 5
              ? 27
              : 30;
  return Math.max(configuredSize, bookSize);
}

function fillTokenRange(indices: readonly number[]) {
  const first = indices[0];
  const last = indices[indices.length - 1];
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}
