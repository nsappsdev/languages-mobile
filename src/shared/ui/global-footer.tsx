import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/src/shared/auth/session-context';

const FOOTER_ITEMS = [
  {
    key: 'lessons',
    label: 'Dashboard',
    icon: 'home-outline' as const,
    activeIcon: 'home' as const,
    href: '/(tabs)/lessons',
    matches: ['/lesson/', '/runner/', '/results/'],
  },
  {
    key: 'vocabulary',
    label: 'Vocabulary',
    icon: 'book-outline' as const,
    activeIcon: 'book' as const,
    href: '/(tabs)/vocabulary',
    matches: [],
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline' as const,
    activeIcon: 'person' as const,
    href: '/(tabs)/profile',
    matches: [],
  },
];

export function GlobalFooter() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isInitializing } = useSession();

  if (isInitializing || !isAuthenticated) {
    return null;
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.footer}>
        {FOOTER_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            item.matches.some((prefix) => pathname.startsWith(prefix));

          return (
            <Pressable
              key={item.key}
              onPress={() => router.replace(item.href as never)}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.itemActive,
                pressed && styles.itemPressed,
              ]}>
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={20}
                color={isActive ? '#0f766e' : '#64748b'}
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
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  item: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: '#ecfeff',
  },
  itemPressed: {
    opacity: 0.85,
  },
  label: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  labelActive: {
    color: '#0f766e',
  },
});
