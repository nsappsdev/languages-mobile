import { Animated, Pressable, Text, View } from 'react-native';
import { TOKEN_WORD_HORIZONTAL_PADDING } from '@/src/features/tasks/constants/task-runner';
import { fitTranslationLabel } from '@/src/features/tasks/services/translation-fitting';
import {
  getCenteredTranslationOffset,
  getFocusedTokenLayout,
} from '@/src/features/tasks/services/token-focus-layout';
import { getTokenLayoutWidth } from '@/src/features/tasks/services/task-word-flow-layout';
import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
import { wordFlowStyles } from '@/src/features/tasks/components/task-word-flow.styles';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';

export function TaskWordFlow({
  activeSegmentId,
  activeWordTimingId,
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
  tokenWordTimingIds,
  translationFitSettings,
  translationFontFamily,
  triggerTokenFeedback,
  unknownTaps,
  vocabularyByText,
  vocabularyTokenMatches,
  wordTokens,
}: TaskWordFlowProps) {
  return (
    <View style={wordFlowStyles.wordFlow} onLayout={onLayout}>
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
        const wordTimingIdsInRange = match
          ? tokenWordTimingIds.slice(match.startIndex, match.endIndex + 1)
          : [tokenWordTimingIds[idx]];
        const segmentId = segmentIdsInRange.find((value): value is string => Boolean(value)) ?? null;
        const isActiveSegment = segmentIdsInRange.some(
          (value) => value !== null && value === activeSegmentId,
        );
        const isActiveWord =
          activeWordTimingId !== null && wordTimingIdsInRange.includes(activeWordTimingId);
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
          ? getCenteredTranslationOffset({
              focusOffset: focusLayout.focusOffset,
              focusWidth: focusLayout.focusWidth,
              translationWidth,
            })
          : 0;
        const tokenLayoutWidth = getTokenLayoutWidth({
          fallbackTokenWidth,
          measuredTokenWidth,
          phraseWidth: focusLayout.phraseWidth,
        });
        const pulseNormalizedWord = match?.focusNormalizedText ?? normalizedWord;
        const pulseValue = getTokenPulseValue(pulseNormalizedWord);
        const pulseScale = pulseValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.04, 1],
        });
        const pulseOpacity = pulseValue.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.96, 1, 0.96],
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
            style={wordFlowStyles.tokenWrapper}>
            <View
              style={[
                wordFlowStyles.tokenPulse,
                match && wordFlowStyles.tokenPulsePhrase,
                {
                  width: tokenLayoutWidth,
                },
              ]}>
              <Animated.Text
                ellipsizeMode="clip"
                numberOfLines={1}
                style={[
                  wordFlowStyles.tokenTranslation,
                  {
                    fontFamily: translationFontFamily,
                    fontSize: fittedTranslation.fontSize,
                    height: translationLineHeight,
                    letterSpacing: fittedTranslation.letterSpacing,
                    lineHeight: translationLineHeight,
                    alignSelf: match ? 'flex-start' : 'center',
                    marginLeft: translationOffset,
                    width: translationWidth,
                  },
                  {
                    opacity: pulseOpacity,
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
                onLayout={(event) => handleTokenWordLayout(tokenKey, event)}
                style={[
                  wordFlowStyles.tokenWord,
                  {
                    fontFamily: mainTextFontFamily,
                    fontSize: mainTextFontSize,
                    lineHeight: mainTextLineHeight,
                  },
                  isActiveSegment && wordFlowStyles.tokenWordActive,
                  isActiveWord && wordFlowStyles.tokenWordSpeaking,
                  isSelected && wordFlowStyles.tokenWordSaved,
                  revealTranslation && !isSelected && wordFlowStyles.tokenWordUnknown,
                  tokenTranslation.visible &&
                    !tokenTranslation.hasTranslation &&
                    wordFlowStyles.tokenWordUnknown,
                  isPending && wordFlowStyles.tokenWordPending,
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
