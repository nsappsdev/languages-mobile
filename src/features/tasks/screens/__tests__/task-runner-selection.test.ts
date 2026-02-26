import {
  extractSelectionText,
  shouldShowAddToVocabularyButton,
} from '@/src/features/tasks/screens/task-runner-screen';

describe('task runner prompt selection helpers', () => {
  it('extracts selected text and normalizes whitespace', () => {
    const source = 'Hello   world\nfrom task runner';

    const selected = extractSelectionText(source, 0, 18);

    expect(selected).toBe('Hello world from');
  });

  it('returns empty string when selection range is invalid', () => {
    expect(extractSelectionText('hello', 3, 3)).toBe('');
    expect(extractSelectionText('hello', 4, 2)).toBe('');
  });

  it('shows Add to Vocabulary button only for non-empty trimmed selection', () => {
    expect(shouldShowAddToVocabularyButton('')).toBe(false);
    expect(shouldShowAddToVocabularyButton('   ')).toBe(false);
    expect(shouldShowAddToVocabularyButton('word')).toBe(true);
  });
});
