import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../src/store/gameStore';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import GameView from '../../src/game/GameView';
import Leaderboard from '../../src/components/Leaderboard';
import FinalRanking from '../../src/components/FinalRanking';

export default function GameScreen() {
  const { roomId, t: joinToken } = useLocalSearchParams<{ roomId: string; t?: string }>();
  const router                   = useRouter();

  const user          = useGameStore((s) => s.user);
  const finalRanking  = useGameStore((s) => s.finalRanking);
  const setFinal      = useGameStore((s) => s.setFinalRanking);
  const clearLobby    = useGameStore((s) => s.clearLobby);
  const gameStarted   = useGameStore((s) => s.gameStarted);
  const setGameStarted = useGameStore((s) => s.setGameStarted);
  const lobbyPlayers  = useGameStore((s) => s.lobbyPlayers);
  const roomHostId    = useGameStore((s) => s.roomHostId);
  const setRoomHostId = useGameStore((s) => s.setRoomHostId);
  const gameCountdown = useGameStore((s) => s.gameCountdown);
  const setGameCountdown = useGameStore((s) => s.setGameCountdown);

  const isHost = user?.id === roomHostId;

  const { joinRoom, leaveRoom, sendScore, sendGameOver, startGame } = useWebSocket();

  // Track last sent score to debounce WS messages (send at most every 250ms)
  const lastSentScore  = useRef(-1);
  const lastSentTimeMs = useRef(0);

  useEffect(() => {
    if (!roomId) return;
    clearLobby();
    setGameStarted(false);
    setGameCountdown(null);
    setRoomHostId(null);
    // Validate + join room via WebSocket
    joinRoom(roomId, joinToken);

    return () => {
      leaveRoom(roomId);
    };
  }, [roomId]);

  const handleScoreChange = useCallback(
    (score: number) => {
      if (!roomId) return;
      const now = Date.now();
      if (score !== lastSentScore.current && now - lastSentTimeMs.current > 250) {
        lastSentScore.current  = score;
        lastSentTimeMs.current = now;
        sendScore(roomId, score);
      }
    },
    [roomId, sendScore]
  );

  const handleGameOver = useCallback(
    (finalScore: number) => {
      if (roomId) sendGameOver(roomId, finalScore);
    },
    [roomId, sendGameOver]
  );

  function handleDismissFinal() {
    setFinal(null);
    leaveRoom(roomId!);
    router.replace('/(tabs)');
  }

  // ── Lobby (pre-game waiting room) ──────────────────────────
  if (!gameStarted && !finalRanking) {
    return (
      <SafeAreaView style={styles.lobby}>
        <View style={styles.lobbyHeader}>
          <Text style={styles.lobbyTitle}>🎮 Room Lobby</Text>
          <Text style={styles.lobbyRoomId} selectable>{roomId}</Text>
          <Text style={styles.lobbyHint}>Share the Room ID above with friends</Text>
        </View>

        <Text style={styles.lobbyPlayersHeading}>
          Players ({lobbyPlayers.length})
        </Text>
        <FlatList
          data={lobbyPlayers.map((p) => ({
            ...p,
            username: p.username + (p.userId === roomHostId ? ' 👑' : ''),
          }))}
          keyExtractor={(item) => item.playerId}
          renderItem={({ item }) => (
            <View style={styles.lobbyPlayerRow}>
              <Text style={styles.lobbyPlayerName}>{item.username}</Text>
            </View>
          )}
          style={styles.lobbyPlayerList}
          contentContainerStyle={{ gap: 8 }}
        />

        <View style={styles.lobbyActions}>
          {isHost ? (
            <TouchableOpacity
              style={[styles.startBtn, gameCountdown !== null && styles.btnDisabled]}
              onPress={() => startGame(roomId!)}
              disabled={gameCountdown !== null}
              activeOpacity={0.8}
            >
              <Text style={styles.startBtnText}>▶ Start Game</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waitingText}>Waiting for host to start…</Text>
          )}
          <TouchableOpacity
            style={[styles.leaveBtn, gameCountdown !== null && styles.btnDisabled]}
            onPress={() => { leaveRoom(roomId!); router.replace('/(tabs)'); }}
            disabled={gameCountdown !== null}
          >
            <Text style={styles.leaveBtnText}>✕ Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Countdown overlay — shown to ALL players when host presses Start */}
        {gameCountdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownNumber}>
              {gameCountdown === 0 ? '🐦' : String(gameCountdown)}
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* Game canvas — fills entire screen */}
      {roomId && (
        <GameView
          roomId={roomId}
          onScoreChange={handleScoreChange}
          onGameOver={handleGameOver}
        />
      )}

      {/* Live leaderboard overlay (bottom-right) */}
      {gameStarted && !finalRanking && (
        <View style={styles.leaderboardOverlay} pointerEvents="none">
          <Leaderboard myUserId={user?.id} />
        </View>
      )}

      {/* Leave button (top-left) */}
      {!finalRanking && (
        <SafeAreaView style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.inGameLeaveBtn}
            onPress={() => {
              leaveRoom(roomId!);
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.leaveBtnText}>✕ Leave</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Final ranking modal */}
      {finalRanking && (
        <FinalRanking payload={finalRanking} onDismiss={handleDismissFinal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── In-game styles ─────────────────────────────────────────
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  inGameLeaveBtn: {
    margin: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  leaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  leaderboardOverlay: {
    position: 'absolute',
    bottom: 100,
    right: 12,
    maxWidth: 240,
  },
  // ── Lobby styles ────────────────────────────────────────────
  lobby: { flex: 1, backgroundColor: '#1a1a2e', padding: 24, gap: 16 },
  lobbyHeader: { alignItems: 'center', gap: 6, marginBottom: 8 },
  lobbyTitle: { color: '#f7c59f', fontWeight: '800', fontSize: 24 },
  lobbyRoomId: {
    color: '#74b9ff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 2,
    backgroundColor: 'rgba(116,185,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  lobbyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  lobbyPlayersHeading: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  lobbyPlayerList: { flex: 1 },
  lobbyPlayerRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lobbyPlayerName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  lobbyActions: { gap: 12 },
  startBtn: {
    backgroundColor: '#f7c59f',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: '#1a1a2e', fontWeight: '800', fontSize: 16 },
  waitingText: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontSize: 14 },
  leaveBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnDisabled: { opacity: 0.4 },
  // ── Countdown overlay ──────────────────────────────────────
  countdownOverlay: {
    position: 'absolute',
    inset: 0,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '900',
    textShadowColor: 'rgba(255,215,0,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 32,
  },
});
