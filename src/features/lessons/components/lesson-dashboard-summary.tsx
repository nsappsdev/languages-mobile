import { Text, View } from 'react-native';
import type { Lesson } from '@/src/types/domain';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';

export function LessonDashboardHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.meta}>Pick any level. Badges show your progress.</Text>
    </View>
  );
}

export function LessonSummaryCards({
  completedLessons,
  totalLessons,
}: {
  completedLessons: number;
  totalLessons: number;
}) {
  return (
    <View style={styles.summaryRow}>
      <SummaryCard label="Total Lessons" value={String(totalLessons)} />
      <SummaryCard label="Completed" value={String(completedLessons)} />
    </View>
  );
}

export function LearningProgressCard({
  currentLesson,
  progressPercent,
  totalLessons,
}: {
  currentLesson: Lesson | null;
  progressPercent: number;
  totalLessons: number;
}) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Learning Progress</Text>
        <Text style={styles.progressValue}>{progressPercent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>
      <Text style={styles.currentLessonMeta}>
        {currentLesson
          ? `Current level: ${currentLesson.title}`
          : totalLessons
            ? 'All levels completed. Great work.'
            : 'No lessons available yet.'}
      </Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}
