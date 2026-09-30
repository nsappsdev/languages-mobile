import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
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
  return <ScreenContainer scroll maxWidth={850}><View style={[ui.stack, { gap: 26, paddingTop: 16 }]}>
    <View style={ui.stack}>
      <Text style={ui.eyebrow}>YOUR READING SPACE</Text>
      <Text accessibilityRole="header" style={ui.title}>A little reading.{ '\n' }A little more English.</Text>
      <Text style={ui.subtitle}>Welcome, {user?.name.split(' ')[0]}. Listen to a story, explore its words, and make them yours.</Text>
    </View>
    <View style={ui.spread}><Text style={ui.word}>Your lessons</Text><Text style={ui.chip}>{lessons.length} available</Text></View>
    <ResourceState {...resource}>
      {!lessons.length ? <View style={ui.card}><Text style={ui.word}>Your next story is on its way</Text><Text style={ui.subtitle}>Lessons appear here when their texts and audio are published for learning.</Text></View> : null}
      {lessons.map((lesson, index) => <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`Open lesson ${lesson.title}`}
        onPress={() => router.push({ pathname: '/runner/[lessonId]', params: { lessonId: lesson.id } })}
        style={({ pressed }) => [ui.card, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={ui.spread}><Text style={ui.eyebrow}>LESSON {String(index + 1).padStart(2, '0')}</Text>
          <Text style={ui.chip}>{lesson.completedTexts === lesson.textCount ? 'Completed' : lesson.completedTexts ? 'In progress' : 'Start reading'}</Text></View>
        <Text style={ui.word}>{lesson.title}</Text>
        {lesson.description ? <Text style={ui.subtitle}>{lesson.description}</Text> : null}
        <View style={ui.divider} />
        <View style={ui.spread}><Text style={ui.subtitle}>{lesson.textCount} {lesson.textCount === 1 ? 'text' : 'texts'} · {lesson.wordCount} learning words</Text><Text style={ui.eyebrow}>{timeLabel(lesson.durationSeconds)}  →</Text></View>
      </Pressable>)}
    </ResourceState>
  </View></ScreenContainer>;
}
