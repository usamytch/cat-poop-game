// ==========================================
// player.test.js — player object: urge, accident, litter box, panic, bonuses
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
describe('entity sizes — grid compatibility', () => {
  it('player.size = 36 (fits in 1 grid cell with margin)', () => {
    expect(player.size).toBe(36);
    expect(player.size).toBeLessThan(40); // GRID = 40
  });

  it('owner.width = 36 (fits in 1 grid cell with margin)', () => {
    expect(owner.width).toBe(36);
    expect(owner.width).toBeLessThan(40);
  });

  it('owner.height = 52', () => {
    expect(owner.height).toBe(52);
  });
});

// ---------------------------------------------------------------------------
describe('player.update() — urge growth', () => {
  it('urge grows each frame by urgeRate/60 * (1 + (level-1)*0.08)', () => {
    player.urge = 0;
    level = 1;
    difficulty = 'normal';
    // Move player away from litter box and owner
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    const expectedGrowth = DIFF.normal.urgeRate / 60 * (1 + (1 - 1) * 0.08);
    player.update();
    expect(player.urge).toBeCloseTo(expectedGrowth, 5);
  });

  it('urge does not exceed maxUrge (triggers accident instead)', () => {
    player.urge = player.maxUrge - 0.001;
    level = 1;
    difficulty = 'normal';
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    lives = 3;
    player.update();
    // After accident, urge is not checked (function returns early)
    // gameState should change
    expect(['lifeLost', 'accident']).toContain(gameState);
  });
});

// ---------------------------------------------------------------------------
describe('player.update() — accident', () => {
  function triggerAccident() {
    player.urge = player.maxUrge - 0.001;
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    player.update();
  }

  it('stats.totalAccidents increments', () => {
    const before = stats.totalAccidents;
    triggerAccident();
    expect(stats.totalAccidents).toBe(before + 1);
  });

  it('lives decrements', () => {
    lives = 3;
    triggerAccident();
    expect(lives).toBe(2);
  });

  it('lives <= 0 → gameState = "accident"', () => {
    lives = 1;
    triggerAccident();
    expect(gameState).toBe('accident');
  });

  it('lives > 0 → gameState = "lifeLost" with reason "accident"', () => {
    lives = 3;
    triggerAccident();
    expect(gameState).toBe('lifeLost');
    expect(lifeLostReason).toBe('accident');
  });
});

// ---------------------------------------------------------------------------
describe('player.update() — litter box', () => {
  function placePlayerOnLitter() {
    player.x = litterBox.x;
    player.y = litterBox.y;
    player.urge = 10; // not at max
    owner.active = false;
  }

  it('poopProgress grows while on litter box', () => {
    placePlayerOnLitter();
    poopProgress = 0;
    player.update();
    expect(poopProgress).toBe(1);
  });

  it('isPooping = true while on litter box', () => {
    placePlayerOnLitter();
    player.update();
    expect(isPooping).toBe(true);
  });

  it('poopProgress resets when leaving litter box', () => {
    poopProgress = 5;
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    player.urge = 10;
    owner.active = false;
    player.update();
    expect(poopProgress).toBe(0);
    expect(isPooping).toBe(false);
  });

  it('level advances when poopProgress >= poopTime', () => {
    placePlayerOnLitter();
    const startLevel = level;
    poopProgress = DIFF.normal.poopTime - 1;
    player.update();
    expect(level).toBe(startLevel + 1);
  });
});

// ---------------------------------------------------------------------------
describe('player.update() — panic', () => {
  it('panicShake > 0 when urge/maxUrge > 0.75', () => {
    player.urge = player.maxUrge * 0.8;
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    player.update();
    expect(panicShake).toBeGreaterThan(0);
  });

  it('panicShake = 0 when urge/maxUrge <= 0.75', () => {
    player.urge = player.maxUrge * 0.5;
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    panicShake = 5;
    player.update();
    expect(panicShake).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('player.update() — bonus pickup', () => {
  it('player overlapping bonus → applyBonus called and bonus.alive = false', () => {
    // Bonus rect: {x: bx-20, y: by-20, width:40, height:40}
    // Player rect: {x: player.x, y: player.y, width:36, height:36}
    // Place bonus center inside player rect so rects overlap
    const bx = player.x + 10;
    const by = player.y + 10;
    speedBoostTimer = 0;
    bonuses.push({ x: bx, y: by, type: 'fish', alive: true, pulse: 0 });
    player.urge = 10;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    player.update();
    expect(bonuses[0].alive).toBe(false);
    // applyBonus sets speedBoostTimer=300, then player.update() decrements it once → 299
    expect(speedBoostTimer).toBe(299);
  });
});

// ---------------------------------------------------------------------------
describe('escapeObstacles — player is never inside obstacles', () => {
  it('player.update() pushes player out of obstacle it spawned inside', () => {
    obstacles.length = 0;
    // Place a large obstacle directly on top of the player
    obstacles.push({ id: 'trap', x: player.x - 10, y: player.y - 10, width: 100, height: 100 });
    player.urge = 10;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.active = false;
    player.update();
    // After update, player must not overlap any obstacle
    const pr = { x: player.x, y: player.y, width: player.size, height: player.size };
    const overlaps = obstacles.some(o => rectsOverlap(pr, o));
    expect(overlaps).toBe(false);
  });
});
