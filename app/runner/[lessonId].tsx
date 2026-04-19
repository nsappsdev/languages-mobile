import { Redirect, useLocalSearchParams } from 'expo-router';
import { TaskRunnerScreen } from '@/src/features/tasks/screens/task-runner-screen';
import { useSession } from '@/src/shared/auth/session-context';

export default function TaskRunnerRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { user } = useSession();

  if (user && user.emailVerified === false) {
    return <Redirect href="/(tabs)/lessons" />;
  }

  return <TaskRunnerScreen lessonId={lessonId ?? ''} />;
}
