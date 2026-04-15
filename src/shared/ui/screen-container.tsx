import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFooterInset } from '@/src/shared/ui/footer-inset-context';
import { surface } from '@/src/shared/theme';

interface ScreenContainerProps {
  scroll?: boolean;
}

export function ScreenContainer({ children, scroll = false }: PropsWithChildren<ScreenContainerProps>) {
  const footerInset = useFooterInset();

  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: footerInset }]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { paddingBottom: footerInset }]}>{children}</View>
  );

  return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: surface.page,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
});
