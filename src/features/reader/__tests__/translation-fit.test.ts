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
  it('fits using measured font glyph widths instead of character-count guesses',()=>{
    const fitted=fitTranslationLabel({...settings,availableWidth:100,text:'պատուհան',measuredWidth:60});
    expect(fitted.fontSize).toBe(15);
    const wider=fitTranslationLabel({...settings,availableWidth:100,text:'պատուհան',measuredWidth:140});
    expect(wider.fontSize).toBeLessThan(fitted.fontSize);
    expect(wider.containerWidth).toBeLessThanOrEqual(100);
  });

  it('allows for enlarged system text before font measurements arrive', () => {
    const normal = fitTranslationLabel({ ...settings, availableWidth: 45, text: 'պատուհան' });
    const large = fitTranslationLabel({ ...settings, availableWidth: 45, text: 'պատուհան', fontScale: 2 });
    expect(large.containerWidth).toBeGreaterThan(normal.containerWidth);
  });

  it.each([
    { text: 'անընդհատ', availableWidth: 62, measuredWidth: 87.859375 },
    { text: 'մարդաշատ', availableWidth: 70, measuredWidth: 91.765625 },
    { text: 'անձրևանոց', availableWidth: 70, measuredWidth: 94.296875 },
  ])('keeps space for the final glyph of $text', input => {
    const fitted = fitTranslationLabel({ ...settings, ...input });
    const renderedWidth = input.measuredWidth * fitted.fontSize / settings.maxFontSize
      + Array.from(input.text).length * fitted.letterSpacing;
    expect(fitted.containerWidth - renderedWidth).toBeGreaterThanOrEqual(8);
  });

  it('fits a translation wider than a phone onto one complete line', () => {
    const fitted = fitTranslationLabel({ ...settings, text: 'երկրորդ կատու', availableWidth: 24,
      measuredWidth: 1200, maxContainerWidth: 280 });
    const renderedWidth = 1200 * fitted.fontSize / settings.maxFontSize
      + Array.from('երկրորդ կատու').length * fitted.letterSpacing;
    expect(fitted.containerWidth).toBeLessThanOrEqual(280);
    expect(renderedWidth + 8).toBeLessThanOrEqual(fitted.containerWidth);
    expect(fitted.fontSize).toBeLessThan(settings.minFontSize);
  });
});
