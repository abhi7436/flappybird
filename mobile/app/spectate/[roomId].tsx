import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { useGameStore } from '../../src/store/gameStore';
import { Background, Ground, Pipe, BirdSprite } from '../../src/game/renderer/SkiaRenderer';

export default function SpectateScreen() {
  const { roomId }            = useLocalSearchParams<{ roomId: string }>();
  const router                = useRouter();
  const { width, height }     = useWindowDimensions();
  const { spectateRoom, leaveSpectate } = useWebSocket();
  const leaderboard           = useGameStore((s) => s.leaderboard);
  const spectatingRoomId      = useGameStore((s) => s.spectatingRoomId);
  const groundOffsetRef       = useRef(0);
  const [fps, setFps]         = useState(0);
  const fpsFrames             = useRef(0);
  const fpsTimer              = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    spectateRoom(roomId);

    fpsTimer.current = setInterval(() => {
      setFps(fpsFrames.current);
      fpsFrames.current = 0;
    }, 1000);

    return () => {
      leaveSpectate(roomId);
      if (fpsTimer.current) clearInterval(fpsTimer.current);
    };
  }, [roomId]);

  // Animate ground scroll
  useEffect(() => {
    groundOffsetRef.current = (groundOffsetRef.current + 3) % (width * 2);
    fpsFrames.current++;
  });

  const handleBack = () => {
    if (roomId) leaveSpectate(roomId);
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Canvas — read-only view, no game state from engine */}
      <Canvas style={{ width, height }}>
        <Background width={width} height={height} />
        <Ground width={width} height={height} offsetX={groundOffsetRef.current} />
      </Canvas>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.roomLabel}>Room: {roomId}</Text>
        <Text style={styles.speLabel}>👁 SPECTATING</Text>
        <Text style={styles.fpsLabel}>{fps} fps</Text>
      </View>

      {/* Leaderboard overlay */}
      <View style={styles.board}>
        <Text style={styles.boardTitle}>Live Scores</Text>
        {leaderboard.slice(0, 8).map((entry: any, i: number) => (
          <View key={entry.userId ?? i} style={styles.boardRow}>
            <Text style={styles.boardRank}>#{i + 1}</Text>
            <Text style={styles.boardName} numberOfLines={1}>{entry.username}</Text>
            <Text style={styles.boardScore}>{entry.score ?? 0}</Text>
            {entry.isDead && <Text style={styles.deadTag}>💀</Text>}
          </View>
        ))}
        {leaderboard.length === 0 && (
          <Text style={styles.waiting}>Waiting for players…</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    gap: 10,
  },
  backBtn:    { padding: 4, marginRight: 4 },
  roomLabel:  { color: '#fff', fontWeight: '600', fontSize: 13, flex: 1 },
  speLabel:   { color: '#f7c59f', fontWeight: '700', fontSize: 12, backgroundColor: 'rgba(247,197,159,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  fpsLabel:   { color: 'rgba(255,255,255,0.35)', fontSize: 11 },

  board: {
    position: 'absolute', bottom: 40, left: 16, right: 16,
    backgroundColor: 'rgba(15,52,96,0.92)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  boardTitle: { color: '#f7c59f', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  boardRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  boardRank:  { color: 'rgba(255,255,255,0.4)', width: 28, fontSize: 12 },
  boardName:  { color: '#fff', flex: 1, fontSize: 13, fontWeight: '600' },
  boardScore: { color: '#f7c59f', fontWeight: '700', fontSize: 14, marginRight: 4 },
  deadTag:    { fontSize: 14 },
  waiting:    { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});
