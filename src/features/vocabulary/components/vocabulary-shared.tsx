import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  border,
  brand,
  controlSize,
  elevation,
  iconSize,
  motion,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export function VocabularyBackButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={spacing[1]}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={iconSize.md} color={brand[700]} />
      <Text style={styles.backButtonText}>Vocabulary</Text>
    </Pressable>
  );
}

export function VocabularySearchField({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchShell}>
      <Ionicons
        accessibilityElementsHidden
        importantForAccessibility="no"
        name="search-outline"
        size={iconSize.lg}
        color={text.placeholder}
      />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={text.placeholder}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={spacing[2]}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
          <Ionicons name="close-circle" size={iconSize.lg} color={text.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function VocabularyEmptyState({
  icon = 'book-outline',
  text: description,
  title,
}: {
  icon?: IoniconName;
  text: string;
  title: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={iconSize.xl} color={brand[700]} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </View>
  );
}

export function VocabularySyncNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.syncNotice}>
      <Ionicons name="cloud-offline-outline" size={iconSize.lg} color={brand[700]} />
      <Text style={styles.syncText}>{message}</Text>
    </View>
  );
}

export const vocabularySharedStyles = StyleSheet.create({
  pressed: {
    opacity: motion.pressedOpacity,
  },
  eyebrow: {
    color: text.brand,
    ...typography.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: text.primary,
    ...typography.screenTitle,
  },
  body: {
    color: text.secondary,
    ...typography.body,
  },
  caption: {
    color: text.secondary,
    ...typography.caption,
  },
});

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing[1],
    minHeight: controlSize.minimumTarget,
    paddingRight: spacing[2],
  },
  backButtonText: {
    color: text.brand,
    ...typography.label,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
  searchShell: {
    alignItems: 'center',
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    minHeight: controlSize.standard,
    paddingHorizontal: spacing[3],
    ...elevation.raised,
  },
  searchInput: {
    color: text.primary,
    flex: 1,
    ...typography.body,
    minHeight: controlSize.standard,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    height: controlSize.minimumTarget,
    justifyContent: 'center',
    marginRight: -spacing[2],
    width: controlSize.minimumTarget,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[6],
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderRadius: radii.full,
    height: controlSize.standard,
    justifyContent: 'center',
    marginBottom: spacing[1],
    width: controlSize.standard,
  },
  emptyTitle: {
    color: text.primary,
    ...typography.cardTitle,
    textAlign: 'center',
  },
  emptyText: {
    color: text.secondary,
    ...typography.body,
    textAlign: 'center',
  },
  syncNotice: {
    alignItems: 'center',
    backgroundColor: surface.active,
    borderColor: border.active,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  syncText: {
    color: text.brand,
    flex: 1,
    ...typography.caption,
  },
});
