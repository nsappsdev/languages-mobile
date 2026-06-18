import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type {
  LessonVocabularyRow,
  LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyLessonSummary, VocabularyReviewDecision } from '@/src/types/domain';
import { brand, neutral } from '@/src/shared/theme';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularyLessonDashboard({
  isRefreshing,
  onOpenArchive,
  onOpenLesson,
  onRefresh,
  summaries,
}: {
  isRefreshing: boolean;
  onOpenArchive: () => void;
  onOpenLesson: (lessonId: string) => void;
  onRefresh: () => void;
  summaries: VocabularyLessonSummary[];
}) {
  const [search, setSearch] = useState('');
  const filtered = summaries.filter(
    (summary) =>
      summary.activeCount > 0 &&
      summary.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const learnedCount = summaries.reduce((total, summary) => total + summary.learnedCount, 0);

  return (
    <>
      <TextInput
        accessibilityLabel="Search vocabulary lessons"
        onChangeText={setSearch}
        placeholder="Search lessons"
        placeholderTextColor={neutral[400]}
        style={styles.searchInput}
        value={search}
      />
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => item.lessonId}
        ListEmptyComponent={
          <EmptyCard
            title={search.trim() ? 'No matching lessons.' : 'No unknown words yet.'}
            text={
              search.trim()
                ? 'Try another lesson title.'
                : 'Tap translated words in a lesson to save them for review.'
            }
          />
        }
        ListFooterComponent={
          learnedCount > 0 ? (
            <Pressable
              accessibilityLabel={`Open learned vocabulary, ${learnedCount} words`}
              accessibilityRole="button"
              onPress={onOpenArchive}
              style={({ pressed }) => [
                styles.archiveButton,
                pressed && styles.buttonPressed,
              ]}>
              <View>
                <Text style={styles.archiveButtonTitle}>Learned words</Text>
                <Text style={styles.archiveButtonMeta}>{learnedCount} in your archive</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={brand[700]} />
            </Pressable>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open ${item.title}, ${item.activeCount} words to review`}
            accessibilityRole="button"
            onPress={() => onOpenLesson(item.lessonId)}
            style={({ pressed }) => [
              styles.lessonCard,
              pressed && styles.buttonPressed,
            ]}>
            <View style={styles.lessonCardCopy}>
              <Text style={styles.lessonTitle}>{item.title}</Text>
              <Text style={styles.lessonMeta}>
                {item.activeCount} {item.activeCount === 1 ? 'word' : 'words'} to review
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={neutral[400]} />
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

export function VocabularyLessonReview({
  onBack,
  onPlayContext,
  onPlayWord,
  onReview,
  section,
}: {
  onBack: () => void;
  onPlayContext: (row: LessonVocabularyRow) => void;
  onPlayWord: (row: LessonVocabularyRow) => void;
  onReview: (row: LessonVocabularyRow, decision: VocabularyReviewDecision) => void;
  section: LessonVocabularySection;
}) {
  const [revealedEntryId, setRevealedEntryId] = useState<string | null>(null);
  const activeRows = section.items.filter((item) => item.status === 'LEARNING');
  const learnedRows = section.items.filter((item) => item.status === 'LEARNED');

  return (
    <View style={styles.viewRoot}>
      <View style={styles.viewHeader}>
        <BackButton onPress={onBack} label="Back to vocabulary lessons" />
        <Text style={styles.lessonViewTitle}>{section.title}</Text>
        <Text style={styles.meta}>
          Tap the masked Armenian translation, then choose Again or Know.
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  activeRows.length + learnedRows.length === 0
                    ? 100
                    : (learnedRows.length / (activeRows.length + learnedRows.length)) * 100
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {activeRows.length} remaining · {learnedRows.length} learned
        </Text>
      </View>

      {activeRows.length === 0 ? (
        <View style={styles.completionCard}>
          <Ionicons name="checkmark-circle" size={44} color={brand[700]} />
          <Text style={styles.completionTitle}>Lesson vocabulary complete</Text>
          <Text style={styles.emptyText}>Every saved word from this lesson is learned.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.primaryActionText}>Back to lessons</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.reviewList}>
          {activeRows.map((row) => {
            const revealed = revealedEntryId === row.entryId;
            return (
              <VocabularyReviewRow
                key={row.entryId}
                onPlayContext={() => onPlayContext(row)}
                onPlayWord={() => onPlayWord(row)}
                onReveal={() => setRevealedEntryId(row.entryId)}
                onReview={(decision) => {
                  setRevealedEntryId(null);
                  onReview(row, decision);
                }}
                revealed={revealed}
                row={row}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export function VocabularyLearnedArchive({
  onBack,
  onRestore,
  sections,
}: {
  onBack: () => void;
  onRestore: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  sections: LessonVocabularySection[];
}) {
  const [search, setSearch] = useState('');
  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((row) => {
          const translation = pickArmenianTranslationText(row.entry.translations) ?? '';
          return (
            !query ||
            row.entry.englishText.toLowerCase().includes(query) ||
            translation.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [search, sections]);

  return (
    <View style={styles.viewRoot}>
      <View style={styles.viewHeader}>
        <BackButton onPress={onBack} label="Back to vocabulary lessons" />
        <Text style={styles.lessonViewTitle}>Learned words</Text>
        <Text style={styles.meta}>Search completed vocabulary or return a word to review.</Text>
      </View>
      <TextInput
        accessibilityLabel="Search learned vocabulary"
        onChangeText={setSearch}
        placeholder="Search English or Armenian"
        placeholderTextColor={neutral[400]}
        style={styles.searchInput}
        value={search}
      />
      <ScrollView contentContainerStyle={styles.archiveList}>
        {filteredSections.length === 0 ? (
          <EmptyCard
            title={search.trim() ? 'No learned words match.' : 'No learned words yet.'}
            text={search.trim() ? 'Try another search term.' : 'Learned words will appear here.'}
          />
        ) : (
          filteredSections.map((section) => (
            <View key={section.lessonId} style={styles.archiveSection}>
              <Text style={styles.archiveSectionTitle}>{section.title}</Text>
              {section.items.map((row) => (
                <View key={row.entryId} style={styles.archiveRow}>
                  <View style={styles.archiveRowCopy}>
                    <Text style={styles.dictionaryEnglish}>{row.entry.englishText}</Text>
                    <Text style={styles.archiveTranslation}>
                      {pickArmenianTranslationText(row.entry.translations)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Restore ${row.entry.englishText} to review`}
                    accessibilityRole="button"
                    onPress={() => onRestore(section, row)}
                    style={({ pressed }) => [
                      styles.restoreButton,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text style={styles.restoreButtonText}>Review again</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function VocabularyReviewRow({
  onPlayContext,
  onPlayWord,
  onReveal,
  onReview,
  revealed,
  row,
}: {
  onPlayContext: () => void;
  onPlayWord: () => void;
  onReveal: () => void;
  onReview: (decision: VocabularyReviewDecision) => void;
  revealed: boolean;
  row: LessonVocabularyRow;
}) {
  const translation = pickArmenianTranslationText(row.entry.translations) ?? '';

  return (
    <View style={[styles.reviewRow, revealed && styles.reviewRowRevealed]}>
      <View style={styles.dictionaryTextRow}>
        <View style={styles.reviewColumn}>
          <Text style={styles.columnLabel}>English</Text>
          <Text style={styles.dictionaryEnglish}>{row.entry.englishText}</Text>
        </View>
        <View style={styles.dictionaryDivider} />
        <Pressable
          accessibilityLabel={
            revealed
              ? `Armenian translation: ${translation}`
              : `Reveal Armenian translation for ${row.entry.englishText}`
          }
          accessibilityRole="button"
          onPress={onReveal}
          style={({ pressed }) => [
            styles.reviewColumn,
            styles.translationReveal,
            pressed && styles.buttonPressed,
          ]}>
          <Text style={styles.columnLabel}>Armenian</Text>
          {revealed ? (
            <Text style={styles.dictionaryTranslation}>{translation}</Text>
          ) : (
            <Text accessibilityElementsHidden style={styles.dictionaryTranslationHidden}>
              {buildHiddenTranslation(translation)}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.rowFooter}>
        <View style={styles.audioActions}>
          <IconAction
            icon="volume-high-outline"
            label={`Play ${row.entry.englishText}`}
            onPress={onPlayWord}
          />
          <IconAction
            icon="chatbox-ellipses-outline"
            label={`Play context for ${row.entry.englishText}`}
            onPress={onPlayContext}
          />
        </View>
        <Text style={styles.streakText}>{row.correctStreak} / 2 correct</Text>
      </View>

      {revealed ? (
        <View style={styles.decisionRow}>
          <Pressable
            accessibilityLabel={`Mark ${row.entry.englishText} for more practice`}
            accessibilityRole="button"
            onPress={() => onReview('AGAIN')}
            style={({ pressed }) => [
              styles.againButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.againButtonText}>Again</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Mark ${row.entry.englishText} as known`}
            accessibilityRole="button"
            onPress={() => onReview('KNOW')}
            style={({ pressed }) => [
              styles.knowButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.knowButtonText}>
              {row.correctStreak === 1 ? 'Know · finish' : 'Know'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: 'volume-high-outline' | 'chatbox-ellipses-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, pressed && styles.buttonPressed]}>
      <Ionicons name={icon} size={18} color={brand[700]} />
    </Pressable>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
      <Ionicons name="chevron-back" size={18} color={brand[700]} />
      <Text style={styles.backButtonText}>Vocabulary</Text>
    </Pressable>
  );
}

function EmptyCard({ text, title }: { text: string; title: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function buildHiddenTranslation(translation: string) {
  const length = Math.max(6, Math.min(14, translation.length || 8));
  return '●'.repeat(length);
}
