import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  LessonVocabularyRow,
  LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyReviewDecision } from '@/src/types/domain';
import {
  border,
  brand,
  controlSize,
  iconSize,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import { ProgressBar } from '@/src/shared/ui/progress-bar';
import { VocabularyReviewRow } from './vocabulary-review-row';
import {
  VocabularyBackButton,
  VocabularySyncNotice,
  vocabularySharedStyles,
} from './vocabulary-shared';

export function VocabularyLessonReview({
  onBack,
  onPlayContext,
  onPlayWord,
  onReview,
  section,
  syncMeta,
}: {
  onBack: () => void;
  onPlayContext: (row: LessonVocabularyRow) => void;
  onPlayWord: (row: LessonVocabularyRow) => void;
  onReview: (row: LessonVocabularyRow, decision: VocabularyReviewDecision) => void;
  section: LessonVocabularySection;
  syncMeta?: string | null;
}) {
  const [revealedEntryId, setRevealedEntryId] = useState<string | null>(null);
  const activeRows = useMemo(
    () => section.items.filter((item) => item.status === 'LEARNING'),
    [section.items],
  );
  const learnedCount = useMemo(
    () => section.items.filter((item) => item.status === 'LEARNED').length,
    [section.items],
  );
  const totalCount = activeRows.length + learnedCount;
  const progress = totalCount === 0 ? 1 : learnedCount / totalCount;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}>
      <View style={styles.header}>
        <VocabularyBackButton label="Back to vocabulary lessons" onPress={onBack} />
        <Text style={vocabularySharedStyles.eyebrow}>Lesson review</Text>
        <Text style={vocabularySharedStyles.screenTitle}>{section.title}</Text>
        <Text style={vocabularySharedStyles.body}>
          Reveal each Armenian translation, then choose Again or Know.
        </Text>
        {syncMeta ? <VocabularySyncNotice message={syncMeta} /> : null}
        <View style={styles.progressCard}>
          <View style={styles.progressCopy}>
            <Text style={styles.progressLabel}>Lesson progress</Text>
            <Text style={styles.progressCount}>
              {activeRows.length} remaining · {learnedCount} learned
            </Text>
          </View>
          <ProgressBar progress={progress} />
        </View>
      </View>

      {activeRows.length === 0 ? (
        <CompletionState onBack={onBack} />
      ) : (
        <View style={styles.reviewList}>
          {activeRows.map((row) => {
            const revealed = revealedEntryId === row.entryId;
            return (
              <VocabularyReviewRow
                key={row.entryId}
                onPlayContext={() => onPlayContext(row)}
                onPlayWord={() => onPlayWord(row)}
                onReveal={() => setRevealedEntryId(row.entryId)}
                onReview={(decision) => {
                  setRevealedEntryId(null);
                  onReview(row, decision);
                }}
                revealed={revealed}
                row={row}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function CompletionState({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.completionCard}>
      <View style={styles.completionIcon}>
        <Ionicons name="checkmark" size={iconSize.hero} color={text.success} />
      </View>
      <Text style={styles.completionTitle}>Lesson vocabulary complete</Text>
      <Text style={styles.completionText}>Every saved word from this lesson is learned.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [
          styles.completionButton,
          pressed && vocabularySharedStyles.pressed,
        ]}>
        <Text style={styles.completionButtonText}>Back to lessons</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing[6],
  },
  header: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  progressCard: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[3],
    marginTop: spacing[2],
    padding: spacing[3],
  },
  progressCopy: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: text.primary,
    ...typography.label,
  },
  progressCount: {
    color: text.secondary,
    ...typography.caption,
  },
  reviewList: {
    gap: spacing[4],
  },
  completionCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.active,
    borderRadius: radii['3xl'],
    borderWidth: 1,
    gap: spacing[3],
    marginTop: spacing[4],
    padding: spacing[6],
  },
  completionIcon: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  completionTitle: {
    color: text.primary,
    ...typography.sectionTitle,
    textAlign: 'center',
  },
  completionText: {
    color: text.secondary,
    ...typography.body,
    textAlign: 'center',
  },
  completionButton: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii.lg,
    justifyContent: 'center',
    marginTop: spacing[2],
    minHeight: controlSize.standard,
    paddingHorizontal: spacing[5],
  },
  completionButtonText: {
    color: text.inverse,
    ...typography.label,
  },
});
