import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
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

  const user         = useGameStore((s) => s.user);
  const finalRanking = useGameStore((s) => s.finalRanking);
  const setFinal     = useGameStore((s) => s.setFinalRanking);
  const clearLobby   = useGameStore((s) => s.clearLobby);
  const gameStarted  = useGameStore((s) => s.gameStarted);

  const { joinRoom, leaveRoom, sendScore, sendGameOver } = useWebSocket();

  // Track last sent score to debounce WS messages (send at most every 250ms)
  const lastSentScore  = useRef(-1);
  const lastSentTimeMs = useRef(0);

  useEffect(() => {
    if (!roomId) return;
    clearLobby();
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
            style={styles.leaveBtn}
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
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  leaveBtn: {
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
});
