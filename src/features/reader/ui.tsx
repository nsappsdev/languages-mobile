import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps, PropsWithChildren } from 'react';
import { palette, radii, spacing, typography } from '@/src/shared/theme';
import { PrimaryButton } from '@/src/shared/ui/primary-button';

export const ui = StyleSheet.create({
  eyebrow: { color: palette.inkMuted, ...typography.caption, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: palette.ink, ...typography.screenTitle },
  subtitle: { color: palette.inkMuted, ...typography.body },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  stack: { gap: spacing[4] },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radii.xl, padding: spacing[5], gap: spacing[3] },
  word: { color: palette.ink, ...typography.sectionTitle },
  chip: { color: palette.inkMuted, ...typography.caption },
  notice: { color: palette.danger, ...typography.body, backgroundColor: palette.dangerSurface, padding: spacing[3], borderRadius: radii.lg },
  divider: { height: 1, backgroundColor: palette.border },
});

export function Action({ title, onPress, secondary = false, disabled = false, label, icon }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string;
  icon?: ComponentProps<typeof PrimaryButton>['icon'];
}) {
  return <PrimaryButton title={title} onPress={onPress} disabled={disabled} accessibilityLabel={label}
    variant={secondary ? 'secondary' : 'primary'} icon={icon} />;
}

export function ResourceState({ loading, error, retry, children }: PropsWithChildren<{ loading: boolean; error: string | null; retry: () => void }>) {
  if (loading) return <View style={ui.card}><ActivityIndicator color={palette.primary} /><Text style={ui.subtitle}>Loading your reading space…</Text></View>;
  if (error) return <View style={ui.card}><Text accessibilityRole="alert" style={ui.notice}>{error}</Text><Action title="Try again" onPress={retry} /></View>;
  return <>{children}</>;
}
