import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { fitTranslationLabel } from '@/src/features/tasks/services/translation-fitting';
import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
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
  wordTokens: LessonWordToken[];
}) {
  return (
    <View style={styles.wordFlow} onLayout={onLayout}>
      {wordTokens.map((tok, idx) => {
        const segmentId = tokenSegmentIds[idx];
        const isActiveSegment = segmentId !== null && segmentId === activeSegmentId;
        const segmentStartMs = segmentId ? segmentStartById[segmentId] ?? null : null;
        if (!tok.normalized) {
          return (
            <Text
              key={tok.key}
              style={[styles.wordWhitespace, isActiveSegment && styles.tokenWordActive]}>
              {tok.text}
            </Text>
          );
        }

        const normalizedWord = tok.normalized;
        const isSelected = Boolean(vocabularyByText[normalizedWord]);
        const isPending = Boolean(pendingWords[normalizedWord]);
        const revealTranslation = shouldRevealTokenTranslation(
          Boolean(vocabularyByText[normalizedWord]),
          Boolean(unknownTaps[normalizedWord]),
        );
        const translationsForToken =
          vocabularyByText[normalizedWord]?.entry.translations ??
          entryCacheByText[normalizedWord]?.translations ??
          [];
        const tokenTranslation = getTokenTranslationDisplay(
          translationsForToken,
          revealTranslation,
        );
        const measuredTokenWidth = tokenWidths[tok.key] ?? 0;
        const fittedTranslation = fitTranslationLabel({
          ...translationFitSettings,
          availableWidth: measuredTokenWidth,
          text: tokenTranslation.text,
        });
        const translationLineHeight = Math.ceil(fittedTranslation.fontSize + 3);
        const pulseValue = getTokenPulseValue(normalizedWord);
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
                  Boolean(vocabularyByText[normalizedWord]),
                  translationsForToken.some(
                    (translation) => translation.languageCode.toLowerCase() === 'hy',
                  ),
                )
              ) {
                return;
              }
              triggerTokenFeedback(normalizedWord);
              handleToggleWordVocabulary(tok.text, normalizedWord);
            }}
            disabled={isPlaying && segmentStartMs === null}
            style={styles.tokenWrapper}>
            <View style={styles.tokenPulse}>
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
                    minWidth: measuredTokenWidth || undefined,
                    width: fittedTranslation.containerWidth,
                  },
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                  !tokenTranslation.visible && styles.tokenTranslationHidden,
                ]}>
                {tokenTranslation.text}
              </Animated.Text>
              <Text
                onLayout={(event) => handleTokenWordLayout(tok.key, event)}
                style={[
                  styles.tokenWord,
                  isActiveSegment && styles.tokenWordActive,
                  isSelected && styles.tokenWordSaved,
                  revealTranslation && !isSelected && styles.tokenWordUnknown,
                  isPending && styles.tokenWordPending,
                ]}>
                {tok.text}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
