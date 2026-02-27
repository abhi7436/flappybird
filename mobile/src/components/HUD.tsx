import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GameStatus } from '@engine/GameEngine';

interface HUDProps {
  score: number;
  status: GameStatus;
  difficultyTier: number;
}

const TIER_LABELS = ['', 'Speed++', 'Maniac', 'Chaos', 'Nightmare'];

export default function HUD({ score, status, difficultyTier }: HUDProps) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Score */}
      {status === 'running' && (
        <Text style={styles.score}>{score}</Text>
      )}

      {/* Difficulty badge */}
      {status === 'running' && difficultyTier > 0 && (
        <View style={styles.tierBadge}>
          <Text style={styles.tierText}>
            {TIER_LABELS[Math.min(difficultyTier, TIER_LABELS.length - 1)]}
          </Text>
        </View>
      )}

      {/* Tap prompt on idle */}
      {status === 'idle' && (
        <View style={styles.promptBox}>
          <Text style={styles.prompt}>Tap to Start</Text>
          <Text style={styles.subPrompt}>Tap anywhere to flap!</Text>
        </View>
      )}

      {/* Tap prompt on dead */}
      {status === 'dead' && (
        <View style={styles.promptBox}>
          <Text style={styles.gameOver}>Game Over</Text>
          <Text style={styles.subPrompt}>Tap to try again</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  score: {
    marginTop: 60,
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  tierBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(231,76,60,0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  promptBox: {
    position: 'absolute',
    bottom: 160,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  prompt: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  gameOver: {
    fontSize: 32,
    fontWeight: '900',
    color: '#f7c59f',
  },
  subPrompt: {
    marginTop: 6,
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});
