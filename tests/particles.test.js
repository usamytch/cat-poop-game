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
  puddleAlpha = 0;
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
