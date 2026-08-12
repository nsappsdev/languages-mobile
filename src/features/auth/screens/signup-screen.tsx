import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthShell } from '@/src/features/auth/components/auth-shell';
import { validateEmail, validateName, validatePassword } from '@/src/features/auth/utils/validators';
import { ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import { spacing, status, text, typography } from '@/src/shared/theme';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { TextField } from '@/src/shared/ui/text-field';

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
    <AuthShell
      eyebrow="Begin with the essentials"
      title="Create account"
      subtitle="Build your English vocabulary through guided text and audio lessons.">
      <View style={styles.form}>
        <TextField
          autoCapitalize="words"
          autoComplete="name"
          label="Name"
          onChangeText={setName}
          onSubmitEditing={() => emailRef.current?.focus()}
          placeholder="Your full name"
          returnKeyType="next"
          value={name}
        />

        <TextField
          ref={emailRef}
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
            void handleSignup();
          }}
          placeholder="At least 6 characters, letters + numbers"
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
          title={isSubmitting ? 'Creating account…' : 'Create account'}
          onPress={() => {
            void handleSignup();
          }}
          loading={isSubmitting}
          disabled={!name.trim() || !email.trim() || !password}
        />

        <Pressable
          accessibilityHint="Returns to the sign in form"
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/login')}
          style={({ pressed }) => [styles.authLink, pressed && styles.authLinkPressed]}>
          <Text style={styles.hint}>
            Already have an account? <Text style={styles.hintAction}>Sign in</Text>
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
