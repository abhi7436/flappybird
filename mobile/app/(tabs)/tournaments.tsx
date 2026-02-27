import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Tournaments as TournamentsAPI } from '../../src/services/api';
import type { TournamentRecord, TournamentDetail } from '../../../src/server/types/index';

const STATUS_COLORS: Record<string, string> = {
  registration: '#2ecc71',
  active:       '#f39c12',
  completed:    '#74b9ff',
  cancelled:    '#e17055',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] ?? '#aaa' }]}>
      <Text style={styles.badgeText}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

function TournamentCard({
  item,
  onPress,
  onRegister,
}: {
  item: TournamentRecord;
  onPress: () => void;
  onRegister: () => void;
}) {
  const start = new Date(item.starts_at).toLocaleString();
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <StatusBadge status={item.status} />
      </View>

      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}

      <View style={styles.cardMeta}>
        <Ionicons name="people-outline" size={14} color="#aaa" style={{ marginRight: 4 }} />
        <Text style={styles.metaText}>
          {item.max_participants}
        </Text>
        <Ionicons name="time-outline" size={14} color="#aaa" style={{ marginLeft: 12, marginRight: 4 }} />
        <Text style={styles.metaText}>{start}</Text>
      </View>

      {item.prize_info ? (
        <Text style={styles.prize}>🏆 {item.prize_info}</Text>
      ) : null}

      {item.status === 'registration' && (
        <TouchableOpacity style={styles.joinBtn} onPress={onRegister}>
          <Text style={styles.joinBtnText}>Register</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function TournamentsScreen() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<'all' | 'registration' | 'active' | 'completed'>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await TournamentsAPI.list(status);
      setTournaments(data.tournaments);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleRegister = async (id: string) => {
    try {
      await TournamentsAPI.register(id);
      Alert.alert('Registered!', 'You have joined this tournament.');
      load();
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tournaments</Text>

      {/* Filter pills */}
      <View style={styles.filters}>
        {(['all', 'registration', 'active', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#f7c59f" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TournamentCard
              item={item}
              onPress={() => router.push(`/tournament/${item.id}` as any)}
              onRegister={() => handleRegister(item.id)}
            />
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#f7c59f"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No tournaments found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f3460' },
  title:     { fontSize: 24, fontWeight: '800', color: '#f7c59f', padding: 20, paddingBottom: 8 },

  filters:   { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  filterPill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: '#f7c59f' },
  filterText:       { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#0f3460' },

  card:      {
    backgroundColor: '#16213e', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:  { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 },
  cardDesc:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },

  cardMeta:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaText:  { fontSize: 12, color: '#aaa' },

  prize:     { fontSize: 13, color: '#f7c59f', marginBottom: 10 },

  joinBtn:       { backgroundColor: '#f7c59f', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  joinBtnText:   { color: '#0f3460', fontWeight: '700', fontSize: 14 },

  badge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  empty:     { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
