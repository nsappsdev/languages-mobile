import { useAudioPlayer } from 'expo-audio';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { resolveApiAssetUrl } from '@/src/config/env';
import { ensureAudioCached } from '@/src/features/tasks/services/audio-cache';
import { VocabularyOverview } from '@/src/features/vocabulary/components/vocabulary-overview';
import {
  VocabularyLearnedArchive,
  VocabularyLessonDashboard,
  VocabularyLessonReview,
} from '@/src/features/vocabulary/components/vocabulary-section-list';
import { VocabularyStateScreen } from '@/src/features/vocabulary/components/vocabulary-state-screen';
import { useVocabularyData } from '@/src/features/vocabulary/hooks/use-vocabulary-data';
import {
  findContextAudioRange,
  findWordAudioRange,
  type LessonVocabularyRow,
  type VocabularyAudioRange,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import { useSession } from '@/src/shared/auth/session-context';
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
      <VocabularyStateScreen>
        <Text style={styles.meta}>Sign in to view vocabulary.</Text>
      </VocabularyStateScreen>
    );
  }

  if (isLoading) {
    return (
      <VocabularyStateScreen>
        <ActivityIndicator size="large" />
        <Text style={styles.meta}>Loading vocabulary...</Text>
      </VocabularyStateScreen>
    );
  }

  if (error && view === 'dashboard') {
    return (
      <VocabularyStateScreen>
        <Text style={styles.error}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void fetchSummaries()}
          style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </VocabularyStateScreen>
    );
  }

  return (
    <ScreenContainer>
      {view === 'dashboard' ? (
        <>
          <VocabularyOverview
            activeCount={activeCount}
            learnedCount={learnedCount}
            syncMeta={syncMeta}
          />
          <VocabularyLessonDashboard
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
        </>
      ) : null}

      {view === 'lesson' ? (
        selectedSection ? (
          <VocabularyLessonReview
            onBack={backToDashboard}
            onPlayContext={playContext}
            onPlayWord={playWord}
            onReview={reviewWord}
            section={selectedSection}
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
          <VocabularyLearnedArchive
            onBack={backToDashboard}
            onRestore={(section, row) => void restoreWord(section, row)}
            sections={archiveSections}
          />
        )
      ) : null}
    </ScreenContainer>
  );
}

function LoadingView({ onBack, text }: { onBack: () => void; text: string }) {
  return (
    <View style={styles.loadingView}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <ActivityIndicator size="large" />
      <Text style={styles.meta}>{text}</Text>
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
    <View style={styles.loadingView}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text style={styles.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}
