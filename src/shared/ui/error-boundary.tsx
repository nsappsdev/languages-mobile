import { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { surface, text } from '@/src/shared/theme';
import { fontSize, fontWeight } from '@/src/shared/theme';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaces the error in Metro/device logs so it is not silently swallowed.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] uncaught render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.hint}>Please close and reopen the app.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: surface.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: text.primary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  message: {
    color: text.error,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  hint: {
    color: text.secondary,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
