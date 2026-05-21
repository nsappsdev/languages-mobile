import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularyStateScreen({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer>
      <View style={styles.center}>{children}</View>
    </ScreenContainer>
  );
}
