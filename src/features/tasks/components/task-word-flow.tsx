import { memo, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { TOKEN_WORD_HORIZONTAL_PADDING } from '@/src/features/tasks/constants/task-runner';
import { fitTranslationLabel } from '@/src/features/tasks/services/translation-fitting';
import {
  getMatchTranslationAnchorIndex,
  getTokenLayoutWidth,
  getTranslationLabelMaxWidth,
} from '@/src/features/tasks/services/task-word-flow-layout';
import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
import { wordFlowStyles } from '@/src/features/tasks/components/task-word-flow.styles';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';

export const TaskWordFlow = memo(function TaskWordFlow({
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
}: TaskWordFlowProps) {
  const [wordFlowWidth, setWordFlowWidth] = useState(0);

  return (
    <View
      style={wordFlowStyles.wordFlow}
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        setWordFlowWidth((current) => (current === nextWidth ? current : nextWidth));
        onLayout(event);
      }}>
      {wordTokens.map((tok, idx) => {
        const match = vocabularyTokenMatches[idx];
        const segmentId = tokenSegmentIds[idx] ?? null;
        const isActiveSegment = segmentId !== null && segmentId === activeSegmentId;
        const segmentStartMs = segmentId ? segmentStartById[segmentId] ?? null : null;
        if (!tok.normalized) {
          return (
            <Text
              key={tok.key}
              style={[
                wordFlowStyles.wordWhitespace,
                {
                  fontFamily: mainTextFontFamily,
                  fontSize: mainTextFontSize,
                  lineHeight: mainTextLineHeight,
                },
                isActiveSegment && wordFlowStyles.tokenWordActive,
              ]}>
              {tok.text}
            </Text>
          );
        }

        const normalizedWord = match?.normalizedText ?? tok.normalized;
        const matchedTokenText = match
          ? wordTokens
              .slice(match.startIndex, match.endIndex + 1)
              .map((token) => token.text)
              .join('')
          : tok.text;
        const entry = match?.entry ?? entryCacheByText[normalizedWord];
        const isSelected = Boolean(vocabularyByText[normalizedWord]);
        const isPending = Boolean(pendingWords[normalizedWord]);
        const revealTranslation = shouldRevealTokenTranslation(
          Boolean(vocabularyByText[normalizedWord]),
          Boolean(unknownTaps[normalizedWord]),
        );
        const translationAnchorIndex = getMatchTranslationAnchorIndex(match);
        const shouldRenderTranslation = translationAnchorIndex === null || translationAnchorIndex === idx;
        const translationsForToken =
          vocabularyByText[normalizedWord]?.entry.translations ??
          entry?.translations ??
          [];
        const tokenTranslation = shouldRenderTranslation
          ? getTokenTranslationDisplay(translationsForToken, revealTranslation, matchedTokenText)
          : getTokenTranslationDisplay([], false);
        const measuredTokenWidth = tokenWidths[tok.key] ?? 0;
        const fallbackTokenWidth = Math.ceil(
          tok.text.length * mainTextFontSize * 0.56 + TOKEN_WORD_HORIZONTAL_PADDING * 2,
        );
        const availableTranslationWidth =
          measuredTokenWidth || fallbackTokenWidth;
        const fittedTranslation = fitTranslationLabel({
          ...translationFitSettings,
          availableWidth: availableTranslationWidth,
          text: tokenTranslation.text,
        });
        const translationLineHeight = Math.ceil(fittedTranslation.fontSize + 3);
        const translationMaxWidth = getTranslationLabelMaxWidth({
          availableWidth: availableTranslationWidth,
          fittedContainerWidth: fittedTranslation.containerWidth,
          wordFlowWidth,
        });
        const tokenLayoutWidth = getTokenLayoutWidth({
          fallbackTokenWidth,
          measuredTokenWidth,
          phraseWidth: measuredTokenWidth,
        });
        const pulseNormalizedWord =
          match && shouldRenderTranslation ? match.focusNormalizedText ?? normalizedWord : tok.normalized;
        const pulseValue = getTokenPulseValue(pulseNormalizedWord);
        const pulseScale = pulseValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2],
        });

        return (
          <Pressable
            key={tok.key}
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
              handleToggleWordVocabulary(matchedTokenText, normalizedWord);
            }}
            disabled={isPlaying && segmentStartMs === null}
            style={wordFlowStyles.tokenWrapper}>
            <View
              style={[
                wordFlowStyles.tokenPulse,
                {
                  minWidth: tokenLayoutWidth,
                },
              ]}>
              <Animated.Text
                style={[
                  wordFlowStyles.tokenTranslation,
                  {
                    fontFamily: translationFontFamily,
                    fontSize: fittedTranslation.fontSize,
                    letterSpacing: fittedTranslation.letterSpacing,
                    lineHeight: translationLineHeight,
                    maxWidth: translationMaxWidth,
                    minHeight: translationLineHeight,
                  },
                  {
                    transform: [{ scale: pulseScale }],
                  },
                  !tokenTranslation.visible && wordFlowStyles.tokenTranslationHidden,
                  tokenTranslation.visible &&
                    !tokenTranslation.hasTranslation &&
                    wordFlowStyles.tokenTranslationMissing,
                ]}>
                {tokenTranslation.text}
              </Animated.Text>
              <Text
                onLayout={(event) => handleTokenWordLayout(tok.key, event)}
                style={[
                  wordFlowStyles.tokenWord,
                  {
                    fontFamily: mainTextFontFamily,
                    fontSize: mainTextFontSize,
                    lineHeight: mainTextLineHeight,
                  },
                  isActiveSegment && wordFlowStyles.tokenWordActive,
                  isSelected && wordFlowStyles.tokenWordSaved,
                  revealTranslation && !isSelected && wordFlowStyles.tokenWordUnknown,
                  shouldRenderTranslation &&
                    tokenTranslation.visible &&
                    !tokenTranslation.hasTranslation &&
                    wordFlowStyles.tokenWordUnknown,
                  isPending && wordFlowStyles.tokenWordPending,
                ]}>
                {tok.text}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});
