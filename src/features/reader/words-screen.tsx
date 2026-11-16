import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { controlSize, layout, motion, palette, radii, spacing, typography } from '@/src/shared/theme';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { meaning, wordKey } from './model';
import { pendingReaderChanges } from './state-store';
import { SyncNotice } from './sync-notice';
import type { ReaderWord, WordStatus } from './types';
import { ResourceState, ui } from './ui';
import { usePlayback } from './use-playback';
import { useResource } from './use-resource';
import { buildWordLibrary, shuffleLibraryWords, wordPlayback } from './word-library';

export function WordsScreen() {
  const { token, user } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ textReleaseId?: string | string[] }>();
  const selectedReleaseId = Array.isArray(params.textReleaseId)
    ? params.textReleaseId[0]
    : params.textReleaseId;
  const resource = useResource(apiClient.getWords);
  const [overrides, setOverrides] = useState<Record<string, WordStatus>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [requestedWord, setRequestedWord] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState<{ releaseId: string; keys: string[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    void pendingReaderChanges(user.id).then(changes => {
      setOverrides(Object.fromEntries(changes.flatMap(change => change.kind === 'word'
        ? [[wordKey(change.textReleaseId, change.occurrenceId), change.status]]
        : [])));
    });
  }, [resource.value, user]);

  const library = useMemo(
    () => buildWordLibrary(resource.value?.words ?? [], overrides),
    [overrides, resource.value?.words],
  );
  const selectedText = library.find(text => text.textReleaseId === selectedReleaseId);
  const audio = usePlayback(token ?? '', user?.id ?? '', selectedText?.publicationId ?? '');
  const stop = audio.stop;
  useEffect(() => {
    setRevealed({}); setShuffled(null); setRequestedWord(null); stop();
  }, [selectedReleaseId, selectedText?.publicationId, stop]);
  const isShuffled = shuffled?.releaseId === selectedReleaseId;
  const displayedWords = useMemo(() => {
    const words = selectedText?.words ?? [];
    if (!shuffled || shuffled.releaseId !== selectedReleaseId) return words;
    const order = new Map(shuffled.keys.map((key, index) => [key, index]));
    return [...words].sort((a, b) => (order.get(wordKey(a.textReleaseId, a.occurrence.id)) ?? Infinity)
      - (order.get(wordKey(b.textReleaseId, b.occurrence.id)) ?? Infinity));
  }, [selectedText, selectedReleaseId, shuffled]);
  const plans = useMemo(() => selectedText?.words.map(wordPlayback) ?? [], [selectedText]);
  const preload = audio.preload, warm = audio.warm;
  useFocusEffect(useCallback(() => preload(plans), [plans, preload]));
  useFocusEffect(useCallback(() => {
    const current = Math.max(0, displayedWords.findIndex(word => wordKey(word.textReleaseId, word.occurrence.id) === requestedWord));
    const nearby = [...displayedWords.slice(current), ...displayedWords.slice(0, current)].slice(0, 3);
    warm(nearby.map(wordPlayback));
  }, [displayedWords, requestedWord, warm]));

  const openText = (textReleaseId: string) => {
    router.push({ pathname: '/(tabs)/vocabulary', params: { textReleaseId } });
  };
  const closeText = () => router.replace('/(tabs)/vocabulary');

  const playWord = (word: ReaderWord) => {
    const key = wordKey(word.textReleaseId, word.occurrence.id);
    if (requestedWord === key && (audio.playing || audio.loading)) {
      audio.stop();
      setRequestedWord(null);
      return;
    }
    const steps = wordPlayback(word);
    if (!steps.length) return;

    setRequestedWord(key);
    void audio.play(steps, 0, word.publicationId);
  };
  const changeOrder = (shuffle: boolean) => {
    audio.stop(); setRequestedWord(null); setRevealed({});
    setShuffled(shuffle && selectedReleaseId ? { releaseId: selectedReleaseId,
      keys: shuffleLibraryWords(displayedWords).map(word => wordKey(word.textReleaseId, word.occurrence.id)) } : null);
  };

  return (
    <ScreenContainer scroll maxWidth={layout.tabletMaxWidth}>
      <View style={styles.screen}>
        <ResourceState {...resource}>
          {selectedReleaseId && selectedText ? (
            <>
              <Pressable
                accessibilityLabel="Back to Library"
                accessibilityRole="button"
                onPress={closeText}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Ionicons name="arrow-back" size={19} color={palette.primaryStrong} />
                <Text style={styles.backLabel}>Library</Text>
              </Pressable>

              <View style={styles.detailHeader}>
                <Text accessibilityRole="header" style={styles.detailTitle}>{selectedText.title}</Text>
                <Text style={ui.subtitle}>Tap an English word to hear it. Tap its blurred translation to reveal it.</Text>
              </View>

              <View style={styles.orderRow}>
                <Text accessibilityLiveRegion="polite" style={styles.orderLabel}>{isShuffled ? 'Shuffled' : 'Text order'}</Text>
                <View style={styles.orderActions}>
                  {isShuffled ? <Pressable accessibilityRole="button" accessibilityLabel="Restore text order" onPress={() => changeOrder(false)}
                    style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}>
                    <Ionicons name="list-outline" size={18} color={palette.primaryStrong} accessible={false} />
                    <Text style={styles.orderButtonLabel}>Text order</Text>
                  </Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel="Shuffle words" disabled={displayedWords.length < 2}
                    onPress={() => changeOrder(true)} style={({ pressed }) => [styles.orderButton,
                      displayedWords.length < 2 && styles.disabledButton, pressed && styles.pressed]}>
                    <Ionicons name="shuffle-outline" size={18} color={palette.primaryStrong} accessible={false} />
                    <Text style={styles.orderButtonLabel}>Shuffle</Text>
                  </Pressable>
                </View>
              </View>

              <SyncNotice />
              {audio.error ? <Text accessibilityRole="alert" style={ui.notice}>{audio.error}</Text> : null}

              <View style={styles.wordList}>
                {displayedWords.map((word, index) => {
                  const key = wordKey(word.textReleaseId, word.occurrence.id);
                  const isRevealed = !!revealed[key];
                  const isPlaying = requestedWord === key && (audio.playing || audio.loading);
                  const isLoading = isPlaying && audio.loading;
                  const translation = meaning(word.occurrence);
                  return (
                    <View
                      key={key}
                      style={[styles.wordRow, index === displayedWords.length - 1 && styles.lastWordRow]}>
                      <Pressable
                        accessibilityLabel={`${isLoading ? 'Cancel loading' : isPlaying ? 'Stop' : 'Play'} word ${word.occurrence.text}`}
                        accessibilityRole="button"
                        disabled={!word.occurrence.learning?.clip}
                        onPress={() => playWord(word)}
                        style={({ pressed }) => [styles.wordSide, pressed && styles.pressed]}>
                        <View style={styles.englishLine}>
                          <Text style={[styles.englishWord, isPlaying && styles.playingWord]}>{word.occurrence.text}</Text>
                          <Ionicons name={isLoading ? 'hourglass-outline' : isPlaying ? 'volume-high' : 'volume-medium-outline'} size={18} color={isPlaying ? palette.primary : palette.inkMuted} accessible={false} />
                        </View>
                      </Pressable>

                      <Pressable
                        accessibilityLabel={`${isRevealed ? 'Hide' : 'Reveal'} Armenian translation for ${word.occurrence.text}`}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: isRevealed }}
                        onPress={() => setRevealed(current => ({ ...current, [key]: !current[key] }))}
                        style={({ pressed }) => [styles.translationSide, pressed && styles.pressed]}>
                        <Text
                          numberOfLines={2}
                          style={[styles.translation, !isRevealed && styles.blurredTranslation]}>
                          {translation || '—'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : selectedReleaseId ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>This text is no longer in your library</Text>
              <Text style={ui.subtitle}>It may no longer contain words marked as unknown.</Text>
              <Pressable accessibilityRole="button" onPress={closeText} style={styles.returnButton}>
                <Text style={styles.returnLabel}>Return to Library</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.libraryHeader}>
                <Text accessibilityRole="header" style={ui.title}>Your texts</Text>
              </View>
              <SyncNotice />
              {!library.length ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No texts here yet</Text>
                  <Text style={ui.subtitle}>Words you mark as unknown while listening will appear inside their text.</Text>
                </View>
              ) : (
                <View style={styles.textList}>
                  {library.map(text => (
                    <Pressable
                      key={text.textReleaseId}
                      accessibilityLabel={`Open ${text.title}`}
                      accessibilityRole="button"
                      onPress={() => openText(text.textReleaseId)}
                      style={({ pressed }) => [styles.textCard, pressed && styles.textCardPressed]}>
                      <View style={styles.textInfo}>
                        <Text style={styles.textTitle}>{text.title}</Text>
                        <Text style={styles.wordCount}>{text.words.length} {text.words.length === 1 ? 'word' : 'words'}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={palette.primary} accessible={false} />
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </ResourceState>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing[6],
    paddingTop: spacing[3],
  },
  libraryHeader: {
    gap: spacing[2],
    paddingBottom: spacing[1],
  },
  textList: {
    gap: spacing[3],
  },
  textCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[4],
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },
  textCardPressed: {
    backgroundColor: palette.surfaceSubtle,
    borderColor: palette.borderStrong,
  },
  textTitle: {
    color: palette.ink,
    ...typography.cardTitle,
  },
  textInfo: { flex: 1, gap: spacing[2] },
  wordCount: { color: palette.inkMuted, ...typography.caption },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: controlSize.standard,
    paddingRight: spacing[3],
  },
  backLabel: {
    color: palette.primaryStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
  detailHeader: {
    gap: spacing[2],
  },
  detailTitle: {
    color: palette.ink,
    ...typography.screenTitle,
  },
  orderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  orderLabel: { color: palette.inkMuted, ...typography.caption },
  orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  orderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], minHeight: controlSize.standard,
    paddingHorizontal: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: palette.borderStrong, backgroundColor: palette.surface },
  orderButtonLabel: { color: palette.primaryStrong, fontSize: 14, fontWeight: '600' },
  disabledButton: { opacity: 0.45 },
  wordList: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  wordRow: {
    alignItems: 'stretch',
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
  },
  lastWordRow: {
    borderBottomWidth: 0,
  },
  wordSide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
  },
  englishLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  englishWord: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
    flexShrink: 1,
  },
  playingWord: {
    color: palette.primary,
  },
  translationSide: {
    alignItems: 'flex-end',
    borderLeftColor: palette.border,
    borderLeftWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
  },
  translation: {
    color: palette.primaryStrong,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'right',
  },
  blurredTranslation: {
    color: 'transparent',
    textShadowColor: palette.primaryStrong,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[5],
  },
  emptyTitle: {
    color: palette.ink,
    ...typography.cardTitle,
  },
  returnButton: {
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    minHeight: controlSize.standard,
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  returnLabel: {
    color: palette.primaryStrong,
    fontSize: 15,
    fontWeight: '600',
  },
});
