import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';

interface LessonResultsScreenProps {
  lessonId: string;
  score: string;
  total: string;
  completion: string;
}

export function LessonResultsScreen({ lessonId, score, total, completion }: LessonResultsScreenProps) {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Lesson Complete</Text>
        <Text style={styles.subtitle}>Great work. Here is your summary for this run.</Text>

        <View style={styles.stats}>
          <StatCard label="Score" value={`${score}%`} />
          <StatCard label="Completion" value={`${completion}%`} />
          <StatCard label="Tasks" value={total} />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title="Retry Lesson"
            onPress={() =>
              router.replace({
                pathname: '/runner/[lessonId]',
                params: { lessonId },
              })
            }
          />
          <PrimaryButton title="Back to Lessons" onPress={() => router.replace('/(tabs)/lessons')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#475569',
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 24,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: '#0f766e',
    fontSize: 20,
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
});
