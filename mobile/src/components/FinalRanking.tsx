import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import type { FinalRankingPayload } from '../types';

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const MESSAGES = [
  'Champion! 🏆',
  'Runner-up! 🎉',
  'Podium finish! 👏',
  'Top half!',
  'Keep flapping!',
  'Nice try!',
  'Practice makes perfect!',
];

function getMessage(rank: number, total: number): string {
  if (rank <= 3) return MESSAGES[rank - 1];
  const pct = rank / total;
  if (pct <= 0.5) return MESSAGES[3];
  return MESSAGES[Math.min(4 + Math.floor(pct * 2), MESSAGES.length - 1)];
}

interface FinalRankingProps {
  payload: FinalRankingPayload;
  onDismiss: () => void;
}

export default function FinalRanking({ payload, onDismiss }: FinalRankingProps) {
  const slideAnim  = useRef(new Animated.Value(400)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(badgeScale, {
        toValue: 1,
        tension: 80,
        friction: 5,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const { rank, totalPlayers, finalScore } = payload;
  const medal = rank <= 5 ? MEDALS[rank - 1] : null;
  const pct = Math.round(((totalPlayers - rank) / Math.max(totalPlayers - 1, 1)) * 100);

  return (
    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Medal */}
        {medal && (
          <Animated.Text
            style={[styles.medal, { transform: [{ scale: badgeScale }] }]}
          >
            {medal}
          </Animated.Text>
        )}

        {/* Rank */}
        <Text style={styles.rankText}>
          #{rank} <Text style={styles.rankOf}>of {totalPlayers}</Text>
        </Text>

        {/* Message */}
        <Text style={styles.message}>{getMessage(rank, totalPlayers)}</Text>

        {/* Score */}
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Final Score</Text>
          <Text style={styles.scoreValue}>{finalScore}</Text>
        </View>

        {/* Percentile */}
        <Text style={styles.percentile}>
          Better than {pct}% of players
        </Text>

        {/* Dismiss */}
        <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Back to Lobby</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
    }),
  },
  medal: {
    fontSize: 64,
    marginBottom: 8,
  },
  rankText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#f7c59f',
  },
  rankOf: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(247,197,159,0.6)',
  },
  message: {
    marginTop: 8,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  scoreBox: {
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 4,
  },
  percentile: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#f7c59f',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1a2e',
    fontWeight: '800',
    fontSize: 16,
  },
});
