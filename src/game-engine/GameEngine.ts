import { Bird } from './Bird';
import { Pipe } from './Pipe';
import { Collision } from './Collision';
import { Physics } from './Physics';
import { PowerUp, PowerUpType, PowerUpState, POWERUP_DURATIONS } from './PowerUp';
import { ReplayRecorder, ReplayData, ENGINE_VERSION } from './ReplayRecorder';
import { DifficultyManager, DifficultySettings } from './DifficultyManager';

// Re-export so existing imports (`import { getDifficultyTier } from '@engine/GameEngine'`) keep working
export { getDifficultyTier } from './DifficultyManager';

export type GameStatus = 'idle' | 'running' | 'dead';

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  pipeInterval?: number;
  /** Optional seed for deterministic pipe gapY — required for replay. */
  seed?: number;
}

/** An in-play power-up effect with its expiry (epoch ms; 0 = permanent until used). */
export interface ActiveEffect {
  type:      PowerUpType;
  expiresAt: number;
}

export interface GameState {
  status:         GameStatus;
  score:          number;
  bird:           ReturnType<Bird['getState']>;
  pipes:          ReturnType<Pipe['getState']>[];
  difficultyTier: number;
  powerUps:       PowerUpState[];
  activeEffects:  ActiveEffect[];
  /** Convenience flag — true while shield effect is active. */
  hasShield:      boolean;
}

/** Callbacks injected by the rendering layer — keeps physics pure. */
export interface GameEngineCallbacks {
  onScoreChange?:      (score: number) => void;
  onGameOver?:         (finalScore: number) => void;
  onDifficultyChange?: (tier: number) => void;
  onPowerUpCollected?: (type: PowerUpType) => void;
  /** Fired once per game with reproducible replay data. */
  onReplayReady?:      (replay: ReplayData) => void;
}

// ── Engine-level constants (not difficulty-related) ──────────────────────
const PIPE_SPAWN_DISTANCE  = 280;

// Power-up spawn chance per eligibility check
const POWERUP_SPAWN_CHANCE   = 0.25;
const POWERUP_TYPES: PowerUpType[] = ['shield', 'slow_pipes', 'double_score'];
const POWERUP_SPAWN_COOLDOWN = 400; // min px between power-up lead edges

/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * Returns values in [0, 1). Used so pipe positions are deterministic
 * and replays reproduce exactly the same layout.
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

export class GameEngine {
  private bird:           Bird;
  private pipes:          Pipe[];
  private powerUps:       PowerUp[];
  private activeEffects:  Map<PowerUpType, number>; // type → expiresAt ms
  private score:          number;
  private status:         GameStatus;
  private config:         GameConfig;
  private callbacks:      GameEngineCallbacks;
  private difficultyTier: number;
  private lastPipeX:      number;
  private lastPowerUpX:   number;
  private lastTimestamp:  number;
  private rand:           () => number;
  private seed:           number;
  private recorder:       ReplayRecorder;
  private gameStartMs:    number;
  readonly engineVersion  = ENGINE_VERSION;

  constructor(config: GameConfig, callbacks: GameEngineCallbacks = {}) {
    this.config    = config;
    this.callbacks = callbacks;
    this.seed      = config.seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rand      = mulberry32(this.seed);
    this.recorder  = new ReplayRecorder();

    const startX = config.canvasWidth  * 0.25;
    const startY = config.canvasHeight / 2;

    this.bird           = new Bird({ x: startX, y: startY });
    this.pipes          = [];
    this.powerUps       = [];
    this.activeEffects  = new Map();
    this.score          = 0;
    this.status         = 'idle';
    this.difficultyTier = 0;
    this.lastPipeX      = 0;  // 0 so first pipe spawns on tick 1
    this.lastPowerUpX   = this.config.canvasWidth;
    this.lastTimestamp  = 0;
    this.gameStartMs    = 0;
  }

  // ── Control ───────────────────────────────────────────────

  start(): void {
    this.status        = 'running';
    this.lastTimestamp = 0;
    this.gameStartMs   = performance?.now?.() ?? Date.now();
    this.recorder.start(this.gameStartMs);
  }

  jump(): void {
    if (this.status !== 'running') return;
    this.bird.jump();
    this.recorder.recordJump(performance?.now?.() ?? Date.now());
  }

  reset(): void {
    const startX = this.config.canvasWidth  * 0.25;
    const startY = this.config.canvasHeight / 2;

    this.seed  = this.config.seed ?? Math.floor(Math.random() * 0xffffffff);
    this.rand  = mulberry32(this.seed);

    this.bird.reset(startX, startY);
    this.pipes          = [];
    this.powerUps       = [];
    this.activeEffects  = new Map();
    this.score          = 0;
    this.status         = 'idle';
    this.difficultyTier = 0;
    this.lastPipeX      = 0;  // 0 so first pipe spawns on tick 1
    this.lastPowerUpX   = this.config.canvasWidth;
    this.lastTimestamp  = 0;
    this.gameStartMs    = 0;
    this.recorder.reset();
  }

  // ── Tick ─────────────────────────────────────────────────

  /**
   * Advance simulation by one frame. Call from requestAnimationFrame.
   * Returns false when the game ends (bird died).
   */
  tick(timestamp: number): boolean {
    if (this.status !== 'running') return false;

    const deltaMs = this.lastTimestamp ? timestamp - this.lastTimestamp : 16.67;
    this.lastTimestamp = timestamp;

    // Expire timed power-up effects
    this.tickEffects(timestamp);

    const diff  = DifficultyManager.getSettings(this.difficultyTier);
    const speed = this.isEffectActive('slow_pipes') ? diff.pipeSpeed * 0.45 : diff.pipeSpeed;

    this.bird.setGravity(diff.gravity);
    this.bird.update(deltaMs);

    this.maybeSpawnPipe(diff, speed);
    for (const pipe of this.pipes) pipe.update(deltaMs);

    this.maybeSpawnPowerUp(speed);
    for (const pu of this.powerUps) pu.update(deltaMs);

    // Score — doubled while double_score effect is active
    let newScore = this.score;
    const multiplier = this.isEffectActive('double_score') ? 2 : 1;
    for (const pipe of this.pipes) {
      if (!pipe.getState().scored && Collision.birdPassed(this.bird, pipe)) {
        pipe.markScored();
        newScore += multiplier;
      }
    }
    if (newScore !== this.score) {
      this.score = newScore;
      const newTier = DifficultyManager.getTier(this.score);
      if (newTier !== this.difficultyTier) {
        this.difficultyTier = newTier;
        this.callbacks.onDifficultyChange?.(newTier);
      }
      this.callbacks.onScoreChange?.(this.score);
    }

    // Power-up collision
    for (const pu of this.powerUps) {
      if (pu.getState().collected) continue;
      if (Collision.birdHitsPowerUp(this.bird, pu)) {
        pu.collect();
        this.activateEffect(pu.getState().type, timestamp);
        this.callbacks.onPowerUpCollected?.(pu.getState().type);
      }
    }

    // Cleanup off-screen entities
    this.pipes    = this.pipes.filter((p) => !p.isOffScreen());
    this.powerUps = this.powerUps.filter((p) => !p.isOffScreen() && !p.getState().collected);

    // Pipe collision — shield absorbs one hit
    if (Collision.check(this.bird, this.pipes, this.config.canvasHeight)) {
      if (this.isEffectActive('shield')) {
        this.activeEffects.delete('shield'); // consumed
        this.bird.jump();                    // bounce away
      } else {
        this.status = 'dead';
        const nowMs  = performance?.now?.() ?? Date.now();
        const replay = this.recorder.finish(
          nowMs, this.score,
          this.config.canvasWidth, this.config.canvasHeight, this.seed
        );
        this.callbacks.onGameOver?.(this.score);
        this.callbacks.onReplayReady?.(replay);
        return false;
      }
    }

    return true;
  }

  // ── Effect management ────────────────────────────────────

  private tickEffects(nowMs: number): void {
    for (const [type, expiresAt] of this.activeEffects) {
      if (expiresAt > 0 && nowMs >= expiresAt) this.activeEffects.delete(type);
    }
  }

  private activateEffect(type: PowerUpType, nowMs: number): void {
    const duration  = POWERUP_DURATIONS[type];
    const expiresAt = duration > 0 ? nowMs + duration : 0;
    this.activeEffects.set(type, expiresAt);
  }

  isEffectActive(type: PowerUpType): boolean {
    return this.activeEffects.has(type);
  }

  // ── Pipe spawning ─────────────────────────────────────────

  private maybeSpawnPipe(diff: DifficultySettings, speed: number): void {
    const rightEdge = this.pipes.length
      ? this.pipes[this.pipes.length - 1].getState().x
      : this.lastPipeX;

    if (rightEdge < this.config.canvasWidth - PIPE_SPAWN_DISTANCE) {
      const margin  = 60;
      // Use 0.88 of canvasHeight as the effective floor so the bottom pipe
      // always has visible body above the ground strip (GROUND_FRAC = 0.88).
      const groundY = this.config.canvasHeight * 0.88;
      const maxGapY = groundY - diff.gapHeight - margin;
      const baseGapY = this.rand() * (maxGapY - margin) + margin;
      // Random vertical variance grows with tier (0 at tier 0)
      const variance = diff.verticalVariance > 0
        ? (this.rand() - 0.5) * diff.verticalVariance
        : 0;
      const gapY = Math.min(maxGapY, Math.max(margin, baseGapY + variance));

      this.pipes.push(new Pipe({
        x:                    this.config.canvasWidth,
        gapY,
        gapHeight:            diff.gapHeight,
        speed,
        oscillating:          diff.oscillating,
        oscillationAmplitude: diff.oscillationAmplitude,
        oscillationSpeed:     diff.oscillationSpeed,
      }));
    }
  }

  // ── Power-up spawning ─────────────────────────────────────

  private maybeSpawnPowerUp(pipeSpeed: number): void {
    if (this.score === 0) return; // wait until bird clears first pipe

    const rightEdge = this.powerUps.length
      ? this.powerUps[this.powerUps.length - 1].getState().x
      : this.lastPowerUpX;

    if (rightEdge < this.config.canvasWidth - POWERUP_SPAWN_COOLDOWN) {
      if (this.rand() < POWERUP_SPAWN_CHANCE) {
        const type   = POWERUP_TYPES[Math.floor(this.rand() * POWERUP_TYPES.length)];
        const margin = 60;
        const y      = margin + this.rand() * (this.config.canvasHeight - margin * 2 - 28);

        this.powerUps.push(new PowerUp({
          x:     this.config.canvasWidth,
          y,
          type,
          speed: pipeSpeed * 0.9,
        }));
        this.lastPowerUpX = this.config.canvasWidth;
      }
    }
  }

  // ── Snapshot ─────────────────────────────────────────────

  getState(): GameState {
    const effects: ActiveEffect[] = [];
    for (const [type, expiresAt] of this.activeEffects) {
      effects.push({ type, expiresAt });
    }

    return {
      status:         this.status,
      score:          this.score,
      bird:           this.bird.getState(),
      pipes:          this.pipes.map((p) => p.getState()),
      difficultyTier: this.difficultyTier,
      powerUps:       this.powerUps.map((p) => p.getState()),
      activeEffects:  effects,
      hasShield:      this.isEffectActive('shield'),
    };
  }

  getScore():  number     { return this.score;  }
  getStatus(): GameStatus { return this.status; }
  getSeed():   number     { return this.seed;   }
}