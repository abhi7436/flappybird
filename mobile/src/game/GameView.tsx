import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { useGameEngine } from './useGameEngine';
import { Background, Ground, Pipe, BirdSprite, PowerUpSprite, CoinSprite, BugSprite } from './renderer/SkiaRenderer';
import HUD from '../components/HUD';
import { PowerUpIndicator } from '../components/PowerUpIndicator';

interface GameViewProps {
  roomId: string;
  skinId?: string;
  onScoreChange?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  /** Called when the player taps to start a new round (for WS start_game). */
  onGameStart?: () => void;
  /** When true, auto-start the engine (host started a new round via WS). */
  gameStarted?: boolean;
}

const GROUND_H   = 80;
const SCROLL_SPD = 3;
const HAPTIC_COOLDOWN_MS = 90;

export default function GameView({
  roomId,
  skinId = 'classic',
  onScoreChange,
  onGameOver,
  onGameStart,
  gameStarted = false,
}: GameViewProps) {
  const { width, height } = useWindowDimensions();
  const groundOffsetRef   = useRef(0);
  const rafRef            = useRef<number | null>(null);
  const lastHapticAtRef   = useRef(0);

  const canvasWidth  = width;
  const canvasHeight = height;

  const { gameState, jump, startGame, resetGame } = useGameEngine({
    canvasWidth,
    canvasHeight,
    onScoreChange,
    onGameOver,
  });

  const shieldEffect = gameState.activeEffects.find((effect) => effect.type === 'shield');
  const shieldExpiringSoon = !!shieldEffect
    && shieldEffect.expiresAt > 0
    && shieldEffect.expiresAt - Date.now() <= 2_000;

  // Auto-reset engine when round resets, auto-start when server signals game_started
  // Only applies in multiplayer (onGameStart is defined); solo mode manages its own lifecycle.
  useEffect(() => {
    if (!onGameStart) return; // Solo mode — no auto lifecycle
    if (!gameStarted && gameState.status === 'dead') {
      resetGame();
    } else if (gameStarted && gameState.status === 'idle') {
      startGame();
    }
  }, [gameStarted, gameState.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tap gesture — flap ───────────────────────────────────
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => {
      if (gameState.status === 'idle') {
        if (onGameStart) {
          // Multiplayer: let server control game start via game_started event.
          // The auto-start effect will call startGame() when gameStarted flips.
          onGameStart();
        } else {
          // Solo mode: start immediately (no server involved).
          startGame();
        }
        return;
      }
      if (gameState.status === 'dead') {
        // In multiplayer the auto-reset effect handles this.
        // In solo mode, the parent screen shows a death overlay with
        // its own "Play Again" button, so ignore taps here.
        return;
      }
      jump();

      const now = Date.now();
      if (now - lastHapticAtRef.current >= HAPTIC_COOLDOWN_MS) {
        lastHapticAtRef.current = now;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });

  useEffect(() => {
    const wrap = Math.max(canvasWidth, 1);
    let lastTs = 0;

    const tick = (ts: number) => {
      if (lastTs === 0) {
        lastTs = ts;
      }

      const dt = ts - lastTs;
      lastTs = ts;

      if (gameState.status === 'running') {
        // Keep speed consistent even when frame rate drops.
        const speed = SCROLL_SPD * (dt / 16.67);
        groundOffsetRef.current = (groundOffsetRef.current + speed) % wrap;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [gameState.status, canvasWidth]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={tapGesture}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          <Background width={canvasWidth} height={canvasHeight} />

          {gameState.pipes.map((pipe, i) => (
            <Pipe key={i} pipe={pipe} canvasHeight={canvasHeight} />
          ))}

          {/* Power-ups */}
          {(gameState as any).powerUps?.map((pu: any) => (
            <PowerUpSprite key={pu.id} powerUp={pu} />
          ))}

          {/* Coins */}
          {(gameState as any).coins?.map((c: any) => (
            <CoinSprite key={c.id} coin={c} />
          ))}

          {/* Bugs */}
          {(gameState as any).bugs?.map((b: any) => (
            <BugSprite key={b.id} bug={b} />
          ))}

          {/* Bird with skin + shield */}
          <BirdSprite
            bird={gameState.bird}
            skinId={skinId}
            shielded={(gameState as any).hasShield ?? false}
            shieldExpiring={shieldExpiringSoon}
          />

          <Ground
            width={canvasWidth}
            height={canvasHeight}
            offsetX={groundOffsetRef.current}
          />
        </Canvas>
      </GestureDetector>

      {/* React Native overlay */}
      <HUD
        score={gameState.score}
        status={gameState.status}
        difficultyTier={gameState.difficultyTier}
      />
      <PowerUpIndicator effects={(gameState as any).activeEffects ?? []} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#74b9ff',
  },
});
