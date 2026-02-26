import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getLessonAccess } from '@/src/features/lessons/lesson-locking';
import { setActiveLesson } from '@/src/features/lessons/progression-storage';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import type { Lesson } from '@/src/types/domain';

interface LessonDetailScreenProps {
  lessonId: string;
}

export function LessonDetailScreen({ lessonId }: LessonDetailScreenProps) {
  const router = useRouter();
  const { token, user } = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setIsLocked(false);
      setLockMessage(null);

      try {
        if (user?.id) {
          const access = await getLessonAccess(token, user.id, lessonId);
          if (!access.allowed) {
            setIsLocked(true);
            setLockMessage(access.message ?? 'Lesson is locked.');
          }
        }

        const response = await apiClient.getLesson(token, lessonId);
        setLesson(response.lesson);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load lesson.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    load().catch(() => null);
  }, [lessonId, token, user?.id]);

  if (!token) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.meta}>Sign in to view this lesson.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Loading lesson...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error || !lesson) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Lesson not found.'}</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const sortedTasks = [...lesson.tasks].sort((left, right) => left.order - right.order);

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.status}>{lesson.status}</Text>
      </View>

      <Text style={styles.description}>{lesson.description || 'No description provided.'}</Text>
      <Text style={styles.meta}>{sortedTasks.length} tasks</Text>

      {isLocked && lockMessage ? (
        <View style={styles.lockCard}>
          <Text style={styles.lockText}>{lockMessage}</Text>
        </View>
      ) : null}

      <View style={styles.taskList}>
        {sortedTasks.map((task, index) => (
          <View key={task.id} style={styles.taskCard}>
            <Text style={styles.taskOrder}>Task {index + 1}</Text>
            <Text style={styles.taskPrompt}>{task.prompt}</Text>
            <Text style={styles.taskType}>{task.type}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton
        title={isLocked ? 'Lesson Locked' : 'Start Lesson'}
        onPress={() => {
          if (isLocked) {
            return;
          }
          if (user?.id) {
            void setActiveLesson(user.id, lesson.id);
          }
          router.push({
            pathname: '/runner/[lessonId]',
            params: { lessonId: lesson.id },
          });
        }}
        disabled={isLocked}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
  },
  status: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  description: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  lockCard: {
    backgroundColor: '#ffedd5',
    borderColor: '#fdba74',
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 10,
    padding: 10,
  },
  lockText: {
    color: '#9a3412',
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  taskList: {
    gap: 10,
    marginVertical: 18,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  taskOrder: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  taskPrompt: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '500',
  },
  taskType: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
  },
});
