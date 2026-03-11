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

  const canvasWidth  = width;
  const canvasHeight = height;

  const { gameState, jump, startGame, resetGame } = useGameEngine({
    canvasWidth,
    canvasHeight,
    onScoreChange,
    onGameOver,
  });

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  React.useEffect(() => {
    if (gameState.status === 'running') {
      groundOffsetRef.current += SCROLL_SPD;
    }
  }, [gameState]);

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
