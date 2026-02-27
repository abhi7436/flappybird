/**
 * SkinSelector — FlatList grid of available skins.
 * Shows owned skins as selectable, locked skins grayed with a lock badge.
 * Calls api.skins.equip() on selection and notifies parent via onEquip.
 */
import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import type { SkinWithOwnership } from '../../../src/server/types';
import { SKINS } from '../game/renderer/SkiaRenderer';

const RARITY_COLORS: Record<string, string> = {
  common:    '#9e9e9e',
  rare:      '#2196f3',
  epic:      '#9c27b0',
  legendary: '#ff9800',
};

interface SkinCardProps {
  skin:     SkinWithOwnership;
  equipped: boolean;
  onPress:  (id: string) => void;
}

function SkinCard({ skin, equipped, onPress }: SkinCardProps) {
  const colors   = SKINS[skin.id] ?? SKINS.classic;
  const rarColor = RARITY_COLORS[skin.rarity] ?? '#9e9e9e';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        equipped && styles.cardEquipped,
        !skin.owned && styles.cardLocked,
        { borderColor: rarColor },
      ]}
      onPress={() => skin.owned && onPress(skin.id)}
      activeOpacity={skin.owned ? 0.7 : 1}
    >
      {/* Bird preview */}
      <View style={[styles.birdPreview, { backgroundColor: colors.body }]}>
        <View style={[styles.birdWing,  { backgroundColor: colors.wing }]} />
        <View style={[styles.birdEye,   { backgroundColor: colors.eye  }]} />
        <View style={[styles.birdBeak,  { backgroundColor: colors.beak }]} />
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.skinName} numberOfLines={1}>{skin.name}</Text>
        <Text style={[styles.rarity, { color: rarColor }]}>{skin.rarity}</Text>
      </View>

      {equipped && (
        <View style={styles.equippedBadge}>
          <Text style={styles.equippedText}>ON</Text>
        </View>
      )}

      {!skin.owned && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
          {skin.min_elo > 0 && (
            <Text style={styles.lockHint}>{skin.min_elo} ELO</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

interface SkinSelectorProps {
  skins:    SkinWithOwnership[];
  loading?: boolean;
  onEquip:  (skinId: string) => void;
}

export function SkinSelector({ skins, loading, onEquip }: SkinSelectorProps) {
  const equippedId = skins.find((s) => s.equipped)?.id;

  const renderItem = useCallback(
    ({ item }: { item: SkinWithOwnership }) => (
      <SkinCard
        skin={item}
        equipped={item.id === equippedId}
        onPress={onEquip}
      />
    ),
    [equippedId, onEquip]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <FlatList
      data={skins}
      keyExtractor={(s) => s.id}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: 12, gap: 10 },
  row:  { gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardEquipped: { backgroundColor: 'rgba(255,255,255,0.18)' },
  cardLocked:   { opacity: 0.6 },

  birdPreview: {
    width: 52,
    height: 36,
    borderRadius: 18,
    marginBottom: 6,
    justifyContent: 'center',
    position: 'relative',
  },
  birdWing: {
    position: 'absolute',
    left: 4,
    bottom: 6,
    width: 22,
    height: 10,
    borderRadius: 5,
  },
  birdEye: {
    position: 'absolute',
    right: 10,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  birdBeak: {
    position: 'absolute',
    right: 0,
    top: 16,
    width: 10,
    height: 5,
    borderRadius: 2,
  },

  cardInfo: { alignItems: 'center' },
  skinName: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  rarity:   { fontSize: 10, fontWeight: '500', marginTop: 2 },

  equippedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#4caf50',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  equippedText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: { fontSize: 22 },
  lockHint: { color: '#ffb74d', fontSize: 11, fontWeight: '600', marginTop: 2 },
});
