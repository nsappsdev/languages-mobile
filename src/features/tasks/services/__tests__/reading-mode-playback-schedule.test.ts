import { buildPulseSchedule } from '../reading-mode-playback-schedule';

describe('reading mode playback schedule', () => {
  it('marks pulse targets at the range start as immediate', () => {
    expect(
      buildPulseSchedule({
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
});
