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
  it('only the two scored difficulty profiles are present', () => {
    expect(DIFF).not.toHaveProperty('easy');
    expect(DIFF).toHaveProperty('normal');
    expect(DIFF).toHaveProperty('chaos');
  });

  const requiredFields = [
    'urgeRate', 'baseSpd', 'spdPerLvl', 'maxSpd', 'firstLvl', 'poopTime',
    'hitUrgeReduce', 'shootUrgeReduce', 'chaseMemory', 'searchDuration',
    'heardDuration', 'comboFleeMin', 'comboFleeMax',
  ];
  for (const mode of ['normal', 'chaos']) {
    for (const field of requiredFields) {
      it(`DIFF.${mode} has field "${field}"`, () => {
        expect(DIFF[mode]).toHaveProperty(field);
        expect(typeof DIFF[mode][field]).toBe('number');
      });
    }
  }

  it('chaos.urgeRate > normal.urgeRate', () => {
    expect(DIFF.chaos.urgeRate).toBeGreaterThan(DIFF.normal.urgeRate);
  });

  it('chaos.baseSpd > normal.baseSpd', () => {
    expect(DIFF.chaos.baseSpd).toBeGreaterThan(DIFF.normal.baseSpd);
  });

  it('hitUrgeReduce is > 0 for all modes', () => {
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(0);
    expect(DIFF.chaos.hitUrgeReduce).toBeGreaterThan(0);
  });

  it('normal.hitUrgeReduce > chaos.hitUrgeReduce', () => {
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(DIFF.chaos.hitUrgeReduce);
  });

  it('shootUrgeReduce is >= 0 for all modes', () => {
    expect(DIFF.normal.shootUrgeReduce).toBeGreaterThanOrEqual(0);
    expect(DIFF.chaos.shootUrgeReduce).toBeGreaterThanOrEqual(0);
  });

  it('misses give no urge reduction in either scored mode', () => {
    expect(DIFF.normal.shootUrgeReduce).toBe(0);
    expect(DIFF.chaos.shootUrgeReduce).toBe(0);
  });

  it('normal.maxSpd === 4.5', () => {
    expect(DIFF.normal.maxSpd).toBe(4.5);
  });

  it('chaos.maxSpd === 6.5', () => {
    expect(DIFF.chaos.maxSpd).toBe(6.5);
  });

  it('maxSpd > baseSpd for all modes (cap is above starting speed)', () => {
    expect(DIFF.normal.maxSpd).toBeGreaterThan(DIFF.normal.baseSpd);
    expect(DIFF.chaos.maxSpd).toBeGreaterThan(DIFF.chaos.baseSpd);
  });
});

// ---------------------------------------------------------------------------
describe('DIFF — balance: urge reduction vs urge growth per cooldown', () => {
  // Промах не лечит ни в одном режиме; облегчение подтверждает только hit.
  it('chaos: shootUrgeReduce === 0', () => {
    expect(DIFF.chaos.shootUrgeReduce).toBe(0);
  });

  it('normal: shootUrgeReduce === 0', () => {
    expect(DIFF.normal.shootUrgeReduce).toBe(0);
  });

  it('normal: hitUrgeReduce is a positive number (shooting reduces urge)', () => {
    expect(DIFF.normal.hitUrgeReduce).toBeGreaterThan(0);
  });

});

// ---------------------------------------------------------------------------
describe('OWNER_AI — readable perception contract', () => {
  it('Chaos keeps visual memory longer than Normal', () => {
    expect(DIFF.chaos.chaseMemory).toBeGreaterThan(DIFF.normal.chaseMemory);
  });

  it('combo flee windows are ordered and shorter in Chaos', () => {
    expect(DIFF.normal.comboFleeMin).toBeLessThan(DIFF.normal.comboFleeMax);
    expect(DIFF.chaos.comboFleeMin).toBeLessThan(DIFF.chaos.comboFleeMax);
    expect(DIFF.chaos.comboFleeMax).toBeLessThan(DIFF.normal.comboFleeMax);
  });

  it('basement flashlight and close vision use positive ranges', () => {
    expect(OWNER_AI.basementConeHalfAngle).toBeGreaterThan(0);
    expect(OWNER_AI.basementCloseVision).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('ACT — late-game act pacing', () => {
  it('uses 5-level acts with the expected step curve', () => {
    expect(ACT.length).toBe(5);
    expect(ACT.stepCurve).toEqual([0, 0.7, 1.5, 2.5, 4.0]);
  });

  it('defines deterministic late-act modifiers', () => {
    expect(ACT.maxScalingAct).toBe(10);
    expect(ACT.modifiers.map(m => m.key)).toEqual(['clutter', 'hunt', 'panic', 'motion', 'open']);
  });
});

// ---------------------------------------------------------------------------
describe('WORLD', () => {
  // sidePadding может быть 0 (игровая зона = весь экран) — проверяем >= 0
  const fieldsPositive = ['width', 'height', 'floorHeight', 'topPadding'];
  for (const f of fieldsPositive) {
    it(`WORLD.${f} is a number > 0`, () => {
      expect(typeof WORLD[f]).toBe('number');
      expect(WORLD[f]).toBeGreaterThan(0);
    });
  }
  it('WORLD.sidePadding is a non-negative number', () => {
    expect(typeof WORLD.sidePadding).toBe('number');
    expect(WORLD.sidePadding).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
describe('BONUS_TYPES', () => {
  it('contains fish, yarn, pill, life, catnip', () => {
    expect(BONUS_TYPES).toHaveProperty('fish');
    expect(BONUS_TYPES).toHaveProperty('yarn');
    expect(BONUS_TYPES).toHaveProperty('pill');
    expect(BONUS_TYPES).toHaveProperty('life');
    expect(BONUS_TYPES).toHaveProperty('catnip');
  });

  for (const type of ['fish', 'yarn', 'pill', 'life', 'catnip']) {
    it(`BONUS_TYPES.${type} has emoji, label, color`, () => {
      expect(BONUS_TYPES[type]).toHaveProperty('emoji');
      expect(BONUS_TYPES[type]).toHaveProperty('label');
      expect(BONUS_TYPES[type]).toHaveProperty('color');
    });
  }

  it('BONUS_TYPES.catnip emoji is 🌿', () => {
    expect(BONUS_TYPES.catnip.emoji).toBe('🌿');
  });

  it('BONUS_TYPES.catnip color is #80cbc4', () => {
    expect(BONUS_TYPES.catnip.color).toBe('#80cbc4');
  });

  it('BONUS_TYPES.life emoji is ❤️ (heart, bonus pickup on field)', () => {
    expect(BONUS_TYPES.life.emoji).toBe('❤️');
  });

  it('BONUS_TYPES.life color is #ef9a9a', () => {
    expect(BONUS_TYPES.life.color).toBe('#ef9a9a');
  });
});

// ---------------------------------------------------------------------------
describe('obstacleCatalog', () => {
  it('each location has its own thematic HUD icon', () => {
    const expectedIcons = {
      hall: '🛋️',
      bathroom: '🚿',
      kitchen: '🍳',
      street: '🌳',
      country: '🏡',
      basement: '🕸️',
    };
    expect(Object.fromEntries(locationThemes.map(theme => [theme.key, theme.icon]))).toEqual(expectedIcons);
    expect(new Set(locationThemes.map(theme => theme.icon)).size).toBe(locationThemes.length);
  });

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

  it('basement wall-embed types have wCells=[1,1] and hCells=[1,1] (exactly one cell)', () => {
    const embedTypes = ['fishBones', 'ragMouse', 'teddyBear', 'toyCar', 'toyPlane', 'juiceCan'];
    for (const t of embedTypes) {
      expect(obstacleCatalog, `${t} missing from obstacleCatalog`).toHaveProperty(t);
      expect(obstacleCatalog[t].wCells, `${t}: wCells must be [1,1]`).toEqual([1, 1]);
      expect(obstacleCatalog[t].hCells, `${t}: hCells must be [1,1]`).toEqual([1, 1]);
    }
  });

  it('basement obstacleTypes uses only wall-embed types', () => {
    const basementTheme = locationThemes.find(t => t.key === 'basement');
    const embedTypes = new Set(['fishBones', 'ragMouse', 'teddyBear', 'toyCar', 'toyPlane', 'juiceCan']);
    for (const type of basementTheme.obstacleTypes) {
      expect(embedTypes.has(type), `${type} is not a wall-embed type`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
describe('BASEMENT', () => {
  it('has corridorMinLevel, corridorProb, dfsMinLevel, dfsProb', () => {
    expect(BASEMENT).toHaveProperty('corridorMinLevel');
    expect(BASEMENT).toHaveProperty('corridorProb');
    expect(BASEMENT).toHaveProperty('dfsMinLevel');
    expect(BASEMENT).toHaveProperty('dfsProb');
  });

  it('has wallEmbedCount with min and max as numbers', () => {
    expect(BASEMENT).toHaveProperty('wallEmbedCount');
    expect(typeof BASEMENT.wallEmbedCount.min).toBe('number');
    expect(typeof BASEMENT.wallEmbedCount.max).toBe('number');
  });

  it('wallEmbedCount.min <= wallEmbedCount.max', () => {
    expect(BASEMENT.wallEmbedCount.min).toBeLessThanOrEqual(BASEMENT.wallEmbedCount.max);
  });

  it('wallEmbedCount.min >= 1 (at least one embed per basement)', () => {
    expect(BASEMENT.wallEmbedCount.min).toBeGreaterThanOrEqual(1);
  });
});
