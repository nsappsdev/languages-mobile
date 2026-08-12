import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, spacing, text } from '@/src/shared/theme';
import { PrimaryButton } from './primary-button';

export function FeedbackState({
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
    <View style={styles.container}>
      {loading ? <ActivityIndicator accessibilityLabel={title} size="large" /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? <PrimaryButton title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
    justifyContent: 'center',
    padding: spacing[6],
  },
  title: { color: text.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  message: { color: text.secondary, fontSize: fontSize.md, lineHeight: 22, textAlign: 'center' },
});
