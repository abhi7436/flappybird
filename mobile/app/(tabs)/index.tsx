import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../src/store/gameStore';
import { getLogoutRoute } from '../../src/config/appMode';
import { Rooms } from '../../src/services/api';
import { clearToken } from '../../src/services/storage';

export default function LobbyScreen() {
  const router           = useRouter();
  const user             = useGameStore((s) => s.user);
  const clearAuth        = useGameStore((s) => s.clearAuth);
  const pendingRoomId    = useGameStore((s) => s.pendingInviteRoomId);
  const pendingToken     = useGameStore((s) => s.pendingInviteToken);
  const clearInvite      = useGameStore((s) => s.clearPendingInvite);

  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining,  setJoining]  = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const { roomId } = await Rooms.create();
      router.push(`/game/${roomId}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create room');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    const id = joinCode.trim();
    if (!id) return;
    setJoining(true);
    try {
      await Rooms.validateJoin(id);
      router.push(`/game/${id}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Room not found or closed');
    } finally {
      setJoining(false);
    }
  }

  function handleAcceptInvite() {
    if (!pendingRoomId || !pendingToken) return;
    const id = pendingRoomId;
    const t  = pendingToken;
    clearInvite();
    router.push(`/game/${id}?t=${t}`);
  }

  async function handleLogout() {
    await clearToken();
    clearAuth();
    router.replace(getLogoutRoute());
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.username}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.highScore}>🏆 {user?.high_score ?? 0}</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending invite banner */}
      {pendingRoomId && (
        <TouchableOpacity style={styles.inviteBanner} onPress={handleAcceptInvite} activeOpacity={0.8}>
          <Text style={styles.inviteText}>🎮 You have a game invite!</Text>
          <Text style={styles.inviteAction}>Tap to join →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.body}>
        {/* Create room */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚀 Create Room</Text>
          <Text style={styles.cardDesc}>Start a new game and invite your friends.</Text>
          <TouchableOpacity
            style={[styles.btn, creating && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text style={styles.btnText}>Create Game</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Join room */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔗 Join Room</Text>
          <Text style={styles.cardDesc}>Enter a Room ID or paste a link.</Text>
          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="Room ID"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, (!joinCode.trim() || joining) && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={!joinCode.trim() || joining}
            activeOpacity={0.8}
          >
            {joining ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text style={styles.btnText}>Join Game</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Solo mode */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎮 Play Solo</Text>
          <Text style={styles.cardDesc}>Practice offline. No opponents — just you and the pipes.</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSolo]}
            onPress={() => router.push('/solo')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Play Solo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  greeting: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  username: { color: '#f7c59f', fontWeight: '800', fontSize: 20 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  highScore: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: { padding: 4 },
  logoutText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  inviteBanner: {
    margin: 16,
    backgroundColor: 'rgba(247,197,159,0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f7c59f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inviteText: { color: '#f7c59f', fontWeight: '700', fontSize: 14 },
  inviteAction: { color: '#f7c59f', fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  cardDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btn: {
    backgroundColor: '#f7c59f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSecondary: { backgroundColor: '#74b9ff' },
  btnSolo: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#1a1a2e', fontWeight: '800', fontSize: 15 },
});
