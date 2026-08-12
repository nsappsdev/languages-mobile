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

export const fontFamily = {
  editorial: 'SourceSerif4',
  ui: 'LibreFranklin',
  system: undefined,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeight.bold },
  screenTitle: { fontSize: 28, lineHeight: 36, fontWeight: fontWeight.bold },
  sectionTitle: { fontSize: 24, lineHeight: 32, fontWeight: fontWeight.semibold },
  cardTitle: { fontSize: 20, lineHeight: 28, fontWeight: fontWeight.semibold },
  bodyLarge: { fontSize: 18, lineHeight: 30, fontWeight: fontWeight.regular },
  body: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.regular },
  label: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.semibold },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: fontWeight.semibold },
} as const;
