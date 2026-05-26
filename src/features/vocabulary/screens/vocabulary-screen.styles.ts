import { StyleSheet } from 'react-native';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

export const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: text.primary,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.md,
  },
  error: {
    color: text.error,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: brand[700],
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: neutral[0],
    fontWeight: fontWeight.semibold,
  },
  syncMeta: {
    color: text.brand,
    fontSize: fontSize.sm,
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: text.primary,
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  summaryValue: {
    color: text.brand,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  summaryLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  sectionHeadingCopyPressed: {
    opacity: 0.7,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionChevron: {
    color: text.muted,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  sectionTitle: {
    color: text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  sectionMeta: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sectionDescription: {
    color: text.secondary,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
  sectionEntries: {
    gap: 8,
  },
  dictionaryRow: {
    backgroundColor: surface.page,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  dictionaryRowPressed: {
    opacity: 0.85,
  },
  dictionaryRowFirstMissed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  dictionaryRowFirstLearned: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  dictionaryRowFinalMissed: {
    backgroundColor: '#991b1b',
    borderColor: '#7f1d1d',
  },
  dictionaryRowFinalLearned: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1e40af',
  },
  dictionaryTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  dictionaryEnglish: {
    color: text.primary,
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    lineHeight: 21,
    paddingRight: 10,
  },
  dictionaryDivider: {
    alignSelf: 'stretch',
    backgroundColor: '#dbeafe',
    marginHorizontal: 4,
    width: 1,
  },
  dictionaryTranslationWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  dictionaryTranslation: {
    color: text.brand,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    lineHeight: 21,
  },
  dictionaryTranslationInvisible: {
    opacity: 0,
    position: 'absolute',
  },
  dictionaryTranslationHidden: {
    color: neutral[400],
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: 0,
    lineHeight: 21,
  },
  dictionaryTextOnDark: {
    color: text.inverse,
  },
  dictionaryHiddenTextOnDark: {
    color: 'rgba(255, 255, 255, 0.72)',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  emptyText: {
    color: text.secondary,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
