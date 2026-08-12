import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type { LessonVocabularyRow } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyReviewDecision } from '@/src/types/domain';
import {
  border,
  brand,
  controlSize,
  elevation,
  iconSize,
  radii,
  spacing,
  status,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import { vocabularySharedStyles } from './vocabulary-shared';
import { buildHiddenTranslation } from './vocabulary-presentation';

export function VocabularyReviewRow({
  onPlayContext,
  onPlayWord,
  onReveal,
  onReview,
  revealed,
  row,
}: {
  onPlayContext: () => void;
  onPlayWord: () => void;
  onReveal: () => void;
  onReview: (decision: VocabularyReviewDecision) => void;
  revealed: boolean;
  row: LessonVocabularyRow;
}) {
  const translation = pickArmenianTranslationText(row.entry.translations) ?? '';

  return (
    <View style={[styles.card, revealed && styles.cardRevealed]}>
      <View style={styles.wordHeader}>
        <View style={styles.wordCopy}>
          <Text style={styles.eyebrow}>English</Text>
          <Text selectable style={styles.english}>
            {row.entry.englishText}
          </Text>
        </View>
        <ReviewProgress correctStreak={row.correctStreak} />
      </View>

      <Pressable
        accessibilityLabel={
          revealed
            ? `Armenian translation: ${translation}`
            : `Reveal Armenian translation for ${row.entry.englishText}`
        }
        accessibilityHint={revealed ? undefined : 'Reveals the answer and review actions'}
        accessibilityRole="button"
        accessibilityState={{ expanded: revealed }}
        onPress={onReveal}
        style={({ pressed }) => [
          styles.translationPanel,
          revealed && styles.translationPanelRevealed,
          pressed && vocabularySharedStyles.pressed,
        ]}>
        <View style={styles.translationHeading}>
          <Text style={styles.eyebrow}>Armenian</Text>
          {!revealed ? (
            <View style={styles.revealPrompt}>
              <Ionicons name="eye-outline" size={iconSize.sm} color={brand[700]} />
              <Text style={styles.revealPromptText}>Tap to reveal</Text>
            </View>
          ) : null}
        </View>
        {revealed ? (
          <Text selectable style={styles.translation}>
            {translation}
          </Text>
        ) : (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            numberOfLines={1}
            style={styles.hiddenTranslation}>
            {buildHiddenTranslation(translation)}
          </Text>
        )}
      </Pressable>

      <View style={styles.audioRow}>
        <AudioAction
          icon="volume-high-outline"
          label={`Play ${row.entry.englishText}`}
          onPress={onPlayWord}
          title="Word"
        />
        <AudioAction
          icon="chatbox-ellipses-outline"
          label={`Play context for ${row.entry.englishText}`}
          onPress={onPlayContext}
          title="Context"
        />
      </View>

      {revealed ? (
        <View style={styles.decisionArea}>
          <Text style={styles.decisionHint}>How well did you remember it?</Text>
          <View style={styles.decisionRow}>
            <Pressable
              accessibilityLabel={`Mark ${row.entry.englishText} for more practice`}
              accessibilityHint="Resets this word's correct streak"
              accessibilityRole="button"
              onPress={() => onReview('AGAIN')}
              style={({ pressed }) => [
                styles.decisionButton,
                styles.againButton,
                pressed && vocabularySharedStyles.pressed,
              ]}>
              <Ionicons name="refresh-outline" size={iconSize.lg} color={text.warning} />
              <Text style={styles.againText}>Again</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Mark ${row.entry.englishText} as known`}
              accessibilityHint={
                row.correctStreak === 1
                  ? 'Completes mastery for this word'
                  : 'Adds one correct review toward mastery'
              }
              accessibilityRole="button"
              onPress={() => onReview('KNOW')}
              style={({ pressed }) => [
                styles.decisionButton,
                styles.knowButton,
                pressed && vocabularySharedStyles.pressed,
              ]}>
              <Ionicons name="checkmark" size={iconSize.lg} color={text.inverse} />
              <Text style={styles.knowText}>
                {row.correctStreak === 1 ? 'Know · finish' : 'Know'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ReviewProgress({ correctStreak }: { correctStreak: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${correctStreak} of 2 correct reviews`}
      style={styles.progressStatus}>
      <View style={styles.progressDots}>
        {[0, 1].map((index) => (
          <View
            key={index}
            style={[styles.progressDot, index < correctStreak && styles.progressDotComplete]}
          />
        ))}
      </View>
      <Text style={styles.progressText}>{correctStreak}/2</Text>
    </View>
  );
}

function AudioAction({
  icon,
  label,
  onPress,
  title,
}: {
  icon: 'volume-high-outline' | 'chatbox-ellipses-outline';
  label: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityHint="Plays audio"
      accessibilityRole="button"
      hitSlop={spacing[1]}
      onPress={onPress}
      style={({ pressed }) => [styles.audioButton, pressed && vocabularySharedStyles.pressed]}>
      <Ionicons name={icon} size={iconSize.md} color={brand[700]} />
      <Text style={styles.audioButtonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[4],
    ...elevation.raised,
  },
  cardRevealed: {
    borderColor: border.active,
    ...elevation.focus,
  },
  wordHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  wordCopy: {
    flex: 1,
    gap: spacing[1],
  },
  eyebrow: {
    color: text.muted,
    ...typography.micro,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  english: {
    color: text.primary,
    ...typography.sectionTitle,
  },
  progressStatus: {
    alignItems: 'center',
    backgroundColor: surface.subtle,
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: controlSize.minimumTarget,
    paddingHorizontal: spacing[3],
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  progressDot: {
    backgroundColor: border.strong,
    borderRadius: radii.full,
    height: spacing[2],
    width: spacing[2],
  },
  progressDotComplete: {
    backgroundColor: brand[700],
  },
  progressText: {
    color: text.secondary,
    ...typography.caption,
  },
  translationPanel: {
    backgroundColor: surface.subtle,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing[2],
    justifyContent: 'center',
    minHeight: 88,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  translationPanelRevealed: {
    backgroundColor: surface.active,
    borderColor: border.active,
    borderStyle: 'solid',
  },
  translationHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revealPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
  },
  revealPromptText: {
    color: text.brand,
    ...typography.caption,
  },
  translation: {
    color: text.brand,
    ...typography.sectionTitle,
  },
  hiddenTranslation: {
    color: border.strong,
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: typography.bodyLarge.fontWeight,
    letterSpacing: 2,
    lineHeight: typography.bodyLarge.lineHeight,
  },
  audioRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  audioButton: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.strong,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: controlSize.minimumTarget,
    paddingHorizontal: spacing[3],
  },
  audioButtonText: {
    color: text.brand,
    ...typography.label,
  },
  decisionArea: {
    borderTopColor: border.default,
    borderTopWidth: 1,
    gap: spacing[2],
    paddingTop: spacing[3],
  },
  decisionHint: {
    color: text.secondary,
    ...typography.caption,
    textAlign: 'center',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  decisionButton: {
    alignItems: 'center',
    borderRadius: radii.lg,
    flex: 1,
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    minHeight: controlSize.standard,
    paddingHorizontal: spacing[3],
  },
  againButton: {
    backgroundColor: status.warningBg,
    borderColor: border.warning,
    borderWidth: 1,
  },
  againText: {
    color: text.warning,
    ...typography.label,
  },
  knowButton: {
    backgroundColor: brand[700],
  },
  knowText: {
    color: text.inverse,
    ...typography.label,
  },
});
