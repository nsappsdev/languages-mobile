import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/src/shared/auth/session-context';
import { apiClient } from '@/src/shared/api/client';
import { palette } from '@/src/shared/theme';
import type { AppSettings, ReadingModeSettings } from '@/src/types/domain';
import { useResource } from './use-resource';
import { usePlayback } from './use-playback';
import { activeOccurrence, buildPlayback, DEFAULT_MODES, meaning, nextUnknownStatus, textTokens, timeLabel, wordKey } from './model';
import { fitTranslationLabel } from './translation-fit';
import { flushReaderChanges, pendingReaderChanges, readerTimestamp, saveReaderChange } from './state-store';
import type { ReaderOccurrence, ReaderResponse, WordStatus } from './types';
import { Action, ResourceState, ui } from './ui';
import { SyncNotice } from './sync-notice';

export function ReaderScreen({ lessonId }: { lessonId: string }) {
  const pinned = useRef<string | null>(null);
  const load = useCallback(async (token: string) => {
    const response = pinned.current ? await apiClient.getPublication(token, pinned.current) : await apiClient.getLesson(token, lessonId);
    if (response.manifest.schemaVersion !== 2 || !response.manifest.texts.length) throw new Error('This lesson needs a published text version.');
    pinned.current = response.publicationId;
    const { settings } = await apiClient.getSettings(token);
    return { response, settings };
  }, [lessonId]);
  const resource = useResource(load);
  if (!resource.value || resource.loading || resource.error) return <SafeAreaView style={styles.safe}><View style={styles.loading}>
    <ResourceState {...resource} />
  </View></SafeAreaView>;
  return <ReadingWorkspace key={resource.value.response.publicationId} {...resource.value} />;
}

function ReadingWorkspace({ response, settings }: { response: ReaderResponse; settings: AppSettings }) {
  const router = useRouter();
  const { token, user } = useSession();
  const [textIndex, setTextIndex] = useState(() => Math.max(0, response.manifest.texts.findIndex(t => !response.progress.some(p => p.textReleaseId === t.textReleaseId && p.completed))));
  const text = response.manifest.texts[textIndex];
  const [states, setStates] = useState<Record<string, WordStatus>>(() => Object.fromEntries(response.words.map(w => [wordKey(w.textReleaseId, w.occurrenceId), w.status])));
  const modes = settings.readingModes.filter(m => m.enabled).sort((a, b) => a.order - b.order);
  const availableModes = modes.length ? modes : [DEFAULT_MODES[0]];
  const [mode, setMode] = useState<ReadingModeSettings>(() => availableModes[0]);
  const audio = usePlayback(token ?? '', user?.id ?? '', response.publicationId);
  const tokenized = textTokens(text);
  const activeId = audio.occurrenceId ?? activeOccurrence(text, audio.sample);
  const position = Math.min(text.narration.frameCount, audio.sample);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const progressRef = useRef({ sample: 0, textReleaseId: text.textReleaseId, frameCount: text.narration.frameCount });
  const previousPlaying = useRef(false);
  const persist = useCallback((completed = false) => {
    if (!user) return;
    const current = progressRef.current;
    return saveReaderChange(user.id, { kind: 'progress', publicationId: response.publicationId, textReleaseId: current.textReleaseId,
      lastSample: completed ? current.frameCount : Math.max(0, Math.min(current.frameCount, current.sample)), completed,
      clientUpdatedAt: readerTimestamp() });
  }, [response.publicationId, user]);
  useEffect(() => { progressRef.current = { sample: position, textReleaseId: text.textReleaseId, frameCount: text.narration.frameCount }; }, [position, text]);
  useFocusEffect(useCallback(() => () => { void persist(); }, [persist]));
  useEffect(() => {
    if (previousPlaying.current && !audio.playing && !audio.loading) persist();
    previousPlaying.current = audio.playing;
  }, [audio.loading, audio.playing, persist]);
  const setSample = audio.setSample;
  useEffect(() => {
    let active = true;
    const progress = response.progress.find(p => p.textReleaseId === text.textReleaseId);
    setSample(progress?.completed ? 0 : progress?.lastSample ?? 0);
    if (user) void pendingReaderChanges(user.id).then(changes => {
      if (!active) return;
      setStates(previous => ({ ...previous, ...Object.fromEntries(changes.flatMap(c => c.kind === 'word' ? [[wordKey(c.textReleaseId, c.occurrenceId), c.status]] : [])) }));
      const saved = changes.find(c => c.kind === 'progress' && c.textReleaseId === text.textReleaseId);
      if (saved?.kind === 'progress') setSample(saved.completed ? 0 : saved.lastSample);
    });
    return () => { active = false; };
  }, [response.progress, setSample, text.textReleaseId, user]);
  const start = (sample = position) => {
    const from = sample >= text.narration.frameCount - 1 ? 0 : sample;
    void audio.play(buildPlayback(text, mode, states, from), settings.wordRepetitionPauseMs);
  };
  const toggleUnknown = (occurrence: ReaderOccurrence) => {
    if (!occurrence.learning || !user || audio.playing || audio.loading) return;
    const key = wordKey(text.textReleaseId, occurrence.id);
    const status = nextUnknownStatus(states[key]);
    setStates(previous => ({ ...previous, [key]: status }));
    void saveReaderChange(user.id, { kind: 'word', publicationId: response.publicationId, textReleaseId: text.textReleaseId,
      occurrenceId: occurrence.id, status, clientUpdatedAt: readerTimestamp() });
  };
  const [finishing, setFinishing] = useState(false);
  const finish = async () => {
    if (finishing) return;
    setFinishing(true); audio.stop();
    await persist(true);
    await flushReaderChanges();
    if (textIndex + 1 < response.manifest.texts.length) { setTextIndex(i => i + 1); setFinishing(false); }
    else router.replace('/(tabs)/lessons');
  };
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to lessons" onPress={() => { audio.stop(); persist(); router.replace('/(tabs)/lessons'); }} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
      <View style={{ flex: 1, gap: 3 }}><Text style={ui.eyebrow}>TEXT {textIndex + 1} OF {response.manifest.texts.length}</Text><Text numberOfLines={2} style={styles.lessonTitle}>{response.manifest.title}</Text></View>
    </View>
    <ScrollView contentContainerStyle={styles.readingScroll}>
      <View style={styles.page}>
        <View style={ui.spread}><Text style={ui.eyebrow}>READ & LISTEN</Text><Text style={ui.subtitle}>{timeLabel(text.narration.frameCount / text.narration.sampleRate)}</Text></View>
        <Text style={ui.subtitle}>Tap a word you do not know. Its translation will stay above it while you listen and practice.</Text>
        <View style={styles.passageFlow}>
          {tokenized.prefix ? <Text style={[styles.passage, passageType(settings)]}>{tokenized.prefix}</Text> : null}
          {tokenized.tokens.map(token => <ReaderWordToken key={token.occurrence.id} {...token}
            status={states[wordKey(text.textReleaseId, token.occurrence.id)]}
            active={token.occurrence.id === activeId && audio.playing}
            disabled={audio.playing || audio.loading}
            pulseKey={audio.repetition?.kind === 'word' && audio.occurrenceId === token.occurrence.id ? `${audio.repetition.index}:${audio.repetition.total}` : null}
            settings={settings} onToggle={() => toggleUnknown(token.occurrence)} />)}
        </View>
        <SyncNotice />
      </View>
    </ScrollView>
    <View style={styles.dock}>
      {audio.error ? <Text accessibilityRole="alert" style={ui.notice}>{audio.error}</Text> : null}
      {audio.repetition ? <Text accessibilityLiveRegion="polite" style={styles.repetition}>{audio.repetition.label} · {audio.repetition.kind === 'word' ? 'Play' : 'Replay'} {audio.repetition.index} of {audio.repetition.total}{audio.canResume ? ' · Paused' : ''}</Text> : null}
      <View style={styles.modeRow}>{availableModes.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Mode ${item.displayName}`} accessibilityState={{ selected: item.id === mode.id }}
        onPress={() => { audio.stop(); setMode(item); }} style={[styles.mode, item.id === mode.id && styles.modeActive]}><Text style={[styles.modeText, item.id === mode.id && styles.modeActiveText]}>{item.id === 'introduction' ? 'Listen' : item.id === 'teaching' ? 'Practice' : 'Deep learning'}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Seek narration" onLayout={event => setTimelineWidth(event.nativeEvent.layout.width)}
        onPress={event => { if (timelineWidth) start(Math.round(Math.max(0, Math.min(1, event.nativeEvent.locationX / timelineWidth)) * text.narration.frameCount)); }} style={styles.timelineTouch}>
        <View style={styles.timeline}><View style={[styles.timelineFill, { width: `${position / text.narration.frameCount * 100}%` }]} /></View>
      </Pressable>
      <View style={ui.spread}><Text style={styles.clock}>{timeLabel(position / text.narration.sampleRate)}</Text><Text style={styles.clock}>{timeLabel(text.narration.frameCount / text.narration.sampleRate)}</Text></View>
      <View style={styles.controls}>
        <Action title="↺" label="Restart narration" secondary onPress={() => start(0)} />
        <View style={{ flex: 1 }}><Action title={audio.loading ? 'Cancel loading' : audio.playing ? 'Pause' : audio.canResume ? '▶  Resume' : '▶  Play'} label={audio.loading ? 'Cancel loading audio' : audio.playing ? 'Pause narration' : 'Play narration'} onPress={() => { if (audio.playing || audio.loading) audio.pause(); else if (audio.canResume) void audio.resume(); else start(); }} /></View>
        <Action title={finishing ? 'Saving…' : textIndex + 1 < response.manifest.texts.length ? 'Next text →' : 'Finish ✓'} label="Complete text" disabled={finishing} secondary onPress={() => { void finish(); }} />
      </View>
    </View>
  </SafeAreaView>;
}

function passageType(settings: AppSettings) {
  const fontSize = settings.mainTextFontSize;
  return {
    fontFamily: settings.mainTextFontFamily === 'System' ? undefined : settings.mainTextFontFamily,
    fontSize,
    lineHeight: Math.ceil(fontSize * 4 / 3),
  };
}

function ReaderWordToken({ occurrence, word, suffix, status, active, disabled, pulseKey, settings, onToggle }: {
  occurrence: ReaderOccurrence;
  word: string;
  suffix: string;
  status: WordStatus | undefined;
  active: boolean;
  disabled: boolean;
  pulseKey: string | null;
  settings: AppSettings;
  onToggle: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const missingProgress = useRef(new Animated.Value(0)).current;
  const missingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [wordWidth, setWordWidth] = useState(0);
  const unknown = status === 'LEARNING';
  const availableTranslation = meaning(occurrence).trim();
  const translation = unknown ? availableTranslation : '';
  const translationMaxSize = settings.translationFontMaxSize ?? settings.translationFontSize;
  const translationMinSize = Math.min(translationMaxSize, settings.translationFontMinSize);
  const measuredWordWidth = wordWidth || Math.ceil(word.length * settings.mainTextFontSize * 0.56);
  const fittedTranslation = fitTranslationLabel({
    availableWidth: measuredWordWidth,
    maxFontSize: translationMaxSize,
    maxLetterSpacing: settings.translationLetterSpacingMax,
    minFontSize: translationMinSize,
    minLetterSpacing: settings.translationLetterSpacingMin,
    text: availableTranslation,
  });
  const translationLineHeight = Math.ceil(translationMaxSize + 4);
  const translationFontFamily = settings.translationFontFamily === 'System' ? undefined : settings.translationFontFamily;
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!pulseKey || !translation) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.28, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.94, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 22, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, scale, translation]);

  useEffect(() => () => {
    if (missingTimer.current) clearTimeout(missingTimer.current);
    missingProgress.stopAnimation();
  }, [missingProgress]);

  const showMissingTranslation = () => {
    if (missingTimer.current) clearTimeout(missingTimer.current);
    setShowMissing(true);
    missingProgress.stopAnimation();
    missingProgress.setValue(0);
    Animated.sequence([
      Animated.timing(missingProgress, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(missingProgress, { toValue: 0.82, duration: 140, useNativeDriver: true }),
      Animated.timing(missingProgress, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    missingTimer.current = setTimeout(() => {
      missingTimer.current = null;
      setShowMissing(false);
    }, 1600);
  };

  const missingScale = missingProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1.2, 2.5, 1.85],
  });
  const missingOpacity = missingProgress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1],
  });

  const contents = <View style={styles.tokenGroup}>
    <View style={[styles.token, { paddingTop: translationLineHeight + 2 }]}>
      <View pointerEvents="none" style={[styles.translationLane, { height: translationLineHeight }]}>
        {showMissing ? <Animated.Text testID={`missing-translation-${occurrence.id}`} accessibilityLiveRegion="polite" numberOfLines={1}
          accessibilityLabel={`No translation available for ${word}`}
          style={[styles.tokenTranslation, styles.missingTranslation, { fontSize: Math.max(12, fittedTranslation.fontSize), height: translationLineHeight,
            lineHeight: translationLineHeight, opacity: missingOpacity, transform: [{ scale: missingScale }], width: fittedTranslation.containerWidth }]}>∅</Animated.Text>
          : translation ? <Animated.Text testID={`translation-${occurrence.id}`} accessibilityLiveRegion="polite" numberOfLines={1}
          style={[styles.tokenTranslation, { fontFamily: translationFontFamily, fontSize: fittedTranslation.fontSize,
            height: translationLineHeight, letterSpacing: fittedTranslation.letterSpacing, lineHeight: translationLineHeight,
            transform: [{ scale }], width: fittedTranslation.containerWidth }]}>{translation}</Animated.Text> : null}
      </View>
      <Text testID={`reader-word-text-${occurrence.id}`} onLayout={event => {
        const width = Math.round(event.nativeEvent.layout.width);
        setWordWidth(previous => previous === width ? previous : width);
      }} style={[styles.passage, passageType(settings), active && styles.currentWord]}>{word}</Text>
    </View>
    {suffix ? <Text style={[styles.passage, passageType(settings)]}>{suffix}</Text> : null}
  </View>;

  return <Pressable testID={`reader-word-${occurrence.id}`} accessibilityRole="button"
    accessibilityLabel={availableTranslation ? `${word}, ${unknown ? 'marked unknown' : 'mark as unknown'}` : `${word}, check translation`}
    accessibilityHint={disabled ? 'Pause playback to change this word' : undefined}
    accessibilityState={{ disabled, selected: unknown }} disabled={disabled}
    onPress={availableTranslation ? onToggle : showMissingTranslation}>
    {contents}
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  loading: { padding: 24 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center', alignSelf: 'center', maxWidth: 850, width: '100%', paddingHorizontal: 20, paddingVertical: 16 },
  back: { minHeight: 48, width: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 27, color: palette.primaryStrong },
  lessonTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: palette.ink },
  readingScroll: { paddingHorizontal: 18, paddingBottom: 24, flexGrow: 1 },
  page: { backgroundColor: palette.surface, borderRadius: 24, borderWidth: 1, borderColor: palette.border, padding: 24, gap: 20, width: '100%', maxWidth: 800, alignSelf: 'center' },
  passageFlow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  tokenGroup: { alignItems: 'flex-end', flexDirection: 'row', flexShrink: 0, marginBottom: 4 },
  token: { alignItems: 'center', flexShrink: 0, position: 'relative' },
  translationLane: { alignItems: 'center', left: 0, overflow: 'visible', position: 'absolute', right: 0, top: 0 },
  tokenTranslation: { color: palette.primaryStrong, fontWeight: '700', overflow: 'visible', textAlign: 'center' },
  missingTranslation: { color: palette.danger, fontSize: 12 },
  passage: { color: palette.ink, fontSize: 27, lineHeight: 44 },
  currentWord: { backgroundColor: palette.primarySoft, color: palette.primaryStrong },
  dock: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, backgroundColor: palette.canvas, width: '100%', maxWidth: 850, alignSelf: 'center', gap: 4 },
  modeRow: { flexDirection: 'row', backgroundColor: palette.border, padding: 4, borderRadius: 15 },
  mode: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  modeActive: { backgroundColor: palette.surface },
  modeText: { fontSize: 13, fontWeight: '600', color: palette.inkMuted },
  modeActiveText: { color: palette.primaryStrong },
  timelineTouch: { height: 30, justifyContent: 'center' },
  timeline: { height: 4, borderRadius: 2, backgroundColor: palette.border, overflow: 'hidden' },
  timelineFill: { height: 4, backgroundColor: palette.primary },
  clock: { color: palette.inkMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  repetition: { color: palette.primaryStrong, fontSize: 13, textAlign: 'center', paddingBottom: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
});
