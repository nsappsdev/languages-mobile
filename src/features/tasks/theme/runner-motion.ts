export const runnerMotion = {
  tokenFeedback: {
    rise: 260,
    hold: 120,
    fall: 360,
  },
  translationHeartbeat: {
    rise: 320,
    fall: 420,
    minHold: 160,
    maxHold: 650,
  },
  missingTranslation: {
    visible: 1600,
    scale: 1.85,
    firstBeat: 140,
    secondBeat: 140,
    settle: 120,
  },
} as const;
