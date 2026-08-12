import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { border, fontSize, fontWeight, radii, spacing, surface, text } from '@/src/shared/theme';

interface TextFieldProps extends TextInputProps {
  error?: string | null;
  label: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { error, label, style, ...props },
  ref,
) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={text.placeholder}
        style={[styles.input, error && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing[2] },
  label: {
    color: text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  input: {
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: text.primary,
    fontSize: fontSize.lg,
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  inputError: { borderColor: border.error },
  error: { color: text.error, fontSize: fontSize.sm },
});
