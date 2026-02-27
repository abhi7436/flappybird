import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Replays as ReplaysAPI } from '../../src/services/api';
import type { ReplayRecord } from '../../../src/server/types/index';
import { GameEngine } from '../../../src/game-engine/GameEngine';
import { Background, Ground, Pipe, BirdSprite } from '../../src/game/renderer/SkiaRenderer';

type PlaybackState = 'idle' | 'playing' | 'done' | 'error';

export default function ReplayScreen() {
  const { replayId }            = useLocalSearchParams<{ replayId: string }>();
  const router                  = useRouter();
  const { width, height }       = useWindowDimensions();

  const [record, setRecord]     = useState<ReplayRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const [playback, setPlayback] = useState<PlaybackState>('idle');
  const [gameState, setGameState] = useState<any>(null);
  const engineRef               = useRef<GameEngine | null>(null);
  const rafRef                  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const groundOffsetRef         = useRef(0);

  // Load replay record
  useEffect(() => {
    if (!replayId) return;
    (async () => {
      try {
        const { replay } = await ReplaysAPI.byId(replayId);
        setRecord(replay);
      } catch (e: any) {
        setPlayback('error');
      } finally {
        setLoading(false);
      }
    })();
  }, [replayId]);

  const startPlayback = () => {
    if (!record || !record.events) return;

    const engine = new GameEngine(
      {
        canvasWidth:  width,
        canvasHeight: height,
        seed:         record.seed,
      },
      {},
    );
    engineRef.current = engine;
    engine.start();
    setPlayback('playing');

    const events = [...(record.events as Array<{ t: number; type: string }>)]
      .sort((a, b) => a.t - b.t);
    let evtIdx  = 0;
    let startTs = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTs;
      engine.tick(elapsed);

      // Fire queued jumps
      while (evtIdx < events.length && events[evtIdx].t <= elapsed) {
        const ev = events[evtIdx++];
        if (ev.type === 'jump') engine.jump();
      }

      const state = engine.getState();
      setGameState(state);
      groundOffsetRef.current = (groundOffsetRef.current + 3) % (width * 2);

      if (state.status === 'dead') {
        setPlayback('done');
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const stopPlayback = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlayback('idle');
    setGameState(null);
    engineRef.current = null;
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f7c59f" size="large" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Replay not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Canvas playback */}
      {(playback === 'playing' || playback === 'done') && gameState ? (
        <Canvas style={{ width, height }}>
          <Background width={width} height={height} />
          {gameState.pipes.map((pipe: any, i: number) => (
            <Pipe key={i} pipe={pipe} canvasHeight={height} />
          ))}
          <BirdSprite bird={gameState.bird} skinId="classic" shielded={false} />
          <Ground width={width} height={height} offsetX={groundOffsetRef.current} />
        </Canvas>
      ) : (
        <View style={styles.placeholder}>
          <Background width={width} height={height} />
        </View>
      )}

      {/* Top overlay */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { stopPlayback(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.replayTitle} numberOfLines={1}>
            Replay — {record.user_id ?? 'Unknown'}
          </Text>
          <Text style={styles.replayMeta}>
            Score {record.final_score}  ·  {new Date(record.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {playback === 'idle' && (
          <TouchableOpacity style={styles.playBtn} onPress={startPlayback}>
            <Ionicons name="play" size={28} color="#0f3460" />
            <Text style={styles.playBtnText}>Play Replay</Text>
          </TouchableOpacity>
        )}
        {playback === 'playing' && (
          <TouchableOpacity style={[styles.playBtn, { backgroundColor: '#e17055' }]} onPress={stopPlayback}>
            <Ionicons name="stop" size={28} color="#fff" />
            <Text style={[styles.playBtnText, { color: '#fff' }]}>Stop</Text>
          </TouchableOpacity>
        )}
        {playback === 'done' && (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={styles.scoreBanner}>
              <Text style={styles.scoreBannerLabel}>Final Score</Text>
              <Text style={styles.scoreBannerValue}>{gameState?.score ?? record.final_score}</Text>
            </View>
            <TouchableOpacity style={styles.playBtn} onPress={startPlayback}>
              <Ionicons name="refresh" size={28} color="#0f3460" />
              <Text style={styles.playBtnText}>Replay Again</Text>
            </TouchableOpacity>
          </View>
        )}
        {playback === 'error' && (
          <Text style={styles.errorText}>Failed to load replay data.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f3460' },
  center:       { flex: 1, backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  placeholder:  { flex: 1 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
    gap: 12,
  },
  iconBtn:        { padding: 4 },
  replayTitle:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  replayMeta:     { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },

  controls: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    alignItems: 'center',
  },
  playBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f7c59f', borderRadius: 50, paddingHorizontal: 28, paddingVertical: 14,
  },
  playBtnText:  { color: '#0f3460', fontWeight: '800', fontSize: 16 },

  scoreBanner:      { alignItems: 'center', marginBottom: 8 },
  scoreBannerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  scoreBannerValue: { color: '#f7c59f', fontWeight: '900', fontSize: 52 },

  backBtn:      { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f7c59f', borderRadius: 30 },
  backBtnText:  { color: '#0f3460', fontWeight: '700',  fontSize: 15 },
  errorText:    { color: '#e17055', fontSize: 15 },
});
