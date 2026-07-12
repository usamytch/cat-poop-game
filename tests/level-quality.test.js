// ==========================================
// level-quality.test.js — procedural fairness contract
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { loadGame } from "./setup.js";

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  level = 1;
  score = 0;
  lives = 3;
  difficulty = "normal";
  globalSeed = 0;
  cheatBasement = false;
  cheatDfs = false;
});

function geometrySnapshot() {
  return {
    location: currentLocation.key,
    basementMode,
    variant: currentLevelVariant,
    levelSeed,
    player: { x: player.x, y: player.y },
    litter: { ...litterBox },
    obstacles: obstacles.map(ob => ({
      id: ob.id,
      type: ob.type,
      col: ob.col,
      row: ob.row,
      wCells: ob.wCells,
      hCells: ob.hCells,
      moving: ob.moving,
      axis: ob.axis,
      range: ob.range,
    })),
  };
}

describe("LevelQualityReport", () => {
  it("score cannot change geometry for the same run seed and level", () => {
    globalSeed = 918273;
    level = 12;
    score = 0;
    generateLevel();
    const first = geometrySnapshot();

    score = 999999;
    generateLevel();
    expect(geometrySnapshot()).toEqual(first);
  });

  it("publishes the seed, bounded candidate and route budgets", () => {
    globalSeed = 424242;
    level = 10;
    generateLevel();

    expect(currentLevelQualityReport).not.toBeNull();
    expect(currentLevelQualityReport.runSeed).toBe(globalSeed);
    expect(currentLevelQualityReport.levelSeed).toBe(levelSeed);
    expect(currentLevelVariant).toBeGreaterThanOrEqual(0);
    expect(currentLevelVariant).toBeLessThan(LEVEL_QUALITY.candidateAttempts);
    expect(currentLevelQualityReport.pathLengthCells).toBeGreaterThan(0);
    expect(currentLevelQualityReport.travelBudgetRatio).toBeLessThanOrEqual(
      LEVEL_QUALITY.maxTravelBudgetRatioByStep[currentLevelProgression.actStep - 1]
    );
  });

  it("places every bonus in the spawn component outside moving swept zones", () => {
    for (const lvl of [1, 5, 10, 20, 35]) {
      for (let seed = 1; seed <= 20; seed++) {
        level = lvl;
        globalSeed = seed * 7919;
        generateLevel();
        expect(currentLevelQualityReport.unreachableBonusCount,
          `level=${lvl}, seed=${globalSeed}`).toBe(0);
        expect(currentLevelQualityReport.reachableBonusCount).toBe(bonuses.length);
      }
    }
  });

  it("keeps representative Normal and Chaos samples within the fairness contract", () => {
    const failures = [];
    for (const mode of ["normal", "chaos"]) {
      difficulty = mode;
      for (const lvl of [1, 5, 10, 20, 35]) {
        for (let seed = 1; seed <= 30; seed++) {
          level = lvl;
          globalSeed = seed * 3571 + lvl * 101;
          generateLevel();
          if (!currentLevelQualityReport.valid) {
            failures.push({ mode, lvl, seed, reasons: currentLevelQualityReport.reasons });
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("restarts the gameplay AI stream from the same seed", () => {
    globalSeed = 13579;
    level = 17;
    generateLevel();
    const first = Array.from({ length: 8 }, () => aiRng());
    generateLevel();
    const second = Array.from({ length: 8 }, () => aiRng());
    expect(second).toEqual(first);
  });
});
