import { StyleSheet } from 'react-native';
import {
  border,
  brand,
  controlSize,
  fontSize,
  fontWeight,
  radii,
  spacing,
  status,
  surface,
  text,
  typography,
} from '@/src/shared/theme';

export const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
  },
  verificationContent: {
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
    marginBottom: spacing[5],
  },
  eyebrow: {
    color: text.brand,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    lineHeight: 16,
  },
  title: {
    ...typography.screenTitle,
    color: text.primary,
  },
  meta: {
    ...typography.body,
    color: text.secondary,
  },
  listHeader: {
    paddingBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  summaryCard: {
    flex: 1,
    minHeight: 116,
    padding: spacing[4],
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: 32,
    justifyContent: 'center',
    marginBottom: spacing[3],
    width: 32,
  },
  summaryValue: {
    color: text.primary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 28,
  },
  summaryLabel: {
    color: text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
    marginTop: spacing[1],
  },
  progressCard: {
    backgroundColor: surface.subtle,
    borderColor: border.active,
    gap: spacing[3],
    marginBottom: spacing[6],
    padding: spacing[5],
  },
  progressHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  progressTitle: {
    ...typography.cardTitle,
    color: text.primary,
    flex: 1,
  },
  progressValuePill: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii.full,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 52,
    paddingHorizontal: spacing[3],
  },
  progressValue: {
    color: text.inverse,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  progressSupportingText: {
    color: text.secondary,
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  currentLessonRow: {
    alignItems: 'center',
    borderTopColor: border.default,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[3],
  },
  currentLessonMeta: {
    color: text.primary,
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: text.primary,
  },
  sectionMeta: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
  },
  listContent: {
    paddingBottom: spacing[6],
  },
  lessonRow: {
    gap: spacing[3],
  },
  lessonColumn: {
    flex: 1,
  },
  lessonCard: {
    flex: 1,
    gap: spacing[3],
    marginBottom: spacing[3],
    minHeight: 190,
    padding: spacing[5],
  },
  lessonCardCurrent: {
    backgroundColor: surface.subtle,
  },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  levelMarker: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  levelMarkerCurrent: {
    backgroundColor: brand[700],
  },
  levelNumber: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  levelNumberCurrent: {
    color: text.inverse,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: spacing[1],
    minHeight: 28,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  statusCompleted: {
    backgroundColor: status.successBg,
  },
  statusCurrent: {
    backgroundColor: surface.active,
  },
  statusOpen: {
    backgroundColor: status.warningBg,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  statusTextCompleted: {
    color: text.success,
  },
  statusTextCurrent: {
    color: text.brand,
  },
  statusTextOpen: {
    color: text.warning,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: text.primary,
  },
  cardDescription: {
    ...typography.body,
    color: text.secondary,
    flexGrow: 1,
  },
  cardFooter: {
    alignItems: 'center',
    borderTopColor: border.default,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: controlSize.minimumTarget,
    paddingTop: spacing[2],
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
  },
  cardMeta: {
    color: text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 16,
  },
  cardAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
  },
  cardActionText: {
    color: text.brand,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[6],
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing[1],
    width: 56,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: text.primary,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: text.secondary,
    textAlign: 'center',
  },
});
