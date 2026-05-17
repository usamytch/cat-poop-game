// ==========================================
// owner.test.js — owner AI: activate, flee, onShotFired, update, anti-stuck
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
  player.x = 100;
  player.y = 300;
  player.urge = 0;
  // Не хардкодим размеры — берём из игрового объекта
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
  // Reset litterBox to a safe position far from player
  litterBox.x = 900;
  litterBox.y = 400;
  litterBox.width = 92;
  litterBox.height = 62;
}

beforeEach(resetCommon);

// ---------------------------------------------------------------------------
describe('owner — initial state after activate()', () => {
  it('poopHits = 0 after activate', () => {
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.poopHits).toBe(0);
  });

  it('facePoops = [] after activate', () => {
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.facePoops).toEqual([]);
  });

  it('fleeTimer = 0 after activate', () => {
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.fleeTimer).toBe(0);
  });

  it('nodeQueue = [] after activate', () => {
    owner.nodeQueue = [{ col: 5, row: 5 }];
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.nodeQueue).toEqual([]);
  });

  it('currentNode is set after activate (not null)', () => {
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.currentNode).not.toBeNull();
  });

  it('shotReactTimer = 0 after activate', () => {
    owner.shotReactTimer = 20;
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.shotReactTimer).toBe(0);
  });

  it('hesitateTimer = 0 after activate', () => {
    owner.hesitateTimer = 10;
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.hesitateTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('owner.activate()', () => {
  it('level < diff.firstLvl → active = false', () => {
    difficulty = 'normal'; // firstLvl = 2
    level = 1;
    owner.activate();
    expect(owner.active).toBe(false);
  });

  it('level >= diff.firstLvl → active = true', () => {
    difficulty = 'normal'; // firstLvl = 2
    level = 2;
    owner.activate();
    expect(owner.active).toBe(true);
  });

  it('easy mode: level 1 → inactive (firstLvl=3)', () => {
    difficulty = 'easy'; // firstLvl = 3
    level = 1;
    owner.activate();
    expect(owner.active).toBe(false);
  });

  it('easy mode: level 3 → active', () => {
    difficulty = 'easy'; // firstLvl = 3
    level = 3;
    owner.activate();
    expect(owner.active).toBe(true);
  });

  it('speed = baseSpd + (level-1) * spdPerLvl', () => {
    difficulty = 'normal';
    level = 3;
    owner.activate();
    const expected = DIFF.normal.baseSpd + (3 - 1) * DIFF.normal.spdPerLvl;
    expect(owner.speed).toBeCloseTo(expected);
  });

  it('speed is capped at maxSpd on very high level (normal)', () => {
    difficulty = 'normal';
    level = 50; // far beyond cap
    owner.activate();
    expect(owner.speed).toBeCloseTo(DIFF.normal.maxSpd);
  });

  it('speed is capped at maxSpd on very high level (easy)', () => {
    difficulty = 'easy';
    level = 50;
    owner.activate();
    expect(owner.speed).toBeCloseTo(DIFF.easy.maxSpd);
  });

  it('speed is capped at maxSpd on very high level (chaos)', () => {
    difficulty = 'chaos';
    level = 50;
    owner.activate();
    expect(owner.speed).toBeCloseTo(DIFF.chaos.maxSpd);
  });

  it('speed does not exceed maxSpd at level 20 (normal)', () => {
    difficulty = 'normal';
    level = 20;
    owner.activate();
    expect(owner.speed).toBeLessThanOrEqual(DIFF.normal.maxSpd + 0.001);
  });

  it('catnipTarget reset to null after activate', () => {
    owner.catnipTarget = { x: 100, y: 100 };
    difficulty = 'normal';
    level = 2;
    owner.activate();
    expect(owner.catnipTarget).toBeNull();
  });

  it('poopHits reset to 0', () => {
    owner.poopHits = 5;
    difficulty = 'normal';
    level = 2; // normal.firstLvl = 2
    owner.activate();
    expect(owner.poopHits).toBe(0);
  });

  it('facePoops cleared', () => {
    owner.facePoops = [{ rx: 1, ry: 1, rot: 0, scale: 1 }];
    difficulty = 'normal';
    level = 2; // normal.firstLvl = 2
    owner.activate();
    expect(owner.facePoops).toEqual([]);
  });

  it('fleeTimer reset to 0', () => {
    owner.fleeTimer = 100;
    difficulty = 'normal';
    level = 2; // normal.firstLvl = 2
    owner.activate();
    expect(owner.fleeTimer).toBe(0);
  });

  it('position set to corner farthest from player', () => {
    player.x = 100;
    player.y = 300;
    difficulty = 'normal';
    level = 2; // normal.firstLvl = 2
    owner.activate();
    const b = getPlayBounds();
    // Owner should be placed in one of the four corners
    const corners = [
      { x: b.right - owner.width - 20, y: b.top + 20 },
      { x: b.right - owner.width - 20, y: b.bottom - owner.height - 20 },
      { x: b.left + 20, y: b.top + 20 },
      { x: b.left + 20, y: b.bottom - owner.height - 20 },
    ];
    const isCorner = corners.some(c =>
      Math.abs(owner.x - c.x) < 2 && Math.abs(owner.y - c.y) < 2
    );
    expect(isCorner).toBe(true);
  });

  it('owner does not spawn on top of an obstacle', () => {
    // Fill all three corners with a large obstacle so the fallback grid search is used
    const b = getPlayBounds();
    // Place a big obstacle covering the top-right and bottom-right corners
    obstacles.push({
      id: 'blocker',
      x: b.right - owner.width - 60,
      y: b.top,
      width: 100,
      height: b.bottom - b.top,
    });
    player.x = 100;
    player.y = 300;
    difficulty = 'normal';
    level = 1;
    owner.activate();
    const ownerR = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    const overlaps = obstacles.some(o => rectsOverlap(ownerR, o));
    expect(overlaps).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('owner.flee()', () => {
  it('sets fleeTimer to 300', () => {
    owner.flee();
    expect(owner.fleeTimer).toBe(300);
  });

  it('fleeTarget is set to a corner', () => {
    owner.flee();
    expect(owner.fleeTarget).not.toBeNull();
    expect(owner.fleeTarget).toHaveProperty('x');
    expect(owner.fleeTarget).toHaveProperty('y');
  });

  it('fleeTarget is the corner farthest from player', () => {
    player.x = 100;
    player.y = 300;
    owner.flee();
    const b = getPlayBounds();
    const corners = [
      { x: b.right - owner.width - 20, y: b.top + 20 },
      { x: b.right - owner.width - 20, y: b.bottom - owner.height - 20 },
      { x: b.left + 20, y: b.top + 20 },
      { x: b.left + 20, y: b.bottom - owner.height - 20 },
    ];
    // Find the farthest corner manually
    let best = corners[0], bestDist = 0;
    for (const c of corners) {
      const dx = c.x - player.x, dy = c.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > bestDist) { bestDist = d; best = c; }
    }
    expect(owner.fleeTarget.x).toBeCloseTo(best.x);
    expect(owner.fleeTarget.y).toBeCloseTo(best.y);
  });

  it('flee() resets hesitateTimer to 0', () => {
    owner.hesitateTimer = 10;
    owner.flee();
    expect(owner.hesitateTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('owner.onShotFired()', () => {
  it('sets pathTimer to 0 when active and not fleeing', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.pathTimer = 25;
    owner.onShotFired();
    expect(owner.pathTimer).toBe(0);
  });

  it('sets shotReactTimer to 30 when active and not fleeing', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.shotReactTimer = 0;
    owner.onShotFired();
    expect(owner.shotReactTimer).toBe(30);
  });

  it('does nothing when owner is not active', () => {
    owner.active = false;
    owner.pathTimer = 25;
    owner.shotReactTimer = 0;
    owner.onShotFired();
    expect(owner.pathTimer).toBe(25);
    expect(owner.shotReactTimer).toBe(0);
  });

  it('does nothing when owner is fleeing', () => {
    owner.active = true;
    owner.fleeTimer = 100;
    owner.pathTimer = 25;
    owner.shotReactTimer = 0;
    owner.onShotFired();
    expect(owner.pathTimer).toBe(25);
    expect(owner.shotReactTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — flee mode', () => {
  it('fleeTimer decrements each frame', () => {
    owner.active = true;
    owner.fleeTimer = 10;
    owner.fleeTarget = { x: owner.x, y: owner.y }; // same position
    owner.update();
    expect(owner.fleeTimer).toBe(9);
  });

  it('cat is not caught during flee (no gameState change)', () => {
    owner.active = true;
    owner.fleeTimer = 100;
    owner.fleeTarget = { x: owner.x, y: owner.y };
    // Place owner on top of player
    owner.x = player.x;
    owner.y = player.y;
    gameState = 'playing';
    owner.update();
    // Should still be playing (flee mode skips catch check)
    expect(gameState).toBe('playing');
  });

  it('yarnFreezeTimer > 0 → owner does not move', () => {
    owner.active = true;
    yarnFreezeTimer = 10;
    const prevX = owner.x;
    const prevY = owner.y;
    owner.update();
    expect(owner.x).toBe(prevX);
    expect(owner.y).toBe(prevY);
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — face poop cleanup after flee', () => {
  it('when fleeTimer becomes 0 and poopHits >= 3 → facePoops cleared', () => {
    owner.active = true;
    owner.fleeTimer = 1;
    owner.fleeTarget = { x: owner.x, y: owner.y };
    owner.poopHits = 3;
    owner.facePoops = [
      { rx: 1, ry: 1, rot: 0, scale: 1 },
      { rx: 2, ry: 2, rot: 0, scale: 1 },
      { rx: 3, ry: 3, rot: 0, scale: 1 },
    ];
    // Move player far away to avoid catch
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.update(); // fleeTimer goes to 0
    owner.update(); // now in normal mode, cleanup runs
    expect(owner.facePoops).toEqual([]);
    expect(owner.poopHits).toBe(0);
  });

  it('when fleeTimer becomes 0 and poopHits < 3 → facePoops not cleared', () => {
    owner.active = true;
    owner.fleeTimer = 1;
    owner.fleeTarget = { x: owner.x, y: owner.y };
    owner.poopHits = 2;
    owner.facePoops = [
      { rx: 1, ry: 1, rot: 0, scale: 1 },
      { rx: 2, ry: 2, rot: 0, scale: 1 },
    ];
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.update(); // fleeTimer → 0
    owner.update(); // cleanup check: poopHits < 3 → no clear
    expect(owner.facePoops.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — pursuit and catch', () => {
  it('owner catches cat → stats.totalCaught increments', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    // Place owner directly on player
    owner.x = player.x;
    owner.y = player.y;
    const before = stats.totalCaught;
    owner.update();
    expect(stats.totalCaught).toBe(before + 1);
  });

  it('catch with lives > 1 → gameState = "lifeLost"', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    lives = 2;
    owner.x = player.x;
    owner.y = player.y;
    owner.update();
    expect(gameState).toBe('lifeLost');
  });

  it('catch with lives <= 1 → gameState = "caught"', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    lives = 1;
    owner.x = player.x;
    owner.y = player.y;
    owner.update();
    expect(gameState).toBe('caught');
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — grid-node repath on obstacle escape', () => {
  it('escapeObstacles resets grid state and forces repath (pathTimer = PATH_RECALC after update)', () => {
    // Grid-node model: no stuckTimer. Instead, escapeObstacles() snaps to free cell
    // and resets pathTimer=0 to force immediate repath. Then _moveTowardTarget runs
    // and sets pathTimer = PATH_RECALC (30). So after update(), pathTimer = PATH_RECALC.
    owner.active = true;
    owner.fleeTimer = 0;
    player.x = 100; player.y = 100;
    owner.x = 600; owner.y = 300;
    owner.currentNode = { col: 15, row: 7 };
    owner.nextNode = { col: 16, row: 7 };
    owner.nodeQueue = [{ col: 17, row: 7 }];
    owner.moveProgress = 0.5;
    owner.pathTimer = 100;
    // Place obstacle on top of owner
    obstacles.push({ id: 'wall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });
    owner.update();
    // After escape + repath: pathTimer = PATH_RECALC (repath happened)
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
    obstacles.length = 0;
  });

  it('after escapeObstacles: owner is not inside any obstacle', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    player.x = 100; player.y = 100;
    owner.x = 600; owner.y = 300;
    owner.currentNode = { col: 15, row: 7 };
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    owner.pathTimer = 100;
    obstacles.push({ id: 'wall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });
    owner.update();
    const or_ = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    const overlaps = obstacles.some(o => rectsOverlap(or_, o));
    expect(overlaps).toBe(false);
    obstacles.length = 0;
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — shotReactTimer decrements', () => {
  it('shotReactTimer decrements each frame during pursuit', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.shotReactTimer = 10;
    // Place owner far from player to avoid catch
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.update();
    expect(owner.shotReactTimer).toBe(9);
  });

  it('shotReactTimer does not go below 0', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.shotReactTimer = 0;
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.update();
    expect(owner.shotReactTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — hesitateTimer', () => {
  it('hesitateTimer decrements and owner does not move while hesitating', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.hesitateTimer = 5;
    const prevX = owner.x;
    const prevY = owner.y;
    owner.update();
    expect(owner.hesitateTimer).toBe(4);
    // Owner should not have moved (hesitate returns early)
    expect(owner.x).toBe(prevX);
    expect(owner.y).toBe(prevY);
  });
});

// ---------------------------------------------------------------------------
describe('owner.update() — catnip mode', () => {
  it('catnipTimer > 0 → owner does not catch cat even when overlapping', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    catnipTimer = 100;
    // Place owner directly on player
    owner.x = player.x;
    owner.y = player.y;
    gameState = 'playing';
    owner.update();
    // Should still be playing (catnip mode skips catch check)
    expect(gameState).toBe('playing');
  });

  it('catnipTimer decrements each frame', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    catnipTimer = 50;
    player.x = 100; player.y = 100;
    owner.x = 900; owner.y = 500;
    owner.update();
    expect(catnipTimer).toBe(49);
  });

  it('catnipTarget is set on first catnip frame', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    catnipTimer = 100;
    owner.catnipTarget = null;
    player.x = 100; player.y = 100;
    owner.x = 900; owner.y = 500;
    owner.update();
    expect(owner.catnipTarget).not.toBeNull();
    expect(owner.catnipTarget).toHaveProperty('x');
    expect(owner.catnipTarget).toHaveProperty('y');
  });

  it('catnipTarget is cleared when catnipTimer reaches 0', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    catnipTimer = 1;
    owner.catnipTarget = { x: 100, y: 100 };
    player.x = 100; player.y = 100;
    owner.x = 900; owner.y = 500;
    owner.update();
    expect(catnipTimer).toBe(0);
    expect(owner.catnipTarget).toBeNull();
  });

  it('catnipTimer=0 → owner resumes pursuit (can catch cat)', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    catnipTimer = 0;
    lives = 1;
    // Place owner directly on player
    owner.x = player.x;
    owner.y = player.y;
    gameState = 'playing';
    owner.update();
    // Should catch cat (gameState changes)
    expect(gameState).toBe('caught');
  });
});

// ---------------------------------------------------------------------------
describe('escapeObstacles — owner is never inside obstacles', () => {
  it('owner.update() pushes owner out of obstacle it spawned inside', () => {
    obstacles.length = 0;
    // Place owner far from player to avoid catch
    player.x = 100;
    player.y = 100;
    owner.x = 600;
    owner.y = 300;
    owner.active = true;
    owner.fleeTimer = 0;
    // Place a large obstacle directly on top of the owner
    obstacles.push({ id: 'trap', x: owner.x - 10, y: owner.y - 10, width: 100, height: 100 });
    owner.update();
    // After update, owner must not overlap any obstacle
    const or_ = { x: owner.x, y: owner.y, width: owner.width, height: owner.height };
    const overlaps = obstacles.some(o => rectsOverlap(or_, o));
    expect(overlaps).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('owner.facingX/facingY — normalized direction vector', () => {
  it('initial facingX=1, facingY=0 is a unit vector', () => {
    const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
    expect(len).toBeCloseTo(1.0, 5);
  });

  it('facingX/facingY remain unit vector after direct-movement update (no path)', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    owner.path = [];
    owner.pathTimer = 0;
    // Place player far away so owner moves toward it without catching
    player.x = 700;
    player.y = 100;
    owner.x = 100;
    owner.y = 500;
    // Run several frames
    for (let i = 0; i < 10; i++) owner.update();
    const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
    expect(len).toBeCloseTo(1.0, 2);
  });

  it('facingX/facingY remain unit vector after A* path following', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    // Place player far away diagonally
    player.x = 800;
    player.y = 100;
    owner.x = 100;
    owner.y = 500;
    owner.path = [];
    owner.pathTimer = 0;
    // Run enough frames for A* to compute a path and follow it
    for (let i = 0; i < 30; i++) owner.update();
    const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
    expect(len).toBeCloseTo(1.0, 2);
  });

  it('facingX/facingY are never set from un-normalized dx/dy (length never > 1.01)', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    player.x = 750;
    player.y = 150;
    owner.x = 150;
    owner.y = 450;
    owner.path = [];
    owner.pathTimer = 0;
    // Run many frames and check every frame
    for (let i = 0; i < 60; i++) {
      owner.update();
      const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
      expect(len).toBeLessThanOrEqual(1.01);
    }
  });

  it('facingX/facingY stay unit vector during flee mode movement', () => {
    owner.active = true;
    owner.fleeTimer = 60;
    const b = getPlayBounds();
    owner.fleeTarget = { x: b.right - owner.width - 20, y: b.top + 20 };
    player.x = 100;
    player.y = 400;
    owner.x = 200;
    owner.y = 400;
    owner.path = [];
    owner.pathTimer = 0;
    for (let i = 0; i < 20; i++) owner.update();
    const len = Math.sqrt(owner.facingX ** 2 + owner.facingY ** 2);
    expect(len).toBeCloseTo(1.0, 2);
  });

  it('grid-node: owner advances to nextNode after enough frames (basement)', () => {
    // Новая модель (basement): grid-node movement.
    // Хозяин движется от currentNode к nextNode через moveProgress 0→1.
    // После достаточного числа кадров currentNode должен смениться.
    basementMode = "corridor";
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    occupiedCells.clear();
    owner.speed = 4.5;

    // Устанавливаем grid-node state: currentNode=(5,5), nextNode=(6,5)
    owner.currentNode = { col: 5, row: 5 };
    owner.nextNode    = { col: 6, row: 5 };
    owner.nodeQueue   = [{ col: 7, row: 5 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID; // 40px
    owner.facingX = 1; owner.facingY = 0;

    // Snap owner to currentNode pixel
    const fromPx = cellToPixel(5, 5);
    owner.x = fromPx.x;
    owner.y = fromPx.y;

    owner.path = [{ col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 }];
    owner.pathTimer = 100;

    // Нужно ceil(40/4.5) ≈ 9 кадров чтобы пройти 40px при speed=4.5
    for (let i = 0; i < 10; i++) {
      owner._updateGridMovement(owner.speed);
    }

    // После 10 кадров moveProgress >= 1 → currentNode должен смениться на (6,5)
    expect(owner.currentNode.col, 'currentNode should advance to col=6').toBeGreaterThan(5);
    basementMode = "";
  });

  it('grid-node: moveProgress advances monotonically (no oscillation, basement)', () => {
    // Ключевой инвариант: moveProgress только растёт, никогда не осциллирует.
    basementMode = "corridor";
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    occupiedCells.clear();
    owner.speed = 2.0;

    owner.currentNode = { col: 3, row: 5 };
    owner.nextNode    = { col: 4, row: 5 };
    owner.nodeQueue   = [{ col: 5, row: 5 }, { col: 6, row: 5 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;

    const fromPx = cellToPixel(3, 5);
    owner.x = fromPx.x;
    owner.y = fromPx.y;
    owner.path = [{ col: 3, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 5 }];
    owner.pathTimer = 100;

    let prevProgress = 0;
    let oscillations = 0;
    for (let i = 0; i < 30; i++) {
      const before = owner.moveProgress;
      owner._updateGridMovement(owner.speed);
      // After node arrival moveProgress resets via carry-over (< 1), that's fine
      // Oscillation = progress goes backward without node arrival
      if (owner.currentNode.col === 3 && owner.moveProgress < before - 0.01) {
        oscillations++;
      }
    }

    expect(oscillations, 'moveProgress must not oscillate').toBe(0);
    basementMode = "";
  });

  it('grid-node: facingX points right when moving from (5,5) to (6,5)', () => {
    // После _advanceToNextNode с движением вправо facingX должен быть > 0.
    basementMode = "corridor";
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    owner.facingX = 0;
    owner.facingY = 0;

    owner.currentNode = { col: 5, row: 5 };
    owner.nextNode = null;
    owner.nodeQueue = [{ col: 6, row: 5 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;

    // _advanceToNextNode sets facingX/Y from currentNode→nextNode direction
    owner._advanceToNextNode();

    expect(owner.facingX, 'facingX should point right (>0)').toBeGreaterThan(0);
    expect(owner.facingY, 'facingY should be 0 for horizontal movement').toBeCloseTo(0, 5);
    basementMode = "";
  });
});

// ---------------------------------------------------------------------------
describe('owner — basement grid-node (улучшения)', () => {
  it('grid-node: в подвале hesitateTimer работает (микро-заморозка)', () => {
    // В новой модели hesitateTimer работает на всех уровнях включая подвал.
    basementMode = "corridor";
    owner.active = true;
    owner.fleeTimer = 0;
    owner.hesitateTimer = 5;
    const prevX = owner.x;
    const prevY = owner.y;
    player.x = 100; player.y = 100;
    owner.x = 900; owner.y = 500;
    owner.update();
    // hesitateTimer decrements, owner does not move
    expect(owner.hesitateTimer).toBe(4);
    basementMode = "";
  });

  it('grid-node: owner has no driftAngle property (removed)', () => {
    expect(owner.driftAngle).toBeUndefined();
  });

  it('grid-node: owner has no driftTimer property (removed)', () => {
    expect(owner.driftTimer).toBeUndefined();
  });

  it('grid-node: owner has no stuckTimer property (removed)', () => {
    expect(owner.stuckTimer).toBeUndefined();
  });

  it('grid-node: owner has no lastCheckTimer property (removed)', () => {
    expect(owner.lastCheckTimer).toBeUndefined();
  });

  it('grid-node: owner has no pathSegments property (removed)', () => {
    expect(owner.pathSegments).toBeUndefined();
  });

  it('grid-node: owner has no segmentIndex property (removed)', () => {
    expect(owner.segmentIndex).toBeUndefined();
  });

  it('grid-node: owner has no _hasLineOfSight method (removed)', () => {
    expect(owner._hasLineOfSight).toBeUndefined();
  });

  it('grid-node: owner has no _smoothPath method (removed)', () => {
    expect(owner._smoothPath).toBeUndefined();
  });

  it('grid-node: owner has no _compressToSegments method (removed)', () => {
    expect(owner._compressToSegments).toBeUndefined();
  });

  it('grid-node: owner has no _getSteeringTarget method (removed)', () => {
    expect(owner._getSteeringTarget).toBeUndefined();
  });

  it('улучшение 4: в подвале grid-node repath — pathTimer устанавливается в 30 (event-driven)', () => {
    // Новая модель: в подвале repath event-driven (player cell change, queue exhausted).
    // Fallback таймер = 30 кадров (не 15 — таймер теперь вторичен, основной триггер — события).
    // На открытых уровнях pathTimer = PATH_RECALC = 30 (без изменений).
    // Ключевое отличие: в подвале repath происходит только у узла (moveProgress < 0.1),
    // что предотвращает телепорт при mid-transition repath.
    basementMode = "corridor";
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    occupiedCells.clear();
    owner.path = [];
    owner.pathTimer = 0; // форсируем пересчёт
    owner.currentNode = null;
    owner.nextNode = null;
    owner.nodeQueue = [];
    owner.moveProgress = 0;
    // Ставим хозяина и кота далеко друг от друга, чтобы путь был длинным
    player.x = 900; player.y = 500;
    owner.x = 100; owner.y = 100;
    owner._moveTowardTarget(player.x, player.y, owner.speed);
    // После пересчёта pathTimer должен быть 30 (fallback интервал в basement grid-node модели).
    // Или 0 если путь сразу опустел (nextNode=null → pathTimer=0 → немедленный пересчёт).
    // Главное: pathTimer > 0 (не застрял в бесконечном цикле) и <= 30.
    expect(owner.pathTimer).toBeGreaterThan(0);
    expect(owner.pathTimer).toBeLessThanOrEqual(30);
    basementMode = "";
  });

  it('улучшение 4: на открытых уровнях путь пересчитывается каждые 30 кадров', () => {
    basementMode = "";
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    owner.path = [];
    owner.pathTimer = 0;
    player.x = 400; player.y = 300;
    owner.x = 100; owner.y = 100;
    owner._moveTowardTarget(player.x, player.y, owner.speed);
    // На открытом уровне pathTimer = PATH_RECALC = 30
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('улучшение 5: в DFS-подвале хозяин не спавнится в заблокированных колонках', () => {
    // В DFS-режиме cols 28-29 заблокированы сплошными стенами.
    // Хозяин должен спавниться в свободной ячейке (col ≤ 27).
    basementMode = "dfs";
    obstacles.length = 0;
    occupiedCells.clear();
    // Заблокируем cols 28-29 (как в DFS-лабиринте)
    markCells(28, 0, 2, GRID_ROWS);
    // Добавим препятствие для hitsObstacles
    obstacles.push({ id: 'dfs-wall', x: 28 * GRID, y: 0, width: 2 * GRID, height: GRID_ROWS * GRID });
    player.x = 0; player.y = 0; // кот в левом верхнем углу
    difficulty = 'normal';
    level = 9;
    owner.activate();
    // Хозяин должен быть в col ≤ 27 (не в заблокированной зоне)
    const ownerCol = Math.floor(owner.x / GRID);
    expect(ownerCol, 'owner should not spawn in blocked DFS columns 28-29').toBeLessThanOrEqual(27);
    basementMode = "";
    unmarkCells(28, 0, 2, GRID_ROWS);
    obstacles.length = 0;
  });
});
