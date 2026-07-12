// Offline only: CPG_MONTE_CARLO=1 npx vitest run tests/level-quality.monte-carlo.test.js
import { describe, it, expect, beforeAll } from "vitest";
import { performance as nodePerformance } from "node:perf_hooks";
import { loadGame } from "./setup.js";

const enabled = process.env.CPG_MONTE_CARLO === "1";

beforeAll(() => {
  loadGame();
});

function percentile(sorted, value) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value))];
}

function summarize(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0] ?? null,
    mean: sorted.length ? sum / sorted.length : null,
    p50: percentile(sorted, 0.50),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? null,
  };
}

describe.skipIf(!enabled)("level generation Monte Carlo", () => {
  it("validates 10,000 stratified run seeds and prints distributions", () => {
    const cases = Number(process.env.CPG_MONTE_CARLO_CASES || 10000);
    const levels = [1, 5, 6, 10, 11, 15, 20, 25, 35, 55];
    const modes = ["normal", "chaos"];
    const result = {
      cases,
      invalid: 0,
      unreachableBonuses: 0,
      reasons: {},
      invalidSamples: [],
      locations: {},
      basementModes: {},
      selectedVariants: {},
      pathLengthCells: [],
      pathDirectRatio: [],
      travelBudgetRatio: [],
      interceptLeadSeconds: [],
      reachableCells: [],
      criticalPassageWidthCells: [],
      generationMs: [],
    };

    for (let index = 0; index < cases; index++) {
      difficulty = modes[index % modes.length];
      level = levels[Math.floor(index / modes.length) % levels.length];
      score = (index * 97) % 100000; // deliberately irrelevant to geometry
      lives = 3;
      globalSeed = mixSeed(index + 1, level, difficulty === "chaos" ? 2 : 1);
      cheatBasement = index % 40 === 20;
      cheatDfs = index % 40 === 21;

      const started = nodePerformance.now();
      generateLevel();
      result.generationMs.push(nodePerformance.now() - started);

      const report = currentLevelQualityReport;
      if (!report.valid) {
        result.invalid++;
        if (result.invalidSamples.length < 10) {
          result.invalidSamples.push({
            index,
            difficulty,
            level,
            globalSeed,
            location: report.location,
            basementMode: report.basementMode,
            variant: report.variant,
            reasons: report.reasons,
            pathLengthCells: report.pathLengthCells,
            travelBudgetRatio: report.travelBudgetRatio,
          });
        }
        for (const reason of report.reasons) {
          result.reasons[reason] = (result.reasons[reason] || 0) + 1;
        }
      }
      result.unreachableBonuses += report.unreachableBonusCount;
      result.locations[report.location] = (result.locations[report.location] || 0) + 1;
      const basementKey = report.basementMode || "none";
      result.basementModes[basementKey] = (result.basementModes[basementKey] || 0) + 1;
      result.selectedVariants[report.variant] = (result.selectedVariants[report.variant] || 0) + 1;
      result.pathLengthCells.push(report.pathLengthCells);
      result.pathDirectRatio.push(report.pathDirectRatio);
      result.travelBudgetRatio.push(report.travelBudgetRatio);
      if (Number.isFinite(report.interceptLeadSeconds)) {
        result.interceptLeadSeconds.push(report.interceptLeadSeconds);
      }
      result.reachableCells.push(report.reachableCells);
      result.criticalPassageWidthCells.push(report.criticalPassageWidthCells);
    }

    const summary = {
      cases: result.cases,
      invalid: result.invalid,
      unreachableBonuses: result.unreachableBonuses,
      reasons: result.reasons,
      invalidSamples: result.invalidSamples,
      locations: result.locations,
      basementModes: result.basementModes,
      selectedVariants: result.selectedVariants,
      distributions: {
        pathLengthCells: summarize(result.pathLengthCells),
        pathDirectRatio: summarize(result.pathDirectRatio),
        travelBudgetRatio: summarize(result.travelBudgetRatio),
        interceptLeadSeconds: summarize(result.interceptLeadSeconds),
        reachableCells: summarize(result.reachableCells),
        criticalPassageWidthCells: summarize(result.criticalPassageWidthCells),
        generationMs: summarize(result.generationMs),
      },
    };
    console.log("LEVEL_QUALITY_MONTE_CARLO=" + JSON.stringify(summary));

    expect(result.unreachableBonuses).toBe(0);
    expect(result.invalid).toBe(0);
  }, 120000);
});
