// ==========================================
// PERFORMANCE — opt-in frame benchmark
// ==========================================

const PERF_DEFAULT_SAMPLE_MS = 5000;

function _perfSummary(values) {
  if (!values.length) {
    return { mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    mean: total / sorted.length,
    p50: percentile(0.50),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1],
  };
}

const perfMonitor = {
  enabled: false,
  label: "",
  sampleTargetMs: PERF_DEFAULT_SAMPLE_MS,
  elapsedMs: 0,
  lastTimestamp: null,
  cpuStart: null,
  frameTimes: [],
  cpuTimes: [],
  simulationSteps: 0,
  lastReport: null,

  start(label, sampleTargetMs) {
    this.enabled = true;
    this.label = label || "unspecified";
    this.sampleTargetMs = Math.max(1, Math.floor(sampleTargetMs || PERF_DEFAULT_SAMPLE_MS));
    this.elapsedMs = 0;
    this.lastTimestamp = null;
    this.cpuStart = null;
    this.frameTimes.length = 0;
    this.cpuTimes.length = 0;
    this.simulationSteps = 0;
    this.lastReport = null;
    console.log(`[CPG-PERF] started ${this.label} (${this.sampleTargetMs}ms)`);
  },

  beginFrame(timestamp) {
    if (!this.enabled) return;

    if (Number.isFinite(this.lastTimestamp) && Number.isFinite(timestamp)) {
      const frameTime = Math.max(0, timestamp - this.lastTimestamp);
      this.frameTimes.push(frameTime);
      this.elapsedMs += frameTime;
    }
    this.lastTimestamp = Number.isFinite(timestamp) ? timestamp : this.lastTimestamp;
    this.cpuStart = performance.now();
  },

  recordSimulationSteps(count) {
    if (!this.enabled || !Number.isFinite(count) || count <= 0) return;
    this.simulationSteps += count;
  },

  endFrame() {
    if (!this.enabled || this.cpuStart === null) return;

    this.cpuTimes.push(Math.max(0, performance.now() - this.cpuStart));
    this.cpuStart = null;

    if (this.elapsedMs >= this.sampleTargetMs) {
      this.finish();
    }
  },

  finish() {
    if (!this.enabled) return this.lastReport;

    const frame = _perfSummary(this.frameTimes);
    const cpu = _perfSummary(this.cpuTimes);
    const report = {
      label: this.label,
      samples: this.frameTimes.length,
      durationMs: this.elapsedMs,
      approximateFps: frame.mean > 0 ? 1000 / frame.mean : 0,
      simulationSteps: this.simulationSteps,
      approximateSimulationHz: this.elapsedMs > 0 ? this.simulationSteps * 1000 / this.elapsedMs : 0,
      frameMs: frame,
      cpuMs: cpu,
      framesOver20ms: this.frameTimes.filter(value => value > 20).length,
      framesOver33ms: this.frameTimes.filter(value => value > 33.4).length,
      locationRule: typeof getLocationRulePerformanceReport === "function"
        ? getLocationRulePerformanceReport()
        : null,
    };

    this.enabled = false;
    this.lastReport = report;
    console.log(`[CPG-PERF] ${JSON.stringify(report)}`);
    return report;
  },
};
