// ==========================================
// GAME — state, stats, input, loop
// ==========================================

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

function debugJumpToLevel(targetLevel, forcedLocationKey) {
  level = targetLevel;
  cheatLocationKey = forcedLocationKey || "";
  player.urge = 0;
  poopProgress = 0;
  isPooping = false;
  litterCueStep = -1;
  resetFeedbackState();
  generateLevel();
  syncLocationMelody();
  owner.activate();
  levelMessageTimer = 180;
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

// ===== НАВИГАЦИЯ СТАРТОВОГО ЭКРАНА =====
// Геометрия едина для renderer и мыши; touch использует те же координаты.
// Карточки на Canvas ведут себя как обычная двухмерная форма.
const START_MENU_LAYOUT = {
  modes: ["tutorial", "normal", "chaos"].map((key, i) => ({
    type:"mode", key, x:135+i*320, y:250, w:290, h:82,
  })),
  formats: ["campaign", "endless"].map((key, i) => ({
    type:"format", key, x:295+i*320, y:400, w:290, h:76,
  })),
  play: { type:"play", x:460, y:516, w:280, h:56 },
};

let startMenuFocus = "mode"; // "mode" | "format" | "play"
let startMenuHover = "";

function _setStartMenuMode(mode) {
  gameMode = mode;
  difficulty = mode === "chaos" ? "chaos" : "normal";
  if (gameMode === "tutorial" && startMenuFocus === "format") startMenuFocus = "mode";
}

function _startMenuRows() {
  return gameMode === "tutorial" ? ["mode", "play"] : ["mode", "format", "play"];
}

function _moveStartMenuFocus(delta) {
  const rows = _startMenuRows();
  const index = Math.max(0, rows.indexOf(startMenuFocus));
  startMenuFocus = rows[clamp(index + delta, 0, rows.length - 1)];
}

function _changeStartMenuChoice(delta) {
  if (startMenuFocus === "mode") {
    const order = ["tutorial", "normal", "chaos"];
    const index = Math.max(0, order.indexOf(gameMode));
    _setStartMenuMode(order[(index + delta + order.length) % order.length]);
    return;
  }
  if (startMenuFocus === "format" && gameMode !== "tutorial") {
    if (delta < 0) runMode = "campaign";
    else if (runProfile.unlocks.endless) runMode = "endless";
  }
}

function _activateStartMenuFocus() {
  if (startMenuFocus === "play") {
    startGame();
    return;
  }
  const rows = _startMenuRows();
  const index = rows.indexOf(startMenuFocus);
  startMenuFocus = rows[Math.min(index + 1, rows.length - 1)];
}

function _startMenuTargetAt(x, y) {
  const targets = [
    ...START_MENU_LAYOUT.modes,
    ...START_MENU_LAYOUT.formats,
    START_MENU_LAYOUT.play,
  ];
  return targets.find(target =>
    x >= target.x && x <= target.x + target.w &&
    y >= target.y && y <= target.y + target.h
  ) || null;
}

function _startMenuTargetId(target) {
  return target ? target.type + (target.key ? ":" + target.key : "") : "";
}

function _isStartMenuTargetEnabled(target) {
  if (!target) return false;
  if (target.type === "format" && gameMode === "tutorial") return false;
  if (target.type === "format" && target.key === "endless" && !runProfile.unlocks.endless) return false;
  return true;
}

function _canvasPointFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

if (!IS_MOBILE) {
  canvas.addEventListener("mousemove", event => {
    if (gameState !== "start") return;
    const point = _canvasPointFromMouse(event);
    const target = _startMenuTargetAt(point.x, point.y);
    startMenuHover = _isStartMenuTargetEnabled(target) ? _startMenuTargetId(target) : "";
    if (canvas.style) canvas.style.cursor = startMenuHover ? "pointer" : "default";
  });
  canvas.addEventListener("mouseleave", () => {
    startMenuHover = "";
    if (canvas.style) canvas.style.cursor = "default";
  });
  canvas.addEventListener("click", event => {
    if (gameState !== "start") return;
    const point = _canvasPointFromMouse(event);
    const target = _startMenuTargetAt(point.x, point.y);
    if (!_isStartMenuTargetEnabled(target)) return;
    if (target.type === "mode") {
      _setStartMenuMode(target.key);
      startMenuFocus = "mode";
    } else if (target.type === "format") {
      runMode = target.key;
      startMenuFocus = "format";
    } else if (target.type === "play") {
      startMenuFocus = "play";
      startGame();
    }
  });
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
    if (e.key === "1") { _setStartMenuMode("tutorial"); startMenuFocus = "mode"; }
    if (e.key === "2") { _setStartMenuMode("normal"); startMenuFocus = "mode"; }
    if (e.key === "3") { _setStartMenuMode("chaos"); startMenuFocus = "mode"; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      _moveStartMenuFocus(e.key === "ArrowDown" ? 1 : -1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      _changeStartMenuChoice(e.key === "ArrowRight" ? 1 : -1);
    }
    if ((e.key === "e" || e.key === "E") && gameMode !== "tutorial" && runProfile.unlocks.endless) {
      runMode = runMode === "campaign" ? "endless" : "campaign";
      startMenuFocus = "format";
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      _activateStartMenuFocus();
    }
    // QA: Shift+C — сразу открыть финальный CATSTOCK set-piece.
    if (e.key === "C") {
      gameMode = "normal";
      difficulty = "normal";
      startGame();
      debugJumpToLevel(25, "country");
    }
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
    // QA: Shift+U — пройти три sensory-ступени без ожидания полного таймера.
    if (e.key === "U") {
      const ratio=player.urge/player.maxUrge;
      player.urge=player.maxUrge*(ratio<0.80 ? 0.80 : ratio<0.90 ? 0.90 : 0.96);
    }
    // QA: Shift+O — поставить кота на лоток для проверки позы/прогресса/звука.
    if (e.key === "O") {
      player.x=litterBox.x+litterBox.width/2-player.size/2;
      player.y=litterBox.y+litterBox.height/2-player.size/2;
      poopProgress=0; isPooping=false; litterCueStep=-1;
    }
    // QA: Shift+H — подтверждённое попадание без ожидания перезарядки.
    if (e.key === "H" && owner.active) {
      poops.push({x:owner.x+owner.width/2,y:owner.y+owner.height/2,dx:0,dy:0,r:POOP_RADIUS,alive:true,trail:[]});
      updatePoops();
    }
    // QA: Shift+L — следующий авторский set-piece (5/5 каждой локации).
    if (e.key === "L") {
      const peaks = [5, 10, 15, 20, 25];
      let next = peaks.find(value => value > level);
      if (!next) next = peaks[0];
      debugJumpToLevel(next, getLevelProgression(next).locationTheme.key);
      return;
    }
    // QA: Shift+A — завершить текущий акт и открыть реальный межактовый экран.
    if (e.key === "A" && !isTutorialActive()) {
      const peakLevel = Math.ceil(level / ACT.length) * ACT.length;
      if (level !== peakLevel) debugJumpToLevel(peakLevel, getLevelProgression(peakLevel).locationTheme.key);
      completeScoredLevel();
      return;
    }
    if (e.key === "C") { debugJumpToLevel(25, "country"); return; }
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
  } else if (gameState === "actComplete") {
    if (e.key === "1") chooseActHabit(0);
    if (e.key === "2") chooseActHabit(1);
    if (e.key === "3") chooseActHabit(2);
    if ((e.key === "Enter" || e.key === " ") && currentHabitChoices.length === 0) chooseActHabit(0);
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
  if (runMode === "endless" && !runProfile.unlocks.endless) runMode = "campaign";
  resetRunProgress();
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  player.visualMotion = 0; player.visualDirX = 1; player.visualDirY = 0;
  poops.length = 0; overlayParticles.length = 0; comboPopups.length = 0; pawTrails.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  panicFlashAlpha = 0; panicFlashTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false; litterCueStep = -1;
  resetFeedbackState();
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
    runActMetrics.startTimeMs = simulationTimeMs;
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
  player.visualMotion = 0; player.visualDirX = 1; player.visualDirY = 0;
  poops.length = 0; pawTrails.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  panicFlashAlpha = 0; panicFlashTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false; litterCueStep = -1;
  resetFeedbackState();
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
  if (consumeFeedbackHitStopTick()) return;
  updateFeedbackTimers();
  simulationTimeMs += SIMULATION_STEP_MS;
  player.update();
  updateLocationRule();
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
