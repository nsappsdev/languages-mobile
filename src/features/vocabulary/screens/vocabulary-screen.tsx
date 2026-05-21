import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { VocabularyOverview } from '@/src/features/vocabulary/components/vocabulary-overview';
import { VocabularyReviewDeck } from '@/src/features/vocabulary/components/vocabulary-review-deck';
import { VocabularySectionList } from '@/src/features/vocabulary/components/vocabulary-section-list';
import { VocabularyStateScreen } from '@/src/features/vocabulary/components/vocabulary-state-screen';
import { useVocabularyData } from '@/src/features/vocabulary/hooks/use-vocabulary-data';
import { useVocabularyReview } from '@/src/features/vocabulary/hooks/use-vocabulary-review';
import { buildLessonVocabularySections } from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  buildVocabularySummary,
  getActiveVocabularyItems,
} from '@/src/features/vocabulary/services/vocabulary-screen-helpers';
import { useSession } from '@/src/shared/auth/session-context';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularyScreen() {
  const { token, user } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const {
    error,
    fetchVocabulary,
    isLoading,
    isRefreshing,
    items,
    lessons,
    setItems,
    setSyncMeta,
    syncMeta,
  } = useVocabularyData({
    token,
    userId: user?.id,
  });
  const {
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
  } = useVocabularyReview({
    items,
    setItems,
    setSearchQuery,
    setSyncMeta,
    token,
    userId: user?.id,
  });

  const summary = useMemo(() => buildVocabularySummary(items), [items]);
  const activeItems = useMemo(() => getActiveVocabularyItems(items), [items]);
  const filteredSections = useMemo(
    () => buildLessonVocabularySections(lessons, activeItems, searchQuery),
    [activeItems, lessons, searchQuery],
  );

  const toggleSectionExpanded = useCallback((sectionId: string) => {
    setExpandedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  if (!token || !user?.id) {
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

  if (error) {
    return (
      <VocabularyStateScreen>
        <Text style={styles.error}>{error}</Text>
        {syncMeta ? <Text style={styles.meta}>{syncMeta}</Text> : null}
        <Pressable onPress={() => fetchVocabulary().catch(() => null)} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </VocabularyStateScreen>
    );
  }

  if (activeReviewSection && activeReviewItem) {
    return (
      <ScreenContainer>
        <VocabularyReviewDeck
          activeReviewItem={activeReviewItem}
          activeReviewSection={activeReviewSection}
          handleReviewDecision={handleReviewDecision}
          isSubmittingReview={isSubmittingReview}
          panResponder={panResponder}
          reviewCardPosition={reviewCardPosition}
          reviewIndex={reviewIndex}
          reviewMeta={reviewMeta}
          stopReview={stopReview}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <VocabularyOverview reviewMeta={reviewMeta} summary={summary} syncMeta={syncMeta} />
      <VocabularySectionList
        expandedSectionIds={expandedSectionIds}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          fetchVocabulary(true).catch(() => null);
        }}
        onStartReview={handleStartReview}
        onToggleSection={toggleSectionExpanded}
        searchQuery={searchQuery}
        sections={filteredSections}
        setSearchQuery={setSearchQuery}
      />
    </ScreenContainer>
  );
}
