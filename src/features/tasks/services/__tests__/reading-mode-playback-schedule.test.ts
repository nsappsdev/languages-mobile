import { buildPulseSchedule } from '../reading-mode-playback-schedule';

describe('reading mode playback schedule', () => {
  it('marks pulse targets at the range start as immediate', () => {
    expect(
      buildPulseSchedule({
        id: 'word:everyone:1',
        kind: 'word_repeat',
        startMs: 500,
        endMs: 900,
        pauseAfterMs: 800,
        pulseTargets: [{ normalizedWord: 'everyone', startMs: 500, endMs: 900 }],
      }),
    ).toEqual([
      {
        delayMs: 0,
        durationMs: 1200,
        immediate: true,
        target: { normalizedWord: 'everyone', startMs: 500, endMs: 900 },
      },
    ]);
  });

  it('delays focus-word pulses inside phrase ranges', () => {
    expect(
      buildPulseSchedule({
        id: 'word:naturally:stir:up:1',
        kind: 'word_repeat',
        startMs: 450,
        endMs: 1400,
        pauseAfterMs: 800,
        pulseTargets: [{ normalizedWord: 'stir', startMs: 900, endMs: 1150 }],
      }),
    ).toEqual([
      {
        delayMs: 450,
        durationMs: 1300,
        immediate: false,
        target: { normalizedWord: 'stir', startMs: 900, endMs: 1150 },
      },
    ]);
  });

  it('schedules a pulse for every repeated playback range', () => {
    const createRange = (repetitionIndex: number) => ({
      id: `word:beach:${repetitionIndex}`,
      kind: 'word_repeat' as const,
      startMs: 1800,
      endMs: 2200,
      repetitionIndex,
      pulseTargets: [{ normalizedWord: 'beach', startMs: 1800, endMs: 2200 }],
    });

    expect(buildPulseSchedule(createRange(1))).toHaveLength(1);
    expect(buildPulseSchedule(createRange(2))).toHaveLength(1);
    expect(buildPulseSchedule(createRange(3))).toHaveLength(1);
  });
});
