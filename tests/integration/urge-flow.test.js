// ==========================================
// integration/urge-flow.test.js
// Urge growth, shooting reduction, pill, accident, panic
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from '../setup.js';

beforeAll(() => {
  loadGame();
});

function resetUrge() {
  obstacles.length = 0;
  poops.length = 0;
  comboCount = 0;
  comboTimer = 0;
  comboPopups.length = 0;
  score = 0;
  level = 1;
  difficulty = 'normal';
  lives = 3;
  gameState = 'playing';
  player.x = 100;
  player.y = 300;
  player.urge = 0;
  // Use real sizes from entities — do not hardcode
  player.speed = 3.9;
  player.pooping = false;
  player.poopTimer = 0;
  owner.active = false;
  owner.fleeTimer = 0;
  owner.facePoops = [];
  owner.poopHits = 0;
  // Use real owner sizes from entities — do not hardcode
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
  // Place litter box far away
  litterBox.x = 900;
  litterBox.y = 400;
}

beforeEach(resetUrge);

// ---------------------------------------------------------------------------
describe('Urge growth without shooting', () => {
  it('urge grows by urgeRate/60 per frame (level 1)', () => {
    player.urge = 0;
    const expectedPerFrame = DIFF.normal.urgeRate / 60 * (1 + (1 - 1) * 0.08);
    player.update();
    expect(player.urge).toBeCloseTo(expectedPerFrame, 5);
  });

  it('urge grows correctly over N frames', () => {
    player.urge = 0;
    const N = 10;
    const expectedPerFrame = DIFF.normal.urgeRate / 60;
    for (let i = 0; i < N; i++) {
      player.update();
    }
    expect(player.urge).toBeCloseTo(expectedPerFrame * N, 3);
  });
});

// ---------------------------------------------------------------------------
describe('Urge reduction on hit', () => {
  it('hitting owner reduces urge by hitUrgeReduce', () => {
    player.urge = 50;
    owner.active = true;
    owner.x = 800;
    owner.y = 300;
    // Use real owner sizes from entities
    poops.push({
      x: owner.x + owner.width / 2,
      y: owner.y + owner.height / 2,
      dx: 0, dy: 0, r: 10, alive: true, trail: [],
    });
    updatePoops();
    expect(player.urge).toBeCloseTo(50 - DIFF.normal.hitUrgeReduce);
  });

  it('urge cannot go below 0 from hit', () => {
    player.urge = 0;
    owner.active = true;
    owner.x = 800;
    owner.y = 300;
    // Use real owner sizes from entities
    poops.push({
      x: owner.x + owner.width / 2,
      y: owner.y + owner.height / 2,
      dx: 0, dy: 0, r: 10, alive: true, trail: [],
    });
    updatePoops();
    expect(player.urge).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
describe('Pill bonus reduces urge', () => {
  it('pill reduces urge to urge * 0.7', () => {
    player.urge = 60;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(42);
  });

  it('pill on urge=0 stays 0', () => {
    player.urge = 0;
    applyBonus('pill');
    expect(player.urge).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('Accident when urge >= 100', () => {
  it('urge reaching maxUrge triggers accident state change', () => {
    player.urge = player.maxUrge - 0.001;
    lives = 3;
    player.update();
    expect(['lifeLost', 'accident']).toContain(gameState);
  });

  it('accident with lives > 1 → lifeLost', () => {
    player.urge = player.maxUrge - 0.001;
    lives = 2;
    player.update();
    expect(gameState).toBe('lifeLost');
    expect(lifeLostReason).toBe('accident');
  });

  it('accident with lives = 1 → accident state', () => {
    player.urge = player.maxUrge - 0.001;
    lives = 1;
    player.update();
    expect(gameState).toBe('accident');
  });
});

// ---------------------------------------------------------------------------
describe('Panic mode', () => {
  it('panicShake > 0 when urge > 75% of maxUrge', () => {
    player.urge = player.maxUrge * 0.8;
    player.update();
    expect(panicShake).toBeGreaterThan(0);
  });

  it('panicShake = 0 when urge <= 75% of maxUrge', () => {
    player.urge = player.maxUrge * 0.5;
    panicShake = 5;
    player.update();
    expect(panicShake).toBe(0);
  });

  it('panicShake scales with urge ratio above 0.75', () => {
    player.urge = player.maxUrge * 0.9;
    player.update();
    const shake90 = panicShake;

    resetUrge();
    player.urge = player.maxUrge * 0.8;
    player.update();
    const shake80 = panicShake;

    expect(shake90).toBeGreaterThan(shake80);
  });
});
