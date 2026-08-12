import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { VocabularyLessonSummary } from '@/src/types/domain';
import {
  border,
  brand,
  controlSize,
  elevation,
  iconSize,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import {
  VocabularyEmptyState,
  VocabularySearchField,
  vocabularySharedStyles,
} from './vocabulary-shared';
import { filterVocabularyLessonSummaries } from './vocabulary-presentation';

export function VocabularyDashboard({
  header,
  isRefreshing,
  onOpenArchive,
  onOpenLesson,
  onRefresh,
  summaries,
}: {
  header?: ReactNode;
  isRefreshing: boolean;
  onOpenArchive: () => void;
  onOpenLesson: (lessonId: string) => void;
  onRefresh: () => void;
  summaries: VocabularyLessonSummary[];
}) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () => filterVocabularyLessonSummaries(summaries, search),
    [search, summaries],
  );
  const learnedCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.learnedCount, 0),
    [summaries],
  );

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={filtered}
      keyExtractor={(item) => item.lessonId}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {header}
          <VocabularySearchField
            accessibilityLabel="Search vocabulary lessons"
            onChangeText={setSearch}
            placeholder="Search lessons"
            value={search}
          />
          <Text style={vocabularySharedStyles.eyebrow}>Review by lesson</Text>
        </View>
      }
      ListEmptyComponent={
        <VocabularyEmptyState
          icon={normalizedSearch ? 'search-outline' : 'bookmark-outline'}
          title={normalizedSearch ? 'No matching lessons' : 'No words to review yet'}
          text={
            normalizedSearch
              ? 'Try another lesson title.'
              : 'Tap translated words in a lesson to save them for review.'
          }
        />
      }
      ListFooterComponent={
        learnedCount > 0 ? (
          <ArchiveCard learnedCount={learnedCount} onPress={onOpenArchive} />
        ) : null
      }
      refreshControl={
        <RefreshControl
          colors={[brand[700]]}
          refreshing={isRefreshing}
          tintColor={brand[700]}
          onRefresh={onRefresh}
        />
      }
      renderItem={({ item, index }) => (
        <LessonCard item={item} index={index} onPress={() => onOpenLesson(item.lessonId)} />
      )}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    />
  );
}

function LessonCard({
  index,
  item,
  onPress,
}: {
  index: number;
  item: VocabularyLessonSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${item.title}, ${item.activeCount} words to review`}
      accessibilityRole="button"
      accessibilityHint="Opens this lesson's vocabulary review"
      onPress={onPress}
      style={({ pressed }) => [styles.lessonCard, pressed && vocabularySharedStyles.pressed]}>
      <View style={styles.lessonNumber}>
        <Text style={styles.lessonNumberText}>{String(index + 1).padStart(2, '0')}</Text>
      </View>
      <View style={styles.lessonCopy}>
        <Text numberOfLines={2} style={styles.lessonTitle}>
          {item.title}
        </Text>
        <Text style={styles.lessonMeta}>
          {item.activeCount} {item.activeCount === 1 ? 'word' : 'words'} ready to review
        </Text>
      </View>
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={iconSize.lg} color={brand[700]} />
      </View>
    </Pressable>
  );
}

function ArchiveCard({ learnedCount, onPress }: { learnedCount: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Open learned vocabulary, ${learnedCount} words`}
      accessibilityRole="button"
      accessibilityHint="Opens your learned word archive"
      onPress={onPress}
      style={({ pressed }) => [styles.archiveCard, pressed && vocabularySharedStyles.pressed]}>
      <View style={styles.archiveIcon}>
        <Ionicons name="checkmark" size={iconSize.xl} color={text.success} />
      </View>
      <View style={styles.lessonCopy}>
        <Text style={styles.archiveTitle}>Learned words</Text>
        <Text style={styles.archiveMeta}>
          {learnedCount} {learnedCount === 1 ? 'word' : 'words'} in your archive
        </Text>
      </View>
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={iconSize.lg} color={brand[700]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listHeader: {
    gap: spacing[4],
    marginBottom: spacing[3],
  },
  listContent: {
    gap: spacing[3],
    paddingBottom: spacing[6],
  },
  lessonCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 88,
    padding: spacing[4],
    ...elevation.raised,
  },
  lessonNumber: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.lg,
    height: controlSize.minimumTarget,
    justifyContent: 'center',
    width: controlSize.minimumTarget,
  },
  lessonNumberText: {
    color: text.brand,
    ...typography.caption,
  },
  lessonCopy: {
    flex: 1,
    gap: spacing[1],
  },
  lessonTitle: {
    color: text.primary,
    ...typography.cardTitle,
  },
  lessonMeta: {
    color: text.secondary,
    ...typography.caption,
  },
  chevron: {
    alignItems: 'center',
    height: controlSize.minimumTarget,
    justifyContent: 'center',
    width: controlSize.minimumTarget,
  },
  archiveCard: {
    alignItems: 'center',
    backgroundColor: surface.subtle,
    borderColor: border.active,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[1],
    minHeight: 84,
    padding: spacing[4],
  },
  archiveIcon: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderRadius: radii.full,
    height: controlSize.minimumTarget,
    justifyContent: 'center',
    width: controlSize.minimumTarget,
  },
  archiveTitle: {
    color: text.primary,
    ...typography.cardTitle,
  },
  archiveMeta: {
    color: text.secondary,
    ...typography.caption,
  },
});
