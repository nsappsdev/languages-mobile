import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { border, brand, fontSize, fontWeight, neutral, radii, text } from '@/src/shared/theme';
import type { VerificationStatusResponse } from '@/src/types/domain';

type Variant = 'card' | 'block';

interface Props {
  variant?: Variant;
  title?: string;
  body?: string;
}

export function VerificationBanner({ variant = 'card', title, body }: Props) {
  const { token, user, refreshProfile } = useSession();
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const next = await apiClient.verificationStatus(token);
      setStatus(next);
    } catch {
      // Non-fatal — UI can still offer a resend attempt
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const canResendAtMs = status ? new Date(status.canResendAt).getTime() : 0;
  const secondsUntilResend = Math.max(0, Math.ceil((canResendAtMs - now) / 1000));
  const attemptsRemaining = status?.remainingAttempts ?? null;
  const noAttemptsLeft = attemptsRemaining === 0;
  const buttonDisabled = isSending || secondsUntilResend > 0 || noAttemptsLeft;

  const handleResend = useCallback(async () => {
    if (!token || buttonDisabled) return;
    setIsSending(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const response = await apiClient.resendVerification(token);
      setStatus({
        emailVerified: false,
        canResendAt: response.canResendAt,
        remainingAttempts: response.remainingAttempts,
        windowMaxAttempts: response.windowMaxAttempts,
      });
      setFeedback('Verification email sent. Check your inbox.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'RESEND_RATE_LIMITED') {
          setErrorMsg('Too many attempts. Try again later.');
          void loadStatus();
        } else if (err.code === 'ALREADY_VERIFIED') {
          setFeedback('Your email is already verified.');
          await refreshProfile();
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg('Unable to send verification email.');
      }
    } finally {
      setIsSending(false);
    }
  }, [buttonDisabled, loadStatus, refreshProfile, token]);

  const handleCheckStatus = useCallback(async () => {
    try {
      await refreshProfile();
      await loadStatus();
    } catch {
      // Ignore
    }
  }, [loadStatus, refreshProfile]);

  const buttonLabel = useMemo(() => {
    if (isSending) return 'Sending…';
    if (secondsUntilResend > 0) return `Resend in ${secondsUntilResend}s`;
    if (noAttemptsLeft) return 'Try again later';
    return 'Resend verification email';
  }, [isSending, noAttemptsLeft, secondsUntilResend]);

  if (!user) return null;

  const resolvedTitle = title ?? 'Verify your email';
  const resolvedBody = body ?? `We sent a verification link to ${user.email}. Verify to unlock lessons.`;

  return (
    <View style={[styles.card, variant === 'block' ? styles.block : null]}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>✉️</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.body}>{resolvedBody}</Text>
        </View>
      </View>

      {attemptsRemaining !== null ? (
        <Text style={styles.meta}>
          {attemptsRemaining} of {status?.windowMaxAttempts ?? 5} resends available this hour.
        </Text>
      ) : null}

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resend verification email"
          disabled={buttonDisabled}
          onPress={() => {
            void handleResend();
          }}
          style={({ pressed }) => [
            styles.button,
            buttonDisabled && styles.buttonDisabled,
            pressed && !buttonDisabled && styles.buttonPressed,
          ]}>
          {isSending ? (
            <ActivityIndicator color={neutral[0]} size="small" />
          ) : (
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="I verified — check status"
          onPress={() => {
            void handleCheckStatus();
          }}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>I verified — refresh</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffbeb',
    borderColor: border.warning,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  block: {
    marginTop: 16,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  icon: {
    fontSize: 24,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  body: {
    color: text.secondary,
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  meta: {
    color: text.muted,
    fontSize: fontSize.sm,
  },
  feedback: {
    color: brand[800],
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  error: {
    color: text.error,
    fontSize: fontSize.base,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    backgroundColor: brand[700],
    borderRadius: radii.md,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonDisabled: {
    backgroundColor: neutral[400],
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: neutral[0],
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    borderColor: border.default,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
