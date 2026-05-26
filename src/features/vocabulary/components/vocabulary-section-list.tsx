import { useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  LessonVocabularyRow,
  LessonVocabularySection,
  VocabularyReviewDecision,
  VocabularyReviewStage,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import { shouldRevealVocabularyTranslation } from '@/src/features/vocabulary/services/lesson-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import { neutral } from '@/src/shared/theme';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

const DOUBLE_TAP_DELAY_MS = 260;

export function VocabularySectionList({
  expandedSectionIds,
  isRefreshing,
  onPlayContext,
  onPlayWord,
  onRefresh,
  onReviewDecision,
  onToggleSection,
  searchQuery,
  sections,
  setSearchQuery,
}: {
  expandedSectionIds: Set<string>;
  isRefreshing: boolean;
  onPlayContext: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  onPlayWord: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  onRefresh: () => void;
  onReviewDecision: (
    section: LessonVocabularySection,
    row: LessonVocabularyRow,
    decision: VocabularyReviewDecision,
  ) => void;
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
            onPlayContext={onPlayContext}
            onPlayWord={onPlayWord}
            onReviewDecision={onReviewDecision}
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
                : 'Tap unknown translated words in lessons to save them here.'}
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
  onPlayContext,
  onPlayWord,
  onReviewDecision,
  onToggleSection,
  section,
}: {
  isExpanded: boolean;
  onPlayContext: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  onPlayWord: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  onReviewDecision: (
    section: LessonVocabularySection,
    row: LessonVocabularyRow,
    decision: VocabularyReviewDecision,
  ) => void;
  onToggleSection: (sectionId: string) => void;
  section: LessonVocabularySection;
}) {
  return (
    <View style={styles.sectionCard}>
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

      {isExpanded ? (
        <>
          {section.description ? (
            <Text style={styles.sectionDescription}>{section.description}</Text>
          ) : null}

          <View style={styles.sectionEntries}>
            {section.items.map((row) => (
              <VocabularyDictionaryRow
                key={row.entryId}
                onPlayContext={() => onPlayContext(section, row)}
                onPlayWord={() => onPlayWord(section, row)}
                onReviewDecision={(decision) => onReviewDecision(section, row, decision)}
                row={row}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function VocabularyDictionaryRow({
  onPlayContext,
  onPlayWord,
  onReviewDecision,
  row,
}: {
  onPlayContext: () => void;
  onPlayWord: () => void;
  onReviewDecision: (decision: VocabularyReviewDecision) => void;
  row: LessonVocabularyRow;
}) {
  const revealProgress = useRef(new Animated.Value(0)).current;
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const translation = pickArmenianTranslationText(row.entry.translations) ?? '';
  const shouldReveal = shouldRevealVocabularyTranslation(row.localStage);

  useEffect(() => {
    if (shouldReveal) {
      Animated.timing(revealProgress, {
        duration: 1500,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      revealProgress.setValue(0);
    }
  }, [revealProgress, shouldReveal]);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    },
    [],
  );

  const handlePress = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    onPlayWord();
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
      onReviewDecision('learned');
      return;
    }

    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      onReviewDecision('not_learned');
    }, DOUBLE_TAP_DELAY_MS);
  };

  const handleLongPress = () => {
    didLongPressRef.current = true;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    onPlayContext();
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.dictionaryRow,
        getStageStyle(row.localStage),
        pressed && styles.dictionaryRowPressed,
      ]}>
      <View style={styles.dictionaryTextRow}>
        <Text style={[styles.dictionaryEnglish, getStageTextStyle(row.localStage)]}>
          {row.entry.englishText}
        </Text>
        <View style={styles.dictionaryDivider} />
        <View style={styles.dictionaryTranslationWrap}>
          {!shouldReveal ? (
            <Text style={[styles.dictionaryTranslationHidden, getHiddenStageTextStyle(row.localStage)]}>
              {buildHiddenTranslation(translation)}
            </Text>
          ) : null}
          <Animated.Text
            style={[
              styles.dictionaryTranslation,
              getTranslationStageTextStyle(row.localStage),
              shouldReveal ? { opacity: revealProgress } : styles.dictionaryTranslationInvisible,
            ]}>
            {translation}
          </Animated.Text>
        </View>
      </View>
    </Pressable>
  );
}

function buildHiddenTranslation(translation: string) {
  const length = Math.max(6, Math.min(16, translation.length || 8));
  return '█'.repeat(length);
}

function getStageStyle(stage?: VocabularyReviewStage) {
  switch (stage) {
    case 'first_missed':
      return styles.dictionaryRowFirstMissed;
    case 'first_learned':
      return styles.dictionaryRowFirstLearned;
    case 'final_missed':
      return styles.dictionaryRowFinalMissed;
    case 'final_learned':
      return styles.dictionaryRowFinalLearned;
    default:
      return null;
  }
}

function getStageTextStyle(stage?: VocabularyReviewStage) {
  return stage === 'final_missed' || stage === 'final_learned'
    ? styles.dictionaryTextOnDark
    : null;
}

function getTranslationStageTextStyle(stage?: VocabularyReviewStage) {
  return stage === 'final_learned' ? styles.dictionaryTextOnDark : null;
}

function getHiddenStageTextStyle(stage?: VocabularyReviewStage) {
  return stage === 'final_missed' ? styles.dictionaryHiddenTextOnDark : null;
}
