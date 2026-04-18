import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { VerificationBanner } from '@/src/features/auth/components/verification-banner';

export function ProfileScreen() {
  const router = useRouter();
  const { token, user, refreshProfile, logout } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setIsRefreshing(true);
      setError(null);

      try {
        await refreshProfile();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unable to refresh profile.');
        }
      } finally {
        setIsRefreshing(false);
      }
    };

    load().catch(() => null);
  }, [refreshProfile, token]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    if (token) {
      try {
        await apiClient.logout(token);
      } catch {
        // Ignore API errors for now. Local logout should still work.
      }
    }

    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>

        {isRefreshing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.meta}>Refreshing profile...</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Name" value={user?.name ?? 'Unknown'} />
          <Row label="Email" value={user?.email ?? 'Unknown'} />
          <Row label="Role" value={user?.role ?? 'Unknown'} />
          <Row
            label="Email verified"
            value={user?.emailVerified ? 'Yes' : 'No'}
          />
        </View>

        {user && user.emailVerified === false ? <VerificationBanner variant="block" /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title={isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          onPress={handleLogout}
          loading={isLoggingOut}
          disabled={isLoggingOut}
        />
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  row: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    color: '#64748b',
    fontSize: 14,
  },
  value: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
  },
});
