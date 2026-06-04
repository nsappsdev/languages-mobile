import type { LessonWordToken } from '@/src/features/tasks/screens/task-runner-words';

export interface WordTimingSummary {
  id: string;
  text?: string;
  startMs: number;
  endMs: number;
}

type WordTimingRange = {
  end: number;
  id: string;
  start: number;
};

export function getActiveWordTimingId(
  wordTimings: readonly WordTimingSummary[],
  positionMs: number,
) {
  return (
    wordTimings.find((word) => positionMs >= word.startMs && positionMs < word.endMs)?.id ?? null
  );
}

export function getTokenWordTimingIds(
  tokens: readonly LessonWordToken[],
  fullText: string,
  wordTimings: readonly WordTimingSummary[],
): (string | null)[] {
  if (!wordTimings.length) return tokens.map(() => null);

  const ranges = locateWordTimingRanges(fullText, wordTimings);
  return tokens.map((token) => {
    const match = ranges.find((range) => token.start >= range.start && token.end <= range.end);
    return match?.id ?? null;
  });
}

function locateWordTimingRanges(
  fullText: string,
  wordTimings: readonly WordTimingSummary[],
): WordTimingRange[] {
  const ranges: WordTimingRange[] = [];
  let searchFrom = 0;

  for (const word of wordTimings) {
    const wordText = word.text;
    if (!wordText) continue;

    let start = fullText.indexOf(wordText, searchFrom);
    if (start === -1) {
      start = fullText.indexOf(wordText);
    }
    if (start === -1) continue;

    const end = start + wordText.length;
    ranges.push({ end, id: word.id, start });
    searchFrom = end;
  }

  return ranges;
}
