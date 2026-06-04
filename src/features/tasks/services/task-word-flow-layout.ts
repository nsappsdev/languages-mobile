type TokenLayoutWidthInput = {
  fallbackTokenWidth: number;
  measuredTokenWidth: number;
  phraseWidth: number;
};

export function getTokenLayoutWidth({
  fallbackTokenWidth,
  measuredTokenWidth,
  phraseWidth,
}: TokenLayoutWidthInput) {
  return Math.ceil(Math.max(phraseWidth || measuredTokenWidth || fallbackTokenWidth, 1));
}
