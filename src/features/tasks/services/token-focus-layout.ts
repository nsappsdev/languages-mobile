type FocusLayoutToken = {
  key: string;
  text: string;
};

type FocusLayoutInput = {
  firstTokenIndex: number;
  focusTokenIndex: number | null;
  fontSize: number;
  horizontalPadding: number;
  measuredPhraseWidth: number;
  tokenWidths: Record<string, number>;
  tokens: FocusLayoutToken[];
};

const WORD_CHAR_WIDTH = 0.56;
const SPACE_CHAR_WIDTH = 0.32;
const PUNCTUATION_CHAR_WIDTH = 0.3;

export function getFocusedTokenLayout({
  firstTokenIndex,
  focusTokenIndex,
  fontSize,
  horizontalPadding,
  measuredPhraseWidth,
  tokenWidths,
  tokens,
}: FocusLayoutInput) {
  const phraseWidth =
    measuredPhraseWidth || estimatePhraseWidth(tokens, fontSize, horizontalPadding);
  const fallback = {
    focusOffset: 0,
    focusWidth: phraseWidth,
    phraseWidth,
  };
  if (focusTokenIndex === null) {
    return fallback;
  }

  const focusIndex = focusTokenIndex - firstTokenIndex;
  if (focusIndex < 0 || focusIndex >= tokens.length) {
    return fallback;
  }

  const explicitFocusWidth = tokenWidths[tokens[focusIndex].key];
  const explicitOffsetTokens = tokens.slice(0, focusIndex);
  if (
    explicitFocusWidth &&
    explicitOffsetTokens.every((token) => tokenWidths[token.key] !== undefined)
  ) {
    return {
      focusOffset: explicitOffsetTokens.reduce((total, token) => total + tokenWidths[token.key], 0),
      focusWidth: explicitFocusWidth,
      phraseWidth,
    };
  }

  const tokenEstimates = tokens.map((token) => estimateTokenWidth(token.text, fontSize));
  const estimatedContentWidth = tokenEstimates.reduce((total, width) => total + width, 0);
  if (estimatedContentWidth <= 0) {
    return fallback;
  }

  const contentWidth = Math.max(1, phraseWidth - horizontalPadding * 2);
  const scale = contentWidth / estimatedContentWidth;
  const focusOffset =
    horizontalPadding +
    tokenEstimates.slice(0, focusIndex).reduce((total, width) => total + width * scale, 0);
  const focusWidth = Math.max(1, tokenEstimates[focusIndex] * scale);

  return {
    focusOffset,
    focusWidth,
    phraseWidth,
  };
}

export function getStartAlignedTranslationOffset({
  focusOffset,
}: {
  focusOffset: number;
}) {
  return Math.max(0, focusOffset);
}

function estimatePhraseWidth(
  tokens: FocusLayoutToken[],
  fontSize: number,
  horizontalPadding: number,
) {
  return (
    tokens.reduce((total, token) => total + estimateTokenWidth(token.text, fontSize), 0) +
    horizontalPadding * 2
  );
}

function estimateTokenWidth(text: string, fontSize: number) {
  if (/^\s+$/.test(text)) {
    return text.length * fontSize * SPACE_CHAR_WIDTH;
  }
  if (/^[^\sA-Za-z0-9]+$/.test(text)) {
    return text.length * fontSize * PUNCTUATION_CHAR_WIDTH;
  }
  return text.length * fontSize * WORD_CHAR_WIDTH;
}
