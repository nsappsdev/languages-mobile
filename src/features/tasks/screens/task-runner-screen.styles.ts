import { StyleSheet } from 'react-native';
import {
  TOKEN_WORD_FONT_SIZE,
  TOKEN_WORD_HORIZONTAL_PADDING,
  TOKEN_WORD_LINE_HEIGHT,
} from '@/src/features/tasks/constants/task-runner';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

export const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  header: {
    gap: 8,
    marginBottom: 12,
  },
  dashboardLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 2,
  },
  dashboardLinkText: {
    color: brand[700],
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: text.primary,
    flex: 1,
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },
  progress: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  overviewCard: {
    backgroundColor: brand[50],
    borderColor: '#a5f3fc',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
    padding: 14,
  },
  overviewLabel: {
    color: '#155e75',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  overviewValue: {
    color: text.primary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    backgroundColor: '#cffafe',
    borderRadius: radii.full,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0891b2',
    height: '100%',
  },
  card: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 14,
    marginBottom: 14,
    padding: 16,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  audioMetaRow: {
    alignItems: 'flex-end',
    gap: 2,
  },
  audioMeta: {
    color: text.secondary,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  runnerLayout: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 18,
  },
  wordFlow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordWhitespace: {
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    marginBottom: 4,
  },
  tokenWrapper: {
    alignItems: 'center',
    flexShrink: 1,
    marginBottom: 4,
    maxWidth: '100%',
  },
  tokenPulse: {
    alignItems: 'center',
  },
  tokenPulsePhrase: {
    alignItems: 'center',
  },
  tokenTranslation: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    height: 13,
    lineHeight: 13,
    marginBottom: 3,
    textAlign: 'center',
  },
  tokenTranslationHidden: {
    opacity: 0,
  },
  tokenTranslationMissing: {
    color: '#dc2626',
  },
  tokenWord: {
    borderRadius: radii.sm,
    color: text.primary,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    paddingHorizontal: TOKEN_WORD_HORIZONTAL_PADDING,
  },
  tokenWordActive: {
    backgroundColor: '#dbeafe',
  },
  tokenWordSaved: {
    color: '#1d4ed8',
  },
  tokenWordUnknown: {
    color: '#c2410c',
  },
  tokenWordPending: {
    color: '#b45309',
  },
  audioDock: {
    backgroundColor: surface.page,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 10,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: brand[50],
    borderColor: border.active,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: brand[700],
    borderColor: brand[700],
  },
  modeButtonText: {
    color: brand[700],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  modeButtonTextActive: {
    color: neutral[0],
  },
  audioIconButtonDisabled: {
    opacity: 0.45,
  },
  audioIconButtonPressed: {
    opacity: 0.85,
  },
  notice: {
    color: text.brand,
    fontSize: fontSize.base,
  },
  syncError: {
    color: text.warning,
    fontSize: fontSize.base,
    marginBottom: 12,
  },
  navigationRow: {
    gap: 10,
    marginBottom: 18,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.base,
  },
  error: {
    color: text.error,
    textAlign: 'center',
  },
});
