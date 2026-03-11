import { Bird } from './Bird';
import { Pipe } from './Pipe';
import { Collision } from './Collision';
import { Physics } from './Physics';
import { PowerUp, PowerUpType, PowerUpState } from './PowerUp';
import { ReplayRecorder, ReplayData, ENGINE_VERSION } from './ReplayRecorder';
import { DifficultyManager, DifficultySettings } from './DifficultyManager';
import { Coin, CoinType, CoinState, CoinConfig } from './Coin';
import { Bug, BugState, BugConfig } from './Bug';
import { PoopDrop, PoopState } from './PoopDrop';
import { RandomEvent, RandomEventType } from './RandomEvents';
import { PowerUpManager } from './managers/PowerUpManager';
import { SpawnManager } from './managers/SpawnManager';
import { EventManager } from './managers/EventManager';
import { ObjectPool } from './ObjectPool';

// Re-export so existing imports (`import { getDifficultyTier } from '@engine/GameEngine'`) keep working
export { getDifficultyTier } from './DifficultyManager';

export type GameStatus = 'idle' | 'running' | 'dead';

/** Strict game-state constants (used across engine + UI layers). */
export const GAME_STATE = {
  WAITING:   'waiting',
  RUNNING:   'running',
  GAME_OVER: 'game_over',
} as const;

/** Maximum frame delta allowed (ms) — clamps tab-away / resume spikes. */
const MAX_DELTA_MS = 50;

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  pipeInterval?: number;
  /** Optional seed for deterministic pipe gapY — required for replay. */
  seed?: number;
}

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
  coins:          CoinState[];
  bugs:           BugState[];
  poops:          PoopState[];
  /** True when tier >= 1 (score ≥ 25), drives dark canvas overlay. */
  isDarkMode:     boolean;
  /** 0 = none | 1 = intense | 2 = frantic. Drives SoundManager bgm. */
  musicIntensity: 0 | 1 | 2;
}

/** Callbacks injected by the rendering layer — keeps physics pure. */
export interface GameEngineCallbacks {
  onScoreChange?:          (score: number) => void;
  onGameOver?:             (finalScore: number) => void;
  onDifficultyChange?:     (tier: number) => void;
  /** Fired whenever the bgm intensity level changes (0 | 1 | 2). */
  onMusicIntensityChange?: (intensity: 0 | 1 | 2) => void;
  onPowerUpCollected?:     (type: PowerUpType) => void;
  /** Fired once per game with reproducible replay data. */
  onReplayReady?:          (replay: ReplayData) => void;
  onCoinCollected?:        (type: CoinType, score: number) => void;
  onBugCollected?:         () => void;
  onPoopSplash?:           (x: number, y: number) => void;
  onRandomEvent?:          (e: RandomEvent) => void;
  onRandomEventEnd?:   (type: RandomEventType) => void;
}

// ── Engine-level constants ─────────────────────────────────────────────────
// (All spawn constants are now owned by SpawnManager)

// Poop
const POOP_COOLDOWN_MS     = 3_500;
const POOP_GAP_BONUS_PX    = 40;
const POOP_GAP_DURATION_MS = 5_000;

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
  private coins:          Coin[];
  private bugs:           Bug[];
  private poops:          PoopDrop[];
  private poopCooldown:   number;
  // ── Managers (Phase 5) ────────────────────────────────────
  private powerUpManager: PowerUpManager;
  private spawnManager:   SpawnManager;
  private eventManager:   EventManager;
  // ── Object pools (Phase 7) ─────────────────────────────────
  private coinPool: ObjectPool<Coin, CoinConfig>;
  private bugPool:  ObjectPool<Bug,  BugConfig>;
  // ─────────────────────────────────────────────────
  private score:          number;
  private status:         GameStatus;
  private config:         GameConfig;
  private callbacks:      GameEngineCallbacks;
  private difficultyTier: number;
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
    this.coins          = [];
    this.bugs           = [];
    this.poops          = [];
    this.poopCooldown   = 0;

    // ── Managers ──────────────────────────────
    this.powerUpManager = new PowerUpManager();
    this.spawnManager   = new SpawnManager(config.canvasWidth, config.canvasHeight);
    this.eventManager   = new EventManager(
      () => this.rand(),
      {
        onEvent:    (e)    => this.callbacks.onRandomEvent?.(e),
        onEventEnd: (type) => this.callbacks.onRandomEventEnd?.(type),
      },
    );
    // ── Object pools ─────────────────────────────
    const COIN_STUB: CoinConfig = { x: 0, y: 0, type: 'normal', speed: 0 };
    const BUG_STUB:  BugConfig  = { x: 0, y: 0, speed: 0 };
    this.coinPool = new ObjectPool<Coin, CoinConfig>(
      () => new Coin(COIN_STUB),
      (c, cfg) => c.reconfigure(cfg),
    );
    this.bugPool = new ObjectPool<Bug, BugConfig>(
      () => new Bug(BUG_STUB),
      (b, cfg) => b.reconfigure(cfg),
    );
    this.coinPool.prewarm(8, COIN_STUB);
    this.bugPool.prewarm(4, BUG_STUB);
    // ─────────────────────────────────

    this.score          = 0;
    this.status         = 'idle';
    this.difficultyTier = 0;
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
    // Release entity pool instances before clearing
    for (const c of this.coins) this.coinPool.release(c);
    for (const b of this.bugs)  this.bugPool.release(b);
    this.coins          = [];
    this.bugs           = [];
    this.poops          = [];
    this.poopCooldown   = 0;
    this.powerUpManager.reset();
    this.spawnManager.reset();
    this.eventManager.reset();
    this.score          = 0;
    this.status         = 'idle';
    this.difficultyTier = 0;
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

    const rawDelta = this.lastTimestamp ? timestamp - this.lastTimestamp : 16.67;
    const deltaMs   = Math.min(rawDelta, MAX_DELTA_MS);   // clamp first-frame / tab-resume spikes
    this.lastTimestamp = timestamp;

    // Expire timed power-up effects
    const expired = this.powerUpManager.tick(timestamp);
    for (const type of expired) {
      if (type === 'turbo_jump') this.bird.setJumpStrength(Bird.DEFAULT_JUMP_STRENGTH);
    }

    const diff      = DifficultyManager.getSettings(this.difficultyTier);
    const speedMult = this.powerUpManager.getSpeedMultiplier();
    const speed     = diff.pipeSpeed * speedMult;

    // Sync spawn manager with current tier settings
    this.spawnManager.applyDifficulty(diff);

    this.bird.setGravity(diff.gravity);
    this.bird.update(deltaMs);

    // Random events: returns wind delta to apply per-frame
    const windVy = this.eventManager.tick(timestamp, this.score, diff.windEventBoost);
    if (windVy !== 0) this.bird.addVerticalVelocity(windVy);

    this.maybeSpawnPipe(diff, speed);
    for (const pipe of this.pipes) pipe.update(deltaMs, timestamp);

    this.maybeSpawnPowerUp(speed);
    for (const pu of this.powerUps) pu.update(deltaMs);

    // Coins & bugs
    this.maybeSpawnCoin(speed);
    this.maybeSpawnBug(speed);
    for (const c of this.coins) c.update(deltaMs);
    for (const b of this.bugs)  b.update(deltaMs);

    // Magnet: attract nearby coins to bird
    if (this.powerUpManager.isActive('magnet')) {
      const { cx, cy } = this.bird.getCircleHitbox();
      for (const c of this.coins) {
        const s   = c.getState();
        const dx  = cx - (s.x + s.width  / 2);
        const dy  = cy - (s.y + s.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) c.attractTo(cx, cy, deltaMs);
      }
    }

    // Poops
    for (const p of this.poops) {
      if (p.getState().splashed) continue;
      p.update(deltaMs);
      const pb = p.getBounds();
      // Check vs pipe bottom caps
      for (const pipe of this.pipes) {
        const ps = pipe.getState();
        const capTop = ps.gapY + ps.gapHeight + ps.tempGapBonus; // top of bottom pipe
        if (
          pb.right  >= ps.x &&
          pb.left   <= ps.x + ps.width &&
          pb.bottom >= capTop &&
          pb.top    <= capTop + 12
        ) {
          p.splash(timestamp, capTop);
          pipe.widenGap(POOP_GAP_BONUS_PX, POOP_GAP_DURATION_MS, timestamp);
          this.callbacks.onPoopSplash?.(pb.left + 8, capTop);
          break;
        }
      }
      // Off-screen (floor)
      if (p.isOffScreen(this.config.canvasHeight)) {
        p.splash(timestamp);
        this.callbacks.onPoopSplash?.(p.getState().x, this.config.canvasHeight - 12);
      }
    }
    this.poops = this.poops.filter(p => !p.isDone(timestamp) && !p.isOffScreen(this.config.canvasHeight + 50));

    // Score — 2× while double_score, 3× while golden_coin
    let newScore = this.score;
    const multiplier = this.powerUpManager.getScoreMultiplier();
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
        const newDiff = DifficultyManager.getSettings(newTier);
        this.callbacks.onMusicIntensityChange?.(newDiff.musicIntensity);
      }
      this.callbacks.onScoreChange?.(this.score);
    }

    // Power-up collision
    for (const pu of this.powerUps) {
      if (pu.getState().collected) continue;
      if (Collision.birdHitsPowerUp(this.bird, pu)) {
        pu.collect();
        this.powerUpManager.activate(pu.getState().type, timestamp);
        this.callbacks.onPowerUpCollected?.(pu.getState().type);
      }
    }

    // Coin collection
    for (const c of this.coins) {
      if (c.getState().collected) continue;
      const cs = c.getState();
      const fakePu = { getBounds: () => c.getBounds(), getState: () => cs } as any;
      if (Collision.birdHitsPowerUp(this.bird, fakePu)) {
        c.collect();
        const scoreGain = cs.type === 'golden' ? 3 : 1;
        if (cs.type === 'golden') this.powerUpManager.activate('golden_coin', timestamp);
        this.callbacks.onCoinCollected?.(cs.type, scoreGain);
      }
    }

    // Bug collection
    for (const b of this.bugs) {
      if (b.getState().collected) continue;
      const bs = b.getState();
      const fakePu = { getBounds: () => b.getBounds(), getState: () => bs } as any;
      if (Collision.birdHitsPowerUp(this.bird, fakePu)) {
        b.collect();
        this.bird.setJumpStrength(-14);
        this.powerUpManager.activate('turbo_jump', timestamp);
        this.bird.jump();
        this.callbacks.onBugCollected?.();
      }
    }

    // Cleanup off-screen entities — release coins and bugs back to their pools
    const liveCoins: Coin[] = [];
    for (const c of this.coins) {
      if (c.isOffScreen() || c.getState().collected) this.coinPool.release(c);
      else liveCoins.push(c);
    }
    this.coins = liveCoins;

    const liveBugs: Bug[] = [];
    for (const b of this.bugs) {
      if (b.isOffScreen() || b.getState().collected) this.bugPool.release(b);
      else liveBugs.push(b);
    }
    this.bugs = liveBugs;

    this.pipes    = this.pipes.filter((p) => !p.isOffScreen());
    this.powerUps = this.powerUps.filter((p) => !p.isOffScreen() && !p.getState().collected);

    // Pipe collision — shield absorbs one hit
    if (Collision.check(this.bird, this.pipes, this.config.canvasHeight)) {
      if (this.powerUpManager.isActive('shield')) {
        this.powerUpManager.consume('shield'); // consumed
        this.bird.jump();                      // bounce away
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

  // ── Effect management (public for test compatibility) ──────────────────

  /** Delegate to PowerUpManager (kept public for backward compatibility). */
  isEffectActive(type: PowerUpType): boolean {
    return this.powerUpManager.isActive(type);
  }

  // ── Spawn methods ─────────────────────────────────

  private maybeSpawnCoin(speed: number): void {
    const rightEdge = this.spawnManager.coinRightEdge(this.coins);
    const d = this.spawnManager.checkCoin(rightEdge, this.score, this.rand);
    if (!d.spawn || d.y === undefined || d.type === undefined) return;
    this.coins.push(this.coinPool.acquire({ x: this.config.canvasWidth, y: d.y, type: d.type, speed: speed * 0.9 }));
  }

  private maybeSpawnBug(speed: number): void {
    const rightEdge = this.spawnManager.bugRightEdge(this.bugs);
    const d = this.spawnManager.checkBug(rightEdge, this.score, this.rand);
    if (!d.spawn || d.y === undefined) return;
    this.bugs.push(this.bugPool.acquire({ x: this.config.canvasWidth, y: d.y, speed: speed * 0.9 }));
    // Tier 2+: also spawn the paired mirror bug
    if (d.y2 !== undefined) {
      this.bugs.push(this.bugPool.acquire({ x: this.config.canvasWidth + 60, y: d.y2, speed: speed * 0.9 }));
    }
  }

  // ── Poop drop ─────────────────────────────────────────────

  /** Drop a poop from the bird's current position (subject to cooldown). */
  dropPoop(nowMs: number): void {
    if (this.status !== 'running') return;
    if (nowMs - this.poopCooldown < POOP_COOLDOWN_MS) return;
    const bs = this.bird.getState();
    this.poops.push(new PoopDrop({
      x: bs.x + bs.width  / 2 - 8,
      y: bs.y + bs.height,
    }));
    this.poopCooldown = nowMs;
  }

  getPoopCooldownRatio(nowMs: number): number {
    return Math.min(1, (nowMs - this.poopCooldown) / POOP_COOLDOWN_MS);
  }

  // ── Pipe spawning ─────────────────────────────────────────────────────────

  private maybeSpawnPipe(diff: DifficultySettings, speed: number): void {
    const rightEdge = this.spawnManager.pipeRightEdge(this.pipes);
    const d = this.spawnManager.checkPipe(rightEdge);
    if (!d.spawn) return;

    const margin   = 60;
    const maxGapY  = this.config.canvasHeight - diff.gapHeight - margin;
    const baseGapY = this.rand() * (maxGapY - margin) + margin;
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

  // ── Power-up spawning ─────────────────────────────────────

  private maybeSpawnPowerUp(pipeSpeed: number): void {
    const rightEdge = this.spawnManager.powerUpRightEdge(this.powerUps);
    const d = this.spawnManager.checkPowerUp(rightEdge, this.score, this.rand);
    if (!d.spawn || d.type === undefined || d.y === undefined) return;
    this.powerUps.push(new PowerUp({
      x:     this.config.canvasWidth,
      y:     d.y,
      type:  d.type,
      speed: pipeSpeed * 0.9,
    }));
  }

  // ── Snapshot ─────────────────────────────────────────────

  getState(): GameState {
    return {
      status:         this.status,
      score:          this.score,
      bird:           this.bird.getState(),
      pipes:          this.pipes.map((p) => p.getState()),
      difficultyTier: this.difficultyTier,
      powerUps:       this.powerUps.map((p) => p.getState()),
      activeEffects:  this.powerUpManager.getAll(),
      hasShield:      this.powerUpManager.isActive('shield'),
      coins:          this.coins.map(c => c.getState()),
      bugs:           this.bugs.map(b => b.getState()),
      poops:          this.poops.map(p => p.getState()),
      isDarkMode:     DifficultyManager.getSettings(this.difficultyTier).isDarkMode,
      musicIntensity: DifficultyManager.getSettings(this.difficultyTier).musicIntensity,
    };
  }

  getScore():  number     { return this.score;  }
  getStatus(): GameStatus { return this.status; }
  getSeed():   number     { return this.seed;   }
}