import { createPlaybackTrack, decodeReaderWav, TRACK_SAMPLE_RATE as RATE, trackPosition, wavHeader } from '../playback-track';
import { buildPlayback, DEFAULT_MODES, type PlaybackStep } from '../model';
import { fixture } from '../testing/fixture';

function source() {
  const samples = new Int16Array(RATE / 5); // 50 ms quiet, 100 ms speech, 50 ms quiet
  samples.fill(2000, RATE / 20, RATE * 3 / 20);
  return { bytes: new Uint8Array(samples.buffer), sampleRate: RATE, frameCount: samples.length };
}
const pcm = source();
const asset = { id: 'clip', sha256: 'fixture', sampleRate: RATE, frameCount: pcm.frameCount, byteLength: pcm.bytes.length + 44, mimeType: 'audio/wav' };
const steps = (count = 3): PlaybackStep[] => Array.from({ length: count }, (_, i) => ({
  asset, channel: 'drill', startSample: 0, endSample: pcm.frameCount, narrationSample: 12000, occurrenceId: 'chosen',
  repetition: { kind: 'word', label: 'word', index: i + 1, total: count }, pauseBefore: i === 0, pauseAfter: true,
}));
const flatten = (parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0; for (const p of parts) { result.set(p, at); at += p.length; } return result;
};

it.each([0, 200, 400, 800, 3000])('encodes %i ms between spoken repeats without adding the clip padding twice', pause => {
  const track = createPlaybackTrack(steps(), new Map([['clip', pcm]]), pause);
  const decoded = decodeReaderWav(flatten(track.parts));
  const view = new DataView(decoded.bytes.buffer, decoded.bytes.byteOffset, decoded.bytes.byteLength);
  const voiced = track.spans.filter(s => !s.silence).map(s => {
    let first = s.start, last = s.end;
    while (first < last && Math.abs(view.getInt16(first * 2, true)) < 100) first++;
    while (last > first && Math.abs(view.getInt16((last - 1) * 2, true)) < 100) last--;
    return { first, last };
  });
  expect(voiced).toHaveLength(3);
  for (let i = 1; i < voiced.length; i++) expect(Math.abs((voiced[i].first - voiced[i - 1].last) / RATE * 1000 - pause)).toBeLessThan(0.4);
  expect(track.spans.filter(s => !s.silence).map(s => s.step.repetition?.index)).toEqual([1, 2, 3]);
  expect(pcm.bytes).toEqual(source().bytes); // immutable source unchanged
});

it('keeps an uninterrupted narration byte-for-byte, including natural silence', () => {
  const step = { ...steps(1)[0], channel: 'narration' as const, repetition: undefined, pauseBefore: false, pauseAfter: false };
  const track = createPlaybackTrack([step], new Map([['clip', pcm]]), 400);
  expect(decodeReaderWav(flatten(track.parts)).bytes).toEqual(pcm.bytes);
  expect(trackPosition(track, 2400).sample).toBe(2400);
});

it.each([1, 2])('keeps an early consonant out of pre-drill narration and in every word play in mode %i', modeIndex => {
  const samples = new Int16Array(RATE);
  samples.fill(1000, 0, 6000); // preceding word ends at the provider's boundary
  samples.fill(8000, 6600, 8300); // consonant starts before both midpoint and character timestamp
  samples.fill(2000, 8300, 14000);
  const narration = { ...fixture.narration, sampleRate: RATE, frameCount: samples.length, byteLength: samples.byteLength + 44 };
  const text = { ...fixture, narration, sentences: [{ ...fixture.sentences[0], startSample: 0, endSample: 14000 }], occurrences: [
    { ...fixture.occurrences[0], startSample: 0, endSample: 6000 },
    { ...fixture.occurrences[1], startSample: 8400, endSample: 14000,
      learning: { ...fixture.occurrences[1].learning!, cutStartSample: 7200, cutEndSample: 15000,
        clip: { ...fixture.occurrences[1].learning!.clip, sampleRate: RATE, frameCount: 7800 } } },
  ] };
  const audio = { bytes: new Uint8Array(samples.buffer), sampleRate: RATE, frameCount: samples.length };
  const plan = buildPlayback(text, { ...DEFAULT_MODES[modeIndex], unknownWordRepetitions: 2 }, { 'release-a:cat1': 'LEARNING' });
  const track = createPlaybackTrack(plan, new Map([[narration.id, audio]]), 400);
  const decoded = decodeReaderWav(flatten(track.parts));
  const rendered = new DataView(decoded.bytes.buffer, decoded.bytes.byteOffset, decoded.bytes.byteLength);
  const spans = track.spans.filter(s => !s.silence);
  const consonantFrames = (start: number, end: number) => {
    let count = 0;
    for (let i = start; i < end; i++) if (rendered.getInt16(i * 2, true) === 8000) count++;
    return count;
  };
  expect(consonantFrames(spans[0].start, spans[0].end)).toBe(0);
  const drills = spans.filter(s => s.step.repetition?.kind === 'word');
  expect(drills).toHaveLength(2);
  for (const span of drills) expect(consonantFrames(span.start, span.end)).toBe(1700);
  const resumed = spans[spans.indexOf(drills[1]) + 1];
  expect(consonantFrames(resumed.start, resumed.end)).toBe(1700);
  const voicedEdge = (span: typeof spans[number], first: boolean) => {
    let frame = first ? span.start : span.end;
    while (first ? frame < span.end : frame > span.start) {
      if (Math.abs(rendered.getInt16((first ? frame : frame - 1) * 2, true)) > 100) break;
      frame += first ? 1 : -1;
    }
    return frame;
  };
  const gapMs = (voicedEdge(drills[1], true) - voicedEdge(drills[0], false)) / RATE * 1000;
  expect(gapMs).toBeCloseTo(400, 1);
});

it('preserves very quiet spoken clips instead of treating them as silence', () => {
  const quietSamples = new Int16Array(pcm.bytes.slice().buffer);
  for (let i = 0; i < quietSamples.length; i++) quietSamples[i] /= 100;
  const quiet = { ...pcm, bytes: new Uint8Array(quietSamples.buffer) };
  const track = createPlaybackTrack(steps(), new Map([['clip', quiet]]), 400);
  expect(track.spans.filter(s => !s.silence).every(s => s.end - s.start >= RATE / 10)).toBe(true);
});

it('maps repeats and gaps to the source occurrence and resumes narration at its original sample', () => {
  const list = [...steps(2), { asset, channel: 'narration' as const, startSample: 2000, endSample: 4800, narrationSample: 2000 }];
  const track = createPlaybackTrack(list, new Map([['clip', pcm]]), 400);
  const clips = track.spans.filter(s => !s.silence);
  expect(trackPosition(track, clips[1].start + 100)).toMatchObject({ sample: 12000, occurrenceId: 'chosen', repetition: { index: 2 } });
  const gap = track.spans.find(s => s.silence)!;
  expect(trackPosition(track, gap.start + 100).occurrenceId).toBeNull();
  expect(trackPosition(track, clips[2].start + 100).sample).toBe(clips[2].sourceStart + 100);
  expect(trackPosition(track, track.frameCount).sample).toBe(4800);
});

it('does not double a boundary pause when both adjoining steps request it', () => {
  const list = steps(2); list[1].pauseBefore = true;
  const track = createPlaybackTrack(list, new Map([['clip', pcm]]), 400);
  expect(track.spans.filter(s => s.silence)).toHaveLength(1);
  expect(track.frameCount / RATE).toBeCloseTo(0.7); // 2 x .1 speech, .4 gap, outer .1 quiet
});

it('rejects invalid formats, ranges and settings before creating playback audio', () => {
  expect(() => decodeReaderWav(new Uint8Array(50))).toThrow('PCM WAV');
  const wav = flatten([wavHeader(pcm.frameCount), pcm.bytes]);
  expect(() => decodeReaderWav(wav.subarray(0, wav.length - 2))).toThrow('incomplete');
  const map = new Map([['clip', pcm]]);
  expect(() => createPlaybackTrack(steps(), map, NaN)).toThrow('pause');
  expect(() => createPlaybackTrack(steps(), map, 3001)).toThrow('pause');
  expect(() => createPlaybackTrack([{ ...steps()[0], endSample: 100000 }], map, 400)).toThrow('range');
  expect(() => createPlaybackTrack(steps(), new Map(), 400)).toThrow('published');
});
