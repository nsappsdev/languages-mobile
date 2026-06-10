import { StyleSheet } from 'react-native';
import {
  TOKEN_WORD_FONT_SIZE,
  TOKEN_WORD_HORIZONTAL_PADDING,
  TOKEN_WORD_LINE_HEIGHT,
} from '@/src/features/tasks/constants/task-runner';
import { fontWeight, radii, text } from '@/src/shared/theme';

export const wordFlowStyles = StyleSheet.create({
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
    color: '#0f766e',
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
    color: '#dc2626',
  },
  tokenWord: {
    borderRadius: radii.sm,
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    paddingHorizontal: TOKEN_WORD_HORIZONTAL_PADDING,
  },
  tokenWordActive: {
    backgroundColor: '#eff6ff',
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
});
