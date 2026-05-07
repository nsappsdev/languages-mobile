import type { VocabularyTranslation } from '@/src/types/domain';

const ARMENIAN_LANGUAGE_CODES = ['am', 'hy'];

export function pickArmenianTranslation(
  translations: VocabularyTranslation[] | undefined,
): VocabularyTranslation | null {
  if (!translations || translations.length === 0) return null;

  for (const code of ARMENIAN_LANGUAGE_CODES) {
    const match = translations.find((t) => t.languageCode.toLowerCase() === code);
    if (match) return match;
  }

  return translations[0] ?? null;
}

export function pickArmenianTranslationText(
  translations: VocabularyTranslation[] | undefined,
): string | null {
  return pickArmenianTranslation(translations)?.translation ?? null;
}
