import { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getAppUpdatePromptKey,
  parseNativeBuildNumber,
  shouldShowAppUpdatePrompt,
} from '@/src/shared/app-version/app-version-policy';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import {
  border,
  controlSize,
  elevation,
  motion,
  palette,
  radii,
  spacing,
  surface,
  text,
  typography,
} from '@/src/shared/theme';
import type { AppPlatform, AppVersionResponse } from '@/src/types/domain';

function getNativePlatform(): AppPlatform | null {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS;
  }
  return null;
}

export function AppUpdateNotice() {
  const { token, isAuthenticated, isInitializing } = useSession();
  const [response, setResponse] = useState<AppVersionResponse | null>(null);
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string | null>(null);
  const platform = useMemo(getNativePlatform, []);
  const currentBuildNumber = parseNativeBuildNumber(Application.nativeBuildVersion);

  useEffect(() => {
    if (isInitializing || !isAuthenticated || !token || !platform || currentBuildNumber === null) {
      return;
    }

    let isMounted = true;

    apiClient
      .getAppVersion(token, platform, currentBuildNumber)
      .then((nextResponse) => {
        if (isMounted) {
          setResponse(shouldShowAppUpdatePrompt(nextResponse) ? nextResponse : null);
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('Failed to load app update policy.', error);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentBuildNumber, isAuthenticated, isInitializing, platform, token]);

  if (!response) {
    return null;
  }

  const promptKey = getAppUpdatePromptKey(response);
  const isRequired = response.update.required;

  if (!isRequired && dismissedPromptKey === promptKey) {
    return null;
  }

  const openStore = () => {
    Linking.openURL(response.policy.storeUrl).catch((error) => {
      if (__DEV__) {
        console.warn('Failed to open app store URL.', error);
      }
    });
  };

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      visible
      onRequestClose={() => {
        if (!isRequired) {
          setDismissedPromptKey(promptKey);
        }
      }}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.sheet, isRequired && styles.requiredSheet]}>
          <View style={[styles.iconWrap, isRequired && styles.requiredIconWrap]}>
            <Ionicons
              color={isRequired ? palette.accent : palette.primary}
              name={isRequired ? 'alert-circle-outline' : 'arrow-up-circle-outline'}
              size={28}
            />
          </View>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>{isRequired ? 'Action needed' : 'A new version is ready'}</Text>
            <Text accessibilityLiveRegion="assertive" accessibilityRole="header" style={styles.title}>
              {isRequired ? 'Update required' : 'Update available'}
            </Text>
          </View>
          <Text style={styles.message}>{response.policy.message}</Text>
          <View style={styles.actions}>
            {!isRequired ? (
              <Pressable
                accessibilityHint="Closes this notice until the app is opened again"
                accessibilityLabel="Update later"
                accessibilityRole="button"
                onPress={() => setDismissedPromptKey(promptKey)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityHint="Opens the app store"
              accessibilityRole="button"
              onPress={openStore}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              <Text style={styles.primaryButtonText}>Open app store</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: palette.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
  },
  sheet: {
    backgroundColor: surface.card,
    borderColor: border.default,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    gap: spacing[3],
    maxWidth: 420,
    padding: spacing[6],
    width: '100%',
    ...elevation.raised,
  },
  requiredSheet: {
    borderColor: palette.accent,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: palette.primarySoft,
    borderRadius: radii.full,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  requiredIconWrap: {
    backgroundColor: palette.warningSurface,
  },
  heading: {
    gap: spacing[1],
  },
  eyebrow: {
    color: text.brand,
    letterSpacing: 1,
    textTransform: 'uppercase',
    ...typography.caption,
  },
  title: {
    color: text.primary,
    ...typography.sectionTitle,
  },
  message: {
    color: text.secondary,
    ...typography.body,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap-reverse',
    gap: spacing[2],
    justifyContent: 'flex-end',
    marginTop: spacing[2],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: radii.lg,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: controlSize.standard,
    minWidth: 160,
    paddingHorizontal: spacing[4],
  },
  primaryButtonText: {
    color: text.inverse,
    ...typography.label,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: surface.card,
    borderColor: border.strong,
    borderRadius: radii.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: controlSize.standard,
    minWidth: 90,
    paddingHorizontal: spacing[4],
  },
  secondaryButtonText: {
    color: text.brand,
    ...typography.label,
  },
  buttonPressed: {
    opacity: motion.pressedOpacity,
  },
});
