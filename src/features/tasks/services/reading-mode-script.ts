import type { LessonItem, ReadingModeSettings } from '@/src/types/domain';

export type PlaybackRange = {
  startMs: number;
  endMs: number;
  pulseTargets?: PulseTarget[];
};

export type PulseTarget = {
  normalizedWord: string;
  startMs: number;
  endMs: number;
};

export function buildReadingModeScript({
  currentItem,
  durationMs,
  mode,
  unknownNormalizedWords,
}: {
  currentItem: LessonItem;
  durationMs: number;
  mode: ReadingModeSettings;
  unknownNormalizedWords: Set<string>;
}): PlaybackRange[] {
  const timelineEndMs =
    durationMs > 0
      ? durationMs
      : Math.max(0, ...currentItem.segments.map((segment) => segment.endMs));
  const ranges: PlaybackRange[] = [];
  const unknownWordRanges = [...(currentItem.wordTimings ?? [])]
    .filter((mark) => unknownNormalizedWords.has(mark.normalizedText))
    .sort((left, right) => left.startMs - right.startMs);
  const wordRepeatCount = Math.max(1, mode.unknownWordRepetitions ?? 1);

  let cursorMs = 0;
  for (const mark of unknownWordRanges) {
    if (mark.endMs <= cursorMs) continue;
    if (mark.startMs > cursorMs) {
      ranges.push({ startMs: cursorMs, endMs: mark.startMs });
    }

    ranges.push(createWordOrPhraseRange(mark));

    for (let index = 1; index < wordRepeatCount; index += 1) {
      ranges.push(createWordOrPhraseRange(mark));
    }
    cursorMs = Math.max(cursorMs, mark.endMs);
  }

  if (timelineEndMs > cursorMs) {
    ranges.push({ startMs: cursorMs, endMs: timelineEndMs });
  }

  if (mode.id !== 'deep_learning') {
    return ranges.filter((range) => range.endMs > range.startMs);
  }

  const unknownWordIds = new Set(unknownWordRanges.map((mark) => mark.id));
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

function createWordOrPhraseRange(mark: LessonItem['wordTimings'][number]): PlaybackRange {
  const words = splitTimingWords(mark.text, mark.normalizedText);
  if (words.length <= 1) {
    return {
      startMs: mark.startMs,
      endMs: mark.endMs,
      pulseTargets: [
        {
          normalizedWord: words.length ? words[0].normalizedText : mark.normalizedText,
          startMs: mark.startMs,
          endMs: mark.endMs,
        },
      ],
    };
  }

  return {
    startMs: mark.startMs,
    endMs: mark.endMs,
    pulseTargets: distributePulseTargets({
      endMs: mark.endMs,
      startMs: mark.startMs,
      words,
    }),
  };
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
    .map((normalizedText) => ({ normalizedText }));
}

function normalizeTimingWord(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/(^'+|'+$)/g, '')
    .replace(/'s$/g, '');
}
