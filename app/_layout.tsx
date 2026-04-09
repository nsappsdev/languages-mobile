import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/src/shared/auth/session-context';
import { ErrorBoundary } from '@/src/shared/ui/error-boundary';
import { FooterInsetProvider } from '@/src/shared/ui/footer-inset-context';
import { GlobalFooter } from '@/src/shared/ui/global-footer';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SessionProvider>
          <FooterInsetProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="lesson/[lessonId]" options={{ title: 'Lesson' }} />
              <Stack.Screen name="runner/[lessonId]" options={{ title: 'Task Runner' }} />
              <Stack.Screen name="results/[lessonId]" options={{ title: 'Lesson Results' }} />
            </Stack>
            <GlobalFooter />
            <StatusBar style="auto" />
          </FooterInsetProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
