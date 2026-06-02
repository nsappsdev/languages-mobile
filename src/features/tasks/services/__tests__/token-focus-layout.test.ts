import {
  getFocusedTokenLayout,
  getStartAlignedTranslationOffset,
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

    const offset = getStartAlignedTranslationOffset(layout);

    expect(offset).toBe(layout.focusOffset);
  });

  it('starts a wide translation at the focus token instead of centering it', () => {
    expect(
      getStartAlignedTranslationOffset({
        focusOffset: 140,
      }),
    ).toBe(140);
  });
});
