import { Ionicons } from '@expo/vector-icons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/src/shared/auth/session-context';
import { useFooterLayout } from '@/src/shared/ui/footer-inset-context';
import { border, brand, fontSize, fontWeight, layout, motion, radii, spacing, surface, text } from '@/src/shared/theme';

const FOOTER_ITEMS: {
  key: string;
  label: string;
  icon: 'home-outline' | 'reader-outline' | 'book-outline' | 'person-outline';
  activeIcon: 'home' | 'reader' | 'book' | 'person';
  href: Href;
  matches: string[];
}[] = [
  {
    key: 'lessons',
    label: 'Lessons',
    icon: 'home-outline',
    activeIcon: 'home',
    href: '/(tabs)/lessons',
    matches: ['/lessons'],
  },
  {
    key: 'vocabulary',
    label: 'Library',
    icon: 'book-outline',
    activeIcon: 'book',
    href: '/(tabs)/vocabulary',
    matches: ['/vocabulary'],
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    href: '/(tabs)/profile',
    matches: ['/profile'],
  },
];

export function GlobalFooter() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isInitializing } = useSession();
  const onFooterLayout = useFooterLayout();

  if (isInitializing || !isAuthenticated) {
    return null;
  }

  return (
    <View
      onLayout={onFooterLayout}
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.footer}>
        {FOOTER_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            item.matches.some((prefix) => pathname.startsWith(prefix));

          return (
            <Pressable
              key={item.key}
              accessibilityLabel={item.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.itemActive,
                pressed && styles.itemPressed,
              ]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? brand[700] : text.secondary}
                accessible={false}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: surface.card,
    borderTopColor: border.default,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing[5],
    position: 'absolute',
    right: 0,
  },
  footer: {
    alignSelf: 'center',
    maxWidth: layout.tabletMaxWidth,
    width: '100%',
    flexDirection: 'row',
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  item: {
    alignItems: 'center',
    borderRadius: radii.lg,
    flex: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: spacing[2],
    minHeight: 56,
  },
  itemActive: {
    backgroundColor: surface.active,
  },
  itemPressed: {
    opacity: motion.pressedOpacity,
  },
  label: {
    color: text.secondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  labelActive: {
    color: text.brand,
  },
});
