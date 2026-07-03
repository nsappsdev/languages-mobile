import {
  getVocabularyTapAction,
  getTokenTranslationDisplay,
  shouldRevealTokenTranslation,
} from '../token-translation-display';

describe('getTokenTranslationDisplay', () => {
  it('hides translations until the word is marked unknown', () => {
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

    expect(result).toEqual({ hasTranslation: false, text: ' ', visible: false });
  });

  it('reveals the Armenian translation after the word is marked unknown', () => {
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
      true,
    );

    expect(result).toEqual({ hasTranslation: true, text: 'բարև', visible: true });
  });

  it('shows English fallback text when the word is marked unknown but has no translation yet', () => {
    const result = getTokenTranslationDisplay([], true, 'never');

    expect(result).toEqual({ hasTranslation: false, text: 'never', visible: true });
  });
});

describe('shouldRevealTokenTranslation', () => {
  it('reveals translations for words already saved in vocabulary', () => {
    expect(shouldRevealTokenTranslation(true, false)).toBe(true);
  });

  it('reveals translations for newly marked unknown words', () => {
    expect(shouldRevealTokenTranslation(false, true)).toBe(true);
  });

  it('keeps unsaved words hidden until marked unknown', () => {
    expect(shouldRevealTokenTranslation(false, false)).toBe(false);
  });
});

describe('getVocabularyTapAction', () => {
  it('shows missing-translation feedback without saving an untranslated entry', () => {
    expect(getVocabularyTapAction(false, true, false)).toBe('show-missing-translation');
  });

  it('allows translated entries to be toggled', () => {
    expect(getVocabularyTapAction(false, true, true)).toBe('toggle');
  });

  it('shows missing-translation feedback for an already selected untranslated entry', () => {
    expect(getVocabularyTapAction(true, true, false)).toBe('show-missing-translation');
  });

  it('shows missing-translation feedback for text with no vocabulary entry', () => {
    expect(getVocabularyTapAction(false, false, false)).toBe('show-missing-translation');
  });
});
