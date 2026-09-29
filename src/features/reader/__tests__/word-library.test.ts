import { buildWordLibrary } from '../word-library';
import type { ReaderWord, WordStatus } from '../types';
import { fixture } from '../testing/fixture';

const makeWord = (
  textReleaseId: string,
  occurrenceIndex: number,
  status: WordStatus,
  lessonId = 'lesson-a',
): ReaderWord => ({
  publicationId: `publication-${lessonId}`,
  lessonId,
  lessonTitle: lessonId === 'lesson-a' ? 'Morning garden' : 'Evening walk',
  textReleaseId,
  occurrence: {
    ...fixture.occurrences[occurrenceIndex],
    id: `${textReleaseId}-${fixture.occurrences[occurrenceIndex].id}`,
  },
  sentence: fixture.text,
  status,
});

describe('word library', () => {
  it('shows only learner-selected unknown occurrences inside their text', () => {
    const words = [
      makeWord('release-a', 1, 'LEARNING'),
      makeWord('release-a', 3, 'NEW'),
      makeWord('release-b', 1, 'LEARNED', 'lesson-b'),
    ];

    const library = buildWordLibrary(words);

    expect(library).toHaveLength(1);
    expect(library[0].title).toBe('Morning garden');
    expect(library[0].words.map(word => word.occurrence.id)).toEqual(['release-a-cat1']);
  });

  it('applies pending local choices before the server has synchronized them', () => {
    const selected = makeWord('release-a', 1, 'NEW');
    const removed = makeWord('release-a', 3, 'LEARNING');

    const library = buildWordLibrary([selected, removed], {
      'release-a:release-a-cat1': 'LEARNING',
      'release-a:release-a-cat2': 'NEW',
    });

    expect(library[0].words.map(word => word.occurrence.id)).toEqual(['release-a-cat1']);
  });

  it('keeps repeated spellings and different text releases independent', () => {
    const library = buildWordLibrary([
      makeWord('release-a', 1, 'LEARNING'),
      makeWord('release-a', 3, 'LEARNING'),
      makeWord('release-b', 1, 'LEARNING'),
    ]);

    expect(library.map(text => text.title)).toEqual([
      'Morning garden · Text 1',
      'Morning garden · Text 2',
    ]);
    expect(library[0].words).toHaveLength(2);
    expect(library[1].words).toHaveLength(1);
    expect(library[0].words[0].occurrence.id).not.toBe(library[1].words[0].occurrence.id);
  });
});
