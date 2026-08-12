import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/src/shared/auth/session-context';
import { ErrorBoundary } from '@/src/shared/ui/error-boundary';
import { AppUpdateNotice } from '@/src/shared/ui/app-update-notice';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="runner/[lessonId]" />
            <Stack.Screen name="runner-2/[lessonId]" />
            <Stack.Screen name="results/[lessonId]" />
          </Stack>
          <AppUpdateNotice />
          <StatusBar style="dark" />
        </SessionProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
