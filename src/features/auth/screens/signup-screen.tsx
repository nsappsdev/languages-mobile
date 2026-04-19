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
import { validateEmail, validateName, validatePassword } from '@/src/features/auth/utils/validators';
import { ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import { border, fontSize, fontWeight, neutral, radii, surface, text } from '@/src/shared/theme';

export function SignupScreen() {
  const router = useRouter();
  const { signup } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSignup = async () => {
    const nameError = validateName(name);
    if (nameError) { setError(nameError); return; }

    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }

    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      await signup(name.trim(), email.trim(), password);
      router.replace('/(tabs)/lessons');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to sign up. Please try again.');
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Sign up to start learning.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={setName}
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder="Your full name"
              placeholderTextColor={neutral[400]}
              returnKeyType="next"
              style={styles.input}
              value={name}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
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
              onSubmitEditing={handleSignup}
              placeholder="At least 6 chars, letters + numbers"
              placeholderTextColor={neutral[400]}
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title={isSubmitting ? 'Creating Account...' : 'Sign Up'}
            onPress={handleSignup}
            loading={isSubmitting}
            disabled={!name.trim() || !email.trim() || !password}
          />

          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.hint}>Already have an account? Sign in.</Text>
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
    marginBottom: 28,
  },
  title: {
    color: text.primary,
    fontSize: fontSize['4xl'],
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
    color: text.primary,
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
