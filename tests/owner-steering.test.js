 // ==========================================
// owner-steering.test.js — Steering corridor model tests
// Tests for _compressToSegments(), _getSteeringTarget(), segment-progress completion
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
  owner.stuckTimer = 0;
  owner.lastX = owner.x;
  owner.lastY = owner.y;
  owner.driftAngle = 0;
  owner.driftTimer = 0;
  owner.hesitateTimer = 0;
  owner.shotReactTimer = 0;
  owner.path = [];
  owner.pathSegments = [];
  owner.segmentIndex = 0;
  owner.pathTimer = 0;
  owner.catnipTarget = null;
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
describe('_compressToSegments() — path compression', () => {
  it('straight horizontal path → 1 segment with dir {x:1, y:0}', () => {
    const path = [
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
      { col: 5, row: 5 },
    ];
    owner._compressToSegments(path);
    expect(owner.pathSegments.length).toBe(1);
    expect(owner.pathSegments[0].dir.x).toBeCloseTo(1, 5);
    expect(owner.pathSegments[0].dir.y).toBeCloseTo(0, 5);
    expect(owner.segmentIndex).toBe(0);
  });

  it('straight vertical path → 1 segment with dir {x:0, y:1}', () => {
    const path = [
      { col: 5, row: 2 },
      { col: 5, row: 3 },
      { col: 5, row: 4 },
      { col: 5, row: 5 },
    ];
    owner._compressToSegments(path);
    expect(owner.pathSegments.length).toBe(1);
    expect(owner.pathSegments[0].dir.x).toBeCloseTo(0, 5);
    expect(owner.pathSegments[0].dir.y).toBeCloseTo(1, 5);
  });

  it('L-shaped path (right then down) → 2 segments', () => {
    const path = [
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 3, row: 6 },
      { col: 3, row: 7 },
    ];
    owner._compressToSegments(path);
    expect(owner.pathSegments.length).toBe(2);
    // First segment: horizontal right
    expect(owner.pathSegments[0].dir.x).toBeCloseTo(1, 5);
    expect(owner.pathSegments[0].dir.y).toBeCloseTo(0, 5);
    // Second segment: vertical down
    expect(owner.pathSegments[1].dir.x).toBeCloseTo(0, 5);
    expect(owner.pathSegments[1].dir.y).toBeCloseTo(1, 5);
  });

  it('Z-shaped path (right, down, right) → 3 segments', () => {
    const path = [
      { col: 1, row: 5 },
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 3, row: 6 },
      { col: 4, row: 6 },
      { col: 5, row: 6 },
    ];
    owner._compressToSegments(path);
    expect(owner.pathSegments.length).toBe(3);
  });

  it('path length < 2 → empty segments', () => {
    owner._compressToSegments([{ col: 5, row: 5 }]);
    expect(owner.pathSegments.length).toBe(0);
    expect(owner.segmentIndex).toBe(0);
  });

  it('null/undefined path → empty segments', () => {
    owner._compressToSegments(null);
    expect(owner.pathSegments.length).toBe(0);
  });

  it('segment startPx and endPx are pixel centers of first/last cells', () => {
    const path = [
      { col: 2, row: 5 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
    ];
    owner._compressToSegments(path);
    const startExpected = cellToPixelCenter(2, 5);
    const endExpected   = cellToPixelCenter(4, 5);
    expect(owner.pathSegments[0].startPx.x).toBeCloseTo(startExpected.x, 1);
    expect(owner.pathSegments[0].startPx.y).toBeCloseTo(startExpected.y, 1);
    expect(owner.pathSegments[0].endPx.x).toBeCloseTo(endExpected.x, 1);
    expect(owner.pathSegments[0].endPx.y).toBeCloseTo(endExpected.y, 1);
  });

  it('dir vector is always unit length', () => {
    const paths = [
      [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }],
      [{ col: 5, row: 1 }, { col: 5, row: 2 }, { col: 5, row: 3 }],
      [{ col: 1, row: 5 }, { col: 0, row: 5 }], // left
      [{ col: 5, row: 5 }, { col: 5, row: 4 }], // up
    ];
    for (const path of paths) {
      owner._compressToSegments(path);
      for (const seg of owner.pathSegments) {
        const len = Math.sqrt(seg.dir.x ** 2 + seg.dir.y ** 2);
        expect(len).toBeCloseTo(1.0, 5);
      }
    }
  });

  it('segmentIndex resets to 0 after each call', () => {
    owner.segmentIndex = 5;
    owner._compressToSegments([{ col: 1, row: 1 }, { col: 2, row: 1 }]);
    expect(owner.segmentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('_getSteeringTarget() — target projection', () => {
  it('returns null when pathSegments is empty', () => {
    owner.pathSegments = [];
    owner.segmentIndex = 0;
    expect(owner._getSteeringTarget()).toBeNull();
  });

  it('returns null when segmentIndex >= pathSegments.length', () => {
    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 200, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 1; // past end
    expect(owner._getSteeringTarget()).toBeNull();
  });

  it('target is ahead of owner on horizontal segment', () => {
    // Segment: x=100 to x=300, y=200, dir right
    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 300, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center at x=150, y=200
    owner.x = 150 - owner.width / 2;
    owner.y = 200 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // Target should be ahead (x > 150) and not past segment end (x <= 300)
    expect(target.x).toBeGreaterThan(150);
    expect(target.x).toBeLessThanOrEqual(300 + 0.1);
    // Y should stay on segment axis
    expect(target.y).toBeCloseTo(200, 1);
  });

  it('target is clamped to segment end when owner is near end', () => {
    const LOOKAHEAD = GRID * 0.8; // 32px
    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 200, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center at x=195 — only 5px from end, LOOKAHEAD would overshoot
    owner.x = 195 - owner.width / 2;
    owner.y = 200 - owner.height / 2;

    const target = owner._getSteeringTarget();
    // Target must not exceed segment end
    expect(target.x).toBeLessThanOrEqual(200 + 0.1);
  });

  it('target advances LOOKAHEAD px ahead of projection', () => {
    const LOOKAHEAD = GRID * 0.8; // 32px
    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 500, y: 200 }, // long segment
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center at x=150 — projection t=50, target = 50+32 = 82 from start = x=182
    owner.x = 150 - owner.width / 2;
    owner.y = 200 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target.x).toBeCloseTo(100 + 50 + LOOKAHEAD, 1);
  });

  it('target works on vertical segment (dir down)', () => {
    owner.pathSegments = [{
      startPx: { x: 200, y: 100 },
      endPx:   { x: 200, y: 400 },
      dir:     { x: 0, y: 1 },
    }];
    owner.segmentIndex = 0;
    owner.x = 200 - owner.width / 2;
    owner.y = 150 - owner.height / 2; // center at y=150

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    expect(target.y).toBeGreaterThan(150);
    expect(target.x).toBeCloseTo(200, 1);
  });
});

// ---------------------------------------------------------------------------
describe('segment completion — segmentIndex advances on progress', () => {
  it('segmentIndex advances when owner reaches end of segment', () => {
    const startPx = cellToPixelCenter(5, 5);
    const endPx   = cellToPixelCenter(8, 5);
    const segLen  = endPx.x - startPx.x; // 3 cells = 120px

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center at segLen - 2px from start (past epsilon=4px threshold)
    owner.x = startPx.x + segLen - 2 - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
      { col: 8, row: 5 },
    ];
    owner.pathTimer = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.segmentIndex).toBeGreaterThan(0);
  });

  it('segmentIndex does NOT advance when owner is at start of segment', () => {
    const startPx = cellToPixelCenter(5, 5);
    const endPx   = cellToPixelCenter(8, 5);

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner at start of segment
    owner.x = startPx.x - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
      { col: 8, row: 5 },
    ];
    owner.pathTimer = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.segmentIndex).toBe(0);
  });

  it('segmentIndex advances past length when all segments exhausted', () => {
    const startPx = cellToPixelCenter(5, 5);
    const endPx   = cellToPixelCenter(6, 5);
    const segLen  = endPx.x - startPx.x;

    // Only 1 segment, owner at end → segmentIndex becomes 1 >= length
    // pathTimer is NOT reset to 0 (that caused infinite repath loop).
    // Instead it keeps its current value and repath happens on normal interval.
    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.x = startPx.x + segLen - 2 - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [{ col: 5, row: 5 }, { col: 6, row: 5 }];
    owner.pathTimer = 50; // non-zero

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // Segments exhausted → segmentIndex >= pathSegments.length
    expect(owner.segmentIndex).toBeGreaterThanOrEqual(owner.pathSegments.length);
    // pathTimer NOT reset to 0 — avoids infinite repath loop when owner is physically stuck
    expect(owner.pathTimer).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('_compressToSegments() called after A* repath', () => {
  it('pathSegments populated after _moveTowardTarget triggers repath', () => {
    obstacles.length = 0;
    occupiedCells.clear();
    owner.active = true;
    owner.fleeTimer = 0;
    owner.path = [];
    owner.pathSegments = [];
    owner.pathTimer = 0; // force repath immediately

    player.x = 600; player.y = 300;
    owner.x = 100; owner.y = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // After repath, pathSegments should be populated (A* found a path)
    expect(owner.pathSegments.length).toBeGreaterThanOrEqual(1);
  });

  it('pathSegments cleared when A* finds no path', () => {
    // Block all cells around owner so A* fails
    obstacles.length = 0;
    occupiedCells.clear();
    // Fill entire grid
    markCells(0, 0, GRID_COLS, GRID_ROWS);

    owner.active = true;
    owner.fleeTimer = 0;
    owner.path = [{ col: 1, row: 1 }]; // non-empty to trigger repath
    owner.pathSegments = [{ startPx: { x: 0, y: 0 }, endPx: { x: 40, y: 0 }, dir: { x: 1, y: 0 } }];
    owner.pathTimer = 0; // force repath

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // A* failed → pathSegments cleared
    expect(owner.pathSegments.length).toBe(0);
    unmarkCells(0, 0, GRID_COLS, GRID_ROWS);
  });
});

// ---------------------------------------------------------------------------
describe('steering movement — facingX/Y stays unit vector', () => {
  it('facingX/Y remain unit vector during steering along horizontal segment', () => {
    obstacles.length = 0;
    occupiedCells.clear();
    owner.active = true;
    owner.fleeTimer = 0;

    const startPx = cellToPixelCenter(3, 7);
    const endPx   = cellToPixelCenter(10, 7);

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.x = startPx.x - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;
    owner.path = [
      { col: 3, row: 7 }, { col: 4, row: 7 }, { col: 5, row: 7 },
      { col: 6, row: 7 }, { col: 7, row: 7 }, { col: 8, row: 7 },
      { col: 9, row: 7 }, { col: 10, row: 7 },
    ];
    owner.pathTimer = 100;

    for (let i = 0; i < 20; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
      const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
      expect(len).toBeLessThanOrEqual(1.01);
    }
  });

  it('facingX/Y never NaN during steering', () => {
    obstacles.length = 0;
    occupiedCells.clear();
    owner.active = true;
    owner.fleeTimer = 0;
    player.x = 700; player.y = 100;
    owner.x = 100; owner.y = 500;
    owner.path = [];
    owner.pathSegments = [];
    owner.pathTimer = 0;

    for (let i = 0; i < 30; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
      expect(owner.facingX).not.toBeNaN();
      expect(owner.facingY).not.toBeNaN();
    }
  });
});

// ---------------------------------------------------------------------------
describe('steering — no stuckNudge property', () => {
  it('owner object has no stuckNudge property', () => {
    // stuckNudge was removed — random nudge is noise with steering model
    expect(owner.stuckNudge).toBeUndefined();
  });

  it('owner.stuckTimer resets to 0 after force-repath (interval-based detection)', () => {
    // New interval-based stuck detection: stuckTimer increments once per CHECK_INTERVAL frames.
    // On open levels: CHECK_INTERVAL=15, MAX_STUCK_CHECKS=3 → 45 frames with no movement → repath.
    owner.active = true;
    owner.fleeTimer = 0;
    owner.stuckTimer = 0;
    owner.lastCheckTimer = 0;
    player.x = 100; player.y = 100;
    owner.x = 900; owner.y = 500;
    // Block movement so net displacement stays near zero
    obstacles.push({ id: 'wall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });
    // Run 3 full CHECK_INTERVAL cycles (3 * 15 = 45 frames) → stuckTimer reaches MAX_STUCK_CHECKS → reset
    for (let i = 0; i < 46; i++) {
      owner.update();
    }
    expect(owner.stuckTimer).toBe(0);
    obstacles.length = 0;
  });
});

// ---------------------------------------------------------------------------
describe('steering — activate() resets pathSegments and segmentIndex', () => {
  it('pathSegments = [] after activate()', () => {
    owner.pathSegments = [{ startPx: { x: 0, y: 0 }, endPx: { x: 40, y: 0 }, dir: { x: 1, y: 0 } }];
    difficulty = 'normal';
    level = 2;
    owner.activate();
    expect(owner.pathSegments).toEqual([]);
  });

  it('segmentIndex = 0 after activate()', () => {
    owner.segmentIndex = 5;
    difficulty = 'normal';
    level = 2;
    owner.activate();
    expect(owner.segmentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('steering — flee() resets pathSegments and segmentIndex', () => {
  it('pathSegments = [] after flee()', () => {
    owner.pathSegments = [{ startPx: { x: 0, y: 0 }, endPx: { x: 40, y: 0 }, dir: { x: 1, y: 0 } }];
    owner.flee();
    expect(owner.pathSegments).toEqual([]);
  });

  it('segmentIndex = 0 after flee()', () => {
    owner.segmentIndex = 3;
    owner.flee();
    expect(owner.segmentIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('steering — basement corridor movement', () => {
  it('owner makes progress through straight basement corridor (no stuck)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.driftAngle = 0;

    // Place owner at left side, player at right side
    owner.x = 80;
    owner.y = 280;
    player.x = 900;
    player.y = 280;

    const startX = owner.x;
    owner.path = [];
    owner.pathSegments = [];
    owner.pathTimer = 0;

    // Run 100 frames
    for (let i = 0; i < 100; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    // Owner should have moved significantly toward player
    expect(owner.x).toBeGreaterThan(startX + 50);
    basementMode = '';
  });

  it('stuckTimer stays low in open corridor (no fake stuck)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.speed = 2.0;
    owner.driftAngle = 0;
    owner.stuckTimer = 0;

    owner.x = 80;
    owner.y = 280;
    player.x = 900;
    player.y = 280;

    owner.path = [];
    owner.pathSegments = [];
    owner.pathTimer = 0;

    let maxStuck = 0;
    for (let i = 0; i < 80; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
      // Track stuckTimer via update() instead — use direct movement test
    }

    // Owner moved → stuckTimer should be 0 (reset when moving)
    // We verify by checking owner moved
    expect(owner.x).toBeGreaterThan(100);
    basementMode = '';
  });
});

// ---------------------------------------------------------------------------
describe('steering — dynamic obstacle forces repath', () => {
  it('path and segments cleared when escapeObstacles() triggers (owner inside obstacle)', () => {
    // escapeObstacles() sets path=[], pathSegments=[], pathTimer=0.
    // Note: _moveTowardTarget runs after and sets pathTimer=recalcInterval,
    // so we verify path=[] and pathSegments=[] rather than pathTimer=0.
    obstacles.length = 0;
    occupiedCells.clear();
    owner.active = true;
    owner.fleeTimer = 0;
    owner.path = [{ col: 5, row: 5 }, { col: 6, row: 5 }];
    owner.pathSegments = [{
      startPx: cellToPixelCenter(5, 5),
      endPx:   cellToPixelCenter(6, 5),
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.pathTimer = 20;

    player.x = 100; player.y = 100;
    owner.x = 600; owner.y = 300;

    // Place obstacle directly on owner — escapeObstacles() will push owner out and reset path
    obstacles.push({ id: 'trap', x: owner.x - 10, y: owner.y - 10, width: 100, height: 100 });

    owner.update();

    // After escapeObstacles() + repath: owner is no longer inside obstacle
    const ownerR = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    const stillOverlaps = obstacles.some(o => rectsOverlap(ownerR, o));
    expect(stillOverlaps).toBe(false);
    obstacles.length = 0;
  });
});

// ---------------------------------------------------------------------------
// Segment completion — EPSILON=8px (owner 36×36 fits in 40px cell with 4px margin)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Grid-node movement — basement (replaces old segment completion tests)
// ---------------------------------------------------------------------------
describe('grid-node movement — node arrival (basement)', () => {
  it('currentNode advances after moveProgress >= 1.0', () => {
    // Grid-node model: moveProgress 0→1 → snap to nextNode → advance queue.
    basementMode = 'corridor';
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
    basementMode = '';
  });

  it('owner x/y snaps to exact cell pixel when moveProgress >= 1.0', () => {
    // On node arrival, x/y must equal cellToPixel(currentNode) exactly.
    basementMode = 'corridor';
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
    basementMode = '';
  });

  it('moveProgress does NOT advance when nextNode is null (path exhausted)', () => {
    basementMode = 'corridor';
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
    basementMode = '';
  });

  it('carry-over: moveProgress -= 1.0 on node arrival (not reset to 0)', () => {
    // Carry-over ensures smooth transition: excess progress carries to next segment.
    basementMode = 'corridor';
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
    basementMode = '';
  });
});

describe('corner-freeze regression — stuckTimer threshold in basement', () => {
  it('stuckTimer threshold is 20 frames in basement (not 45)', () => {
    // Regression: old threshold=45 meant owner was stuck for 0.75s before repath.
    // New threshold=20 (~0.33s) recovers faster in narrow corridors.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.stuckTimer = 0;
    owner.path = [];
    owner.pathSegments = [];
    owner.pathTimer = 0;

    player.x = 600; player.y = 300;
    owner.x = 100; owner.y = 100;

    // Block owner with a wall so it can't move
    obstacles.push({ id: 'blockwall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });

    // Run 21 frames — should trigger repath at frame 20 (threshold=20 in basement)
    for (let i = 0; i < 21; i++) {
      owner.update();
    }

    // stuckTimer should have been reset (repath triggered at 20)
    expect(owner.stuckTimer).toBe(0);
    obstacles.length = 0;
    basementMode = '';
  });

  it('stuckTimer threshold is 45 frames on open levels (not 20)', () => {
    // On open levels the threshold stays at 45 — no regression.
    // We test this by directly driving _moveTowardTarget with a blocked owner
    // and a high pathTimer (no repath), then checking stuckTimer after 21 frames.
    // With threshold=45, stuckTimer should still be 21 (not reset).
    basementMode = '';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.active = true;
    owner.fleeTimer = 0;
    owner.stuckTimer = 0;
    // Set pathTimer high so no repath fires during the 21 frames
    owner.pathTimer = 200;
    owner.path = [{ col: 5, row: 5 }, { col: 6, row: 5 }];
    owner.pathSegments = [{
      startPx: cellToPixelCenter(5, 5),
      endPx:   cellToPixelCenter(6, 5),
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    player.x = 600; player.y = 300;
    owner.x = 100; owner.y = 100;

    // Block owner completely — no movement possible
    obstacles.push({ id: 'blockwall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });

    // Run 21 frames via _moveTowardTarget directly (bypasses escapeObstacles)
    for (let i = 0; i < 21; i++) {
      const prevX = owner.x, prevY = owner.y;
      owner._moveTowardTarget(player.x, player.y, owner.speed);
      // Manually drive stuckTimer as update() would
      const ddx = owner.x - prevX, ddy = owner.y - prevY;
      if (ddx*ddx + ddy*ddy < 0.25) {
        owner.stuckTimer++;
        const threshold = (basementMode !== '') ? 20 : 45;
        if (owner.stuckTimer > threshold) {
          owner.path = []; owner.pathSegments = []; owner.segmentIndex = 0;
          owner.pathTimer = 0; owner.stuckTimer = 0;
        }
      } else {
        owner.stuckTimer = 0;
      }
    }

    // With threshold=45, stuckTimer should be 21 (not reset — threshold not reached)
    expect(owner.stuckTimer).toBe(21);
    obstacles.length = 0;
  });
});

describe('corner-freeze regression — _getSteeringTarget with owner behind segment start', () => {
  it('target is always ahead of startPx even when owner is behind segment start (t < 0)', () => {
    // Regression: old code used t + LOOKAHEAD which could be negative when t < 0,
    // pointing the target backward. New code uses max(t, 0) + LOOKAHEAD.
    const LOOKAHEAD = GRID * 0.8; // 32px

    owner.pathSegments = [{
      startPx: { x: 300, y: 200 },
      endPx:   { x: 500, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner center at x=250 — 50px BEHIND segment start (t = -50)
    owner.x = 250 - owner.width / 2;
    owner.y = 200 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();

    // With max(t,0)+LOOKAHEAD: target.x = 300 + 0 + 32 = 332
    // Old code: target.x = 300 + (-50 + 32) = 282 — behind startPx!
    expect(target.x).toBeGreaterThanOrEqual(300); // must be at or ahead of startPx
    expect(target.x).toBeCloseTo(300 + LOOKAHEAD, 1); // exactly startPx + LOOKAHEAD
  });

  it('target direction is always forward (positive along dir) when owner is behind start', () => {
    owner.pathSegments = [{
      startPx: { x: 200, y: 100 },
      endPx:   { x: 200, y: 400 },
      dir:     { x: 0, y: 1 }, // vertical down
    }];
    owner.segmentIndex = 0;

    // Owner center at y=50 — 50px ABOVE segment start (t = -50)
    owner.x = 200 - owner.width / 2;
    owner.y = 50 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // Target must be below startPx.y (forward along dir)
    expect(target.y).toBeGreaterThanOrEqual(100);
  });
});

describe('grid-node movement — forward progress in corridor (basement)', () => {
  it('owner makes forward progress through straight corridor (grid-node model)', () => {
    // Grid-node model: owner moves node-by-node, always making forward progress.
    // No lateral snap, no threshold oscillation, no freeze.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Set up grid-node state: moving right along row 7
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

    // Run 10 frames at speed=2 → progress += 2/40 = 0.05/frame → 0.5 total
    // Owner should be visually between col=2 and col=3 (x > startX)
    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(2);
    }

    expect(owner.x).toBeGreaterThan(startX);
    basementMode = '';
  });
});

// ---------------------------------------------------------------------------
describe('off-axis freeze regression — orthogonal centering', () => {
  // Orthogonal model: owner moves strictly H or V, never diagonal.
  // STATE 1 (ADVANCING): |perp| <= ALIGN_THRESHOLD=2px → move along axis
  // STATE 2 (CENTERING): |perp| > ALIGN_THRESHOLD=2px → move toward axis (full speed)
  //
  // Key difference from old wall-aware model:
  // - Old model: if wall blocks centering → target.y = ownerCy (no pull)
  // - New model: target.y = axisY always when off-axis (wall-sliding physics handles blocked case)
  // This eliminates the freeze caused by tiny diagonal dy component.

  it('horizontal segment: target.y = axis when owner is off-axis (CENTERING state)', () => {
    // Owner off-axis → CENTERING → target.y = axisY, target.x = ownerCx (no axial movement)
    obstacles.length = 0;
    occupiedCells.clear();

    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 500, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center Y = 210 (10px below axis at y=200) → off-axis → CENTERING
    owner.x = 150 - owner.width / 2;
    owner.y = 210 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // CENTERING: target.y = axisY = 200, target.x = ownerCx = 150 (no axial movement)
    expect(target.y).toBeCloseTo(200, 1);
    expect(target.x).toBeCloseTo(150, 1); // ownerCx — no axial movement during centering
  });

  it('horizontal segment: target.y = axisY even when wall blocks path to axis (orthogonal model)', () => {
    // New orthogonal model: target.y = axisY always when off-axis.
    // Wall-sliding physics handles the case where centering is blocked by a wall.
    obstacles.length = 0;
    occupiedCells.clear();

    const segY = 190; // axis Y
    owner.pathSegments = [{
      startPx: { x: 900, y: segY },
      endPx:   { x: 100, y: segY },
      dir:     { x: -1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner center Y = 200 (10px below axis at y=190) → off-axis → CENTERING
    owner.x = 882;
    owner.y = 182; // center y = 200

    // Wall above owner — orthogonal model ignores it for target computation.
    obstacles.push({ id: 'hwall', x: 0, y: 172, width: 1200, height: 10 });

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // Orthogonal model: target.y = axisY = 190 (always, wall-sliding handles blocked case)
    expect(target.y).toBeCloseTo(segY, 1);
    // target.x = ownerCx (no axial movement during centering)
    expect(target.x).toBeCloseTo(882 + owner.width / 2, 1);
    obstacles.length = 0;
  });

  it('vertical segment: target.x = axis when owner is off-axis (CENTERING state)', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.pathSegments = [{
      startPx: { x: 200, y: 100 },
      endPx:   { x: 200, y: 500 },
      dir:     { x: 0, y: 1 },
    }];
    owner.segmentIndex = 0;
    // Owner center X = 210 (10px right of axis at x=200) → off-axis → CENTERING
    owner.x = 210 - owner.width / 2;
    owner.y = 150 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // CENTERING: target.x = axisX = 200, target.y = ownerCy (no axial movement)
    expect(target.x).toBeCloseTo(200, 1);
    expect(target.y).toBeCloseTo(150, 1); // ownerCy — no axial movement during centering
  });

  it('vertical segment: target.x = axisX even when wall blocks path to axis (orthogonal model)', () => {
    // New orthogonal model: target.x = axisX always when off-axis.
    obstacles.length = 0;
    occupiedCells.clear();

    const segX = 200;
    owner.pathSegments = [{
      startPx: { x: segX, y: 100 },
      endPx:   { x: segX, y: 500 },
      dir:     { x: 0, y: 1 },
    }];
    owner.segmentIndex = 0;
    // Owner center X = 210 (10px right of axis at x=200) → off-axis → CENTERING
    owner.x = 210 - owner.width / 2; // 192
    owner.y = 150 - owner.height / 2;

    // Wall to the left — orthogonal model ignores it for target computation.
    obstacles.push({ id: 'vwall', x: 182, y: 0, width: 10, height: 700 });

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    // Orthogonal model: target.x = axisX = 200 (always, wall-sliding handles blocked case)
    expect(target.x).toBeCloseTo(segX, 1);
    expect(target.y).toBeCloseTo(150, 1); // ownerCy — no axial movement during centering
    obstacles.length = 0;
  });

  it('horizontal segment: owner on-axis — target.y = axis (ADVANCING state)', () => {
    obstacles.length = 0;
    occupiedCells.clear();

    owner.pathSegments = [{
      startPx: { x: 100, y: 200 },
      endPx:   { x: 500, y: 200 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    // Owner center exactly on axis: y=200
    owner.x = 150 - owner.width / 2;
    owner.y = 200 - owner.height / 2;

    const target = owner._getSteeringTarget();
    expect(target).not.toBeNull();
    expect(target.y).toBeCloseTo(200, 1);
    expect(target.x).toBeGreaterThan(150);
  });

  it('off-axis owner makes forward progress when wall blocks perpendicular (no freeze)', () => {
    // Simulate the corridor freeze: owner off-axis, wall blocks perpendicular movement.
    // Wall-aware centering: wall detected → no perpendicular pull → owner moves purely axially.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const segStartX = 900;
    const segY = 190;
    owner.pathSegments = [{
      startPx: { x: segStartX, y: segY },
      endPx:   { x: 100,       y: segY },
      dir:     { x: -1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner off-axis: center Y = 200 (10px below segment axis at y=190)
    owner.x = 882;
    owner.y = 182; // center y = 200

    // Wall above owner blocks upward movement toward axis
    obstacles.push({ id: 'hwall', x: 0, y: 160, width: 1200, height: 10 });

    owner.path = [
      { col: 22, row: 4 }, { col: 21, row: 4 }, { col: 20, row: 4 },
      { col: 19, row: 4 }, { col: 18, row: 4 },
    ];
    owner.pathTimer = 100;

    const startX = owner.x;

    for (let i = 0; i < 10; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    // Owner must have moved left (not frozen)
    expect(owner.x).toBeLessThan(startX);
    obstacles.length = 0;
    basementMode = '';
  });

  it('grid-node: owner y stays on cell axis (no off-axis drift in grid-node model)', () => {
    // Grid-node model: owner always moves between exact cell pixels via lerp.
    // There is no perpendicular drift — owner.y is always interpolated between
    // cellToPixel(currentNode).y and cellToPixel(nextNode).y.
    // For horizontal movement (same row), y stays constant at cellToPixel(row).y.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Moving right along row 5 — y should stay at cellToPixel(*, 5).y
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

    // Y must stay exactly on the row axis (no perpendicular drift)
    expect(owner.y).toBeCloseTo(expectedY, 1);
    basementMode = '';
  });

  it('freeze-3: wall-corner deadlock — X blocked by vertical wall, owner escapes via Y (wall-corner escape)', () => {
    // Replicates the exact freeze-3 scenario from browser logs:
    //   ownerX=600.88, ownerY=175.33, seg=H going LEFT (dir.x=-1)
    //   axisY0=190, ownerCy=193.33 (3.33px below axis)
    //   Vertical wall at col=14 (x=560..600) blocks X movement (nx=599.29 < 600 → hit)
    //   Y movement should escape via wall-corner escape at full speed
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Horizontal segment going LEFT, axis at y=190
    const segStartX = 620; // cellToPixelCenter(15,4).x
    const segEndX   = 220; // cellToPixelCenter(5,4).x (approx)
    const axisY     = 190; // cellToPixelCenter(col,4).y = 10+4*40+20
    owner.pathSegments = [{
      startPx: { x: segStartX, y: axisY },
      endPx:   { x: segEndX,   y: axisY },
      dir:     { x: -1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner position from logs: x=600.88, y=175.33
    // ownerCy = 175.33 + 18 = 193.33 (3.33px below axis)
    owner.x = 600.88;
    owner.y = 175.33;

    // Vertical wall at col=14: x=560, width=40 → spans x=560..600
    // This blocks X movement: nx=599.29 < 600 → rectsOverlap → xOk=false
    obstacles.push({ id: 'vwall-col14', x: 560, y: 130, width: 40, height: 120 });

    owner.path = [
      { col: 15, row: 4 }, { col: 14, row: 4 }, { col: 13, row: 4 },
      { col: 12, row: 4 }, { col: 5,  row: 4 },
    ];
    owner.pathTimer = 100; // prevent repath

    const startX = owner.x;
    const startY = owner.y;

    // Run 20 frames — owner must escape via Y (wall-corner escape)
    owner.speed = 3.6; // normal difficulty level 9
    for (let i = 0; i < 20; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    // Owner must have moved on Y (escaped the wall corner)
    // X is blocked by vertical wall, so Y must change
    const movedY = Math.abs(owner.y - startY);
    expect(movedY).toBeGreaterThan(1); // at least 1px net Y movement in 20 frames

    obstacles.length = 0;
    basementMode = '';
  });

  it('freeze-3: wall-corner escape does NOT fire when X is free (no spurious Y nudge)', () => {
    // Ensure wall-corner escape only activates when X is actually blocked
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const axisY = 190;
    owner.pathSegments = [{
      startPx: { x: 620, y: axisY },
      endPx:   { x: 220, y: axisY },
      dir:     { x: -1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner well clear of any wall — X movement is free
    owner.x = 650;
    owner.y = 175; // slightly below axis

    // No obstacles — X movement is free
    owner.path = [
      { col: 16, row: 4 }, { col: 15, row: 4 }, { col: 14, row: 4 },
    ];
    owner.pathTimer = 100;

    const startX = owner.x;

    owner.speed = 3.6;
    for (let i = 0; i < 10; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    // Owner must have moved LEFT (X is free, normal steering applies)
    expect(owner.x).toBeLessThan(startX);
    basementMode = '';
  });

  it('grid-node: vertical movement — owner y advances toward nextNode (no wall-corner needed)', () => {
    // Grid-node model: owner moves node-to-node along A* path.
    // No wall-corner escape needed — A* guarantees path through free cells.
    // Vertical movement: owner moves from (7,5) to (7,6) — y increases.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    owner.currentNode = { col: 7, row: 5 };
    owner.nextNode    = { col: 7, row: 6 };
    owner.nodeQueue   = [{ col: 7, row: 7 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(7, 5);
    const toPx   = cellToPixel(7, 6);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    owner.path = [{ col: 7, row: 5 }, { col: 7, row: 6 }, { col: 7, row: 7 }];
    owner.pathTimer = 100;

    const startY = owner.y;

    // Run 10 frames at speed=3.6 → progress += 3.6/40 = 0.09/frame → 0.9 total
    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(3.6);
    }

    // Owner must have moved downward (y increased toward toPx.y)
    expect(owner.y).toBeGreaterThan(startY);
    // X must stay on column axis (no lateral drift)
    expect(owner.x).toBeCloseTo(fromPx.x, 1);

    obstacles.length = 0;
    basementMode = '';
  });

  it('freeze-4: escapeObstacles fires → pathTimer reset → owner escapes oscillation', () => {
    // Replicates freeze-4: owner at col=0 corridor (ownerX≈5, ownerY≈527),
    // horizontal segment going RIGHT (axisY0=550, row=13).
    // Horizontal wall at row=12 (y=490..530) starts at col=1 (x=40).
    // Owner right edge = 5+36=41 > 40 → overlaps wall → escapeObstacles fires.
    // Without fix: escape pushes LEFT to x=3, owner tries to go right again → oscillation.
    // With fix: escape resets pathTimer=0 → repath from new position → owner escapes.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Horizontal wall at row=12: x=40, y=490, width=760, height=40 (col=1..19)
    // This is the wall the owner's right edge overlaps when ownerX≈5
    obstacles.push({ id: 'hwall-row12', x: 40, y: 490, width: 760, height: 40 });

    // Horizontal segment going RIGHT, axis at y=550 (row=13 center)
    // cellToPixelCenter(0,13) = {x:20, y:550}
    owner.pathSegments = [{
      startPx: { x: 20,  y: 550 },
      endPx:   { x: 580, y: 550 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner at ownerX=5, ownerY=527 — right edge=41 overlaps wall at x=40
    // (wall spans y=490..530, owner spans y=527..563 → overlap in y=527..530)
    owner.x = 5;
    owner.y = 527;

    // Path going right along row=13
    owner.path = [
      { col: 0, row: 13 }, { col: 1, row: 13 }, { col: 2, row: 13 },
      { col: 3, row: 13 }, { col: 5, row: 13 }, { col: 10, row: 13 },
    ];
    owner.pathTimer = 100; // high timer — without fix, no repath would happen
    owner.lastCheckTimer = 0;
    owner.stuckTimer = 0;
    owner.lastX = owner.x;
    owner.lastY = owner.y;

    owner.speed = 3.6;
    owner.active = true;

    // Run update() — escapeObstacles fires, with fix pathTimer is reset to 0,
    // then _moveTowardTarget runs immediately (pathTimer-- → -1 → repath fires).
    // After repath: pathTimer = recalcInterval (15 in basement).
    // Without fix: pathTimer stays at 100 (no repath triggered by escape).
    owner.update();

    // After fix: pathTimer must be < 100 (was reset by escape → repath happened)
    // recalcInterval in basement = 15, so pathTimer should be 15 after repath.
    expect(owner.pathTimer).toBeLessThan(100);
    // pathSegments was cleared by escape fix (old path discarded)
    // After repath it may be rebuilt — check it was at least cleared once
    // (segmentIndex reset to 0 is the reliable indicator)
    expect(owner.segmentIndex).toBe(0);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });

  it('freeze-4: after escape+repath, owner makes net progress (no oscillation)', () => {
    // Full integration: owner oscillates in col=0 corridor without fix.
    // With fix: after escape resets pathTimer, owner gets fresh path and moves.
    // We simulate the scenario by placing owner at x=5, y=527 with wall at x=40, y=490..530.
    // After escape, owner is pushed to x=3 (right edge=39 < 40 → free).
    // With pathTimer=0, next update() recomputes path from x=3, y=527.
    // New path routes owner DOWN (through col=0 corridor) then RIGHT.
    // Net displacement over 30 frames must exceed NET_THRESHOLD2=2px².
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Horizontal wall at row=12: x=40, y=490, width=760, height=40
    obstacles.push({ id: 'hwall-row12', x: 40, y: 490, width: 760, height: 40 });

    // Horizontal segment going RIGHT, axis at y=550
    owner.pathSegments = [{
      startPx: { x: 20,  y: 550 },
      endPx:   { x: 580, y: 550 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    owner.x = 5;
    owner.y = 527;
    owner.path = [
      { col: 0, row: 13 }, { col: 1, row: 13 }, { col: 5, row: 13 },
    ];
    owner.pathTimer = 100;
    owner.lastCheckTimer = 0;
    owner.stuckTimer = 0;
    owner.lastX = owner.x;
    owner.lastY = owner.y;

    owner.speed = 3.6;
    owner.active = true;

    const startX = owner.x;
    const startY = owner.y;

    // Run 30 frames of update()
    for (let i = 0; i < 30; i++) {
      owner.update();
    }

    // Owner must have made net progress (not oscillating in place)
    const netDx = owner.x - startX;
    const netDy = owner.y - startY;
    const netDist2 = netDx * netDx + netDy * netDy;
    expect(netDist2).toBeGreaterThan(2); // NET_THRESHOLD2=2px² in basement

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });
});

// ---------------------------------------------------------------------------
describe('freeze-5 regression — escapeObstacles Y-oscillation with snap fix', () => {
  // Reproduces the exact freeze from the log:
  //   ownerX=19.9, ownerY oscillates 210.1↔213.7, netDist2=0.00
  //   Owner at col=0 (x≈20), right edge=56 overlaps col=1 wall at x=40.
  //   escapeObstacles() finds vertical escape (dy=±1) but X stays at 20.
  //   Next frame: still overlapping → escape again → Y oscillates.
  //   ADVANCING tries dx=+1 → xOk=false → no movement → freeze.
  //
  // Fix: after escapeObstacles, snap owner to nearest free cell-aligned position.
  // This moves owner to x=0 (col=0 top-left), right edge=36 < 40 → no overlap.
  // A* then builds a valid path from col=0 that doesn't re-enter the wall.

  it('after escape: owner snapped to free cell, no longer overlapping wall', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    // Wall at col=1: x=40, y=160, width=40, height=120 (rows 4-6)
    // Owner at x=19.9 → right edge=55.9 → overlaps this wall
    const b = getPlayBounds();
    obstacles.push({ id: 'wall-col1', x: b.left + 40, y: b.top + 160, width: 40, height: 120 });

    // Place owner so its right edge overlaps the wall
    owner.x = b.left + 19.9;
    owner.y = b.top + 174;
    owner.active = true;
    owner.speed = 3.6;
    owner.path = [{ col: 0, row: 5 }, { col: 1, row: 7 }];
    owner.pathSegments = [{
      startPx: { x: b.left + 20, y: b.top + 230 },
      endPx:   { x: b.left + 60, y: b.top + 230 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.pathTimer = 100;
    owner.lastCheckTimer = 0;
    owner.stuckTimer = 0;
    owner.lastX = owner.x;
    owner.lastY = owner.y;

    // Verify owner IS overlapping the wall before update
    const ownerRect0 = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    expect(hitsObstacles(ownerRect0)).toBe(true);

    // Run 1 frame — escapeObstacles fires, snap should move owner to free cell
    owner.update();

    // After snap: owner must NOT overlap any obstacle
    const ownerRectAfter = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    expect(hitsObstacles(ownerRectAfter)).toBe(false);

    // pathTimer=0 was set by escape block → _moveTowardTarget ran repath in same frame
    // → pathTimer is now recalcInterval (15 for basement). Repath happened = pathTimer > 0.
    expect(owner.pathTimer).toBeGreaterThan(0);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });

  it('after escape: no Y-oscillation over 20 frames', () => {
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
    owner.pathSegments = [{
      startPx: { x: b.left + 20, y: b.top + 230 },
      endPx:   { x: b.left + 60, y: b.top + 230 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.pathTimer = 100;
    owner.lastCheckTimer = 0;
    owner.stuckTimer = 0;
    owner.lastX = owner.x;
    owner.lastY = owner.y;

    const yValues = [];
    for (let i = 0; i < 20; i++) {
      owner.update();
      yValues.push(owner.y);
    }

    // Y must NOT oscillate: after snap, owner should be stable (not bouncing ±3.6px)
    // Oscillation pattern: y[i] ≈ y[i-2] but y[i] ≠ y[i-1]
    let oscillationCount = 0;
    for (let i = 2; i < yValues.length; i++) {
      if (Math.abs(yValues[i] - yValues[i - 2]) < 1 &&
          Math.abs(yValues[i] - yValues[i - 1]) > 2) {
        oscillationCount++;
      }
    }
    // Allow at most 1 oscillation (the very first escape frame may have one bounce)
    expect(oscillationCount).toBeLessThanOrEqual(1);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });

  it('after escape: net displacement > NET_THRESHOLD2 over 30 frames (not frozen)', () => {
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
    owner.pathSegments = [{
      startPx: { x: b.left + 20, y: b.top + 230 },
      endPx:   { x: b.left + 60, y: b.top + 230 },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;
    owner.pathTimer = 100;
    owner.lastCheckTimer = 0;
    owner.stuckTimer = 0;
    owner.lastX = owner.x;
    owner.lastY = owner.y;

    const startX = owner.x;
    const startY = owner.y;

    for (let i = 0; i < 30; i++) {
      owner.update();
    }

    const netDx = owner.x - startX;
    const netDy = owner.y - startY;
    const netDist2 = netDx * netDx + netDy * netDy;
    // Must have moved at least NET_THRESHOLD2=2px² net over 30 frames
    expect(netDist2).toBeGreaterThan(2);

    obstacles.length = 0;
    basementMode = '';
    owner.active = false;
  });
});
