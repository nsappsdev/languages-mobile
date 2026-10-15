import type { PlaybackStep } from './model';

// Immutable publication assets are mono, 16-bit PCM WAV at 24 kHz. Building a
// single track makes pauses sample-accurate on both native and web players.
export const TRACK_SAMPLE_RATE = 24000;
const QUIET_SAMPLE = 65; // approximately -54 dBFS; only outer quiet margins
const EDGE_PAD = 144; // 6 ms protects soft speech edges
const FADE_FRAMES = 48; // 2 ms de-click ramp; never crossfade spoken words
const MAX_TRACK_BYTES = 128 * 1024 * 1024;

export interface PcmAudio { bytes: Uint8Array; frameCount: number; sampleRate: number }
export interface TrackSpan {
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  step: PlaybackStep;
  silence?: boolean;
}
export interface PlaybackTrack {
  parts: Uint8Array[];
  spans: TrackSpan[];
  frameCount: number;
  sampleRate: number;
}

export function decodeReaderWav(bytes: Uint8Array): PcmAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const label = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 44 || label(0) !== 'RIFF' || label(8) !== 'WAVE') throw new Error('Reader audio is not a PCM WAV file');
  let validFormat = false;
  let pcm: Uint8Array | undefined;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = view.getUint32(at + 4, true);
    const begin = at + 8;
    if (begin + size > bytes.length) throw new Error('Reader audio is incomplete');
    if (label(at) === 'fmt ') {
      validFormat = size >= 16 && view.getUint16(begin, true) === 1 && view.getUint16(begin + 2, true) === 1 &&
        view.getUint32(begin + 4, true) === TRACK_SAMPLE_RATE && view.getUint32(begin + 8, true) === TRACK_SAMPLE_RATE * 2 &&
        view.getUint16(begin + 12, true) === 2 && view.getUint16(begin + 14, true) === 16;
    }
    if (label(at) === 'data') pcm = bytes.subarray(begin, begin + size);
    at = begin + size + size % 2;
  }
  if (!validFormat || !pcm || !pcm.length || pcm.length % 2) throw new Error('Reader audio must be mono 24 kHz, 16-bit PCM');
  return { bytes: pcm, sampleRate: TRACK_SAMPLE_RATE, frameCount: pcm.length / 2 };
}

export function wavHeader(frameCount: number): Uint8Array {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const label = (at: number, value: string) => [...value].forEach((c, i) => { bytes[at + i] = c.charCodeAt(0); });
  label(0, 'RIFF'); view.setUint32(4, 36 + frameCount * 2, true); label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TRACK_SAMPLE_RATE, true); view.setUint32(28, TRACK_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, 'data'); view.setUint32(40, frameCount * 2, true);
  return bytes;
}

export function createPlaybackTrack(steps: PlaybackStep[], assets: ReadonlyMap<string, PcmAudio>, pauseMs: number): PlaybackTrack {
  if (!Number.isFinite(pauseMs) || pauseMs < 0 || pauseMs > 3000) throw new Error('Repetition pause must be between 0 and 3000 ms');
  const gapFrames = Math.round(pauseMs * TRACK_SAMPLE_RATE / 1000);
  const hasGap = (index: number) => index > 0 && !!(steps[index].pauseBefore || steps[index - 1].pauseAfter);
  const pad = Math.min(EDGE_PAD, Math.floor(gapFrames / 2));
  const prepared = steps.map((step, index) => {
    const audio = assets.get(step.asset.id);
    if (!audio || audio.sampleRate !== step.asset.sampleRate || audio.frameCount !== step.asset.frameCount)
      throw new Error('Audio does not match the published text');
    if (!Number.isInteger(step.startSample) || !Number.isInteger(step.endSample) || step.startSample < 0 ||
        step.endSample <= step.startSample || step.endSample > audio.frameCount) throw new Error('Invalid playback range');
    const view = new DataView(audio.bytes.buffer, audio.bytes.byteOffset, audio.bytes.byteLength);
    let first = step.startSample, last = step.endSample;
    // Examine real samples, never estimate speech timing from the text. Only
    // margins adjacent to an intentional practice pause may be shortened.
    if (hasGap(index) || (index + 1 < steps.length && hasGap(index + 1))) {
      let peak = 0;
      for (let frame = first; frame < last; frame++) peak = Math.max(peak, Math.abs(view.getInt16(frame * 2, true)));
      // A quiet recording must not be mistaken for an empty clip.
      const quiet = Math.min(QUIET_SAMPLE, peak / 100);
      while (first < last && Math.abs(view.getInt16(first * 2, true)) <= quiet) first++;
      while (last > first && Math.abs(view.getInt16((last - 1) * 2, true)) <= quiet) last--;
    }
    const start = hasGap(index) ? Math.max(step.startSample, first - pad) : step.startSample;
    const end = index + 1 < steps.length && hasGap(index + 1) ? Math.min(step.endSample, last + pad) : step.endSample;
    return { step, audio, start, end: Math.max(start, end), leading: Math.max(0, first - start), trailing: Math.max(0, end - last) };
  });
  const parts: Uint8Array[] = [];
  const spans: TrackSpan[] = [];
  let frameCount = 0;
  const append = (bytes: Uint8Array) => {
    frameCount += bytes.length / 2;
    if (frameCount * 2 > MAX_TRACK_BYTES) throw new Error('This practice session is too long. Choose fewer learning words or repetitions.');
    if (bytes.length) parts.push(bytes);
  };
  for (const [index, item] of prepared.entries()) {
    if (hasGap(index)) {
      const previous = prepared[index - 1];
      const silence = Math.max(0, gapFrames - previous.trailing - item.leading);
      spans.push({ start: frameCount, end: frameCount + silence, sourceStart: previous.end,
        sourceEnd: previous.end, step: previous.step, silence: true });
      append(new Uint8Array(silence * 2));
    }
    const start = frameCount;
    const source = item.audio.bytes.subarray(item.start * 2, item.end * 2);
    const fadeIn = index > 0 && (hasGap(index) || prepared[index - 1].step.asset.id !== item.step.asset.id || prepared[index - 1].end !== item.start);
    const fadeOut = index + 1 < prepared.length && (hasGap(index + 1) || prepared[index + 1].step.asset.id !== item.step.asset.id || item.end !== prepared[index + 1].start);
    const ramp = Math.min(FADE_FRAMES, Math.floor(source.length / 4));
    const edge = (bytes: Uint8Array, incoming: boolean) => {
      const result = bytes.slice();
      const view = new DataView(result.buffer);
      for (let i = 0; i < ramp; i++) view.setInt16(i * 2, Math.round(view.getInt16(i * 2, true) * (incoming ? i / ramp : (ramp - 1 - i) / ramp)), true);
      return result;
    };
    // Keep large bodies as views; copy only tiny ramps. Never alter saved assets.
    append(fadeIn ? edge(source.subarray(0, ramp * 2), true) : source.subarray(0, ramp * 2));
    append(source.subarray(ramp * 2, source.length - ramp * 2));
    append(fadeOut ? edge(source.subarray(source.length - ramp * 2), false) : source.subarray(source.length - ramp * 2));
    if (frameCount > start) spans.push({ start, end: frameCount, sourceStart: item.start, sourceEnd: item.end, step: item.step });
  }
  if (!frameCount) throw new Error('There is no audio to play');
  return { parts: [wavHeader(frameCount), ...parts], spans, frameCount, sampleRate: TRACK_SAMPLE_RATE };
}

export function trackPosition(track: Pick<PlaybackTrack, 'spans' | 'frameCount'>, position: number) {
  const frame = Math.max(0, Math.min(track.frameCount, position));
  let low = 0, high = track.spans.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (track.spans[middle].end <= frame) low = middle + 1; else high = middle;
  }
  const span = track.spans[low];
  const source = span.silence ? span.sourceEnd : Math.min(span.sourceEnd, span.sourceStart + Math.max(0, frame - span.start));
  return { sample: span.step.channel === 'drill' && span.step.repetition?.kind !== 'sentence' ? span.step.narrationSample : source,
    occurrenceId: span.silence ? null : span.step.occurrenceId ?? null, repetition: span.step.repetition };
}
