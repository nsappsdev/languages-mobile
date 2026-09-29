type TranslationFitInput = {
  availableWidth: number;
  maxFontSize: number;
  maxLetterSpacing: number;
  minFontSize: number;
  minLetterSpacing: number;
  text: string;
};

const APPROX_ARMENIAN_CHAR_WIDTH = 0.9;
const WIDTH_SAFETY_PX = 8;

export function fitTranslationLabel({
  availableWidth,
  maxFontSize,
  maxLetterSpacing,
  minFontSize,
  minLetterSpacing,
  text,
}: TranslationFitInput) {
  const normalizedText = text.trim();
  if (!normalizedText || availableWidth <= 0) {
    return { containerWidth: Math.max(1, availableWidth), fontSize: maxFontSize, letterSpacing: maxLetterSpacing };
  }

  const textLength = normalizedText.length;
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    if (estimateTextWidth(textLength, fontSize, minLetterSpacing) <= availableWidth) {
      const letterSpacing = Math.min(maxLetterSpacing, Math.max(minLetterSpacing,
        (availableWidth - textLength * fontSize * APPROX_ARMENIAN_CHAR_WIDTH) / Math.max(1, textLength - 1)));
      return {
        containerWidth: Math.ceil(Math.max(availableWidth, estimateTextWidth(textLength, fontSize, letterSpacing))),
        fontSize,
        letterSpacing: Number(letterSpacing.toFixed(2)),
      };
    }
  }

  return {
    containerWidth: Math.ceil(estimateTextWidth(textLength, minFontSize, minLetterSpacing) + WIDTH_SAFETY_PX),
    fontSize: minFontSize,
    letterSpacing: minLetterSpacing,
  };
}

function estimateTextWidth(textLength: number, fontSize: number, letterSpacing: number) {
  return textLength * fontSize * APPROX_ARMENIAN_CHAR_WIDTH + Math.max(0, textLength - 1) * letterSpacing;
}
