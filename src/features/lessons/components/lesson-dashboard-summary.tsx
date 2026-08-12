import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';
import { brand } from '@/src/shared/theme';
import { Card } from '@/src/shared/ui/card';
import { ProgressBar } from '@/src/shared/ui/progress-bar';
import type { Lesson } from '@/src/types/domain';

export function LessonDashboardHeader({
  eyebrow = 'LESSON LIBRARY',
  subtitle = 'Choose any lesson and keep building your English at your pace.',
  title = 'Your learning path',
}: {
  eyebrow?: string;
  subtitle?: string;
  title?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.meta}>{subtitle}</Text>
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
      <SummaryCard icon="library-outline" label="Total lessons" value={String(totalLessons)} />
      <SummaryCard
        icon="checkmark-circle-outline"
        label="Completed"
        value={String(completedLessons)}
      />
    </View>
  );
}

export function LearningProgressCard({
  completedLessons,
  currentLesson,
  progressPercent,
  totalLessons,
}: {
  completedLessons: number;
  currentLesson: Lesson | null;
  progressPercent: number;
  totalLessons: number;
}) {
  const isComplete = totalLessons > 0 && progressPercent === 100;
  const currentLessonText = isComplete
    ? 'All lessons completed. Great work.'
    : currentLesson
      ? `Up next: ${currentLesson.title}`
      : 'No lessons available yet.';

  return (
    <Card style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <Text accessibilityRole="header" style={styles.progressTitle}>
          Learning progress
        </Text>
        <View style={styles.progressValuePill}>
          <Text style={styles.progressValue}>{progressPercent}%</Text>
        </View>
      </View>

      <ProgressBar progress={progressPercent / 100} />
      <Text style={styles.progressSupportingText}>
        {totalLessons
          ? `${completedLessons} of ${totalLessons} lessons complete`
          : 'Your progress will appear when lessons are published.'}
      </Text>

      <View style={styles.currentLessonRow}>
        <Ionicons
          accessibilityElementsHidden
          color={brand[700]}
          importantForAccessibility="no-hide-descendants"
          name={isComplete ? 'checkmark-circle' : 'bookmark-outline'}
          size={18}
        />
        <Text style={styles.currentLessonMeta}>{currentLessonText}</Text>
      </View>
    </Card>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: 'checkmark-circle-outline' | 'library-outline';
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.summaryCard}>
      <View
        accessible
        accessibilityLabel={`${label}: ${value}`}
        accessibilityRole="summary">
        <View style={styles.summaryIcon}>
          <Ionicons
            accessibilityElementsHidden
            color={brand[700]}
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={18}
          />
        </View>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </Card>
  );
}
