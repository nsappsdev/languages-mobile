import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type {
  LessonVocabularyRow,
  LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  border,
  controlSize,
  fontWeight,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import {
  VocabularyBackButton,
  VocabularyEmptyState,
  VocabularySearchField,
  VocabularySyncNotice,
  vocabularySharedStyles,
} from './vocabulary-shared';
import { filterLearnedVocabularySections } from './vocabulary-presentation';

export function LearnedVocabularyArchive({
  onBack,
  onRestore,
  sections,
  syncMeta,
}: {
  onBack: () => void;
  onRestore: (section: LessonVocabularySection, row: LessonVocabularyRow) => void;
  sections: LessonVocabularySection[];
  syncMeta?: string | null;
}) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredSections = useMemo(
    () => filterLearnedVocabularySections(sections, search),
    [search, sections],
  );
  const learnedCount = sections.reduce((total, section) => total + section.items.length, 0);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}>
      <View style={styles.header}>
        <VocabularyBackButton label="Back to vocabulary lessons" onPress={onBack} />
        <Text style={vocabularySharedStyles.eyebrow}>Your archive</Text>
        <Text style={vocabularySharedStyles.screenTitle}>Learned words</Text>
        <Text style={vocabularySharedStyles.body}>
          {learnedCount === 0
            ? 'Words you master will collect here.'
            : `${learnedCount} ${learnedCount === 1 ? 'word is' : 'words are'} safely stored here.`}
        </Text>
        {syncMeta ? <VocabularySyncNotice message={syncMeta} /> : null}
      </View>

      <VocabularySearchField
        accessibilityLabel="Search learned vocabulary"
        onChangeText={setSearch}
        placeholder="Search English or Armenian"
        value={search}
      />

      <View style={styles.archiveList}>
        {filteredSections.length === 0 ? (
          <VocabularyEmptyState
            icon={normalizedSearch ? 'search-outline' : 'checkmark-circle-outline'}
            title={normalizedSearch ? 'No learned words match' : 'No learned words yet'}
            text={
              normalizedSearch
                ? 'Try another English or Armenian search.'
                : 'Keep reviewing—learned words will appear here.'
            }
          />
        ) : (
          filteredSections.map((section) => (
            <ArchiveSection
              key={section.lessonId}
              onRestore={(row) => onRestore(section, row)}
              section={section}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function ArchiveSection({
  onRestore,
  section,
}: {
  onRestore: (row: LessonVocabularyRow) => void;
  section: LessonVocabularySection;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{section.items.length}</Text>
        </View>
      </View>
      {section.items.map((row) => {
        const translation = pickArmenianTranslationText(row.entry.translations) ?? '';
        return (
          <View key={row.entryId} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text selectable style={styles.english}>
                {row.entry.englishText}
              </Text>
              <Text selectable style={styles.translation}>
                {translation}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Restore ${row.entry.englishText} to review`}
              accessibilityHint="Moves this learned word back to its lesson review"
              accessibilityRole="button"
              onPress={() => onRestore(row)}
              style={({ pressed }) => [
                styles.restoreButton,
                pressed && vocabularySharedStyles.pressed,
              ]}>
              <Text style={styles.restoreButtonText}>Review again</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing[4],
    paddingBottom: spacing[6],
  },
  header: {
    gap: spacing[2],
  },
  archiveList: {
    gap: spacing[4],
  },
  section: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing[4],
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
  },
  sectionTitle: {
    color: text.primary,
    flex: 1,
    ...typography.cardTitle,
  },
  countPill: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    minWidth: controlSize.minimumTarget,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  countText: {
    color: text.brand,
    ...typography.caption,
  },
  row: {
    alignItems: 'center',
    borderTopColor: border.default,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 88,
    paddingVertical: spacing[3],
  },
  rowCopy: {
    flex: 1,
    gap: spacing[1],
  },
  english: {
    color: text.primary,
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
  },
  translation: {
    color: text.brand,
    ...typography.body,
  },
  restoreButton: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderColor: border.active,
    borderRadius: radii.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: controlSize.minimumTarget,
    paddingHorizontal: spacing[3],
  },
  restoreButtonText: {
    color: text.brand,
    ...typography.caption,
  },
});
