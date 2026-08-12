import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import {
  border,
  brand,
  elevation,
  iconSize,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import { VocabularySyncNotice, vocabularySharedStyles } from './vocabulary-shared';

export function VocabularyOverview({
  activeCount,
  learnedCount,
  syncMeta,
}: {
  activeCount: number;
  learnedCount: number;
  syncMeta: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={vocabularySharedStyles.eyebrow}>Your word library</Text>
        <Text style={vocabularySharedStyles.screenTitle}>Vocabulary</Text>
        <Text style={vocabularySharedStyles.body}>
          Return to saved words and build lasting recall, one lesson at a time.
        </Text>
      </View>

      {syncMeta ? <VocabularySyncNotice message={syncMeta} /> : null}

      <View style={styles.summaryRow}>
        <View style={styles.primarySummary}>
          <Text style={styles.primaryValue}>{activeCount}</Text>
          <View style={styles.summaryCopy}>
            <Text style={styles.primaryLabel}>Ready to review</Text>
            <Text style={styles.primaryMeta}>Saved from your lessons</Text>
          </View>
        </View>
        <View style={styles.secondarySummary}>
          <Ionicons name="checkmark-circle-outline" size={iconSize.xl} color={text.success} />
          <Text style={styles.secondaryValue}>{learnedCount}</Text>
          <Text style={styles.secondaryLabel}>Learned</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing[4],
  },
  heading: {
    gap: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  primarySummary: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii['2xl'],
    flex: 2,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 112,
    padding: spacing[4],
    ...elevation.raised,
  },
  primaryValue: {
    color: text.inverse,
    ...typography.display,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing[1],
  },
  primaryLabel: {
    color: text.inverse,
    ...typography.label,
  },
  primaryMeta: {
    color: surface.active,
    ...typography.caption,
  },
  secondarySummary: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 112,
    padding: spacing[3],
    ...elevation.raised,
  },
  secondaryValue: {
    color: text.primary,
    ...typography.cardTitle,
    marginTop: spacing[1],
  },
  secondaryLabel: {
    color: text.secondary,
    ...typography.caption,
  },
});
