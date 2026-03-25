import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiClient, ApiError } from '@/src/shared/api/client';
import { useSession } from '@/src/shared/auth/session-context';
import {
  getCachedVocabulary,
  setCachedVocabulary,
} from '@/src/features/vocabulary/services/vocabulary-sync';
import { ScreenContainer } from '@/src/shared/ui/screen-container';
import type { LearnerVocabularyItem } from '@/src/types/domain';
import { useFocusEffect } from '@react-navigation/native';

export function VocabularyScreen() {
  const { token, user } = useSession();
  const [items, setItems] = useState<LearnerVocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState<string | null>(null);

  const fetchVocabulary = useCallback(
    async (isRefresh = false) => {
      if (!token || !user?.id) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      setSyncMeta(null);
      try {
        const response = await apiClient.getMyVocabulary(token);
        setItems(response.vocabulary);
        await setCachedVocabulary(user.id, response.vocabulary);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return;
        }

        const cached = await getCachedVocabulary(user.id);
        if (cached.length > 0) {
          setItems(cached);
          setSyncMeta('Showing last synced vocabulary snapshot.');
        }

        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load vocabulary.');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, user?.id],
  );

  useEffect(() => {
    if (!token || !user?.id) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const bootstrap = async () => {
      setIsLoading(true);
      const cached = await getCachedVocabulary(user.id);
      if (isMounted && cached.length > 0) {
        setItems(cached);
        setSyncMeta('Showing last synced vocabulary snapshot.');
        setIsLoading(false);
      }

      await fetchVocabulary();
    };

    bootstrap().catch(() => null);

    return () => {
      isMounted = false;
    };
  }, [fetchVocabulary, token, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchVocabulary(true).catch(() => null);
      return undefined;
    }, [fetchVocabulary]),
  );

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      {
        total: 0,
        NEW: 0,
        REVIEWING: 0,
        MASTERED: 0,
      },
    );
  }, [items]);

  if (!token || !user?.id) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.meta}>Sign in to view vocabulary.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Loading vocabulary...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          {syncMeta ? <Text style={styles.meta}>{syncMeta}</Text> : null}
          <Pressable onPress={() => fetchVocabulary().catch(() => null)} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>My Vocabulary</Text>
        <Text style={styles.meta}>Select text inside lesson items and tap Add to Vocabulary.</Text>
        {syncMeta ? <Text style={styles.syncMeta}>{syncMeta}</Text> : null}
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="New" value={summary.NEW} />
        <SummaryCard label="Reviewing" value={summary.REVIEWING} />
        <SummaryCard label="Mastered" value={summary.MASTERED} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const firstTranslation = item.entry.translations[0];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.word}>{item.entry.englishText}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Text style={styles.translation}>
                {firstTranslation
                  ? `${firstTranslation.translation} (${firstTranslation.languageCode.toUpperCase()})`
                  : 'No translation yet.'}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No saved vocabulary yet.</Text>
            <Text style={styles.emptyText}>
              Add vocabulary from lesson text selection.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchVocabulary(true).catch(() => null);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: '#475569',
    fontSize: 14,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  syncMeta: {
    color: '#0f766e',
    fontSize: 12,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  summaryValue: {
    color: '#0f766e',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  word: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    backgroundColor: '#ecfeff',
    borderRadius: 999,
    color: '#115e59',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  translation: {
    color: '#334155',
    fontSize: 14,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
  },
});
