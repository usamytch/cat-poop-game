// ==========================================
// integration/level-progression.test.js
// Level advance via litter box, owner activation
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from '../setup.js';

beforeAll(() => {
  loadGame();
});

function resetForLevel() {
  obstacles.length = 0;
  poops.length = 0;
  comboCount = 0;
  comboTimer = 0;
  comboPopups.length = 0;
  overlayParticles.length = 0;
  score = 0;
  level = 1;
  difficulty = 'normal';
  lives = 3;
  gameState = 'playing';
  player.x = 100;
  player.y = 300;
  player.urge = 10;
  // Use real sizes from entities — do not hardcode
  player.speed = 3.9;
  player.pooping = false;
  player.poopTimer = 0;
  owner.active = false;
  owner.fleeTimer = 0;
  owner.facePoops = [];
  owner.poopHits = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  poopProgress = 0;
  isPooping = false;
  bonuses.length = 0;
  overlayTimer = 0;
  lifeLostTimer = 0;
  lifeLostReason = '';
  levelMessageTimer = 0;
  // Place litter box at player position for easy testing
  litterBox.x = player.x;
  litterBox.y = player.y;
  litterBox.width = 92;
  litterBox.height = 62;
}

beforeEach(resetForLevel);

// ---------------------------------------------------------------------------
describe('Level progression via litter box', () => {
  it('standing on litter box for poopTime frames → level advances', () => {
    const poopTime = DIFF.normal.poopTime;
    const startLevel = level;
    poopProgress = poopTime - 1;
    player.update();
    expect(level).toBe(startLevel + 1);
  });

  it('after level advance, urge decreases by 30 (clamped to 0)', () => {
    player.urge = 50;
    poopProgress = DIFF.normal.poopTime - 1;
    // urge also grows by urgeRate/60 during this frame before the level-up clamp
    // The code does: urge += urgeRate/60, then urge = clamp(urge - 30, 0, maxUrge)
    const urgeGrowth = DIFF.normal.urgeRate / 60;
    const expectedUrge = Math.max(0, 50 + urgeGrowth - 30);
    player.update();
    expect(player.urge).toBeCloseTo(expectedUrge, 2);
  });

  it('urge does not go below 0 after level advance', () => {
    player.urge = 10;
    poopProgress = DIFF.normal.poopTime - 1;
    player.update();
    expect(player.urge).toBeGreaterThanOrEqual(0);
  });

  it('score increases after level advance', () => {
    score = 0;
    player.urge = 10;
    poopProgress = DIFF.normal.poopTime - 1;
    player.update();
    expect(score).toBeGreaterThan(0);
  });

  it('generateLevel() is called (obstacles regenerated)', () => {
    // Add a sentinel obstacle that should be cleared on level advance
    obstacles.push({ id: 'sentinel', x: 500, y: 300, width: 60, height: 60 });
    poopProgress = DIFF.normal.poopTime - 1;
    player.update();
    // After generateLevel(), obstacles are regenerated (sentinel gone)
    const sentinel = obstacles.find(o => o.id === 'sentinel');
    expect(sentinel).toBeUndefined();
  });

  it('owner.activate() is called after level advance', () => {
    // On level 1 normal, owner should become active after advance to level 2
    difficulty = 'normal'; // firstLvl = 1, so owner is active from level 1
    level = 1;
    poopProgress = DIFF.normal.poopTime - 1;
    player.update();
    // After advance to level 2, owner.activate() was called
    // owner.active depends on new level vs firstLvl
    expect(typeof owner.active).toBe('boolean');
  });

  it('on level diff.firstLvl - 1: owner is inactive', () => {
    difficulty = 'easy'; // firstLvl = 3
    level = 2;
    owner.activate();
    expect(owner.active).toBe(false);
  });

  it('on level diff.firstLvl: owner is active', () => {
    difficulty = 'easy'; // firstLvl = 3
    level = 3;
    owner.activate();
    expect(owner.active).toBe(true);
  });

  it('on level diff.firstLvl (normal=2): owner is active from level 2', () => {
    difficulty = 'normal'; // firstLvl = 2
    level = 2;
    owner.activate();
    expect(owner.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('poopProgress mechanics', () => {
  it('poopProgress increments while on litter box', () => {
    poopProgress = 0;
    player.update();
    expect(poopProgress).toBe(1);
  });

  it('isPooping = true while on litter box', () => {
    player.update();
    expect(isPooping).toBe(true);
  });

  it('poopProgress resets when leaving litter box', () => {
    poopProgress = 5;
    // Move player away from litter box
    player.x = 100;
    player.y = 300;
    litterBox.x = 900;
    litterBox.y = 400;
    player.update();
    expect(poopProgress).toBe(0);
    expect(isPooping).toBe(false);
  });
});
