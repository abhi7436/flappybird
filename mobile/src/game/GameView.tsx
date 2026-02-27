import React, { useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { useGameEngine } from './useGameEngine';
import { Background, Ground, Pipe, BirdSprite, PowerUpSprite } from './renderer/SkiaRenderer';
import HUD from '../components/HUD';
import { PowerUpIndicator } from '../components/PowerUpIndicator';

interface GameViewProps {
  roomId: string;
  skinId?: string;
  onScoreChange?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
}

const GROUND_H   = 80;
const SCROLL_SPD = 3;

export default function GameView({
  roomId,
  skinId = 'classic',
  onScoreChange,
  onGameOver,
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

  // ── Tap gesture — flap ───────────────────────────────────
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onStart(() => {
      if (gameState.status === 'idle') {
        startGame();
        return;
      }
      if (gameState.status === 'dead') {
        resetGame();
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
