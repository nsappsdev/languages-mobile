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

export function buildPlayback(text: ReaderText, mode: ReadingModeSettings, states: Record<string, WordStatus>, startSample = 0) {
  const narration = (start: number, end: number): PlaybackStep => ({ asset: text.narration, channel: 'narration', startSample: start, endSample: end, narrationSample: start });
  if (mode.id === 'introduction') return [narration(startSample, text.narration.frameCount)];
  const steps: PlaybackStep[] = [];
  const unknown = text.occurrences.filter(o => o.learning && states[wordKey(text.textReleaseId, o.id)] === 'LEARNING');
  const wordCount = Math.max(1, Math.min(20, mode.unknownWordRepetitions ?? 5));
  const appendTeaching = (begin: number, end: number) => {
    let cursor = begin;
    for (const occurrence of unknown) {
      if (occurrence.endSample <= cursor || occurrence.startSample >= end || occurrence.endSample > end) continue;
      if (cursor < occurrence.startSample) steps.push(narration(cursor, occurrence.startSample));
      // Keep the narration parked before the word while the secondary player
      // drills an extracted clip from that same narration. The natural narration
      // then resumes at the word without any backward seek on the main player.
      for (let i = 0; i < wordCount; i++) {
        steps.push({ asset: occurrence.learning!.clip, channel: 'drill',
          startSample: 0,
          endSample: occurrence.learning!.clip.frameCount,
          occurrenceId: occurrence.id, narrationSample: occurrence.startSample,
          repetition: { kind: 'word', label: occurrence.text, index: i + 1, total: wordCount },
          pauseBefore: i === 0,
          pauseAfter: true });
      }
      cursor = occurrence.startSample;
    }
    if (cursor < end) steps.push(narration(cursor, end));
  };
  if (mode.id === 'teaching') {
    appendTeaching(startSample, text.narration.frameCount);
    return steps;
  }
  let cursor = startSample;
  for (const [index, sentence] of text.sentences.entries()) {
    if (sentence.endSample <= cursor) continue;
    if (sentence.startSample > cursor) appendTeaching(cursor, sentence.startSample);
    appendTeaching(Math.max(cursor, sentence.startSample), sentence.endSample);
    const sentenceUnknown = unknown.filter(o => o.sentenceId === sentence.id);
    if (sentenceUnknown.length >= (mode.repeatSentenceWhenUnknownCountAtLeast ?? 2)) {
      const count = Math.max(1, Math.min(20, mode.sentenceRepetitions ?? 2));
      // After word practice, replay the complete sentence normally, without
      // multiplying its word drills or truncating replays at the resume point.
      for (let i = 0; i < count; i++) steps.push({ ...narration(sentence.startSample, sentence.endSample), channel: 'drill',
        repetition: { kind: 'sentence', label: `Sentence ${index + 1}`, index: i + 1, total: count } });
    }
    cursor = sentence.endSample;
  }
  if (cursor < text.narration.frameCount) appendTeaching(cursor, text.narration.frameCount);
  return steps;
}

export const DEFAULT_MODES: ReadingModeSettings[] = [
  { id: 'introduction', displayName: 'Listen', enabled: true, order: 0 },
  { id: 'teaching', displayName: 'Practice', enabled: true, order: 1, unknownWordRepetitions: 5 },
  { id: 'deep_learning', displayName: 'Deep learning', enabled: true, order: 2, unknownWordRepetitions: 5, repeatSentenceWhenUnknownCountAtLeast: 2, sentenceRepetitions: 2 },
];
