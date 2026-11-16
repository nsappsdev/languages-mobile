import { wordKey, type PlaybackStep } from './model';
import type { ReaderWord, WordStatus } from './types';

export interface WordLibraryText {
  textReleaseId: string;
  publicationId: string;
  lessonId: string;
  title: string;
  words: ReaderWord[];
}

/**
 * Keep the library scoped to a published text and to occurrences the learner
 * actually marked unknown. Grouping by release also keeps the same spelling in
 * two texts attached to its own contextual translation and audio clip.
 */
export function buildWordLibrary(
  words: ReaderWord[],
  overrides: Record<string, WordStatus> = {},
): WordLibraryText[] {
  const grouped = new Map<string, ReaderWord[]>();

  for (const word of words) {
    const group = grouped.get(word.textReleaseId);
    if (group) group.push(word);
    else grouped.set(word.textReleaseId, [word]);
  }

  const lessonGroups = new Map<string, string[]>();
  for (const [textReleaseId, group] of grouped) {
    const lessonId = group[0].lessonId;
    const releases = lessonGroups.get(lessonId);
    if (releases) releases.push(textReleaseId);
    else lessonGroups.set(lessonId, [textReleaseId]);
  }

  return [...grouped.entries()].flatMap(([textReleaseId, group]) => {
    const unknownWords = group.filter(word =>
      (overrides[wordKey(word.textReleaseId, word.occurrence.id)] ?? word.status) === 'LEARNING');
    if (!unknownWords.length) return [];

    const first = group[0];
    const releases = lessonGroups.get(first.lessonId) ?? [textReleaseId];
    const textNumber = releases.indexOf(textReleaseId) + 1;
    const title = releases.length > 1
      ? `${first.lessonTitle} · Text ${textNumber}`
      : first.lessonTitle;

    return [{
      textReleaseId,
      publicationId: first.publicationId,
      lessonId: first.lessonId,
      title,
      words: unknownWords.sort((a, b) => a.occurrence.charStart - b.occurrence.charStart),
    }];
  });
}

export function wordPlayback(word: ReaderWord): PlaybackStep[] {
  const clip = word.occurrence.learning?.clip;
  return clip ? [{ asset: clip, channel: 'drill', startSample: 0, endSample: clip.frameCount,
    occurrenceId: word.occurrence.id, narrationSample: word.occurrence.startSample }] : [];
}

/** Keep occurrences distinct, including repeated spellings in the same text. */
export function shuffleLibraryWords(words: ReaderWord[], random = Math.random): ReaderWord[] {
  const shuffled = [...words];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  // Pressing Shuffle should visibly change the order even when chance returns
  // the same permutation. Do not alter the canonical source-order array.
  if (shuffled.length > 1 && shuffled.every((word, index) => word === words[index])) shuffled.push(shuffled.shift()!);
  return shuffled;
}
