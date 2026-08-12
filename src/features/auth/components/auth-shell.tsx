import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { spacing, text, typography } from '@/src/shared/theme';
import { ScreenContainer } from '@/src/shared/ui/screen-container';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function AuthShell({
  children,
  eyebrow,
  subtitle,
  title,
}: PropsWithChildren<AuthShellProps>) {
  return (
    <ScreenContainer scroll maxWidth={420}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing[8],
  },
  header: {
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  eyebrow: {
    color: text.brand,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    ...typography.caption,
  },
  title: {
    color: text.primary,
    ...typography.display,
  },
  subtitle: {
    color: text.secondary,
    ...typography.body,
  },
});
