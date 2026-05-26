import { Text, View } from 'react-native';
import type { LessonDictionarySummary } from '@/src/features/vocabulary/services/vocabulary-screen-helpers';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularyOverview({
  summary,
  syncMeta,
}: {
  summary: LessonDictionarySummary;
  syncMeta: string | null;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Dictionary</Text>
      <Text style={styles.meta}>
        Saved unknown words are grouped by lesson. Tap a lesson title to open its dictionary.
      </Text>
      {syncMeta ? <Text style={styles.syncMeta}>{syncMeta}</Text> : null}

      <View style={styles.summaryRow}>
        <SummaryCard label="Saved" value={summary.total} />
        <SummaryCard label="Lessons" value={summary.lessons} />
        <SummaryCard label="Review" value={summary.needsReview} />
      </View>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
