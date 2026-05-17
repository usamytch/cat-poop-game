// ==========================================
// owner-grid.test.js — Grid-node locomotion tests (all levels)
// Single engine: tile-based movement with lerp interpolation.
// Pac-Man model: AI thinks in cells, physics renders in pixels.
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

function resetCommon() {
  globalSeed = 0;
  obstacles.length = 0;
  poops.length = 0;
  comboPopups.length = 0;
  comboCount = 0;
  comboTimer = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  catnipTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  score = 0;
  lives = 3;
  level = 1;
  difficulty = 'normal';
  gameState = 'playing';
  overlayTimer = 0;
  lifeLostTimer = 0;
  lifeLostReason = '';
  basementMode = '';
  player.x = 100;
  player.y = 300;
  player.urge = 0;
  player.speed = 3.9;
  player.pooping = false;
  player.poopTimer = 0;
  owner.x = 800;
  owner.y = 300;
  owner.active = false;
  owner.speed = 1.0;
  owner.fleeTimer = 0;
  owner.fleeTarget = null;
  owner.poopHits = 0;
  owner.facePoops = [];
  owner.hesitateTimer = 0;
  owner.shotReactTimer = 0;
  owner.path = [];
  owner.pathTimer = 0;
  owner.catnipTarget = null;
  // Grid-node state
  owner.currentNode = null;
  owner.nextNode = null;
  owner.moveProgress = 0;
  owner.segmentLength = GRID;
  owner.nodeQueue = [];
  owner.lastRepathGoalCell = null;
  poopProgress = 0;
  isPooping = false;
  bonuses.length = 0;
  litterBox.x = 900;
  litterBox.y = 400;
  litterBox.width = 92;
  litterBox.height = 62;
  occupiedCells.clear();
}

beforeEach(resetCommon);

// ---------------------------------------------------------------------------
// Grid-node movement — node arrival (all levels)
// ---------------------------------------------------------------------------
describe('grid-node movement — node arrival', () => {
  it('currentNode advances after moveProgress >= 1.0', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 3, row: 5 };
    owner.nextNode    = { col: 4, row: 5 };
    owner.nodeQueue   = [{ col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID; // 40px

    const fromPx = cellToPixel(3, 5);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    // speed=4.5 → ceil(40/4.5)=9 frames to cross one cell
    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(4.5);
    }

    // currentNode must have advanced past col=3
    expect(owner.currentNode.col).toBeGreaterThan(3);
  });

  it('owner x/y snaps to exact cell pixel when moveProgress >= 1.0', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 5, row: 5 };
    owner.nextNode    = { col: 6, row: 5 };
    owner.nodeQueue   = [];
    owner.moveProgress = 0.95; // almost there
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(5, 5);
    const toPx   = cellToPixel(6, 5);
    owner.x = fromPx.x + (toPx.x - fromPx.x) * 0.95;
    owner.y = fromPx.y;

    // One frame at speed=4.5 → progress += 4.5/40 = 0.1125 → total > 1.0 → snap
    owner._updateGridMovement(4.5);

    // After snap: currentNode=(6,5), x/y = cellToPixel(6,5)
    expect(owner.currentNode.col).toBe(6);
    expect(owner.x).toBeCloseTo(toPx.x, 1);
    expect(owner.y).toBeCloseTo(toPx.y, 1);
  });

  it('moveProgress does NOT advance when nextNode is null (path exhausted)', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 7, row: 5 };
    owner.nextNode    = null;
    owner.nodeQueue   = [];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;
    owner.pathTimer = 50;

    const fromPx = cellToPixel(7, 5);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    owner._updateGridMovement(4.5);

    // No nextNode → pathTimer reset to 0 (repath requested), position unchanged
    expect(owner.pathTimer).toBe(0);
    expect(owner.x).toBeCloseTo(fromPx.x, 1);
  });

  it('carry-over: moveProgress -= 1.0 on node arrival (not reset to 0)', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 5, row: 5 };
    owner.nextNode    = { col: 6, row: 5 };
    owner.nodeQueue   = [{ col: 7, row: 5 }];
    owner.moveProgress = 0.95;
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(5, 5);
    owner.x = fromPx.x + (cellToPixel(6, 5).x - fromPx.x) * 0.95;
    owner.y = fromPx.y;

    // speed=8 → progress += 8/40 = 0.2 → total = 1.15 → carry-over = 0.15
    owner._updateGridMovement(8);

    // After arrival: moveProgress should be ~0.15 (carry-over), not 0
    expect(owner.moveProgress).toBeGreaterThan(0);
    expect(owner.moveProgress).toBeLessThan(0.5);
  });

  it('nextNode is always adjacent (col diff <= 1 AND row diff <= 1) — invariant', () => {
    // Core invariant: no long segments, no smoothing.
    // A* returns adjacent nodes, _startGridMovement puts them in nodeQueue as-is.
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.currentNode = null;
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 0;

    player.x = 600; player.y = 300;
    owner.x = 100; owner.y = 100;

    // Trigger repath
    owner._moveTowardTarget(player.x, player.y, 2.0);

    // Check all nodes in queue are adjacent to each other
    if (owner.currentNode && owner.nextNode) {
      const colDiff = Math.abs(owner.nextNode.col - owner.currentNode.col);
      const rowDiff = Math.abs(owner.nextNode.row - owner.currentNode.row);
      expect(colDiff + rowDiff).toBeLessThanOrEqual(1);
      expect(colDiff + rowDiff).toBeGreaterThan(0);
    }

    // Check all queued nodes are adjacent to their predecessor
    if (owner.currentNode && owner.nodeQueue.length > 0) {
      let prev = owner.nextNode || owner.currentNode;
      for (const node of owner.nodeQueue) {
        const colDiff = Math.abs(node.col - prev.col);
        const rowDiff = Math.abs(node.row - prev.row);
        expect(colDiff + rowDiff).toBeLessThanOrEqual(1);
        prev = node;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Grid-node movement — open levels
// ---------------------------------------------------------------------------
describe('grid-node movement — open levels', () => {
  it('owner makes forward progress on open level (straight path, no obstacles)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = null;
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 0;

    owner.x = 80;
    owner.y = 280;
    player.x = 900;
    player.y = 280;

    const startX = owner.x;

    for (let i = 0; i < 100; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    expect(owner.x).toBeGreaterThan(startX + 50);
  });

  it('owner makes forward progress on open level with L-shaped path', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = null;
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 0;

    // Owner top-left, player bottom-right — forces L-shaped path
    owner.x = 80;
    owner.y = 80;
    player.x = 900;
    player.y = 500;

    const startX = owner.x;
    const startY = owner.y;

    for (let i = 0; i < 150; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    const netDx = owner.x - startX;
    const netDy = owner.y - startY;
    const netDist2 = netDx * netDx + netDy * netDy;
    expect(netDist2).toBeGreaterThan(100 * 100); // at least 100px net movement
  });

  it('repath triggers when player changes cell (open level)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = { col: 5, row: 7 };
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 100; // high — won't fire by timer

    const px = cellToPixel(5, 7);
    owner.x = px.x;
    owner.y = px.y;

    // Set lastRepathGoalCell to a specific cell
    player.x = 200; player.y = 280;
    const initialCell = pixelToCell(player.x + player.size/2, player.y + player.size/2);
    owner.lastRepathGoalCell = { col: initialCell.col, row: initialCell.row };

    // Move player far enough to exceed repathMinDist (normal=2 cells)
    // Player moves from col~5 to col~15 — well over 2 cells
    player.x = 600; player.y = 280;

    // Call _moveTowardTarget — playerCellChanged should trigger repath
    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // After repath: lastRepathGoalCell updated to new goal cell
    const newCell = pixelToCell(player.x + owner.width/2, player.y + owner.height/2);
    expect(owner.lastRepathGoalCell.col).toBe(newCell.col);
    expect(owner.lastRepathGoalCell.row).toBe(newCell.row);
  });

  it('repath triggers when nodeQueue exhausted (open level)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = { col: 5, row: 7 };
    owner.nextNode = null;   // exhausted
    owner.nodeQueue = [];    // exhausted
    owner.moveProgress = 0;
    owner.pathTimer = 100;   // high — won't fire by timer alone

    const px = cellToPixel(5, 7);
    owner.x = px.x;
    owner.y = px.y;

    player.x = 600; player.y = 280;
    owner.lastRepathGoalCell = pixelToCell(player.x + owner.width/2, player.y + owner.height/2);

    // needRepath = true because nextNode===null && nodeQueue.length===0
    // canRepath = true because moveProgress < 0.1
    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // After repath: pathTimer reset to PATH_RECALC
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('repath blocked mid-transition (moveProgress > 0.1)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = { col: 5, row: 7 };
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [];
    owner.moveProgress = 0.5; // mid-transition
    owner.pathTimer = 0;      // would fire by timer

    const fromPx = cellToPixel(5, 7);
    const toPx = cellToPixel(6, 7);
    owner.x = fromPx.x + (toPx.x - fromPx.x) * 0.5;
    owner.y = fromPx.y;

    player.x = 600; player.y = 280;
    owner.lastRepathGoalCell = null;

    const prevCurrentNode = { ...owner.currentNode };

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // currentNode must NOT have changed (no snap/teleport mid-transition)
    expect(owner.currentNode.col).toBe(prevCurrentNode.col);
    expect(owner.currentNode.row).toBe(prevCurrentNode.row);
  });

  it('activate() sets currentNode from pixelToCell on open level (best.col undefined)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();
    difficulty = 'normal';
    level = 2; // normal.firstLvl = 2

    owner.activate();

    // On open levels, currentNode must be set (not null)
    expect(owner.currentNode).not.toBeNull();
    expect(typeof owner.currentNode.col).toBe('number');
    expect(typeof owner.currentNode.row).toBe('number');
  });

  it('flee() resets grid-node state (currentNode=null, nodeQueue=[])', () => {
    basementMode = '';
    owner.currentNode = { col: 5, row: 7 };
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.5;

    owner.flee();

    expect(owner.currentNode).toBeNull();
    expect(owner.nextNode).toBeNull();
    expect(owner.nodeQueue).toEqual([]);
    expect(owner.moveProgress).toBe(0);
    expect(owner.pathTimer).toBe(0);
  });

  it('hesitateTimer stops movement for N frames (open level)', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 3.0;
    owner.currentNode = { col: 5, row: 7 };
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }, { col: 8, row: 7 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;
    owner.pathTimer = 100;
    owner.hesitateTimer = 10; // frozen for 10 frames

    const fromPx = cellToPixel(5, 7);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    player.x = 600; player.y = 280;

    const startX = owner.x;

    // Run 5 frames — hesitateTimer still active, owner should not move
    for (let i = 0; i < 5; i++) {
      owner.update();
    }

    // Owner must not have moved (hesitateTimer blocks update)
    expect(owner.x).toBeCloseTo(startX, 1);
  });

  it('isChasing = nodeQueue.length > 0 || nextNode !== null (no basementMode guard)', () => {
    // Verify the draw() logic: isChasing is purely based on grid-node state
    basementMode = '';
    owner.nodeQueue = [{ col: 5, row: 7 }];
    owner.nextNode = null;
    const isChasing1 = owner.nodeQueue.length > 0 || owner.nextNode !== null;
    expect(isChasing1).toBe(true);

    owner.nodeQueue = [];
    owner.nextNode = { col: 6, row: 7 };
    const isChasing2 = owner.nodeQueue.length > 0 || owner.nextNode !== null;
    expect(isChasing2).toBe(true);

    owner.nodeQueue = [];
    owner.nextNode = null;
    const isChasing3 = owner.nodeQueue.length > 0 || owner.nextNode !== null;
    expect(isChasing3).toBe(false);

    // Same logic works in basement — no basementMode guard needed
    basementMode = 'corridor';
    owner.nodeQueue = [{ col: 5, row: 7 }];
    owner.nextNode = null;
    const isChasing4 = owner.nodeQueue.length > 0 || owner.nextNode !== null;
    expect(isChasing4).toBe(true);
    basementMode = '';
  });
});

// ---------------------------------------------------------------------------
// Grid-node movement — forward progress in corridor
// ---------------------------------------------------------------------------
describe('grid-node movement — forward progress in corridor', () => {
  it('owner makes forward progress through straight corridor (grid-node model)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 2, row: 7 };
    owner.nextNode    = { col: 3, row: 7 };
    owner.nodeQueue   = [
      { col: 4, row: 7 }, { col: 5, row: 7 },
      { col: 6, row: 7 }, { col: 7, row: 7 },
    ];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(2, 7);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    owner.path = [
      { col: 2, row: 7 }, { col: 3, row: 7 }, { col: 4, row: 7 },
      { col: 5, row: 7 }, { col: 6, row: 7 }, { col: 7, row: 7 },
    ];
    owner.pathTimer = 100;

    const startX = owner.x;

    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(2);
    }

    expect(owner.x).toBeGreaterThan(startX);
    basementMode = '';
  });

  it('owner y stays on cell axis during horizontal movement (no off-axis drift)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const expectedY = cellToPixel(2, 5).y;
    owner.currentNode = { col: 2, row: 5 };
    owner.nextNode    = { col: 3, row: 5 };
    owner.nodeQueue   = [{ col: 4, row: 5 }, { col: 5, row: 5 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;
    owner.x = cellToPixel(2, 5).x;
    owner.y = expectedY;

    owner.path = [
      { col: 2, row: 5 }, { col: 3, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 5 },
    ];
    owner.pathTimer = 100;

    for (let i = 0; i < 20; i++) {
      owner._updateGridMovement(2);
    }

    expect(owner.y).toBeCloseTo(expectedY, 1);
    basementMode = '';
  });

  it('owner vertical movement — y advances toward nextNode', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 7, row: 5 };
    owner.nextNode    = { col: 7, row: 6 };
    owner.nodeQueue   = [{ col: 7, row: 7 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(7, 5);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    owner.path = [{ col: 7, row: 5 }, { col: 7, row: 6 }, { col: 7, row: 7 }];
    owner.pathTimer = 100;

    const startY = owner.y;

    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(3.6);
    }

    expect(owner.y).toBeGreaterThan(startY);
    expect(owner.x).toBeCloseTo(fromPx.x, 1);

    basementMode = '';
  });
});

// ---------------------------------------------------------------------------
// Grid-node movement — activate() and flee() reset state
// ---------------------------------------------------------------------------
describe('grid-node movement — activate() resets state', () => {
  it('currentNode is set after activate() on open level', () => {
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();
    difficulty = 'normal';
    level = 2;

    owner.activate();

    expect(owner.currentNode).not.toBeNull();
    expect(owner.nextNode).toBeNull();
    expect(owner.moveProgress).toBe(0);
    expect(owner.nodeQueue).toEqual([]);
    expect(owner.lastRepathGoalCell).toBeNull();
  });

  it('currentNode is set after activate() in basement', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();
    difficulty = 'normal';
    level = 2;

    owner.activate();

    expect(owner.currentNode).not.toBeNull();
    expect(owner.nextNode).toBeNull();
    expect(owner.moveProgress).toBe(0);
    expect(owner.nodeQueue).toEqual([]);

    basementMode = '';
  });

  it('pathTimer = 0 after activate()', () => {
    difficulty = 'normal';
    level = 2;
    owner.pathTimer = 999;
    owner.activate();
    expect(owner.pathTimer).toBe(0);
  });

  it('hesitateTimer = 0 after activate()', () => {
    difficulty = 'normal';
    level = 2;
    owner.hesitateTimer = 50;
    owner.activate();
    expect(owner.hesitateTimer).toBe(0);
  });
});

describe('grid-node movement — flee() resets state', () => {
  it('currentNode = null after flee()', () => {
    owner.currentNode = { col: 5, row: 7 };
    owner.flee();
    expect(owner.currentNode).toBeNull();
  });

  it('nextNode = null after flee()', () => {
    owner.nextNode = { col: 6, row: 7 };
    owner.flee();
    expect(owner.nextNode).toBeNull();
  });

  it('nodeQueue = [] after flee()', () => {
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.flee();
    expect(owner.nodeQueue).toEqual([]);
  });

  it('moveProgress = 0 after flee()', () => {
    owner.moveProgress = 0.7;
    owner.flee();
    expect(owner.moveProgress).toBe(0);
  });

  it('pathTimer = 0 after flee()', () => {
    owner.pathTimer = 100;
    owner.flee();
    expect(owner.pathTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// steering — no removed properties
// ---------------------------------------------------------------------------
describe('steering — removed properties no longer exist', () => {
  it('owner has no pathSegments property', () => {
    expect(owner.pathSegments).toBeUndefined();
  });

  it('owner has no segmentIndex property', () => {
    expect(owner.segmentIndex).toBeUndefined();
  });

  it('owner has no driftAngle property', () => {
    expect(owner.driftAngle).toBeUndefined();
  });

  it('owner has no driftTimer property', () => {
    expect(owner.driftTimer).toBeUndefined();
  });

  it('owner has no stuckTimer property', () => {
    expect(owner.stuckTimer).toBeUndefined();
  });

  it('owner has no lastX property', () => {
    expect(owner.lastX).toBeUndefined();
  });

  it('owner has no lastY property', () => {
    expect(owner.lastY).toBeUndefined();
  });

  it('owner has no lastCheckTimer property', () => {
    expect(owner.lastCheckTimer).toBeUndefined();
  });

  it('owner has no _compressToSegments method', () => {
    expect(owner._compressToSegments).toBeUndefined();
  });

  it('owner has no _getSteeringTarget method', () => {
    expect(owner._getSteeringTarget).toBeUndefined();
  });

  it('owner has no _smoothPath method', () => {
    expect(owner._smoothPath).toBeUndefined();
  });

  it('owner has no _hasLineOfSight method', () => {
    expect(owner._hasLineOfSight).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// steering — dynamic obstacle forces repath
// ---------------------------------------------------------------------------
describe('steering — dynamic obstacle forces repath', () => {
  it('after escapeObstacles: owner snapped to free cell, no longer overlapping wall', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const b = getPlayBounds();
    obstacles.push({ id: 'wall-col1', x: b.left + 40, y: b.top + 160, width: 40, height: 120 });

    owner.x = b.left + 19.9;
    owner.y = b.top + 174;
    owner.active = true;
    owner.speed = 3.6;
    owner.path = [{ col: 0, row: 5 }, { col: 1, row: 7 }];
    owner.currentNode = { col: 0, row: 5 };
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 100;

    // Verify owner IS overlapping the wall before update
    const ownerRect0 = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    expect(hitsObstacles(ownerRect0)).toBe(true);

    owner.update();

    // After snap: owner must NOT overlap any obstacle
    const ownerRectAfter = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    expect(hitsObstacles(ownerRectAfter)).toBe(false);

    // pathTimer was reset by escape → repath happened → pathTimer > 0
    expect(owner.pathTimer).toBeGreaterThan(0);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });

  it('after escape: net displacement > 2px² over 30 frames (not frozen)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const b = getPlayBounds();
    obstacles.push({ id: 'wall-col1', x: b.left + 40, y: b.top + 160, width: 40, height: 120 });

    owner.x = b.left + 19.9;
    owner.y = b.top + 174;
    owner.active = true;
    owner.speed = 3.6;
    owner.path = [{ col: 0, row: 5 }, { col: 1, row: 7 }];
    owner.currentNode = { col: 0, row: 5 };
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 100;

    const startX = owner.x;
    const startY = owner.y;

    for (let i = 0; i < 30; i++) {
      owner.update();
    }

    const netDx = owner.x - startX;
    const netDy = owner.y - startY;
    const netDist2 = netDx * netDx + netDy * netDy;
    expect(netDist2).toBeGreaterThan(2);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });
});

// ---------------------------------------------------------------------------
// Replanning hysteresis — Chebyshev distance guard (repathMinDist)
// ---------------------------------------------------------------------------
describe('replanning hysteresis — Chebyshev distance guard', () => {
  function setupOwnerAtNode(col, row) {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = { col, row };
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 100; // high — won't fire by timer
    const px = cellToPixel(col, row);
    owner.x = px.x;
    owner.y = px.y;
    obstacles.length = 0;
    occupiedCells.clear();
    basementMode = '';
  }

  it('normal (minDist=2): moving player 1 cell does NOT trigger repath', () => {
    difficulty = 'normal'; // repathMinDist = 2
    setupOwnerAtNode(5, 7);

    // Give owner an active nextNode so "path exhausted" branch does NOT fire
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.5; // mid-transition — canRepath blocked by moveProgress guard too

    // Set lastRepathGoalCell at col=10
    owner.lastRepathGoalCell = { col: 10, row: 7 };
    const prevPathTimer = owner.pathTimer;

    // Move player only 1 cell away from lastRepathGoalCell (col=11)
    // Chebyshev dist = 1 < repathMinDist=2 → playerCellChanged=false
    const targetPx = cellToPixel(11, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // pathTimer should have decremented (not reset to PATH_RECALC=30)
    // because Chebyshev dist = 1 < repathMinDist=2 AND moveProgress=0.5 blocks canRepath
    expect(owner.pathTimer).toBe(prevPathTimer - 1);
  });

  it('normal (minDist=2): moving player 2 cells DOES trigger repath', () => {
    difficulty = 'normal'; // repathMinDist = 2
    setupOwnerAtNode(5, 7);

    // Give owner an active nextNode so "path exhausted" branch does NOT fire
    // moveProgress=0.05 < 0.1 → canRepath allowed when needRepath=true
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.05;

    // Set lastRepathGoalCell at col=10
    owner.lastRepathGoalCell = { col: 10, row: 7 };

    // Move player 2 cells away (col=12) — Chebyshev dist = 2 >= repathMinDist=2
    const targetPx = cellToPixel(12, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // pathTimer reset to PATH_RECALC=30 → repath happened
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('easy (minDist=3): moving player 2 cells does NOT trigger repath', () => {
    difficulty = 'easy'; // repathMinDist = 3
    setupOwnerAtNode(5, 7);

    // Give owner an active nextNode + mid-transition to block canRepath
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.5;

    owner.lastRepathGoalCell = { col: 10, row: 7 };

    // Move player 2 cells away (col=12) — Chebyshev dist = 2 < repathMinDist=3
    const targetPx = cellToPixel(12, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;
    const prevPathTimer = owner.pathTimer;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.pathTimer).toBe(prevPathTimer - 1);
  });

  it('easy (minDist=3): moving player 3 cells DOES trigger repath', () => {
    difficulty = 'easy'; // repathMinDist = 3
    setupOwnerAtNode(5, 7);

    // moveProgress=0.05 < 0.1 → canRepath allowed when needRepath=true
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.05;

    owner.lastRepathGoalCell = { col: 10, row: 7 };

    // Move player 3 cells away (col=13) — Chebyshev dist = 3 >= repathMinDist=3
    const targetPx = cellToPixel(13, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('chaos (minDist=2): moving player 1 cell does NOT trigger repath', () => {
    difficulty = 'chaos'; // repathMinDist = 2
    setupOwnerAtNode(5, 7);

    // Give owner an active nextNode + mid-transition to block canRepath
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.5;

    owner.lastRepathGoalCell = { col: 10, row: 7 };
    const prevPathTimer = owner.pathTimer;

    // Move player 1 cell away (col=11) — Chebyshev dist = 1 < repathMinDist=2
    const targetPx = cellToPixel(11, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.pathTimer).toBe(prevPathTimer - 1);
  });

  it('chaos (minDist=2): moving player 2 cells DOES trigger repath', () => {
    difficulty = 'chaos'; // repathMinDist = 2
    setupOwnerAtNode(5, 7);

    // moveProgress=0.05 < 0.1 → canRepath allowed when needRepath=true
    owner.nextNode = { col: 6, row: 7 };
    owner.nodeQueue = [{ col: 7, row: 7 }];
    owner.moveProgress = 0.05;

    owner.lastRepathGoalCell = { col: 10, row: 7 };

    // Move player 2 cells away (col=12) — Chebyshev dist = 2 >= repathMinDist=2
    const targetPx = cellToPixel(12, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('fallback timer still triggers repath regardless of distance (normal)', () => {
    difficulty = 'normal'; // repathMinDist = 2
    setupOwnerAtNode(5, 7);

    // lastRepathGoalCell very close to player — dist = 0
    const targetPx = cellToPixel(10, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;
    owner.lastRepathGoalCell = { col: 10, row: 7 }; // same as goal → dist=0

    // Force timer to fire
    owner.pathTimer = 0;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // pathTimer reset → repath happened via fallback timer
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('path exhausted triggers repath regardless of distance (easy)', () => {
    difficulty = 'easy'; // repathMinDist = 3
    setupOwnerAtNode(5, 7);

    // lastRepathGoalCell same as goal → dist=0 (would not trigger playerCellChanged)
    const targetPx = cellToPixel(10, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;
    owner.lastRepathGoalCell = { col: 10, row: 7 };

    // Path exhausted: nextNode=null, nodeQueue=[]
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.pathTimer = 100; // high — won't fire by timer

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // needRepath=true because path exhausted → canRepath=true (moveProgress=0 < 0.1)
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('lastRepathGoalCell is updated to goal cell after repath', () => {
    difficulty = 'normal';
    setupOwnerAtNode(5, 7);

    owner.lastRepathGoalCell = null; // first repath
    owner.pathTimer = 0; // force repath

    const targetPx = cellToPixel(20, 7);
    player.x = targetPx.x - owner.width / 2;
    player.y = targetPx.y - owner.height / 2;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // lastRepathGoalCell must be set to the goal cell
    expect(owner.lastRepathGoalCell).not.toBeNull();
    expect(typeof owner.lastRepathGoalCell.col).toBe('number');
    expect(typeof owner.lastRepathGoalCell.row).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Replanning hysteresis — stable facing on long open chase
// ---------------------------------------------------------------------------
describe('replanning hysteresis — stable facing on long open chase', () => {
  it('owner facing changes < 20 times over 300 frames chasing diagonally moving player (normal)', () => {
    difficulty = 'normal';
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.currentNode = null;
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 0;
    owner.lastRepathGoalCell = null;
    owner.hesitateTimer = 0;

    owner.x = 80;
    owner.y = 80;
    player.x = 600;
    player.y = 300;

    let facingChanges = 0;
    let prevFacingX = owner.facingX;
    let prevFacingY = owner.facingY;

    for (let i = 0; i < 300; i++) {
      // Player moves diagonally — simulates active player movement
      player.x = 600 + Math.sin(i * 0.05) * 80;
      player.y = 300 + Math.cos(i * 0.05) * 60;

      owner._moveTowardTarget(player.x, player.y, owner.speed);

      // Count facing direction changes (significant change = > 0.3 in either component)
      const dfx = Math.abs(owner.facingX - prevFacingX);
      const dfy = Math.abs(owner.facingY - prevFacingY);
      if (dfx > 0.3 || dfy > 0.3) {
        facingChanges++;
        prevFacingX = owner.facingX;
        prevFacingY = owner.facingY;
      }
    }

    // With hysteresis (minDist=2), facing should be stable — far fewer than 300 changes
    expect(facingChanges).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// Hesitation scaling — hyperbolic decay by level
// ---------------------------------------------------------------------------
describe('hesitation scaling — hyperbolic decay by level', () => {
  function computeHesitateProb(diff, lvl) {
    const d = DIFF[diff];
    return Math.max(d.hesitateMinProb, d.hesitateBaseProb / (1 + (lvl - 1) * d.hesitateProbDecay));
  }

  it('hesitateProb at level 1 equals hesitateBaseProb (easy)', () => {
    expect(computeHesitateProb('easy', 1)).toBeCloseTo(DIFF.easy.hesitateBaseProb, 6);
  });

  it('hesitateProb at level 1 equals hesitateBaseProb (normal)', () => {
    expect(computeHesitateProb('normal', 1)).toBeCloseTo(DIFF.normal.hesitateBaseProb, 6);
  });

  it('hesitateProb at level 1 equals hesitateBaseProb (chaos)', () => {
    expect(computeHesitateProb('chaos', 1)).toBeCloseTo(DIFF.chaos.hesitateBaseProb, 6);
  });

  it('hesitateProb decreases as level increases (normal)', () => {
    const p1 = computeHesitateProb('normal', 1);
    const p5 = computeHesitateProb('normal', 5);
    const p10 = computeHesitateProb('normal', 10);
    expect(p5).toBeLessThan(p1);
    expect(p10).toBeLessThan(p5);
  });

  it('hesitateProb decreases as level increases (chaos)', () => {
    const p1 = computeHesitateProb('chaos', 1);
    const p5 = computeHesitateProb('chaos', 5);
    const p10 = computeHesitateProb('chaos', 10);
    expect(p5).toBeLessThan(p1);
    expect(p10).toBeLessThan(p5);
  });

  it('hesitateProb never goes below hesitateMinProb (easy, level 50)', () => {
    const prob = computeHesitateProb('easy', 50);
    expect(prob).toBeGreaterThanOrEqual(DIFF.easy.hesitateMinProb);
  });

  it('hesitateProb never goes below hesitateMinProb (normal, level 50)', () => {
    const prob = computeHesitateProb('normal', 50);
    expect(prob).toBeGreaterThanOrEqual(DIFF.normal.hesitateMinProb);
  });

  it('chaos hesitateMinProb = 0 — approaches zero at high levels', () => {
    expect(DIFF.chaos.hesitateMinProb).toBe(0);
    // chaos: base=0.002, decay=0.20 → at level 50: 0.002 / (1 + 49*0.20) = 0.002/10.8 ≈ 0.000185
    // This is very small (< 0.001) — effectively near-zero for gameplay purposes
    const prob = computeHesitateProb('chaos', 50);
    expect(prob).toBeLessThan(0.001);
  });

  it('chaos level 10: hesitateProb < 0.001 (near-relentless)', () => {
    const prob = computeHesitateProb('chaos', 10);
    expect(prob).toBeLessThan(0.001);
  });

  it('easy level 10: hesitateProb still > hesitateMinProb (owner still hesitates)', () => {
    const prob = computeHesitateProb('easy', 10);
    expect(prob).toBeGreaterThan(DIFF.easy.hesitateMinProb);
  });

  it('hyperbolic: prob at level 5 is between level 1 and level 10 (smooth curve)', () => {
    for (const diff of ['easy', 'normal', 'chaos']) {
      const p1  = computeHesitateProb(diff, 1);
      const p5  = computeHesitateProb(diff, 5);
      const p10 = computeHesitateProb(diff, 10);
      expect(p5).toBeLessThan(p1);
      expect(p5).toBeGreaterThan(p10);
    }
  });

  it('DIFF entries have all required hesitate fields', () => {
    for (const key of ['easy', 'normal', 'chaos']) {
      const d = DIFF[key];
      expect(typeof d.hesitateBaseProb).toBe('number');
      expect(typeof d.hesitateProbDecay).toBe('number');
      expect(typeof d.hesitateMinProb).toBe('number');
      expect(typeof d.hesitateDur).toBe('number');
      expect(d.hesitateBaseProb).toBeGreaterThan(0);
      expect(d.hesitateProbDecay).toBeGreaterThan(0);
      expect(d.hesitateMinProb).toBeGreaterThanOrEqual(0);
      expect(d.hesitateDur).toBeGreaterThan(0);
    }
  });

  it('DIFF entries have repathMinDist field', () => {
    for (const key of ['easy', 'normal', 'chaos']) {
      expect(typeof DIFF[key].repathMinDist).toBe('number');
      expect(DIFF[key].repathMinDist).toBeGreaterThanOrEqual(1);
    }
  });

  it('easy repathMinDist > normal repathMinDist (easy is more lenient)', () => {
    expect(DIFF.easy.repathMinDist).toBeGreaterThan(DIFF.normal.repathMinDist);
  });
});
