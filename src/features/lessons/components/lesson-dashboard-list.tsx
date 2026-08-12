import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { FlatList, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import {
  getLessonCardStatus,
  type LessonCardStatus,
} from '@/src/features/lessons/services/lesson-dashboard-helpers';
import { styles } from '@/src/features/lessons/screens/lesson-list-screen.styles';
import { brand, palette, text } from '@/src/shared/theme';
import { Card } from '@/src/shared/ui/card';
import type { Lesson } from '@/src/types/domain';

const TWO_COLUMN_BREAKPOINT = 700;

export function LessonDashboardList({
  children,
  completedSet,
  currentLessonId,
  isRefreshing,
  lessons,
  onOpenLesson,
  onRefresh,
}: {
  children: ReactNode;
  completedSet: Set<string>;
  currentLessonId: string | null;
  isRefreshing: boolean;
  lessons: Lesson[];
  onOpenLesson: (lesson: Lesson) => void;
  onRefresh: () => void;
}) {
  const { width } = useWindowDimensions();
  const usesTwoColumns = width >= TWO_COLUMN_BREAKPOINT;

  return (
    <FlatList
      key={usesTwoColumns ? 'lesson-grid' : 'lesson-list'}
      data={lessons}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={styles.lessonColumn}>
          <LessonCard
            completedSet={completedSet}
            currentLessonId={currentLessonId}
            index={index}
            lesson={item}
            onOpenLesson={onOpenLesson}
          />
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {children}
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              All lessons
            </Text>
            <Text style={styles.sectionMeta}>{`${lessons.length} available`}</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="book-outline" size={24} color={brand[700]} />
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>
            No lessons yet
          </Text>
          <Text style={styles.emptyText}>Published lessons will appear here.</Text>
        </Card>
      }
      columnWrapperStyle={usesTwoColumns ? styles.lessonRow : undefined}
      contentContainerStyle={styles.listContent}
      numColumns={usesTwoColumns ? 2 : 1}
      refreshControl={
        <RefreshControl
          colors={[brand[700]]}
          onRefresh={onRefresh}
          progressBackgroundColor={palette.surface}
          refreshing={isRefreshing}
          tintColor={brand[700]}
        />
      }
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
  const itemCount = lesson.items?.length ?? 0;
  const actionLabel = status === 'CURRENT' ? 'Continue' : status === 'COMPLETED' ? 'Review' : 'Start';

  return (
    <Card
      accessibilityLabel={`Level ${index + 1}, ${lesson.title}. ${getReadableStatus(status)}. ${itemCount} ${itemCount === 1 ? 'item' : 'items'}. ${actionLabel} lesson.`}
      onPress={() => onOpenLesson(lesson)}
      selected={isCurrent}
      style={isCurrent ? { ...styles.lessonCard, ...styles.lessonCardCurrent } : styles.lessonCard}>
      <View style={styles.cardTopRow}>
        <View style={[styles.levelMarker, isCurrent && styles.levelMarkerCurrent]}>
          <Text style={[styles.levelNumber, isCurrent && styles.levelNumberCurrent]}>
            {index + 1}
          </Text>
        </View>
        <LessonStatusBadge status={status} />
      </View>

      <Text accessibilityRole="header" style={styles.cardTitle}>
        {lesson.title}
      </Text>
      <Text style={styles.cardDescription}>
        {lesson.description || 'No description provided.'}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.cardMetaRow}>
          <Ionicons name="document-text-outline" size={16} color={text.secondary} />
          <Text style={styles.cardMeta}>{`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}</Text>
        </View>
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color={brand[700]} />
        </View>
      </View>
    </Card>
  );
}

function LessonStatusBadge({ status }: { status: LessonCardStatus }) {
  const isCompleted = status === 'COMPLETED';
  const isCurrent = status === 'CURRENT';
  const badgeStyle = isCompleted
    ? styles.statusCompleted
    : isCurrent
      ? styles.statusCurrent
      : styles.statusOpen;
  const textStyle = isCompleted
    ? styles.statusTextCompleted
    : isCurrent
      ? styles.statusTextCurrent
      : styles.statusTextOpen;
  const icon = isCompleted ? 'checkmark' : isCurrent ? 'play' : 'ellipse-outline';
  const color = isCompleted ? text.success : isCurrent ? text.brand : text.warning;

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.statusText, textStyle]}>{status}</Text>
    </View>
  );
}

function getReadableStatus(status: LessonCardStatus) {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CURRENT') return 'Current lesson';
  return 'Open';
}
