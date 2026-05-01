// ==========================================
// level.test.js — generateLevel() and updateObstacles()
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
  // Используем актуальный размер из игрового объекта — не хардкодим
  // player.size уже задан в player.js
  obstacles.length = 0;
  bonuses.length = 0;
  occupiedCells.clear();
  // Fix globalSeed to 0 so all level-generation tests remain deterministic
  globalSeed = 0;
});

// ---------------------------------------------------------------------------
describe('generateLevel()', () => {
  it('obstacles array is not empty after generation', () => {
    generateLevel();
    expect(obstacles.length).toBeGreaterThan(0);
  });

  it('player spawns in one of the four corners of the play area', () => {
    const b = getPlayBounds();
    const corners = [
      { x: b.left,                    y: b.top },                   // top-left
      { x: b.right - player.size,     y: b.top },                   // top-right
      { x: b.left,                    y: b.bottom - player.size },  // bottom-left
      { x: b.right - player.size,     y: b.bottom - player.size },  // bottom-right
    ];
    // Run several seeds to confirm all spawns land in a corner
    for (let s = 0; s < 8; s++) {
      globalSeed = s * 1000;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();
      const isCorner = corners.some(c =>
        Math.abs(player.x - c.x) < GRID && Math.abs(player.y - c.y) < GRID
      );
      expect(isCorner, `seed=${s}: player at (${player.x},${player.y}) is not near any corner`).toBe(true);
    }
  });

  it('player spawns in different corners across different seeds', () => {
    const b = getPlayBounds();
    const spawnedCorners = new Set();
    for (let s = 0; s < 20; s++) {
      globalSeed = s * 777;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();
      // Classify corner by quadrant
      const isLeft  = player.x < (b.left + b.right) / 2;
      const isTop   = player.y < (b.top + b.bottom) / 2;
      spawnedCorners.add(`${isLeft ? 'L' : 'R'}-${isTop ? 'T' : 'B'}`);
    }
    // With 20 seeds we expect at least 2 distinct corners
    expect(spawnedCorners.size).toBeGreaterThanOrEqual(2);
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

    obstacles.length = 0;
    bonuses.length = 0;
    occupiedCells.clear();
    generateLevel();
    const obs2 = obstacles.map(o => ({ id: o.id, x: o.x, y: o.y }));
    const lb2 = { x: litterBox.x, y: litterBox.y };

    expect(obs1).toEqual(obs2);
    expect(lb1).toEqual(lb2);
  });

  it('from level 5, some obstacles have moving = true', () => {
    level = 5;
    score = 0;
    let foundMoving = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      score = attempt * 100;
      obstacles.length = 0;
      bonuses.length = 0;
      occupiedCells.clear();
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

  it('all obstacle positions are grid-aligned (x and y are multiples of GRID from play bounds)', () => {
    generateLevel();
    const b = getPlayBounds();
    for (const ob of obstacles) {
      const relX = ob.x - b.left;
      const relY = ob.y - b.top;
      expect(relX % GRID, `${ob.id} x not grid-aligned: relX=${relX}`).toBe(0);
      expect(relY % GRID, `${ob.id} y not grid-aligned: relY=${relY}`).toBe(0);
    }
  });

  it('all obstacle sizes are multiples of GRID', () => {
    generateLevel();
    for (const ob of obstacles) {
      expect(ob.width % GRID, `${ob.id} width=${ob.width} not multiple of GRID`).toBe(0);
      expect(ob.height % GRID, `${ob.id} height=${ob.height} not multiple of GRID`).toBe(0);
    }
  });

  it('no two obstacles share a grid cell', () => {
    generateLevel();
    const b = getPlayBounds();
    const cellMap = new Map();
    for (const ob of obstacles) {
      const col = Math.round((ob.x - b.left) / GRID);
      const row = Math.round((ob.y - b.top) / GRID);
      const wCells = ob.width / GRID;
      const hCells = ob.height / GRID;
      for (let r = row; r < row + hCells; r++) {
        for (let c = col; c < col + wCells; c++) {
          const key = `${c},${r}`;
          expect(cellMap.has(key), `cell ${key} occupied by both ${cellMap.get(key)} and ${ob.id}`).toBe(false);
          cellMap.set(key, ob.id);
        }
      }
    }
  });

  it('litterBox is grid-aligned', () => {
    generateLevel();
    const b = getPlayBounds();
    const relX = litterBox.x - b.left;
    const relY = litterBox.y - b.top;
    expect(relX % GRID).toBe(0);
    expect(relY % GRID).toBe(0);
  });

  it('litterBox does not share grid cells with any obstacle', () => {
    generateLevel();
    const b = getPlayBounds();
    const lbCol = Math.round((litterBox.x - b.left) / GRID);
    const lbRow = Math.round((litterBox.y - b.top) / GRID);
    const lbWCells = litterBox.width / GRID;
    const lbHCells = litterBox.height / GRID;

    for (const ob of obstacles) {
      const obCol = Math.round((ob.x - b.left) / GRID);
      const obRow = Math.round((ob.y - b.top) / GRID);
      const obWCells = ob.width / GRID;
      const obHCells = ob.height / GRID;

      // Check no cell overlap between litter box and obstacle
      const colOverlap = obCol < lbCol + lbWCells && obCol + obWCells > lbCol;
      const rowOverlap = obRow < lbRow + lbHCells && obRow + obHCells > lbRow;
      expect(colOverlap && rowOverlap, `obstacle ${ob.id} shares cells with litterBox`).toBe(false);
    }
  });

  it('litterBox has 1-cell margin from all obstacles (no adjacent obstacles)', () => {
    // Run multiple levels for statistical confidence
    for (let lvl = 1; lvl <= 5; lvl++) {
      level = lvl;
      score = lvl * 10;
      obstacles.length = 0;
      bonuses.length = 0;
      occupiedCells.clear();
      generateLevel();

      const b = getPlayBounds();
      const lbCol = Math.round((litterBox.x - b.left) / GRID);
      const lbRow = Math.round((litterBox.y - b.top) / GRID);
      const lbWCells = litterBox.width / GRID;
      const lbHCells = litterBox.height / GRID;

      // Expanded zone: litter box + 1-cell margin on each reachable side
      const marginCol = Math.max(0, lbCol - 1);
      const marginRow = Math.max(0, lbRow - 1);
      const marginWCells = lbWCells + (lbCol > 0 ? 1 : 0) + (lbCol + lbWCells < GRID_COLS ? 1 : 0);
      const marginHCells = lbHCells + (lbRow > 0 ? 1 : 0) + (lbRow + lbHCells < GRID_ROWS ? 1 : 0);

      for (const ob of obstacles) {
        const obCol = Math.round((ob.x - b.left) / GRID);
        const obRow = Math.round((ob.y - b.top) / GRID);
        const obWCells = ob.width / GRID;
        const obHCells = ob.height / GRID;

        // Obstacle must NOT overlap the expanded margin zone
        const colOverlap = obCol < marginCol + marginWCells && obCol + obWCells > marginCol;
        const rowOverlap = obRow < marginRow + marginHCells && obRow + obHCells > marginRow;
        expect(
          colOverlap && rowOverlap,
          `level ${lvl}: obstacle ${ob.id} at (${obCol},${obRow}) is adjacent to litterBox at (${lbCol},${lbRow})`
        ).toBe(false);
      }
    }
  });

  it('decorItems array exists after generateLevel()', () => {
    generateLevel();
    expect(Array.isArray(decorItems)).toBe(true);
  });

  it('no two decor items share a grid cell', () => {
    // Run across several seeds to get statistical confidence
    for (let s = 0; s < 8; s++) {
      globalSeed = s * 1337;
      obstacles.length = 0;
      bonuses.length = 0;
      occupiedCells.clear();
      generateLevel();

      const b = getPlayBounds();
      const decorCellMap = new Map();
      for (const d of decorItems) {
        const col = Math.round((d.x - b.left) / GRID);
        const row = Math.round((d.y - b.top) / GRID);
        for (let r = row; r < row + d.hCells; r++) {
          for (let c = col; c < col + d.wCells; c++) {
            const key = `${c},${r}`;
            expect(
              decorCellMap.has(key),
              `seed=${s}: decor cell ${key} occupied by both "${decorCellMap.get(key)}" and "${d.type}"`
            ).toBe(false);
            decorCellMap.set(key, d.type);
          }
        }
      }
    }
  });

  it('obstacles have wCells and hCells properties', () => {
    generateLevel();
    for (const ob of obstacles) {
      expect(typeof ob.wCells).toBe('number');
      expect(typeof ob.hCells).toBe('number');
      expect(ob.wCells).toBeGreaterThan(0);
      expect(ob.hCells).toBeGreaterThan(0);
    }
  });

  it('obstacle pixel size matches wCells * GRID and hCells * GRID', () => {
    generateLevel();
    for (const ob of obstacles) {
      expect(ob.width).toBe(ob.wCells * GRID);
      expect(ob.height).toBe(ob.hCells * GRID);
    }
  });
});

// ---------------------------------------------------------------------------
describe('updateObstacles()', () => {
  it('moving obstacles change movingOffset', () => {
    const ob = {
      id: 'test-moving',
      x: 300, y: 300, width: GRID, height: GRID,
      moving: true, axis: 'x', range: GRID, speed: 0.01,
      phase: 0, movingOffset: 0, baseX: 300, baseY: 300,
    };
    obstacles.length = 0;
    obstacles.push(ob);

    let t = 0;
    globalThis.performance = { now: () => t };

    t = 0;
    updateObstacles();
    const offset0 = ob.movingOffset;

    t = 1000;
    updateObstacles();
    const offset1 = ob.movingOffset;

    expect(offset1).not.toBe(offset0);
  });

  it('static obstacles do not change position', () => {
    const ob = {
      id: 'test-static',
      x: 300, y: 300, width: GRID, height: GRID,
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
