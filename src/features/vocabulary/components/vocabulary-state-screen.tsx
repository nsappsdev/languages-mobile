import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { FeedbackState } from '@/src/shared/ui/feedback-state';

export function VocabularyStateScreen({
  actionLabel,
  loading = false,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  loading?: boolean;
  message?: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <ScreenContainer>
      <FeedbackState
        actionLabel={actionLabel}
        loading={loading}
        message={message}
        onAction={onAction}
        title={title}
      />
    </ScreenContainer>
  );
}
