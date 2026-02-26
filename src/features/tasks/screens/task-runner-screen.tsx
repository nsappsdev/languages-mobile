import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { getLessonAccess } from '@/src/features/lessons/lesson-locking';
import {
  markLessonCompleted,
  setActiveLesson,
} from '@/src/features/lessons/progression-storage';
import { flushProgressQueue, queueProgressEvents } from '@/src/features/progress/progress-sync';
import { addSelectionToVocabulary } from '@/src/features/vocabulary/services/add-word-to-vocabulary';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import type { Lesson, ProgressEvent, Task } from '@/src/types/domain';

interface TaskRunnerScreenProps {
  lessonId: string;
}

interface TaskFeedback {
  isCorrect: boolean;
  message: string;
}

export function TaskRunnerScreen({ lessonId }: TaskRunnerScreenProps) {
  const router = useRouter();
  const { token, user } = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null);
  const [firstAttemptResults, setFirstAttemptResults] = useState<Record<string, boolean>>({});
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, true>>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});
  const [syncError, setSyncError] = useState<string | null>(null);
  const [vocabularyNotice, setVocabularyNotice] = useState<string | null>(null);
  const [selectedPromptText, setSelectedPromptText] = useState('');
  const [promptSelection, setPromptSelection] = useState({ start: 0, end: 0 });
  const [isSavingVocabulary, setIsSavingVocabulary] = useState(false);
  const promptInputRef = useRef<TextInput | null>(null);
  const addButtonPressInRef = useRef(false);
  const latestSelectionRef = useRef('');

  const clearPromptSelection = useCallback(() => {
    if (addButtonPressInRef.current || isSavingVocabulary) {
      return;
    }

    latestSelectionRef.current = '';
    setSelectedPromptText('');
    setPromptSelection({ start: 0, end: 0 });
    promptInputRef.current?.blur();
  }, [isSavingVocabulary]);

  useEffect(() => {
    if (!token || !lessonId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (user?.id) {
          const access = await getLessonAccess(token, user.id, lessonId);
          if (!access.allowed) {
            setError(access.message ?? 'Lesson is locked.');
            setLesson(null);
            return;
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

  useEffect(() => {
    if (!user?.id || !lessonId) return;
    void setActiveLesson(user.id, lessonId);
  }, [lessonId, user?.id]);

  const tasks = useMemo(
    () => (lesson ? [...lesson.tasks].sort((left, right) => left.order - right.order) : []),
    [lesson],
  );

  const currentTask = tasks[currentTaskIndex];

  useEffect(() => {
    setTypedAnswer('');
    setSelectedOptionId(null);
    setFeedback(null);
    setSelectedPromptText('');
    setPromptSelection({ start: 0, end: 0 });
    setVocabularyNotice(null);
  }, [currentTaskIndex]);

  const progressText = `${Math.min(currentTaskIndex + 1, Math.max(tasks.length, 1))} / ${Math.max(tasks.length, 1)}`;

  const queueProgressEvent = useCallback(
    (event: Omit<ProgressEvent, 'idempotencyKey' | 'clientTimestamp'>) => {
      if (!token) return;
      void queueProgressEvents([{
        ...event,
        idempotencyKey: createIdempotencyKey(event.eventType, event.lessonId, event.taskId),
        clientTimestamp: new Date().toISOString(),
      }]).then((result) => {
        if (!result.ok) {
          setSyncError(result.message ?? 'Progress sync is pending. We will retry automatically.');
          return;
        }
        if (result.pending === 0) {
          setSyncError(null);
        }
      });
    },
    [token],
  );

  const handleAddSelectionToVocabulary = useCallback(async () => {
    const selectionToAdd = (latestSelectionRef.current || selectedPromptText).trim();
    if (!selectionToAdd) {
      return;
    }

    if (!token || !user?.id) {
      setVocabularyNotice('Sign in to add words to vocabulary.');
      return;
    }

    setIsSavingVocabulary(true);
    try {
      const result = await addSelectionToVocabulary(token, user.id, selectionToAdd);
      setVocabularyNotice(result.message);
      if (result.ok) {
        clearPromptSelection();
      }
    } finally {
      addButtonPressInRef.current = false;
      setIsSavingVocabulary(false);
    }
  }, [clearPromptSelection, selectedPromptText, token, user?.id]);

  useEffect(() => {
    if (!token) return;
    return () => {
      void flushProgressQueue({ force: true });
    };
  }, [token]);

  const submit = () => {
    if (!currentTask) return;

    const answer = getAnswerValue(currentTask.type, selectedOptionId, typedAnswer);
    if (!answer) {
      setFeedback({
        isCorrect: false,
        message: 'Please select or enter an answer first.',
      });
      return;
    }

    const attemptNumber = (attemptCounts[currentTask.id] ?? 0) + 1;
    setAttemptCounts((prev) => ({ ...prev, [currentTask.id]: attemptNumber }));

    const result = evaluateAnswer(currentTask, answer);
    if (firstAttemptResults[currentTask.id] === undefined) {
      setFirstAttemptResults((prev) => ({ ...prev, [currentTask.id]: result.isCorrect }));
    }

    queueProgressEvent({
      lessonId,
      taskId: currentTask.id,
      eventType: 'TASK_ATTEMPT',
      attemptNumber,
      isCorrect: result.isCorrect,
      payload: {
        taskType: currentTask.type,
      },
    });

    setFeedback(result);
  };

  const completeCurrentTaskAndContinue = async (isCorrect: boolean) => {
    if (!currentTask) return;
    const updatedCompleted = { ...completedTaskIds, [currentTask.id]: true as const };
    const completion = calculateCompletion(updatedCompleted, tasks.length);

    queueProgressEvent({
      lessonId,
      taskId: currentTask.id,
      eventType: 'TASK_COMPLETED',
      isCorrect,
      completion,
    });

    setCompletedTaskIds(updatedCompleted);

    if (currentTaskIndex === tasks.length - 1) {
      const score = calculateScore(firstAttemptResults, updatedCompleted, tasks.length);
      const lessonCompletion = calculateCompletion(updatedCompleted, tasks.length);

      queueProgressEvent({
        lessonId,
        eventType: 'LESSON_COMPLETED',
        score,
        completion: lessonCompletion,
      });

      const flushResult = await flushProgressQueue({ force: true });
      if (!flushResult.ok) {
        setSyncError(
          flushResult.message ?? 'Progress sync is pending. We will retry automatically.',
        );
      } else if (flushResult.pending === 0) {
        setSyncError(null);
      }

      if (user?.id) {
        await markLessonCompleted(user.id, lessonId);
      }

      router.replace({
        pathname: '/results/[lessonId]',
        params: {
          lessonId,
          score: String(score),
          total: String(tasks.length),
          completion: String(lessonCompletion),
        },
      });
      return;
    }

    setCurrentTaskIndex((prev) => prev + 1);
  };

  const skipCurrentTask = () => {
    if (!currentTask) return;

    if (firstAttemptResults[currentTask.id] === undefined) {
      setFirstAttemptResults((prev) => ({ ...prev, [currentTask.id]: false }));
    }

    void completeCurrentTaskAndContinue(false);
  };

  if (!token) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.meta}>Sign in to run tasks.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Preparing lesson...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error || !lesson || !currentTask) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Unable to load task runner.'}</Text>
        </View>
      </ScreenContainer>
    );
  }

  const showNext = Boolean(feedback?.isCorrect);

  return (
    <ScreenContainer scroll>
      <TouchableWithoutFeedback onPress={clearPromptSelection} accessible={false}>
        <View>
          <View style={styles.header}>
            <Text style={styles.title}>{lesson.title}</Text>
            <Text style={styles.progress}>{progressText}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.taskType}>{currentTask.type}</Text>
            <TextInput
              ref={promptInputRef}
              key={`${currentTask.id}:${currentTask.prompt}`}
              contextMenuHidden={false}
              editable
              defaultValue={currentTask.prompt}
              multiline
              onSelectionChange={(event) => {
                const nextSelection = {
                  start: event.nativeEvent.selection.start,
                  end: event.nativeEvent.selection.end,
                };
                setPromptSelection(nextSelection);
                const selectedText = extractSelectionText(
                  currentTask.prompt,
                  nextSelection.start,
                  nextSelection.end,
                );
                if (selectedText) {
                  latestSelectionRef.current = selectedText;
                  setSelectedPromptText(selectedText);
                  return;
                }

                if (!addButtonPressInRef.current) {
                  latestSelectionRef.current = '';
                  setSelectedPromptText('');
                }
              }}
              onBlur={clearPromptSelection}
              scrollEnabled={false}
              selection={promptSelection}
              selectTextOnFocus={false}
              showSoftInputOnFocus={false}
              style={styles.promptInput}
            />
            <Text style={styles.promptHint}>
              Select any part of the task text, then tap Add to Vocabulary.
            </Text>
            {shouldShowAddToVocabularyButton(selectedPromptText) ? (
              <Pressable
                onPressIn={() => {
                  addButtonPressInRef.current = true;
                  latestSelectionRef.current = selectedPromptText.trim();
                }}
                onPressOut={() => {
                  addButtonPressInRef.current = false;
                }}
                onPress={() => {
                  void handleAddSelectionToVocabulary();
                }}
                style={({ pressed }) => [
                  styles.addVocabularyButton,
                  isSavingVocabulary && styles.addVocabularyButtonDisabled,
                  pressed && !isSavingVocabulary && styles.addVocabularyButtonPressed,
                ]}
                disabled={isSavingVocabulary}>
                <Text style={styles.addVocabularyButtonText}>
                  {isSavingVocabulary ? 'Saving...' : 'Add to Vocabulary'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {renderAnswerInput({
            task: currentTask,
            selectedOptionId,
            setSelectedOptionId,
            typedAnswer,
            setTypedAnswer,
          })}

          {feedback ? (
            <View style={[styles.feedback, feedback.isCorrect ? styles.feedbackGood : styles.feedbackBad]}>
              <Text style={styles.feedbackText}>{feedback.message}</Text>
            </View>
          ) : null}

          {syncError ? (
            <View style={styles.syncNotice}>
              <Text style={styles.syncNoticeText}>{syncError}</Text>
            </View>
          ) : null}

          {vocabularyNotice ? (
            <View style={styles.vocabularyNotice}>
              <Text style={styles.vocabularyNoticeText}>{vocabularyNotice}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton title="Submit" onPress={submit} />

            {showNext ? (
              <PrimaryButton
                title={currentTaskIndex === tasks.length - 1 ? 'Finish Lesson' : 'Next Task'}
                onPress={() => void completeCurrentTaskAndContinue(true)}
              />
            ) : (
              <Pressable onPress={skipCurrentTask} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip Task</Text>
              </Pressable>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScreenContainer>
  );
}

function renderAnswerInput({
  task,
  selectedOptionId,
  setSelectedOptionId,
  typedAnswer,
  setTypedAnswer,
}: {
  task: Task;
  selectedOptionId: string | null;
  setSelectedOptionId: (value: string | null) => void;
  typedAnswer: string;
  setTypedAnswer: (value: string) => void;
}) {
  if (task.type === 'PICK_ONE' || task.type === 'MATCH' || task.type === 'LISTENING_TEXT') {
    return (
      <View style={styles.options}>
        {task.options.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setSelectedOptionId(option.id)}
            style={[
              styles.optionButton,
              selectedOptionId === option.id && styles.optionButtonSelected,
            ]}>
            <Text
              style={[
                styles.optionText,
                selectedOptionId === option.id && styles.optionTextSelected,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <TextInput
      autoCapitalize="none"
      onChangeText={setTypedAnswer}
      placeholder="Type your answer"
      style={styles.input}
      value={typedAnswer}
    />
  );
}

function getAnswerValue(type: Task['type'], selectedOptionId: string | null, typedAnswer: string) {
  if (type === 'PICK_ONE' || type === 'MATCH' || type === 'LISTENING_TEXT') {
    return selectedOptionId?.trim() ?? '';
  }
  return typedAnswer.trim();
}

function evaluateAnswer(task: Task, answer: string): TaskFeedback {
  if (task.type === 'PICK_ONE' || task.type === 'MATCH' || task.type === 'LISTENING_TEXT') {
    const correctOption = task.options.find((option) => option.isCorrect);
    const isCorrect = Boolean(correctOption && correctOption.id === answer);
    return {
      isCorrect,
      message: isCorrect
        ? 'Correct. Great job.'
        : `Not quite. Correct answer: ${correctOption?.label ?? 'N/A'}`,
    };
  }

  const configAnswers = Array.isArray(task.config.correctAnswers)
    ? task.config.correctAnswers
    : [];
  const normalizedAnswer = normalizeText(answer);
  const normalizedExpected = configAnswers.map((candidate) => normalizeText(candidate));
  const isCorrect = normalizedExpected.includes(normalizedAnswer);

  return {
    isCorrect,
    message: isCorrect
      ? 'Correct. Great job.'
      : `Try again. Accepted answers: ${configAnswers.join(', ') || 'N/A'}`,
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function calculateScore(
  firstAttemptResults: Record<string, boolean>,
  completedTaskIds: Record<string, true>,
  totalTasks: number,
) {
  if (totalTasks === 0) return 0;

  const firstAttemptCorrectCount = Object.entries(firstAttemptResults).filter(
    ([taskId, result]) => result && completedTaskIds[taskId],
  ).length;

  return Math.round((firstAttemptCorrectCount / totalTasks) * 100);
}

function calculateCompletion(completedTaskIds: Record<string, true>, totalTasks: number) {
  if (totalTasks === 0) return 0;
  return Math.round((Object.keys(completedTaskIds).length / totalTasks) * 100);
}

function createIdempotencyKey(eventType: string, lessonId: string, taskId?: string) {
  return `${eventType}:${lessonId}:${taskId ?? 'lesson'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function extractSelectionText(source: string, start: number, end: number) {
  if (end <= start) {
    return '';
  }

  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function shouldShowAddToVocabularyButton(selectedPromptText: string) {
  return selectedPromptText.trim().length > 0;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    marginRight: 10,
  },
  progress: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
    padding: 14,
    position: 'relative',
  },
  taskType: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  promptInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    minHeight: 96,
    padding: 10,
    paddingBottom: 46,
  },
  promptHint: {
    color: '#64748b',
    fontSize: 12,
  },
  addVocabularyButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 999,
    bottom: 10,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 10,
  },
  addVocabularyButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addVocabularyButtonPressed: {
    opacity: 0.9,
  },
  addVocabularyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  options: {
    gap: 10,
    marginBottom: 16,
  },
  optionButton: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#ccfbf1',
    borderColor: '#0f766e',
  },
  optionText: {
    color: '#0f172a',
    fontSize: 15,
  },
  optionTextSelected: {
    color: '#115e59',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  feedback: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  feedbackGood: {
    backgroundColor: '#dcfce7',
  },
  feedbackBad: {
    backgroundColor: '#fee2e2',
  },
  feedbackText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
  },
  syncNotice: {
    backgroundColor: '#ffedd5',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  syncNoticeText: {
    color: '#9a3412',
    fontSize: 13,
    fontWeight: '500',
  },
  vocabularyNotice: {
    backgroundColor: '#ecfeff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  vocabularyNoticeText: {
    color: '#155e75',
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    gap: 10,
  },
  skipButton: {
    alignItems: 'center',
    borderColor: '#94a3b8',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  skipText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: '#475569',
    fontSize: 14,
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center',
  },
});
