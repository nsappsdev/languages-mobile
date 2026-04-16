import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { resolveApiAssetUrl } from '@/src/config/env';
import { getLessonAccess } from '@/src/features/lessons/lesson-locking';
import {
  markLessonCompleted,
  setActiveLesson,
} from '@/src/features/lessons/progression-storage';
import { flushProgressQueue, queueProgressEvents } from '@/src/features/progress/progress-sync';
import {
  ensureAudioCached,
  prefetchAudio,
} from '@/src/features/tasks/services/audio-cache';
import { tokenizeLessonText } from '@/src/features/tasks/screens/task-runner-words';
import {
  addSelectionToVocabulary,
  normalizeVocabularySelection,
} from '@/src/features/vocabulary/services/add-word-to-vocabulary';
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
import type { LearnerVocabularyItem, Lesson, ProgressEvent } from '@/src/types/domain';

interface TaskRunnerScreenProps {
  lessonId: string;
}

export function TaskRunnerScreen({ lessonId }: TaskRunnerScreenProps) {
  const router = useRouter();
  const { token, user } = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
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
  const [playableAudioUrl, setPlayableAudioUrl] = useState<string | null>(null);
  const [isAudioCaching, setIsAudioCaching] = useState(false);
  const startedItemIdsRef = useRef<Set<string>>(new Set());
  const handleGoToDashboard = useCallback(() => {
    router.replace('/(tabs)/lessons');
  }, [router]);

  useEffect(() => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (user?.id) {
          const access = await getLessonAccess(token, user.id, lessonId);
          if (!access.allowed) {
            setError(access.message ?? 'Lesson is locked.');
            setLesson(null);
            return;
          }
        }

        const response = await apiClient.getLesson(token, lessonId);
        setLesson(response.lesson);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load lesson.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    load().catch(() => null);
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

  useEffect(() => {
    setVocabularyNotice(null);
  }, [currentItemIndex]);

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

  /**
   * Maps each word token index → the segment ID it belongs to (by character
   * offset in the full item text), or null if the token is not in any segment.
   */
  const tokenSegmentIds = useMemo((): (string | null)[] => {
    if (!currentItem || !currentItem.segments.length) {
      return wordTokens.map(() => null);
    }
    const fullText = currentItem.text;
    const segments = currentItem.segments;
    const result: (string | null)[] = [];
    let charPos = 0;

    for (const tok of wordTokens) {
      const start = charPos;
      const end = start + tok.text.length;
      charPos = end;

      if (!tok.normalized) {
        result.push(null);
        continue;
      }

      let found: string | null = null;
      for (const seg of segments) {
        const segStart = fullText.indexOf(seg.text);
        if (segStart !== -1 && start >= segStart && end <= segStart + seg.text.length) {
          found = seg.id;
          break;
        }
      }
      result.push(found);
    }

    return result;
  }, [currentItem, wordTokens]);

  const startPlayback = useCallback(async () => {
    const duration = playbackStatus.duration ?? 0;
    const currentTime = playbackStatus.currentTime ?? 0;
    const didReachEnd =
      playbackStatus.didJustFinish ||
      (duration > 0 && currentTime >= Math.max(duration - 0.05, 0));

    if (didReachEnd) {
      await player.seekTo(0);
    }

    player.play();
  }, [playbackStatus.currentTime, playbackStatus.didJustFinish, playbackStatus.duration, player]);

  const handleTogglePlayback = useCallback(() => {
    if (!playableAudioUrl) {
      setVocabularyNotice('This item does not have a playable audio source yet.');
      return;
    }

    setVocabularyNotice(null);
    if (playbackStatus.playing) {
      player.pause();
      return;
    }

    void startPlayback();
  }, [playableAudioUrl, playbackStatus.playing, player, startPlayback]);

  const handleReplay = useCallback(() => {
    if (!playableAudioUrl) {
      return;
    }

    setVocabularyNotice(null);
    void player.seekTo(0).then(() => {
      player.play();
    });
  }, [playableAudioUrl, player]);

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
    async (rawWord: string, normalizedWord: string | null) => {
      if (!normalizedWord || !token || !user?.id) {
        return;
      }

      if (pendingWords[normalizedWord]) {
        return;
      }

      setPendingWords((prev) => ({ ...prev, [normalizedWord]: true }));
      try {
        const existingItem = vocabularyByText[normalizedWord];

        if (existingItem) {
          try {
            await apiClient.removeVocabularyFromLearner(token, existingItem.entryId);
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 404) {
              throw error;
            }
          }

          await removeCachedVocabulary(user.id, existingItem.entryId);
          setVocabularyByText((prev) => {
            const next = { ...prev };
            delete next[normalizedWord];
            return next;
          });
          setVocabularyNotice(`Removed "${existingItem.entry.englishText}" from vocabulary.`);
          return;
        }

        const result = await addSelectionToVocabulary(token, user.id, rawWord);
        if (result.ok && result.vocabulary) {
          const addedVocabulary = result.vocabulary;
          const normalizedEntryKey = normalizeVocabularySelection(addedVocabulary.entry.englishText);
          setVocabularyByText((prev) => ({
            ...prev,
            ...(normalizedEntryKey ? { [normalizedEntryKey]: addedVocabulary } : {}),
          }));
        }
        setVocabularyNotice(result.message);
      } catch (error) {
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
    },
    [pendingWords, token, user?.id, vocabularyByText],
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
    <ScreenContainer scroll>
      <View>
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

        {/* Single unified content card */}
        <View style={styles.card}>
          {/* Card top row: item label + audio status + time */}
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

          {/* Word flow — every word token reserves a fixed-height translation row
              so showing/hiding translations never causes a layout shift */}
          <View style={styles.wordFlow}>
            {wordTokens.map((tok, idx) => {
              if (!tok.normalized) {
                // Whitespace — not tappable, no translation row needed
                return (
                  <Text key={tok.key} style={styles.wordWhitespace}>
                    {tok.text}
                  </Text>
                );
              }

              const isInActiveSegment =
                activeSegmentId !== null && tokenSegmentIds[idx] === activeSegmentId;
              const isSelected = Boolean(vocabularyByText[tok.normalized]);
              const isPending = Boolean(pendingWords[tok.normalized]);
              const armenianTranslation =
                vocabularyByText[tok.normalized]?.entry.translations.find(
                  (t) => t.languageCode === 'am',
                )?.translation ?? null;

              return (
                <Pressable
                  key={tok.key}
                  onPress={() => void handleToggleWordVocabulary(tok.text, tok.normalized)}
                  style={styles.tokenWrapper}>
                  {/* Translation row — always present at fixed height; invisible when empty */}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tokenTranslation,
                      !armenianTranslation && styles.tokenTranslationHidden,
                    ]}>
                    {armenianTranslation ?? '\u00A0'}
                  </Text>
                  {/* Word — background changes on active segment; color changes on saved/pending */}
                  <Text
                    style={[
                      styles.tokenWord,
                      isInActiveSegment && styles.tokenWordActive,
                      isSelected && styles.tokenWordSaved,
                      isPending && styles.tokenWordPending,
                    ]}>
                    {tok.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {vocabularyNotice ? (
            <Text style={styles.notice}>{vocabularyNotice}</Text>
          ) : null}

          {/* Audio controls */}
          <View style={styles.audioActions}>
            <Pressable
              onPress={handleTogglePlayback}
              disabled={!playableAudioUrl}
              accessibilityRole="button"
              accessibilityLabel={playbackStatus.playing ? 'Pause audio' : 'Play audio'}
              style={({ pressed }) => [
                styles.audioIconButton,
                !playableAudioUrl && styles.audioIconButtonDisabled,
                pressed && playableAudioUrl && styles.audioIconButtonPressed,
              ]}>
              <Ionicons
                name={playbackStatus.playing ? 'pause' : 'play'}
                size={24}
                color={neutral[0]}
              />
            </Pressable>
            <Pressable
              onPress={handleReplay}
              disabled={!playableAudioUrl}
              accessibilityRole="button"
              accessibilityLabel="Replay audio"
              style={({ pressed }) => [
                styles.audioIconButtonSecondary,
                !playableAudioUrl && styles.audioIconButtonDisabled,
                pressed && playableAudioUrl && styles.audioIconButtonPressed,
              ]}>
              <Ionicons name="refresh" size={22} color={brand[700]} />
            </Pressable>
          </View>
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
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
  /**
   * Word token container: always has a fixed-height translation row on top
   * so adding/removing a translation never causes a layout shift.
   */
  tokenWrapper: {
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: 1,
  },
  /** Fixed height = always reserves space; opacity 0 hides it when empty. */
  tokenTranslation: {
    color: brand[700],
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
    fontSize: 18,
    lineHeight: 24,
    overflow: 'hidden',
    paddingHorizontal: 3,
  },
  /** Active segment: teal background tint — no size change. */
  tokenWordActive: {
    backgroundColor: brand[50],
    color: brand[800],
  },
  /** Word saved to vocabulary. */
  tokenWordSaved: {
    color: text.brand,
  },
  /** Vocabulary toggle in-flight. */
  tokenWordPending: {
    color: text.warning,
  },
  // ── Audio controls ──────────────────────────────────────────────────────────
  audioActions: {
    flexDirection: 'row',
    gap: 12,
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
