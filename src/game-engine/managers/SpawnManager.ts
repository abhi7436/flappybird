/**
 * SpawnManager — decides when to spawn each type of entity.
 *
 * All spawn-cooldown constants and probability checks live here.
 * GameEngine calls the `check*` methods each tick; each method returns a
 * typed decision object so the caller knows exactly what (if anything) to
 * instantiate — without SpawnManager needing to own the entity arrays.
 *
 * Call `applyDifficulty(settings)` once per tick (after reading
 * DifficultyManager) so the manager automatically scales to the tier.
 */
import type { PowerUpType } from '../PowerUp';
import type { CoinType } from '../Coin';
import type { DifficultySettings } from '../DifficultyManager';

// ── Default (tier-0) constants ─────────────────────────────────────────────

const DEFAULT_PIPE_SPAWN_DISTANCE  = 280;
const DEFAULT_BUG_SPAWN_CHANCE     = 0.20;

const POWERUP_SPAWN_CHANCE   = 0.25;
const POWERUP_SPAWN_COOLDOWN = 400;
const POWERUP_TYPES: PowerUpType[] = [
  'shield', 'slow_pipes', 'double_score', 'slow_motion', 'magnet',
];

const COIN_SPAWN_CHANCE    = 0.35;
const COIN_SPAWN_COOLDOWN  = 200;
const COIN_GOLDEN_CHANCE   = 0.15;
const BUG_SPAWN_COOLDOWN   = 350;

// ── Decision types ─────────────────────────────────────────────────────────

export interface PipeSpawnDecision {
  spawn: boolean;
}

export interface PowerUpSpawnDecision {
  spawn: boolean;
  type?: PowerUpType;
  y?:    number;
}

export interface CoinSpawnDecision {
  spawn: boolean;
  type?: CoinType;
  y?:    number;
}

export interface BugSpawnDecision {
  spawn: boolean;
  y?:    number;
  /** Second bug y-position — defined when `diff.bugDoubled` is true. */
  y2?:   number;
}

// ── SpawnManager ───────────────────────────────────────────────────────────

export class SpawnManager {
  private canvasWidth:  number;
  private canvasHeight: number;

  private lastPipeX:    number;
  private lastPowerUpX: number;
  private lastCoinX:    number;
  private lastBugX:     number;

  // Live difficulty settings (updated each tick by GameEngine)
  private pipeSpawnDistance: number = DEFAULT_PIPE_SPAWN_DISTANCE;
  private bugSpawnChance:    number = DEFAULT_BUG_SPAWN_CHANCE;
  private hardBugPositions:  boolean = false;
  private bugDoubled:        boolean = false;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.lastPipeX    = 0;
    this.lastPowerUpX = canvasWidth;
    this.lastCoinX    = canvasWidth;
    this.lastBugX     = canvasWidth;
  }

  // ── Difficulty sync ──────────────────────────────────────────────────

  /** Call once per engine tick to keep spawn parameters in sync with the tier. */
  applyDifficulty(settings: Pick<DifficultySettings,
    'pipeSpawnDistance' | 'bugSpawnChance' | 'hardBugPositions' | 'bugDoubled'>
  ): void {
    this.pipeSpawnDistance = settings.pipeSpawnDistance;
    this.bugSpawnChance    = settings.bugSpawnChance;
    this.hardBugPositions  = settings.hardBugPositions;
    this.bugDoubled        = settings.bugDoubled;
  }

  // ── Reset ────────────────────────────────────────────────

  reset(): void {
    this.lastPipeX    = 0;
    this.lastPowerUpX = this.canvasWidth;
    this.lastCoinX    = this.canvasWidth;
    this.lastBugX     = this.canvasWidth;
    this.pipeSpawnDistance = DEFAULT_PIPE_SPAWN_DISTANCE;
    this.bugSpawnChance    = DEFAULT_BUG_SPAWN_CHANCE;
    this.hardBugPositions  = false;
    this.bugDoubled        = false;
  }

  // ── Right-edge helpers ────────────────────────────────────

  pipeRightEdge  (entities: Array<{ getState(): { x: number } }>): number {
    return entities.length ? entities[entities.length - 1].getState().x : this.lastPipeX;
  }
  powerUpRightEdge(entities: Array<{ getState(): { x: number } }>): number {
    return entities.length ? entities[entities.length - 1].getState().x : this.lastPowerUpX;
  }
  coinRightEdge  (entities: Array<{ getState(): { x: number } }>): number {
    return entities.length ? entities[entities.length - 1].getState().x : this.lastCoinX;
  }
  bugRightEdge   (entities: Array<{ getState(): { x: number } }>): number {
    return entities.length ? entities[entities.length - 1].getState().x : this.lastBugX;
  }

  // ── Spawn decisions ───────────────────────────────────────

  checkPipe(rightEdge: number): PipeSpawnDecision {
    if (rightEdge >= this.canvasWidth - this.pipeSpawnDistance) return { spawn: false };
    return { spawn: true };
  }

  checkPowerUp(
    rightEdge: number,
    score:     number,
    rand:      () => number,
  ): PowerUpSpawnDecision {
    if (score === 0) return { spawn: false };
    if (rightEdge >= this.canvasWidth - POWERUP_SPAWN_COOLDOWN) return { spawn: false };
    if (rand() >= POWERUP_SPAWN_CHANCE) return { spawn: false };
    const type = POWERUP_TYPES[Math.floor(rand() * POWERUP_TYPES.length)];
    const margin = 60;
    const y = margin + rand() * (this.canvasHeight - margin * 2 - 28);
    this.lastPowerUpX = this.canvasWidth;
    return { spawn: true, type, y };
  }

  checkCoin(
    rightEdge: number,
    score:     number,
    rand:      () => number,
  ): CoinSpawnDecision {
    if (score === 0) return { spawn: false };
    if (rightEdge >= this.canvasWidth - COIN_SPAWN_COOLDOWN) return { spawn: false };
    if (rand() >= COIN_SPAWN_CHANCE) return { spawn: false };
    const type: CoinType = rand() < COIN_GOLDEN_CHANCE ? 'golden' : 'normal';
    const margin = 80;
    const y = margin + rand() * (this.canvasHeight - margin * 2 - 24);
    this.lastCoinX = this.canvasWidth;
    return { spawn: true, type, y };
  }

  checkBug(
    rightEdge: number,
    score:     number,
    rand:      () => number,
  ): BugSpawnDecision {
    if (score === 0) return { spawn: false };
    if (rightEdge >= this.canvasWidth - BUG_SPAWN_COOLDOWN) return { spawn: false };
    if (rand() >= this.bugSpawnChance) return { spawn: false };

    const margin = 70;
    const usable = this.canvasHeight - margin * 2 - 14;
    let y: number;

    if (this.hardBugPositions) {
      // Tier 2+: spawn at upper third or lower third of the playfield
      if (rand() < 0.5) {
        // upper extreme: top 30 %
        y = margin + rand() * usable * 0.30;
      } else {
        // lower extreme: bottom 30 %
        y = margin + usable * 0.70 + rand() * usable * 0.30;
      }
    } else {
      y = margin + rand() * usable;
    }

    this.lastBugX = this.canvasWidth;

    // Doubled: spawn a second bug at the opposite extreme
    if (this.bugDoubled) {
      const y2 = this.canvasHeight - y - 14; // mirror vertically
      return { spawn: true, y, y2 };
    }

    return { spawn: true, y };
  }
}
