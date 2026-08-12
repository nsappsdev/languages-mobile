import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { TaskWordFlow } from '@/src/features/tasks/components/task-word-flow';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';
import { RunnerNavigationActions } from '@/src/features/tasks/components/task-runner-content';
import { pagedStyles } from '@/src/features/tasks/components/task-runner-paged.styles';
import {
  buildVocabularyTokenMatches,
  formatSeconds,
} from '@/src/features/tasks/services/task-runner-helpers';
import {
  buildRunnerSentencePages,
  getPagedReaderFontSize,
  resolveRunnerSentencePageIndex,
} from '@/src/features/tasks/services/task-runner-pages';
import { brand, motion, neutral } from '@/src/shared/theme';
import type { LessonItem } from '@/src/types/domain';

export function PagedRunnerContent({
  audioSource,
  currentSeconds,
  currentItem,
  currentItemIndex,
  isFirstItem,
  isLastItem,
  isPlaying,
  onNextItem,
  onPreviousItem,
  onTogglePlayback,
  pageTargetSegmentId,
  playbackDisabledReason,
  playbackModeLabel,
  durationSeconds,
  syncError,
  vocabularyNotice,
  wordFlowProps,
}: {
  audioSource: string;
  currentSeconds: number;
  currentItem: LessonItem;
  currentItemIndex: number;
  isFirstItem: boolean;
  isLastItem: boolean;
  isPlaying: boolean;
  onNextItem: () => void;
  onPreviousItem: () => void;
  onTogglePlayback: () => void;
  pageTargetSegmentId: string | null;
  playbackDisabledReason: string | null;
  playbackModeLabel: string;
  durationSeconds: number;
  syncError: string | null;
  vocabularyNotice: string | null;
  wordFlowProps: TaskWordFlowProps;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const transition = useRef(new Animated.Value(1)).current;
  const transitionDirection = useRef(1);
  const pages = useMemo(
    () =>
      buildRunnerSentencePages({
        segments: currentItem.segments,
        tokenCount: wordFlowProps.wordTokens.length,
        tokenSegmentIds: wordFlowProps.tokenSegmentIds,
      }),
    [currentItem.segments, wordFlowProps.tokenSegmentIds, wordFlowProps.wordTokens.length],
  );

  const moveToPage = useCallback(
    (nextIndex: number, seekPlayback: boolean) => {
      const boundedIndex = Math.min(Math.max(nextIndex, 0), Math.max(pages.length - 1, 0));
      if (boundedIndex === pageIndex) return;
      const page = pages[boundedIndex];
      if (seekPlayback && typeof page?.startMs === 'number') {
        wordFlowProps.handleSeekToSegment(page.startMs);
        return;
      }
      transitionDirection.current = boundedIndex > pageIndex ? 1 : -1;
      transition.setValue(0);
      setPageIndex(boundedIndex);
    },
    [pageIndex, pages, transition, wordFlowProps],
  );

  useEffect(() => {
    setPageIndex(0);
    transition.setValue(1);
  }, [currentItem.id, transition]);

  useEffect(() => {
    if (!wordFlowProps.isPlaying) return;
    const nextIndex = resolveRunnerSentencePageIndex({
      activeSegmentId: pageTargetSegmentId,
      currentIndex: pageIndex,
      pages,
    });
    if (nextIndex !== pageIndex) moveToPage(nextIndex, false);
  }, [moveToPage, pageIndex, pageTargetSegmentId, pages, wordFlowProps.isPlaying]);

  useEffect(() => {
    Animated.timing(transition, {
      duration: motion.fast,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [pageIndex, transition]);

  const page = pages[pageIndex] ?? pages[0];
  const pageTokens = useMemo(
    () => page?.tokenIndices.map((index) => wordFlowProps.wordTokens[index]) ?? [],
    [page, wordFlowProps.wordTokens],
  );
  const pageTokenSegmentIds = useMemo(
    () => page?.tokenIndices.map((index) => wordFlowProps.tokenSegmentIds[index] ?? null) ?? [],
    [page, wordFlowProps.tokenSegmentIds],
  );
  const pageVocabularyMatches = useMemo(
    () => buildVocabularyTokenMatches(pageTokens, Object.values(wordFlowProps.entryCacheByText)),
    [pageTokens, wordFlowProps.entryCacheByText],
  );
  const pageWordCount = pageTokens.filter((token) => Boolean(token.normalized)).length;
  const pageFontSize = getPagedReaderFontSize(pageWordCount, wordFlowProps.mainTextFontSize);
  const pageWordFlowProps: TaskWordFlowProps = {
    ...wordFlowProps,
    centered: true,
    handleTokenPositionLayout: () => undefined,
    mainTextFontSize: pageFontSize,
    mainTextLineHeight: Math.ceil(pageFontSize * 1.32),
    onLayout: () => undefined,
    reserveTranslationWidth: true,
    tokenSegmentIds: pageTokenSegmentIds,
    vocabularyTokenMatches: pageVocabularyMatches,
    wordTokens: pageTokens,
  };
  const translateX = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [transitionDirection.current * 24, 0],
  });
  const playbackProgress = durationSeconds > 0 ? currentSeconds / durationSeconds : 0;
  const progressPercent = Math.min(100, Math.max(0, playbackProgress * 100));

  return (
    <View style={pagedStyles.content}>
      <View style={pagedStyles.bookCard}>
        <View
          accessible
          accessibilityLabel={`Lesson item ${currentItemIndex + 1}. ${audioSource} audio.`}
          style={pagedStyles.bookHeader}>
          <View accessibilityElementsHidden style={pagedStyles.bookIcon}>
            <Ionicons name="school-outline" size={42} color={brand[700]} />
          </View>
        </View>

        <View style={pagedStyles.sentenceViewport}>
          <Animated.View
            style={[
              pagedStyles.sentencePage,
              { opacity: transition, transform: [{ translateX }] },
            ]}>
            <TaskWordFlow {...pageWordFlowProps} />
          </Animated.View>
        </View>

        {vocabularyNotice ? <Text style={pagedStyles.notice}>{vocabularyNotice}</Text> : null}

        <View style={pagedStyles.playbackSection}>
          <View
            accessibilityLabel={`${Math.round(progressPercent)} percent played`}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercent) }}
            style={pagedStyles.progressTrack}>
            <View style={[pagedStyles.progressFill, { width: `${progressPercent}%` }]} />
            <View style={[pagedStyles.progressThumb, { left: `${progressPercent}%` }]} />
          </View>
          <View style={pagedStyles.timeRow}>
            <Text style={pagedStyles.timeText}>{formatSeconds(currentSeconds)}</Text>
            <Text style={pagedStyles.timeText}>{formatSeconds(durationSeconds)}</Text>
          </View>

          <View style={pagedStyles.controlRow}>
            <SentencePageButton
              direction="previous"
              disabled={pageIndex === 0}
              onPress={() => moveToPage(pageIndex - 1, wordFlowProps.isPlaying)}
            />
            <Pressable
              accessibilityHint={
                playbackDisabledReason ?? `Plays the lesson in ${playbackModeLabel} mode`
              }
              accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${playbackModeLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(playbackDisabledReason) }}
              disabled={Boolean(playbackDisabledReason)}
              onPress={onTogglePlayback}
              style={({ pressed }) => [
                pagedStyles.playButton,
                playbackDisabledReason && pagedStyles.playButtonDisabled,
                pressed && !playbackDisabledReason && pagedStyles.playButtonPressed,
              ]}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={38}
                color={neutral[0]}
              />
            </Pressable>
            <SentencePageButton
              direction="next"
              disabled={pageIndex >= pages.length - 1}
              onPress={() => moveToPage(pageIndex + 1, wordFlowProps.isPlaying)}
            />
          </View>
          <Text accessibilityLiveRegion="polite" style={pagedStyles.sentenceCount}>
            {`Sentence ${Math.min(pageIndex + 1, Math.max(pages.length, 1))} of ${Math.max(pages.length, 1)}`}
          </Text>
        </View>
      </View>

      {syncError ? <Text style={pagedStyles.syncError}>{syncError}</Text> : null}

      <RunnerNavigationActions
        isFirstItem={isFirstItem}
        isLastItem={isLastItem}
        onNext={onNextItem}
        onPrevious={onPreviousItem}
      />
    </View>
  );
}

function SentencePageButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'next' | 'previous';
  disabled: boolean;
  onPress: () => void;
}) {
  const isNext = direction === 'next';
  return (
    <Pressable
      accessibilityLabel={`${isNext ? 'Next' : 'Previous'} sentence`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        pagedStyles.sentenceButton,
        disabled && pagedStyles.sentenceButtonDisabled,
        pressed && !disabled && pagedStyles.sentenceButtonPressed,
      ]}>
      <Ionicons name={isNext ? 'arrow-forward' : 'arrow-back'} size={22} color={brand[700]} />
    </Pressable>
  );
}
