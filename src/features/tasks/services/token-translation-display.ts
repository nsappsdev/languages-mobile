import type { VocabularyTranslation } from '@/src/types/domain';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';

export interface TokenTranslationDisplay {
  hasTranslation: boolean;
  text: string;
  visible: boolean;
}

export type VocabularyTapAction = 'ignore' | 'show-missing-translation' | 'toggle';

export function shouldRevealTokenTranslation(
  hasVocabularyEntry: boolean,
  isMarkedUnknown: boolean,
): boolean {
  return hasVocabularyEntry || isMarkedUnknown;
}

export function getVocabularyTapAction(
  isSelected: boolean,
  hasVocabularyEntry: boolean,
  hasArmenianTranslation: boolean,
): VocabularyTapAction {
  if (isSelected || hasArmenianTranslation) return 'toggle';
  return hasVocabularyEntry ? 'show-missing-translation' : 'ignore';
}

export function getTokenTranslationDisplay(
  translations: VocabularyTranslation[] | undefined,
  revealTranslation: boolean,
  fallbackText = '—',
): TokenTranslationDisplay {
  if (!revealTranslation) {
    return { hasTranslation: false, text: ' ', visible: false };
  }

  const translation = pickArmenianTranslationText(translations);
  return {
    hasTranslation: Boolean(translation),
    text: translation ?? fallbackText,
    visible: true,
  };
}
