import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { TOKEN_WORD_HORIZONTAL_PADDING } from '@/src/features/tasks/constants/task-runner';
import { fitTranslationLabel } from '@/src/features/tasks/services/translation-fitting';
import {
  getMatchTranslationAnchorIndex,
  getTokenLayoutWidth,
  getTranslationLabelMaxWidth,
} from '@/src/features/tasks/services/task-word-flow-layout';
import {
  getVocabularyTapAction,
  getTokenTranslationDisplay,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
import { wordFlowStyles } from '@/src/features/tasks/components/task-word-flow.styles';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';

const NO_TRANSLATION_FEEDBACK_MS = 1600;
const NO_TRANSLATION_ICON_SCALE = 1.85;

export const TaskWordFlow = memo(function TaskWordFlow({
  activeSegmentId,
  entryCacheByText,
  getTokenPulseValue,
  handleSeekToSegment,
  handleTokenPositionLayout,
  handleTokenWordLayout,
  handleToggleWordVocabulary,
  isPlaying,
  isPlaybackNavigationActive,
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
  const [missingTranslationFeedback, setMissingTranslationFeedback] = useState<
    Record<string, true>
  >({});
  const missingTranslationTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const missingTranslationAnimations = useRef(new Map<string, Animated.Value>());

  const getMissingTranslationAnimation = useCallback((normalizedWord: string) => {
    let animation = missingTranslationAnimations.current.get(normalizedWord);
    if (!animation) {
      animation = new Animated.Value(0);
      missingTranslationAnimations.current.set(normalizedWord, animation);
    }
    return animation;
  }, []);

  const showMissingTranslationFeedback = useCallback((normalizedWord: string) => {
    const currentTimer = missingTranslationTimers.current.get(normalizedWord);
    if (currentTimer) clearTimeout(currentTimer);
    const animation = getMissingTranslationAnimation(normalizedWord);
    animation.stopAnimation();
    animation.setValue(0);
    Animated.sequence([
      Animated.timing(animation, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(animation, {
        duration: 140,
        toValue: 0.82,
        useNativeDriver: true,
      }),
      Animated.timing(animation, {
        duration: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
    setMissingTranslationFeedback((current) => ({ ...current, [normalizedWord]: true }));
    missingTranslationTimers.current.set(
      normalizedWord,
      setTimeout(() => {
        missingTranslationTimers.current.delete(normalizedWord);
        setMissingTranslationFeedback((current) => {
          if (!current[normalizedWord]) return current;
          const next = { ...current };
          delete next[normalizedWord];
          return next;
        });
      }, NO_TRANSLATION_FEEDBACK_MS),
    );
  }, [getMissingTranslationAnimation]);

  useEffect(
    () => () => {
      missingTranslationTimers.current.forEach(clearTimeout);
      missingTranslationTimers.current.clear();
      missingTranslationAnimations.current.forEach((animation) => animation.stopAnimation());
      missingTranslationAnimations.current.clear();
    },
    [],
  );

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
        const hasArmenianTranslation = translationsForToken.some((translation) =>
          ['am', 'hy'].includes(translation.languageCode.toLowerCase()),
        );
        const hasVocabularyEntryForToken = Boolean(vocabularyByText[normalizedWord] || entry);
        const showMissingIndicator =
          shouldRenderTranslation && Boolean(missingTranslationFeedback[normalizedWord]);
        const shouldHideMissingTranslationSlot =
          shouldRenderTranslation && hasVocabularyEntryForToken && !hasArmenianTranslation;
        const tokenTranslation = showMissingIndicator
          ? { hasTranslation: false, text: '∅', visible: true }
          : shouldRenderTranslation && !shouldHideMissingTranslationSlot
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
          outputRange: [1, showMissingIndicator ? 1.2 : 1.34],
        });
        const missingIndicatorAnimation = showMissingIndicator
          ? getMissingTranslationAnimation(normalizedWord)
          : null;
        const missingIndicatorOpacity = missingIndicatorAnimation?.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 1, 1],
        });
        const missingIndicatorScale = missingIndicatorAnimation?.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [
            NO_TRANSLATION_ICON_SCALE * 0.65,
            NO_TRANSLATION_ICON_SCALE * 1.35,
            NO_TRANSLATION_ICON_SCALE,
          ],
        });
        const translationScale = missingIndicatorScale
          ? Animated.multiply(pulseScale, missingIndicatorScale)
          : pulseScale;

        return (
          <Pressable
            key={tok.key}
            onLayout={(event) => handleTokenPositionLayout(segmentId, event)}
            onPress={() => {
              if (isPlaybackNavigationActive) {
                triggerTokenFeedback(normalizedWord);
                handleSeekToSegment(segmentStartMs);
                return;
              }
              const tapAction = getVocabularyTapAction(
                isSelected,
                hasVocabularyEntryForToken,
                hasArmenianTranslation,
              );
              if (tapAction === 'ignore') return;
              triggerTokenFeedback(normalizedWord);
              if (tapAction === 'show-missing-translation') {
                showMissingTranslationFeedback(normalizedWord);
                return;
              }
              handleToggleWordVocabulary(matchedTokenText, normalizedWord);
            }}
            disabled={isPlaybackNavigationActive && segmentStartMs === null}
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
                    fontFamily: showMissingIndicator ? undefined : translationFontFamily,
                    fontSize: fittedTranslation.fontSize,
                    letterSpacing: showMissingIndicator ? 0 : fittedTranslation.letterSpacing,
                    lineHeight: translationLineHeight,
                    maxWidth: translationMaxWidth,
                    minHeight: translationLineHeight,
                    opacity: showMissingIndicator ? missingIndicatorOpacity : undefined,
                  },
                  {
                    transform: [{ scale: translationScale }],
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
                    !showMissingIndicator &&
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
