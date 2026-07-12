// ==========================================
// TUTORIAL — fixed scenarios and contextual guidance
// ==========================================

const TUTORIAL_STORAGE_KEY = "cpg_tutorial_complete";

let gameMode = localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1" ? "normal" : "tutorial";

const TUTORIAL_STAGES = [
  {
    title: "Добеги и дотерпи",
    start: { col: 1, row: 7 },
    litter: { col: 26, row: 6 },
    urge: 42,
    owner: null,
    obstacles: [
      { type: "wardrobe", col: 12, row: 4, wCells: 4, hCells: 7 },
    ],
    bonuses: [],
  },
  {
    title: "Хозяин мешает",
    start: { col: 2, row: 7 },
    litter: { col: 26, row: 6 },
    urge: 24,
    owner: { col: 22, row: 7 },
    obstacles: [
      { type: "wardrobe", col: 13, row: 4, wCells: 3, hCells: 7 },
      { type: "armchair", col: 20, row: 2, wCells: 2, hCells: 2 },
      { type: "dresser", col: 20, row: 11, wCells: 3, hCells: 2 },
    ],
    bonuses: [],
  },
  {
    title: "Собери план",
    start: { col: 1, row: 7 },
    litter: { col: 26, row: 6 },
    urge: 55,
    owner: { col: 19, row: 7 },
    obstacles: [
      { type: "table", col: 10, row: 4, wCells: 4, hCells: 2 },
      { type: "counter", col: 10, row: 9, wCells: 4, hCells: 2 },
      { type: "armchair", col: 18, row: 5, wCells: 2, hCells: 2 },
      { type: "dresser", col: 22, row: 9, wCells: 3, hCells: 2 },
    ],
    bonuses: [
      { type: "fish", col: 7, row: 2 },
      { type: "yarn", col: 15, row: 2 },
      { type: "pill", col: 22, row: 3 },
    ],
  },
];

const tutorialState = {
  active: false,
  completed: false,
  stage: 0,
  stageTicks: 0,
  bannerTimer: 0,
  movedDistance: 0,
  lastPlayerX: 0,
  lastPlayerY: 0,
  shotsFired: 0,
  blockedShots: 0,
  comboDone: false,
  panicTriggered: false,
  retries: 0,
  seenBonuses: new Set(),
};

function isTutorialActive() {
  return tutorialState.active;
}

function shouldRecordRunStats() {
  return !isTutorialActive();
}

function _tutorialAddObstacle(spec, index) {
  const pos = cellToPixel(spec.col, spec.row);
  markCells(spec.col, spec.row, spec.wCells, spec.hCells);
  obstacles.push({
    id: `tutorial-${tutorialState.stage}-${index}`,
    type: spec.type,
    col: spec.col,
    row: spec.row,
    wCells: spec.wCells,
    hCells: spec.hCells,
    x: pos.x,
    y: pos.y,
    width: spec.wCells * GRID,
    height: spec.hCells * GRID,
    moving: false,
    axis: "x",
    range: 0,
    speed: 0,
    phase: 0,
    movingOffset: 0,
    baseX: pos.x,
    baseY: pos.y,
  });
}

function _tutorialPlaceOwner(ownerSpec) {
  if (!ownerSpec) {
    owner.active = false;
    owner.path = [];
    owner.nodeQueue = [];
    owner.nextNode = null;
    return;
  }

  owner.activate();
  const pos = cellToPixel(ownerSpec.col, ownerSpec.row);
  owner.x = pos.x;
  owner.y = pos.y;
  owner.currentNode = { col: ownerSpec.col, row: ownerSpec.row };
  owner.nextNode = null;
  owner.nodeQueue = [];
  owner.path = [];
  owner.moveProgress = 0;
  owner.pathTimer = 0;
  owner.lastRepathGoalCell = null;
}

function loadTutorialStage(stageIndex, retry = false) {
  const stage = TUTORIAL_STAGES[stageIndex];
  if (!stage) return false;

  tutorialState.stage = stageIndex;
  tutorialState.stageTicks = 0;
  tutorialState.bannerTimer = 150;
  tutorialState.movedDistance = 0;
  tutorialState.shotsFired = 0;
  tutorialState.blockedShots = 0;
  tutorialState.comboDone = false;
  tutorialState.panicTriggered = false;
  if (retry) tutorialState.retries++;

  level = stageIndex + 1;
  difficulty = "normal";
  currentLevelProgression = getLevelProgression(level);
  currentLocation = locationThemes[0];
  basementMode = "";
  currentLevelVariant = 0;
  levelSeed = mixSeed(0x5455544f, stageIndex, 0x5249414c);
  currentLevelQualityReport = null;
  aiRng = createRng(mixSeed(levelSeed, 0x4149524e));

  obstacles.length = 0;
  bonuses.length = 0;
  decorItems.length = 0;
  occupiedCells.clear();
  stage.obstacles.forEach(_tutorialAddObstacle);
  if (typeof resetLocationRuleState === "function") resetLocationRuleState("tutorial");

  const start = cellToPixel(stage.start.col, stage.start.row);
  player.x = start.x;
  player.y = start.y;
  player.urge = stage.urge;
  player.pooping = false;
  player.poopTimer = 0;
  tutorialState.lastPlayerX = player.x;
  tutorialState.lastPlayerY = player.y;

  const litter = cellToPixel(stage.litter.col, stage.litter.row);
  litterBox.x = litter.x;
  litterBox.y = litter.y;
  litterBox.width = GRID * 2;
  litterBox.height = GRID * 2;

  for (const bonus of stage.bonuses) {
    const center = cellToPixelCenter(bonus.col, bonus.row);
    bonuses.push({
      x: center.x,
      y: center.y,
      type: bonus.type,
      alive: true,
      pulse: 0,
      tutorialLabel: true,
    });
  }

  poops.length = 0;
  pawTrails.length = 0;
  comboCount = 0;
  comboTimer = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  catnipTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  panicFlashAlpha = 0;
  panicFlashTimer = 0;
  poopProgress = 0;
  isPooping = false;
  levelMessageTimer = 180;

  _tutorialPlaceOwner(stage.owner);
  if (typeof rebuildBgLayer === "function") rebuildBgLayer();
  syncLocationMelody();
  return true;
}

function startTutorial() {
  tutorialState.active = true;
  tutorialState.completed = false;
  tutorialState.retries = 0;
  tutorialState.seenBonuses.clear();
  return loadTutorialStage(0);
}

function tutorialCanShoot() {
  return !isTutorialActive() || tutorialState.stage >= 1;
}

function tutorialCanUseLitter() {
  return !isTutorialActive() || tutorialState.stage !== 1 || tutorialState.comboDone;
}

function tutorialOnShotFired() {
  if (isTutorialActive()) tutorialState.shotsFired++;
}

function tutorialOnShotBlocked() {
  if (isTutorialActive() && tutorialState.stage === 1) tutorialState.blockedShots++;
}

function tutorialOnCombo() {
  if (isTutorialActive() && tutorialState.stage === 1) tutorialState.comboDone = true;
}

function tutorialOnBonusPicked(type) {
  if (isTutorialActive()) tutorialState.seenBonuses.add(type);
}

function tutorialHandleFailure() {
  if (!isTutorialActive()) return false;
  sndLifeLost();
  loadTutorialStage(tutorialState.stage, true);
  return true;
}

function completeTutorialStage() {
  if (!isTutorialActive()) return false;

  if (tutorialState.stage < TUTORIAL_STAGES.length - 1) {
    loadTutorialStage(tutorialState.stage + 1);
    return true;
  }

  tutorialState.completed = true;
  localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  gameMode = "normal";
  difficulty = "normal";
  gameState = "tutorialComplete";
  stopPanicMelody();
  stopMelody();
  return true;
}

function exitTutorialToMenu() {
  if (!isTutorialActive()) return false;
  tutorialState.active = false;
  tutorialState.completed = false;
  pausedFromState = null;
  pauseReason = "";
  gameState = "start";
  gameMode = localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1" ? "normal" : "tutorial";
  difficulty = gameMode === "chaos" ? "chaos" : "normal";
  clearInputState();
  resetSimulationClock();
  stopPanicMelody();
  stopMelody();
  resumeAudio();
  return true;
}

function finishTutorialToMenu() {
  tutorialState.active = false;
  tutorialState.completed = false;
  gameMode = "normal";
  difficulty = "normal";
  gameState = "start";
  resetSimulationClock();
}

function updateTutorial() {
  if (!isTutorialActive() || gameState !== "playing") return;

  tutorialState.stageTicks++;
  if (tutorialState.bannerTimer > 0) tutorialState.bannerTimer--;

  const dx = player.x - tutorialState.lastPlayerX;
  const dy = player.y - tutorialState.lastPlayerY;
  tutorialState.movedDistance += Math.sqrt(dx * dx + dy * dy);
  tutorialState.lastPlayerX = player.x;
  tutorialState.lastPlayerY = player.y;

  if (tutorialState.stage === 2 && !tutorialState.panicTriggered && player.x >= 720) {
    tutorialState.panicTriggered = true;
    player.urge = Math.max(player.urge, 78);
  }
}

function getTutorialPrompt() {
  if (!isTutorialActive()) return "";
  const stage = tutorialState.stage;

  if (tutorialState.bannerTimer > 90) {
    return `${stage + 1}/3 · ${TUTORIAL_STAGES[stage].title}`;
  }

  if (stage === 0) {
    const onLitter = rectsOverlap(playerRect(), {
      x: litterBox.x, y: litterBox.y, width: litterBox.width, height: litterBox.height,
    });
    if (onLitter) return "Зайди в лоток и стой — прогресс сбросится, если уйти";
    if (tutorialState.movedDistance < 140) {
      return IS_MOBILE ? "Веди жёлтый джойстик и обойди шкаф" : "Двигайся WASD или стрелками и обойди шкаф";
    }
    if (player.urge < 50) return "Шкала срочности растёт постоянно — следи за ней";
    return "Оранжевая шкала предупреждает: пора к лотку";
  }

  if (stage === 1) {
    if (tutorialState.comboDone) return "COMBO! Хозяин бежит — используй окно и доберись до лотка";
    if (tutorialState.blockedShots > 0) return "Мебель остановила снаряд — выйди на прямую линию";
    if (tutorialState.shotsFired === 0) {
      return IS_MOBILE ? "Нажми 💩: выстрел сам целится в хозяина" : "Нажми Пробел или X: выстрел сам целится в хозяина";
    }
    return `Попадания: ${comboCount}/3 · промах сбрасывает серию`;
  }

  if (tutorialState.panicTriggered) return "ПАНИКА усиливает давление — таблетка может вернуть контроль";
  if (tutorialState.stageTicks < 300) return "Прямой путь опаснее. Верхний длиннее, зато там три бонуса";
  return "Собери собственный план: маршрут, бонус, выстрел и лоток";
}

function getTutorialPauseLegend() {
  if (!isTutorialActive()) return [];
  const seen = [];
  for (const type of ["fish", "yarn", "pill"]) {
    if (tutorialState.stage >= 2 || tutorialState.seenBonuses.has(type)) {
      seen.push(BONUS_TYPES[type].emoji + " " + BONUS_TYPES[type].label);
    }
  }
  return seen;
}
