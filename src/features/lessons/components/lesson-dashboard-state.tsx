import { View } from 'react-native';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';
import { FeedbackState } from '@/src/shared/ui/feedback-state';
import { ScreenContainer } from '@/src/shared/ui/screen-container';

export function LessonDashboardState({
  actionLabel,
  loading = false,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  loading?: boolean;
  message?: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <ScreenContainer>
      <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
        <FeedbackState
          actionLabel={actionLabel}
          loading={loading}
          message={message}
          onAction={onAction}
          title={title}
        />
      </View>
    </ScreenContainer>
  );
}
