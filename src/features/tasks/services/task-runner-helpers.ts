import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { MAX_VOCABULARY_TOKEN_MATCH_WORDS } from '@/src/features/tasks/constants/task-runner';
import type {
  LearnerVocabularyItem,
  LessonItemSegment,
  VocabularyEntry,
} from '@/src/types/domain';
import type { LessonWordToken } from '@/src/features/tasks/screens/task-runner-words';

export type VocabularyTokenMatch = {
  entry: VocabularyEntry;
  focusNormalizedText: string | null;
  focusTokenIndex: number | null;
  normalizedText: string;
  startIndex: number;
  endIndex: number;
  tokenIndices: number[];
};

export function createVocabularyLookup(items: LearnerVocabularyItem[]) {
  return items.reduce<Record<string, LearnerVocabularyItem>>((acc, item) => {
    const normalized = normalizeVocabularySelection(item.entry.englishText);
    if (normalized) {
      acc[normalized] = item;
    }
    return acc;
  }, {});
}

export function createSavedUnknownVocabularyLookup(items: LearnerVocabularyItem[]) {
  return createVocabularyLookup(items.filter((item) => item.status === 'LEARNING'));
}

export function buildEntryCacheByText(entries: VocabularyEntry[]) {
  return entries.reduce<Record<string, VocabularyEntry>>((acc, entry) => {
    const normalized = entry.normalizedText ?? normalizeVocabularySelection(entry.englishText);
    if (normalized) {
      acc[normalized] = entry;
    }
    return acc;
  }, {});
}

export function buildVocabularyTokenMatches(
  tokens: LessonWordToken[],
  entries: VocabularyEntry[],
): (VocabularyTokenMatch | null)[] {
  const matchesByToken = tokens.map(() => null as VocabularyTokenMatch | null);
  const candidates = entries
    .filter((entry) => entry.kind !== 'SENTENCE')
    .map((entry) => {
      const normalized = entry.normalizedText ?? normalizeVocabularySelection(entry.englishText);
      return {
        entry,
        normalized,
        parts: normalized?.split(/\s+/).filter(Boolean) ?? [],
      };
    })
    .filter(
      (candidate) =>
        candidate.normalized &&
        candidate.parts.length > 0 &&
        candidate.parts.length <= MAX_VOCABULARY_TOKEN_MATCH_WORDS,
    )
    .sort((left, right) => right.parts.length - left.parts.length);

  for (let index = 0; index < tokens.length; index += 1) {
    if (!tokens[index]?.normalized || matchesByToken[index]) {
      continue;
    }

    for (const candidate of candidates) {
      const tokenIndices = collectMatchingTokenIndices(tokens, index, candidate.parts);
      if (!tokenIndices || tokenIndices.some((tokenIndex) => matchesByToken[tokenIndex])) {
        continue;
      }

      const match: VocabularyTokenMatch = {
        entry: candidate.entry,
        focusNormalizedText: candidate.entry.focusNormalizedText ?? null,
        focusTokenIndex: getFocusTokenIndex(tokens, tokenIndices, candidate.entry.focusNormalizedText),
        normalizedText: candidate.normalized!,
        startIndex: tokenIndices[0],
        endIndex: tokenIndices[tokenIndices.length - 1],
        tokenIndices,
      };
      tokenIndices.forEach((tokenIndex) => {
        matchesByToken[tokenIndex] = match;
      });
      break;
    }
  }

  return matchesByToken;
}

function getFocusTokenIndex(
  tokens: LessonWordToken[],
  tokenIndices: number[],
  focusNormalizedText?: string | null,
) {
  if (!focusNormalizedText) {
    return null;
  }
  return (
    tokenIndices.find((tokenIndex) => tokens[tokenIndex]?.normalized === focusNormalizedText) ?? null
  );
}

function collectMatchingTokenIndices(
  tokens: LessonWordToken[],
  startIndex: number,
  parts: string[],
) {
  const tokenIndices: number[] = [];
  let cursor = startIndex;

  for (const part of parts) {
    while (cursor < tokens.length && !tokens[cursor]?.normalized) {
      cursor += 1;
    }
    if (tokens[cursor]?.normalized !== part) {
      return null;
    }
    tokenIndices.push(cursor);
    cursor += 1;
  }

  return tokenIndices;
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

export function calculateTopSegmentScrollOffset({
  topPadding,
  segmentTop,
  wordFlowOffsetY,
}: {
  topPadding: number;
  segmentTop: number;
  wordFlowOffsetY: number;
}) {
  return Math.max(0, wordFlowOffsetY + segmentTop - topPadding);
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
