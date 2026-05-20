import { fitTranslationLabel } from '../translation-fitting';

const settings = {
  maxFontSize: 15,
  minFontSize: 8,
  maxLetterSpacing: 0.8,
  minLetterSpacing: -0.2,
};

describe('fitTranslationLabel', () => {
  it('uses the configured maximum size when the translation fits', () => {
    expect(
      fitTranslationLabel({
        ...settings,
        availableWidth: 80,
        text: 'բարև',
      }),
    ).toEqual({ containerWidth: 80, fontSize: 15, letterSpacing: 0.8 });
  });

  it('shrinks within the configured min and max size bounds for narrow words', () => {
    const fit = fitTranslationLabel({
      ...settings,
      availableWidth: 28,
      text: 'երկար',
    });

    expect(fit.fontSize).toBeGreaterThanOrEqual(settings.minFontSize);
    expect(fit.fontSize).toBeLessThan(settings.maxFontSize);
    expect(fit.letterSpacing).toBeGreaterThanOrEqual(settings.minLetterSpacing);
  });

  it('falls back to configured minimums when the label cannot fully fit', () => {
    const fit = fitTranslationLabel({
      ...settings,
      availableWidth: 8,
      text: 'անհնարերկար',
    });

    expect(fit.fontSize).toBe(8);
    expect(fit.letterSpacing).toBe(-0.2);
    expect(fit.containerWidth).toBeGreaterThan(8);
  });
});
