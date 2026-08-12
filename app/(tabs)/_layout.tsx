import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/src/shared/auth/session-context';
import { FooterInsetProvider } from '@/src/shared/ui/footer-inset-context';
import { GlobalFooter } from '@/src/shared/ui/global-footer';
import { surface } from '@/src/shared/theme';

export default function TabLayout() {
  const { isAuthenticated, isInitializing } = useSession();

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <FooterInsetProvider>
      <View style={styles.shell}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="lessons" />
          <Stack.Screen name="lessons-2" />
          <Stack.Screen name="vocabulary" />
          <Stack.Screen name="profile" />
        </Stack>
        <GlobalFooter />
      </View>
    </FooterInsetProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: surface.page,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: surface.page,
    flex: 1,
    justifyContent: 'center',
  },
});
