export interface SegmentSummary {
  id: string;
  text?: string;
  startMs: number;
  endMs: number;
}

export interface TokenRange {
  end: number;
  start: number;
}

export interface TokenSegmentGroup {
  segmentId: string | null;
  startMs: number | null;
  tokenIndices: number[];
}

type SegmentRange = {
  end: number;
  segmentId: string;
  start: number;
};

export function getTokenSegmentIds(
  tokens: readonly TokenRange[],
  fullText: string,
  segments: readonly SegmentSummary[],
): (string | null)[] {
  if (!segments.length) return tokens.map(() => null);

  const ranges = locateSegmentRanges(fullText, segments);
  return tokens.map((token) => {
    const match = ranges.find((range) => token.start >= range.start && token.end <= range.end);
    return match?.segmentId ?? null;
  });
}

/**
 * Groups consecutive token indices by the segment they belong to. Tokens outside
 * an admin segment stay in null groups so active playback never highlights text
 * that is not part of the current reading segment.
 */
export function groupTokenIndicesBySegment(
  tokenSegmentIds: readonly (string | null)[],
  segments: readonly SegmentSummary[],
): TokenSegmentGroup[] {
  if (tokenSegmentIds.length === 0) return [];

  const segmentStartById = new Map<string, number>();
  for (const seg of segments) segmentStartById.set(seg.id, seg.startMs);

  const groups: TokenSegmentGroup[] = [];
  let current: TokenSegmentGroup | null = null;

  for (let idx = 0; idx < tokenSegmentIds.length; idx += 1) {
    const segId = tokenSegmentIds[idx];

    if (!current || current.segmentId !== segId) {
      current = {
        segmentId: segId,
        startMs: segId ? segmentStartById.get(segId) ?? null : null,
        tokenIndices: [idx],
      };
      groups.push(current);
    } else {
      current.tokenIndices.push(idx);
    }
  }

  return groups;
}

function locateSegmentRanges(
  fullText: string,
  segments: readonly SegmentSummary[],
): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let searchFrom = 0;

  for (const segment of segments) {
    const segmentText = segment.text;
    if (!segmentText) continue;

    let start = fullText.indexOf(segmentText, searchFrom);
    if (start === -1) {
      start = fullText.indexOf(segmentText);
    }
    if (start === -1) continue;

    const end = start + segmentText.length;
    ranges.push({ end, segmentId: segment.id, start });
    searchFrom = end;
  }

  return ranges;
}
