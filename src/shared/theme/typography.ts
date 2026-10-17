export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
} as const;

export const fontWeight = {
  regular: '400' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const typography = {
  display: { fontSize: 32, lineHeight: 39, letterSpacing: -0.8, fontWeight: fontWeight.bold },
  screenTitle: { fontSize: 30, lineHeight: 38, letterSpacing: -0.6, fontWeight: fontWeight.bold },
  sectionTitle: { fontSize: 22, lineHeight: 30, letterSpacing: -0.3, fontWeight: fontWeight.semibold },
  cardTitle: { fontSize: 20, lineHeight: 28, letterSpacing: -0.3, fontWeight: fontWeight.semibold },
  bodyLarge: { fontSize: 18, lineHeight: 30, fontWeight: fontWeight.regular },
  body: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.regular },
  label: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.semibold },
} as const;
