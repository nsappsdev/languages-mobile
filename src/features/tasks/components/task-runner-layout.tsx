import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { brand, neutral } from '@/src/shared/theme';
import { ProgressBar } from '@/src/shared/ui/progress-bar';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import type { ReadingModeSettings } from '@/src/types/domain';

export function BackToDashboardLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Back to dashboard"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.dashboardLink, pressed && styles.audioIconButtonPressed]}>
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
  variant = 'dock',
}: {
  activeModeId: string | null;
  getDisabledReason: (modeId: ReadingModeSettings['id']) => string | null;
  modes: ReadingModeSettings[];
  onToggleMode: (mode: ReadingModeSettings) => void;
  playing: boolean;
  variant?: 'book' | 'dock';
}) {
  return (
    <View style={[styles.audioDock, variant === 'book' && styles.audioDockBook]}>
      {modes.map((mode) => {
        const disabledReason = getDisabledReason(mode.id);
        const isActive = activeModeId === mode.id && playing;
        const isSelected = activeModeId === mode.id;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onToggleMode(mode)}
            disabled={Boolean(disabledReason)}
            accessibilityRole="button"
            accessibilityLabel={`${isActive ? 'Pause' : 'Play'} ${mode.displayName}`}
            accessibilityHint={disabledReason ?? undefined}
            accessibilityState={{ disabled: Boolean(disabledReason), selected: isSelected }}
            style={({ pressed }) => [
              styles.modeButton,
              variant === 'book' && styles.modeButtonBook,
              isActive && variant === 'dock' && styles.modeButtonActive,
              disabledReason && styles.audioIconButtonDisabled,
              pressed && !disabledReason && styles.audioIconButtonPressed,
            ]}>
            {variant === 'dock' ? (
              <Ionicons
                name={isActive ? 'pause' : 'play'}
                size={16}
                color={isActive ? neutral[0] : brand[700]}
              />
            ) : null}
            <Text
              style={[
                styles.modeButtonText,
                variant === 'book' && styles.modeButtonTextBook,
                isActive && variant === 'dock' && styles.modeButtonTextActive,
                isSelected && variant === 'book' && styles.modeButtonTextBookSelected,
              ]}>
              {mode.displayName}
            </Text>
            {variant === 'book' && isSelected ? <View style={styles.modeSelectionDot} /> : null}
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
      <Text style={styles.eyebrow}>Focused lesson</Text>
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
      <ProgressBar progress={completion / 100} />
    </View>
  );
}
