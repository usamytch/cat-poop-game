// ==========================================
// performance.test.js — opt-in frame monitor
// ==========================================

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  perfMonitor.enabled = false;
  perfMonitor.lastTimestamp = null;
  perfMonitor.cpuStart = null;
  perfMonitor.elapsedMs = 0;
  perfMonitor.frameTimes.length = 0;
  perfMonitor.cpuTimes.length = 0;
  perfMonitor.simulationSteps = 0;
  perfMonitor.lastReport = null;
  performance.now.mockReset();
  performance.now.mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('perfMonitor', () => {
  it('does no work while disabled', () => {
    perfMonitor.beginFrame(10);
    perfMonitor.endFrame();

    expect(perfMonitor.frameTimes).toHaveLength(0);
    expect(perfMonitor.cpuTimes).toHaveLength(0);
  });

  it('measures frame intervals and update+draw CPU time', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    perfMonitor.start('test', 50);
    performance.now
      .mockReturnValueOnce(1).mockReturnValueOnce(3)
      .mockReturnValueOnce(4).mockReturnValueOnce(7)
      .mockReturnValueOnce(8).mockReturnValueOnce(12)
      .mockReturnValueOnce(13).mockReturnValueOnce(18);

    perfMonitor.beginFrame(0);  perfMonitor.endFrame();
    perfMonitor.beginFrame(16); perfMonitor.recordSimulationSteps(1); perfMonitor.endFrame();
    perfMonitor.beginFrame(33); perfMonitor.recordSimulationSteps(1); perfMonitor.endFrame();
    perfMonitor.beginFrame(51); perfMonitor.recordSimulationSteps(1); perfMonitor.endFrame();

    expect(perfMonitor.lastReport.label).toBe('test');
    expect(perfMonitor.lastReport.samples).toBe(3);
    expect(perfMonitor.lastReport.frameMs.mean).toBe(17);
    expect(perfMonitor.lastReport.cpuMs.max).toBe(5);
    expect(perfMonitor.lastReport.simulationSteps).toBe(3);
    expect(perfMonitor.lastReport.approximateSimulationHz).toBeCloseTo(3000 / 51);
    expect(perfMonitor.enabled).toBe(false);
  });

  it('reports long-frame counters', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    perfMonitor.start('long-frames', 60);
    performance.now.mockReturnValue(0);

    perfMonitor.beginFrame(0);  perfMonitor.endFrame();
    perfMonitor.beginFrame(25); perfMonitor.endFrame();
    perfMonitor.beginFrame(65); perfMonitor.endFrame();

    expect(perfMonitor.lastReport.framesOver20ms).toBe(2);
    expect(perfMonitor.lastReport.framesOver33ms).toBe(1);
  });
});
