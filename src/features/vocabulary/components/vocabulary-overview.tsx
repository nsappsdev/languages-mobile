import { Text, View } from 'react-native';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';
import type { VocabularySummary } from '@/src/features/vocabulary/services/vocabulary-screen-helpers';

export function VocabularyOverview({
  reviewMeta,
  summary,
  syncMeta,
}: {
  reviewMeta: string | null;
  summary: VocabularySummary;
  syncMeta: string | null;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>My Vocabulary</Text>
        <Text style={styles.meta}>
          Saved words are grouped by lesson topic. Open a lesson section or start Check to review
          words with swipe gestures.
        </Text>
        <Text style={styles.meta}>
          Learned words leave the active vocabulary list automatically after you swipe them right.
        </Text>
        {syncMeta ? <Text style={styles.syncMeta}>{syncMeta}</Text> : null}
        {reviewMeta ? <Text style={styles.syncMeta}>{reviewMeta}</Text> : null}
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="New" value={summary.NEW} />
        <SummaryCard label="Reviewing" value={summary.REVIEWING} />
        <SummaryCard label="Learned" value={summary.MASTERED} />
      </View>
    </>
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
