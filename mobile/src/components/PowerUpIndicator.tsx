/**
 * PowerUpIndicator — displays active power-up effects with countdown
 * bars. Shown as a horizontal row of icons in the game HUD.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { ActiveEffect } from '@engine/GameEngine';

const EFFECT_META: Record<string, { icon: string; color: string; label: string }> = {
  shield:       { icon: '🛡️', color: '#4fc3f7', label: 'Shield'  },
  slow_pipes:   { icon: '🐢', color: '#aed581', label: 'Slow'    },
  double_score: { icon: '×2', color: '#ffb74d', label: 'Double'  },
  magnet:       { icon: '🧲', color: '#90caf9', label: 'Magnet'  },
};

interface EffectBadgeProps {
  effect: ActiveEffect;
  nowMs:  number;
}

function EffectBadge({ effect, nowMs }: EffectBadgeProps) {
  const meta      = EFFECT_META[effect.type];
  const barAnim   = useRef(new Animated.Value(1)).current;
  const permanent = effect.expiresAt === 0;
  const total     = permanent ? 0 : effect.expiresAt - nowMs;
  const remaining = permanent ? Number.POSITIVE_INFINITY : Math.max(0, effect.expiresAt - nowMs);
  const isExpiringSoon = effect.type === 'shield' && !permanent && remaining <= 2_000;
  const blinkOn = !isExpiringSoon || Math.floor(nowMs / 140) % 2 === 0;

  useEffect(() => {
    if (permanent) return;
    Animated.timing(barAnim, {
      toValue:        0,
      duration:       Math.max(0, total),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect.expiresAt]);

  const barWidth = barAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[
      styles.badge,
      { borderColor: meta.color },
      isExpiringSoon && !blinkOn ? styles.badgeBlinkOff : styles.badgeBlinkOn,
    ]}>
      <Text style={[styles.icon, isExpiringSoon && styles.iconWarning]}>{meta.icon}</Text>
      {!permanent && (
        <View style={styles.barBg}>
          <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: meta.color }]} />
        </View>
      )}
    </View>
  );
}

interface PowerUpIndicatorProps {
  effects: ActiveEffect[];
}

export function PowerUpIndicator({ effects }: PowerUpIndicatorProps) {
  const nowMs = Date.now();
  if (effects.length === 0) return null;

  return (
    <View style={styles.row}>
      {effects.map((e) => (
        <EffectBadge key={e.type} effect={e} nowMs={nowMs} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    minWidth: 42,
  },
  badgeBlinkOn: {
    opacity: 1,
    transform: [{ scale: 1.04 }],
  },
  badgeBlinkOff: {
    opacity: 0.45,
    transform: [{ scale: 0.96 }],
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  iconWarning: {
    textShadowColor: 'rgba(79,195,247,0.9)',
    textShadowRadius: 8,
  },
  barBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
});
