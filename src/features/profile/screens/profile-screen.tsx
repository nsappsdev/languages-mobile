import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { VerificationBanner } from '@/src/features/auth/components/verification-banner';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import {
  border,
  controlSize,
  motion,
  palette,
  radii,
  spacing,
  status,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import { Card } from '@/src/shared/ui/card';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { TextField } from '@/src/shared/ui/text-field';

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
    <ScreenContainer scroll maxWidth={680}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Your account</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Profile
          </Text>
          <Text style={styles.subtitle}>Keep your details current and your learning access secure.</Text>
        </View>

        {isRefreshing ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator color={palette.primary} size="small" />
            <Text style={styles.meta}>Refreshing profile…</Text>
          </View>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.identityIcon}>
              <Ionicons color={palette.primary} name="person-outline" size={24} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Personal details</Text>
              <Text style={styles.cardSubtitle}>Used to identify your learning account.</Text>
            </View>
          </View>

          <View style={styles.nameRow}>
            {isEditingName ? (
              <View style={styles.editGroup}>
                <TextField
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  label="Name"
                  error={nameError}
                  placeholder="Your name"
                  autoFocus
                  editable={!isSavingName}
                  maxLength={80}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleSaveName();
                  }}
                />
                <View style={styles.editActions}>
                  <Pressable
                    accessibilityLabel="Cancel name edit"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSavingName }}
                    onPress={handleCancelEditName}
                    disabled={isSavingName}
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && !isSavingName && styles.buttonPressed,
                    ]}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Save name"
                    accessibilityRole="button"
                    accessibilityState={{ busy: isSavingName, disabled: isSavingName }}
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
                      <ActivityIndicator color={text.inverse} size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.detailRow}>
                <View style={styles.detailText}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.value}>{user?.name ?? 'Unknown'}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Edit name"
                  accessibilityRole="button"
                  onPress={handleStartEditName}
                  style={({ pressed }) => [styles.editLink, pressed && styles.buttonPressed]}>
                  <Text style={styles.editLinkText}>Edit</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Row label="Email" value={user?.email ?? 'Unknown'} />
          <View style={styles.rowLast}>
            <View style={styles.detailText}>
              <Text style={styles.label}>Email status</Text>
              <View
                accessibilityLabel={user?.emailVerified ? 'Email verified' : 'Email not verified'}
                style={[styles.statusPill, user?.emailVerified ? styles.verifiedPill : styles.pendingPill]}>
                <Ionicons
                  color={user?.emailVerified ? palette.success : palette.warning}
                  name={user?.emailVerified ? 'checkmark-circle-outline' : 'time-outline'}
                  size={16}
                />
                <Text style={user?.emailVerified ? styles.verifiedText : styles.pendingText}>
                  {user?.emailVerified ? 'Verified' : 'Pending verification'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {user && user.emailVerified !== true ? <VerificationBanner variant="block" /> : null}

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.signOutSection}>
          <Text style={styles.signOutHint}>Sign out on this device. Your lesson progress remains saved.</Text>
          <PrimaryButton
            title={isLoggingOut ? 'Signing out…' : 'Sign out'}
            onPress={() => {
              void handleLogout();
            }}
            loading={isLoggingOut}
            disabled={isLoggingOut}
            variant="danger"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.detailText}>
        <Text style={styles.label}>{label}</Text>
        <Text selectable style={styles.value}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing[4],
    paddingBottom: spacing[6],
  },
  header: {
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  eyebrow: {
    color: text.brand,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    ...typography.caption,
  },
  title: {
    color: text.primary,
    ...typography.screenTitle,
  },
  subtitle: {
    color: text.secondary,
    maxWidth: 520,
    ...typography.body,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  meta: {
    color: text.secondary,
    ...typography.label,
  },
  card: {
    padding: spacing[5],
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  identityIcon: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: radii.full,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cardHeaderText: {
    flex: 1,
    gap: spacing[1],
  },
  cardTitle: {
    color: text.primary,
    ...typography.cardTitle,
  },
  cardSubtitle: {
    color: text.secondary,
    ...typography.caption,
  },
  nameRow: {
    borderBottomColor: border.default,
    borderBottomWidth: 1,
    paddingVertical: spacing[3],
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  detailText: {
    flex: 1,
    gap: spacing[1],
  },
  editGroup: {
    gap: spacing[3],
  },
  editActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: border.strong,
    borderRadius: radii.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: controlSize.minimumTarget,
    paddingHorizontal: spacing[4],
  },
  cancelButtonText: {
    color: text.primary,
    ...typography.label,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    justifyContent: 'center',
    minHeight: controlSize.minimumTarget,
    minWidth: 88,
    paddingHorizontal: spacing[4],
  },
  saveButtonDisabled: {
    opacity: motion.disabledOpacity,
  },
  saveButtonText: {
    color: text.inverse,
    textAlign: 'center',
    ...typography.label,
  },
  buttonPressed: {
    opacity: motion.pressedOpacity,
  },
  editLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controlSize.minimumTarget,
    paddingHorizontal: spacing[3],
  },
  editLinkText: {
    color: text.brand,
    ...typography.label,
  },
  row: {
    borderBottomColor: border.default,
    borderBottomWidth: 1,
    paddingVertical: spacing[3],
  },
  rowLast: {
    paddingTop: spacing[3],
  },
  label: {
    color: text.secondary,
    ...typography.caption,
  },
  value: {
    color: text.primary,
    ...typography.body,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  verifiedPill: {
    backgroundColor: palette.successSurface,
  },
  pendingPill: {
    backgroundColor: palette.warningSurface,
  },
  verifiedText: {
    color: palette.success,
    ...typography.caption,
  },
  pendingText: {
    color: palette.warning,
    ...typography.caption,
  },
  errorNotice: {
    backgroundColor: status.errorBg,
    borderRadius: radii.lg,
    padding: spacing[3],
  },
  error: {
    color: text.error,
    ...typography.label,
  },
  signOutSection: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  signOutHint: {
    color: text.secondary,
    ...typography.body,
  },
});
