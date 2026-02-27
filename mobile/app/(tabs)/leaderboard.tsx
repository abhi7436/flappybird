import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Leaderboard as LeaderboardAPI } from '../../src/services/api';
import { useGameStore } from '../../src/store/gameStore';
import type { GlobalLeaderboardEntry } from '../../src/types';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardScreen() {
  const user       = useGameStore((s) => s.user);
  const [entries,    setEntries]    = useState<GlobalLeaderboardEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await LeaderboardAPI.global(50);
      setEntries(data);
    } catch {
      // Ignore — no leaderboard data yet
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Top Scores</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#f7c59f" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.userId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f7c59f" />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No scores yet. Be the first!</Text>
          }
          renderItem={({ item }) => {
            const isMe = item.userId === user?.id;
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={styles.medal}>
                  {MEDALS[item.rank] ?? `#${item.rank}`}
                </Text>
                <View style={styles.info}>
                  <Text style={[styles.username, isMe && styles.usernameMe]}>
                    {item.username}
                    {isMe ? ' (you)' : ''}
                  </Text>
                </View>
                <Text style={[styles.score, isMe && styles.scoreMe]}>
                  {item.high_score}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  title: {
    color: '#f7c59f',
    fontWeight: '900',
    fontSize: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 40, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowMe: {
    backgroundColor: 'rgba(247,197,159,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247,197,159,0.4)',
  },
  medal: { fontSize: 22, width: 40, textAlign: 'center' },
  info: { flex: 1 },
  username: { color: '#fff', fontWeight: '600', fontSize: 15 },
  usernameMe: { color: '#f7c59f', fontWeight: '800' },
  score: { color: '#fff', fontWeight: '700', fontSize: 18 },
  scoreMe: { color: '#f7c59f' },
});
