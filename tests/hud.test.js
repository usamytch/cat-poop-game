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
  runMode = 'campaign';
  gameState = 'playing';
  resetRunProgress();
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
    expect(labels).toContain('🛋️ Зал · 1/5 · Уровень 1/25');
    expect(labels).toContain('СЧЁТ  0');
    expect(labels).toContain('😼 Нормал · Кампания');
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
      expect(drawnLabels()).toContain(`${theme.icon} ${theme.name} · 1/5 · Уровень 1/25`);
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

describe('run overlays', () => {
  it('renders all five act metrics and three habit choices', () => {
    gameState = 'actComplete';
    currentActReport = {
      actNumber: 1, seconds: 142, avgUrge: 38, accuracy: 75,
      hits: 6, shots: 8, livesLost: 1, riskyBonuses: 2, rank: 'A',
    };
    currentHabitChoices = RUN_HABITS.slice(0, 3);

    drawOverlay();
    const labels = drawnLabels();

    expect(labels).toContain('АКТ 1 ПРОЙДЕН · РАНГ A');
    expect(labels).toContain('142 сек');
    expect(labels).toContain('38% в среднем');
    expect(labels).toContain('75% · 6/8');
    expect(labels).toContain('Потеряно 1');
    expect(labels).toContain('Бонусов 2');
    expect(labels).toContain('1 — ВЫБРАТЬ');
    expect(labels).toContain('2 — ВЫБРАТЬ');
    expect(labels).toContain('3 — ВЫБРАТЬ');
  });

  it('renders a finite campaign victory summary', () => {
    gameState = 'win';
    level = 25;
    score = 321;
    simulationTimeMs = 245000;
    currentActReport = { rank: 'S' };
    runActReports = [{ rank:'A' }, { rank:'S' }, { rank:'B' }, { rank:'A' }, { rank:'S' }];

    drawOverlay();
    const labels = drawnLabels();

    expect(labels).toContain('🎉 ЗАБЕГ ЗАВЕРШЁН!');
    expect(labels).toContain('🔓 ОТКРЫТ ENDLESS');
    expect(labels).toContain('Ранги актов: A  ·  S  ·  B  ·  A  ·  S');
  });
});
