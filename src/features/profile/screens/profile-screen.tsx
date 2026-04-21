import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { VerificationBanner } from '@/src/features/auth/components/verification-banner';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

export function ProfileScreen() {
  const router = useRouter();
  const { token, user, refreshProfile, updateProfile, logout } = useSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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

  const handleStartEditName = () => {
    setNameDraft(user?.name ?? '');
    setNameError(null);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameDraft('');
    setNameError(null);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 80) {
      setNameError('Name must be at most 80 characters.');
      return;
    }
    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    setNameError(null);
    try {
      await updateProfile({ name: trimmed });
      setIsEditingName(false);
      setNameDraft('');
    } catch (err) {
      if (err instanceof ApiError) {
        setNameError(err.message);
      } else if (err instanceof Error) {
        setNameError(err.message);
      } else {
        setNameError('Failed to update name.');
      }
    } finally {
      setIsSavingName(false);
    }
  };

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
          <View style={styles.nameRow}>
            <Text style={styles.label}>Name</Text>
            {isEditingName ? (
              <View style={styles.editGroup}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Your name"
                  placeholderTextColor={neutral[400]}
                  autoFocus
                  editable={!isSavingName}
                  maxLength={80}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleSaveName();
                  }}
                  style={styles.input}
                />
                {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
                <View style={styles.editActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCancelEditName}
                    disabled={isSavingName}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && !isSavingName && styles.buttonPressed,
                    ]}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void handleSaveName();
                    }}
                    disabled={isSavingName}
                    style={({ pressed }) => [
                      styles.saveButton,
                      isSavingName && styles.saveButtonDisabled,
                      pressed && !isSavingName && styles.buttonPressed,
                    ]}>
                    {isSavingName ? (
                      <ActivityIndicator color={neutral[0]} size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.nameDisplay}>
                <Text style={styles.value}>{user?.name ?? 'Unknown'}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleStartEditName}
                  style={({ pressed }) => [styles.editLink, pressed && styles.buttonPressed]}>
                  <Text style={styles.editLinkText}>Edit</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Row label="Email" value={user?.email ?? 'Unknown'} />
          <Row
            label="Email verified"
            value={user?.emailVerified ? 'Yes' : 'No'}
            isLast
          />
        </View>

        {user && user.emailVerified !== true ? <VerificationBanner variant="block" /> : null}

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

function Row({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
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
    color: text.primary,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  meta: {
    color: text.secondary,
    fontSize: fontSize.base,
  },
  card: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
  },
  nameRow: {
    borderBottomColor: border.default,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  nameDisplay: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  editGroup: {
    gap: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.md,
    borderWidth: 1,
    color: text.primary,
    fontSize: fontSize.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    borderColor: border.default,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: text.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  saveButton: {
    backgroundColor: brand[700],
    borderRadius: radii.md,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    backgroundColor: neutral[400],
  },
  saveButtonText: {
    color: neutral[0],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  editLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editLinkText: {
    color: text.brand,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  fieldError: {
    color: text.error,
    fontSize: fontSize.sm,
  },
  row: {
    borderBottomColor: border.default,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: text.secondary,
    fontSize: fontSize.base,
  },
  value: {
    color: text.primary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  error: {
    color: text.error,
    fontSize: fontSize.sm,
  },
});
