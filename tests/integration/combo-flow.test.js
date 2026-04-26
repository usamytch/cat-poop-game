// ==========================================
// integration/combo-flow.test.js
// Full combo flow: 3 hits → flee → cleanup
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from '../setup.js';

beforeAll(() => {
  loadGame();
});

function resetForCombo() {
  obstacles.length = 0;
  poops.length = 0;
  comboCount = 0;
  comboTimer = 0;
  comboPopups.length = 0;
  score = 0;
  difficulty = 'normal';
  player.x = 100;
  player.y = 300;
  player.urge = 50;
  // Use real sizes from entities — do not hardcode
  owner.x = 800;
  owner.y = 300;
  owner.active = true;
  owner.facePoops = [];
  owner.poopHits = 0;
  owner.fleeTimer = 0;
  owner.fleeTarget = null;
  owner.stuckTimer = 0;
  owner.stuckNudge = null;
  owner.lastX = owner.x;
  owner.lastY = owner.y;
  yarnFreezeTimer = 0;
  lives = 3;
  gameState = 'playing';
}

function hitOwner() {
  poops.push({
    x: owner.x + owner.width / 2,
    y: owner.y + owner.height / 2,
    dx: 0, dy: 0, r: 10, alive: true, trail: [],
  });
  updatePoops();
}

beforeEach(resetForCombo);

// ---------------------------------------------------------------------------
describe('Full combo flow', () => {
  it('1st hit: comboCount=1, facePoops.length=1, poopHits=1, HIT popup', () => {
    hitOwner();
    expect(comboCount).toBe(1);
    expect(owner.facePoops.length).toBe(1);
    expect(owner.poopHits).toBe(1);
    const hitPopup = comboPopups.find(p => p.text.includes('HIT'));
    expect(hitPopup).toBeDefined();
  });

  it('2nd hit: comboCount=2, facePoops.length=2, poopHits=2, HIT popup', () => {
    hitOwner();
    hitOwner();
    expect(comboCount).toBe(2);
    expect(owner.facePoops.length).toBe(2);
    expect(owner.poopHits).toBe(2);
    const hitPopups = comboPopups.filter(p => p.text.includes('HIT'));
    expect(hitPopups.length).toBeGreaterThanOrEqual(1);
  });

  it('3rd hit: comboCount=0 (reset), facePoops.length=3, poopHits=3, COMBO popup, fleeTimer=300', () => {
    hitOwner();
    hitOwner();
    hitOwner();
    expect(comboCount).toBe(0);
    expect(owner.facePoops.length).toBe(3);
    expect(owner.poopHits).toBe(3);
    expect(owner.fleeTimer).toBe(300);
    const comboPopup = comboPopups.find(p => p.text.includes('COMBO'));
    expect(comboPopup).toBeDefined();
  });

  it('while fleeTimer > 0: facePoops still visible (length=3)', () => {
    hitOwner();
    hitOwner();
    hitOwner();
    // fleeTimer = 300, facePoops should still be there
    expect(owner.fleeTimer).toBeGreaterThan(0);
    expect(owner.facePoops.length).toBe(3);
  });

  it('after fleeTimer expires (300 ticks): facePoops=[], poopHits=0', () => {
    hitOwner();
    hitOwner();
    hitOwner();
    expect(owner.fleeTimer).toBe(300);

    // Move player far away to avoid catch during flee
    player.x = 100;
    player.y = 100;
    owner.x = 900;
    owner.y = 500;
    owner.fleeTarget = { x: owner.x, y: owner.y };

    // Tick down fleeTimer to 0
    for (let i = 0; i < 300; i++) {
      owner.update();
    }
    // Now fleeTimer = 0; next update triggers cleanup
    owner.update();
    expect(owner.facePoops).toEqual([]);
    expect(owner.poopHits).toBe(0);
  });

  it('miss between hits resets comboCount to 0', () => {
    hitOwner(); // comboCount = 1
    // Miss: poop goes out of bounds
    comboCount = 1;
    poops.push({ x: -500, y: 300, dx: -7, dy: 0, r: 10, alive: true, trail: [] });
    updatePoops();
    expect(comboCount).toBe(0);
  });

  it('poop hitting obstacle resets comboCount to 0', () => {
    hitOwner(); // comboCount = 1
    obstacles.push({ id: 'wall', x: 195, y: 195, width: 60, height: 60 });
    poops.push({ x: 200, y: 200, dx: 0, dy: 0, r: 10, alive: true, trail: [] });
    updatePoops();
    expect(comboCount).toBe(0);
  });
});
