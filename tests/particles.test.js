// ==========================================
// particles.test.js
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  overlayParticles.length = 0;
  comboPopups.length = 0;
  pawTrails.length = 0;
  puddleAlpha = 0;
  _pawSpawnCounter = 0;
});

// ---------------------------------------------------------------------------
describe('spawnConfetti(x, y)', () => {
  it('adds particles to overlayParticles', () => {
    spawnConfetti(300, 300);
    expect(overlayParticles.length).toBeGreaterThan(0);
  });

  it('each particle has x, y, vx(dx), vy(dy), life(alpha), emoji', () => {
    spawnConfetti(300, 300);
    for (const p of overlayParticles) {
      expect(p).toHaveProperty('x');
      expect(p).toHaveProperty('y');
      expect(p).toHaveProperty('dx');
      expect(p).toHaveProperty('dy');
      expect(p).toHaveProperty('alpha');
      expect(p).toHaveProperty('emoji');
    }
  });
});

// ---------------------------------------------------------------------------
describe('spawnPuddle(x, y)', () => {
  it('sets puddleAlpha > 0', () => {
    spawnPuddle(400, 400);
    expect(puddleAlpha).toBeGreaterThan(0);
  });

  it('adds particles to overlayParticles', () => {
    spawnPuddle(400, 400);
    expect(overlayParticles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('updateOverlayParticles()', () => {
  it('particles move by dx, dy each frame', () => {
    overlayParticles.push({
      x: 100, y: 100, dx: 5, dy: 3,
      gravity: 0, alpha: 1, fade: 0,
      rot: 0, rotSpd: 0,
    });
    updateOverlayParticles();
    expect(overlayParticles[0].x).toBeCloseTo(105);
    expect(overlayParticles[0].y).toBeCloseTo(103);
  });

  it('alpha decreases by fade each frame', () => {
    overlayParticles.push({
      x: 100, y: 100, dx: 0, dy: 0,
      gravity: 0, alpha: 1, fade: 0.1,
      rot: 0, rotSpd: 0,
    });
    updateOverlayParticles();
    expect(overlayParticles[0].alpha).toBeCloseTo(0.9);
  });

  it('dead particles (alpha <= 0) are removed', () => {
    overlayParticles.push({
      x: 100, y: 100, dx: 0, dy: 0,
      gravity: 0, alpha: 0.01, fade: 0.1,
      rot: 0, rotSpd: 0,
    });
    updateOverlayParticles();
    expect(overlayParticles.length).toBe(0);
  });

  it('live particles are kept', () => {
    overlayParticles.push({
      x: 100, y: 100, dx: 0, dy: 0,
      gravity: 0, alpha: 0.9, fade: 0.01,
      rot: 0, rotSpd: 0,
    });
    updateOverlayParticles();
    expect(overlayParticles.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('comboPopups', () => {
  it('timer decreases each frame via updateComboPopups()', () => {
    comboPopups.push({ x: 100, y: 100, text: 'HIT!', timer: 10, color: '#fff' });
    updateComboPopups();
    expect(comboPopups[0].timer).toBe(9);
  });

  it('popup is removed when timer <= 0', () => {
    comboPopups.push({ x: 100, y: 100, text: 'HIT!', timer: 1, color: '#fff' });
    updateComboPopups();
    expect(comboPopups.length).toBe(0);
  });

  it('popup with timer > 1 is kept', () => {
    comboPopups.push({ x: 100, y: 100, text: 'HIT!', timer: 5, color: '#fff' });
    updateComboPopups();
    expect(comboPopups.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('pawTrails', () => {
  it('spawnPawTrail adds a trail only every 7th call', () => {
    for (let i = 0; i < 6; i++) spawnPawTrail(100, 100);
    expect(pawTrails.length).toBe(0);
    spawnPawTrail(100, 100); // 7th call
    expect(pawTrails.length).toBe(1);
  });

  it('spawned trail has correct shape', () => {
    // advance counter to next multiple of 7
    _pawSpawnCounter = 6;
    spawnPawTrail(200, 300);
    expect(pawTrails[0]).toMatchObject({ x: 200, y: 300 });
    expect(pawTrails[0].alpha).toBeGreaterThan(0);
    expect(pawTrails[0].fade).toBeGreaterThan(0);
    expect(pawTrails[0].size).toBeGreaterThan(0);
  });

  it('updatePawTrails decreases alpha by fade each frame', () => {
    pawTrails.push({ x: 100, y: 100, alpha: 0.45, fade: 0.007, size: 14 });
    updatePawTrails();
    expect(pawTrails[0].alpha).toBeCloseTo(0.443);
  });

  it('updatePawTrails removes trail when alpha <= 0', () => {
    pawTrails.push({ x: 100, y: 100, alpha: 0.005, fade: 0.007, size: 14 });
    updatePawTrails();
    expect(pawTrails.length).toBe(0);
  });

  it('updatePawTrails keeps trail while alpha > 0', () => {
    pawTrails.push({ x: 100, y: 100, alpha: 0.45, fade: 0.007, size: 14 });
    updatePawTrails();
    expect(pawTrails.length).toBe(1);
  });

  it('multiple trails are all updated independently', () => {
    pawTrails.push({ x: 10, y: 10, alpha: 0.45, fade: 0.007, size: 14 });
    pawTrails.push({ x: 20, y: 20, alpha: 0.005, fade: 0.007, size: 14 }); // will die
    pawTrails.push({ x: 30, y: 30, alpha: 0.3, fade: 0.007, size: 14 });
    updatePawTrails();
    expect(pawTrails.length).toBe(2);
  });
});
