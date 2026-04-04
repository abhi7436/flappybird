import { GameEngine } from '../GameEngine';
import { Coin } from '../Coin';

const defaultConfig = { canvasWidth: 800, canvasHeight: 600 };

describe('GameEngine', () => {
  it('initializes with score 0 and idle status', () => {
    const engine = new GameEngine(defaultConfig);
    expect(engine.getScore()).toBe(0);
    expect(engine.getStatus()).toBe('idle');
  });

  it('does not tick while idle', () => {
    const engine = new GameEngine(defaultConfig);
    const running = engine.tick(16);
    expect(running).toBe(false);
  });

  it('ticks while running', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();
    const running = engine.tick(16);
    // Running until a collision happens
    expect(typeof running).toBe('boolean');
  });

  it('fires onGameOver when bird hits ground', () => {
    const onGameOver = jest.fn();
    // Small canvas so bird hits floor immediately
    const engine = new GameEngine(
      { canvasWidth: 800, canvasHeight: 50 },
      { onGameOver }
    );
    engine.start();
    // Run ticks until dead
    for (let i = 0; i < 200; i++) engine.tick(i * 16);
    expect(onGameOver).toHaveBeenCalled();
    expect(engine.getStatus()).toBe('dead');
  });

  it('resets game state correctly', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();
    engine.reset();
    expect(engine.getScore()).toBe(0);
    expect(engine.getStatus()).toBe('idle');
  });

  it('returns difficulty tier 0 before score 25', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();
    expect(engine.getState().difficultyTier).toBe(0);
  });

  it('dies when touching the top without an active shield', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();

    (engine as any).bird.reset(200, 1);
    engine.jump();

    // Should end the game because no shield is active
    expect(engine.tick(16)).toBe(false);
    expect(engine.getStatus()).toBe('dead');
  });

  it('keeps the bird pinned to the top edge while shield is active', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();

    (engine as any).bird.reset(200, 1);
    // Activate shield so ceiling contact pins instead of killing
    (engine as any).powerUpManager.activate('shield', 0);
    engine.jump();

    expect(engine.tick(16)).toBe(true);
    expect(engine.getStatus()).toBe('running');
    expect(engine.getState().bird.y).toBe(0);
  });

  it('magnet collects coins behind the bird and slightly in front of it', () => {
    const onCoinCollected = jest.fn();
    const engine = new GameEngine(defaultConfig, { onCoinCollected });
    engine.start();

    const bird = engine.getState().bird;
    (engine as any).coins = [
      new Coin({ x: bird.x - 8, y: bird.y + 2, type: 'normal', speed: 0 }),
      new Coin({ x: bird.x + bird.width + 6, y: bird.y + 2, type: 'normal', speed: 0 }),
    ];
    (engine as any).powerUpManager.activate('magnet', 0);

    engine.tick(16);

    expect(onCoinCollected).toHaveBeenCalledTimes(2);
    expect(engine.getState().coins).toHaveLength(0);
  });

  it('keeps magnet active for seven seconds', () => {
    const engine = new GameEngine(defaultConfig);
    engine.start();
    (engine as any).powerUpManager.activate('magnet', 100);

    engine.tick(7_099);
    expect(engine.isEffectActive('magnet')).toBe(true);

    engine.tick(7_100);
    expect(engine.isEffectActive('magnet')).toBe(false);
  });
});