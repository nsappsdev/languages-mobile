import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { layout, motion, palette, radii, spacing, typography } from '@/src/shared/theme';
import { useResource } from './use-resource';
import { flushReaderChanges } from './state-store';
import { timeLabel } from './model';
import { ui, ResourceState } from './ui';

async function loadLessons(token: string) {
  await flushReaderChanges();
  return apiClient.getLessons(token);
}

export function LibraryScreen() {
  const router = useRouter();
  const { user } = useSession();
  const resource = useResource(loadLessons);
  const lessons = resource.value?.lessons ?? [];
  return <ScreenContainer scroll maxWidth={layout.tabletMaxWidth}><View style={styles.screen}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>A little reading.{ '\n' }A little more English.</Text>
      <Text style={ui.subtitle}>Welcome, {user?.name.split(' ')[0]}. Listen to a story, explore its words, and make them yours.</Text>
    </View>
    <View style={ui.spread}><Text accessibilityRole="header" style={styles.sectionTitle}>Your lessons</Text><Text style={ui.chip}>{lessons.length} available</Text></View>
    <ResourceState {...resource}>
      {!lessons.length ? <View style={ui.card}><Text style={ui.word}>Your next story is on its way</Text><Text style={ui.subtitle}>Lessons appear here when their texts and audio are published for learning.</Text></View> : null}
      {lessons.map((lesson, index) => <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`Open lesson ${lesson.title}`}
        onPress={() => router.push({ pathname: '/runner/[lessonId]', params: { lessonId: lesson.id } })}
        style={({ pressed }) => [ui.card, styles.lesson, pressed && styles.pressed]}>
        <View style={ui.spread}><Text style={ui.eyebrow}>LESSON {String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.status}>{lesson.completedTexts === lesson.textCount ? 'Completed' : lesson.completedTexts ? 'In progress' : 'Start reading'}</Text></View>
        <Text style={styles.lessonTitle}>{lesson.title}</Text>
        {lesson.description ? <Text style={ui.subtitle}>{lesson.description}</Text> : null}
        <View style={ui.divider} />
        <View style={styles.lessonFooter}>
          <Text style={styles.metadata}>{lesson.textCount} {lesson.textCount === 1 ? 'text' : 'texts'} · {lesson.wordCount} learning words</Text>
          <View style={styles.duration}>
            <Ionicons name="headset-outline" size={16} color={palette.inkMuted} accessible={false} />
            <Text style={styles.metadata}>{timeLabel(lesson.durationSeconds)}</Text>
            <Ionicons name="arrow-forward" size={18} color={palette.primary} accessible={false} />
          </View>
        </View>
      </Pressable>)}
    </ResourceState>
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { gap: spacing[5], paddingTop: spacing[3] },
  header: { gap: spacing[3], paddingBottom: spacing[4] },
  title: { color: palette.ink, ...typography.display },
  sectionTitle: { color: palette.ink, ...typography.cardTitle },
  lesson: { gap: spacing[4] },
  lessonTitle: { color: palette.ink, ...typography.sectionTitle },
  status: { color: palette.primaryStrong, backgroundColor: palette.primarySoft, ...typography.caption,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radii.sm, overflow: 'hidden' },
  lessonFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  duration: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  metadata: { color: palette.inkMuted, ...typography.caption, fontVariant: ['tabular-nums'] },
  pressed: { opacity: motion.pressedOpacity, borderColor: palette.borderStrong },
});
