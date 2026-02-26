import { useLocalSearchParams } from 'expo-router';
import { LessonDetailScreen } from '@/src/features/lessons/screens/lesson-detail-screen';

export default function LessonDetailRoute() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  return <LessonDetailScreen lessonId={lessonId ?? ''} />;
}
