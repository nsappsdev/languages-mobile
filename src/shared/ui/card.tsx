import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { border, elevation, motion, radii, spacing, surface } from '@/src/shared/theme';

interface CardProps {
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Card({
  accessibilityLabel,
  children,
  onPress,
  selected = false,
  style,
}: PropsWithChildren<CardProps>) {
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          selected && styles.selected,
          pressed && styles.pressed,
          style,
        ]}>
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, selected && styles.selected, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing[4],
  },
  selected: {
    borderColor: border.active,
    ...elevation.focus,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
