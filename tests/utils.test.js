// ==========================================
// utils.test.js — pure helper functions
// ==========================================
import { describe, it, expect, beforeAll } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

// ---------------------------------------------------------------------------
describe('clamp(v, min, max)', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('handles min === max', () => {
    expect(clamp(0, 0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('createRng(seed)', () => {
  it('same seed → same sequence', () => {
    const r1 = createRng(42);
    const r2 = createRng(42);
    for (let i = 0; i < 20; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it('different seeds → different sequences', () => {
    const r1 = createRng(1);
    const r2 = createRng(2);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).not.toEqual(seq2);
  });

  it('all values in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('deterministic: 100 calls with seed=42 give fixed array', () => {
    const rng = createRng(42);
    const seq = Array.from({ length: 100 }, () => rng());
    // Re-run to verify
    const rng2 = createRng(42);
    const seq2 = Array.from({ length: 100 }, () => rng2());
    expect(seq).toEqual(seq2);
  });
});

// ---------------------------------------------------------------------------
describe('randRange(rng, min, max)', () => {
  it('result always in [min, max)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = randRange(rng, 5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(15);
    }
  });

  it('when min === max returns min', () => {
    const rng = createRng(1);
    expect(randRange(rng, 7, 7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
describe('randInt(rng, min, max)', () => {
  it('result is an integer', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const v = randInt(rng, 0, 10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('result in [min, max] inclusive', () => {
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      const v = randInt(rng, 2, 8);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});

// ---------------------------------------------------------------------------
describe('rectsOverlap(a, b, pad)', () => {
  const a = { x: 10, y: 10, width: 20, height: 20 };

  it('overlapping rects → true', () => {
    const b = { x: 20, y: 20, width: 20, height: 20 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('non-overlapping rects → false', () => {
    const b = { x: 100, y: 100, width: 20, height: 20 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('touching by edge (no pad) → false', () => {
    // a ends at x=30, b starts at x=30
    const b = { x: 30, y: 10, width: 20, height: 20 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('touching by edge with pad=1 → true', () => {
    const b = { x: 30, y: 10, width: 20, height: 20 };
    expect(rectsOverlap(a, b, 1)).toBe(true);
  });

  it('negative pad shrinks intersection zone', () => {
    // Rects overlap by 1px; with pad=-2 they should not overlap
    const b = { x: 29, y: 10, width: 20, height: 20 };
    expect(rectsOverlap(a, b)).toBe(true);
    expect(rectsOverlap(a, b, -2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('circleRect(c, r)', () => {
  const rect = { x: 10, y: 10, width: 40, height: 40 };

  it('center inside rect → true', () => {
    expect(circleRect({ x: 30, y: 30, r: 5 }, rect)).toBe(true);
  });

  it('circle touches corner → true when r is sufficient', () => {
    // Corner at (10,10); circle center at (5,5), r=8 → dist=~7.07 < 8
    expect(circleRect({ x: 5, y: 5, r: 8 }, rect)).toBe(true);
  });

  it('circle far from rect → false', () => {
    expect(circleRect({ x: 200, y: 200, r: 5 }, rect)).toBe(false);
  });

  it('circle near edge but not touching → false', () => {
    // rect right edge at x=50; circle center at x=60, r=5 → gap=5, not touching
    expect(circleRect({ x: 60, y: 30, r: 5 }, rect)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('getPlayBounds()', () => {
  it('left = WORLD.sidePadding', () => {
    expect(getPlayBounds().left).toBe(WORLD.sidePadding);
  });
  it('top = WORLD.topPadding', () => {
    expect(getPlayBounds().top).toBe(WORLD.topPadding);
  });
  it('right = canvas.width - WORLD.sidePadding', () => {
    expect(getPlayBounds().right).toBe(canvas.width - WORLD.sidePadding);
  });
  it('bottom = canvas.height - WORLD.floorHeight', () => {
    expect(getPlayBounds().bottom).toBe(canvas.height - WORLD.floorHeight);
  });
});

// ---------------------------------------------------------------------------
describe('playerRect(x, y)', () => {
  it('without args uses player.x, player.y', () => {
    const r = playerRect();
    expect(r.x).toBe(player.x);
    expect(r.y).toBe(player.y);
  });
  it('with args uses provided coordinates', () => {
    const r = playerRect(111, 222);
    expect(r.x).toBe(111);
    expect(r.y).toBe(222);
  });
  it('width and height equal player.size', () => {
    const r = playerRect(0, 0);
    expect(r.width).toBe(player.size);
    expect(r.height).toBe(player.size);
  });
});

// ---------------------------------------------------------------------------
describe('ownerRect(x, y)', () => {
  it('without args uses owner.x, owner.y', () => {
    const r = ownerRect();
    expect(r.x).toBe(owner.x);
    expect(r.y).toBe(owner.y);
  });
  it('with args uses provided coordinates', () => {
    const r = ownerRect(333, 444);
    expect(r.x).toBe(333);
    expect(r.y).toBe(444);
  });
  it('width = owner.width, height = owner.height', () => {
    const r = ownerRect(0, 0);
    expect(r.width).toBe(owner.width);
    expect(r.height).toBe(owner.height);
  });
});

// ---------------------------------------------------------------------------
describe('hitsObstacles(rect, ignId)', () => {
  it('empty obstacles → false', () => {
    obstacles.length = 0;
    expect(hitsObstacles({ x: 100, y: 100, width: 50, height: 50 })).toBe(false);
  });

  it('rect overlaps obstacle → true', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 90, y: 90, width: 60, height: 60 });
    expect(hitsObstacles({ x: 100, y: 100, width: 50, height: 50 })).toBe(true);
  });

  it('rect overlaps obstacle but it is ignored by id → false', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 90, y: 90, width: 60, height: 60 });
    expect(hitsObstacles({ x: 100, y: 100, width: 50, height: 50 }, 'ob1')).toBe(false);
  });

  it('rect does not overlap any obstacle → false', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 500, y: 500, width: 60, height: 60 });
    expect(hitsObstacles({ x: 100, y: 100, width: 50, height: 50 })).toBe(false);
  });
});
