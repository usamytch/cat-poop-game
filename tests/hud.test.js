// ==========================================
// hud.test.js — unified bottom HUD contracts
// ==========================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { loadGame, resetGameState, ctxMock } from './setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

beforeAll(() => {
  loadGame();
  const code = readFileSync(join(ROOT, 'js/renderer-hud.js'), 'utf8');
  vm.runInThisContext(code, { filename: 'js/renderer-hud.js' });
});

beforeEach(() => {
  resetGameState();
  gameMode = 'normal';
  difficulty = 'normal';
  gameState = 'playing';
  currentLocation = locationThemes[0];
  currentLevelProgression = getLevelProgression(1);
  globalThis._now = 0;
  ctxMock.fillText.mockClear();
});

function drawnLabels() {
  return ctxMock.fillText.mock.calls.map(call => String(call[0]));
}

describe('unified bottom HUD', () => {
  it('shows lives, context, score, mode and the separate ХОЧЕТСЯ scale', () => {
    drawUI();
    const labels = drawnLabels();

    expect(labels).toContain('×3');
    expect(labels).toContain('🛋️ Зал · 1/5 · Уровень 1');
    expect(labels).toContain('СЧЁТ  0');
    expect(labels).toContain('😼 Нормал');
    expect(labels).toContain('💩 ХОЧЕТСЯ');
    expect(labels).toContain('0%');
  });

  it('does not render record or mute indicators in the gameplay HUD', () => {
    drawUI();
    const labels = drawnLabels().join(' | ');

    expect(labels).not.toContain('Рекорд');
    expect(labels).not.toContain('🔊');
    expect(labels).not.toContain('🔇');
  });

  it('renders the matching icon and full Уровень label for every location', () => {
    for (const theme of locationThemes) {
      currentLocation = theme;
      ctxMock.fillText.mockClear();
      drawUI();
      expect(drawnLabels()).toContain(`${theme.icon} ${theme.name} · 1/5 · Уровень 1`);
    }
  });

  it('renders all active effects as stable chips', () => {
    speedBoostTimer = 300;
    yarnFreezeTimer = 180;
    catnipTimer = 120;

    drawUI();
    const labels = drawnLabels();

    expect(labels).toContain('🐟 5с');
    expect(labels).toContain('🧶 3с');
    expect(labels).toContain('🌿 2с');
  });

  it('keeps the same label contract in panic and only changes its icon/color', () => {
    player.urge = 80;

    drawUI();
    const labels = drawnLabels();

    expect(labels).toContain('😱 ХОЧЕТСЯ');
    expect(labels).toContain('80%');
  });

  it('uses tutorial context without lives or scored-run text', () => {
    tutorialState.active = true;
    tutorialState.stage = 0;

    drawUI();
    const labels = drawnLabels();

    expect(labels).toContain('🎓 1/3 · Добеги и дотерпи');
    expect(labels).toContain('🎓 ОБУЧЕНИЕ');
    expect(labels).not.toContain('×3');
    expect(labels.some(label => label.startsWith('СЧЁТ'))).toBe(false);
  });
});
