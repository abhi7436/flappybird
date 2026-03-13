import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGameStore } from '../src/store/gameStore';
import { getHomeRoute } from '../src/config/appMode';
import { saveGuestHighScore } from '../src/services/guestSession';
import GameView from '../src/game/GameView';

export default function SoloScreen() {
  const router         = useRouter();
  const user           = useGameStore((s) => s.user);
  const guestUsername  = useGameStore((s) => s.guestUsername);
  const soloHighScore  = useGameStore((s) => s.soloHighScore);
  const setSoloHighScore = useGameStore((s) => s.setSoloHighScore);
  const equippedSkinId = useGameStore((s) => s.equippedSkinId);

  const displayName = user?.username ?? guestUsername ?? 'Player';

  // Track final score for overlay
  const [deadScore,   setDeadScore]   = React.useState<number | null>(null);
  const [isNewBest,   setIsNewBest]   = React.useState(false);
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const gameKeyRef = useRef(0); // bump to remount GameView on replay

  const handleScoreChange = useCallback((_score: number) => {
    setDeadScore(null); // clear overlay while playing
  }, []);

  const handleGameOver = useCallback(
    async (finalScore: number) => {
      const best = await saveGuestHighScore(finalScore);
      setSoloHighScore(best);
      setIsNewBest(finalScore > 0 && finalScore >= best);
      setDeadScore(finalScore);
    },
    [setSoloHighScore]
  );

  const handlePlayAgain = () => {
    setDeadScore(null);
    gameKeyRef.current += 1;
    forceRender();
  };

  const handleMenu = () => {
    router.replace(getHomeRoute(user ? 'authenticated' : null));
  };

  return (
    <View style={styles.root}>
      {/* Full-screen game canvas — remounted key forces fresh engine */}
      <GameView
        key={gameKeyRef.current}
        roomId="solo"
        skinId={equippedSkinId}
        onScoreChange={handleScoreChange}
        onGameOver={handleGameOver}
      />

      {/* Top bar overlay */}
      <SafeAreaView style={styles.topBar} pointerEvents="none">
        <Text style={styles.playerLabel}>👤 {displayName}</Text>
        {soloHighScore > 0 && (
          <Text style={styles.bestLabel}>🏆 {soloHighScore}</Text>
        )}
      </SafeAreaView>

      {/* Back button (top-left) */}
      <SafeAreaView style={styles.backWrap}>
        <TouchableOpacity style={styles.backBtn} onPress={handleMenu}>
          <Text style={styles.backText}>← Menu</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Death overlay */}
      {deadScore !== null && (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>Game Over</Text>

          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>{deadScore}</Text>
            <Text style={styles.scoreLabel}>SCORE</Text>
          </View>

          {isNewBest ? (
            <Text style={styles.newBest}>🏆 New Personal Best!</Text>
          ) : (
            <Text style={styles.prevBest}>
              Best: <Text style={styles.bestNum}>{soloHighScore}</Text>
            </Text>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handlePlayAgain} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleMenu} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020B18' },

  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  playerLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  bestLabel:   { color: '#fbbf24', fontSize: 12, fontWeight: '700' },

  backWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 16,
  },
  backBtn:  { paddingVertical: 6 },
  backText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  gameOverText: {
    color: '#f87171',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scoreBlock: { alignItems: 'center', gap: 4 },
  scoreValue: { color: '#fff', fontSize: 56, fontWeight: '800' },
  scoreLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 3 },

  newBest:  { color: '#fbbf24', fontSize: 18, fontWeight: '800' },
  prevBest: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  bestNum:  { color: '#fbbf24', fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnPrimaryText: { color: '#0a1628', fontSize: 16, fontWeight: '800' },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
