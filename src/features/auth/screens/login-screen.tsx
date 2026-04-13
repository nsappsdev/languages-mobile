import { useRouter } from 'expo-router';
import { useState } from 'react';
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

export function LoginScreen() {
  const router = useRouter();
  const { login } = useSession();
  const [email, setEmail] = useState('user@email.com');
  const [password, setPassword] = useState('user#666');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        behavior={Platform.select({ ios: 'padding', android: undefined })}
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
              placeholder="you@example.com"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="••••••••"
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

          <Pressable onPress={() => {
            setEmail('user@email.com');
            setPassword('user#666');
          }}>
            <Text style={styles.hint}>Use seeded mobile user credentials.</Text>
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
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
});
