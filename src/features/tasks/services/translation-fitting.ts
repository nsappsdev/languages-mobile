type TranslationFitSettings = {
  maxFontSize: number;
  minFontSize: number;
  maxLetterSpacing: number;
  minLetterSpacing: number;
};

type TranslationFitInput = TranslationFitSettings & {
  availableWidth: number;
  text: string;
};

const APPROX_ARMENIAN_CHAR_WIDTH = 0.9;
const TRANSLATION_WIDTH_SAFETY_PX = 8;

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
    return {
      containerWidth: undefined,
      fontSize: maxFontSize,
      letterSpacing: maxLetterSpacing,
    };
  }

  const textLength = normalizedText.length;
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const maxWidthAtMinSpacing = estimateTextWidth(textLength, fontSize, minLetterSpacing);
    if (maxWidthAtMinSpacing <= availableWidth) {
      const spacing = Math.min(
        maxLetterSpacing,
        Math.max(
          minLetterSpacing,
          (availableWidth - textLength * fontSize * APPROX_ARMENIAN_CHAR_WIDTH) /
            Math.max(1, textLength - 1),
        ),
      );

      return {
        containerWidth: Math.ceil(
          Math.max(availableWidth, estimateTextWidth(textLength, fontSize, spacing)),
        ),
        fontSize,
        letterSpacing: Number(spacing.toFixed(2)),
      };
    }
  }

  return {
    containerWidth: Math.ceil(
      estimateTextWidth(textLength, minFontSize, minLetterSpacing) + TRANSLATION_WIDTH_SAFETY_PX,
    ),
    fontSize: minFontSize,
    letterSpacing: minLetterSpacing,
  };
}

function estimateTextWidth(textLength: number, fontSize: number, letterSpacing: number) {
  return (
    textLength * fontSize * APPROX_ARMENIAN_CHAR_WIDTH +
    Math.max(0, textLength - 1) * letterSpacing
  );
}
