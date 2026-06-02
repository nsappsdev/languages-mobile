import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { TOKEN_WORD_HORIZONTAL_PADDING } from '@/src/features/tasks/constants/task-runner';
import { fitTranslationLabel } from '@/src/features/tasks/services/translation-fitting';
import {
  getFocusedTokenLayout,
  getStartAlignedTranslationOffset,
} from '@/src/features/tasks/services/token-focus-layout';
import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
import type { VocabularyTokenMatch } from '@/src/features/tasks/services/task-runner-helpers';
import type { LessonWordToken } from '@/src/features/tasks/screens/task-runner-words';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';

type TranslationFitSettings = {
  maxFontSize: number;
  maxLetterSpacing: number;
  minFontSize: number;
  minLetterSpacing: number;
};

export function TaskWordFlow({
  activeSegmentId,
  entryCacheByText,
  getTokenPulseValue,
  handleSeekToSegment,
  handleTokenPositionLayout,
  handleTokenWordLayout,
  handleToggleWordVocabulary,
  isPlaying,
  mainTextFontFamily,
  mainTextFontSize,
  mainTextLineHeight,
  onLayout,
  pendingWords,
  segmentStartById,
  tokenSegmentIds,
  tokenWidths,
  translationFitSettings,
  translationFontFamily,
  triggerTokenFeedback,
  unknownTaps,
  vocabularyByText,
  vocabularyTokenMatches,
  wordTokens,
}: {
  activeSegmentId: string | null;
  entryCacheByText: Record<string, VocabularyEntry>;
  getTokenPulseValue: (normalizedWord: string) => Animated.Value;
  handleSeekToSegment: (startMs: number | null) => void;
  handleTokenPositionLayout: (segmentId: string | null, event: LayoutChangeEvent) => void;
  handleTokenWordLayout: (tokenKey: string, event: LayoutChangeEvent) => void;
  handleToggleWordVocabulary: (rawWord: string, normalizedWord: string | null) => void;
  isPlaying: boolean;
  mainTextFontFamily: string | undefined;
  mainTextFontSize: number;
  mainTextLineHeight: number;
  onLayout: (event: LayoutChangeEvent) => void;
  pendingWords: Record<string, true>;
  segmentStartById: Record<string, number>;
  tokenSegmentIds: (string | null)[];
  tokenWidths: Record<string, number>;
  translationFitSettings: TranslationFitSettings;
  translationFontFamily: string | undefined;
  triggerTokenFeedback: (normalizedWord: string) => void;
  unknownTaps: Record<string, true>;
  vocabularyByText: Record<string, LearnerVocabularyItem>;
  vocabularyTokenMatches: (VocabularyTokenMatch | null)[];
  wordTokens: LessonWordToken[];
}) {
  return (
    <View style={styles.wordFlow} onLayout={onLayout}>
      {wordTokens.map((tok, idx) => {
        const coveringMatch = vocabularyTokenMatches.find(
          (match) => match && idx >= match.startIndex && idx <= match.endIndex,
        );
        if (coveringMatch && idx !== coveringMatch.startIndex) {
          return null;
        }

        const match = vocabularyTokenMatches[idx];
        const renderedTokens = match
          ? wordTokens.slice(match.startIndex, match.endIndex + 1)
          : [tok];
        const renderedTokenText = renderedTokens.map((token) => token.text).join('');
        const segmentIdsInRange = match
          ? tokenSegmentIds.slice(match.startIndex, match.endIndex + 1)
          : [tokenSegmentIds[idx]];
        const segmentId = segmentIdsInRange.find((value): value is string => Boolean(value)) ?? null;
        const isActiveSegment = segmentIdsInRange.some(
          (value) => value !== null && value === activeSegmentId,
        );
        const segmentStartMs = segmentId ? segmentStartById[segmentId] ?? null : null;
        if (!tok.normalized) {
          return (
            <Text
              key={tok.key}
              style={[
                styles.wordWhitespace,
                {
                  fontFamily: mainTextFontFamily,
                  fontSize: mainTextFontSize,
                  lineHeight: mainTextLineHeight,
                },
                isActiveSegment && styles.tokenWordActive,
              ]}>
              {tok.text}
            </Text>
          );
        }

        const normalizedWord = match?.normalizedText ?? tok.normalized;
        const entry = match?.entry ?? entryCacheByText[normalizedWord];
        const tokenKey = match
          ? `phrase:${match.startIndex}:${match.endIndex}:${normalizedWord}`
          : tok.key;
        const isSelected = Boolean(vocabularyByText[normalizedWord]);
        const isPending = Boolean(pendingWords[normalizedWord]);
        const revealTranslation = shouldRevealTokenTranslation(
          Boolean(vocabularyByText[normalizedWord]),
          Boolean(unknownTaps[normalizedWord]),
        );
        const translationsForToken =
          vocabularyByText[normalizedWord]?.entry.translations ??
          entry?.translations ??
          [];
        const tokenTranslation = getTokenTranslationDisplay(
          translationsForToken,
          revealTranslation,
          renderedTokenText,
        );
        const measuredTokenWidth = match
          ? tokenWidths[tokenKey] ?? 0
          : tokenWidths[tok.key] ?? 0;
        const focusTokenIndex = match?.focusTokenIndex ?? null;
        const focusLayout = match
          ? getFocusedTokenLayout({
              firstTokenIndex: match.startIndex,
              focusTokenIndex,
              fontSize: mainTextFontSize,
              horizontalPadding: TOKEN_WORD_HORIZONTAL_PADDING,
              measuredPhraseWidth: measuredTokenWidth,
              tokenWidths,
              tokens: renderedTokens,
            })
          : {
              focusOffset: 0,
              focusWidth: measuredTokenWidth,
              phraseWidth: measuredTokenWidth,
            };
        const fallbackTokenWidth = Math.ceil(
          renderedTokenText.length * mainTextFontSize * 0.56 + TOKEN_WORD_HORIZONTAL_PADDING * 2,
        );
        const availableTranslationWidth =
          focusLayout.focusWidth || measuredTokenWidth || fallbackTokenWidth;
        const fittedTranslation = fitTranslationLabel({
          ...translationFitSettings,
          availableWidth: availableTranslationWidth,
          text: tokenTranslation.text,
        });
        const translationLineHeight = Math.ceil(fittedTranslation.fontSize + 3);
        const translationWidth =
          fittedTranslation.containerWidth ?? availableTranslationWidth;
        const translationOffset = match
          ? getStartAlignedTranslationOffset({
              focusOffset: focusLayout.focusOffset,
            })
          : 0;
        const tokenLayoutWidth = Math.ceil(
          Math.max(
            focusLayout.phraseWidth || measuredTokenWidth || fallbackTokenWidth,
            translationOffset + translationWidth,
          ),
        );
        const pulseNormalizedWord = match?.focusNormalizedText ?? normalizedWord;
        const pulseValue = getTokenPulseValue(pulseNormalizedWord);
        const pulseScale = pulseValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.08, 1],
        });
        const pulseOpacity = pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.98],
        });

        return (
          <Pressable
            key={tokenKey}
            onLayout={(event) => handleTokenPositionLayout(segmentId, event)}
            onPress={() => {
              if (isPlaying) {
                triggerTokenFeedback(normalizedWord);
                handleSeekToSegment(segmentStartMs);
                return;
              }
              if (
                !shouldAllowVocabularyToggle(
                  Boolean(vocabularyByText[normalizedWord] || entry),
                  translationsForToken.some(
                    (translation) => ['am', 'hy'].includes(translation.languageCode.toLowerCase()),
                  ),
                )
              ) {
                return;
              }
              triggerTokenFeedback(normalizedWord);
              handleToggleWordVocabulary(renderedTokenText, normalizedWord);
            }}
            disabled={isPlaying && segmentStartMs === null}
            style={styles.tokenWrapper}>
            <View
              style={[
                styles.tokenPulse,
                match && styles.tokenPulsePhrase,
                { maxWidth: tokenLayoutWidth },
              ]}>
              <Animated.Text
                ellipsizeMode="clip"
                numberOfLines={1}
                style={[
                  styles.tokenTranslation,
                  {
                    fontFamily: translationFontFamily,
                    fontSize: fittedTranslation.fontSize,
                    height: translationLineHeight,
                    letterSpacing: fittedTranslation.letterSpacing,
                    lineHeight: translationLineHeight,
                    marginLeft: translationOffset,
                    maxWidth: translationWidth,
                  },
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                  !tokenTranslation.visible && styles.tokenTranslationHidden,
                  tokenTranslation.visible &&
                    !tokenTranslation.hasTranslation &&
                    styles.tokenTranslationMissing,
                ]}>
                {tokenTranslation.text}
              </Animated.Text>
              <Text
                onLayout={(event) => handleTokenWordLayout(tokenKey, event)}
                style={[
                  styles.tokenWord,
                  {
                    fontFamily: mainTextFontFamily,
                    fontSize: mainTextFontSize,
                    lineHeight: mainTextLineHeight,
                  },
                  isActiveSegment && styles.tokenWordActive,
                  isSelected && styles.tokenWordSaved,
                  revealTranslation && !isSelected && styles.tokenWordUnknown,
                  tokenTranslation.visible &&
                    !tokenTranslation.hasTranslation &&
                    styles.tokenWordUnknown,
                  isPending && styles.tokenWordPending,
                ]}>
                {renderedTokenText}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
