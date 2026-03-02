/**
 * src/game-engine/index.ts
 *
 * Barrel export for the entire game-engine layer.
 * Import from '@engine' (or '../game-engine') instead of reaching into
 * individual files to keep internal paths stable.
 */

// ── Core engine ────────────────────────────────────────────────────────────
export {
  GameEngine,
  getDifficultyTier,
} from './GameEngine';
export type {
  GameStatus,
  GameConfig,
  GameEngineCallbacks,
  GameState,
  ActiveEffect,
} from './GameEngine';

// ── Entities ───────────────────────────────────────────────────────────────
export { Bird }             from './Bird';
export { Pipe }             from './Pipe';
export { Coin }             from './Coin';
export type { CoinState, CoinType } from './Coin';
export { Bug }              from './Bug';
export type { BugState }    from './Bug';
export { PoopDrop }         from './PoopDrop';
export type { PoopState }   from './PoopDrop';

// ── Systems ────────────────────────────────────────────────────────────────
export { Physics }           from './Physics';
export { Collision }         from './Collision';
export { DifficultyManager } from './DifficultyManager';
export { ReplayRecorder }    from './ReplayRecorder';
export type { ReplayData }   from './ReplayRecorder';
export { RandomEvents }      from './RandomEvents';
export type { RandomEvent, RandomEventType } from './RandomEvents';
export { PowerUp }           from './PowerUp';
export type { PowerUpType, PowerUpState } from './PowerUp';
export { POWERUP_DURATIONS } from './PowerUp';

// ── Managers ───────────────────────────────────────────────────────────────
export { PowerUpManager }  from './managers/PowerUpManager';
export { SpawnManager }    from './managers/SpawnManager';
export { EventManager }    from './managers/EventManager';
export type { ActiveEffect as ManagedEffect } from './managers/PowerUpManager';
export type {
  PipeSpawnDecision,
  PowerUpSpawnDecision,
  CoinSpawnDecision,
  BugSpawnDecision,
} from './managers/SpawnManager';
export type { EventManagerCallbacks } from './managers/EventManager';
