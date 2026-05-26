import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';

export function LessonDashboardState({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer>
      <View style={styles.center}>{children}</View>
    </ScreenContainer>
  );
}
