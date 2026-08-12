import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { resolveApiAssetUrl } from '@/src/config/env';
import {
  markLessonCompleted,
  setActiveLesson,
} from '@/src/features/lessons/progression-storage';
import { flushProgressQueue, queueProgressEvents } from '@/src/features/progress/progress-sync';
import {
  DEFAULT_READING_MODES,
  TOKEN_WORD_FONT_SIZE,
  TOKEN_WORD_LINE_HEIGHT,
} from '@/src/features/tasks/constants/task-runner';
import {
  LessonProgressOverview,
  LessonRunnerHeader,
  ReadingModeDock,
  RunnerMessageScreen,
} from '@/src/features/tasks/components/task-runner-layout';
import {
  RunnerItemCard,
  RunnerNavigationActions,
} from '@/src/features/tasks/components/task-runner-content';
import { PagedRunnerContent } from '@/src/features/tasks/components/task-runner-paged';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';
import { useReadingModePlayback } from '@/src/features/tasks/hooks/use-reading-mode-playback';
import { useRunnerAudio } from '@/src/features/tasks/hooks/use-runner-audio';
import { useRunnerVocabulary } from '@/src/features/tasks/hooks/use-runner-vocabulary';
import { useTaskRunnerData } from '@/src/features/tasks/hooks/use-task-runner-data';
import { runnerMotion } from '@/src/features/tasks/theme/runner-motion';
import { runnerTypography } from '@/src/features/tasks/theme/runner-typography';
import {
  calculateCompletion,
  calculateTopSegmentScrollOffset,
  buildVocabularyTokenMatches,
  createIdempotencyKey,
  formatSeconds,
} from '@/src/features/tasks/services/task-runner-helpers';
import { tokenizeLessonText } from '@/src/features/tasks/screens/task-runner-words';
import { getTokenSegmentIds } from '@/src/features/tasks/screens/task-runner-segments';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import type { ProgressEvent } from '@/src/types/domain';

interface TaskRunnerScreenProps {
  lessonId: string;
  presentation?: 'continuous' | 'paged';
}

type SegmentLayoutBounds = {
  bottom: number;
  top: number;
};

const ACTIVE_SEGMENT_SCROLL_TOP_PADDING = 24;

export function TaskRunnerScreen({
  lessonId,
  presentation = 'continuous',
}: TaskRunnerScreenProps) {
  const router = useRouter();
  const { token, user } = useSession();
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [completedItemIds, setCompletedItemIds] = useState<Record<string, true>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [tokenWidths, setTokenWidths] = useState<Record<string, number>>({});
  const startedItemIdsRef = useRef<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView | null>(null);
  const wordFlowOffsetYRef = useRef(0);
  const segmentLayoutsRef = useRef<Record<string, SegmentLayoutBounds>>({});
  const pendingScrollSegmentIdRef = useRef<string | null>(null);
  const tokenPulseValuesRef = useRef(new Map<string, Animated.Value>());

  const { appSettings, entryCacheByText, error, isLoading, lesson, reload } = useTaskRunnerData({
    lessonId,
    token,
  });

  const {
    handleToggleWordVocabulary,
    pendingWords,
    resetForItem: resetVocabularyForItem,
    setVocabularyNotice,
    unknownTaps,
    vocabularyByText,
    vocabularyNotice,
  } = useRunnerVocabulary({
    entryCacheByText,
    lessonId,
    token,
    userId: user?.id,
  });

  const items = useMemo(
    () => (lesson ? [...lesson.items].sort((left, right) => left.order - right.order) : []),
    [lesson],
  );

  useEffect(() => {
    if (items.length && currentItemIndex >= items.length) {
      setCurrentItemIndex(0);
    }
  }, [currentItemIndex, items.length]);

  const currentItem = items[currentItemIndex];
  const currentAudioUrl = useMemo(
    () => (currentItem?.audioUrl ? resolveApiAssetUrl(currentItem.audioUrl) : null),
    [currentItem?.audioUrl],
  );
  const nextAudioUrl = useMemo(() => {
    const nextItem = items[currentItemIndex + 1];
    return nextItem?.audioUrl ? resolveApiAssetUrl(nextItem.audioUrl) : null;
  }, [currentItemIndex, items]);
  const { isAudioCaching, playableAudioUrl, playbackStatus, player } = useRunnerAudio({
    currentAudioUrl,
    currentItem,
    nextAudioUrl,
    progressUpdateIntervalMs: presentation === 'paged' ? 250 : 1000,
  });
  const isPlaying = playbackStatus.playing;

  const handleGoToDashboard = useCallback(() => {
    router.replace(presentation === 'paged' ? '/(tabs)/lessons-2' : '/(tabs)/lessons');
  }, [presentation, router]);

  const triggerTokenFeedback = useCallback((normalizedWord: string) => {
    const pulseValue = tokenPulseValuesRef.current.get(normalizedWord) ?? new Animated.Value(0);
    tokenPulseValuesRef.current.set(normalizedWord, pulseValue);
    pulseValue.stopAnimation(() => {
      pulseValue.setValue(0);
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: runnerMotion.tokenFeedback.rise,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(runnerMotion.tokenFeedback.hold),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: runnerMotion.tokenFeedback.fall,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    void Haptics.selectionAsync().catch(() => null);
  }, []);

  const triggerTranslationHeartbeat = useCallback(
    (normalizedWord: string, durationMs: number) => {
      const pulseValue =
        tokenPulseValuesRef.current.get(normalizedWord) ?? new Animated.Value(0);
      tokenPulseValuesRef.current.set(normalizedWord, pulseValue);
      const riseDuration = runnerMotion.translationHeartbeat.rise;
      const fallDuration = runnerMotion.translationHeartbeat.fall;
      const holdDuration = Math.max(
        runnerMotion.translationHeartbeat.minHold,
        Math.min(
          durationMs - riseDuration - fallDuration,
          runnerMotion.translationHeartbeat.maxHold,
        ),
      );

      pulseValue.stopAnimation(() => {
        pulseValue.setValue(0);
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: riseDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(holdDuration),
          Animated.timing(pulseValue, {
            toValue: 0,
            duration: fallDuration,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [],
  );

  const getTokenPulseValue = useCallback((normalizedWord: string) => {
    const existing = tokenPulseValuesRef.current.get(normalizedWord);
    if (existing) {
      return existing;
    }

    const next = new Animated.Value(0);
    tokenPulseValuesRef.current.set(normalizedWord, next);
    return next;
  }, []);

  useEffect(() => {
    if (!user?.id || !lessonId) return;
    void setActiveLesson(user.id, lessonId);
  }, [lessonId, user?.id]);

  useEffect(() => {
    if (!token) return;
    return () => {
      void flushProgressQueue({ force: true });
    };
  }, [token]);

  const progressText = `${Math.min(currentItemIndex + 1, Math.max(items.length, 1))} / ${Math.max(items.length, 1)}`;

  const queueProgressEvent = useCallback(
    (event: Omit<ProgressEvent, 'idempotencyKey' | 'clientTimestamp'>) => {
      if (!token) return;
      void queueProgressEvents([
        {
          ...event,
          idempotencyKey: createIdempotencyKey(
            event.eventType,
            event.lessonId,
            event.lessonItemId,
          ),
          clientTimestamp: new Date().toISOString(),
        },
      ]).then((result) => {
        if (!result.ok) {
          setSyncError(result.message ?? 'Progress sync is pending. We will retry automatically.');
          return;
        }

        if (result.pending === 0) {
          setSyncError(null);
        }
      });
    },
    [token],
  );

  useEffect(() => {
    if (!currentItem) {
      return;
    }

    if (startedItemIdsRef.current.has(currentItem.id)) {
      return;
    }

    startedItemIdsRef.current.add(currentItem.id);
    queueProgressEvent({
      lessonId,
      lessonItemId: currentItem.id,
      eventType: 'ITEM_STARTED',
      completion: calculateCompletion(completedItemIds, items.length),
      payload: {
        order: currentItem.order,
      },
    });
  }, [completedItemIds, currentItem, items.length, lessonId, queueProgressEvent]);

  const activeSegmentId = playbackStatus.activeSegmentId;
  const scrollTargetSegmentId = playbackStatus.scrollTargetSegmentId;

  const wordTokens = useMemo(
    () => (currentItem ? tokenizeLessonText(currentItem.text) : []),
    [currentItem],
  );

  const tokenSegmentIds = useMemo((): (string | null)[] => {
    if (!currentItem || !currentItem.segments.length) {
      return wordTokens.map(() => null);
    }
    return getTokenSegmentIds(wordTokens, currentItem.text, currentItem.segments);
  }, [currentItem, wordTokens]);

  const vocabularyTokenMatches = useMemo(
    () => buildVocabularyTokenMatches(wordTokens, Object.values(entryCacheByText)),
    [entryCacheByText, wordTokens],
  );

  const mainTextFontSize = appSettings?.mainTextFontSize ?? TOKEN_WORD_FONT_SIZE;
  const mainTextLineHeight = Math.ceil(
    mainTextFontSize * (TOKEN_WORD_LINE_HEIGHT / TOKEN_WORD_FONT_SIZE),
  );
  const mainTextFontFamily =
    appSettings?.mainTextFontFamily && appSettings.mainTextFontFamily !== 'System'
      ? appSettings.mainTextFontFamily
      : undefined;

  useEffect(() => {
    setTokenWidths({});
  }, [currentItem?.id, mainTextFontFamily, mainTextFontSize]);

  const segmentStartById = useMemo(() => {
    const result: Record<string, number> = {};
    for (const segment of currentItem?.segments ?? []) {
      result[segment.id] = segment.startMs;
    }
    return result;
  }, [currentItem]);

  const getSegmentIdAtMs = useCallback(
    (positionMs: number) => {
      if (!currentItem) {
        return null;
      }

      const matchingSegment = currentItem.segments.find(
        (segment) => positionMs >= segment.startMs && positionMs < segment.endMs,
      );
      return matchingSegment?.id ?? null;
    },
    [currentItem],
  );

  const scrollToSegment = useCallback(
    (segmentId: string | null, animated = true) => {
      if (!segmentId) {
        return;
      }

      const segmentLayout = segmentLayoutsRef.current[segmentId];
      if (!segmentLayout) {
        pendingScrollSegmentIdRef.current = segmentId;
        return;
      }

      pendingScrollSegmentIdRef.current = null;
      scrollViewRef.current?.scrollTo({
        animated,
        y: calculateTopSegmentScrollOffset({
          segmentTop: segmentLayout.top,
          topPadding: ACTIVE_SEGMENT_SCROLL_TOP_PADDING,
          wordFlowOffsetY: wordFlowOffsetYRef.current,
        }),
      });
    },
    [],
  );

  const handleWordFlowLayout = useCallback(
    (event: LayoutChangeEvent) => {
      wordFlowOffsetYRef.current = event.nativeEvent.layout.y;
      if (isPlaying) {
        scrollToSegment(scrollTargetSegmentId);
      }
    },
    [isPlaying, scrollTargetSegmentId, scrollToSegment],
  );

  const handleTokenPositionLayout = useCallback(
    (segmentId: string | null, event: LayoutChangeEvent) => {
      if (!segmentId) {
        return;
      }

      const nextY = Math.floor(event.nativeEvent.layout.y);
      const nextBottom = Math.ceil(event.nativeEvent.layout.y + event.nativeEvent.layout.height);
      const currentBounds = segmentLayoutsRef.current[segmentId];
      segmentLayoutsRef.current[segmentId] = currentBounds
        ? {
            bottom: Math.max(currentBounds.bottom, nextBottom),
            top: Math.min(currentBounds.top, nextY),
          }
        : {
            bottom: nextBottom,
            top: nextY,
          };

      if (
        isPlaying &&
        (segmentId === scrollTargetSegmentId || segmentId === pendingScrollSegmentIdRef.current)
      ) {
        scrollToSegment(segmentId);
      }
    },
    [isPlaying, scrollTargetSegmentId, scrollToSegment],
  );

  useEffect(() => {
    segmentLayoutsRef.current = {};
  }, [currentItem?.id]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    scrollToSegment(scrollTargetSegmentId);
  }, [isPlaying, scrollTargetSegmentId, scrollToSegment]);

  const readingModes = useMemo(
    () =>
      [...(appSettings?.readingModes ?? DEFAULT_READING_MODES)]
        .filter((mode) => mode.enabled)
        .sort((left, right) => left.order - right.order),
    [appSettings?.readingModes],
  );

  const unknownNormalizedWords = useMemo(() => {
    const words = new Set<string>();
    for (const normalizedWord of Object.keys(vocabularyByText)) {
      words.add(normalizedWord);
    }
    for (const normalizedWord of Object.keys(unknownTaps)) {
      words.add(normalizedWord);
    }
    return words;
  }, [unknownTaps, vocabularyByText]);

  const focusNormalizedByText = useMemo(() => {
    const focusByText: Record<string, string | undefined> = {};
    for (const [normalizedText, item] of Object.entries(vocabularyByText)) {
      focusByText[normalizedText] = item.entry.focusNormalizedText ?? undefined;
    }
    for (const [normalizedText, entry] of Object.entries(entryCacheByText)) {
      focusByText[normalizedText] = entry.focusNormalizedText ?? focusByText[normalizedText];
    }
    return focusByText;
  }, [entryCacheByText, vocabularyByText]);

  const {
    activeModeId,
    cancelModePlayback,
    getModeDisabledReason,
    handleToggleReadingMode,
    seekActiveModeToMs,
  } = useReadingModePlayback({
      currentItem,
      durationSeconds: playbackStatus.duration ?? 0,
      focusNormalizedByText,
      getSegmentIdAtMs,
      playableAudioUrl,
      player,
      playbackStatus,
      scrollToSegment,
      setNotice: setVocabularyNotice,
      triggerTranslationHeartbeat,
      unknownNormalizedWords,
      wordRepetitionPauseMs: appSettings?.wordRepetitionPauseMs ?? 800,
    });
  const primaryReadingMode =
    readingModes.find((mode) => mode.id === activeModeId) ?? readingModes[0] ?? null;
  const primaryModeDisabledReason = primaryReadingMode
    ? getModeDisabledReason(primaryReadingMode.id)
    : 'No reading mode is available.';

  useEffect(() => {
    resetVocabularyForItem();
    cancelModePlayback();
  }, [cancelModePlayback, currentItemIndex, resetVocabularyForItem]);

  useEffect(() => {
    if (isLoading) {
      cancelModePlayback();
    }
  }, [cancelModePlayback, currentItem?.updatedAt, isLoading, lesson?.updatedAt]);

  const translationFitSettings = useMemo(
    () => ({
      maxFontSize:
        appSettings?.translationFontMaxSize ??
        appSettings?.translationFontSize ??
        runnerTypography.translationDefaultMaxSize,
      maxLetterSpacing:
        appSettings?.translationLetterSpacingMax ??
        runnerTypography.translationDefaultMaxLetterSpacing,
      minFontSize:
        appSettings?.translationFontMinSize ?? runnerTypography.translationDefaultMinSize,
      minLetterSpacing:
        appSettings?.translationLetterSpacingMin ??
        runnerTypography.translationDefaultMinLetterSpacing,
    }),
    [
      appSettings?.translationFontMaxSize,
      appSettings?.translationFontMinSize,
      appSettings?.translationFontSize,
      appSettings?.translationLetterSpacingMax,
      appSettings?.translationLetterSpacingMin,
    ],
  );

  const translationFontFamily =
    appSettings?.translationFontFamily && appSettings.translationFontFamily !== 'System'
      ? appSettings.translationFontFamily
      : undefined;

  const handleTokenWordLayout = useCallback(
    (tokenKey: string, event: LayoutChangeEvent) => {
      const nextWidth = Math.ceil(event.nativeEvent.layout.width);
      setTokenWidths((prev) => {
        if (prev[tokenKey] === nextWidth) {
          return prev;
        }

        segmentLayoutsRef.current = {};
        return { ...prev, [tokenKey]: nextWidth };
      });
    },
    [],
  );

  const handleSeekToSegment = useCallback(
    (startMs: number | null) => {
      if (!isPlaying || startMs === null) return;
      if (activeModeId && seekActiveModeToMs(startMs)) {
        return;
      }
      const startSeconds = startMs / 1000;
      scrollToSegment(getSegmentIdAtMs(startMs), false);
      void player.seekTo(startSeconds).then(() => {
        player.play();
      });
    },
    [activeModeId, getSegmentIdAtMs, isPlaying, player, scrollToSegment, seekActiveModeToMs],
  );

  const completeCurrentItem = useCallback(() => {
    if (!currentItem || completedItemIds[currentItem.id]) {
      return completedItemIds;
    }

    const nextCompleted = { ...completedItemIds, [currentItem.id]: true as const };
    queueProgressEvent({
      lessonId,
      lessonItemId: currentItem.id,
      eventType: 'ITEM_COMPLETED',
      completion: calculateCompletion(nextCompleted, items.length),
      payload: {
        listenedSeconds: Number((playbackStatus.currentTime ?? 0).toFixed(2)),
      },
    });
    setCompletedItemIds(nextCompleted);
    return nextCompleted;
  }, [
    completedItemIds,
    currentItem,
    items.length,
    lessonId,
    playbackStatus.currentTime,
    queueProgressEvent,
  ]);

  const handleGoPrevious = useCallback(() => {
    if (currentItemIndex === 0) {
      return;
    }

    player.pause();
    setCurrentItemIndex((prev) => prev - 1);
  }, [currentItemIndex, player]);

  const handleGoNext = useCallback(async () => {
    if (!currentItem) {
      return;
    }

    player.pause();
    const updatedCompleted = completeCurrentItem();

    if (currentItemIndex === items.length - 1) {
      const lessonCompletion = calculateCompletion(updatedCompleted, items.length);
      queueProgressEvent({
        lessonId,
        eventType: 'LESSON_COMPLETED',
        completion: lessonCompletion,
      });

      const flushResult = await flushProgressQueue({ force: true });
      if (!flushResult.ok) {
        setSyncError(
          flushResult.message ?? 'Progress sync is pending. We will retry automatically.',
        );
      } else if (flushResult.pending === 0) {
        setSyncError(null);
      }

      if (user?.id) {
        await markLessonCompleted(user.id, lessonId);
      }

      router.replace({
        pathname: '/results/[lessonId]',
        params: {
          lessonId,
          items: String(items.length),
          completion: String(lessonCompletion),
        },
      });
      return;
    }

    setCurrentItemIndex((prev) => prev + 1);
  }, [
    completeCurrentItem,
    currentItem,
    currentItemIndex,
    items.length,
    lessonId,
    player,
    queueProgressEvent,
    router,
    user?.id,
  ]);

  if (!token) {
    return (
      <RunnerMessageScreen onBack={handleGoToDashboard}>
        <Text style={styles.meta}>Sign in to play lesson audio.</Text>
      </RunnerMessageScreen>
    );
  }

  if (isLoading) {
    return (
      <RunnerMessageScreen onBack={handleGoToDashboard}>
        <ActivityIndicator size="large" />
        <Text style={styles.meta}>Preparing lesson...</Text>
      </RunnerMessageScreen>
    );
  }

  if (error || !lesson || !currentItem) {
    return (
      <RunnerMessageScreen onBack={handleGoToDashboard}>
        <Text style={styles.error}>{error ?? 'Unable to load lesson player.'}</Text>
        <PrimaryButton
          title="Retry"
          onPress={() => {
            void reload();
          }}
        />
      </RunnerMessageScreen>
    );
  }

  const completion = calculateCompletion(completedItemIds, items.length);
  const durationSeconds = playbackStatus.duration ?? 0;
  const currentSeconds = playbackStatus.currentTime ?? 0;
  const audioSourceLabel = playableAudioUrl?.startsWith('file://') ? 'Cached' : 'Streaming';
  const wordFlowProps: TaskWordFlowProps = {
    activeSegmentId,
    entryCacheByText,
    getTokenPulseValue,
    handleSeekToSegment,
    handleTokenPositionLayout,
    handleTokenWordLayout,
    handleToggleWordVocabulary,
    isPlaying,
    isPlaybackNavigationActive: isPlaying,
    mainTextFontFamily,
    mainTextFontSize,
    mainTextLineHeight,
    onLayout: handleWordFlowLayout,
    pendingWords,
    segmentStartById,
    tokenSegmentIds,
    tokenWidths,
    translationFitSettings,
    translationFontFamily,
    triggerTokenFeedback,
    unknownTaps,
    vocabularyByText,
    vocabularyTokenMatches,
    wordTokens,
  };

  return (
    <ScreenContainer maxWidth={680}>
      <View style={styles.runnerLayout}>
        {presentation === 'continuous' ? (
          <LessonRunnerHeader
            lessonTitle={lesson.title}
            onBack={handleGoToDashboard}
            progressText={progressText}
          />
        ) : null}

        <ReadingModeDock
          activeModeId={activeModeId}
          getDisabledReason={getModeDisabledReason}
          modes={readingModes}
          onToggleMode={handleToggleReadingMode}
          playing={playbackStatus.playing}
          variant={presentation === 'paged' ? 'book' : 'dock'}
        />

        {presentation === 'paged' ? (
          <PagedRunnerContent
            audioSource={
              isAudioCaching ? 'Caching...' : playableAudioUrl ? audioSourceLabel : 'No audio'
            }
            currentSeconds={currentSeconds}
            currentItem={currentItem}
            currentItemIndex={currentItemIndex}
            isFirstItem={currentItemIndex === 0}
            isLastItem={currentItemIndex === items.length - 1}
            isPlaying={isPlaying}
            onNextItem={() => {
              void handleGoNext();
            }}
            onPreviousItem={handleGoPrevious}
            onTogglePlayback={() => {
              if (primaryReadingMode) handleToggleReadingMode(primaryReadingMode);
            }}
            pageTargetSegmentId={playbackStatus.pageTargetSegmentId}
            playbackDisabledReason={primaryModeDisabledReason}
            playbackModeLabel={primaryReadingMode?.displayName ?? 'Introduction'}
            durationSeconds={durationSeconds}
            syncError={syncError}
            vocabularyNotice={vocabularyNotice}
            wordFlowProps={wordFlowProps}
          />
        ) : (
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
            <LessonProgressOverview completion={completion} />

            <RunnerItemCard
              audioSource={
                isAudioCaching ? 'Caching...' : playableAudioUrl ? audioSourceLabel : 'No audio'
              }
              audioTime={`${formatSeconds(currentSeconds)} / ${formatSeconds(durationSeconds)}`}
              itemNumber={currentItemIndex + 1}
              vocabularyNotice={vocabularyNotice}
              wordFlowProps={wordFlowProps}
            />

            {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}

            <RunnerNavigationActions
              isFirstItem={currentItemIndex === 0}
              isLastItem={currentItemIndex === items.length - 1}
              onNext={() => {
                void handleGoNext();
              }}
              onPrevious={handleGoPrevious}
            />
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}
