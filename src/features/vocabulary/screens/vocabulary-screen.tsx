import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sortLessonsByLevelOrder } from '@/src/features/lessons/lesson-locking';
import {
  buildLessonVocabularySections,
  type LessonVocabularySection,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  getCachedVocabulary,
  setCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';
import type {
  LearnerVocabularyItem,
  LearnerVocabularyStatus,
  Lesson,
} from '@/src/types/domain';

const REVIEW_SWIPE_THRESHOLD = 90;

export function VocabularyScreen() {
  const { token, user } = useSession();
  const [items, setItems] = useState<LearnerVocabularyItem[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReviewSectionId, setActiveReviewSectionId] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewMeta, setReviewMeta] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const reviewCardPosition = useRef(new Animated.ValueXY()).current;

  const fetchVocabulary = useCallback(
    async (isRefresh = false) => {
      if (!token || !user?.id) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      setSyncMeta(null);
      try {
        const [vocabularyResponse, lessonsResponse] = await Promise.all([
          apiClient.getMyVocabulary(token),
          apiClient.getLessons(token),
        ]);
        const sortedLessons = [...lessonsResponse.lessons].sort(sortLessonsByLevelOrder);
        setItems(vocabularyResponse.vocabulary);
        setLessons(sortedLessons);
        await setCachedVocabulary(user.id, vocabularyResponse.vocabulary);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return;
        }

        const cached = await getCachedVocabulary(user.id);
        if (cached.length > 0) {
          setItems(cached);
          setSyncMeta('Showing last synced vocabulary snapshot.');
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load vocabulary.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, user?.id],
  );

  useEffect(() => {
    if (!token || !user?.id) {
      setItems([]);
      setLessons([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const bootstrap = async () => {
      setIsLoading(true);
      const cached = await getCachedVocabulary(user.id);
      if (isMounted && cached.length > 0) {
        setItems(cached);
        setSyncMeta('Showing last synced vocabulary snapshot.');
        setIsLoading(false);
      }

      await fetchVocabulary();
    };

    bootstrap().catch(() => null);

    return () => {
      isMounted = false;
    };
  }, [fetchVocabulary, token, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchVocabulary(true).catch(() => null);
      return undefined;
    }, [fetchVocabulary]),
  );

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status !== 'MASTERED') {
          acc.total += 1;
        }
        acc[item.status] += 1;
        return acc;
      },
      {
        total: 0,
        NEW: 0,
        REVIEWING: 0,
        MASTERED: 0,
      },
    );
  }, [items]);

  const activeItems = useMemo(
    () => items.filter((item) => item.status !== 'MASTERED'),
    [items],
  );

  const allSections = useMemo(
    () => buildLessonVocabularySections(lessons, activeItems),
    [activeItems, lessons],
  );
  const filteredSections = useMemo(
    () => buildLessonVocabularySections(lessons, activeItems, searchQuery),
    [activeItems, lessons, searchQuery],
  );

  const activeReviewSection = useMemo(
    () => allSections.find((section) => section.id === activeReviewSectionId) ?? null,
    [activeReviewSectionId, allSections],
  );
  const activeReviewItem = activeReviewSection?.items[reviewIndex] ?? null;

  useEffect(() => {
    if (!activeReviewSection) {
      return;
    }

    if (activeReviewSection.items.length === 0) {
      setActiveReviewSectionId(null);
      setReviewIndex(0);
      setReviewMeta(null);
      return;
    }

    if (reviewIndex > activeReviewSection.items.length - 1) {
      setReviewIndex(Math.max(activeReviewSection.items.length - 1, 0));
    }
  }, [activeReviewSection, reviewIndex]);

  const animateCardBack = useCallback(() => {
    Animated.spring(reviewCardPosition, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  }, [reviewCardPosition]);

  const handleReviewDecision = useCallback(
    async (status: LearnerVocabularyStatus, direction: -1 | 1) => {
      if (!token || !user?.id || !activeReviewItem || !activeReviewSection || isSubmittingReview) {
        animateCardBack();
        return;
      }

      setIsSubmittingReview(true);
      setReviewMeta(null);

      try {
        const response = await apiClient.updateVocabularyStatus(
          token,
          activeReviewItem.entryId,
          status,
        );

        const nextItems = items.map((item) =>
          item.id === response.vocabulary.id ? response.vocabulary : item,
        );
        setItems(nextItems);
        await setCachedVocabulary(user.id, nextItems);

        const isLastCard = reviewIndex >= activeReviewSection.items.length - 1;
        Animated.timing(reviewCardPosition, {
          toValue: { x: direction * 420, y: 0 },
          duration: 160,
          useNativeDriver: true,
        }).start(() => {
          reviewCardPosition.setValue({ x: 0, y: 0 });
          setIsSubmittingReview(false);
          setReviewMeta(
            status === 'MASTERED'
              ? `"${response.vocabulary.entry.englishText}" marked as learned and removed from active vocabulary.`
              : `"${response.vocabulary.entry.englishText}" marked for more review.`
          );

          if (isLastCard) {
            setActiveReviewSectionId(null);
            setReviewIndex(0);
            return;
          }

          setReviewIndex((prev) => prev + 1);
        });
      } catch (err) {
        setIsSubmittingReview(false);
        animateCardBack();
        if (err instanceof ApiError) {
          setReviewMeta(err.message);
        } else if (err instanceof Error) {
          setReviewMeta(err.message);
        } else {
          setReviewMeta('Failed to update this vocabulary status.');
        }
      }
    },
    [
      activeReviewItem,
      activeReviewSection,
      animateCardBack,
      isSubmittingReview,
      items,
      reviewCardPosition,
      reviewIndex,
      token,
      user?.id,
    ],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Boolean(activeReviewItem) &&
          !isSubmittingReview &&
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: Animated.event([null, { dx: reviewCardPosition.x }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx >= REVIEW_SWIPE_THRESHOLD) {
            void handleReviewDecision('MASTERED', 1);
            return;
          }

          if (gestureState.dx <= -REVIEW_SWIPE_THRESHOLD) {
            void handleReviewDecision('REVIEWING', -1);
            return;
          }

          animateCardBack();
        },
        onPanResponderTerminate: animateCardBack,
      }),
    [activeReviewItem, animateCardBack, handleReviewDecision, isSubmittingReview, reviewCardPosition.x],
  );

  const handleStartReview = useCallback((section: LessonVocabularySection) => {
    setActiveReviewSectionId(section.id);
    setReviewIndex(0);
    setReviewMeta(null);
    setSearchQuery('');
    reviewCardPosition.setValue({ x: 0, y: 0 });
  }, [reviewCardPosition]);

  if (!token || !user?.id) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.meta}>Sign in to view vocabulary.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Loading vocabulary...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          {syncMeta ? <Text style={styles.meta}>{syncMeta}</Text> : null}
          <Pressable onPress={() => fetchVocabulary().catch(() => null)} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (activeReviewSection && activeReviewItem) {
    const progressText = `${reviewIndex + 1} / ${activeReviewSection.items.length}`;
    const rotate = reviewCardPosition.x.interpolate({
      inputRange: [-180, 0, 180],
      outputRange: ['-9deg', '0deg', '9deg'],
      extrapolate: 'clamp',
    });

    return (
      <ScreenContainer>
        <View style={styles.reviewHeader}>
          <Pressable
            onPress={() => {
              setActiveReviewSectionId(null);
              setReviewIndex(0);
              setReviewMeta(null);
              reviewCardPosition.setValue({ x: 0, y: 0 });
            }}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to dictionary</Text>
          </Pressable>
          <Text style={styles.reviewLessonTitle}>{activeReviewSection.title}</Text>
          <Text style={styles.reviewProgress}>{progressText}</Text>
        </View>

        <View style={styles.reviewHintRow}>
          <Text style={styles.reviewHintLeft}>Swipe left: I don&apos;t remember</Text>
          <Text style={styles.reviewHintRight}>Swipe right: Learned</Text>
        </View>

        <View style={styles.reviewDeck}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.reviewCard,
              {
                transform: [
                  { translateX: reviewCardPosition.x },
                  { translateY: reviewCardPosition.y },
                  { rotate },
                ],
              },
            ]}>
            <Text style={styles.reviewEnglish}>{activeReviewItem.entry.englishText}</Text>
            <Text style={styles.reviewMetaText}>
              Do you remember the translation? Swipe right if yes, left if no.
            </Text>
            {isSubmittingReview ? <ActivityIndicator size="small" color="#0f766e" /> : null}
          </Animated.View>
        </View>

        <View style={styles.reviewButtonsRow}>
          <Pressable
            disabled={isSubmittingReview}
            onPress={() => {
              void handleReviewDecision('REVIEWING', -1);
            }}
            style={[styles.reviewActionButton, styles.reviewActionButtonLeft]}>
            <Text style={styles.reviewActionTextLeft}>I don&apos;t remember</Text>
          </Pressable>
          <Pressable
            disabled={isSubmittingReview}
            onPress={() => {
              void handleReviewDecision('MASTERED', 1);
            }}
            style={[styles.reviewActionButton, styles.reviewActionButtonRight]}>
            <Text style={styles.reviewActionTextRight}>Learned</Text>
          </Pressable>
        </View>

        {reviewMeta ? <Text style={styles.syncMeta}>{reviewMeta}</Text> : null}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>My Vocabulary</Text>
        <Text style={styles.meta}>
          Saved words are grouped by lesson topic. Open a lesson section or start Check to review
          words with swipe gestures.
        </Text>
        <Text style={styles.meta}>
          Learned words leave the active vocabulary list automatically after you swipe them right.
        </Text>
        {syncMeta ? <Text style={styles.syncMeta}>{syncMeta}</Text> : null}
        {reviewMeta ? <Text style={styles.syncMeta}>{reviewMeta}</Text> : null}
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="New" value={summary.NEW} />
        <SummaryCard label="Reviewing" value={summary.REVIEWING} />
        <SummaryCard label="Learned" value={summary.MASTERED} />
      </View>

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search English or Armenian"
        placeholderTextColor={neutral[400]}
        style={styles.searchInput}
      />

      <FlatList
        data={filteredSections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                <Text style={styles.sectionMeta}>
                  {item.items.length} saved {item.items.length === 1 ? 'word' : 'words'}
                </Text>
              </View>
              <Pressable
                onPress={() => handleStartReview(item)}
                disabled={item.items.length === 0}
                style={({ pressed }) => [
                  styles.checkButton,
                  pressed && item.items.length > 0 && styles.checkButtonPressed,
                ]}>
                <Text style={styles.checkButtonText}>Check</Text>
              </Pressable>
            </View>

            {item.description ? <Text style={styles.sectionDescription}>{item.description}</Text> : null}

            <View style={styles.sectionEntries}>
              {item.items.slice(0, 6).map((entry) => {
                const translation =
                  entry.entry.translations.find((itemTranslation) => itemTranslation.languageCode === 'am')
                    ?.translation ?? 'No Armenian translation yet.';

                return (
                  <View key={entry.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.word}>{entry.entry.englishText}</Text>
                      </View>
                      <View style={styles.cardDivider} />
                      <View style={styles.cardRight}>
                        <Text style={styles.translationPrimary}>{translation}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {item.items.length > 6 ? (
              <Text style={styles.moreMeta}>+{item.items.length - 6} more in this lesson</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No matches for this search.' : 'No saved vocabulary yet.'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? 'Try another English or Armenian search term.'
                : 'Add vocabulary from lesson text selection to build lesson sections here.'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchVocabulary(true).catch(() => null);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: text.primary,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.md,
  },
  error: {
    color: text.error,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: brand[700],
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: neutral[0],
    fontWeight: fontWeight.semibold,
  },
  syncMeta: {
    color: text.brand,
    fontSize: fontSize.sm,
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: text.primary,
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  summaryValue: {
    color: text.brand,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  summaryLabel: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  sectionMeta: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sectionDescription: {
    color: text.secondary,
    fontSize: fontSize.base,
    lineHeight: 18,
  },
  checkButton: {
    backgroundColor: brand[700],
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  checkButtonPressed: {
    opacity: 0.85,
  },
  checkButtonText: {
    color: neutral[0],
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  sectionEntries: {
    gap: 8,
  },
  card: {
    backgroundColor: surface.page,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardDivider: {
    backgroundColor: '#dbeafe',
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 4,
  },
  cardRight: {
    flex: 1,
    paddingLeft: 10,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  word: {
    color: text.primary,
    fontSize: 17,
    fontWeight: fontWeight.bold,
  },
  status: {
    backgroundColor: surface.active,
    borderRadius: radii.full,
    color: brand[800],
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  translationPrimary: {
    color: text.brand,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  moreMeta: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  emptyText: {
    color: text.secondary,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  reviewHeader: {
    gap: 6,
    marginBottom: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backButtonText: {
    color: text.brand,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  reviewLessonTitle: {
    color: text.primary,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
  },
  reviewProgress: {
    color: text.muted,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  reviewHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  reviewHintLeft: {
    color: text.warning,
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  reviewHintRight: {
    color: text.brand,
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  reviewDeck: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginBottom: 20,
  },
  reviewCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['3xl'],
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  reviewArmenian: {
    color: text.brand,
    fontSize: fontSize['4xl'],
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewEnglish: {
    color: text.primary,
    fontSize: fontSize['5xl'],
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewStatus: {
    color: text.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  reviewMetaText: {
    color: text.secondary,
    fontSize: fontSize.base,
    lineHeight: 18,
    textAlign: 'center',
  },
  reviewButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewActionButton: {
    borderRadius: radii.xl,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  reviewActionButtonLeft: {
    backgroundColor: '#fff7ed',
    borderColor: border.warning,
    borderWidth: 1,
  },
  reviewActionButtonRight: {
    backgroundColor: surface.active,
    borderColor: border.active,
    borderWidth: 1,
  },
  reviewActionTextLeft: {
    color: text.warning,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  reviewActionTextRight: {
    color: text.brand,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
});
