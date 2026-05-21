import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import { neutral } from '@/src/shared/theme';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularySectionList({
  expandedSectionIds,
  isRefreshing,
  onRefresh,
  onStartReview,
  onToggleSection,
  searchQuery,
  sections,
  setSearchQuery,
}: {
  expandedSectionIds: Set<string>;
  isRefreshing: boolean;
  onRefresh: () => void;
  onStartReview: (section: LessonVocabularySection) => void;
  onToggleSection: (sectionId: string) => void;
  searchQuery: string;
  sections: LessonVocabularySection[];
  setSearchQuery: (query: string) => void;
}) {
  return (
    <>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search English or Armenian"
        placeholderTextColor={neutral[400]}
        style={styles.searchInput}
      />

      <FlatList
        data={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VocabularySectionCard
            isExpanded={expandedSectionIds.has(item.id)}
            onStartReview={onStartReview}
            onToggleSection={onToggleSection}
            section={item}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No matches for this search.' : 'No saved vocabulary yet.'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? 'Try another English or Armenian search term.'
                : 'Tap translated words in lessons to build lesson sections here.'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

function VocabularySectionCard({
  isExpanded,
  onStartReview,
  onToggleSection,
  section,
}: {
  isExpanded: boolean;
  onStartReview: (section: LessonVocabularySection) => void;
  onToggleSection: (sectionId: string) => void;
  section: LessonVocabularySection;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Pressable
          onPress={() => onToggleSection(section.id)}
          style={({ pressed }) => [
            styles.sectionHeadingCopy,
            pressed && styles.sectionHeadingCopyPressed,
          ]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionChevron}>{isExpanded ? '▾' : '▸'}</Text>
          </View>
          <Text style={styles.sectionMeta}>
            {section.items.length} saved {section.items.length === 1 ? 'word' : 'words'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onStartReview(section)}
          disabled={section.items.length === 0}
          style={({ pressed }) => [
            styles.checkButton,
            pressed && section.items.length > 0 && styles.checkButtonPressed,
          ]}>
          <Text style={styles.checkButtonText}>Check</Text>
        </Pressable>
      </View>

      {isExpanded ? (
        <>
          {section.description ? (
            <Text style={styles.sectionDescription}>{section.description}</Text>
          ) : null}

          <View style={styles.sectionEntries}>
            {section.items.slice(0, 6).map((entry) => {
              const translation =
                pickArmenianTranslationText(entry.entry.translations) ??
                'No Armenian translation yet.';

              return (
                <View key={entry.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.word}>{entry.entry.englishText}</Text>
                    </View>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardRight}>
                      <Text style={styles.translationPrimary}>{translation}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {section.items.length > 6 ? (
            <Text style={styles.moreMeta}>+{section.items.length - 6} more in this lesson</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
