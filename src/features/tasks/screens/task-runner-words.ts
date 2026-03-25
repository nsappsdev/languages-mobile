import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';

export type LessonWordToken = {
  key: string;
  normalized: string | null;
  text: string;
};

const TOKEN_SPLIT_REGEX = /(\s+)/;

export function tokenizeLessonText(text: string): LessonWordToken[] {
  return text.split(TOKEN_SPLIT_REGEX).map((token, index) => ({
    key: `${index}:${token}`,
    normalized: normalizeVocabularySelection(token),
    text: token,
  }));
}
