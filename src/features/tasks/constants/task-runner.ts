import type { ReadingModeSettings } from '@/src/types/domain';

export const TOKEN_WORD_FONT_SIZE = 18;
export const TOKEN_WORD_LINE_HEIGHT = 24;
export const TOKEN_WORD_HORIZONTAL_PADDING = 3;
export const CONTIGUOUS_RANGE_TOLERANCE_MS = 20;
export const ACTIVE_SEGMENT_SCROLL_LOOKAHEAD_MS = 650;

export const DEFAULT_READING_MODES: ReadingModeSettings[] = [
  { id: 'introduction', enabled: true, displayName: 'Introduction', order: 0 },
  {
    id: 'teaching',
    enabled: true,
    displayName: 'Teaching',
    order: 1,
    unknownWordRepetitions: 5,
  },
  {
    id: 'deep_learning',
    enabled: true,
    displayName: 'Deep Learning',
    order: 2,
    unknownWordRepetitions: 5,
    repeatSentenceWhenUnknownCountAtLeast: 2,
    sentenceRepetitions: 2,
  },
];
