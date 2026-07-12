// ==========================================
// integration/play-feel-regression.test.js
// Repeatable play-feel scenarios for core game loops.
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from '../setup.js';

beforeAll(() => {
  loadGame();
});

function resetPlayFeel() {
  globalSeed = 0;
  obstacles.length = 0;
  occupiedCells.clear();
  poops.length = 0;
  comboPopups.length = 0;
  bonuses.length = 0;
  score = 0;
  level = 3;
  lives = 3;
  difficulty = 'normal';
  gameState = 'playing';
  basementMode = '';

  player.x = 100;
  player.y = 300;
  player.urge = 0;
  player.speed = 3.9;
  player.pooping = false;
  player.poopTimer = 0;

  owner.x = 800;
  owner.y = 300;
  owner.active = true;
  owner.speed = 2.0;
  owner.fleeTimer = 0;
  owner.fleeTarget = null;
  owner.poopHits = 0;
  owner.facePoops = [];
  owner.hesitateTimer = 0;
  owner.shotReactTimer = 0;
  owner.awarenessState = 'guard';
  owner.lastKnownTarget = null;
  owner.heardTarget = null;
  owner.memoryTimer = 0;
  owner.searchTimer = 0;
  owner.heardTimer = 0;
  owner.hitReactTimer = 0;
  owner.hitReactStage = 0;
  owner.path = [];
  owner.pathTimer = 0;
  owner.currentNode = null;
  owner.nextNode = null;
  owner.moveProgress = 0;
  owner.segmentLength = GRID;
  owner.nodeQueue = [];
  owner.lastRepathGoalCell = null;
  owner.facingX = 1;
  owner.facingY = 0;

  comboCount = 0;
  comboTimer = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  catnipTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  poopProgress = 0;
  isPooping = false;

  litterBox.x = 900;
  litterBox.y = 400;
  litterBox.width = 92;
  litterBox.height = 62;
}

function hitOwner() {
  poops.push({
    x: owner.x + owner.width / 2,
    y: owner.y + owner.height / 2,
    dx: 0,
    dy: 0,
    r: 10,
    alive: true,
    trail: [],
  });
  updatePoops();
}

beforeEach(resetPlayFeel);

describe('play-feel regression scenarios', () => {
  it('open-level chase makes steady progress without excessive facing churn', () => {
    owner.x = 80;
    owner.y = 80;
    owner.speed = 2.1;
    player.x = 620;
    player.y = 320;

    const startX = owner.x;
    const startY = owner.y;
    let facingChanges = 0;
    let prevFacingX = owner.facingX;
    let prevFacingY = owner.facingY;

    for (let frame = 0; frame < 240; frame++) {
      player.x = 620 + Math.sin(frame * 0.05) * 70;
      player.y = 320 + Math.cos(frame * 0.05) * 50;

      owner._moveTowardTarget(player.x, player.y, owner.speed);

      const dx = Math.abs(owner.facingX - prevFacingX);
      const dy = Math.abs(owner.facingY - prevFacingY);
      if (dx > 0.3 || dy > 0.3) {
        facingChanges++;
        prevFacingX = owner.facingX;
        prevFacingY = owner.facingY;
      }
    }

    const netDx = owner.x - startX;
    const netDy = owner.y - startY;
    expect(netDx * netDx + netDy * netDy).toBeGreaterThan(140 * 140);
    expect(facingChanges).toBeLessThan(20);
  });

  it('basement horizontal corridor movement stays on axis and progresses', () => {
    basementMode = 'corridor';
    owner.currentNode = { col: 2, row: 6 };
    owner.nextNode = { col: 3, row: 6 };
    owner.nodeQueue = [{ col: 4, row: 6 }, { col: 5, row: 6 }];
    owner.moveProgress = 0;
    owner.segmentLength = GRID;
    owner.pathTimer = 100;

    const startPx = cellToPixel(2, 6);
    owner.x = startPx.x;
    owner.y = startPx.y;

    let previousProgress = owner.moveProgress;
    for (let frame = 0; frame < 6; frame++) {
      owner._updateGridMovement(2);
      expect(owner.moveProgress).toBeGreaterThan(previousProgress);
      previousProgress = owner.moveProgress;
      expect(owner.y).toBeCloseTo(startPx.y, 5);
    }

    expect(owner.x).toBeGreaterThan(startPx.x);
  });

  it('panic pressure has a stronger shake near failure than at panic threshold', () => {
    player.urge = player.maxUrge * 0.8;
    player.update();
    const shake80 = panicShake;

    panicShake = 0;
    player.urge = player.maxUrge * 0.95;
    player.update();
    const shake95 = panicShake;

    expect(shake80).toBeGreaterThan(0);
    expect(shake95).toBeGreaterThan(shake80);
    expect(gameState).toBe('playing');
  });

  it('three-hit combo forces owner flee and cleanup after flee expires', () => {
    player.urge = 50;
    owner.x = 850;
    owner.y = 320;

    hitOwner();
    hitOwner();
    hitOwner();

    expect(comboCount).toBe(0);
    const fleeDuration = owner.fleeTimer;
    expect(fleeDuration).toBeGreaterThanOrEqual(DIFF.normal.comboFleeMin);
    expect(fleeDuration).toBeLessThanOrEqual(DIFF.normal.comboFleeMax);
    expect(owner.facePoops).toHaveLength(3);
    expect(comboPopups.some(p => p.text.includes('COMBO'))).toBe(true);

    player.x = 80;
    player.y = 80;
    owner.x = 900;
    owner.y = 500;
    owner.fleeTarget = { x: owner.x, y: owner.y };

    for (let frame = 0; frame < fleeDuration; frame++) {
      owner.update();
    }
    owner.update();

    expect(owner.fleeTimer).toBe(0);
    expect(owner.facePoops).toEqual([]);
    expect(owner.poopHits).toBe(0);
  });
});
