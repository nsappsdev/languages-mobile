export function extractSelectionText(source: string, start: number, end: number) {
  if (start >= end || start < 0 || end > source.length) {
    return '';
  }

  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function shouldShowAddToVocabularyButton(selection: string) {
  return selection.trim().length > 0;
}
