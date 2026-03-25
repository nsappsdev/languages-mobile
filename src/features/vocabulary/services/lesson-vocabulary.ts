import type { LearnerVocabularyItem, Lesson } from '@/src/types/domain';
import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';

export type LessonVocabularySection = {
  id: string;
  lessonId: string | null;
  title: string;
  description: string | null;
  items: LearnerVocabularyItem[];
};

export function buildLessonVocabularySections(
  lessons: Lesson[],
  vocabulary: LearnerVocabularyItem[],
  searchQuery = '',
): LessonVocabularySection[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const remaining = new Map(vocabulary.map((item) => [item.id, item]));
  const sections: LessonVocabularySection[] = [];

  for (const lesson of lessons) {
    const lessonWords = collectLessonWords(lesson);
    const sectionItems: LearnerVocabularyItem[] = [];

    for (const item of vocabulary) {
      if (!remaining.has(item.id)) {
        continue;
      }

      const normalizedEntry = normalizeVocabularySelection(item.entry.englishText);
      if (!normalizedEntry || !lessonWords.has(normalizedEntry)) {
        continue;
      }

      if (normalizedQuery && !matchesVocabularySearch(item, normalizedQuery)) {
        continue;
      }

      sectionItems.push(item);
      remaining.delete(item.id);
    }

    if (sectionItems.length > 0) {
      sections.push({
        id: lesson.id,
        lessonId: lesson.id,
        title: lesson.title,
        description: lesson.description ?? null,
        items: sectionItems,
      });
    }
  }

  const remainingItems = Array.from(remaining.values()).filter((item) =>
    normalizedQuery ? matchesVocabularySearch(item, normalizedQuery) : true,
  );

  if (remainingItems.length > 0) {
    sections.push({
      id: 'other',
      lessonId: null,
      title: 'Other Saved Words',
      description: 'Saved vocabulary not mapped to a seeded lesson yet.',
      items: remainingItems,
    });
  }

  return sections;
}

function collectLessonWords(lesson: Lesson) {
  const words = new Set<string>();

  for (const item of lesson.items) {
    for (const rawToken of item.text.split(/\s+/)) {
      const normalized = normalizeVocabularySelection(rawToken);
      if (normalized) {
        words.add(normalized);
      }
    }
  }

  return words;
}

function matchesVocabularySearch(item: LearnerVocabularyItem, normalizedQuery: string) {
  const english = item.entry.englishText.toLowerCase();
  const armenian = item.entry.translations
    .filter((translation) => translation.languageCode === 'am')
    .map((translation) => translation.translation.toLowerCase());

  return english.includes(normalizedQuery) || armenian.some((value) => value.includes(normalizedQuery));
}
