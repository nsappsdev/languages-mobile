import { useAudioPlayer } from 'expo-audio';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { resolveApiAssetUrl } from '@/src/config/env';
import { ensureAudioCached } from '@/src/features/tasks/services/audio-cache';
import { VocabularyOverview } from '@/src/features/vocabulary/components/vocabulary-overview';
import { VocabularySectionList } from '@/src/features/vocabulary/components/vocabulary-section-list';
import { VocabularyStateScreen } from '@/src/features/vocabulary/components/vocabulary-state-screen';
import { useVocabularyData } from '@/src/features/vocabulary/hooks/use-vocabulary-data';
import {
  findContextAudioRange,
  findWordAudioRange,
  getNextVocabularyReviewState,
  shuffleVocabularyRows,
  type LessonVocabularyRow,
  type LessonVocabularySection,
  type VocabularyAudioRange,
  type VocabularyReviewDecision,
} from '@/src/features/vocabulary/services/lesson-vocabulary';
import {
  markVocabularyReviewStateSynced,
  setVocabularyReviewState,
} from '@/src/features/vocabulary/services/lesson-vocabulary-cache';
import { buildLessonDictionarySummary } from '@/src/features/vocabulary/services/vocabulary-screen-helpers';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { styles } from '@/src/features/vocabulary/screens/vocabulary-screen.styles';

export function VocabularyScreen() {
  const { token, user } = useSession();
  const userId = user?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(new Set());
  const [sectionOrders, setSectionOrders] = useState<Record<string, string[]>>({});
  const player = useAudioPlayer(undefined, { updateInterval: 100 });
  const audioSourceRef = useRef<string | null>(null);
  const audioStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    error,
    fetchVocabulary,
    isLoading,
    isRefreshing,
    sections,
    setSections,
    setSyncMeta,
    syncMeta,
  } = useVocabularyData({
    token,
    userId,
  });

  const filteredSections = useMemo(
    () => filterAndOrderSections(sections, searchQuery, sectionOrders),
    [searchQuery, sectionOrders, sections],
  );
  const summary = useMemo(() => buildLessonDictionarySummary(sections), [sections]);

  const playAudioRange = useCallback(
    async (range: VocabularyAudioRange | null) => {
      if (!range?.audioUrl) return;

      const sourceUrl = resolveApiAssetUrl(range.audioUrl);
      const playableUrl = await ensureAudioCached(sourceUrl).catch(() => sourceUrl);
      if (audioStopTimerRef.current) {
        clearTimeout(audioStopTimerRef.current);
        audioStopTimerRef.current = null;
      }

      if (audioSourceRef.current !== playableUrl) {
        player.replace(playableUrl);
        audioSourceRef.current = playableUrl;
      }

      player.pause();
      await player.seekTo(range.startMs / 1000);
      player.play();

      audioStopTimerRef.current = setTimeout(() => {
        player.pause();
      }, Math.max(250, range.endMs - range.startMs));
    },
    [player],
  );

  const handlePlayContext = useCallback(
    (section: LessonVocabularySection, row: LessonVocabularyRow) => {
      void playAudioRange(findContextAudioRange(section.lesson, row.entry));
    },
    [playAudioRange],
  );

  const handleReviewDecision = useCallback(
    (section: LessonVocabularySection, row: LessonVocabularyRow, decision: VocabularyReviewDecision) => {
      if (!token || !userId) return;

      const nextState = getNextVocabularyReviewState({
        currentStage: row.localStage,
        decision,
        entryId: row.entryId,
        lessonId: section.lessonId,
      });
      const shouldRemoveAfterFeedback = nextState.stage === 'final_learned';

      setSections((currentSections) =>
        currentSections.map((currentSection) => {
          if (currentSection.id !== section.id) return currentSection;
          return {
            ...currentSection,
            items: currentSection.items.map((item) =>
              item.entryId === row.entryId
                ? { ...item, localStage: nextState.stage, status: nextState.status }
                : item,
            ),
          };
        }),
      );

      if (shouldRemoveAfterFeedback) {
        setTimeout(() => {
          setSections((currentSections) =>
            currentSections
              .map((currentSection) =>
                currentSection.id === section.id
                  ? {
                      ...currentSection,
                      items: currentSection.items.filter((item) => item.entryId !== row.entryId),
                    }
                  : currentSection,
              )
              .filter((currentSection) => currentSection.items.length > 0),
          );
        }, 650);
      }

      void playAudioRange(findWordAudioRange(section.lesson, row.entry));
      void setVocabularyReviewState(userId, nextState)
        .then(() =>
          apiClient.updateLessonVocabularyStatus(
            token,
            section.lessonId,
            row.entryId,
            nextState.status,
          ),
        )
        .then(() => markVocabularyReviewStateSynced(userId, row.entryId))
        .catch(() => {
          setSyncMeta('Dictionary change is saved locally and will sync when the API is reachable.');
        });
    },
    [playAudioRange, setSections, setSyncMeta, token, userId],
  );

  const toggleSectionExpanded = useCallback(
    (sectionId: string) => {
      setExpandedSectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) {
          next.delete(sectionId);
          return next;
        }

        next.add(sectionId);
        const section = sections.find((item) => item.id === sectionId);
        if (section) {
          setSectionOrders((current) => ({
            ...current,
            [sectionId]: shuffleVocabularyRows(section.items).map((item) => item.entryId),
          }));
        }
        return next;
      });
    },
    [sections],
  );

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
        <Text style={styles.meta}>Loading dictionary...</Text>
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

  return (
    <ScreenContainer>
      <VocabularyOverview summary={summary} syncMeta={syncMeta} />
      <VocabularySectionList
        expandedSectionIds={expandedSectionIds}
        isRefreshing={isRefreshing}
        onPlayContext={handlePlayContext}
        onRefresh={() => {
          fetchVocabulary(true).catch(() => null);
        }}
        onReviewDecision={handleReviewDecision}
        onToggleSection={toggleSectionExpanded}
        searchQuery={searchQuery}
        sections={filteredSections}
        setSearchQuery={setSearchQuery}
      />
    </ScreenContainer>
  );
}

function filterAndOrderSections(
  sections: LessonVocabularySection[],
  searchQuery: string,
  sectionOrders: Record<string, string[]>,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return sections
    .map((section) => {
      const filteredItems = normalizedQuery
        ? section.items.filter((item) => matchesSearch(item, normalizedQuery))
        : section.items;
      const order = sectionOrders[section.id];
      const orderedItems = order ? orderRows(filteredItems, order) : filteredItems;

      return {
        ...section,
        items: orderedItems,
      };
    })
    .filter((section) => section.items.length > 0);
}

function matchesSearch(row: LessonVocabularyRow, normalizedQuery: string) {
  const english = row.entry.englishText.toLowerCase();
  const translations = row.entry.translations.map((translation) =>
    translation.translation.toLowerCase(),
  );

  return english.includes(normalizedQuery) || translations.some((value) => value.includes(normalizedQuery));
}

function orderRows(rows: LessonVocabularyRow[], order: string[]) {
  const orderByEntryId = new Map(order.map((entryId, index) => [entryId, index]));
  return [...rows].sort((left, right) => {
    const leftIndex = orderByEntryId.get(left.entryId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderByEntryId.get(right.entryId) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}
