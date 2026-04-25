// ==========================================
// bonuses.test.js
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  // Reset state before each test
  player.urge = 50;
  player.x = 100;
  player.y = 200;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  comboPopups.length = 0;
  bonuses.length = 0;
});

// ---------------------------------------------------------------------------
describe('applyBonus("fish")', () => {
  it('sets speedBoostTimer to 300', () => {
    applyBonus('fish');
    expect(speedBoostTimer).toBe(300);
  });

  it('does not change yarnFreezeTimer', () => {
    yarnFreezeTimer = 0;
    applyBonus('fish');
    expect(yarnFreezeTimer).toBe(0);
  });

  it('adds a popup with text containing "Ускорение!"', () => {
    applyBonus('fish');
    expect(comboPopups.length).toBeGreaterThan(0);
    expect(comboPopups[comboPopups.length - 1].text).toContain('Ускорение!');
  });
});

// ---------------------------------------------------------------------------
describe('applyBonus("yarn")', () => {
  it('sets yarnFreezeTimer to 300', () => {
    applyBonus('yarn');
    expect(yarnFreezeTimer).toBe(300);
  });

  it('does not change speedBoostTimer', () => {
    speedBoostTimer = 0;
    applyBonus('yarn');
    expect(speedBoostTimer).toBe(0);
  });

  it('adds a popup with text containing "Стоп хозяин!"', () => {
    applyBonus('yarn');
    expect(comboPopups.length).toBeGreaterThan(0);
    expect(comboPopups[comboPopups.length - 1].text).toContain('Стоп хозяин!');
  });
});

// ---------------------------------------------------------------------------
describe('applyBonus("pill")', () => {
  it('reduces urge to urge * 0.7', () => {
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(70);
  });

  it('urge stays 0 when already 0', () => {
    player.urge = 0;
    applyBonus('pill');
    expect(player.urge).toBe(0);
  });

  it('urge becomes 70 when urge was 100', () => {
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(70);
  });

  it('adds a popup with text containing "-30% срочности!"', () => {
    applyBonus('pill');
    expect(comboPopups.length).toBeGreaterThan(0);
    expect(comboPopups[comboPopups.length - 1].text).toContain('-30% срочности!');
  });
});

// ---------------------------------------------------------------------------
describe('updateBonuses()', () => {
  it('increments pulse by 0.07 for each bonus', () => {
    bonuses.push({ x: 100, y: 100, type: 'fish', alive: true, pulse: 0 });
    bonuses.push({ x: 200, y: 200, type: 'yarn', alive: true, pulse: 1.0 });
    updateBonuses();
    expect(bonuses[0].pulse).toBeCloseTo(0.07);
    expect(bonuses[1].pulse).toBeCloseTo(1.07);
  });

  it('also updates pulse for dead bonuses (alive=false)', () => {
    bonuses.push({ x: 100, y: 100, type: 'pill', alive: false, pulse: 0 });
    updateBonuses();
    expect(bonuses[0].pulse).toBeCloseTo(0.07);
  });
});
