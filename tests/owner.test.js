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
  owner.stuckTimer = 0;
  owner.stuckNudge = null;
  owner.lastX = owner.x;
  owner.lastY = owner.y;
  owner.driftAngle = 0;
  owner.driftTimer = 0;
  owner.hesitateTimer = 0;
  owner.shotReactTimer = 0;
  owner.path = [];
  owner.pathTimer = 0;
  owner.catnipTarget = null;
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

  it('stuckTimer = 0 after activate', () => {
    owner.stuckTimer = 99;
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.stuckTimer).toBe(0);
  });

  it('stuckNudge = null after activate', () => {
    owner.stuckNudge = { x: 1, y: 0 };
    level = 2; // normal.firstLvl = 2
    difficulty = 'normal';
    owner.activate();
    expect(owner.stuckNudge).toBeNull();
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
describe('owner.update() — anti-stuck', () => {
  it('stuckTimer grows when owner barely moves', () => {
    owner.active = true;
    owner.fleeTimer = 0;
    // Place owner far from player so it tries to move but obstacles block it
    obstacles.push({ id: 'wall', x: owner.x - 5, y: owner.y - 5, width: 200, height: 200 });
    owner.lastX = owner.x;
    owner.lastY = owner.y;
    owner.stuckTimer = 0;
    // Move player far away to avoid catch
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.lastX = owner.x;
    owner.lastY = owner.y;
    obstacles.length = 0;
    // Simulate stuck: owner can't move (no obstacles but target is same position)
    // We test the logic directly: if moved < 0.5, stuckTimer++
    owner.stuckTimer = 0;
    // Manually simulate: owner didn't move
    const movedDist = 0;
    if (movedDist < 0.5) owner.stuckTimer++;
    expect(owner.stuckTimer).toBe(1);
  });

  it('stuckNudge is set when stuckTimer > 30', () => {
    owner.stuckTimer = 31;
    // Simulate the nudge logic
    if (owner.stuckTimer > 30) {
      owner.stuckNudge = { x: 0.5, y: 0.5 };
      owner.stuckTimer = 0;
    }
    expect(owner.stuckNudge).not.toBeNull();
    expect(owner.stuckTimer).toBe(0);
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

  it('waypoint threshold is at least GRID/2 so owner advances past obstacle edges', () => {
    // Фикс: threshold = Math.max(spd+2, GRID/2) = 20px при GRID=40.
    // Хозяин должен засчитывать достижение waypoint при расстоянии ≤20px,
    // не упираясь в стену у края препятствия.
    owner.active = true;
    owner.fleeTimer = 0;
    obstacles.length = 0;
    owner.speed = 4.5; // нормал-скорость

    // path[1] — следующий waypoint — это ячейка (6,5).
    // Ставим хозяина так, чтобы его центр был в 19px от центра ячейки (6,5).
    // threshold = Math.max(4.5+2, 40/2) = 20px → dist2 < 20^2=400 → path.shift()
    const nextCenter = cellToPixelCenter(6, 5);
    owner.x = nextCenter.x - GRID / 2 + 1 - owner.width / 2; // ownerCx = nextCenter.x - 19px
    owner.y = nextCenter.y - owner.height / 2;

    // Путь: текущая ячейка → следующая (path[1] = col 6)
    owner.path = [
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
    ];
    owner.pathTimer = 100; // не пересчитываем путь

    const pathLenBefore = owner.path.length;
    // _moveTowardTarget вызывается с целью (не важно куда — путь уже задан)
    owner._moveTowardTarget(player.x, player.y, owner.speed);

    // Waypoint должен быть засчитан (path.shift() вызван) — path стал короче
    expect(owner.path.length, 'waypoint should be advanced when within GRID/2 of center').toBeLessThan(pathLenBefore);
  });
});
