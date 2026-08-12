import { useAudioPlayer } from 'expo-audio';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { resolveApiAssetUrl } from '@/src/config/env';
import { ensureAudioCached } from '@/src/features/tasks/services/audio-cache';
import { LearnedVocabularyArchive } from '@/src/features/vocabulary/components/learned-vocabulary-archive';
import { VocabularyDashboard } from '@/src/features/vocabulary/components/vocabulary-dashboard';
import { VocabularyLessonReview } from '@/src/features/vocabulary/components/vocabulary-lesson-review';
import { VocabularyOverview } from '@/src/features/vocabulary/components/vocabulary-overview';
import { VocabularyBackButton } from '@/src/features/vocabulary/components/vocabulary-shared';
import { VocabularyStateScreen } from '@/src/features/vocabulary/components/vocabulary-state-screen';
import { useVocabularyData } from '@/src/features/vocabulary/hooks/use-vocabulary-data';
import {
  findContextAudioRange,
  findWordAudioRange,
  type LessonVocabularyRow,
  type VocabularyAudioRange,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import { useSession } from '@/src/shared/auth/session-context';
import { FeedbackState } from '@/src/shared/ui/feedback-state';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

type VocabularyView = 'dashboard' | 'lesson' | 'archive';

export function VocabularyScreen() {
  const { token, user } = useSession();
  const userId = user?.id;
  const [view, setView] = useState<VocabularyView>('dashboard');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const player = useAudioPlayer(undefined, { updateInterval: 100 });
  const audioSourceRef = useRef<string | null>(null);
  const audioStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    archiveSections,
    error,
    fetchSummaries,
    isLoading,
    isLoadingView,
    isRefreshing,
    openArchive,
    openLesson,
    restoreWord,
    reviewWord,
    selectedSection,
    setSelectedSection,
    summaries,
    syncMeta,
  } = useVocabularyData({ token, userId });

  const activeCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.activeCount, 0),
    [summaries],
  );
  const learnedCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.learnedCount, 0),
    [summaries],
  );

  const playAudioRange = useCallback(
    async (range: VocabularyAudioRange | null) => {
      if (!range?.audioUrl) return;
      const sourceUrl = resolveApiAssetUrl(range.audioUrl);
      const playableUrl = await ensureAudioCached(sourceUrl).catch(() => sourceUrl);
      if (audioStopTimerRef.current) clearTimeout(audioStopTimerRef.current);
      if (audioSourceRef.current !== playableUrl) {
        player.replace(playableUrl);
        audioSourceRef.current = playableUrl;
      }
      player.pause();
      await player.seekTo(range.startMs / 1000);
      player.play();
      audioStopTimerRef.current = setTimeout(
        () => player.pause(),
        Math.max(250, range.endMs - range.startMs),
      );
    },
    [player],
  );

  const playWord = useCallback(
    (row: LessonVocabularyRow) => {
      if (selectedSection) {
        void playAudioRange(findWordAudioRange(selectedSection.lesson, row.entry));
      }
    },
    [playAudioRange, selectedSection],
  );

  const playContext = useCallback(
    (row: LessonVocabularyRow) => {
      if (selectedSection) {
        void playAudioRange(findContextAudioRange(selectedSection.lesson, row.entry));
      }
    },
    [playAudioRange, selectedSection],
  );

  const backToDashboard = () => {
    setSelectedSection(null);
    setSelectedLessonId(null);
    setView('dashboard');
    void fetchSummaries(true);
  };

  if (!token || !userId) {
    return (
      <VocabularyStateScreen
        message="Your saved words are available after you sign in."
        title="Sign in to view vocabulary"
      />
    );
  }

  if (isLoading) {
    return <VocabularyStateScreen loading title="Loading vocabulary" />;
  }

  if (error && view === 'dashboard') {
    return (
      <VocabularyStateScreen
        actionLabel="Retry"
        message={error}
        onAction={() => void fetchSummaries()}
        title="Vocabulary could not load"
      />
    );
  }

  return (
    <ScreenContainer>
      {view === 'dashboard' ? (
        <VocabularyDashboard
          header={
            <VocabularyOverview
              activeCount={activeCount}
              learnedCount={learnedCount}
              syncMeta={syncMeta}
            />
          }
          isRefreshing={isRefreshing}
          onOpenArchive={() => {
            setView('archive');
            void openArchive();
          }}
          onOpenLesson={(lessonId) => {
            setSelectedSection(null);
            setSelectedLessonId(lessonId);
            setView('lesson');
            void openLesson(lessonId);
          }}
          onRefresh={() => void fetchSummaries(true)}
          summaries={summaries}
        />
      ) : null}

      {view === 'lesson' ? (
        selectedSection ? (
          <VocabularyLessonReview
            onBack={backToDashboard}
            onPlayContext={playContext}
            onPlayWord={playWord}
            onReview={reviewWord}
            section={selectedSection}
            syncMeta={syncMeta}
          />
        ) : isLoadingView ? (
          <LoadingView onBack={backToDashboard} text="Loading lesson vocabulary..." />
        ) : (
          <LessonLoadError
            error={error ?? 'Failed to load lesson vocabulary.'}
            onBack={backToDashboard}
            onRetry={() => {
              if (selectedLessonId) void openLesson(selectedLessonId);
            }}
          />
        )
      ) : null}

      {view === 'archive' ? (
        isLoadingView && archiveSections.length === 0 ? (
          <LoadingView onBack={backToDashboard} text="Loading learned words..." />
        ) : (
          <LearnedVocabularyArchive
            onBack={backToDashboard}
            onRestore={(section, row) => void restoreWord(section, row)}
            sections={archiveSections}
            syncMeta={syncMeta}
          />
        )
      ) : null}
    </ScreenContainer>
  );
}

function LoadingView({ onBack, text }: { onBack: () => void; text: string }) {
  return (
    <View style={styles.subview}>
      <View style={styles.subviewBack}>
        <VocabularyBackButton label="Back to vocabulary lessons" onPress={onBack} />
      </View>
      <FeedbackState loading title={text} />
    </View>
  );
}

function LessonLoadError({
  error,
  onBack,
  onRetry,
}: {
  error: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.subview}>
      <View style={styles.subviewBack}>
        <VocabularyBackButton label="Back to vocabulary lessons" onPress={onBack} />
      </View>
      <FeedbackState
        actionLabel="Retry"
        message={error}
        onAction={onRetry}
        title="Lesson vocabulary could not load"
      />
    </View>
  );
}
