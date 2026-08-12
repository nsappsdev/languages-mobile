import { palette } from './colors';

export const elevation = {
  flat: {},
  raised: {
    boxShadow: `0px 4px 12px rgba(23, 33, 31, 0.05)`,
  },
  focus: {
    boxShadow: `0px 5px 16px rgba(15, 118, 110, 0.12)`,
  },
  modal: {
    backgroundColor: palette.scrim,
  },
} as const;
