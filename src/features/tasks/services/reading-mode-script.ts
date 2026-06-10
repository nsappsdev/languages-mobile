import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

export type PlaybackStepKind = 'continuous' | 'word_repeat' | 'sentence_repeat';

export type PlaybackRange = {
  id: string;
  kind: PlaybackStepKind;
  startMs: number;
  endMs: number;
  pauseAfterMs?: number;
  pulseTargets?: PulseTarget[];
  repetitionIndex?: number;
};

export type PulseTarget = {
  normalizedWord: string;
  startMs: number;
  endMs: number;
};

type RepeatTimingRange = {
  id: string;
  text: string;
  normalizedText: string;
  startMs: number;
  endMs: number;
  timingWords: TimingWord[];
  wordMarkIds: string[];
};

type TimingWord = {
  id: string;
  endMs: number;
  normalizedText: string;
  startMs: number;
  text: string;
};

export function buildReadingModeScript({
  currentItem,
  durationMs,
  mode,
  focusNormalizedByText = {},
  unknownNormalizedWords,
  wordRepetitionPauseMs = 0,
}: {
  currentItem: LessonItem;
  durationMs: number;
  focusNormalizedByText?: Record<string, string | undefined>;
  mode: ReadingModeSettings;
  unknownNormalizedWords: Set<string>;
  wordRepetitionPauseMs?: number;
}): PlaybackRange[] {
  const timelineEndMs =
    durationMs > 0
      ? durationMs
      : Math.max(0, ...currentItem.segments.map((segment) => segment.endMs));
  const unknownRanges = buildUnknownRepeatRanges(currentItem, unknownNormalizedWords);
  const wordRepeatCount = Math.max(1, mode.unknownWordRepetitions ?? 1);
  const ranges: PlaybackRange[] = [];

  if (mode.id !== 'deep_learning') {
    appendTeachingWindow({
      endMs: timelineEndMs,
      focusNormalizedByText,
      ranges,
      repeatRanges: unknownRanges,
      startMs: 0,
      wordRepeatCount,
      wordRepetitionPauseMs,
    });
    return ranges;
  }

  const sentences = [...(currentItem.sentenceTimings ?? [])].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
  );
  const threshold = Math.max(1, mode.repeatSentenceWhenUnknownCountAtLeast ?? 2);
  const sentenceRepeatCount = Math.max(1, mode.sentenceRepetitions ?? 2);
  let cursorMs = 0;

  for (const sentence of sentences) {
    if (sentence.endMs <= cursorMs || sentence.startMs >= timelineEndMs) continue;
    const sentenceStartMs = Math.max(cursorMs, sentence.startMs);
    if (sentenceStartMs > cursorMs) {
      appendTeachingWindow({
        endMs: sentenceStartMs,
        focusNormalizedByText,
        ranges,
        repeatRanges: unknownRanges,
        startMs: cursorMs,
        wordRepeatCount,
        wordRepetitionPauseMs,
      });
    }

    const sentenceEndMs = Math.min(timelineEndMs, sentence.endMs);
    appendTeachingWindow({
      endMs: sentenceEndMs,
      focusNormalizedByText,
      ranges,
      repeatRanges: unknownRanges,
      startMs: sentenceStartMs,
      wordRepeatCount,
      wordRepetitionPauseMs,
    });

    const sentenceWordIds = new Set(sentence.wordMarkIds);
    const unknownCount = new Set(
      unknownRanges
        .filter((range) => range.startMs >= sentenceStartMs && range.startMs < sentenceEndMs)
        .flatMap((range) => range.wordMarkIds)
        .filter((wordMarkId) => sentenceWordIds.has(wordMarkId)),
    ).size;
    if (unknownCount >= threshold) {
      for (let index = 0; index < sentenceRepeatCount; index += 1) {
        ranges.push({
          id: `sentence:${sentence.id}:${index + 1}`,
          kind: 'sentence_repeat',
          startMs: sentence.startMs,
          endMs: sentence.endMs,
          repetitionIndex: index + 1,
        });
      }
    }
    cursorMs = sentenceEndMs;
  }

  if (cursorMs < timelineEndMs) {
    appendTeachingWindow({
      endMs: timelineEndMs,
      focusNormalizedByText,
      ranges,
      repeatRanges: unknownRanges,
      startMs: cursorMs,
      wordRepeatCount,
      wordRepetitionPauseMs,
    });
  }

  return ranges.filter((range) => range.endMs > range.startMs);
}

export function resumePlaybackRanges({
  preferredStepId,
  ranges,
  resumeMs,
}: {
  preferredStepId?: string | null;
  ranges: PlaybackRange[];
  resumeMs: number;
}) {
  const preferredIndex = preferredStepId
    ? ranges.findIndex((range) => range.id === preferredStepId)
    : -1;
  const startIndex =
    preferredIndex >= 0 && ranges[preferredIndex].endMs > resumeMs
      ? preferredIndex
      : ranges.findIndex((range) => range.endMs > resumeMs);

  if (startIndex < 0 || startIndex >= ranges.length) {
    return { ranges: [], startIndex: ranges.length };
  }

  const resumedRanges = ranges.slice(startIndex).map((range) => ({ ...range }));
  const firstRange = resumedRanges[0];
  if (
    resumeMs > firstRange.startMs &&
    resumeMs < firstRange.endMs &&
    firstRange.kind === 'continuous'
  ) {
    resumedRanges[0].startMs = resumeMs;
  }

  return { ranges: resumedRanges, startIndex };
}

export function getPulseDurationMs(range: PlaybackRange, target: PulseTarget) {
  const pulseStartMs = Math.max(range.startMs, target.startMs);
  return Math.max(1, range.endMs - pulseStartMs + (range.pauseAfterMs ?? 0));
}

function appendTeachingWindow({
  endMs,
  focusNormalizedByText,
  ranges,
  repeatRanges,
  startMs,
  wordRepeatCount,
  wordRepetitionPauseMs,
}: {
  endMs: number;
  focusNormalizedByText: Record<string, string | undefined>;
  ranges: PlaybackRange[];
  repeatRanges: RepeatTimingRange[];
  startMs: number;
  wordRepeatCount: number;
  wordRepetitionPauseMs: number;
}) {
  let cursorMs = startMs;
  const windowRanges = repeatRanges.filter(
    (range) => range.startMs >= startMs && range.startMs < endMs && range.endMs <= endMs,
  );

  for (const mark of windowRanges) {
    if (mark.endMs <= cursorMs) continue;
    if (mark.startMs > cursorMs) {
      ranges.push(createContinuousRange(cursorMs, mark.startMs));
    }
    for (let index = 0; index < wordRepeatCount; index += 1) {
      ranges.push(
        createWordOrPhraseRange({
          focusNormalizedText: focusNormalizedByText[mark.normalizedText],
          mark,
          pauseAfterMs: index < wordRepeatCount - 1 ? wordRepetitionPauseMs : 0,
          repetitionIndex: index + 1,
        }),
      );
    }
    cursorMs = Math.max(cursorMs, mark.endMs);
  }

  if (endMs > cursorMs) {
    ranges.push(createContinuousRange(cursorMs, endMs));
  }
}

function createContinuousRange(startMs: number, endMs: number): PlaybackRange {
  return {
    id: `continuous:${startMs}:${endMs}`,
    kind: 'continuous',
    startMs,
    endMs,
  };
}

function createWordOrPhraseRange({
  focusNormalizedText,
  mark,
  pauseAfterMs,
  repetitionIndex,
}: {
  focusNormalizedText?: string;
  mark: RepeatTimingRange;
  pauseAfterMs: number;
  repetitionIndex: number;
}): PlaybackRange {
  const distributedPulseTargets = mark.timingWords.map((word) => ({
    normalizedWord: word.normalizedText,
    startMs: word.startMs,
    endMs: word.endMs,
  }));
  const focusedTargets = distributedPulseTargets.filter(
    (target) => !focusNormalizedText || target.normalizedWord === focusNormalizedText,
  );

  return {
    id: `word:${mark.id}:${repetitionIndex}`,
    kind: 'word_repeat',
    startMs: mark.startMs,
    endMs: mark.endMs,
    repetitionIndex,
    ...(pauseAfterMs > 0 ? { pauseAfterMs } : {}),
    pulseTargets: focusedTargets.length ? focusedTargets : distributedPulseTargets,
  };
}

function buildUnknownRepeatRanges(
  currentItem: LessonItem,
  unknownNormalizedWords: Set<string>,
): RepeatTimingRange[] {
  const timings = [...(currentItem.wordTimings ?? [])].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
  );
  const candidates = [...unknownNormalizedWords]
    .map((normalizedText) => ({
      normalizedText,
      parts: normalizedText.split(/\s+/).filter(Boolean),
    }))
    .filter((candidate) => candidate.parts.length > 0)
    .sort((left, right) => right.parts.length - left.parts.length);
  const ranges: RepeatTimingRange[] = [];

  for (let index = 0; index < timings.length;) {
    const candidate = candidates.find(({ parts }) =>
      parts.every(
        (part, offset) => timings[index + offset]?.normalizedText === part,
      ),
    );
    if (!candidate) {
      index += 1;
      continue;
    }

    const words = timings.slice(index, index + candidate.parts.length);
    ranges.push({
      id: words.map((word) => word.id).join(':'),
      text: words.map((word) => word.text).join(' '),
      normalizedText: candidate.normalizedText,
      startMs: words[0].startMs,
      endMs: words[words.length - 1].endMs,
      timingWords: words,
      wordMarkIds: words.map((word) => word.id),
    });
    index += words.length;
  }

  return ranges;
}
