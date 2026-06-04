type TokenLayoutWidthInput = {
  fallbackTokenWidth: number;
  measuredTokenWidth: number;
  phraseWidth: number;
};

type TranslationLabelMaxWidthInput = {
  availableWidth: number;
  fittedContainerWidth?: number;
  wordFlowWidth: number;
};

type TokenMatchAnchorSummary = {
  focusTokenIndex: number | null;
  startIndex: number;
};

export function getTokenLayoutWidth({
  fallbackTokenWidth,
  measuredTokenWidth,
  phraseWidth,
}: TokenLayoutWidthInput) {
  return Math.ceil(Math.max(phraseWidth || measuredTokenWidth || fallbackTokenWidth, 1));
}

export function getTranslationLabelMaxWidth({
  availableWidth,
  fittedContainerWidth,
  wordFlowWidth,
}: TranslationLabelMaxWidthInput) {
  const desiredWidth = Math.ceil(
    Math.max(fittedContainerWidth ?? availableWidth, availableWidth, 1),
  );
  if (wordFlowWidth <= 0) {
    return desiredWidth;
  }

  return Math.max(1, Math.min(desiredWidth, Math.floor(wordFlowWidth)));
}

export function getMatchTranslationAnchorIndex(match: TokenMatchAnchorSummary | null) {
  if (!match) {
    return null;
  }

  return match.focusTokenIndex ?? match.startIndex;
}
