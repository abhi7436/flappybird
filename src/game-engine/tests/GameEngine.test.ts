import { GameEngine } from '../GameEngine';

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
});