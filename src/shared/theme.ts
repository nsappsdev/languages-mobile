/**
 * Design tokens for the mobile app.
 *
 * Color scale inspired by Tailwind's cyan/sky palette to match the teal brand
 * colour used throughout the app (tintColorLight = '#0a7ea4').
 */

export const brand: Record<number, string> = {
  50: '#ecfeff',
  100: '#cffafe',
  200: '#a5f3fc',
  300: '#67e8f9',
  400: '#22d3ee',
  500: '#06b6d4',
  600: '#0891b2',
  700: '#0e7490',
  800: '#155e75',
  900: '#164e63',
};

export const neutral: Record<number, string> = {
  0: '#ffffff',
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

export const text = {
  primary: '#111827',
  secondary: '#6b7280',
  muted: '#9ca3af',
  brand: '#0e7490',
  warning: '#b45309',
  error: '#dc2626',
  inverse: '#ffffff',
};

export const surface = {
  background: '#ffffff',
  card: '#ffffff',
  subtle: '#f9fafb',
  page: '#f8fafc',
  input: '#ffffff',
  active: '#ecfeff',
  overlay: 'rgba(255, 255, 255, 0.92)',
};

export const border = {
  default: '#e5e7eb',
  subtle: '#f3f4f6',
  active: '#0e7490',
  warning: '#fdba74',
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 30,
  '5xl': 32,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};
