// ==========================================
// utils.test.js — game-dependent utilities: bounds, rects, escapeObstacles, hitsObstacles
// ==========================================
import { describe, it, expect, beforeAll } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
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
describe('escapeObstacles(entity)', () => {
  it('entity not in obstacle → returns false, position unchanged', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 500, y: 500, width: 80, height: 80 });
    const entity = { x: 100, y: 100, width: 36, height: 36 };
    const result = escapeObstacles(entity);
    expect(result).toBe(false);
    expect(entity.x).toBe(100);
    expect(entity.y).toBe(100);
  });

  it('entity inside obstacle → returns true and moves entity out', () => {
    obstacles.length = 0;
    // Place obstacle in the middle of the play area
    obstacles.push({ id: 'ob1', x: 200, y: 200, width: 80, height: 80 });
    // Place entity fully inside the obstacle
    const entity = { x: 220, y: 220, width: 36, height: 36 };
    const result = escapeObstacles(entity);
    expect(result).toBe(true);
    // Entity should no longer overlap the obstacle
    const er = { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
    expect(hitsObstacles(er)).toBe(false);
  });

  it('entity inside obstacle → final position is within play bounds', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 200, y: 200, width: 80, height: 80 });
    const entity = { x: 220, y: 220, width: 36, height: 36 };
    escapeObstacles(entity);
    const b = getPlayBounds();
    expect(entity.x).toBeGreaterThanOrEqual(b.left);
    expect(entity.y).toBeGreaterThanOrEqual(b.top);
    expect(entity.x + entity.width).toBeLessThanOrEqual(b.right);
    expect(entity.y + entity.height).toBeLessThanOrEqual(b.bottom);
  });

  it('works with player-like entity (size field)', () => {
    obstacles.length = 0;
    obstacles.push({ id: 'ob1', x: 300, y: 300, width: 80, height: 80 });
    // player uses .size not .width/.height
    const entity = { x: 320, y: 320, size: 36, width: 36, height: 36 };
    const result = escapeObstacles(entity);
    expect(result).toBe(true);
    const er = { x: entity.x, y: entity.y, width: 36, height: 36 };
    expect(hitsObstacles(er)).toBe(false);
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
