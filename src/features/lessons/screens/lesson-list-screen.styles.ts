import { StyleSheet } from 'react-native';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

export const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
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
  header: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
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
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },
  summaryLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  progressCard: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  progressValue: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    backgroundColor: neutral[200],
    borderRadius: radii.full,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: brand[700],
    borderRadius: radii.full,
    height: '100%',
  },
  currentLessonMeta: {
    color: text.secondary,
    fontSize: fontSize.base,
    marginTop: 8,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardCurrent: {
    borderColor: brand[700],
    borderWidth: 2,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: text.primary,
    flex: 1,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    marginRight: 12,
  },
  status: {
    borderRadius: radii.full,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusCurrent: {
    backgroundColor: '#ccfbf1',
    color: brand[800],
  },
  statusOpen: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  cardDescription: {
    color: neutral[700],
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  cardMeta: {
    color: text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
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
