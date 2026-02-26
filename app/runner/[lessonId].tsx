import { useLocalSearchParams } from 'expo-router';
import { TaskRunnerScreen } from '@/src/features/tasks/screens/task-runner-screen';

export default function TaskRunnerRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  return <TaskRunnerScreen lessonId={lessonId ?? ''} />;
}
