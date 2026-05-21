import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';
import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  applyVocabularyReviewStatus,
} from '@/src/features/vocabulary/services/vocabulary-screen-helpers';
import { setCachedVocabulary } from '@/src/features/vocabulary/services/vocabulary-sync';
import {
  flushVocabularyStatusQueue,
  queueVocabularyStatusUpdate,
} from '@/src/features/vocabulary/services/vocabulary-status-sync';
import type { LearnerVocabularyItem, LearnerVocabularyStatus } from '@/src/types/domain';

const REVIEW_SWIPE_THRESHOLD = 90;

export function useVocabularyReview({
  items,
  setItems,
  setSearchQuery,
  setSyncMeta,
  token,
  userId,
}: {
  items: LearnerVocabularyItem[];
  setItems: (items: LearnerVocabularyItem[]) => void;
  setSearchQuery: (query: string) => void;
  setSyncMeta: (message: string | null) => void;
  token: string | null;
  userId: string | undefined;
}) {
  const [activeReviewSection, setActiveReviewSection] =
    useState<LessonVocabularySection | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewMeta, setReviewMeta] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const reviewCardPosition = useRef(new Animated.ValueXY()).current;

  const activeReviewItem = activeReviewSection?.items[reviewIndex] ?? null;

  useEffect(() => {
    if (!activeReviewSection) {
      return;
    }

    if (activeReviewSection.items.length === 0) {
      setActiveReviewSection(null);
      setReviewIndex(0);
      setReviewMeta(null);
      return;
    }

    if (reviewIndex > activeReviewSection.items.length - 1) {
      setActiveReviewSection(null);
      setReviewIndex(0);
      setReviewMeta(null);
    }
  }, [activeReviewSection, reviewIndex]);

  const animateCardBack = useCallback(() => {
    Animated.spring(reviewCardPosition, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  }, [reviewCardPosition]);

  const stopReview = useCallback(() => {
    setActiveReviewSection(null);
    setReviewIndex(0);
    setReviewMeta(null);
    reviewCardPosition.setValue({ x: 0, y: 0 });
  }, [reviewCardPosition]);

  const handleReviewDecision = useCallback(
    (status: LearnerVocabularyStatus, direction: -1 | 1) => {
      if (!token || !userId || !activeReviewItem || !activeReviewSection || isSubmittingReview) {
        animateCardBack();
        return;
      }

      const targetEntryId = activeReviewItem.entryId;
      const targetEnglishText = activeReviewItem.entry.englishText;

      setIsSubmittingReview(true);
      setReviewMeta(null);

      const nowIso = new Date().toISOString();
      const nextItems = applyVocabularyReviewStatus({
        entryId: targetEntryId,
        items,
        status,
        updatedAt: nowIso,
      });
      setItems(nextItems);
      void setCachedVocabulary(userId, nextItems).catch(() => null);

      void (async () => {
        const queueResult = await queueVocabularyStatusUpdate({ entryId: targetEntryId, status });
        if (!queueResult.ok) {
          setSyncMeta('Vocabulary change is saved locally but could not be queued for sync.');
          return;
        }

        const flushResult = await flushVocabularyStatusQueue({ force: true });
        if (!flushResult.ok) {
          setSyncMeta('Vocabulary change is saved locally and will sync when the API is reachable.');
          return;
        }

        setSyncMeta(null);
      })().catch(() => {
        setSyncMeta('Vocabulary change is saved locally and will sync when the API is reachable.');
      });

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
            ? `"${targetEnglishText}" marked as learned and removed from active vocabulary.`
            : `"${targetEnglishText}" marked for more review.`,
        );

        if (isLastCard) {
          setActiveReviewSection(null);
          setReviewIndex(0);
          return;
        }

        setReviewIndex((prev) => prev + 1);
      });
    },
    [
      activeReviewItem,
      activeReviewSection,
      animateCardBack,
      isSubmittingReview,
      items,
      reviewCardPosition,
      reviewIndex,
      setItems,
      setSyncMeta,
      token,
      userId,
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
    [
      activeReviewItem,
      animateCardBack,
      handleReviewDecision,
      isSubmittingReview,
      reviewCardPosition.x,
    ],
  );

  const handleStartReview = useCallback(
    (section: LessonVocabularySection) => {
      setActiveReviewSection({
        ...section,
        items: [...section.items],
      });
      setReviewIndex(0);
      setReviewMeta(null);
      setSearchQuery('');
      reviewCardPosition.setValue({ x: 0, y: 0 });
    },
    [reviewCardPosition, setSearchQuery],
  );

  return {
    activeReviewItem,
    activeReviewSection,
    handleReviewDecision,
    handleStartReview,
    isSubmittingReview,
    panResponder,
    reviewCardPosition,
    reviewIndex,
    reviewMeta,
    stopReview,
  };
}
