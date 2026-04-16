import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? brand[700] : neutral[0]} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>{title}</Text>
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
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonSecondary: {
    backgroundColor: surface.active,
    borderColor: border.active,
    borderWidth: 1,
  },
  buttonDisabled: {
    backgroundColor: neutral[400],
  },
  buttonPressed: {
    opacity: 0.9,
  },
  text: {
    color: text.inverse,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  textSecondary: {
    color: text.brand,
  },
});
