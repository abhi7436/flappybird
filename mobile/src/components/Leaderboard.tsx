import React, { memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import type { LeaderboardEntry } from '../types';

function RankBadge({ entry, prevRank }: { entry: LeaderboardEntry; prevRank?: number }) {
  if (prevRank == null || prevRank === entry.rank) return null;
  const up = entry.rank < prevRank;
  const diff = Math.abs(prevRank - entry.rank);
  return (
    <Text style={[styles.badge, up ? styles.badgeUp : styles.badgeDown]}>
      {up ? `↑${diff}` : `↓${diff}`}
    </Text>
  );
}

const EntryRow = memo(
  ({
    entry,
    isMe,
    prevRank,
  }: {
    entry: LeaderboardEntry & { previousRank?: number };
    isMe: boolean;
    prevRank?: number;
  }) => (
    <View style={[styles.row, isMe && styles.rowMe, !entry.alive && styles.rowDead]}>
      <Text style={[styles.rank, isMe && styles.rankMe]}>#{entry.rank}</Text>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {entry.username}
      </Text>
      <View style={styles.right}>
        <RankBadge entry={entry} prevRank={prevRank} />
        <Text style={[styles.score, isMe && styles.scoreMe]}>{entry.score}</Text>
      </View>
    </View>
  )
);

interface LeaderboardProps {
  myUserId?: string;
}

export default function Leaderboard({ myUserId }: LeaderboardProps) {
  const leaderboard = useGameStore((s) => s.leaderboard);

  const top10 = leaderboard.slice(0, 10);
  const myEntry = myUserId
    ? leaderboard.find((e) => e.userId === myUserId)
    : undefined;
  const myOutsideTop10 = myEntry && (myEntry.rank ?? 99) > 10;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      <FlatList
        data={top10}
        keyExtractor={(e) => e.userId}
        renderItem={({ item }) => (
          <EntryRow
            entry={item as any}
            isMe={item.userId === myUserId}
            prevRank={(item as any).previousRank}
          />
        )}
        scrollEnabled={false}
      />
      {myOutsideTop10 && myEntry && (
        <>
          <View style={styles.divider} />
          <EntryRow
            entry={myEntry as any}
            isMe
            prevRank={(myEntry as any).previousRank}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 12,
    minWidth: 220,
  },
  title: {
    color: '#f7c59f',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  rowMe: {
    backgroundColor: 'rgba(247,197,159,0.2)',
  },
  rowDead: {
    opacity: 0.5,
  },
  rank: { color: 'rgba(255,255,255,0.5)', width: 30, fontSize: 12 },
  rankMe: { color: '#f7c59f', fontWeight: '700' },
  name: { flex: 1, color: '#fff', fontSize: 13 },
  nameMe: { color: '#f7c59f', fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: { color: '#fff', fontWeight: '700', fontSize: 13, minWidth: 32, textAlign: 'right' },
  scoreMe: { color: '#f7c59f' },
  badge: { fontSize: 10, fontWeight: '800', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  badgeUp: { backgroundColor: 'rgba(39,174,96,0.8)', color: '#fff' },
  badgeDown: { backgroundColor: 'rgba(192,57,43,0.8)', color: '#fff' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
});
