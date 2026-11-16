import { buildPlayback, DEFAULT_MODES } from '../model';
import { trackPosition } from '../playback-track';
import { sentenceFixture } from '../testing/fixture';
import type { ReaderText } from '../types';

const text: ReaderText = {
  ...sentenceFixture, narration: { kind: 'sentences', frameCount: 1000, sampleRate: 100 }, narrationSource: 'SENTENCES',
  sentences: sentenceFixture.sentences.map((sentence, index) => ({ ...sentence, startSample: index * 500, endSample: (index + 1) * 500,
    asset: { id: `sentence-${index}`, sha256: `sha-${index}`, mimeType: 'audio/wav', byteLength: 1044, sampleRate: 100, frameCount: 500 } })),
  occurrences: sentenceFixture.occurrences.map(word => ({ ...word, learning: word.learning ? { ...word.learning, clipSource: 'VOCABULARY' } : null })),
};

it('plays only sentence files, resumes within the correct file, and retains global progress', () => {
  const steps = buildPlayback(text, DEFAULT_MODES[0], {}, 600);
  expect(steps).toHaveLength(1);
  expect(steps[0]).toMatchObject({ asset: { id: 'sentence-1' }, startSample: 100, endSample: 500, timelineOffset: 500 });
  expect(trackPosition({ frameCount: 400, spans: [{ start: 0, end: 400, sourceStart: 100, sourceEnd: 500, step: steps[0], silence: false }] }, 150).sample).toBe(750);
  expect(buildPlayback(text, DEFAULT_MODES[0], {}).map(step => step.asset.id)).toEqual(['sentence-0', 'sentence-1']);
});

it.each(DEFAULT_MODES.slice(1))('repeats the original occurrence from its sentence in $id mode, including older standalone publications', mode => {
  const steps = buildPlayback(text, { ...mode, unknownWordRepetitions: 1, sentenceRepetitions: 1, repeatSentenceWhenUnknownCountAtLeast: 1 }, {
    'release-a:cat1': 'LEARNING', 'release-a:cat2': 'LEARNING',
  });
  const drills = steps.filter(step => step.repetition?.kind === 'word');
  expect(drills.map(step => step.asset.id)).toEqual(['sentence-0', 'sentence-1']);
  expect(drills[0]).toMatchObject({ startSample: 100, endSample: 450, narrationSample: 450 });
  expect(drills[1]).toMatchObject({ startSample: 100, endSample: 500, narrationSample: 1000 });
  expect(steps.some(step => step.asset.id.startsWith('clip'))).toBe(false);
  for (const step of steps) {
    expect(step.startSample).toBeGreaterThanOrEqual(0);
    expect(step.endSample).toBeLessThanOrEqual(step.asset.frameCount);
  }
  const natural = steps.filter(step => step.channel === 'narration');
  expect(natural[0].startSample).toBe(0);
  expect(natural.at(-1)!.endSample + (natural.at(-1)!.timelineOffset ?? 0)).toBe(1000);
  if (mode.id === 'deep_learning') {
    const replay = steps.filter(step => step.repetition?.kind === 'sentence');
    expect(replay.map(step => [step.asset.id, step.startSample, step.endSample])).toEqual([['sentence-0', 0, 500], ['sentence-1', 0, 500]]);
    expect(trackPosition({ frameCount: 500, spans: [{ start: 0, end: 500, sourceStart: 0, sourceEnd: 500, step: replay[1], silence: false }] }, 200).sample).toBe(700);
  }
});
