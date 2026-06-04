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
  ACTIVE_SEGMENT_SCROLL_LOOKAHEAD_MS,
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
import { TaskWordFlow } from '@/src/features/tasks/components/task-word-flow';
import { useReadingModePlayback } from '@/src/features/tasks/hooks/use-reading-mode-playback';
import { useRunnerAudio } from '@/src/features/tasks/hooks/use-runner-audio';
import { useRunnerVocabulary } from '@/src/features/tasks/hooks/use-runner-vocabulary';
import { useTaskRunnerData } from '@/src/features/tasks/hooks/use-task-runner-data';
import {
  calculateCompletion,
  calculateTopSegmentScrollOffset,
  buildVocabularyTokenMatches,
  createIdempotencyKey,
  formatSeconds,
  getAnticipatedSegmentId,
} from '@/src/features/tasks/services/task-runner-helpers';
import { tokenizeLessonText } from '@/src/features/tasks/screens/task-runner-words';
import { getTokenSegmentIds } from '@/src/features/tasks/screens/task-runner-segments';
import {
  getActiveWordTimingId,
  getTokenWordTimingIds,
} from '@/src/features/tasks/screens/task-runner-word-timings';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import type { ProgressEvent } from '@/src/types/domain';

interface TaskRunnerScreenProps {
  lessonId: string;
}

type SegmentLayoutBounds = {
  bottom: number;
  top: number;
};

const ACTIVE_SEGMENT_SCROLL_TOP_PADDING = 24;

export function TaskRunnerScreen({ lessonId }: TaskRunnerScreenProps) {
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

  const { appSettings, entryCacheByText, error, isLoading, lesson } = useTaskRunnerData({
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

  const currentItem = items[currentItemIndex];
  const currentAudioUrl = useMemo(
    () => (currentItem?.audioUrl ? resolveApiAssetUrl(currentItem.audioUrl) : null),
    [currentItem?.audioUrl],
  );
  const { isAudioCaching, playableAudioUrl, playbackStatus, player } = useRunnerAudio({
    currentAudioUrl,
    currentItemIndex,
    items,
  });
  const isPlaying = playbackStatus.playing;

  const handleGoToDashboard = useCallback(() => {
    router.replace('/(tabs)/lessons');
  }, [router]);

  const triggerTokenFeedback = useCallback((normalizedWord: string) => {
    const pulseValue = tokenPulseValuesRef.current.get(normalizedWord) ?? new Animated.Value(0);
    tokenPulseValuesRef.current.set(normalizedWord, pulseValue);
    pulseValue.stopAnimation(() => {
      pulseValue.setValue(0);
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(120),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    void Haptics.selectionAsync().catch(() => null);
  }, []);

  const triggerTranslationHeartbeat = useCallback((normalizedWord: string, durationMs: number) => {
    const pulseValue = tokenPulseValuesRef.current.get(normalizedWord) ?? new Animated.Value(0);
    tokenPulseValuesRef.current.set(normalizedWord, pulseValue);
    const riseDuration = 320;
    const fallDuration = 520;
    const holdDuration = Math.max(450, Math.min(durationMs - riseDuration - fallDuration, 1200));

    pulseValue.stopAnimation(() => {
      pulseValue.setValue(0);
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: riseDuration,
          easing: Easing.out(Easing.cubic),
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
  }, []);

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

  const activeSegmentId = useMemo(() => {
    if (!currentItem) {
      return null;
    }

    const currentPositionMs = Math.round((playbackStatus.currentTime ?? 0) * 1000);
    const activeSegment = currentItem.segments.find(
      (segment) => currentPositionMs >= segment.startMs && currentPositionMs < segment.endMs,
    );

    return activeSegment?.id ?? null;
  }, [currentItem, playbackStatus.currentTime]);

  const activeWordTimingId = useMemo(() => {
    if (!currentItem) {
      return null;
    }

    const currentPositionMs = Math.round((playbackStatus.currentTime ?? 0) * 1000);
    return getActiveWordTimingId(currentItem.wordTimings ?? [], currentPositionMs);
  }, [currentItem, playbackStatus.currentTime]);

  const scrollTargetSegmentId = useMemo(() => {
    if (!currentItem || !isPlaying) {
      return activeSegmentId;
    }

    const currentPositionMs = Math.round((playbackStatus.currentTime ?? 0) * 1000);
    return getAnticipatedSegmentId({
      lookaheadMs: ACTIVE_SEGMENT_SCROLL_LOOKAHEAD_MS,
      positionMs: currentPositionMs,
      segments: currentItem.segments,
    });
  }, [activeSegmentId, currentItem, isPlaying, playbackStatus.currentTime]);

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

  const tokenWordTimingIds = useMemo((): (string | null)[] => {
    if (!currentItem || !currentItem.wordTimings.length) {
      return wordTokens.map(() => null);
    }
    return getTokenWordTimingIds(wordTokens, currentItem.text, currentItem.wordTimings);
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

  useEffect(() => {
    resetVocabularyForItem();
    cancelModePlayback();
  }, [cancelModePlayback, currentItemIndex, resetVocabularyForItem]);

  const translationFitSettings = useMemo(
    () => ({
      maxFontSize: appSettings?.translationFontMaxSize ?? appSettings?.translationFontSize ?? 15,
      maxLetterSpacing: appSettings?.translationLetterSpacingMax ?? 0.8,
      minFontSize: appSettings?.translationFontMinSize ?? 8,
      minLetterSpacing: appSettings?.translationLetterSpacingMin ?? -0.2,
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
      void player.seekTo(startSeconds);
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
      </RunnerMessageScreen>
    );
  }

  const completion = calculateCompletion(completedItemIds, items.length);
  const durationSeconds = playbackStatus.duration ?? 0;
  const currentSeconds = playbackStatus.currentTime ?? 0;
  const audioSourceLabel = playableAudioUrl?.startsWith('file://') ? 'Cached' : 'Streaming';

  return (
    <ScreenContainer>
      <View style={styles.runnerLayout}>
        <ReadingModeDock
          activeModeId={activeModeId}
          getDisabledReason={getModeDisabledReason}
          modes={readingModes}
          onToggleMode={handleToggleReadingMode}
          playing={playbackStatus.playing}
        />

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
          <LessonRunnerHeader
            lessonTitle={lesson.title}
            onBack={handleGoToDashboard}
            progressText={progressText}
          />

          <LessonProgressOverview completion={completion} />

          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.itemLabel}>Item {currentItemIndex + 1}</Text>
              <View style={styles.audioMetaRow}>
                <Text style={styles.audioMeta}>
                  {isAudioCaching ? 'Caching...' : playableAudioUrl ? audioSourceLabel : 'No audio'}
                </Text>
                <Text style={styles.audioMeta}>
                  {formatSeconds(currentSeconds)} / {formatSeconds(durationSeconds)}
                </Text>
              </View>
            </View>

            <TaskWordFlow
              activeSegmentId={activeSegmentId}
              activeWordTimingId={activeWordTimingId}
              entryCacheByText={entryCacheByText}
              getTokenPulseValue={getTokenPulseValue}
              handleSeekToSegment={handleSeekToSegment}
              handleTokenPositionLayout={handleTokenPositionLayout}
              handleTokenWordLayout={handleTokenWordLayout}
              handleToggleWordVocabulary={handleToggleWordVocabulary}
              isPlaying={isPlaying}
              mainTextFontFamily={mainTextFontFamily}
              mainTextFontSize={mainTextFontSize}
              mainTextLineHeight={mainTextLineHeight}
              onLayout={handleWordFlowLayout}
              pendingWords={pendingWords}
              segmentStartById={segmentStartById}
              tokenSegmentIds={tokenSegmentIds}
              tokenWidths={tokenWidths}
              tokenWordTimingIds={tokenWordTimingIds}
              translationFitSettings={translationFitSettings}
              translationFontFamily={translationFontFamily}
              triggerTokenFeedback={triggerTokenFeedback}
              unknownTaps={unknownTaps}
              vocabularyByText={vocabularyByText}
              vocabularyTokenMatches={vocabularyTokenMatches}
              wordTokens={wordTokens}
            />

            {vocabularyNotice ? <Text style={styles.notice}>{vocabularyNotice}</Text> : null}
          </View>

          {syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}

          <View style={styles.navigationRow}>
            <PrimaryButton
              title="Previous"
              variant="secondary"
              onPress={handleGoPrevious}
              disabled={currentItemIndex === 0}
            />
            <PrimaryButton
              title={currentItemIndex === items.length - 1 ? 'Finish Lesson' : 'Next Item'}
              onPress={() => {
                void handleGoNext();
              }}
            />
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
