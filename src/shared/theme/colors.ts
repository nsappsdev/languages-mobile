/** Calm Editorial foundation. Numeric aliases remain for incremental screen migration. */
export const brand = {
  50: '#f1fcf8',
  100: '#ddf2ea',
  200: '#bdc9c6',
  300: '#80d5cb',
  400: '#4ea99f',
  500: '#238c83',
  600: '#0f766e',
  700: '#0f766e',
  800: '#005c55',
  900: '#003c37',
} as const;

export const neutral = {
  0: '#ffffff',
  50: '#f7f4ed',
  100: '#f1fcf8',
  200: '#e5e1d8',
  300: '#bdc9c6',
  400: '#8a9692',
  500: '#6e7977',
  600: '#4f625c',
  700: '#3e4947',
  800: '#283230',
  900: '#17211f',
} as const;

export const palette = {
  canvas: '#f7f4ed',
  surface: '#ffffff',
  surfaceSubtle: '#f1fcf8',
  surfaceMint: '#ddf2ea',
  primary: '#0f766e',
  primaryStrong: '#005c55',
  primarySoft: '#ddf2ea',
  ink: '#17211f',
  inkMuted: '#4f625c',
  border: '#e5e1d8',
  borderStrong: '#bdc9c6',
  accent: '#e87956',
  accentStrong: '#8d3518',
  success: '#166534',
  successSurface: '#dcfce7',
  warning: '#b45309',
  warningSurface: '#fff7ed',
  danger: '#ba1a1a',
  dangerSurface: '#ffdad6',
  info: '#005c55',
  infoSurface: '#ddf2ea',
  scrim: 'rgba(23, 33, 31, 0.42)',
} as const;

export const text = {
  primary: palette.ink,
  secondary: palette.inkMuted,
  muted: '#6e7977',
  placeholder: '#8a9692',
  inverse: palette.surface,
  brand: palette.primary,
  error: palette.danger,
  warning: palette.warning,
  success: palette.success,
} as const;

export const surface = {
  background: palette.canvas,
  page: palette.canvas,
  card: palette.surface,
  input: palette.surface,
  subtle: palette.surfaceSubtle,
  active: palette.primarySoft,
  overlay: 'rgba(255, 255, 255, 0.96)',
} as const;

export const border = {
  default: palette.border,
  subtle: palette.border,
  strong: palette.borderStrong,
  active: palette.primary,
  error: palette.danger,
  warning: palette.warning,
} as const;

export const status = {
  errorBg: palette.dangerSurface,
  warningBg: palette.warningSurface,
  successBg: palette.successSurface,
  infoBg: palette.infoSurface,
} as const;
