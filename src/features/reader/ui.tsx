import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { palette } from '@/src/shared/theme';

export const ui = StyleSheet.create({
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -1 },
  subtitle: { color: palette.inkMuted, fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 16 },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 22, padding: 22, gap: 14 },
  word: { color: palette.ink, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  translation: { color: palette.primaryStrong, fontSize: 22, lineHeight: 32 },
  chip: { color: palette.primary, backgroundColor: palette.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, fontSize: 12, overflow: 'hidden' },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderStrong },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: palette.primaryStrong },
  notice: { color: palette.danger, fontSize: 14, lineHeight: 21, backgroundColor: palette.dangerSurface, padding: 14, borderRadius: 14 },
  divider: { height: 1, backgroundColor: palette.border },
});

export function Action({ title, onPress, secondary = false, disabled = false, label }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function ResourceState({ loading, error, retry, children }: PropsWithChildren<{ loading: boolean; error: string | null; retry: () => void }>) {
  if (loading) return <View style={ui.card}><ActivityIndicator color={palette.primary} /><Text style={ui.subtitle}>Loading your reading space…</Text></View>;
  if (error) return <View style={ui.card}><Text accessibilityRole="alert" style={ui.notice}>{error}</Text><Action title="Try again" onPress={retry} /></View>;
  return <>{children}</>;
}
