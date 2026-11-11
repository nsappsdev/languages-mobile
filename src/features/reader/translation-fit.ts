type TranslationFitInput = {
  availableWidth: number;
  maxFontSize: number;
  maxLetterSpacing: number;
  minFontSize: number;
  minLetterSpacing: number;
  text: string;
  measuredWidth?: number;
  fontScale?: number;
  maxContainerWidth?: number;
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
  maxContainerWidth = Infinity,
}: TranslationFitInput) {
  const normalizedText = text.trim();
  if (!normalizedText || availableWidth <= 0) {
    return { containerWidth: Math.max(1, availableWidth), fontSize: maxFontSize, letterSpacing: maxLetterSpacing };
  }

  const textLength = Array.from(normalizedText).length;
  const containerWidth = Math.min(availableWidth, maxContainerWidth);
  // Leave room for glyph hinting, fractional layout and trailing letter spacing.
  const availableTextWidth = Math.max(0, containerWidth - WIDTH_SAFETY_PX);
  const width = (size: number, spacing: number) => measuredWidth === undefined
    ? estimateTextWidth(textLength,size,spacing) * fontScale
    : measuredWidth * size / maxFontSize + textLength * spacing * fontScale;
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    if (width(fontSize, minLetterSpacing) <= availableTextWidth) {
      const letterSpacing = Math.max(minLetterSpacing, Math.floor(Math.min(maxLetterSpacing,
        (availableTextWidth - width(fontSize,0)) / (textLength * fontScale)) * 100) / 100);
      return {
        containerWidth: Math.min(maxContainerWidth, Math.ceil(containerWidth)),
        fontSize,
        letterSpacing,
      };
    }
  }

  // Expand the word/translation pair together. Only exceptionally long labels
  // need to shrink below the preferred minimum to stay on one line on a phone.
  const minimumWidth = width(minFontSize, minLetterSpacing);
  const scale = Math.min(1, Math.max(1, maxContainerWidth - WIDTH_SAFETY_PX) / minimumWidth);
  return {
    containerWidth: Math.min(maxContainerWidth, Math.ceil(Math.max(containerWidth, minimumWidth * scale + WIDTH_SAFETY_PX))),
    fontSize: minFontSize * scale,
    letterSpacing: minLetterSpacing * scale,
  };
}

function estimateTextWidth(textLength: number, fontSize: number, letterSpacing: number) {
  return textLength * (fontSize * APPROX_ARMENIAN_CHAR_WIDTH + letterSpacing);
}
