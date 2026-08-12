import { Text, View } from 'react-native';
import { TaskWordFlow } from '@/src/features/tasks/components/task-word-flow';
import type { TaskWordFlowProps } from '@/src/features/tasks/components/task-word-flow.types';
import { styles } from '@/src/features/tasks/screens/task-runner-screen.styles';
import { PrimaryButton } from '@/src/shared/ui/primary-button';

export function RunnerItemCard({
  audioSource,
  audioTime,
  itemNumber,
  vocabularyNotice,
  wordFlowProps,
}: {
  audioSource: string;
  audioTime: string;
  itemNumber: number;
  vocabularyNotice: string | null;
  wordFlowProps: TaskWordFlowProps;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.itemLabel}>Item {itemNumber}</Text>
        <View style={styles.audioMetaRow}>
          <Text style={styles.audioMeta}>{audioSource}</Text>
          <Text style={styles.audioMeta}>{audioTime}</Text>
        </View>
      </View>

      <TaskWordFlow {...wordFlowProps} />

      {vocabularyNotice ? <Text style={styles.notice}>{vocabularyNotice}</Text> : null}
    </View>
  );
}

export function RunnerNavigationActions({
  isFirstItem,
  isLastItem,
  onNext,
  onPrevious,
}: {
  isFirstItem: boolean;
  isLastItem: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <View style={styles.navigationRow}>
      <PrimaryButton
        title="Previous"
        variant="secondary"
        onPress={onPrevious}
        disabled={isFirstItem}
      />
      <PrimaryButton title={isLastItem ? 'Finish Lesson' : 'Next Item'} onPress={onNext} />
    </View>
  );
}
