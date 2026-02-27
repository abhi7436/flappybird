import { Pipe } from '../Pipe';

describe('Pipe', () => {
  it('initializes with correct state', () => {
    const pipe = new Pipe({ x: 800, gapY: 200, gapHeight: 150, speed: 2 });
    expect(pipe.getState().x).toBe(800);
    expect(pipe.getState().gapY).toBe(200);
    expect(pipe.getState().gapHeight).toBe(150);
    expect(pipe.getState().scored).toBe(false);
  });

  it('moves left on update', () => {
    const pipe = new Pipe({ x: 800, gapY: 200, gapHeight: 150, speed: 2 });
    pipe.update(16.67);
    expect(pipe.getState().x).toBeLessThan(800);
  });

  it('reports off-screen when x + width < 0', () => {
    const pipe = new Pipe({ x: -60, gapY: 200, gapHeight: 150, speed: 2 });
    expect(pipe.isOffScreen()).toBe(true);
  });

  it('getBounds returns correct top and bottom rects', () => {
    const pipe = new Pipe({ x: 100, gapY: 200, gapHeight: 150, speed: 2 });
    const bounds = pipe.getBounds();
    expect(bounds.top.bottom).toBe(200);
    expect(bounds.bottom.top).toBe(350);
  });

  it('oscillates gapY when oscillating=true', () => {
    const pipe = new Pipe({ x: 100, gapY: 200, gapHeight: 150, speed: 2, oscillating: true });
    const initial = pipe.getState().gapY;
    pipe.update(500);
    expect(pipe.getState().gapY).not.toBe(initial);
  });
});