import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { TaskRunnerScreen } from '@/src/features/tasks/screens/task-runner-screen';
import { useSession } from '@/src/shared/auth/session-context';

export default function TaskRunnerRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { token, user, refreshProfile } = useSession();

  useEffect(() => {
    if (!token) return;
    refreshProfile().catch(() => null);
  }, [refreshProfile, token]);

  if (user && user.emailVerified !== true) {
    return <Redirect href="/(tabs)/lessons" />;
  }

  return <TaskRunnerScreen lessonId={lessonId ?? ''} />;
}
