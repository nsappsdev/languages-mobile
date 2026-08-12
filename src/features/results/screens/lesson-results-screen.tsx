import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { border, palette, radii, spacing, text, typography } from '@/src/shared/theme';
import { Card } from '@/src/shared/ui/card';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';

interface LessonResultsScreenProps {
  lessonId: string;
  items: string;
  completion: string;
}

export function LessonResultsScreen({
  lessonId,
  items,
  completion,
}: LessonResultsScreenProps) {
  const router = useRouter();
  const { fontScale, width } = useWindowDimensions();
  const shouldStackStats = width < 390 || fontScale > 1.2;

  return (
    <ScreenContainer scroll maxWidth={680}>
      <View style={styles.container}>
        <View
          accessibilityLabel="Lesson completed"
          accessibilityRole="summary"
          style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons color={palette.primary} name="checkmark" size={32} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Lesson complete
          </Text>
          <Text style={styles.subtitle}>
            You finished this text-and-audio lesson. Take a moment to review your progress.
          </Text>
        </View>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>Lesson summary</Text>
          <View style={[styles.stats, shouldStackStats && styles.statsStacked]}>
            <Stat label="Completion" value={`${completion}%`} stacked={shouldStackStats} />
            <Stat label="Items" value={items} stacked={shouldStackStats} />
            <Stat label="Mode" value="Audio" isLast stacked={shouldStackStats} />
          </View>
        </Card>

        <View style={styles.actions}>
          <PrimaryButton
            title="Back to lessons"
            onPress={() => router.replace('/(tabs)/lessons')}
          />
          <PrimaryButton
            title="Repeat lesson"
            variant="secondary"
            onPress={() =>
              router.replace({
                pathname: '/runner/[lessonId]',
                params: { lessonId },
              })
            }
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function Stat({
  label,
  value,
  isLast = false,
  stacked = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  stacked?: boolean;
}) {
  return (
    <View
      style={[
        styles.stat,
        stacked && styles.statStacked,
        isLast && styles.statLast,
        isLast && stacked && styles.statStackedLast,
      ]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: radii.full,
    height: 64,
    justifyContent: 'center',
    marginBottom: spacing[4],
    width: 64,
  },
  title: {
    color: text.primary,
    marginBottom: spacing[2],
    textAlign: 'center',
    ...typography.display,
  },
  subtitle: {
    color: text.secondary,
    maxWidth: 500,
    textAlign: 'center',
    ...typography.body,
  },
  summaryCard: {
    marginBottom: spacing[6],
    padding: spacing[5],
  },
  summaryEyebrow: {
    color: text.secondary,
    letterSpacing: 1,
    marginBottom: spacing[4],
    textTransform: 'uppercase',
    ...typography.caption,
  },
  stats: {
    flexDirection: 'row',
  },
  statsStacked: {
    flexDirection: 'column',
  },
  stat: {
    borderRightColor: border.default,
    borderRightWidth: 1,
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  statLast: {
    borderRightWidth: 0,
  },
  statStacked: {
    borderBottomColor: border.default,
    borderBottomWidth: 1,
    borderRightWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: spacing[3],
  },
  statStackedLast: {
    borderBottomWidth: 0,
  },
  statLabel: {
    color: text.secondary,
    ...typography.caption,
  },
  statValue: {
    color: text.brand,
    ...typography.cardTitle,
  },
  actions: {
    gap: spacing[3],
  },
});
