import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  getLessonCardStatus,
  type LessonCardStatus,
} from '@/src/features/lessons/services/lesson-dashboard-helpers';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';
import type { Lesson } from '@/src/types/domain';

export function LessonDashboardList({
  completedSet,
  currentLessonId,
  isRefreshing,
  lessons,
  onOpenLesson,
  onRefresh,
}: {
  completedSet: Set<string>;
  currentLessonId: string | null;
  isRefreshing: boolean;
  lessons: Lesson[];
  onOpenLesson: (lesson: Lesson) => void;
  onRefresh: () => void;
}) {
  return (
    <FlatList
      data={lessons}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <LessonCard
          completedSet={completedSet}
          currentLessonId={currentLessonId}
          index={index}
          lesson={item}
          onOpenLesson={onOpenLesson}
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No lessons yet.</Text>
          <Text style={styles.emptyText}>Published lessons will appear here.</Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function LessonCard({
  completedSet,
  currentLessonId,
  index,
  lesson,
  onOpenLesson,
}: {
  completedSet: Set<string>;
  currentLessonId: string | null;
  index: number;
  lesson: Lesson;
  onOpenLesson: (lesson: Lesson) => void;
}) {
  const status = getLessonCardStatus({
    lessonId: lesson.id,
    completedSet,
    currentLessonId,
  });
  const isCurrent = status === 'CURRENT';

  return (
    <Pressable
      onPress={() => onOpenLesson(lesson)}
      style={({ pressed }) => [
        styles.card,
        isCurrent && styles.cardCurrent,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{`Level ${index + 1}: ${lesson.title}`}</Text>
        <Text style={[styles.status, getStatusStyle(status)]}>{status}</Text>
      </View>

      <Text style={styles.cardDescription}>{lesson.description || 'No description provided.'}</Text>
      <Text style={styles.cardMeta}>{lesson.items?.length ?? 0} items</Text>
    </Pressable>
  );
}

function getStatusStyle(status: LessonCardStatus) {
  if (status === 'COMPLETED') {
    return styles.statusCompleted;
  }
  if (status === 'CURRENT') {
    return styles.statusCurrent;
  }
  return styles.statusOpen;
}
