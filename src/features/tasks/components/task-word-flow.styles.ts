import { StyleSheet } from 'react-native';
import {
  TOKEN_WORD_FONT_SIZE,
  TOKEN_WORD_HORIZONTAL_PADDING,
  TOKEN_WORD_LINE_HEIGHT,
} from '@/src/features/tasks/constants/task-runner';
import { fontWeight, palette, radii, text } from '@/src/shared/theme';

export const wordFlowStyles = StyleSheet.create({
  wordFlow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordFlowCentered: {
    justifyContent: 'center',
    width: '100%',
  },
  wordWhitespace: {
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    marginBottom: 4,
  },
  tokenWrapper: {
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
    maxWidth: '100%',
  },
  tokenPulse: {
    alignItems: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  tokenTranslation: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    lineHeight: 13,
    marginBottom: 3,
    minHeight: 13,
    textAlign: 'center',
  },
  tokenTranslationHidden: {
    opacity: 0,
  },
  tokenTranslationMissing: {
    color: palette.danger,
  },
  tokenWord: {
    borderRadius: radii.sm,
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    paddingHorizontal: TOKEN_WORD_HORIZONTAL_PADDING,
  },
  tokenWordActive: {
    backgroundColor: palette.primarySoft,
  },
  tokenWordSaved: {
    color: palette.primary,
  },
  tokenWordUnknown: {
    color: palette.accentStrong,
  },
  tokenWordPending: {
    color: palette.warning,
  },
});
