import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { border, brand, controlSize, motion, radii, spacing, surface, text, typography } from '@/src/shared/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  accessibilityLabel?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  accessibilityLabel,
  icon,
}: PrimaryButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'quiet';
  const foreground = variant === 'danger' ? text.error : isSecondary ? text.brand : text.inverse;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={foreground} accessible={false} importantForAccessibility="no-hide-descendants" /> : null}
          {title ? <Text style={[styles.text, { color: foreground }]}>{title}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii.lg,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: controlSize.standard,
    minWidth: controlSize.standard,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  buttonSecondary: {
    backgroundColor: surface.card,
    borderColor: border.strong,
    borderWidth: 1,
  },
  buttonQuiet: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: motion.disabledOpacity,
  },
  buttonPressed: {
    opacity: motion.pressedOpacity,
  },
  text: {
    ...typography.label,
    textAlign: 'center',
    flexShrink: 1,
  },
});
