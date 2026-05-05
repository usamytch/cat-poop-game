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
  catnipTimer = 0;
  comboPopups.length = 0;
  bonuses.length = 0;
  lives = 3;
  level = 1;
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
describe('applyBonus("pill") — level-aware reduction', () => {
  it('reduces urge by 30% on level 1 (default)', () => {
    level = 1;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(70);
  });

  it('reduces urge by 30% on level 6', () => {
    level = 6;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(70);
  });

  it('reduces urge by 40% on level 7', () => {
    level = 7;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(60);
  });

  it('reduces urge by 40% on level 9', () => {
    level = 9;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(60);
  });

  it('reduces urge by 50% on level 10', () => {
    level = 10;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(50);
  });

  it('reduces urge by 50% on level 15', () => {
    level = 15;
    player.urge = 100;
    applyBonus('pill');
    expect(player.urge).toBeCloseTo(50);
  });

  it('popup text shows correct percentage on level 7', () => {
    level = 7;
    player.urge = 100;
    applyBonus('pill');
    expect(comboPopups[comboPopups.length - 1].text).toContain('40%');
  });

  it('popup text shows correct percentage on level 10', () => {
    level = 10;
    player.urge = 100;
    applyBonus('pill');
    expect(comboPopups[comboPopups.length - 1].text).toContain('50%');
  });
});

// ---------------------------------------------------------------------------
describe('applyBonus("life")', () => {
  it('increments lives by 1', () => {
    lives = 2;
    applyBonus('life');
    expect(lives).toBe(3);
  });

  it('caps lives at 9', () => {
    lives = 9;
    applyBonus('life');
    expect(lives).toBe(9);
  });

  it('caps lives at 9 when lives was 8', () => {
    lives = 8;
    applyBonus('life');
    expect(lives).toBe(9);
  });

  it('does not change speedBoostTimer', () => {
    speedBoostTimer = 0;
    applyBonus('life');
    expect(speedBoostTimer).toBe(0);
  });

  it('does not change yarnFreezeTimer', () => {
    yarnFreezeTimer = 0;
    applyBonus('life');
    expect(yarnFreezeTimer).toBe(0);
  });

  it('adds a popup with text containing "+1 жизнь!"', () => {
    applyBonus('life');
    expect(comboPopups.length).toBeGreaterThan(0);
    expect(comboPopups[comboPopups.length - 1].text).toContain('+1 жизнь!');
  });

  it('popup color is #ef9a9a', () => {
    applyBonus('life');
    expect(comboPopups[comboPopups.length - 1].color).toBe('#ef9a9a');
  });
});

// ---------------------------------------------------------------------------
describe('applyBonus("catnip")', () => {
  it('sets catnipTimer to 600', () => {
    applyBonus('catnip');
    expect(catnipTimer).toBe(600);
  });

  it('does not change speedBoostTimer', () => {
    speedBoostTimer = 0;
    applyBonus('catnip');
    expect(speedBoostTimer).toBe(0);
  });

  it('does not change yarnFreezeTimer', () => {
    yarnFreezeTimer = 0;
    applyBonus('catnip');
    expect(yarnFreezeTimer).toBe(0);
  });

  it('does not change player.urge', () => {
    player.urge = 50;
    applyBonus('catnip');
    expect(player.urge).toBe(50);
  });

  it('adds a popup with text containing "Хозяин ушёл!"', () => {
    applyBonus('catnip');
    expect(comboPopups.length).toBeGreaterThan(0);
    expect(comboPopups[comboPopups.length - 1].text).toContain('Хозяин ушёл!');
  });

  it('popup color is #80cbc4', () => {
    applyBonus('catnip');
    expect(comboPopups[comboPopups.length - 1].color).toBe('#80cbc4');
  });

  it('stacking catnip resets timer to 600', () => {
    catnipTimer = 300;
    applyBonus('catnip');
    expect(catnipTimer).toBe(600);
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
