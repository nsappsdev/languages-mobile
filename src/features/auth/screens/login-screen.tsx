import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { validateEmail, validatePassword } from '@/src/features/auth/utils/validators';
import { ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { spacing, status, text, typography } from '@/src/shared/theme';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { TextField } from '@/src/shared/ui/text-field';

export function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/lessons');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to login. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Your learning space"
      title="Welcome back"
      subtitle="Continue your English lessons with clear audio and Armenian support.">
      <View style={styles.form}>
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="you@example.com"
          returnKeyType="next"
          value={email}
        />

        <TextField
          ref={passwordRef}
          autoCapitalize="none"
          label="Password"
          onChangeText={setPassword}
          onSubmitEditing={() => {
            void handleLogin();
          }}
          placeholder="Enter your password"
          returnKeyType="done"
          secureTextEntry
          value={password}
        />

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          title={isSubmitting ? 'Signing in…' : 'Sign in'}
          onPress={() => {
            void handleLogin();
          }}
          loading={isSubmitting}
          disabled={!email.trim() || !password}
        />

        <Pressable
          accessibilityHint="Opens the account creation form"
          accessibilityRole="link"
          onPress={() => router.push('/(auth)/signup')}
          style={({ pressed }) => [styles.authLink, pressed && styles.authLinkPressed]}>
          <Text style={styles.hint}>
            No account yet? <Text style={styles.hintAction}>Create one</Text>
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing[4],
  },
  errorNotice: {
    backgroundColor: status.errorBg,
    borderRadius: 12,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  error: {
    color: text.error,
    ...typography.label,
  },
  authLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing[2],
  },
  authLinkPressed: {
    opacity: 0.86,
  },
  hint: {
    color: text.secondary,
    textAlign: 'center',
    ...typography.label,
  },
  hintAction: {
    color: text.brand,
  },
});
