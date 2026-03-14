import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Friends as FriendsAPI, Rooms, Invites, Profile } from '../../src/services/api';
import { useGameStore } from '../../src/store/gameStore';
import type { Friend } from '../../src/types';

export default function FriendsScreen() {
  const router  = useRouter();
  const user    = useGameStore((s) => s.user);
  const [friends,     setFriends]     = useState<Friend[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [adding,      setAdding]      = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await FriendsAPI.list();
      setFriends(data);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not load friends');
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

  async function handleAddFriend() {
    const name = addUsername.trim();
    if (!name) return;
    setAdding(true);
    try {
      // We need userId — fetch public profile first to get it
      const { profile } = await Profile.public(name);
      await FriendsAPI.sendRequest((profile as any).id);
      Alert.alert('Request sent!', `Friend request sent to ${name}.`);
      setAddUsername('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'User not found');
    } finally {
      setAdding(false);
    }
  }

  async function handleAccept(friendshipId: string) {
    try {
      await FriendsAPI.accept(friendshipId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message);
    }
  }

  async function handleInvite(friend: Friend) {
    try {
      const { roomId } = await Rooms.create();
      await Invites.create(roomId, friend.id);
      router.push(`/game/${roomId}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not send invite');
    }
  }

  const accepted  = friends.filter((f) => f.status === 'accepted');
  const pending   = friends.filter((f) => f.status === 'pending' && !f.requesterIsMe);
  const requested = friends.filter((f) => f.status === 'pending' && f.requesterIsMe);

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Friends</Text>

      {/* Add friend */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={addUsername}
          onChangeText={setAddUsername}
          placeholder="Add by username..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.addBtn, adding && styles.btnDisabled]}
          onPress={handleAddFriend}
          disabled={adding || !addUsername.trim()}
          activeOpacity={0.8}
        >
          {adding ? <ActivityIndicator size="small" color="#1a1a2e" /> : <Text style={styles.addBtnText}>Add</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#f7c59f" />
      ) : (
        <FlatList
          data={[
            ...pending.map((f) => ({ ...f, _type: 'incoming' })),
            ...accepted.map((f) => ({ ...f, _type: 'friend' })),
            ...requested.map((f) => ({ ...f, _type: 'outgoing' })),
          ]}
          keyExtractor={(f) => f.friendshipId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f7c59f" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No friends yet. Add someone above!</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.username[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.score}>🏆 {item.high_score}</Text>
              </View>
              <View style={styles.actions}>
                {(item as any)._type === 'incoming' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleAccept(item.friendshipId)}
                  >
                    <Text style={styles.actionBtnText}>Accept</Text>
                  </TouchableOpacity>
                )}
                {(item as any)._type === 'friend' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.inviteBtn]}
                    onPress={() => handleInvite(item)}
                  >
                    <Text style={styles.actionBtnText}>Invite</Text>
                  </TouchableOpacity>
                )}
                {(item as any)._type === 'outgoing' && (
                  <Text style={styles.pendingText}>Pending</Text>
                )}
              </View>
              {item.is_online && <View style={styles.onlineDot} />}
            </View>
          )}
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
  addRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addBtn: {
    backgroundColor: '#f7c59f',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#1a1a2e', fontWeight: '800', fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  empty: { color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 40, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(247,197,159,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#f7c59f', fontWeight: '700', fontSize: 18 },
  info: { flex: 1 },
  username: { color: '#fff', fontWeight: '700', fontSize: 15 },
  score: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  actions: { alignItems: 'flex-end' },
  actionBtn: {
    backgroundColor: '#f7c59f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  inviteBtn: { backgroundColor: '#74b9ff' },
  actionBtnText: { color: '#1a1a2e', fontWeight: '700', fontSize: 13 },
  pendingText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  onlineDot: {
    position: 'absolute',
    top: 10,
    left: 44,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2ecc71',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
});
