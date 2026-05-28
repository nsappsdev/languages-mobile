import { useEffect, useMemo, useState } from 'react';
import * as Application from 'expo-application';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getAppUpdatePromptKey,
  parseNativeBuildNumber,
  shouldShowAppUpdatePrompt,
} from '@/src/shared/app-version/app-version-policy';
import { apiClient } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { border, brand, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';
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
    <Modal transparent animationType="fade" visible onRequestClose={() => {
      if (!isRequired) {
        setDismissedPromptKey(promptKey);
      }
    }}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, isRequired && styles.requiredSheet]}>
          <Text style={styles.title}>{isRequired ? 'Update required' : 'Update available'}</Text>
          <Text style={styles.message}>{response.policy.message}</Text>
          <View style={styles.actions}>
            {!isRequired ? (
              <Pressable
                onPress={() => setDismissedPromptKey(promptKey)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={openStore} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
              <Text style={styles.primaryButtonText}>Update</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: surface.card,
    borderColor: border.subtle,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  requiredSheet: {
    borderColor: border.warning,
  },
  title: {
    color: text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: text.secondary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: brand[700],
    borderRadius: radii.lg,
    minWidth: 104,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: text.inverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: neutral[100],
    borderRadius: radii.lg,
    minWidth: 90,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: text.secondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  buttonPressed: {
    opacity: 0.86,
  },
});
