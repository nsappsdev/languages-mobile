import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import type { PanResponderInstance } from 'react-native';
import type { LessonVocabularySection } from '@/src/features/vocabulary/services/lesson-vocabulary';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';
import type { LearnerVocabularyItem, LearnerVocabularyStatus } from '@/src/types/domain';

export function VocabularyReviewDeck({
  activeReviewItem,
  activeReviewSection,
  handleReviewDecision,
  isSubmittingReview,
  panResponder,
  reviewCardPosition,
  reviewIndex,
  reviewMeta,
  stopReview,
}: {
  activeReviewItem: LearnerVocabularyItem;
  activeReviewSection: LessonVocabularySection;
  handleReviewDecision: (status: LearnerVocabularyStatus, direction: -1 | 1) => void;
  isSubmittingReview: boolean;
  panResponder: PanResponderInstance;
  reviewCardPosition: Animated.ValueXY;
  reviewIndex: number;
  reviewMeta: string | null;
  stopReview: () => void;
}) {
  const progressText = `${reviewIndex + 1} / ${activeReviewSection.items.length}`;
  const rotate = reviewCardPosition.x.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ['-9deg', '0deg', '9deg'],
    extrapolate: 'clamp',
  });

  return (
    <>
      <View style={styles.reviewHeader}>
        <Pressable onPress={stopReview} style={styles.backButton}>
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
    </>
  );
}
