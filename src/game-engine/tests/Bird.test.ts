import { Bird } from '../Bird';

describe('Bird', () => {
  it('initializes with correct position', () => {
    const bird = new Bird({ x: 50, y: 100 });
    expect(bird.getState().x).toBe(50);
    expect(bird.getState().y).toBe(100);
  });

  it('applies gravity on update (y increases)', () => {
    const bird = new Bird({ x: 50, y: 100 });
    bird.update(16.67);
    expect(bird.getState().y).toBeGreaterThan(100);
  });

  it('jumps upward (velocity becomes negative)', () => {
    const bird = new Bird({ x: 50, y: 100 });
    bird.jump();
    bird.update(16.67);
    expect(bird.getState().y).toBeLessThan(100);
  });

  it('getBounds returns correct AABB', () => {
    const bird = new Bird({ x: 10, y: 20, width: 34, height: 24 });
    const bounds = bird.getBounds();
    expect(bounds.left).toBe(10);
    expect(bounds.top).toBe(20);
    expect(bounds.right).toBe(44);
    expect(bounds.bottom).toBe(44);
  });

  it('resets velocity and position', () => {
    const bird = new Bird({ x: 50, y: 100 });
    bird.jump();
    bird.update(16.67);
    bird.reset(50, 100);
    expect(bird.getState().y).toBe(100);
    expect(bird.getState().velocity).toBe(0);
  });

  it('clamps at the top edge without leaving the screen', () => {
    const bird = new Bird({ x: 50, y: 2 });
    bird.jump();
    bird.update(16.67);
    bird.clampToTop();

    expect(bird.getState().y).toBe(0);
    expect(bird.getState().velocity).toBe(0);
  });
});