// ==========================================
// location-rules.test.js — authored room rules + Dacha performance contract
// ==========================================

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  gameState = 'playing';
  difficulty = 'normal';
  owner.active = false;
  player.x = 100;
  player.y = 100;
});

afterEach(() => {
  delete globalThis.rebuildBgLayer;
  vi.restoreAllMocks();
});

function setLocation(key, lvl) {
  level = lvl;
  currentLocation = locationThemes.find(theme => theme.key === key);
  currentLevelProgression = getLevelProgression(level);
  locationRuleState.key = key;
  locationRuleState.actStep = currentLevelProgression.actStep;
}

function addDecor(kind, x = 80, y = 80, width = 160, height = 160) {
  decorItems.push({
    type: 'rug', drawStyle: 'rug', col: 2, row: 2, wCells: width / GRID, hCells: height / GRID,
    x, y, width, height, ruleKind: kind, ruleConsumed: false, ruleId: decorItems.length,
  });
  return decorItems[decorItems.length - 1];
}

function addObstacle(id, col, row, group) {
  const pos = cellToPixel(col, row);
  const obstacle = {
    id, type: 'barrel', col, row, wCells: 2, hCells: 2,
    x: pos.x, y: pos.y, width: GRID * 2, height: GRID * 2,
    moving: false, axis: 'x', range: 0, speed: 0, phase: 0,
  };
  if (group !== undefined) {
    obstacle.surrealRule = true;
    obstacle.surrealGroup = group;
    obstacle.ruleSolid = group === 0;
    obstacle.rulePendingSolid = false;
  }
  obstacles.push(obstacle);
  markCells(col, row, 2, 2);
  return obstacle;
}

describe('location rule catalog', () => {
  it('gives every location one title, hint and peak', () => {
    for (const theme of locationThemes) {
      expect(theme.rule.title.length, theme.key).toBeGreaterThan(0);
      expect(theme.rule.hint.length, theme.key).toBeGreaterThan(0);
      expect(theme.rule.peakTitle.length, theme.key).toBeGreaterThan(0);
    }
  });
});

describe('Hall and Bathroom movement rules', () => {
  it('Hall builds speed only while holding a straight line on a rug', () => {
    setLocation('hall', 1);
    addDecor('hallRug');

    let result;
    for (let i = 0; i < LOCATION_RULES.hall.chargeTicks; i++) {
      result = applyLocationPlayerMovementRule(player, 1, 0, player.speed);
    }
    expect(locationRuleState.hallCharge).toBeCloseTo(1);
    expect(result.stepX).toBeCloseTo(player.speed * LOCATION_RULES.hall.maxSpeedScale);

    result = applyLocationPlayerMovementRule(player, 0, 1, player.speed);
    expect(locationRuleState.hallCharge).toBeLessThan(0.5);
    expect(result.stepY).toBeLessThan(player.speed * 1.25);
  });

  it('Bathroom preserves momentum on wet tiles and a dry mat cancels it', () => {
    setLocation('bathroom', 6);
    addDecor('bathroomWet');

    for (let i = 0; i < 10; i++) applyLocationPlayerMovementRule(player, 1, 0, player.speed);
    const gliding = applyLocationPlayerMovementRule(player, 0, 0, player.speed);
    expect(gliding.stepX).toBeGreaterThan(0);
    expect(gliding.onWet).toBe(true);

    decorItems[0].ruleKind = 'bathroomDry';
    const stopped = applyLocationPlayerMovementRule(player, 0, 0, player.speed);
    expect(stopped.stepX).toBe(0);
    expect(locationRuleState.bathroomVX).toBe(0);
  });
});

describe('Kitchen and Street AI rules', () => {
  it('Kitchen food lures the owner only after line of sight is broken', () => {
    setLocation('kitchen', 11);
    const food = addDecor('kitchenFood');
    owner.active = true;
    owner.x = 800;
    owner.y = 100;
    addObstacle('screen', 10, 1);

    updateLocationRule();

    expect(food.ruleConsumed).toBe(true);
    expect(owner.awarenessState).toBe('heard');
    expect(owner.ruleSenseIcon).toBe('🍗');
    expect(owner.heardTimer).toBe(LOCATION_RULES.kitchen.smellTicks);
  });

  it('Street hides a still cat but movement immediately rustles the grass', () => {
    setLocation('street', 16);
    addDecor('streetGrass');
    owner.active = true;
    owner.x = 700;
    owner.y = 100;

    for (let i = 0; i < LOCATION_RULES.street.hideTicks; i++) {
      updateLocationPlayerPresence(player, false);
    }
    expect(isPlayerHiddenByLocationRule()).toBe(true);
    expect(owner._canSeePlayer()).toBe(false);

    updateLocationPlayerPresence(player, true);
    expect(isPlayerHiddenByLocationRule()).toBe(false);
    expect(owner.ruleSenseIcon).toBe('🌿');
  });
});

describe('Dacha phase and performance contract', () => {
  function setupCountryPeak() {
    setLocation('country', 25);
    addObstacle('a', 8, 3);
    addObstacle('b', 18, 8);
    globalThis.rebuildBgLayer = vi.fn();
    initLocationRule(currentLevelProgression);
    owner.active = false;
  }

  it('does zero background rebuilds between musical boundaries', () => {
    setupCountryPeak();
    const period = LOCATION_RULES.country.phaseTicksByStep[4];
    for (let i = 0; i < period - 1; i++) updateLocationRule();

    expect(rebuildBgLayer).not.toHaveBeenCalled();
    expect(getLocationRulePerformanceReport().phaseSwitches).toBe(0);

    updateLocationRule();
    const report = getLocationRulePerformanceReport();
    expect(rebuildBgLayer).toHaveBeenCalledTimes(1);
    expect(report.phaseSwitches).toBe(1);
    expect(report.backgroundRebuilds).toBe(1);
    expect(report.occupancyRebuilds).toBe(2); // initial mark + phase boundary
  });

  it('keeps marked furniture capped and rebuild frequency below 0.5% of ticks', () => {
    setupCountryPeak();
    const ticks = 12000;
    for (let i = 0; i < ticks; i++) updateLocationRule();
    const report = getLocationRulePerformanceReport();

    expect(report.markedObstacles).toBeLessThanOrEqual(LOCATION_RULES.country.maxSurrealObstacles);
    expect(report.backgroundRebuilds / ticks).toBeLessThan(0.005);
    expect(report.occupancyRebuilds / ticks).toBeLessThan(0.01);
  });

  it('never materializes furniture over the cat', () => {
    setLocation('country', 25);
    const solidNow = addObstacle('solid-now', 18, 8, 0);
    const solidNext = addObstacle('solid-next', 2, 2, 1);
    player.x = solidNext.x;
    player.y = solidNext.y;
    globalThis.rebuildBgLayer = vi.fn();
    locationRuleState.countryPhase = 0;
    locationRuleState.countryPhaseTicks = 1;
    locationRuleState.countryPendingCount = 0;

    updateLocationRule();
    expect(solidNow.ruleSolid).toBe(false);
    expect(solidNext.ruleSolid).toBe(false);
    expect(solidNext.rulePendingSolid).toBe(true);

    player.x = 900;
    player.y = 500;
    updateLocationRule();
    expect(solidNext.rulePendingSolid).toBe(false);
    expect(solidNext.ruleSolid).toBe(true);
  });

  it('melted furniture is ignored by collision and line-of-sight helpers', () => {
    setLocation('country', 21);
    const melted = addObstacle('melted', 5, 2, 1);
    melted.ruleSolid = false;
    const rect = { x: melted.x, y: melted.y, width: 36, height: 36 };

    expect(hitsObstacles(rect)).toBe(false);
    expect(firstObstacleOnSegment(0, melted.y + 20, 500, melted.y + 20, 0)).toBeNull();
  });

  it('reserves furniture from both phases when placing bonuses', () => {
    level = 25;
    globalSeed = 424242;
    cheatLocationKey = 'country';
    generateLevel();

    const surreal = obstacles.filter(ob => ob.surrealRule);
    expect(surreal.length).toBeGreaterThan(0);
    for (const bonus of bonuses) {
      for (const ob of surreal) {
        expect(
          bonus.x >= ob.x && bonus.x <= ob.x + ob.width &&
          bonus.y >= ob.y && bonus.y <= ob.y + ob.height,
          `bonus ${bonus.type} inside future-solid ${ob.id}`
        ).toBe(false);
      }
    }
  });

  it('validates Dacha shortcuts against the conservative solid phase', () => {
    level = 25;
    difficulty = 'normal';
    globalSeed = 424457137;
    cheatLocationKey = 'country';
    generateLevel();

    expect(currentLevelQualityReport.valid).toBe(true);
    expect(currentLevelQualityReport.reasons).not.toContain('path_too_short');
    expect(locationRuleState.countryConservativePathSteps).toBeGreaterThanOrEqual(
      LEVEL_QUALITY.minPathLengthByStep[4]
    );
  });
});
