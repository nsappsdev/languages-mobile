import { Text, View } from 'react-native';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

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
      <Text style={styles.title}>Vocabulary</Text>
      <Text style={styles.meta}>
        Choose a lesson to review its saved unknown words.
      </Text>
      {syncMeta ? <Text style={styles.syncMeta}>{syncMeta}</Text> : null}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>To review</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{learnedCount}</Text>
          <Text style={styles.summaryLabel}>Learned</Text>
        </View>
      </View>
    </View>
  );
}
