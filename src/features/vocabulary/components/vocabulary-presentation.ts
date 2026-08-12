import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import type { VocabularyLessonSummary } from '@/src/types/domain';

export function filterVocabularyLessonSummaries(
  summaries: VocabularyLessonSummary[],
  search: string,
) {
  const query = normalizeSearch(search);
  return summaries.filter(
    (summary) =>
      summary.activeCount > 0 &&
      (!query || summary.title.toLocaleLowerCase().includes(query)),
  );
}

export function filterLearnedVocabularySections(
  sections: LessonVocabularySection[],
  search: string,
) {
  const query = normalizeSearch(search);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((row) => {
        const translation = pickArmenianTranslationText(row.entry.translations) ?? '';
        return (
          !query ||
          row.entry.englishText.toLocaleLowerCase().includes(query) ||
          translation.toLocaleLowerCase().includes(query)
        );
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function buildHiddenTranslation(translation: string) {
  const length = Math.max(6, Math.min(14, translation.length || 8));
  return '●'.repeat(length);
}

function normalizeSearch(search: string) {
  return search.trim().toLocaleLowerCase();
}
