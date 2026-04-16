import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { validateEmail, validatePassword } from '@/src/features/auth/utils/validators';
import { border, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

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
        if (err.status === 403 && err.code === 'EMAIL_NOT_VERIFIED') {
          router.push({ pathname: '/(auth)/verify-email-sent', params: { email: email.trim() } });
          return;
        }
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
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <Text style={styles.title}>Language App</Text>
          <Text style={styles.subtitle}>Sign in to access lessons and audio playback.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="you@example.com"
              placeholderTextColor={neutral[400]}
              returnKeyType="next"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              autoCapitalize="none"
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              placeholder="••••••••"
              placeholderTextColor={neutral[400]}
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={isSubmitting ? 'Signing In...' : 'Sign In'}
            onPress={handleLogin}
            loading={isSubmitting}
            disabled={!email.trim() || !password}
          />

          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.hint}>No account yet? Create one.</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    color: text.primary,
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.bold,
    marginBottom: 8,
  },
  subtitle: {
    color: text.secondary,
    fontSize: fontSize.lg,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  input: {
    backgroundColor: surface.input,
    borderColor: border.default,
    borderRadius: radii.lg,
    borderWidth: 1,
    fontSize: fontSize.lg,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  error: {
    color: text.error,
    fontSize: fontSize.md,
  },
  hint: {
    color: text.secondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
