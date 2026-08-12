import { Ionicons } from '@expo/vector-icons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/src/shared/auth/session-context';
import { useFooterLayout } from '@/src/shared/ui/footer-inset-context';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

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
    label: 'Dashboard',
    icon: 'home-outline',
    activeIcon: 'home',
    href: '/(tabs)/lessons',
    matches: [],
  },
  {
    key: 'lessons-2',
    label: 'Lessons 2',
    icon: 'reader-outline',
    activeIcon: 'reader',
    href: '/(tabs)/lessons-2',
    matches: [],
  },
  {
    key: 'vocabulary',
    label: 'Vocabulary',
    icon: 'book-outline',
    activeIcon: 'book',
    href: '/(tabs)/vocabulary',
    matches: [],
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    href: '/(tabs)/profile',
    matches: [],
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
                size={20}
                color={isActive ? brand[700] : neutral[500]}
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
    backgroundColor: 'transparent',
    bottom: 0,
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
  },
  footer: {
    backgroundColor: surface.overlay,
    borderColor: border.subtle,
    borderRadius: radii['3xl'],
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    boxShadow: '0px 4px 12px rgba(23, 33, 31, 0.05)',
  },
  item: {
    alignItems: 'center',
    borderRadius: radii.xl,
    flex: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: surface.active,
  },
  itemPressed: {
    opacity: 0.86,
  },
  label: {
    color: text.muted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  labelActive: {
    color: text.brand,
  },
});
