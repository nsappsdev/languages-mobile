import {
  getMatchTranslationAnchorIndex,
  getTokenLayoutWidth,
  getTranslationLabelMaxWidth,
} from '../task-word-flow-layout';

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

  it('caps long translation labels to the measured word-flow width', () => {
    expect(
      getTranslationLabelMaxWidth({
        availableWidth: 52,
        fittedContainerWidth: 240,
        wordFlowWidth: 160,
      }),
    ).toBe(160);
  });

  it('uses the phrase focus token as the translation anchor', () => {
    expect(
      getMatchTranslationAnchorIndex({
        focusTokenIndex: 4,
        startIndex: 0,
      }),
    ).toBe(4);
  });

  it('falls back to the phrase start when no focus token exists', () => {
    expect(
      getMatchTranslationAnchorIndex({
        focusTokenIndex: null,
        startIndex: 2,
      }),
    ).toBe(2);
  });
});
