import { frameAtSample, playbackSegments, segmentAt, segmentKey } from '../playback-segments';
import { createPlaybackTrack, TRACK_SAMPLE_RATE } from '../playback-track';
import type { PlaybackStep } from '../model';

const asset = { id: 'one', sha256: 'hash', mimeType: 'audio/wav', byteLength: 48044, sampleRate: TRACK_SAMPLE_RATE, frameCount: 24000 };
const word = { asset, segmentId: 's1', channel: 'drill' as const, startSample: 0, endSample: 12000, narrationSample: 12000,
  occurrenceId: 'word', repetition: { kind: 'word' as const, label: 'word', index: 1, total: 1 }, pauseAfter: true };
const natural: PlaybackStep = { asset, segmentId: 's1', channel: 'narration', startSample: 0, endSample: 12000, narrationSample: 0 };
const rest: PlaybackStep = { ...natural, startSample: 12000, endSample: 24000, narrationSample: 12000 };

it('groups complete sentence practice and replays while keeping future sentences separate', () => {
  const replay = { ...natural, channel: 'drill' as const, repetition: { kind: 'sentence' as const, label: 'Sentence 1', index: 1, total: 1 } };
  const next = { ...natural, segmentId: 's2', timelineOffset: 24000, narrationSample: 24000 };
  const groups = playbackSegments([natural, word, rest, replay, next]);
  expect(groups).toHaveLength(2); expect(groups[0].steps).toHaveLength(4);
  expect(segmentAt(groups, 25000)).toBe(1);
});
it('seeks only within the natural pass, skipping earlier practice and mapping global samples', () => {
  const track = createPlaybackTrack([natural, word, rest], new Map([[asset.id, {
    bytes: new Uint8Array(new Int16Array(24000).fill(1000).buffer), frameCount: 24000, sampleRate: TRACK_SAMPLE_RATE,
  }]]), 400);
  const prepared = { ...track, uri: 'blob:track', dispose: () => undefined };
  const tail = track.spans.find(span => span.step === rest)!;
  expect(frameAtSample(prepared, 15000)).toBe(tail.start + 3000);
  expect(frameAtSample(prepared, 0)).toBe(0);
});
it('keeps the requested pause when a repeated word ends a sentence', () => {
  const data = new Map([[asset.id, { bytes: new Uint8Array(new Int16Array(24000).fill(1000).buffer), frameCount: 24000, sampleRate: TRACK_SAMPLE_RATE }]]);
  const plain = createPlaybackTrack([natural, word], data, 400);
  const padded = createPlaybackTrack([natural, word], data, 400, true);
  expect(padded.frameCount - plain.frameCount).toBe(9600);
  expect(padded.spans.at(-1)?.silence).toBe(true);
});
it('invalidates prepared segments for settings, source audio, or learning selection changes', () => {
  const segment = playbackSegments([natural, word, rest])[0];
  const key = segmentKey(segment, 400, 'pub');
  expect(segmentKey(segment, 200, 'pub')).not.toBe(key);
  expect(segmentKey({ ...segment, steps: [natural, rest] }, 400, 'pub')).not.toBe(key);
  expect(segmentKey({ ...segment, steps: segment.steps.map(step => ({ ...step, asset: { ...asset, sha256: 'updated' } })) }, 400, 'pub')).not.toBe(key);
});
