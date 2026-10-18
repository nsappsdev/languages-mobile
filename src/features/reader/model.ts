import type { ReadingModeSettings } from '@/src/types/domain';
import type { ReaderAsset, ReaderChange, ReaderOccurrence, ReaderText, WordStatus } from './types';

export const wordKey = (releaseId: string, occurrenceId: string) => `${releaseId}:${occurrenceId}`;
export const changeKey = (change: ReaderChange) => `${change.kind}:${change.textReleaseId}:${change.kind === 'word' ? change.occurrenceId : ''}`;
export const meaning = (word: ReaderOccurrence) => (word.learning?.translations.find(t => t.languageCode === 'hy') ?? word.learning?.translations[0])?.translation ?? '';
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export interface PlaybackStep {
  asset: ReaderAsset;
  channel?: 'narration' | 'drill';
  startSample: number;
  endSample: number;
  occurrenceId?: string;
  narrationSample: number;
  repetition?: { kind: 'word' | 'sentence'; label: string; index: number; total: number };
  pauseBefore?: boolean;
  pauseAfter?: boolean;
}

/** Use offsets into the immutable source text so punctuation/spacing never disappear. */
export function sentenceParts(text: ReaderText, sentence: ReaderText['sentences'][number]) {
  const parts: { text: string; occurrence?: ReaderOccurrence }[] = [];
  let cursor = sentence.charStart;
  for (const occurrence of text.occurrences.filter(o => o.sentenceId === sentence.id)) {
    if (occurrence.charStart > cursor) parts.push({ text: text.text.slice(cursor, occurrence.charStart) });
    parts.push({ text: text.text.slice(occurrence.charStart, occurrence.charEnd), occurrence });
    cursor = occurrence.charEnd;
  }
  if (cursor < sentence.charEnd) parts.push({ text: text.text.slice(cursor, sentence.charEnd) });
  return parts;
}

/** Keep every source character while giving the reader one layout item per word. */
export function sentenceTokens(text: ReaderText, sentence: ReaderText['sentences'][number]) {
  const occurrences = text.occurrences.filter(o => o.sentenceId === sentence.id);
  if (!occurrences.length) return { prefix: text.text.slice(sentence.charStart, sentence.charEnd), tokens: [] };
  return {
    prefix: text.text.slice(sentence.charStart, occurrences[0].charStart),
    tokens: occurrences.map((occurrence, index) => {
      const nextStart = occurrences[index + 1]?.charStart ?? sentence.charEnd;
      return {
        occurrence,
        word: text.text.slice(occurrence.charStart, occurrence.charEnd),
        suffix: text.text.slice(occurrence.charEnd, nextStart),
      };
    }),
  };
}

/** Lay out the complete text as one passage while preserving every source character. */
export function textTokens(text: ReaderText) {
  const occurrences = [...text.occurrences].sort((a, b) => a.charStart - b.charStart);
  if (!occurrences.length) return { prefix: text.text, tokens: [] };
  return {
    prefix: text.text.slice(0, occurrences[0].charStart),
    tokens: occurrences.map((occurrence, index) => {
      const nextStart = occurrences[index + 1]?.charStart ?? text.text.length;
      return {
        occurrence,
        word: text.text.slice(occurrence.charStart, occurrence.charEnd),
        suffix: text.text.slice(occurrence.charEnd, nextStart),
      };
    }),
  };
}

export const nextUnknownStatus = (status: WordStatus | undefined): WordStatus => status === 'LEARNING' ? 'NEW' : 'LEARNING';

export function activeOccurrence(text: ReaderText, sample: number) {
  return text.occurrences.find(o => sample >= o.startSample && sample < o.endSample)?.id ?? null;
}

export function sentenceStartSample(text: ReaderText, occurrence: ReaderOccurrence) {
  return text.sentences.find(sentence => sentence.id === occurrence.sentenceId)?.startSample
    ?? text.occurrences.find(word => word.sentenceId === occurrence.sentenceId)?.startSample
    ?? 0;
}

export function buildPlayback(text: ReaderText, mode: ReadingModeSettings, states: Record<string, WordStatus>, startSample = 0) {
  const narration = (start: number, end: number): PlaybackStep => ({ asset: text.narration, channel: 'narration', startSample: start, endSample: end, narrationSample: start });
  if (mode.id === 'introduction') return [narration(startSample, text.narration.frameCount)];
  const steps: PlaybackStep[] = [];
  const unknown = text.occurrences.filter(o => o.learning && states[wordKey(text.textReleaseId, o.id)] === 'LEARNING');
  // Character starts can land inside the first consonant. Keep the preceding
  // gap in isolated replays so the word's onset is not clipped.
  const wordStarts = new Map(text.occurrences.map((o, index) => [o.id,
    index === 0 ? 0 : Math.min(o.startSample, text.occurrences[index - 1].endSample),
  ]));
  const wordCount = Math.max(1, Math.min(20, mode.unknownWordRepetitions ?? 5));
  const appendTeaching = (begin: number, end: number) => {
    let cursor = begin;
    for (const occurrence of unknown) {
      if (occurrence.endSample <= cursor || occurrence.startSample >= end || occurrence.endSample > end) continue;
      const wordStart = wordStarts.get(occurrence.id)!;
      // Hear the complete word naturally before inserting its practice plays.
      // Published clip bounds include speech tails beyond character timestamps.
      // Resume at this same end boundary so context is neither skipped nor read
      // a second time, and the following word's onset stays after the drill.
      const handoff = occurrence.learning!.cutEndSample;
      if (cursor < handoff) steps.push(narration(cursor, handoff));
      // Render from the canonical narration so the lead-in before the published
      // clip's midpoint cut is included too. Library clips remain unchanged.
      for (let i = 0; i < wordCount; i++) {
        const shared = occurrence.learning!.clipSource === 'VOCABULARY';
        steps.push({ asset: shared ? occurrence.learning!.clip : text.narration, channel: 'drill',
          startSample: shared ? 0 : wordStart,
          endSample: shared ? occurrence.learning!.clip.frameCount : occurrence.learning!.cutEndSample,
          occurrenceId: occurrence.id, narrationSample: handoff,
          repetition: { kind: 'word', label: occurrence.text, index: i + 1, total: wordCount },
          pauseBefore: i === 0,
          pauseAfter: true });
      }
      cursor = handoff;
    }
    if (cursor < end) steps.push(narration(cursor, end));
  };
  if (mode.id === 'teaching') {
    appendTeaching(startSample, text.narration.frameCount);
    return steps;
  }
  let cursor = startSample;
  for (const [index, sentence] of text.sentences.entries()) {
    const sentenceUnknown = unknown.filter(o => o.sentenceId === sentence.id);
    const sentenceEnd = Math.max(sentence.endSample, ...sentenceUnknown.map(o => o.learning!.cutEndSample));
    if (sentenceEnd <= cursor) continue;
    // Keep inter-sentence audio in the natural pass, including word onsets that
    // precede their character timestamp.
    appendTeaching(cursor, sentenceEnd);
    if (sentenceUnknown.length >= (mode.repeatSentenceWhenUnknownCountAtLeast ?? 2)) {
      const count = Math.max(1, Math.min(20, mode.sentenceRepetitions ?? 2));
      // After word practice, replay the complete sentence normally, without
      // multiplying its word drills or truncating replays at the resume point.
      const firstWord = text.occurrences.find(o => o.sentenceId === sentence.id);
      const sentenceStart = firstWord ? wordStarts.get(firstWord.id)! : sentence.startSample;
      for (let i = 0; i < count; i++) steps.push({ ...narration(sentenceStart, sentenceEnd), channel: 'drill',
        repetition: { kind: 'sentence', label: `Sentence ${index + 1}`, index: i + 1, total: count } });
    }
    cursor = sentenceEnd;
  }
  if (cursor < text.narration.frameCount) appendTeaching(cursor, text.narration.frameCount);
  return steps;
}

export const DEFAULT_MODES: ReadingModeSettings[] = [
  { id: 'introduction', displayName: 'Listen', enabled: true, order: 0 },
  { id: 'teaching', displayName: 'Practice', enabled: true, order: 1, unknownWordRepetitions: 5 },
  { id: 'deep_learning', displayName: 'Deep learning', enabled: true, order: 2, unknownWordRepetitions: 5, repeatSentenceWhenUnknownCountAtLeast: 2, sentenceRepetitions: 2 },
];
