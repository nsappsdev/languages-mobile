import { useLocalSearchParams } from 'expo-router';
import { LessonResultsScreen } from '@/src/features/results/screens/lesson-results-screen';

export default function LessonResultsRoute() {
  const { lessonId, items, completion } = useLocalSearchParams<{
    lessonId: string;
    items?: string;
    completion?: string;
  }>();

  return (
    <LessonResultsScreen
      lessonId={lessonId ?? ''}
      items={items ?? '0'}
      completion={completion ?? '0'}
    />
  );
}
