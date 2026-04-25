// ==========================================
// config.test.js — constants and structures
// ==========================================
import { describe, it, expect, beforeAll } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

// ---------------------------------------------------------------------------
describe('DIFF — difficulty modes', () => {
  it('all three modes present', () => {
    expect(DIFF).toHaveProperty('easy');
    expect(DIFF).toHaveProperty('normal');
    expect(DIFF).toHaveProperty('chaos');
  });

  const requiredFields = ['urgeRate', 'baseSpd', 'spdPerLvl', 'firstLvl', 'poopTime', 'hitUrgeReduce'];
  for (const mode of ['easy', 'normal', 'chaos']) {
    for (const field of requiredFields) {
      it(`DIFF.${mode} has field "${field}"`, () => {
        expect(DIFF[mode]).toHaveProperty(field);
        expect(typeof DIFF[mode][field]).toBe('number');
      });
    }
  }

  it('chaos.urgeRate > normal.urgeRate > easy.urgeRate', () => {
    expect(DIFF.chaos.urgeRate).toBeGreaterThan(DIFF.normal.urgeRate);
    expect(DIFF.normal.urgeRate).toBeGreaterThan(DIFF.easy.urgeRate);
  });

  it('chaos.baseSpd > normal.baseSpd > easy.baseSpd', () => {
    expect(DIFF.chaos.baseSpd).toBeGreaterThan(DIFF.normal.baseSpd);
    expect(DIFF.normal.baseSpd).toBeGreaterThan(DIFF.easy.baseSpd);
  });

  it('hitUrgeReduce is > 0 for all modes', () => {
    expect(DIFF.easy.hitUrgeReduce).toBeGreaterThan(0);
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(0);
    expect(DIFF.chaos.hitUrgeReduce).toBeGreaterThan(0);
  });

  it('easy.hitUrgeReduce > normal.hitUrgeReduce > chaos.hitUrgeReduce', () => {
    expect(DIFF.easy.hitUrgeReduce).toBeGreaterThan(DIFF.normal.hitUrgeReduce);
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(DIFF.chaos.hitUrgeReduce);
  });
});

// ---------------------------------------------------------------------------
describe('DIFF — balance: hitUrgeReduce vs urge growth per cooldown', () => {
  // Cooldown = 22 frames; urge growth per frame = urgeRate/60
  // chaos: hitUrgeReduce < urgeRate/60 * 22 (can't cheat by shooting alone)
  // normal: hitUrgeReduce may exceed urgeRate/60*22 — shooting helps but
  //         the player still needs to reach the litter box (design intent)
  it('chaos: hitUrgeReduce < urgeRate/60 * 22 (shooting cannot cancel urge growth)', () => {
    const { hitUrgeReduce, urgeRate } = DIFF.chaos;
    expect(hitUrgeReduce).toBeLessThan(urgeRate / 60 * 22);
  });

  it('normal: hitUrgeReduce is a positive number (shooting reduces urge)', () => {
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(0);
  });

  it('easy: hitUrgeReduce is a positive number (shooting reduces urge)', () => {
    expect(DIFF.easy.hitUrgeReduce).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('WORLD', () => {
  const fields = ['width', 'height', 'floorHeight', 'topPadding', 'sidePadding'];
  for (const f of fields) {
    it(`WORLD.${f} is a number > 0`, () => {
      expect(typeof WORLD[f]).toBe('number');
      expect(WORLD[f]).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
describe('BONUS_TYPES', () => {
  it('contains fish, yarn, pill', () => {
    expect(BONUS_TYPES).toHaveProperty('fish');
    expect(BONUS_TYPES).toHaveProperty('yarn');
    expect(BONUS_TYPES).toHaveProperty('pill');
  });

  for (const type of ['fish', 'yarn', 'pill']) {
    it(`BONUS_TYPES.${type} has emoji, label, color`, () => {
      expect(BONUS_TYPES[type]).toHaveProperty('emoji');
      expect(BONUS_TYPES[type]).toHaveProperty('label');
      expect(BONUS_TYPES[type]).toHaveProperty('color');
    });
  }
});

// ---------------------------------------------------------------------------
describe('obstacleCatalog', () => {
  it('all obstacle types from locationThemes are in catalog', () => {
    const catalogKeys = Object.keys(obstacleCatalog);
    for (const theme of locationThemes) {
      for (const type of theme.obstacleTypes) {
        expect(catalogKeys).toContain(type);
      }
    }
  });

  it('each catalog entry has wCells, hCells, color, detail (grid-based sizing)', () => {
    for (const [key, entry] of Object.entries(obstacleCatalog)) {
      expect(entry, `${key} missing wCells`).toHaveProperty('wCells');
      expect(entry, `${key} missing hCells`).toHaveProperty('hCells');
      expect(entry, `${key} missing color`).toHaveProperty('color');
      expect(entry, `${key} missing detail`).toHaveProperty('detail');
      expect(Array.isArray(entry.wCells), `${key} wCells must be array [min, max]`).toBe(true);
      expect(Array.isArray(entry.hCells), `${key} hCells must be array [min, max]`).toBe(true);
    }
  });

  it('wCells[0] <= wCells[1] and hCells[0] <= hCells[1] for all entries', () => {
    for (const [key, entry] of Object.entries(obstacleCatalog)) {
      expect(entry.wCells[0], `${key}: wCells min > max`).toBeLessThanOrEqual(entry.wCells[1]);
      expect(entry.hCells[0], `${key}: hCells min > max`).toBeLessThanOrEqual(entry.hCells[1]);
      expect(entry.wCells[0], `${key}: wCells min must be >= 1`).toBeGreaterThanOrEqual(1);
      expect(entry.hCells[0], `${key}: hCells min must be >= 1`).toBeGreaterThanOrEqual(1);
    }
  });
});
