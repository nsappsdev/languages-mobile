import type { Animated, LayoutChangeEvent } from 'react-native';
import type { VocabularyTokenMatch } from '@/src/features/tasks/services/task-runner-helpers';
import type { LessonWordToken } from '@/src/features/tasks/screens/task-runner-words';
import type { LearnerVocabularyItem, VocabularyEntry } from '@/src/types/domain';

export type TranslationFitSettings = {
  maxFontSize: number;
  maxLetterSpacing: number;
  minFontSize: number;
  minLetterSpacing: number;
};

export type TaskWordFlowProps = {
  activeSegmentId: string | null;
  entryCacheByText: Record<string, VocabularyEntry>;
  getTokenPulseValue: (normalizedWord: string) => Animated.Value;
  handleSeekToSegment: (startMs: number | null) => void;
  handleTokenPositionLayout: (segmentId: string | null, event: LayoutChangeEvent) => void;
  handleTokenWordLayout: (tokenKey: string, event: LayoutChangeEvent) => void;
  handleToggleWordVocabulary: (rawWord: string, normalizedWord: string | null) => void;
  isPlaying: boolean;
  isPlaybackNavigationActive: boolean;
  mainTextFontFamily: string | undefined;
  mainTextFontSize: number;
  mainTextLineHeight: number;
  onLayout: (event: LayoutChangeEvent) => void;
  pendingWords: Record<string, true>;
  segmentStartById: Record<string, number>;
  tokenSegmentIds: (string | null)[];
  tokenWidths: Record<string, number>;
  translationFitSettings: TranslationFitSettings;
  translationFontFamily: string | undefined;
  triggerTokenFeedback: (normalizedWord: string) => void;
  unknownTaps: Record<string, true>;
  vocabularyByText: Record<string, LearnerVocabularyItem>;
  vocabularyTokenMatches: (VocabularyTokenMatch | null)[];
  wordTokens: LessonWordToken[];
};
