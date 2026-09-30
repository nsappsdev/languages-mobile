import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '@/src/shared/auth/session-context';
import { flushReaderChanges, readerSyncState, subscribeReaderState } from './state-store';
import { Action, ui } from './ui';

export function SyncNotice() {
  const { user } = useSession();
  const [, rerender] = useState(0);
  useEffect(() => subscribeReaderState(() => rerender(n => n + 1)), []);
  if (!user) return null;
  const state = readerSyncState(user.id);
  if (!state.pending && !state.error) return null;
  return <View style={ui.stack}><Text accessibilityLiveRegion="polite" style={ui.subtitle}>{state.error ?? `Saving ${state.pending} ${state.pending === 1 ? 'change' : 'changes'}…`}</Text>
    {state.error ? <Action title="Retry sync" secondary onPress={() => { void flushReaderChanges(); }} /> : null}</View>;
}
