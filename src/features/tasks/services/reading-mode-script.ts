import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

export type PlaybackRange = {
  startMs: number;
  endMs: number;
  pauseAfterMs?: number;
  pulseTargets?: PulseTarget[];
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
  timingWords?: TimingWord[];
  wordMarkIds?: string[];
};

type TimingWord = {
  endMs?: number;
  normalizedText: string;
  startMs?: number;
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
  const ranges: PlaybackRange[] = [];
  const unknownWordRanges = buildUnknownRepeatRanges(currentItem, unknownNormalizedWords);
  const wordRepeatCount = Math.max(1, mode.unknownWordRepetitions ?? 1);

  let cursorMs = 0;
  for (const mark of unknownWordRanges) {
    if (mark.endMs <= cursorMs) continue;
    if (mark.startMs > cursorMs) {
      ranges.push({ startMs: cursorMs, endMs: mark.startMs });
    }

    const focusNormalizedText = focusNormalizedByText[mark.normalizedText];
    ranges.push(
      createWordOrPhraseRange(
        mark,
        wordRepeatCount > 1 ? wordRepetitionPauseMs : 0,
        focusNormalizedText,
      ),
    );

    for (let index = 1; index < wordRepeatCount; index += 1) {
      ranges.push(
        createWordOrPhraseRange(
          mark,
          index < wordRepeatCount - 1 ? wordRepetitionPauseMs : 0,
          focusNormalizedText,
        ),
      );
    }
    cursorMs = Math.max(cursorMs, mark.endMs);
  }

  if (timelineEndMs > cursorMs) {
    ranges.push({ startMs: cursorMs, endMs: timelineEndMs });
  }

  if (mode.id !== 'deep_learning') {
    return ranges.filter((range) => range.endMs > range.startMs);
  }

  const unknownWordIds = new Set(
    unknownWordRanges.flatMap((mark) => mark.wordMarkIds?.length ? mark.wordMarkIds : [mark.id]),
  );
  const threshold = Math.max(1, mode.repeatSentenceWhenUnknownCountAtLeast ?? 2);
  const sentenceRepeatCount = Math.max(1, mode.sentenceRepetitions ?? 2);
  const sentenceRepeats = [...(currentItem.sentenceTimings ?? [])]
    .filter(
      (sentence) =>
        sentence.wordMarkIds.filter((wordMarkId) => unknownWordIds.has(wordMarkId)).length >=
        threshold,
    )
    .sort((left, right) => left.startMs - right.startMs);

  for (const sentence of sentenceRepeats) {
    for (let index = 0; index < sentenceRepeatCount; index += 1) {
      ranges.push({ startMs: sentence.startMs, endMs: sentence.endMs });
    }
  }

  return ranges.filter((range) => range.endMs > range.startMs);
}

export function resumePlaybackRanges({
  preferredRangeIndex,
  ranges,
  resumeMs,
}: {
  preferredRangeIndex?: number | null;
  ranges: PlaybackRange[];
  resumeMs: number;
}) {
  const startIndex =
    preferredRangeIndex !== null &&
    preferredRangeIndex !== undefined &&
    ranges[preferredRangeIndex]?.endMs > resumeMs
      ? preferredRangeIndex
      : Math.max(0, ranges.findIndex((range) => range.endMs > resumeMs));

  if (startIndex < 0 || startIndex >= ranges.length) {
    return { ranges: [], startIndex: ranges.length };
  }

  const resumedRanges = ranges.slice(startIndex);
  const firstRange = resumedRanges[0];
  if (resumeMs > firstRange.startMs && resumeMs < firstRange.endMs) {
    resumedRanges[0] = {
      ...firstRange,
      startMs: resumeMs,
      pulseTargets: firstRange.pulseTargets?.filter((target) => target.endMs > resumeMs),
    };
  }

  return {
    ranges: resumedRanges.filter((range) => range.endMs > range.startMs),
    startIndex,
  };
}

export function getPulseDurationMs(range: PlaybackRange, target: PulseTarget) {
  const pulseStartMs = Math.max(range.startMs, target.startMs);
  return Math.max(1, range.endMs - pulseStartMs + (range.pauseAfterMs ?? 0));
}

function createWordOrPhraseRange(
  mark: RepeatTimingRange,
  pauseAfterMs = 0,
  focusNormalizedText?: string,
): PlaybackRange {
  const words = mark.timingWords?.length
    ? mark.timingWords
    : splitTimingWords(mark.text, mark.normalizedText);
  const pause = pauseAfterMs > 0 ? { pauseAfterMs } : {};
  if (words.length <= 1) {
    return {
      ...pause,
      startMs: mark.startMs,
      endMs: mark.endMs,
      pulseTargets: [
        {
          normalizedWord: words.length ? words[0].normalizedText : mark.normalizedText,
          startMs: words[0]?.startMs ?? mark.startMs,
          endMs: words[0]?.endMs ?? mark.endMs,
        },
      ],
    };
  }

  const distributedPulseTargets =
    mark.timingWords?.length
      ? mark.timingWords.map((word) => ({
          normalizedWord: word.normalizedText,
          startMs: word.startMs ?? mark.startMs,
          endMs: word.endMs ?? mark.endMs,
        }))
      : distributePulseTargets({
          endMs: mark.endMs,
          startMs: mark.startMs,
          words,
        });
  const pulseTargets = distributedPulseTargets.filter(
    (target) => !focusNormalizedText || target.normalizedWord === focusNormalizedText,
  );

  return {
    ...pause,
    startMs: mark.startMs,
    endMs: mark.endMs,
    pulseTargets: pulseTargets.length
      ? pulseTargets
      : distributedPulseTargets,
  };
}

function buildUnknownRepeatRanges(
  currentItem: LessonItem,
  unknownNormalizedWords: Set<string>,
): RepeatTimingRange[] {
  const coveredWordIds = new Set<string>();
  const coveredNormalizedTexts = new Set<string>();
  const wordTimingsById = new Map(
    [...(currentItem.wordTimings ?? [])].map((mark) => [mark.id, mark]),
  );
  const chunkRanges = [...(currentItem.chunkTimings ?? [])]
    .filter((chunk) => unknownNormalizedWords.has(chunk.normalizedText))
    .map((chunk) => {
      chunk.wordMarkIds.forEach((wordMarkId) => coveredWordIds.add(wordMarkId));
      coveredNormalizedTexts.add(chunk.normalizedText);
      const linkedTimingWords = chunk.wordMarkIds
        .map((wordMarkId) => wordTimingsById.get(wordMarkId))
        .filter((word): word is LessonItem['wordTimings'][number] => Boolean(word))
        .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
        .map((word) => ({
          endMs: word.endMs,
          normalizedText: word.normalizedText,
          startMs: word.startMs,
        }));
      const fallbackTimingWords = findPhraseTimingWordsFromWordTimings(
        currentItem,
        chunk.normalizedText,
      );
      const timingWords = linkedTimingWords.length ? linkedTimingWords : fallbackTimingWords;
      return {
        id: chunk.id,
        text: chunk.text,
        normalizedText: chunk.normalizedText,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        timingWords,
        wordMarkIds: chunk.wordMarkIds,
      };
    });
  const phraseRanges = [...unknownNormalizedWords]
    .filter((normalizedText) => normalizedText.includes(' '))
    .filter((normalizedText) => !coveredNormalizedTexts.has(normalizedText))
    .map((normalizedText) => buildPhraseRangeFromWordTimings(currentItem, normalizedText))
    .filter((range): range is RepeatTimingRange => Boolean(range))
    .filter((range) => !range.wordMarkIds?.some((wordMarkId) => coveredWordIds.has(wordMarkId)))
    .map((range) => {
      range.wordMarkIds?.forEach((wordMarkId) => coveredWordIds.add(wordMarkId));
      return range;
    });
  const wordRanges = [...(currentItem.wordTimings ?? [])]
    .filter((mark) => unknownNormalizedWords.has(mark.normalizedText))
    .filter((mark) => !coveredWordIds.has(mark.id))
    .map((mark) => ({
      id: mark.id,
      text: mark.text,
      normalizedText: mark.normalizedText,
      startMs: mark.startMs,
      endMs: mark.endMs,
    }));

  return [...chunkRanges, ...phraseRanges, ...wordRanges].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
  );
}

function buildPhraseRangeFromWordTimings(
  currentItem: LessonItem,
  normalizedText: string,
): RepeatTimingRange | null {
  const candidate = findPhraseTimingWordsFromWordTimings(currentItem, normalizedText);
  if (!candidate.length) {
    return null;
  }

  const wordTimings = [...(currentItem.wordTimings ?? [])].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
  );
  const wordMarkIds = candidate
    .map((word) =>
      wordTimings.find(
        (mark) =>
          mark.normalizedText === word.normalizedText &&
          mark.startMs === word.startMs &&
          mark.endMs === word.endMs,
      )?.id,
    )
    .filter((id): id is string => Boolean(id));

  return {
    id: `phrase:${wordMarkIds.join(':')}`,
    text: candidate.map((word) => word.text).join(' '),
    normalizedText,
    startMs: candidate[0].startMs,
    endMs: candidate[candidate.length - 1].endMs,
    timingWords: candidate.map(({ endMs, normalizedText, startMs }) => ({
      endMs,
      normalizedText,
      startMs,
    })),
    wordMarkIds,
  };
}

function findPhraseTimingWordsFromWordTimings(
  currentItem: LessonItem,
  normalizedText: string,
): (TimingWord & { text: string; endMs: number; startMs: number })[] {
  const phraseParts = normalizedText.split(/\s+/).filter(Boolean);
  if (phraseParts.length < 2) {
    return [];
  }

  const wordTimings = [...(currentItem.wordTimings ?? [])].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs,
  );
  for (let startIndex = 0; startIndex <= wordTimings.length - phraseParts.length; startIndex += 1) {
    const candidate = wordTimings.slice(startIndex, startIndex + phraseParts.length);
    if (candidate.every((word, index) => word.normalizedText === phraseParts[index])) {
      return candidate.map((word) => ({
        endMs: word.endMs,
        normalizedText: word.normalizedText,
        startMs: word.startMs,
        text: word.text,
      }));
    }
  }

  return [];
}

function distributePulseTargets({
  endMs,
  startMs,
  words,
}: {
  endMs: number;
  startMs: number;
  words: { normalizedText: string }[];
}): PulseTarget[] {
  const durationMs = Math.max(1, endMs - startMs);
  const weights = words.map((word) => Math.max(1, word.normalizedText.length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsedWeight = 0;

  return words.map((word, index) => {
    const targetStartMs = startMs + Math.round((durationMs * elapsedWeight) / totalWeight);
    elapsedWeight += weights[index];
    const targetEndMs =
      index === words.length - 1
        ? endMs
        : startMs + Math.round((durationMs * elapsedWeight) / totalWeight);

    return {
      normalizedWord: word.normalizedText,
      startMs: targetStartMs,
      endMs: Math.max(targetStartMs + 1, targetEndMs),
    };
  });
}

function splitTimingWords(text: string, fallbackNormalizedText: string) {
  const normalizedFallbackWords = fallbackNormalizedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const textWords = text.match(/[A-Za-z0-9]+(?:[’'][A-Za-z0-9]+)?/g) ?? [];
  const sourceWords = textWords.length ? textWords : normalizedFallbackWords;

  return sourceWords
    .map((word) => normalizeTimingWord(word))
    .filter((normalizedText) => normalizedText.length > 0)
    .map((normalizedText): TimingWord => ({ normalizedText }));
}

function normalizeTimingWord(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/(^'+|'+$)/g, '')
    .replace(/'s$/g, '');
}
