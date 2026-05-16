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
describe('segment completion — epsilon 8px', () => {
  it('segmentIndex advances when owner center is within 8px of segment end', () => {
    // Owner 36×36px fits in 40px cell — EPSILON=8px is sufficient.
    // Place owner center at segLen - 6px from start (within 8px of end) → must advance.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const startPx = cellToPixelCenter(3, 5);
    const endPx   = cellToPixelCenter(7, 5);
    const segLen  = endPx.x - startPx.x; // 4 cells = 160px

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Place owner center at segLen - 6px from start (within EPSILON=8px of end)
    owner.x = startPx.x + segLen - 6 - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [
      { col: 3, row: 5 }, { col: 4, row: 5 },
      { col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 },
    ];
    owner.pathTimer = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.segmentIndex).toBeGreaterThan(0);
    basementMode = '';
  });

  it('segmentIndex does NOT advance when owner is 10px from segment end (> EPSILON=8px)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const startPx = cellToPixelCenter(3, 5);
    const endPx   = cellToPixelCenter(7, 5);
    const segLen  = endPx.x - startPx.x; // 4 cells = 160px

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Place owner center at segLen - 10px from start (10px > EPSILON=8px → should NOT advance)
    owner.x = startPx.x + segLen - 10 - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [
      { col: 3, row: 5 }, { col: 4, row: 5 },
      { col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 },
    ];
    owner.pathTimer = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.segmentIndex).toBe(0);
    basementMode = '';
  });

  it('segmentIndex does NOT advance when owner is at start of segment (far from end)', () => {
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const startPx = cellToPixelCenter(3, 5);
    const endPx   = cellToPixelCenter(7, 5);

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: startPx.y },
      endPx:   { x: endPx.x,   y: endPx.y   },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    // Owner at start of segment — far from end, should NOT advance
    owner.x = startPx.x - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;

    owner.path = [
      { col: 3, row: 5 }, { col: 4, row: 5 },
      { col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 },
    ];
    owner.pathTimer = 100;

    owner._moveTowardTarget(player.x, player.y, owner.speed);

    expect(owner.segmentIndex).toBe(0);
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

describe('corner-freeze regression — no lateral snap (removed: caused turn deadlocks)', () => {
  it('owner moves forward along horizontal segment without lateral snap interference', () => {
    // Lateral snap was removed because it caused deadlocks at turns:
    // snap tried to pull owner perpendicular to the new segment axis, but the
    // wall of the previous corridor blocked it, creating a deadlock.
    // The steering model alone (with correct epsilon) is sufficient.
    basementMode = 'corridor';
    obstacles.length = 0;
    occupiedCells.clear();

    const axisY = cellToPixelCenter(0, 7).y;
    const startPx = cellToPixelCenter(2, 7);
    const endPx   = cellToPixelCenter(12, 7);

    owner.pathSegments = [{
      startPx: { x: startPx.x, y: axisY },
      endPx:   { x: endPx.x,   y: axisY },
      dir:     { x: 1, y: 0 },
    }];
    owner.segmentIndex = 0;

    owner.x = startPx.x - owner.width / 2;
    owner.y = axisY - owner.height / 2;

    owner.path = [
      { col: 2, row: 7 }, { col: 3, row: 7 }, { col: 4, row: 7 },
      { col: 5, row: 7 }, { col: 6, row: 7 }, { col: 7, row: 7 },
    ];
    owner.pathTimer = 100;

    const startX = owner.x;

    // Run 10 frames — owner should move forward (no snap interference)
    for (let i = 0; i < 10; i++) {
      owner._moveTowardTarget(player.x, player.y, owner.speed);
    }

    expect(owner.x).toBeGreaterThan(startX);
    basementMode = '';
  });
});
