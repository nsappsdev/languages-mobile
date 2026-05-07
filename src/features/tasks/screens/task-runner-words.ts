import { normalizeVocabularySelection } from '@/src/features/vocabulary/services/add-word-to-vocabulary';

export type LessonWordToken = {
  end: number;
  key: string;
  normalized: string | null;
  start: number;
  text: string;
};

const TOKEN_REGEX = /\s+|[A-Za-z0-9]+(?:[’'][A-Za-z0-9]+)?|[^\sA-Za-z0-9]+/g;

export function tokenizeLessonText(text: string): LessonWordToken[] {
  const tokens: LessonWordToken[] = [];
  for (const match of text.matchAll(TOKEN_REGEX)) {
    const token = match[0];
    const start = match.index ?? 0;
    tokens.push({
      end: start + token.length,
      key: `${start}:${token}`,
      normalized: normalizeVocabularySelection(token),
      start,
      text: token,
    });
  }
  return tokens;
}
