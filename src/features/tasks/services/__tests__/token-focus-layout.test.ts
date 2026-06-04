import {
  getCenteredTranslationOffset,
  getFocusedTokenLayout,
} from '../token-focus-layout';

describe('token focus layout', () => {
  it('places a phrase translation over the selected focus token', () => {
    const layout = getFocusedTokenLayout({
      firstTokenIndex: 0,
      focusTokenIndex: 2,
      fontSize: 30,
      horizontalPadding: 3,
      measuredPhraseWidth: 205,
      tokenWidths: {},
      tokens: [
        { key: '0:never', text: 'never' },
        { key: '5: ', text: ' ' },
        { key: '6:deprived', text: 'deprived' },
      ],
    });

    expect(layout.focusOffset).toBeGreaterThan(75);
    expect(layout.focusWidth).toBeGreaterThan(95);

    const translationWidth = 48;
    const offset = getCenteredTranslationOffset({
      ...layout,
      translationWidth,
    });

    expect(offset).toBe(layout.focusOffset + layout.focusWidth / 2 - translationWidth / 2);
  });

  it('centers a wide translation over the focus token', () => {
    expect(
      getCenteredTranslationOffset({
        focusOffset: 140,
        focusWidth: 40,
        translationWidth: 120,
      }),
    ).toBe(100);
  });

  it('does not return a negative margin offset for labels wider than the token', () => {
    expect(
      getCenteredTranslationOffset({
        focusOffset: 0,
        focusWidth: 72,
        translationWidth: 88,
      }),
    ).toBe(0);
  });
});
