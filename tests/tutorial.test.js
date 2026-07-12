// ==========================================
// tutorial.test.js — fixed onboarding scenarios and isolation
// ==========================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  gameMode = 'tutorial';
  difficulty = 'normal';
  gameState = 'playing';
});

describe('tutorial fixed stages', () => {
  it('starts with a fixed owner-free movement stage', () => {
    startTutorial();

    expect(tutorialState.active).toBe(true);
    expect(tutorialState.stage).toBe(0);
    expect(owner.active).toBe(false);
    expect(bonuses).toHaveLength(0);
    expect(tutorialCanShoot()).toBe(false);
    expect(tutorialCanUseLitter()).toBe(true);
    expect(player.urge).toBe(42);
  });

  it('does not change fixed geometry when run seed changes', () => {
    globalSeed = 123;
    startTutorial();
    const first = obstacles.map(ob => [ob.type, ob.col, ob.row, ob.wCells, ob.hCells]);
    const firstLitter = [litterBox.x, litterBox.y];

    globalSeed = 987654321;
    loadTutorialStage(0);

    expect(obstacles.map(ob => [ob.type, ob.col, ob.row, ob.wCells, ob.hCells])).toEqual(first);
    expect([litterBox.x, litterBox.y]).toEqual(firstLitter);
  });

  it('locks stage-two litter until the three-hit combo', () => {
    startTutorial();
    loadTutorialStage(1);

    expect(owner.active).toBe(true);
    expect(tutorialCanShoot()).toBe(true);
    expect(tutorialCanUseLitter()).toBe(false);

    tutorialOnCombo();
    expect(tutorialState.comboDone).toBe(true);
    expect(tutorialCanUseLitter()).toBe(true);
  });

  it('holds the owner behind furniture until the first blocked shot', () => {
    startTutorial();
    loadTutorialStage(1);
    const startX = owner.x;
    const startY = owner.y;

    owner.update();
    expect(owner.x).toBe(startX);
    expect(owner.y).toBe(startY);

    owner.onShotFired(player.x + player.size / 2, player.y + player.size / 2);
    tutorialOnShotBlocked();
    owner.update();
    expect(owner.awarenessState).toBe('heard');
    expect(owner.pathTimer).toBe(owner.PATH_RECALC);
  });

  it('places fish, yarn and pill on the exam route', () => {
    startTutorial();
    loadTutorialStage(2);

    expect(bonuses.map(b => b.type)).toEqual(['fish', 'yarn', 'pill']);
    expect(owner.active).toBe(true);
    expect(getTutorialPauseLegend()).toHaveLength(3);
  });

  it('triggers a safe scripted panic near the finish', () => {
    startTutorial();
    loadTutorialStage(2);
    player.x = 721;
    player.urge = 60;

    updateTutorial();

    expect(tutorialState.panicTriggered).toBe(true);
    expect(player.urge).toBe(78);
  });
});

describe('tutorial progression and isolation', () => {
  it('retries the current checkpoint without spending a life or writing stats', () => {
    startTutorial();
    loadTutorialStage(1);
    const caughtBefore = stats.totalCaught;
    const accidentsBefore = stats.totalAccidents;
    const livesBefore = lives;
    player.x = 500;

    expect(tutorialHandleFailure()).toBe(true);

    expect(tutorialState.stage).toBe(1);
    expect(tutorialState.retries).toBe(1);
    expect(lives).toBe(livesBefore);
    expect(stats.totalCaught).toBe(caughtBefore);
    expect(stats.totalAccidents).toBe(accidentsBefore);
    expect(player.x).not.toBe(500);
  });

  it('does not count tutorial shots in ordinary statistics or score', () => {
    startTutorial();
    loadTutorialStage(1);
    const poopsBefore = stats.totalPoops;
    const scoreBefore = score;

    shootPoop();

    expect(poops).toHaveLength(1);
    expect(stats.totalPoops).toBe(poopsBefore);
    expect(score).toBe(scoreBefore);
    expect(tutorialState.shotsFired).toBe(1);
  });

  it('advances through all three stages and stores completion once', () => {
    startTutorial();

    completeTutorialStage();
    expect(tutorialState.stage).toBe(1);
    completeTutorialStage();
    expect(tutorialState.stage).toBe(2);
    completeTutorialStage();

    expect(gameState).toBe('tutorialComplete');
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('1');
    expect(gameMode).toBe('normal');
    expect(difficulty).toBe('normal');
  });

  it('returns to menu with Normal selected after completion', () => {
    startTutorial();
    loadTutorialStage(2);
    completeTutorialStage();

    finishTutorialToMenu();

    expect(tutorialState.active).toBe(false);
    expect(gameState).toBe('start');
    expect(gameMode).toBe('normal');
  });
});
