// ==========================================
// GAME — state, stats, input, loop
// ==========================================

// ===== СТАТИСТИКА =====
const stats = {
  highScore:      parseInt(localStorage.getItem("cpg_hs") || "0"),
  bestLevel:      parseInt(localStorage.getItem("cpg_bl") || "1"),
  totalCaught:    parseInt(localStorage.getItem("cpg_tc") || "0"),
  totalAccidents: parseInt(localStorage.getItem("cpg_ta") || "0"),
  totalPoops:     parseInt(localStorage.getItem("cpg_tp") || "0"),
  save() {
    localStorage.setItem("cpg_hs", this.highScore);
    localStorage.setItem("cpg_bl", this.bestLevel);
    localStorage.setItem("cpg_tc", this.totalCaught);
    localStorage.setItem("cpg_ta", this.totalAccidents);
    localStorage.setItem("cpg_tp", this.totalPoops);
  },
  update(s, l) {
    if (s > this.highScore) this.highScore = s;
    if (l > this.bestLevel) this.bestLevel = l;
    this.save();
  },
};

// ===== СОСТОЯНИЕ =====
let gameState = "start";
let score = 0;
let level = 1;
let difficulty = "normal";
let lives = 3;
let lifeLostTimer = 0;   // обратный отсчёт перед возобновлением
let lifeLostReason = ""; // "accident" | "caught"
let pausedFromState = null;
let pauseReason = "";    // "manual" | "hidden" | "blur"

// ===== ИГРОВОЕ ВРЕМЯ =====
// Вся механика проекта настроена в единицах «кадр при 60 FPS». Fixed timestep
// сохраняет этот баланс на дисплеях 60/120/144+ Гц, не ограничивая частоту draw().
const SIMULATION_HZ = 60;
const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;
const MAX_FRAME_DELTA_MS = 100;
const MAX_SIMULATION_STEPS = 5;
const SIMULATION_EPSILON_MS = 0.000001;

let simulationLastTimestamp = null;
let simulationAccumulatorMs = 0;
let droppedSimulationTimeMs = 0;
let simulationTimeMs = 0;

function resetSimulationClock(timestamp = null) {
  simulationLastTimestamp = Number.isFinite(timestamp) ? timestamp : null;
  simulationAccumulatorMs = 0;
  droppedSimulationTimeMs = 0;
}

function clearInputState() {
  for (const key in keys) keys[key] = false;
}

function pauseGame(reason = "manual") {
  if (gameState === "paused") return false;
  if (gameState !== "playing" && gameState !== "lifeLost") return false;

  pausedFromState = gameState;
  pauseReason = reason;
  gameState = "paused";
  clearInputState();
  resetSimulationClock();
  pauseAudio();
  return true;
}

function resumeGame() {
  if (gameState !== "paused") return false;

  gameState = pausedFromState || "playing";
  pausedFromState = null;
  pauseReason = "";
  clearInputState();
  resetSimulationClock();
  resumeAudio();
  return true;
}

// ===== КЛАВИШИ =====
const keys = {};
window.addEventListener("keydown", e => {
  if ((e.key === "q" || e.key === "Q") && gameState === "paused" && isTutorialActive()) {
    e.preventDefault();
    exitTutorialToMenu();
    return;
  }
  if (e.key === "Escape" || e.key === "p" || e.key === "P") {
    e.preventDefault();
    if (gameState === "paused") resumeGame();
    else pauseGame("manual");
    return;
  }
  keys[e.key] = true;
  // F — пять секунд измерять frame pacing и CPU update+draw (debug only).
  if (e.key === "f" || e.key === "F") {
    const locationKey = typeof currentLocation !== "undefined" ? currentLocation.key : "none";
    const panic = player.urge / player.maxUrge > 0.75 ? "panic" : "calm";
    perfMonitor.start(`${gameState}:${difficulty}:L${level}:${locationKey}:${panic}`);
    return;
  }
  // M — мьют работает в любом состоянии игры
  if (e.key === "m" || e.key === "M") {
    toggleMute();
    return;
  }
  if (gameState === "start") {
    if (e.key === "1") { gameMode = "tutorial"; difficulty = "normal"; }
    if (e.key === "2") { gameMode = "normal"; difficulty = "normal"; }
    if (e.key === "3") { gameMode = "chaos"; difficulty = "chaos"; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const order = ["tutorial", "normal", "chaos"];
      const idx = order.indexOf(gameMode);
      gameMode = order[(idx + (e.key === "ArrowDown" ? 1 : -1) + 3) % 3];
      difficulty = gameMode === "chaos" ? "chaos" : "normal";
    }
    if (e.key === "Enter" || e.key === " ") startGame();
    // Чит-код: Shift+B (латинская) — форсировать подвал (corridor)
    if (e.key === "B") {
      cheatBasement = true;
      gameMode = "normal";
      difficulty = "normal";
      level = 9;
      startGame();
    }
    // Чит-код: Shift+D (латинская) — форсировать подвал (DFS-лабиринт)
    if (e.key === "D") {
      cheatDfs = true;
      gameMode = "normal";
      difficulty = "normal";
      level = 20;
      startGame();
    }
  } else if (gameState === "playing") {
    if (e.key === " " || e.key === "x" || e.key === "X") shootPoop();
    // Debug/QA: Shift+T — перейти к следующему экрану активного обучения.
    if (e.key === "T" && isTutorialActive()) { completeTutorialStage(); return; }
    // Debug: Shift+G — переключить steering overlay
    if (e.key === "G") { _debugSteering = !_debugSteering; }
    // Чит-код: Shift+B — телепорт в подвал (corridor) без сброса счёта/жизней
    if (e.key === "B") {
      cheatBasement = true;
      level = Math.max(level, 9);
      generateLevel();
      syncLocationMelody();
      owner.activate();
      levelMessageTimer = 180;
    }
    // Чит-код: Shift+D — телепорт в подвал (DFS) без сброса счёта/жизней
    if (e.key === "D") {
      cheatDfs = true;
      level = Math.max(level, 20);
      generateLevel();
      syncLocationMelody();
      owner.activate();
      levelMessageTimer = 180;
    }
  } else if (gameState === "lifeLost") {
    // Enter/пробел — пропустить ожидание и сразу возобновить
    if (e.key === "Enter" || e.key === " ") respawnPlayer();
  } else if (gameState === "paused") {
    if (e.key === "Enter" || e.key === " ") resumeGame();
  } else if (gameState === "tutorialComplete") {
    if (e.key === "Enter" || e.key === " ") finishTutorialToMenu();
  } else if (gameState === "win" || gameState === "lose" || gameState === "caught" || gameState === "accident") {
    if (e.key === "r" || e.key === "R") {
      const replayRunSeed = globalSeed;
      startGame(replayRunSeed);
      return;
    }
    if (e.key === "Enter" || e.key === " ") { gameState = "start"; }
  }
});
window.addEventListener("keyup", e => { keys[e.key] = false; });
window.addEventListener("blur", () => { pauseGame("blur"); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame("hidden");
});

// ===== СТАРТ ИГРЫ =====
function startGame(seedOverride = null) {
  globalSeed = Number.isInteger(seedOverride)
    ? seedOverride & 0x7FFFFFFF
    : Date.now() & 0x7FFFFFFF;
  score = 0; level = 1; lives = 3;
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  poops.length = 0; overlayParticles.length = 0; comboPopups.length = 0; pawTrails.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  panicFlashAlpha = 0; panicFlashTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false;
  pausedFromState = null; pauseReason = "";
  simulationTimeMs = 0;
  resetSimulationClock();
  gameState = "playing";
  if (gameMode === "tutorial") {
    startTutorial();
  } else {
    tutorialState.active = false;
    difficulty = gameMode === "chaos" ? "chaos" : "normal";
    generateLevel();
    owner.activate();
  }
  sndMeow();
  stopPanicMelody();
  startMelody();
}

// ===== ВОЗОБНОВЛЕНИЕ ПОСЛЕ ПОТЕРИ ЖИЗНИ =====
function respawnPlayer() {
  const b = getPlayBounds();
  player.x = b.left + 60;
  player.y = b.top + (b.bottom - b.top) / 2 - player.size / 2;
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  poops.length = 0; pawTrails.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  panicFlashAlpha = 0; panicFlashTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false;
  owner.activate();
  sndMeow();
  gameState = "playing";
  startMelody();
}

// ===== ОБНОВЛЕНИЕ =====
function update() {
  if (gameState === "paused") return;
  if (gameState === "lifeLost") {
    updateOverlayParticles();
    updateComboPopups();
    lifeLostTimer--;
    if (lifeLostTimer <= 0) respawnPlayer();
    return;
  }
  if (gameState !== "playing") {
    updateOverlayParticles();
    updateComboPopups();
    overlayTimer++;
    return;
  }
  simulationTimeMs += SIMULATION_STEP_MS;
  player.update();
  owner.update();
  updatePoops();
  updateBonuses();
  updateObstacles();
  updatePawTrails();
  updateOverlayParticles();
  updateComboPopups();
  updateTutorial();
  if (levelMessageTimer > 0) levelMessageTimer--;
}

// ===== ИГРОВОЙ ЦИКЛ =====
function advanceSimulation(timestamp) {
  if (!Number.isFinite(timestamp)) return 0;

  if (simulationLastTimestamp === null) {
    simulationLastTimestamp = timestamp;
    return 0;
  }

  let frameDelta = timestamp - simulationLastTimestamp;
  simulationLastTimestamp = timestamp;
  if (!Number.isFinite(frameDelta) || frameDelta <= 0) return 0;

  if (frameDelta > MAX_FRAME_DELTA_MS) {
    droppedSimulationTimeMs += frameDelta - MAX_FRAME_DELTA_MS;
    frameDelta = MAX_FRAME_DELTA_MS;
  }
  simulationAccumulatorMs += frameDelta;

  let steps = 0;
  while (simulationAccumulatorMs + SIMULATION_EPSILON_MS >= SIMULATION_STEP_MS &&
         steps < MAX_SIMULATION_STEPS) {
    update();
    simulationAccumulatorMs -= SIMULATION_STEP_MS;
    if (simulationAccumulatorMs < 0) simulationAccumulatorMs = 0;
    steps++;
  }

  // Если вкладка или поток зависли, не пытаемся догонять потерянные секунды.
  // Оставляем только дробный остаток до следующего simulation tick.
  if (simulationAccumulatorMs + SIMULATION_EPSILON_MS >= SIMULATION_STEP_MS) {
    const backlogSteps = Math.floor(
      (simulationAccumulatorMs + SIMULATION_EPSILON_MS) / SIMULATION_STEP_MS
    );
    const droppedBacklog = backlogSteps * SIMULATION_STEP_MS;
    simulationAccumulatorMs -= droppedBacklog;
    if (simulationAccumulatorMs < 0) simulationAccumulatorMs = 0;
    droppedSimulationTimeMs += droppedBacklog;
  }

  return steps;
}

function gameLoop(timestamp) {
  const measuringPerformance = perfMonitor.enabled;
  if (measuringPerformance) perfMonitor.beginFrame(timestamp);
  const simulationSteps = advanceSimulation(timestamp);
  if (measuringPerformance) perfMonitor.recordSimulationSteps(simulationSteps);
  draw();
  if (measuringPerformance) perfMonitor.endFrame();
  requestAnimationFrame(gameLoop);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
generateLevel();
resetSimulationClock();
requestAnimationFrame(gameLoop);
