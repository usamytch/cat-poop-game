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

  // ---------------------------------------------------------------------------
  // Invariant: gap between any two obstacles is either 0 (flush) or ≥1 cell (40px passable).
  // A gap of 1..39px would be neither flush nor passable — a violation.
  // With grid-aligned static obstacles gaps are always multiples of 40px, so only
  // moving obstacles can create intermediate gaps.
  // ---------------------------------------------------------------------------

  it('static obstacles: any gap between obstacles is 0 (flush) or ≥ GRID px (passable)', () => {
    // Level 4 — no moving obstacles, pure static case
    level = 4;
    score = 0;
    for (let s = 0; s < 8; s++) {
      globalSeed = s * 1337;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();

      const b = getPlayBounds();
      for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
          const a = obstacles[i], bOb = obstacles[j];
          // Horizontal gap (only meaningful when they overlap vertically)
          const vertOverlap = a.y < bOb.y + bOb.height && a.y + a.height > bOb.y;
          if (vertOverlap) {
            const gapRight  = bOb.x - (a.x + a.width);   // B is to the right of A
            const gapLeft   = a.x - (bOb.x + bOb.width); // A is to the right of B
            const hGap = Math.max(gapRight, gapLeft);
            if (hGap > 0) {
              expect(hGap, `seed=${s}: horizontal gap ${hGap}px between ${a.id} and ${bOb.id} is not passable (< GRID=${GRID})`).toBeGreaterThanOrEqual(GRID);
            }
          }
          // Vertical gap (only meaningful when they overlap horizontally)
          const horizOverlap = a.x < bOb.x + bOb.width && a.x + a.width > bOb.x;
          if (horizOverlap) {
            const gapDown = bOb.y - (a.y + a.height);   // B is below A
            const gapUp   = a.y - (bOb.y + bOb.height); // A is below B
            const vGap = Math.max(gapDown, gapUp);
            if (vGap > 0) {
              expect(vGap, `seed=${s}: vertical gap ${vGap}px between ${a.id} and ${bOb.id} is not passable (< GRID=${GRID})`).toBeGreaterThanOrEqual(GRID);
            }
          }
        }
      }
    }
  });

  it('moving obstacles: at extreme position gap to any neighbor is 0 (flush) or ≥ GRID px (passable)', () => {
    // Level 5+ — moving obstacles present
    level = 5;
    score = 0;
    let testedMoving = false;
    for (let s = 0; s < 15; s++) {
      globalSeed = s * 999;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();

      const movingObs = obstacles.filter(o => o.moving);
      if (movingObs.length === 0) continue;
      testedMoving = true;

      for (const mov of movingObs) {
        // Simulate extreme positions: +range and -range along axis
        const extremes = [
          { x: mov.baseX + (mov.axis === 'x' ? mov.range : 0), y: mov.baseY + (mov.axis === 'y' ? mov.range : 0) },
          { x: mov.baseX - (mov.axis === 'x' ? mov.range : 0), y: mov.baseY - (mov.axis === 'y' ? mov.range : 0) },
        ];

        for (const pos of extremes) {
          const movRect = { x: pos.x, y: pos.y, width: mov.width, height: mov.height };

          for (const other of obstacles) {
            if (other.id === mov.id) continue;
            const otherRect = { x: other.baseX, y: other.baseY, width: other.width, height: other.height };

            // Check horizontal gap when vertically overlapping
            const vertOverlap = movRect.y < otherRect.y + otherRect.height && movRect.y + movRect.height > otherRect.y;
            if (vertOverlap) {
              const gapRight = otherRect.x - (movRect.x + movRect.width);
              const gapLeft  = movRect.x - (otherRect.x + otherRect.width);
              const hGap = Math.max(gapRight, gapLeft);
              if (hGap > 0) {
                expect(hGap, `seed=${s}: moving ${mov.id} at extreme x=${pos.x} has horizontal gap ${hGap}px to ${other.id} — not passable (< GRID=${GRID})`).toBeGreaterThanOrEqual(GRID);
              }
            }

            // Check vertical gap when horizontally overlapping
            const horizOverlap = movRect.x < otherRect.x + otherRect.width && movRect.x + movRect.width > otherRect.x;
            if (horizOverlap) {
              const gapDown = otherRect.y - (movRect.y + movRect.height);
              const gapUp   = movRect.y - (otherRect.y + otherRect.height);
              const vGap = Math.max(gapDown, gapUp);
              if (vGap > 0) {
                expect(vGap, `seed=${s}: moving ${mov.id} at extreme y=${pos.y} has vertical gap ${vGap}px to ${other.id} — not passable (< GRID=${GRID})`).toBeGreaterThanOrEqual(GRID);
              }
            }
          }
        }
      }
    }
    // Ensure we actually tested at least one moving obstacle
    expect(testedMoving, 'no moving obstacles found across 15 seeds at level 5').toBe(true);
  });

  it('moving obstacles: at extreme position gap to play-area boundary is 0 (flush) or ≥ GRID px', () => {
    level = 5;
    score = 0;
    let testedMoving = false;
    for (let s = 0; s < 15; s++) {
      globalSeed = s * 1111;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();

      const movingObs = obstacles.filter(o => o.moving);
      if (movingObs.length === 0) continue;
      testedMoving = true;

      const b = getPlayBounds();
      for (const mov of movingObs) {
        const extremes = [
          { x: mov.baseX + (mov.axis === 'x' ? mov.range : 0), y: mov.baseY + (mov.axis === 'y' ? mov.range : 0) },
          { x: mov.baseX - (mov.axis === 'x' ? mov.range : 0), y: mov.baseY - (mov.axis === 'y' ? mov.range : 0) },
        ];
        for (const pos of extremes) {
          // Must stay within play bounds at extreme position
          expect(pos.x, `seed=${s}: moving ${mov.id} extreme x=${pos.x} < left bound`).toBeGreaterThanOrEqual(b.left);
          expect(pos.y, `seed=${s}: moving ${mov.id} extreme y=${pos.y} < top bound`).toBeGreaterThanOrEqual(b.top);
          expect(pos.x + mov.width,  `seed=${s}: moving ${mov.id} extreme right=${pos.x + mov.width} > right bound`).toBeLessThanOrEqual(b.right);
          expect(pos.y + mov.height, `seed=${s}: moving ${mov.id} extreme bottom=${pos.y + mov.height} > bottom bound`).toBeLessThanOrEqual(b.bottom);
        }
      }
    }
    expect(testedMoving, 'no moving obstacles found across 15 seeds at level 5').toBe(true);
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

  // ---------------------------------------------------------------------------
  // Padding: obstacles must have at least 1-cell gap between each other
  // (on levels 1-7 where padding=1 is applied during placement check).
  // ---------------------------------------------------------------------------
  it('level 1-3: obstacles have at least 1-cell gap between each other (padding enforced)', () => {
    // On early levels profile.padding=1, so no two obstacles should be placed
    // with their bounding boxes touching (gap must be ≥ GRID or they don't overlap at all).
    for (let s = 0; s < 10; s++) {
      level = 2;
      score = s * 50;
      globalSeed = s * 2111;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();

      const b = getPlayBounds();
      for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
          const a = obstacles[i], bOb = obstacles[j];
          // Convert to cell coords
          const aCol = Math.round((a.x - b.left) / GRID);
          const aRow = Math.round((a.y - b.top) / GRID);
          const bCol = Math.round((bOb.x - b.left) / GRID);
          const bRow = Math.round((bOb.y - b.top) / GRID);

          // Check cell-level adjacency: expanded boxes (with 1-cell padding) must not overlap
          // i.e. the gap in cells must be ≥ 1 (not 0 = touching)
          const colGap = Math.max(bCol - (aCol + a.wCells), aCol - (bCol + bOb.wCells));
          const rowGap = Math.max(bRow - (aRow + a.hCells), aRow - (bRow + bOb.hCells));

          // If they overlap in one axis, the other axis gap must be ≥ 1 cell
          const colOverlap = aCol < bCol + bOb.wCells && aCol + a.wCells > bCol;
          const rowOverlap = aRow < bRow + bOb.hCells && aRow + a.hCells > bRow;

          if (colOverlap && rowGap >= 0) {
            expect(rowGap, `seed=${s}: ${a.id} and ${bOb.id} are vertically adjacent (rowGap=${rowGap})`).toBeGreaterThanOrEqual(1);
          }
          if (rowOverlap && colGap >= 0) {
            expect(colGap, `seed=${s}: ${a.id} and ${bOb.id} are horizontally adjacent (colGap=${colGap})`).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Level density progression: early levels have fewer obstacles than late levels
  // ---------------------------------------------------------------------------
  it('obstacle count grows with level (density progression)', () => {
    const counts = [];
    for (const lvl of [1, 4, 8]) {
      let total = 0;
      const runs = 5;
      for (let s = 0; s < runs; s++) {
        level = lvl;
        score = s * 30;
        globalSeed = s * 3333;
        obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
        generateLevel();
        total += obstacles.length;
      }
      counts.push(total / runs);
    }
    // Average obstacle count at level 8 should be ≥ level 1
    expect(counts[2], `level 8 avg (${counts[2]}) should be ≥ level 1 avg (${counts[0]})`).toBeGreaterThanOrEqual(counts[0]);
  });

  // ---------------------------------------------------------------------------
  // getLevelProfile: correct profile returned for each phase
  // ---------------------------------------------------------------------------
  it('getLevelProfile returns correct padding for each phase', () => {
    // Early levels (1-3): padding=1
    for (const lvl of [1, 2, 3]) {
      level = lvl;
      const p = getLevelProfile(lvl);
      expect(p.padding, `level ${lvl} should have padding=1`).toBe(1);
    }
    // Mid levels (4-7): padding=1
    for (const lvl of [4, 5, 7]) {
      const p = getLevelProfile(lvl);
      expect(p.padding, `level ${lvl} should have padding=1`).toBe(1);
    }
    // Late levels (8+): padding=0
    for (const lvl of [8, 10, 15]) {
      const p = getLevelProfile(lvl);
      expect(p.padding, `level ${lvl} should have padding=0`).toBe(0);
    }
  });

  it('getLevelProfile returns higher centerOpen on early levels than late levels', () => {
    const early = getLevelProfile(1);
    const late  = getLevelProfile(10);
    expect(early.centerOpen).toBeGreaterThan(late.centerOpen);
  });

  // ---------------------------------------------------------------------------
  // valueNoise: deterministic, in [0..1], varies across positions
  // ---------------------------------------------------------------------------
  it('valueNoise returns values in [0..1]', () => {
    for (let col = 0; col < 30; col += 4) {
      for (let row = 0; row < 15; row += 3) {
        const n = valueNoise(col, row, 12345);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('valueNoise is deterministic for same inputs', () => {
    const n1 = valueNoise(5, 7, 99999);
    const n2 = valueNoise(5, 7, 99999);
    expect(n1).toBe(n2);
  });

  it('valueNoise varies across different positions', () => {
    const values = new Set();
    for (let col = 0; col < 10; col++) {
      for (let row = 0; row < 10; row++) {
        values.add(valueNoise(col, row, 42));
      }
    }
    // Should have many distinct values (not all the same)
    expect(values.size).toBeGreaterThan(50);
  });

  // ---------------------------------------------------------------------------
  // obstacleCatalog: all entries have a zone field
  // ---------------------------------------------------------------------------
  it('all obstacleCatalog entries have a valid zone field', () => {
    const validZones = new Set(["wall", "corner", "center", "any"]);
    for (const [type, meta] of Object.entries(obstacleCatalog)) {
      expect(meta.zone, `${type} missing zone`).toBeDefined();
      expect(validZones.has(meta.zone), `${type} has invalid zone "${meta.zone}"`).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Decor count: later levels have more decor elements
  // ---------------------------------------------------------------------------
  it('decor count is at least 4 on level 1', () => {
    level = 1; score = 0; globalSeed = 0;
    obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
    generateLevel();
    expect(decorItems.length).toBeGreaterThanOrEqual(4);
  });

  it('decor count is at least 5 on level 5', () => {
    level = 5; score = 0; globalSeed = 0;
    obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
    generateLevel();
    expect(decorItems.length).toBeGreaterThanOrEqual(5);
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
// Basement level tests
// ---------------------------------------------------------------------------
describe('basement level', () => {
  // Helper: force basement corridor mode by setting level and scanning seeds
  function forceBasementLevel(mode) {
    // Set level to trigger the desired mode, then scan seeds until basement appears
    if (mode === 'dfs') {
      level = BASEMENT.dfsMinLevel;
    } else {
      level = BASEMENT.corridorMinLevel;
      // Make sure we're below dfs threshold so corridor is tested
      if (level >= BASEMENT.dfsMinLevel) level = BASEMENT.dfsMinLevel - 1;
    }
    score = 0;
    for (let s = 0; s < 200; s++) {
      globalSeed = s * 7919;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();
      if (currentLocation.key === 'basement' && basementMode === mode) return true;
    }
    return false;
  }

  it('BASEMENT config has required fields with correct types', () => {
    expect(typeof BASEMENT.corridorMinLevel).toBe('number');
    expect(typeof BASEMENT.corridorProb).toBe('number');
    expect(typeof BASEMENT.dfsMinLevel).toBe('number');
    expect(typeof BASEMENT.dfsProb).toBe('number');
    expect(BASEMENT.corridorMinLevel).toBeGreaterThan(0);
    expect(BASEMENT.dfsMinLevel).toBeGreaterThan(BASEMENT.corridorMinLevel);
    expect(BASEMENT.corridorProb).toBeGreaterThan(0);
    expect(BASEMENT.corridorProb).toBeLessThanOrEqual(1);
    expect(BASEMENT.dfsProb).toBeGreaterThan(0);
    expect(BASEMENT.dfsProb).toBeLessThanOrEqual(1);
  });

  it('basement does NOT appear on levels below corridorMinLevel', () => {
    for (let lvl = 1; lvl < BASEMENT.corridorMinLevel; lvl++) {
      for (let s = 0; s < 10; s++) {
        level = lvl; score = 0; globalSeed = s * 1234;
        obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
        generateLevel();
        expect(currentLocation.key, `basement appeared at level ${lvl}`).not.toBe('basement');
      }
    }
  });

  it('basement can appear at corridorMinLevel+ (corridor mode)', () => {
    const found = forceBasementLevel('corridor');
    expect(found, `corridor basement not found across 200 seeds at level ${BASEMENT.corridorMinLevel}`).toBe(true);
  });

  it('basement can appear at dfsMinLevel+ (dfs mode)', () => {
    const found = forceBasementLevel('dfs');
    expect(found, `dfs basement not found across 200 seeds at level ${BASEMENT.dfsMinLevel}`).toBe(true);
  });

  it('corridor maze: obstacles array has wall_h or wall_v entries', () => {
    const found = forceBasementLevel('corridor');
    expect(found).toBe(true);
    const wallObs = obstacles.filter(o => o.type === 'wall_h' || o.type === 'wall_v');
    expect(wallObs.length, 'corridor maze should have wall segments').toBeGreaterThan(0);
  });

  it('corridor maze: all obstacles within play bounds', () => {
    const found = forceBasementLevel('corridor');
    expect(found).toBe(true);
    const b = getPlayBounds();
    for (const ob of obstacles) {
      expect(ob.x, `${ob.id} x < left`).toBeGreaterThanOrEqual(b.left - 1);
      expect(ob.y, `${ob.id} y < top`).toBeGreaterThanOrEqual(b.top - 1);
      expect(ob.x + ob.width, `${ob.id} right > right`).toBeLessThanOrEqual(b.right + 1);
      expect(ob.y + ob.height, `${ob.id} bottom > bottom`).toBeLessThanOrEqual(b.bottom + 1);
    }
  });

  it('corridor maze: no two obstacles share a grid cell', () => {
    const found = forceBasementLevel('corridor');
    expect(found).toBe(true);
    const b = getPlayBounds();
    const cellMap = new Map();
    for (const ob of obstacles) {
      const col = Math.round((ob.x - b.left) / GRID);
      const row = Math.round((ob.y - b.top) / GRID);
      for (let r = row; r < row + ob.hCells; r++) {
        for (let c = col; c < col + ob.wCells; c++) {
          const key = `${c},${r}`;
          expect(cellMap.has(key), `cell ${key} shared by ${cellMap.get(key)} and ${ob.id}`).toBe(false);
          cellMap.set(key, ob.id);
        }
      }
    }
  });

  it('corridor maze: litterBox does not overlap any obstacle', () => {
    const found = forceBasementLevel('corridor');
    expect(found).toBe(true);
    const lb = { x: litterBox.x, y: litterBox.y, width: litterBox.width, height: litterBox.height };
    for (const ob of obstacles) {
      expect(rectsOverlap(ob, lb), `obstacle ${ob.id} overlaps litterBox`).toBe(false);
    }
  });

  it('corridor maze: A* finds path from player spawn to litterBox', () => {
    const found = forceBasementLevel('corridor');
    expect(found).toBe(true);
    const start = pixelToCell(player.x + GRID / 2, player.y + GRID / 2);
    const end   = pixelToCell(litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height / 2);
    const path  = aStarPath(start.col, start.row, end.col, end.row);
    expect(path, 'A* should find path from spawn to litterBox in corridor maze').not.toBeNull();
    expect(path.length, 'path should have at least 1 step').toBeGreaterThan(0);
  });

  it('dfs maze: obstacles array has wall_h or wall_v entries', () => {
    const found = forceBasementLevel('dfs');
    expect(found).toBe(true);
    const wallObs = obstacles.filter(o => o.type === 'wall_h' || o.type === 'wall_v');
    expect(wallObs.length, 'dfs maze should have many wall segments').toBeGreaterThan(5);
  });

  it('dfs maze: all obstacles within play bounds', () => {
    const found = forceBasementLevel('dfs');
    expect(found).toBe(true);
    const b = getPlayBounds();
    for (const ob of obstacles) {
      expect(ob.x, `${ob.id} x < left`).toBeGreaterThanOrEqual(b.left - 1);
      expect(ob.y, `${ob.id} y < top`).toBeGreaterThanOrEqual(b.top - 1);
      expect(ob.x + ob.width, `${ob.id} right > right`).toBeLessThanOrEqual(b.right + 1);
      expect(ob.y + ob.height, `${ob.id} bottom > bottom`).toBeLessThanOrEqual(b.bottom + 1);
    }
  });

  it('dfs maze: no two obstacles share a grid cell', () => {
    const found = forceBasementLevel('dfs');
    expect(found).toBe(true);
    const b = getPlayBounds();
    const cellMap = new Map();
    for (const ob of obstacles) {
      const col = Math.round((ob.x - b.left) / GRID);
      const row = Math.round((ob.y - b.top) / GRID);
      for (let r = row; r < row + ob.hCells; r++) {
        for (let c = col; c < col + ob.wCells; c++) {
          const key = `${c},${r}`;
          expect(cellMap.has(key), `cell ${key} shared by ${cellMap.get(key)} and ${ob.id}`).toBe(false);
          cellMap.set(key, ob.id);
        }
      }
    }
  });

  it('dfs maze: A* finds path from player spawn to litterBox', () => {
    const found = forceBasementLevel('dfs');
    expect(found).toBe(true);
    const start = pixelToCell(player.x + GRID / 2, player.y + GRID / 2);
    const end   = pixelToCell(litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height / 2);
    const path  = aStarPath(start.col, start.row, end.col, end.row);
    expect(path, 'A* should find path from spawn to litterBox in dfs maze').not.toBeNull();
    expect(path.length, 'path should have at least 1 step').toBeGreaterThan(0);
  });

  it('dfs maze: litterBox does not overlap any obstacle', () => {
    const found = forceBasementLevel('dfs');
    expect(found).toBe(true);
    const lb = { x: litterBox.x, y: litterBox.y, width: litterBox.width, height: litterBox.height };
    for (const ob of obstacles) {
      expect(rectsOverlap(ob, lb), `obstacle ${ob.id} overlaps litterBox`).toBe(false);
    }
  });

  it('basement location is not selected for normal levels (no contamination)', () => {
    // Run 50 seeds at level 1 — basement must never appear
    for (let s = 0; s < 50; s++) {
      level = 1; score = 0; globalSeed = s * 3571;
      obstacles.length = 0; bonuses.length = 0; occupiedCells.clear();
      generateLevel();
      expect(currentLocation.key).not.toBe('basement');
    }
  });

  it('dfs maze: columns outside maze footprint are fully blocked by walls', () => {
    // DFS-сетка: offC=1, mCols=9, CELL=3, WALL=1 → правый край = 1+9*3-1 = 27
    // Колонки 28..GRID_COLS-1 должны быть полностью заблокированы
    const found = forceBasementLevel('dfs');
    expect(found, 'dfs basement not found').toBe(true);
    const ROOM = 2, WALL_W = 1, CELL_W = ROOM + WALL_W;
    const offC = 1;
    const mCols = Math.floor((GRID_COLS - 1) / CELL_W);
    const mazeRightEdge = offC + mCols * CELL_W - WALL_W; // = 27 при GRID_COLS=30
    for (let c = mazeRightEdge + 1; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        expect(
          isCellFree(c, r),
          `DFS maze: col ${c} row ${r} should be blocked (outside maze footprint)`
        ).toBe(false);
      }
    }
  });

  it('corridor maze: side columns (0 and GRID_COLS-1) have at least one passable gap', () => {
    // Граничные стены коридорного лабиринта должны иметь проходы
    const found = forceBasementLevel('corridor');
    expect(found, 'corridor basement not found').toBe(true);
    let freeLeft = 0, freeRight = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      if (isCellFree(0, r)) freeLeft++;
      if (isCellFree(GRID_COLS - 1, r)) freeRight++;
    }
    expect(freeLeft, 'left boundary column should have at least one gap').toBeGreaterThan(0);
    expect(freeRight, 'right boundary column should have at least one gap').toBeGreaterThan(0);
  });

  it('basement: A* with cat-sized entity finds path to litterBox after reachability fix', () => {
    // Проверяем оба режима: _ensureBasementReachable() гарантирует проходимость
    for (const mode of ['corridor', 'dfs']) {
      const found = forceBasementLevel(mode);
      if (!found) continue;
      const start = pixelToCell(player.x + player.size / 2, player.y + player.size / 2);
      const end   = pixelToCell(litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height / 2);
      const path  = aStarPath(start.col, start.row, end.col, end.row, player.size, player.size);
      expect(
        path,
        `${mode}: A* with cat size (${player.size}x${player.size}) should find path to litterBox`
      ).not.toBeNull();
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
