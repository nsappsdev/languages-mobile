type TranslationFitInput = {
  availableWidth: number;
  maxFontSize: number;
  maxLetterSpacing: number;
  minFontSize: number;
  minLetterSpacing: number;
  text: string;
  measuredWidth?: number;
  fontScale?: number;
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
  measuredWidth,
  fontScale = 1,
}: TranslationFitInput) {
  const normalizedText = text.trim();
  if (!normalizedText || availableWidth <= 0) {
    return { containerWidth: Math.max(1, availableWidth), fontSize: maxFontSize, letterSpacing: maxLetterSpacing };
  }

  const textLength = normalizedText.length;
  const width = (size: number, spacing: number) => measuredWidth === undefined
    ? estimateTextWidth(textLength,size,spacing) * fontScale
    : measuredWidth * size / maxFontSize + Math.max(0,textLength-1)*spacing*fontScale;
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    if (width(fontSize, minLetterSpacing) <= availableWidth) {
      const letterSpacing = Math.min(maxLetterSpacing, Math.max(minLetterSpacing,
        (availableWidth - width(fontSize,0)) / (Math.max(1, textLength - 1)*fontScale)));
      return {
        containerWidth: Math.ceil(Math.max(availableWidth, width(fontSize, letterSpacing))),
        fontSize,
        letterSpacing: Number(letterSpacing.toFixed(2)),
      };
    }
  }

  return {
    containerWidth: Math.ceil(width(minFontSize, minLetterSpacing) + WIDTH_SAFETY_PX),
    fontSize: minFontSize,
    letterSpacing: minLetterSpacing,
  };
}

function estimateTextWidth(textLength: number, fontSize: number, letterSpacing: number) {
  return textLength * fontSize * APPROX_ARMENIAN_CHAR_WIDTH + Math.max(0, textLength - 1) * letterSpacing;
}
