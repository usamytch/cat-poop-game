// ==========================================
// level.test.js — level generation
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  level = 1;
  score = 0;
  difficulty = 'normal';
  player.x = 90;
  player.y = 400;
  player.size = 48;
  obstacles.length = 0;
  bonuses.length = 0;
});

// ---------------------------------------------------------------------------
describe('generateLevel()', () => {
  it('obstacles array is not empty after generation', () => {
    generateLevel();
    expect(obstacles.length).toBeGreaterThan(0);
  });

  it('litterBox has x, y, width, height', () => {
    generateLevel();
    expect(litterBox).toHaveProperty('x');
    expect(litterBox).toHaveProperty('y');
    expect(litterBox).toHaveProperty('width');
    expect(litterBox).toHaveProperty('height');
    expect(typeof litterBox.x).toBe('number');
    expect(typeof litterBox.y).toBe('number');
  });

  it('bonuses contains at least one element', () => {
    generateLevel();
    expect(bonuses.length).toBeGreaterThan(0);
  });

  it('obstacles do not overlap with litterBox', () => {
    generateLevel();
    const lb = { x: litterBox.x, y: litterBox.y, width: litterBox.width, height: litterBox.height };
    for (const ob of obstacles) {
      const overlaps = rectsOverlap(ob, lb);
      expect(overlaps, `obstacle ${ob.id} overlaps litterBox`).toBe(false);
    }
  });

  it('obstacles stay within getPlayBounds()', () => {
    generateLevel();
    const b = getPlayBounds();
    for (const ob of obstacles) {
      expect(ob.x, `${ob.id} x < left`).toBeGreaterThanOrEqual(b.left - 1);
      expect(ob.y, `${ob.id} y < top`).toBeGreaterThanOrEqual(b.top - 1);
      expect(ob.x + ob.width, `${ob.id} right > right bound`).toBeLessThanOrEqual(b.right + 1);
      expect(ob.y + ob.height, `${ob.id} bottom > bottom bound`).toBeLessThanOrEqual(b.bottom + 1);
    }
  });

  it('same level + score → same generation (deterministic)', () => {
    level = 3;
    score = 0;
    generateLevel();
    const obs1 = obstacles.map(o => ({ id: o.id, x: o.x, y: o.y }));
    const lb1 = { x: litterBox.x, y: litterBox.y };

    // Reset and regenerate with same seed
    obstacles.length = 0;
    bonuses.length = 0;
    generateLevel();
    const obs2 = obstacles.map(o => ({ id: o.id, x: o.x, y: o.y }));
    const lb2 = { x: litterBox.x, y: litterBox.y };

    expect(obs1).toEqual(obs2);
    expect(lb1).toEqual(lb2);
  });

  it('from level 5, some obstacles have moving = true', () => {
    level = 5;
    score = 0;
    // Run multiple times to get a moving obstacle (probabilistic)
    let foundMoving = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      score = attempt * 100;
      generateLevel();
      if (obstacles.some(o => o.moving)) { foundMoving = true; break; }
    }
    expect(foundMoving).toBe(true);
  });

  it('level < 5: no moving obstacles', () => {
    level = 4;
    score = 0;
    generateLevel();
    expect(obstacles.every(o => !o.moving)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('updateObstacles()', () => {
  it('moving obstacles change movingOffset', () => {
    // Create a moving obstacle manually
    const ob = {
      id: 'test-moving',
      x: 300, y: 300, width: 60, height: 60,
      moving: true, axis: 'x', range: 50, speed: 0.01,
      phase: 0, movingOffset: 0, baseX: 300, baseY: 300,
    };
    obstacles.length = 0;
    obstacles.push(ob);

    // performance.now returns 0 initially, then 1000
    let t = 0;
    globalThis.performance = { now: () => t };

    t = 0;
    updateObstacles();
    const offset0 = ob.movingOffset;

    t = 1000;
    updateObstacles();
    const offset1 = ob.movingOffset;

    // At t=0: sin(0 + 0*0.01)*50 = 0
    // At t=1000: sin(0 + 1000*0.01)*50 = sin(10)*50 ≠ 0
    expect(offset1).not.toBe(offset0);
  });

  it('static obstacles do not change position', () => {
    const ob = {
      id: 'test-static',
      x: 300, y: 300, width: 60, height: 60,
      moving: false, axis: 'x', range: 0, speed: 0,
      phase: 0, movingOffset: 0, baseX: 300, baseY: 300,
    };
    obstacles.length = 0;
    obstacles.push(ob);
    const prevX = ob.x;
    const prevY = ob.y;
    updateObstacles();
    expect(ob.x).toBe(prevX);
    expect(ob.y).toBe(prevY);
  });
});
