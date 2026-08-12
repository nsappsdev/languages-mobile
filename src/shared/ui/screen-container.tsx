import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFooterInset } from '@/src/shared/ui/footer-inset-context';
import { layout, spacing, surface } from '@/src/shared/theme';

interface ScreenContainerProps {
  scroll?: boolean;
  maxWidth?: number;
}

export function ScreenContainer({
  children,
  maxWidth = layout.tabletMaxWidth,
  scroll = false,
}: PropsWithChildren<ScreenContainerProps>) {
  const footerInset = useFooterInset();

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.scrollContent, { paddingBottom: footerInset + spacing[4] }]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.content, { paddingBottom: footerInset + spacing[4] }]}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  inner: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
});
