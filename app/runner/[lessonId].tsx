import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { ReaderScreen } from '@/src/features/reader/reader-screen';
import { useSession } from '@/src/shared/auth/session-context';

export default function ReaderRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { isAuthenticated, isInitializing } = useSession();
  if (isInitializing) return <View><ActivityIndicator /></View>;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  return <ReaderScreen key={lessonId} lessonId={lessonId ?? ''} />;
}
