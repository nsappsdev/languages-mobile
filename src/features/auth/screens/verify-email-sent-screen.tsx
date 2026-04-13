import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/src/shared/ui/primary-button';
import { ScreenContainer } from '@/src/shared/ui/screen-container';

export function VerifyEmailSentScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.body}>
          We sent a verification link to{'\n'}
          <Text style={styles.email}>{email ?? 'your email'}</Text>.{'\n\n'}
          Tap the link in the email to activate your account, then sign in.
        </Text>

        <PrimaryButton
          title="Go to sign in"
          onPress={() => router.replace('/(auth)/login')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 20 },
  emoji: { fontSize: 52, textAlign: 'center' },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { color: '#475569', fontSize: 15, lineHeight: 24, textAlign: 'center' },
  email: { color: '#0e7490', fontWeight: '600' },
});
