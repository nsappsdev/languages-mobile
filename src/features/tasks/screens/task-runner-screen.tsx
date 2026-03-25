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
          <Ionicons name="chevron-back" size={18} color="#0f766e" />
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
          <Ionicons name="chevron-back" size={18} color="#0f766e" />
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
          <Ionicons name="chevron-back" size={18} color="#0f766e" />
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
  const audioSourceLabel = playableAudioUrl?.startsWith('file://') ? 'Cached on device' : 'Streaming';

  return (
    <ScreenContainer scroll>
      <View>
        <View style={styles.header}>
          <Pressable onPress={handleGoToDashboard} style={styles.dashboardLink}>
            <Ionicons name="chevron-back" size={18} color="#0f766e" />
            <Text style={styles.dashboardLinkText}>Back to Dashboard</Text>
          </Pressable>
          <View style={styles.headerTitleRow}>
            <Text style={styles.title}>{lesson.title}</Text>
            <Text style={styles.progress}>{progressText}</Text>
          </View>
        </View>

        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Lesson Progress</Text>
          <Text style={styles.overviewValue}>{completion}% complete</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.itemLabel}>Item {currentItemIndex + 1}</Text>
          {currentItem.segments.length ? (
            <View style={styles.segmentInlineWrap}>
              {currentItem.segments.map((segment) => {
                const isActive = segment.id === activeSegmentId;
                return (
                  <View
                    key={segment.id}
                    style={[styles.segmentInlineChip, isActive && styles.segmentInlineChipActive]}>
                    <Text style={[styles.segmentInlineText, isActive && styles.segmentInlineTextActive]}>
                      {segment.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.itemText}>{currentItem.text}</Text>
          )}

          <View style={styles.audioMetaRow}>
            <Text style={styles.audioMeta}>
              {isAudioCaching ? 'Caching audio…' : playableAudioUrl ? audioSourceLabel : 'No audio'}
            </Text>
            <Text style={styles.audioMeta}>
              {formatSeconds(currentSeconds)} / {formatSeconds(durationSeconds)}
            </Text>
          </View>

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
                color="#ffffff"
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
              <Ionicons name="refresh" size={22} color="#0f766e" />
            </Pressable>
          </View>
        </View>

        <View style={styles.selectionCard}>
          <Text style={styles.sectionTitle}>Tap Words To Save Or Remove</Text>
          <Text style={styles.sectionMeta}>
            Tap a word once to add it to learner vocabulary. Tap it again to remove it.
          </Text>

          <View style={styles.wordFlow}>
            {wordTokens.map((token) => {
              if (!token.normalized) {
                return (
                  <Text key={token.key} style={styles.wordWhitespace}>
                    {token.text}
                  </Text>
                );
              }

              const isSelected = Boolean(vocabularyByText[token.normalized]);
              const isPending = Boolean(pendingWords[token.normalized]);
              const selectedEntry = vocabularyByText[token.normalized];
              const armenianTranslation =
                selectedEntry?.entry.translations.find(
                  (translation) => translation.languageCode === 'am',
                )?.translation ?? null;
              const showSelectedTranslation = Boolean(armenianTranslation);

              return (
                <Pressable
                  key={token.key}
                  onPress={() => {
                    void handleToggleWordVocabulary(token.text, token.normalized);
                  }}
                  style={[
                    styles.wordTokenPressable,
                    showSelectedTranslation && styles.wordTokenStack,
                    !showSelectedTranslation && isSelected && styles.wordTokenInlineSelected,
                    !showSelectedTranslation && isPending && styles.wordTokenInlinePending,
                  ]}>
                  {showSelectedTranslation ? (
                    <Text
                      adjustsFontSizeToFit
                      ellipsizeMode="tail"
                      minimumFontScale={0.8}
                      numberOfLines={1}
                      style={styles.wordTokenTranslation}>
                      {armenianTranslation}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.wordTokenText,
                      !showSelectedTranslation && styles.wordTokenPlainText,
                      showSelectedTranslation && styles.wordTokenTextSelected,
                      isSelected && !showSelectedTranslation && styles.wordTokenTextSelected,
                      isPending && styles.wordTokenTextPending,
                    ]}>
                    {token.text}
                  </Text>
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
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
  },
  progress: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
  },
  overviewCard: {
    backgroundColor: '#ecfeff',
    borderColor: '#a5f3fc',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
    padding: 14,
  },
  overviewLabel: {
    color: '#155e75',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  overviewValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: '#cffafe',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#0891b2',
    height: '100%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 16,
  },
  itemLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemText: {
    color: '#0f172a',
    fontSize: 18,
    lineHeight: 28,
  },
  segmentInlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentInlineChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentInlineChipActive: {
    backgroundColor: '#0f766e',
  },
  segmentInlineText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  segmentInlineTextActive: {
    color: '#ffffff',
  },
  audioMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  audioMeta: {
    color: '#475569',
    fontSize: 13,
  },
  audioActions: {
    flexDirection: 'row',
    gap: 12,
  },
  audioIconButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  audioIconButtonSecondary: {
    alignItems: 'center',
    backgroundColor: '#ecfeff',
    borderColor: '#99f6e4',
    borderRadius: 999,
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
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  selectionCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 16,
  },
  wordFlow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordWhitespace: {
    color: '#0f172a',
    fontSize: 18,
    lineHeight: 28,
  },
  wordTokenPressable: {
    marginBottom: 4,
  },
  wordTokenStack: {
    alignItems: 'center',
    gap: 1,
    marginHorizontal: 1,
    maxWidth: 132,
  },
  wordTokenInlineSelected: {
    borderRadius: 6,
    color: '#0f766e',
    paddingHorizontal: 2,
  },
  wordTokenInlinePending: {
    borderRadius: 6,
    color: '#b45309',
    paddingHorizontal: 2,
  },
  wordTokenTranslation: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    maxWidth: '100%',
    textAlign: 'center',
  },
  wordTokenText: {
    color: '#0f172a',
    fontSize: 18,
    lineHeight: 24,
  },
  wordTokenPlainText: {
    lineHeight: 28,
  },
  wordTokenTextSelected: {
    color: '#0f766e',
  },
  wordTokenTextPending: {
    color: '#b45309',
  },
  notice: {
    color: '#0f766e',
    fontSize: 13,
  },
  syncError: {
    color: '#b45309',
    fontSize: 13,
    marginBottom: 12,
  },
  navigationRow: {
    gap: 10,
    marginBottom: 18,
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
});
