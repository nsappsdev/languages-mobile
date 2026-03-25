import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  scroll?: boolean;
}

export function ScreenContainer({ children, scroll = false }: PropsWithChildren<ScreenContainerProps>) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f8fafc',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 110,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 110,
  },
});
