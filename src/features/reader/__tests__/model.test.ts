import { activeOccurrence, buildPlayback, DEFAULT_MODES, meaning, nextUnknownStatus, sentenceParts, sentenceTokens, textTokens, wordKey } from '../model';
import { fixture } from '../testing/fixture';

describe('immutable occurrence-based reading', () => {
  it('preserves source punctuation and gives repeated words independent meanings', () => {
    expect(sentenceParts(fixture, fixture.sentences[0]).map(p => p.text).join('')).toBe(fixture.text);
    const tokenized = sentenceTokens(fixture, fixture.sentences[0]);
    expect(tokenized.prefix + tokenized.tokens.map(token => token.word + token.suffix).join('')).toBe(fixture.text);
    const passage = textTokens(fixture);
    expect(passage.prefix + passage.tokens.map(token => token.word + token.suffix).join('')).toBe(fixture.text);
    expect(meaning(fixture.occurrences[1])).toBe('կատու');
    expect(meaning(fixture.occurrences[3])).toBe('երկրորդ կատու');
    expect(wordKey('release-a', 'cat1')).not.toBe(wordKey('release-b', 'cat1'));
  });
  it('marks a word unknown directly and lets the learner undo that choice', () => {
    expect(nextUnknownStatus(undefined)).toBe('LEARNING');
    expect(nextUnknownStatus('NEW')).toBe('LEARNING');
    expect(nextUnknownStatus('LEARNED')).toBe('LEARNING');
    expect(nextUnknownStatus('LEARNING')).toBe('NEW');
  });
  it('uses actual half-open sample boundaries and leaves gaps unhighlighted', () => {
    expect(activeOccurrence(fixture, 200)).toBe('cat1');
    expect(activeOccurrence(fixture, 400)).toBeNull();
    expect(activeOccurrence(fixture, 700)).toBe('cat2');
  });
  it('listens to the entire original narration without requesting word audio', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[0], {});
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ asset: fixture.narration, startSample: 0, endSample: 1000 });
  });
  it('practices only the chosen occurrence, not every identical spelling', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[1], { 'release-a:cat2': 'LEARNING' });
    expect(steps.filter(s => s.occurrenceId).map(s => s.asset.id)).toEqual(Array(5).fill('audio-a'));
    expect(steps.filter(s => s.channel === 'narration').map(s => [s.startSample, s.endSample])).toEqual([[0, 600], [600, 1000]]);
    expect(steps.filter(s => s.occurrenceId).map(s => [s.startSample, s.endSample])).toEqual(Array(5).fill([600, 1000]));
  });
  it('never includes unselected or learned occurrences in practice', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[1], { 'release-a:a1': 'LEARNING', 'release-a:cat1': 'LEARNED' });
    expect(steps.some(s => s.occurrenceId)).toBe(false);
  });
  it('deep learning repeats a sentence only when its unknown-occurrence threshold is met', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[2], { 'release-a:cat1': 'LEARNING', 'release-a:cat2': 'LEARNING' });
    expect(steps.filter(s => s.occurrenceId === 'cat1')).toHaveLength(5);
    expect(steps.filter(s => s.occurrenceId === 'cat2')).toHaveLength(5);
    expect(steps.filter(s => s.repetition?.kind === 'sentence').map(s => [s.startSample, s.endSample])).toEqual([[0, 900], [0, 900]]);
  });
  it('resumes narration without replaying earlier words', () => {
    expect(buildPlayback(fixture, DEFAULT_MODES[0], {}, 500)[0].startSample).toBe(500);
    expect(buildPlayback(fixture, DEFAULT_MODES[1], { 'release-a:cat1': 'LEARNING' }, 500).some(s => s.occurrenceId)).toBe(false);
  });
  it.each([1, 3, 5, 20])('plays each practice clip exactly %i times before its natural narration occurrence', count => {
    const steps = buildPlayback(fixture, { ...DEFAULT_MODES[1], unknownWordRepetitions: count }, { 'release-a:cat1': 'LEARNING' });
    const drills = steps.filter(s => s.occurrenceId === 'cat1');
    expect(drills).toHaveLength(count);
    expect(drills.every(s => s.channel === 'drill' && s.asset.id === fixture.narration.id && s.startSample === 100 && s.endSample === 450)).toBe(true);
    expect(drills.filter(s => s.pauseBefore)).toHaveLength(1);
    expect(drills.every(s => s.pauseAfter)).toBe(true);
    expect(steps.filter(s => s.channel === 'narration').map(s => [s.startSample, s.endSample])).toEqual([[0, 100], [100, 1000]]);
  });
  it('does not repeat a deep-learning sentence below the threshold', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[2], { 'release-a:cat1': 'LEARNING' });
    expect(steps.some(s => s.repetition?.kind === 'sentence')).toBe(false);
  });
  it('replays the whole qualifying sentence when starting from its middle', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[2], { 'release-a:cat1': 'LEARNING', 'release-a:cat2': 'LEARNING' }, 500);
    expect(steps.filter(s => s.occurrenceId === 'cat1')).toHaveLength(0);
    expect(steps.filter(s => s.occurrenceId === 'cat2')).toHaveLength(5);
    expect(steps.filter(s => s.repetition?.kind === 'sentence').map(s => s.startSample)).toEqual([0, 0]);
  });
  it('finishes sentence replays before continuing into the next sentence', () => {
    const text = { ...fixture, narration: { ...fixture.narration, frameCount: 2000 }, sentences: [...fixture.sentences,
      { id: 's2', text: 'Next.', charStart: 14, charEnd: 19, startSample: 1100, endSample: 1900 }] };
    const steps = buildPlayback(text, DEFAULT_MODES[2], { 'release-a:cat1': 'LEARNING', 'release-a:cat2': 'LEARNING' });
    const replays = steps.filter(s => s.repetition?.kind === 'sentence');
    expect(replays).toHaveLength(2);
    expect(replays.every(step => step.channel === 'drill')).toBe(true);
    expect(steps[steps.indexOf(replays[1]) + 1]).toMatchObject({ channel: 'narration', startSample: 900, endSample: 1900 });
  });
  it.each([1, 2])('keeps every original narration sample exactly once in mode %i', modeIndex => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[modeIndex], { 'release-a:cat1': 'LEARNING', 'release-a:cat2': 'LEARNING' });
    const narration = steps.filter(s => s.channel === 'narration');
    expect(narration[0].startSample).toBe(0);
    expect(narration[narration.length - 1].endSample).toBe(fixture.narration.frameCount);
    for (let i = 1; i < narration.length; i++) expect(narration[i].startSample).toBe(narration[i - 1].endSample);
  });
  it('does not play the first consonant of a new sentence before its drill in deep learning', () => {
    const text = { ...fixture, sentences: [
      { ...fixture.sentences[0], charEnd: 8, endSample: 600 },
      { id: 's2', text: 'cat!', charStart: 9, charEnd: 13, startSample: 700, endSample: 900 },
    ], occurrences: fixture.occurrences.map(o => o.id === 'cat2' ? { ...o, sentenceId: 's2' } : o) };
    const steps = buildPlayback(text, { ...DEFAULT_MODES[2], repeatSentenceWhenUnknownCountAtLeast: 1 }, { 'release-a:cat2': 'LEARNING' });
    const firstDrill = steps.findIndex(s => s.occurrenceId === 'cat2');
    expect(steps.slice(0, firstDrill).map(s => [s.startSample, s.endSample])).toEqual([[0, 600]]);
    expect(steps[firstDrill]).toMatchObject({ startSample: 600, narrationSample: 600 });
    expect(steps.filter(s => s.repetition?.kind === 'sentence').every(s => s.startSample === 600)).toBe(true);
  });
  it('preserves the opening consonant when the first word in the text is selected', () => {
    const text = { ...fixture, occurrences: fixture.occurrences.map((o, i) => i ? o : {
      ...o, startSample: 30, learning: { ...fixture.occurrences[1].learning!, cutStartSample: 0, cutEndSample: 150 },
    }) };
    const steps = buildPlayback(text, DEFAULT_MODES[1], { 'release-a:a1': 'LEARNING' });
    expect(steps[0]).toMatchObject({ channel: 'drill', occurrenceId: 'a1', startSample: 0 });
  });
  it('does not move narration backward when starting inside a word lead-in', () => {
    const steps = buildPlayback(fixture, DEFAULT_MODES[1], { 'release-a:cat1': 'LEARNING' }, 175);
    expect(steps[0]).toMatchObject({ channel: 'drill', startSample: 100, narrationSample: 175 });
    expect(steps.filter(s => s.channel === 'narration')[0].startSample).toBe(175);
  });
});
