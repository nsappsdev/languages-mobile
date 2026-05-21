import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import type { LearnerVocabularyItem, LessonItemSegment, VocabularyEntry } from '@/src/types/domain';

export function createVocabularyLookup(items: LearnerVocabularyItem[]) {
  return items.reduce<Record<string, LearnerVocabularyItem>>((acc, item) => {
    const normalized = normalizeVocabularySelection(item.entry.englishText);
    if (normalized) {
      acc[normalized] = item;
    }
    return acc;
  }, {});
}

export function buildEntryCacheByText(entries: VocabularyEntry[]) {
  return entries.reduce<Record<string, VocabularyEntry>>((acc, entry) => {
    const normalized = normalizeVocabularySelection(entry.englishText);
    if (normalized) {
      acc[normalized] = entry;
    }
    return acc;
  }, {});
}

export function calculateCompletion(completedItemIds: Record<string, true>, totalItems: number) {
  if (!totalItems) {
    return 0;
  }

  return Math.round((Object.keys(completedItemIds).length / totalItems) * 100);
}

export function createIdempotencyKey(eventType: string, lessonId: string, lessonItemId?: string) {
  return `${eventType}:${lessonId}:${lessonItemId ?? 'lesson'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(value);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(ms, 120));
  });
}

export function calculateCenteredSegmentScrollOffset({
  segmentBottom,
  segmentTop,
  viewportHeight,
  wordFlowOffsetY,
}: {
  segmentBottom: number;
  segmentTop: number;
  viewportHeight: number;
  wordFlowOffsetY: number;
}) {
  const segmentCenter = wordFlowOffsetY + (segmentTop + segmentBottom) / 2;
  const centeredOffset =
    viewportHeight > 0 ? segmentCenter - viewportHeight / 2 : wordFlowOffsetY + segmentTop;
  return Math.max(0, centeredOffset);
}

export function getAnticipatedSegmentId({
  lookaheadMs,
  positionMs,
  segments,
}: {
  lookaheadMs: number;
  positionMs: number;
  segments: LessonItemSegment[];
}) {
  if (!segments.length) {
    return null;
  }

  const anticipatedPositionMs = positionMs + lookaheadMs;
  const anticipatedSegment = segments.find(
    (segment) =>
      anticipatedPositionMs >= segment.startMs && anticipatedPositionMs < segment.endMs,
  );
  if (anticipatedSegment) {
    return anticipatedSegment.id;
  }

  const currentSegment = segments.find(
    (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
  );
  if (currentSegment) {
    return currentSegment.id;
  }

  const nextSegment = segments.find((segment) => segment.startMs > positionMs);
  return nextSegment?.id ?? null;
}
