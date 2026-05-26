import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { brand, neutral } from '@/src/shared/theme';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import type { ReadingModeSettings } from '@/src/types/domain';

export function BackToDashboardLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.dashboardLink}>
      <Ionicons name="chevron-back" size={18} color={brand[700]} />
      <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
    </Pressable>
  );
}

export function RunnerMessageScreen({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <ScreenContainer>
      <BackToDashboardLink onPress={onBack} />
      <View style={styles.center}>{children}</View>
    </ScreenContainer>
  );
}

export function ReadingModeDock({
  activeModeId,
  getDisabledReason,
  modes,
  onToggleMode,
  playing,
}: {
  activeModeId: string | null;
  getDisabledReason: (modeId: ReadingModeSettings['id']) => string | null;
  modes: ReadingModeSettings[];
  onToggleMode: (mode: ReadingModeSettings) => void;
  playing: boolean;
}) {
  return (
    <View style={styles.audioDock}>
      {modes.map((mode) => {
        const disabledReason = getDisabledReason(mode.id);
        const isActive = activeModeId === mode.id && playing;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onToggleMode(mode)}
            disabled={Boolean(disabledReason)}
            accessibilityRole="button"
            accessibilityLabel={`${isActive ? 'Pause' : 'Play'} ${mode.displayName}`}
            style={({ pressed }) => [
              styles.modeButton,
              isActive && styles.modeButtonActive,
              disabledReason && styles.audioIconButtonDisabled,
              pressed && !disabledReason && styles.audioIconButtonPressed,
            ]}>
            <Ionicons
              name={isActive ? 'pause' : 'play'}
              size={16}
              color={isActive ? neutral[0] : brand[700]}
            />
            <Text style={[styles.modeButtonText, isActive && styles.modeButtonTextActive]}>
              {mode.displayName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LessonRunnerHeader({
  lessonTitle,
  onBack,
  progressText,
}: {
  lessonTitle: string;
  onBack: () => void;
  progressText: string;
}) {
  return (
    <View style={styles.header}>
      <BackToDashboardLink onPress={onBack} />
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>{lessonTitle}</Text>
        <Text style={styles.progress}>{progressText}</Text>
      </View>
    </View>
  );
}

export function LessonProgressOverview({ completion }: { completion: number }) {
  return (
    <View style={styles.overviewCard}>
      <Text style={styles.overviewLabel}>Lesson Progress</Text>
      <Text style={styles.overviewValue}>{completion}% complete</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completion}%` }]} />
      </View>
    </View>
  );
}
