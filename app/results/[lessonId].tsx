import { useLocalSearchParams } from 'expo-router';
import { LessonResultsScreen } from '@/src/features/results/screens/lesson-results-screen';

export default function LessonResultsRoute() {
  const { lessonId, score, total, completion } = useLocalSearchParams<{
    lessonId: string;
    score?: string;
    total?: string;
    completion?: string;
  }>();

  return (
    <LessonResultsScreen
      lessonId={lessonId ?? ''}
      score={score ?? '0'}
      total={total ?? '0'}
      completion={completion ?? '0'}
    />
  );
}
