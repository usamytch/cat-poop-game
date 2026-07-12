// ==========================================
// run.test.js — finite campaign, endless, reports and habits
// ==========================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  runProfile = _defaultRunProfile();
  runMode = 'campaign';
  gameMode = 'normal';
  difficulty = 'normal';
  gameState = 'playing';
  globalSeed = 123456;
  simulationTimeMs = 120000;
  runActMetrics.startTimeMs = 0;
  player.urge = 20;
});

describe('campaign completion', () => {
  it('turns level 25 into a real victory and does not generate level 26', () => {
    level = 25;

    completeScoredLevel();

    expect(gameState).toBe('win');
    expect(level).toBe(25);
    expect(runProfile.unlocks.endless).toBe(true);
    expect(getRunRecord('campaign', 'normal').wins).toBe(1);
    expect(runActReports).toHaveLength(1);
  });

  it('unlocks only cosmetic progression, not permanent balance bonuses', () => {
    level = 25;
    completeScoredLevel();

    expect(runProfile.cosmetics.pawStyles).toContain('spark');
    expect(runProfile.cosmetics.hudFrames).toContain('gold');
    expect(runProfile).not.toHaveProperty('speedBonus');
    expect(runProfile).not.toHaveProperty('urgeBonus');
  });
});

describe('act intermission', () => {
  it('shows a report and three deterministic habit choices after level 5', () => {
    level = 5;
    runActMetrics.shots = 8;
    runActMetrics.hits = 6;
    runActMetrics.riskyBonuses = 2;

    completeScoredLevel();

    expect(gameState).toBe('actComplete');
    expect(pendingNextLevel).toBe(6);
    expect(currentActReport.actNumber).toBe(1);
    expect(currentActReport.accuracy).toBe(75);
    expect(currentHabitChoices).toHaveLength(3);
  });

  it('continues to level 6 after choosing one habit', () => {
    level = 5;
    completeScoredLevel();
    const chosenKey = currentHabitChoices[1].key;

    chooseActHabit(1);

    expect(gameState).toBe('playing');
    expect(level).toBe(6);
    expect(selectedHabitKeys).toEqual([chosenKey]);
  });

  it('offers the same habits for the same run seed and act', () => {
    level = 5;
    completeScoredLevel();
    const first = currentHabitChoices.map(habit => habit.key);

    resetRunProgress();
    gameState = 'playing';
    level = 5;
    globalSeed = 123456;
    runActMetrics.startTimeMs = 0;
    completeScoredLevel();
    const second = currentHabitChoices.map(habit => habit.key);

    expect(second).toEqual(first);
  });
});

describe('endless', () => {
  it('continues beyond level 25 instead of entering win', () => {
    runProfile.unlocks.endless = true;
    runMode = 'endless';
    level = 25;

    completeScoredLevel();

    expect(gameState).toBe('actComplete');
    expect(pendingNextLevel).toBe(26);
  });
});

describe('separate records', () => {
  it('does not mix formats or difficulties', () => {
    stats.update(50, 4);
    difficulty = 'chaos';
    stats.update(80, 6);
    runMode = 'endless';
    stats.update(120, 12);

    expect(getRunRecord('campaign', 'normal').highScore).toBe(50);
    expect(getRunRecord('campaign', 'chaos').highScore).toBe(80);
    expect(getRunRecord('endless', 'chaos').highScore).toBe(120);
    expect(getRunRecord('endless', 'normal').highScore).toBe(0);
  });

  it('persists a versioned profile', () => {
    stats.update(42, 3);
    const stored = JSON.parse(localStorage.getItem(RUN_SAVE_KEY));

    expect(stored.version).toBe(RUN_SAVE_VERSION);
    expect(stored.records.campaign.normal.highScore).toBe(42);
  });
});

describe('two-sided habits', () => {
  it('swift paws changes both speed and urgency', () => {
    selectedHabitKeys = ['swift_paws'];
    expect(getRunPlayerSpeedScale(0.2)).toBeCloseTo(1.10);
    expect(getRunUrgeRateScale()).toBeCloseTo(1.10);
  });

  it('long combo extends the window but weakens hit relief', () => {
    selectedHabitKeys = ['long_combo'];
    expect(getRunComboWindowTicks()).toBe(240);
    expect(getRunHitReliefScale()).toBeCloseTo(0.75);
  });

  it('caps choices at four habits in one run', () => {
    selectedHabitKeys = RUN_HABITS.slice(0, RUN.maxHabits).map(habit => habit.key);
    expect(_habitChoicesForAct(5)).toEqual([]);
  });
});
