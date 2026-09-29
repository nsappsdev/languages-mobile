import { fitTranslationLabel } from '../translation-fit';

describe('translation typography fitting', () => {
  const settings = { maxFontSize: 15, minFontSize: 8, maxLetterSpacing: 0.8, minLetterSpacing: -0.2 };

  it('uses configured maximum typography when the label fits', () => {
    expect(fitTranslationLabel({ ...settings, availableWidth: 120, text: 'հաց' })).toEqual({
      containerWidth: 120,
      fontSize: 15,
      letterSpacing: 0.8,
    });
  });

  it('shrinks within the configured limits and expands its overlay when necessary', () => {
    const fitted = fitTranslationLabel({ ...settings, availableWidth: 45, text: 'պատուհան' });
    expect(fitted.fontSize).toBe(8);
    expect(fitted.letterSpacing).toBe(-0.2);
    expect(fitted.containerWidth).toBeGreaterThan(45);
  });
});
