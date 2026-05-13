import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { resolveApiAssetUrl } from '@/src/config/env';
import {
  markLessonCompleted,
  setActiveLesson,
} from '@/src/features/lessons/progression-storage';
import { flushProgressQueue, queueProgressEvents } from '@/src/features/progress/progress-sync';
import {
  ensureAudioCached,
  prefetchAudio,
} from '@/src/features/tasks/services/audio-cache';
import {
  getCachedLessonDictionary,
  setCachedLessonDictionary,
} from '@/src/features/tasks/services/lesson-dictionary-cache';
import {
  getTokenTranslationDisplay,
  shouldAllowVocabularyToggle,
  shouldRevealTokenTranslation,
} from '@/src/features/tasks/services/token-translation-display';
import { tokenizeLessonText } from '@/src/features/tasks/screens/task-runner-words';
import {
  getTokenSegmentIds,
} from '@/src/features/tasks/screens/task-runner-segments';
import {
  normalizeVocabularySelection,
  addSelectionToVocabulary,
} from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { pickArmenianTranslationText } from '@/src/features/vocabulary/services/translation-display';
import {
  getCachedVocabulary,
  mergeCachedVocabulary,
  removeCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import type {
  AppSettings,
  LearnerVocabularyItem,
  Lesson,
  LessonItem,
  ProgressEvent,
  ReadingModeId,
  ReadingModeSettings,
  VocabularyEntry,
} from '@/src/types/domain';

interface TaskRunnerScreenProps {
  lessonId: string;
}

type PlaybackRange = {
  startMs: number;
  endMs: number;
};

const TOKEN_WORD_FONT_SIZE = 18;
const TOKEN_WORD_LINE_HEIGHT = 24;
const TOKEN_WORD_HORIZONTAL_PADDING = 3;

const DEFAULT_READING_MODES: ReadingModeSettings[] = [
  { id: 'introduction', enabled: true, displayName: 'Introduction', order: 0 },
  {
    id: 'teaching',
    enabled: true,
    displayName: 'Teaching',
    order: 1,
    unknownWordRepetitions: 5,
  },
  {
    id: 'deep_learning',
    enabled: true,
    displayName: 'Deep Learning',
    order: 2,
    unknownWordRepetitions: 5,
    repeatSentenceWhenUnknownCountAtLeast: 2,
    sentenceRepetitions: 2,
  },
];

export function TaskRunnerScreen({ lessonId }: TaskRunnerScreenProps) {
  const router = useRouter();
  const { token, user } = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [completedItemIds, setCompletedItemIds] = useState<Record<string, true>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [vocabularyNotice, setVocabularyNotice] = useState<string | null>(null);
  const [vocabularyByText, setVocabularyByText] = useState<Record<string, LearnerVocabularyItem>>(
    {},
  );
  const [pendingWords, setPendingWords] = useState<Record<string, true>>({});
  const [unknownTaps, setUnknownTaps] = useState<Record<string, true>>({});
  const [entryCacheByText, setEntryCacheByText] = useState<Record<string, VocabularyEntry>>({});
  const [playableAudioUrl, setPlayableAudioUrl] = useState<string | null>(null);
  const [isAudioCaching, setIsAudioCaching] = useState(false);
  const [activeModeId, setActiveModeId] = useState<ReadingModeId | null>(null);
  const startedItemIdsRef = useRef<Set<string>>(new Set());
  const modePlaybackRunIdRef = useRef(0);
  const tokenPulseValuesRef = useRef(new Map<string, Animated.Value>());
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
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
    void Haptics.selectionAsync().catch(() => null);
  }, []);

  useEffect(() => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const seedFromCache = async () => {
      const cached = await getCachedLessonDictionary(lessonId);
      if (!cancelled && cached.length) {
        setEntryCacheByText(buildEntryCacheByText(cached));
      }
    };

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [lessonResponse, settingsResponse] = await Promise.all([
          apiClient.getLesson(token, lessonId),
          apiClient.getSettings(token),
        ]);
        if (cancelled) return;
        setLesson(lessonResponse.lesson);
        setAppSettings(settingsResponse.settings);
        const dictionary = lessonResponse.lesson.dictionary ?? [];
        if (dictionary.length) {
          setEntryCacheByText((prev) => ({ ...prev, ...buildEntryCacheByText(dictionary) }));
          void setCachedLessonDictionary(lessonId, dictionary);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load lesson.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    seedFromCache().catch(() => null);
    load().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [lessonId, token, user?.id]);

  useEffect(() => {
    if (!token || !user?.id) {
      setVocabularyByText({});
      return;
    }

    let cancelled = false;

    const loadVocabulary = async () => {
      const cached = await getCachedVocabulary(user.id);
      if (!cancelled) {
        setVocabularyByText(createVocabularyLookup(cached));
      }

      try {
        const response = await apiClient.getMyVocabulary(token);
        await mergeCachedVocabulary(user.id, response.vocabulary);
        if (!cancelled) {
          setVocabularyByText(createVocabularyLookup(response.vocabulary));
        }
      } catch {
        // Keep cached state if refresh fails.
      }
    };

    loadVocabulary().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (!user?.id || !lessonId) return;
    void setActiveLesson(user.id, lessonId);
  }, [lessonId, user?.id]);


  const items = useMemo(
    () => (lesson ? [...lesson.items].sort((left, right) => left.order - right.order) : []),
    [lesson],
  );

  const currentItem = items[currentItemIndex];
  const currentAudioUrl = useMemo(
    () => (currentItem?.audioUrl ? resolveApiAssetUrl(currentItem.audioUrl) : null),
    [currentItem?.audioUrl],
  );
  const player = useAudioPlayer(playableAudioUrl ?? undefined, { updateInterval: 200 });
  const playbackStatus = useAudioPlayerStatus(player);

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
    setVocabularyNotice(null);
    setUnknownTaps({});
    setActiveModeId(null);
    modePlaybackRunIdRef.current += 1;
    player.pause();
  }, [currentItemIndex, player]);

  useEffect(() => {
    if (!token) return;
    return () => {
      void flushProgressQueue({ force: true });
    };
  }, [token]);

  useEffect(() => {
    if (!currentAudioUrl) {
      setPlayableAudioUrl(null);
      setIsAudioCaching(false);
      return;
    }

    let cancelled = false;

    const cacheAudio = async () => {
      setPlayableAudioUrl(currentAudioUrl);
      setIsAudioCaching(true);

      const cachedUri = await ensureAudioCached(currentAudioUrl).catch(() => currentAudioUrl);
      if (!cancelled) {
        setPlayableAudioUrl(cachedUri);
        setIsAudioCaching(false);
      }

      const nextItem = items[currentItemIndex + 1];
      if (nextItem?.audioUrl) {
        void prefetchAudio(resolveApiAssetUrl(nextItem.audioUrl));
      }
    };

    cacheAudio().catch(() => {
      if (!cancelled) {
        setPlayableAudioUrl(currentAudioUrl);
        setIsAudioCaching(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentAudioUrl, currentItemIndex, items]);

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

  const segmentStartById = useMemo(() => {
    const result: Record<string, number> = {};
    for (const segment of currentItem?.segments ?? []) {
      result[segment.id] = segment.startMs;
    }
    return result;
  }, [currentItem]);

  const isPlaying = playbackStatus.playing;

  useEffect(() => {
    if (playbackStatus.didJustFinish) {
      setActiveModeId(null);
      modePlaybackRunIdRef.current += 1;
    }
  }, [playbackStatus.didJustFinish]);

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

  const getModeDisabledReason = useCallback(
    (modeId: ReadingModeId) => {
      if (!playableAudioUrl) {
        return 'This item does not have a playable audio source yet.';
      }
      if (modeId === 'teaching' && !currentItem?.wordTimings?.length) {
        return 'Teaching needs word timing ranges for this item.';
      }
      if (
        modeId === 'deep_learning' &&
        (!currentItem?.wordTimings?.length || !currentItem?.sentenceTimings?.length)
      ) {
        return 'Deep Learning needs word and sentence timing ranges for this item.';
      }
      return null;
    },
    [currentItem?.sentenceTimings?.length, currentItem?.wordTimings?.length, playableAudioUrl],
  );

  const runRangeScript = useCallback(
    async (ranges: PlaybackRange[], runId: number) => {
      for (const range of ranges) {
        if (modePlaybackRunIdRef.current !== runId) return;
        await player.seekTo(range.startMs / 1000);
        if (modePlaybackRunIdRef.current !== runId) return;
        player.play();
        await wait(range.endMs - range.startMs);
        if (modePlaybackRunIdRef.current !== runId) return;
      }
      player.pause();
      if (modePlaybackRunIdRef.current === runId) {
        setActiveModeId(null);
      }
    },
    [player],
  );

  const handleToggleReadingMode = useCallback(
    (mode: ReadingModeSettings) => {
      const disabledReason = getModeDisabledReason(mode.id);
      if (disabledReason) {
        setVocabularyNotice(disabledReason);
        return;
      }

      modePlaybackRunIdRef.current += 1;
      const runId = modePlaybackRunIdRef.current;

      if (activeModeId === mode.id) {
        player.pause();
        setActiveModeId(null);
        return;
      }

      setVocabularyNotice(null);
      setActiveModeId(mode.id);

      if (mode.id === 'introduction') {
        void player.seekTo(0).then(() => {
          if (modePlaybackRunIdRef.current !== runId) return;
          player.play();
        });
        return;
      }

      const ranges = currentItem
        ? buildReadingModeScript({
            currentItem,
            durationMs: Math.max(0, Math.round((playbackStatus.duration ?? 0) * 1000)),
            mode,
            unknownNormalizedWords,
          })
        : [];

      if (!ranges.length) {
        setVocabularyNotice('This mode needs timing ranges before it can play.');
        setActiveModeId(null);
        return;
      }

      void runRangeScript(ranges, runId);
    },
    [
      activeModeId,
      currentItem,
      getModeDisabledReason,
      playbackStatus.duration,
      player,
      runRangeScript,
      unknownNormalizedWords,
    ],
  );

  const handleSeekToSegment = useCallback(
    (startMs: number | null) => {
      if (!isPlaying || startMs === null) return;
      const startSeconds = startMs / 1000;
      void player.seekTo(startSeconds);
    },
    [isPlaying, player],
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

  const handleToggleWordVocabulary = useCallback(
    (rawWord: string, normalizedWord: string | null) => {
      if (!normalizedWord || !token || !user?.id) {
        return;
      }

      if (pendingWords[normalizedWord]) {
        return;
      }

      const existingItem = vocabularyByText[normalizedWord];

      if (existingItem) {
        setVocabularyByText((prev) => {
          const next = { ...prev };
          delete next[normalizedWord];
          return next;
        });
        setUnknownTaps((prev) => {
          const next = { ...prev };
          delete next[normalizedWord];
          return next;
        });
        setVocabularyNotice(`Removed "${existingItem.entry.englishText}" from vocabulary.`);

        void removeCachedVocabulary(user.id, existingItem.entryId).catch(() => null);
        void apiClient.removeVocabularyFromLearner(token, existingItem.entryId).catch((error) => {
          if (error instanceof ApiError && error.status === 404) return;
        });
        return;
      }

      const prefetched = entryCacheByText[normalizedWord];

      // Synchronous render-path state — runs in the same React event tick so
      // the translation row updates in the same frame as the tap.
      if (prefetched) {
        const nowIso = new Date().toISOString();
        const optimisticItem: LearnerVocabularyItem = {
          id: `optimistic:${prefetched.id}`,
          userId: user.id,
          entryId: prefetched.id,
          status: 'NEW',
          addedAt: nowIso,
          updatedAt: nowIso,
          entry: prefetched,
        };
        setVocabularyByText((prev) => ({ ...prev, [normalizedWord]: optimisticItem }));
        setUnknownTaps((prev) => ({ ...prev, [normalizedWord]: true }));
        const translation = pickArmenianTranslationText(prefetched.translations);
        setVocabularyNotice(
          translation
            ? `Marked "${prefetched.englishText}" as unknown. Translation: ${translation}`
            : `Marked "${prefetched.englishText}" as unknown. No Armenian translation yet.`,
        );
      } else {
        setUnknownTaps((prev) => ({ ...prev, [normalizedWord]: true }));
        setVocabularyNotice(`Marked "${rawWord}" as unknown. No translation available yet.`);
      }

      setPendingWords((prev) => ({ ...prev, [normalizedWord]: true }));

      // Async persistence — must not block render.
      void (async () => {
        try {
          if (prefetched) {
            const response = await apiClient.addVocabularyToLearner(token, prefetched.id);
            const added = response.vocabulary;
            const normalizedEntryKey = normalizeVocabularySelection(added.entry.englishText);
            setVocabularyByText((prev) => ({
              ...prev,
              ...(normalizedEntryKey ? { [normalizedEntryKey]: added } : {}),
            }));
            await mergeCachedVocabulary(user.id, [added]);
            return;
          }
          const result = await addSelectionToVocabulary(token, user.id, rawWord);
          if (!result.ok || !result.vocabulary) {
            throw new Error(result.message);
          }

          const addedVocabulary = result.vocabulary;
          const normalizedEntryKey = normalizeVocabularySelection(addedVocabulary.entry.englishText);
          setVocabularyByText((prev) => ({
            ...prev,
            ...(normalizedEntryKey ? { [normalizedEntryKey]: addedVocabulary } : {}),
          }));

        } catch (error) {
          setVocabularyByText((prev) => {
            if (!prev[normalizedWord]?.id.startsWith('optimistic:')) return prev;
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
          setUnknownTaps((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
          setVocabularyNotice(
            error instanceof Error
              ? error.message
              : 'Failed to update learner vocabulary for this word.',
          );
        } finally {
          setPendingWords((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
        }
      })();
    },
    [entryCacheByText, pendingWords, token, user?.id, vocabularyByText],
  );

  if (!token) {
    return (
      <ScreenContainer>
        <Pressable onPress={handleGoToDashboard} style={styles.dashboardLink}>
          <Ionicons name="chevron-back" size={18} color={brand[700]} />
          <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.meta}>Sign in to play lesson audio.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <Pressable onPress={handleGoToDashboard} style={styles.dashboardLink}>
          <Ionicons name="chevron-back" size={18} color={brand[700]} />
          <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
        </Pressable>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Preparing lesson...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error || !lesson || !currentItem) {
    return (
      <ScreenContainer>
        <Pressable onPress={handleGoToDashboard} style={styles.dashboardLink}>
          <Ionicons name="chevron-back" size={18} color={brand[700]} />
          <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Unable to load lesson player.'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const completion = calculateCompletion(completedItemIds, items.length);
  const durationSeconds = playbackStatus.duration ?? 0;
  const currentSeconds = playbackStatus.currentTime ?? 0;
  const audioSourceLabel = playableAudioUrl?.startsWith('file://') ? 'Cached' : 'Streaming';

  return (
    <ScreenContainer>
      <View style={styles.runnerLayout}>
        <View style={styles.audioDock}>
          {readingModes.map((mode) => {
            const disabledReason = getModeDisabledReason(mode.id);
            const isActive = activeModeId === mode.id && playbackStatus.playing;
            return (
              <Pressable
                key={mode.id}
                onPress={() => handleToggleReadingMode(mode)}
                disabled={Boolean(disabledReason)}
                accessibilityRole="button"
                accessibilityLabel={`${isActive ? 'Pause' : 'Play'} ${mode.displayName}`}
                style={({ pressed }) => [
                  styles.modeButton,
                  isActive && styles.modeButtonActive,
                  disabledReason && styles.audioIconButtonDisabled,
                  pressed && !disabledReason && styles.audioIconButtonPressed,
                ]}>
                <Ionicons
                  name={isActive ? 'pause' : 'play'}
                  size={16}
                  color={isActive ? neutral[0] : brand[700]}
                />
                <Text style={[styles.modeButtonText, isActive && styles.modeButtonTextActive]}>
                  {mode.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleGoToDashboard} style={styles.dashboardLink}>
            <Ionicons name="chevron-back" size={18} color={brand[700]} />
            <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>{lesson.title}</Text>
            <Text style={styles.progress}>{progressText}</Text>
          </View>
        </View>

        {/* Progress overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Lesson Progress</Text>
          <Text style={styles.overviewValue}>{completion}% complete</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
        </View>

        {/* Single unified content card (audioActions removed — now sticky above) */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.itemLabel}>Item {currentItemIndex + 1}</Text>
            <View style={styles.audioMetaRow}>
              <Text style={styles.audioMeta}>
                {isAudioCaching ? 'Caching…' : playableAudioUrl ? audioSourceLabel : 'No audio'}
              </Text>
              <Text style={styles.audioMeta}>
                {formatSeconds(currentSeconds)} / {formatSeconds(durationSeconds)}
              </Text>
            </View>
          </View>

          <View style={styles.wordFlow}>
            {wordTokens.map((tok, idx) => {
              const segmentId = tokenSegmentIds[idx];
              const isActiveSegment = segmentId !== null && segmentId === activeSegmentId;
              const segmentStartMs = segmentId ? segmentStartById[segmentId] ?? null : null;
              if (!tok.normalized) {
                return (
                  <Text
                    key={tok.key}
                    style={[styles.wordWhitespace, isActiveSegment && styles.tokenWordActive]}>
                    {tok.text}
                  </Text>
                );
              }
              const isSelected = Boolean(vocabularyByText[tok.normalized]);
              const isPending = Boolean(pendingWords[tok.normalized]);
              const normalizedWord = tok.normalized;
              const revealTranslation = shouldRevealTokenTranslation(
                Boolean(vocabularyByText[normalizedWord]),
                Boolean(unknownTaps[normalizedWord]),
              );
              const translationsForToken =
                vocabularyByText[normalizedWord]?.entry.translations
                ?? entryCacheByText[normalizedWord]?.translations
                ?? [];
              const tokenTranslation = getTokenTranslationDisplay(
                translationsForToken,
                revealTranslation,
              );
              const pulseValue = getTokenPulseValue(normalizedWord);
              const pulseScale = pulseValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.08, 1],
              });
              const pulseOpacity = pulseValue.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.98],
              });
              return (
                <Pressable
                  key={tok.key}
                  onPress={() => {
                    if (isPlaying) {
                      triggerTokenFeedback(normalizedWord);
                      handleSeekToSegment(segmentStartMs);
                      return;
                    }
                    if (
                      !shouldAllowVocabularyToggle(
                        Boolean(vocabularyByText[normalizedWord]),
                        translationsForToken.some(
                          (translation) => translation.languageCode.toLowerCase() === 'hy',
                        ),
                      )
                    ) {
                      return;
                    }
                    triggerTokenFeedback(normalizedWord);
                    void handleToggleWordVocabulary(tok.text, normalizedWord);
                  }}
                  disabled={isPlaying && segmentStartMs === null}
                  style={styles.tokenWrapper}>
                  <Animated.View
                    style={[
                      styles.tokenPulse,
                      {
                        opacity: pulseOpacity,
                        transform: [{ scale: pulseScale }],
                      },
                    ]}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.tokenTranslation,
                        !tokenTranslation.visible && styles.tokenTranslationHidden,
                      ]}>
                      {tokenTranslation.text}
                    </Text>
                    <Text
                      style={[
                        styles.tokenWord,
                        isActiveSegment && styles.tokenWordActive,
                        isSelected && styles.tokenWordSaved,
                        revealTranslation && !isSelected && styles.tokenWordUnknown,
                        isPending && styles.tokenWordPending,
                      ]}>
                      {tok.text}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>

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

function createVocabularyLookup(items: LearnerVocabularyItem[]) {
  return items.reduce<Record<string, LearnerVocabularyItem>>((acc, item) => {
    const normalized = normalizeVocabularySelection(item.entry.englishText);
    if (normalized) {
      acc[normalized] = item;
    }
    return acc;
  }, {});
}

function buildEntryCacheByText(entries: VocabularyEntry[]) {
  return entries.reduce<Record<string, VocabularyEntry>>((acc, entry) => {
    const normalized = normalizeVocabularySelection(entry.englishText);
    if (normalized) {
      acc[normalized] = entry;
    }
    return acc;
  }, {});
}

function calculateCompletion(completedItemIds: Record<string, true>, totalItems: number) {
  if (!totalItems) {
    return 0;
  }

  return Math.round((Object.keys(completedItemIds).length / totalItems) * 100);
}

function createIdempotencyKey(eventType: string, lessonId: string, lessonItemId?: string) {
  return `${eventType}:${lessonId}:${lessonItemId ?? 'lesson'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00';
  }

  const wholeSeconds = Math.floor(value);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(ms, 120));
  });
}

function buildReadingModeScript({
  currentItem,
  durationMs,
  mode,
  unknownNormalizedWords,
}: {
  currentItem: LessonItem;
  durationMs: number;
  mode: ReadingModeSettings;
  unknownNormalizedWords: Set<string>;
}): PlaybackRange[] {
  const timelineEndMs =
    durationMs > 0
      ? durationMs
      : Math.max(0, ...currentItem.segments.map((segment) => segment.endMs));
  const ranges: PlaybackRange[] = [];
  const unknownWordRanges = [...(currentItem.wordTimings ?? [])]
    .filter((mark) => unknownNormalizedWords.has(mark.normalizedText))
    .sort((left, right) => left.startMs - right.startMs);
  const wordRepeatCount = Math.max(1, mode.unknownWordRepetitions ?? 1);

  let cursorMs = 0;
  for (const mark of unknownWordRanges) {
    if (mark.startMs > cursorMs) {
      ranges.push({ startMs: cursorMs, endMs: mark.startMs });
    }
    for (let index = 0; index < wordRepeatCount; index += 1) {
      ranges.push({ startMs: mark.startMs, endMs: mark.endMs });
    }
    cursorMs = Math.max(cursorMs, mark.endMs);
  }

  if (timelineEndMs > cursorMs) {
    ranges.push({ startMs: cursorMs, endMs: timelineEndMs });
  }

  if (mode.id !== 'deep_learning') {
    return ranges.filter((range) => range.endMs > range.startMs);
  }

  const unknownWordIds = new Set(unknownWordRanges.map((mark) => mark.id));
  const threshold = Math.max(1, mode.repeatSentenceWhenUnknownCountAtLeast ?? 2);
  const sentenceRepeatCount = Math.max(1, mode.sentenceRepetitions ?? 2);
  const sentenceRepeats = [...(currentItem.sentenceTimings ?? [])]
    .filter(
      (sentence) =>
        sentence.wordMarkIds.filter((wordMarkId) => unknownWordIds.has(wordMarkId)).length >=
        threshold,
    )
    .sort((left, right) => left.startMs - right.startMs);

  for (const sentence of sentenceRepeats) {
    for (let index = 0; index < sentenceRepeatCount; index += 1) {
      ranges.push({ startMs: sentence.startMs, endMs: sentence.endMs });
    }
  }

  return ranges.filter((range) => range.endMs > range.startMs);
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  header: {
    gap: 8,
    marginBottom: 12,
  },
  dashboardLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 2,
  },
  dashboardLinkText: {
    color: brand[700],
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: text.primary,
    flex: 1,
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },
  progress: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  overviewCard: {
    backgroundColor: brand[50],
    borderColor: '#a5f3fc',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
    padding: 14,
  },
  overviewLabel: {
    color: '#155e75',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  overviewValue: {
    color: text.primary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  progressTrack: {
    backgroundColor: '#cffafe',
    borderRadius: radii.full,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0891b2',
    height: '100%',
  },
  // ── Unified content card ────────────────────────────────────────────────────
  card: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 14,
    marginBottom: 14,
    padding: 16,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  audioMetaRow: {
    alignItems: 'flex-end',
    gap: 2,
  },
  audioMeta: {
    color: text.secondary,
    fontSize: fontSize.sm,
    textAlign: 'right',
  },
  runnerLayout: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 18,
  },
  // ── Word flow ───────────────────────────────────────────────────────────────
  wordFlow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  /**
   * Whitespace tokens: align at the bottom edge so they sit flush with
   * the word text row inside tokenWrapper.
   */
  wordWhitespace: {
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    marginBottom: 4,
  },
  /**
   * Word token container: always has a fixed-height translation row on top
   * so adding/removing a translation never causes a layout shift.
   */
  tokenWrapper: {
    alignItems: 'center',
    marginBottom: 4,
  },
  tokenPulse: {
    alignItems: 'center',
  },
  tokenTranslation: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    height: 13,
    lineHeight: 13,
    textAlign: 'center',
  },
  tokenTranslationHidden: {
    opacity: 0,
  },
  tokenWord: {
    borderRadius: radii.sm,
    color: text.primary,
    fontSize: TOKEN_WORD_FONT_SIZE,
    lineHeight: TOKEN_WORD_LINE_HEIGHT,
    paddingHorizontal: TOKEN_WORD_HORIZONTAL_PADDING,
  },
  tokenWordActive: {
    backgroundColor: '#dbeafe',
  },
  /** Word saved to vocabulary. */
  tokenWordSaved: {
    color: '#1d4ed8',
  },
  /** Word marked unknown for the current lesson. */
  tokenWordUnknown: {
    color: '#c2410c',
  },
  /** Vocabulary toggle in-flight. */
  tokenWordPending: {
    color: '#b45309',
  },
  // ── Audio controls ──────────────────────────────────────────────────────────
  audioDock: {
    backgroundColor: surface.page,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 10,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: brand[50],
    borderColor: border.active,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: brand[700],
    borderColor: brand[700],
  },
  modeButtonText: {
    color: brand[700],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  modeButtonTextActive: {
    color: neutral[0],
  },
  audioIconButton: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii.full,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  audioIconButtonSecondary: {
    alignItems: 'center',
    backgroundColor: brand[50],
    borderColor: border.active,
    borderRadius: radii.full,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  audioIconButtonDisabled: {
    opacity: 0.45,
  },
  audioIconButtonPressed: {
    opacity: 0.85,
  },
  notice: {
    color: text.brand,
    fontSize: fontSize.base,
  },
  syncError: {
    color: text.warning,
    fontSize: fontSize.base,
    marginBottom: 12,
  },
  navigationRow: {
    gap: 10,
    marginBottom: 18,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.base,
  },
  error: {
    color: text.error,
    textAlign: 'center',
  },
});
