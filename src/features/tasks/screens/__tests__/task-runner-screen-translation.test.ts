import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
} from '@/src/features/tasks/services/token-translation-display';

describe('task runner translation display', () => {
  it('keeps cached translations hidden until the word is marked unknown', () => {
    const result = getTokenTranslationDisplay(
      [
        {
          id: 'tr-1',
          entryId: 'entry-1',
          languageCode: 'hy',
          translation: 'բարև',
          usageExample: null,
        },
      ],
      false,
    );

    expect(result.visible).toBe(false);
    expect(result.text).toBe(' ');
  });
});

describe('task runner tap behavior', () => {
  it('ignores words with no Armenian translation and no vocabulary entry', () => {
    expect(shouldAllowVocabularyToggle(false, false)).toBe(false);
  });

  it('still allows previously saved vocabulary words to toggle even without a fresh translation lookup', () => {
    expect(shouldAllowVocabularyToggle(true, false)).toBe(true);
  });
});
