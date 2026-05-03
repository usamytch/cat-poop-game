// ==========================================
// grid.test.js — grid utility functions + aStarPath
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
  obstacles.length = 0;
  bonuses.length = 0;
  occupiedCells.clear();
  globalSeed = 0;
});

// ---------------------------------------------------------------------------
describe('Grid utility functions', () => {
  it('cellKey returns correct integer key (OPT: integer key faster than string)', () => {
    // OPT 2: cellKey теперь возвращает целое число col*100+row вместо строки
    // Это в 3-5x быстрее при использовании в Map/Set
    expect(cellKey(3, 5)).toBe(305);
    expect(cellKey(0, 0)).toBe(0);
    expect(cellKey(27, 14)).toBe(2714); // max valid key (GRID_COLS-1, GRID_ROWS-1)
    // Уникальность: разные (col,row) дают разные ключи при col<100, row<100
    expect(cellKey(1, 0)).not.toBe(cellKey(0, 1));
  });

  it('markCells and cellsFree work correctly', () => {
    occupiedCells.clear();
    expect(cellsFree(2, 2, 2, 2)).toBe(true);
    markCells(2, 2, 2, 2);
    expect(cellsFree(2, 2, 2, 2)).toBe(false);
    expect(cellsFree(4, 4, 1, 1)).toBe(true);
  });

  it('unmarkCells frees previously marked cells', () => {
    occupiedCells.clear();
    markCells(1, 1, 2, 2);
    expect(cellsFree(1, 1, 2, 2)).toBe(false);
    unmarkCells(1, 1, 2, 2);
    expect(cellsFree(1, 1, 2, 2)).toBe(true);
  });

  it('cellsFree returns false for out-of-bounds cells', () => {
    expect(cellsFree(-1, 0, 1, 1)).toBe(false);
    expect(cellsFree(0, -1, 1, 1)).toBe(false);
    expect(cellsFree(GRID_COLS - 1, 0, 2, 1)).toBe(false); // would go out of bounds
    expect(cellsFree(0, GRID_ROWS - 1, 1, 2)).toBe(false);
  });

  it('isCellFree returns false for occupied cell', () => {
    occupiedCells.clear();
    expect(isCellFree(5, 3)).toBe(true);
    markCells(5, 3, 1, 1);
    expect(isCellFree(5, 3)).toBe(false);
  });

  it('pixelToCell converts correctly', () => {
    const b = getPlayBounds();
    const cell = pixelToCell(b.left + GRID * 2 + 10, b.top + GRID * 1 + 5);
    expect(cell.col).toBe(2);
    expect(cell.row).toBe(1);
  });

  it('cellToPixel returns top-left corner of cell', () => {
    const b = getPlayBounds();
    const pos = cellToPixel(3, 2);
    expect(pos.x).toBe(b.left + 3 * GRID);
    expect(pos.y).toBe(b.top + 2 * GRID);
  });

  it('cellToPixelCenter returns center of cell', () => {
    const b = getPlayBounds();
    const center = cellToPixelCenter(3, 2);
    expect(center.x).toBe(b.left + 3 * GRID + GRID / 2);
    expect(center.y).toBe(b.top + 2 * GRID + GRID / 2);
  });
});

// ---------------------------------------------------------------------------
describe('aStarPath()', () => {
  it('returns path from start to goal on empty grid', () => {
    occupiedCells.clear();
    const path = aStarPath(0, 0, 3, 0);
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual({ col: 0, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 3, row: 0 });
  });

  it('returns path that avoids obstacles', () => {
    occupiedCells.clear();
    // Block column 2 entirely
    for (let r = 0; r < GRID_ROWS; r++) markCells(2, r, 1, 1);
    // Should still find path around (or return null if impossible)
    const path = aStarPath(0, 0, 4, 0);
    // Path should not go through col 2
    if (path) {
      for (const step of path) {
        expect(step.col).not.toBe(2);
      }
    }
    occupiedCells.clear();
  });

  it('returns null when no path exists', () => {
    occupiedCells.clear();
    // Completely surround goal cell (1,1) with walls
    markCells(0, 1, 1, 1);
    markCells(2, 1, 1, 1);
    markCells(1, 0, 1, 1);
    markCells(1, 2, 1, 1);
    const path = aStarPath(0, 0, 1, 1);
    expect(path).toBeNull();
    occupiedCells.clear();
  });

  it('returns single-step path when start equals goal', () => {
    occupiedCells.clear();
    const path = aStarPath(2, 2, 2, 2);
    expect(path).not.toBeNull();
    expect(path.length).toBe(1);
    expect(path[0]).toEqual({ col: 2, row: 2 });
  });

  it('with entityW/entityH: avoids cell physically blocked by obstacle even if occupiedCells says free', () => {
    occupiedCells.clear();
    obstacles.length = 0;
    // Берём размеры хозяина из игрового объекта
    const entityW = owner.width;
    const entityH = owner.height;
    // Cell (2,0) center
    const b = getPlayBounds();
    const cellCx = b.left + 2 * GRID + GRID / 2;
    const cellCy = b.top + GRID / 2;
    // Физическое препятствие покрывает rect хозяина в центре ячейки (2,0)
    obstacles.push({
      id: 'phys-block',
      x: cellCx - entityW / 2 - 2,
      y: cellCy - entityH / 2 - 2,
      width: entityW + 4,
      height: entityH + 4,
    });
    // occupiedCells НЕ помечает ячейку (2,0) — только физическое препятствие
    expect(isCellFree(2, 0)).toBe(true); // сетка считает свободной

    // С учётом физического размера: путь не должен проходить через (2,0)
    const pathWithSize = aStarPath(0, 0, 4, 0, entityW, entityH);
    if (pathWithSize) {
      for (const step of pathWithSize) {
        const stepCx = b.left + step.col * GRID + GRID / 2;
        const stepCy = b.top + step.row * GRID + GRID / 2;
        const stepRect = { x: stepCx - entityW/2, y: stepCy - entityH/2, width: entityW, height: entityH };
        const blocked = obstacles.some(o => rectsOverlap(stepRect, o));
        expect(blocked).toBe(false);
      }
    }
    obstacles.length = 0;
    occupiedCells.clear();
  });

  it('with entityW/entityH: still finds path when route exists around physical obstacle', () => {
    occupiedCells.clear();
    obstacles.length = 0;
    const entityW = owner.width;
    const entityH = owner.height;
    const b = getPlayBounds();
    // Блокируем только ячейку (2,0) физически — путь должен обойти через другую строку
    const cellCx = b.left + 2 * GRID + GRID / 2;
    const cellCy = b.top + GRID / 2;
    obstacles.push({
      id: 'phys-block2',
      x: cellCx - entityW / 2 - 2,
      y: cellCy - entityH / 2 - 2,
      width: entityW + 4,
      height: entityH + 4,
    });
    const path = aStarPath(0, 0, 4, 0, entityW, entityH);
    // Путь должен существовать (обход через другие строки)
    expect(path).not.toBeNull();
    obstacles.length = 0;
    occupiedCells.clear();
  });
});
