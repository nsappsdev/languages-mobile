import { getTokenLayoutWidth } from '../task-word-flow-layout';

describe('task word flow layout', () => {
  it('does not let a long translation label expand the English token layout box', () => {
    const englishPhraseWidth = 72;
    const longTranslationWidth = 180;

    expect(
      getTokenLayoutWidth({
        fallbackTokenWidth: 44,
        measuredTokenWidth: englishPhraseWidth,
        phraseWidth: englishPhraseWidth,
      }),
    ).toBe(englishPhraseWidth);

    expect(longTranslationWidth).toBeGreaterThan(englishPhraseWidth);
  });

  it('falls back to the estimated English token width before measurement', () => {
    expect(
      getTokenLayoutWidth({
        fallbackTokenWidth: 48,
        measuredTokenWidth: 0,
        phraseWidth: 0,
      }),
    ).toBe(48);
  });
});
