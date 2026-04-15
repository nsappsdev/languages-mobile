/** Brand palette (teal / cyan) */
export const brand = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#99f6e4',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
} as const;

/** Neutral palette (slate) */
export const neutral = {
  0: '#ffffff',
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  900: '#0f172a',
} as const;

/** Semantic aliases */
export const text = {
  primary: neutral[900],
  secondary: neutral[600],
  muted: neutral[500],
  placeholder: neutral[400],
  inverse: neutral[0],
  brand: brand[700],
  error: '#b91c1c',
  warning: '#b45309',
  success: '#166534',
} as const;

export const surface = {
  page: neutral[50],
  card: neutral[0],
  input: neutral[0],
  active: brand[50],
  /** Floating footer / sheet background */
  overlay: neutral[0],
} as const;

export const border = {
  default: neutral[300],
  /** Footer and card subtle border */
  subtle: '#dbeafe',
  active: brand[200],
  error: '#b91c1c',
  warning: '#fdba74',
} as const;

export const status = {
  errorBg: '#fee2e2',
  warningBg: '#fff7ed',
  successBg: '#dcfce7',
} as const;
