// ==========================================
// RUN — finite campaign, endless, reports, habits and profile
// ==========================================

const RUN_SAVE_KEY = "cpg_profile_v2";
const RUN_SAVE_VERSION = 2;

const ACHIEVEMENTS = [
  { key:"first_act", icon:"🛋️", title:"ПЕРВЫЙ АКТ" },
  { key:"sharpshooter", icon:"🎯", title:"МЕТКИЙ КОТ" },
  { key:"risk_taker", icon:"🎁", title:"ЛЮБИТЕЛЬ РИСКА" },
  { key:"survivor", icon:"❤️", title:"ДЕВЯТЬ ЖИЗНЕЙ" },
  { key:"campaign_win", icon:"🏆", title:"ДО ДАЧИ И ОБРАТНО" },
  { key:"chaos_win", icon:"😈", title:"УКРОТИТЕЛЬ ХАОСА" },
];

const PAW_STYLE_LABELS = { classic:"Обычные", spark:"Искры", shadow:"Тени" };
const HUD_FRAME_LABELS = { classic:"Обычная", gold:"Золотая", danger:"Хаос" };

function _emptyRunRecord() {
  return { highScore:0, bestLevel:1, wins:0, bestTimeMs:0, bestRank:"" };
}

function _defaultRunProfile() {
  return {
    version:RUN_SAVE_VERSION,
    totals:{ caught:0, accidents:0, poops:0 },
    records:{
      campaign:{ normal:_emptyRunRecord(), chaos:_emptyRunRecord() },
      endless:{ normal:_emptyRunRecord(), chaos:_emptyRunRecord() },
    },
    unlocks:{ endless:false, achievements:[], locations:[] },
    cosmetics:{ pawStyles:["classic"], hudFrames:["classic"] },
    settings:{ pawStyle:"classic", hudFrame:"classic" },
  };
}

function _numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function _normalizeRunRecord(raw) {
  const record = _emptyRunRecord();
  if (!raw || typeof raw !== "object") return record;
  record.highScore = Math.max(0, Math.floor(_numberOr(raw.highScore, 0)));
  record.bestLevel = Math.max(1, Math.floor(_numberOr(raw.bestLevel, 1)));
  record.wins = Math.max(0, Math.floor(_numberOr(raw.wins, 0)));
  record.bestTimeMs = Math.max(0, Math.floor(_numberOr(raw.bestTimeMs, 0)));
  record.bestRank = ["S","A","B","C"].includes(raw.bestRank) ? raw.bestRank : "";
  return record;
}

function _loadRunProfile() {
  const fallback = _defaultRunProfile();
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(RUN_SAVE_KEY) || "null");
  } catch (_) {
    parsed = null;
  }

  if (parsed && parsed.version === RUN_SAVE_VERSION) {
    for (const format of ["campaign", "endless"]) {
      for (const diff of ["normal", "chaos"]) {
        fallback.records[format][diff] = _normalizeRunRecord(
          parsed.records && parsed.records[format] && parsed.records[format][diff]
        );
      }
    }
    const totals = parsed.totals || {};
    fallback.totals.caught = Math.max(0, Math.floor(_numberOr(totals.caught, 0)));
    fallback.totals.accidents = Math.max(0, Math.floor(_numberOr(totals.accidents, 0)));
    fallback.totals.poops = Math.max(0, Math.floor(_numberOr(totals.poops, 0)));
    const unlocks = parsed.unlocks || {};
    fallback.unlocks.endless = !!unlocks.endless;
    fallback.unlocks.achievements = Array.isArray(unlocks.achievements)
      ? unlocks.achievements.filter(key => ACHIEVEMENTS.some(item => item.key === key)) : [];
    fallback.unlocks.locations = Array.isArray(unlocks.locations)
      ? unlocks.locations.filter(key => locationThemes.some(item => item.key === key)) : [];
    const cosmetics = parsed.cosmetics || {};
    fallback.cosmetics.pawStyles = Array.isArray(cosmetics.pawStyles)
      ? cosmetics.pawStyles.filter(key => PAW_STYLE_LABELS[key]) : ["classic"];
    fallback.cosmetics.hudFrames = Array.isArray(cosmetics.hudFrames)
      ? cosmetics.hudFrames.filter(key => HUD_FRAME_LABELS[key]) : ["classic"];
    if (!fallback.cosmetics.pawStyles.includes("classic")) fallback.cosmetics.pawStyles.unshift("classic");
    if (!fallback.cosmetics.hudFrames.includes("classic")) fallback.cosmetics.hudFrames.unshift("classic");
    const settings = parsed.settings || {};
    fallback.settings.pawStyle = fallback.cosmetics.pawStyles.includes(settings.pawStyle)
      ? settings.pawStyle : "classic";
    fallback.settings.hudFrame = fallback.cosmetics.hudFrames.includes(settings.hudFrame)
      ? settings.hudFrame : "classic";
    return fallback;
  }

  // Одноразовая мягкая миграция старых общих рекордов в Campaign / Normal.
  fallback.records.campaign.normal.highScore = Math.max(0, parseInt(localStorage.getItem("cpg_hs") || "0"));
  fallback.records.campaign.normal.bestLevel = Math.max(1, parseInt(localStorage.getItem("cpg_bl") || "1"));
  fallback.totals.caught = Math.max(0, parseInt(localStorage.getItem("cpg_tc") || "0"));
  fallback.totals.accidents = Math.max(0, parseInt(localStorage.getItem("cpg_ta") || "0"));
  fallback.totals.poops = Math.max(0, parseInt(localStorage.getItem("cpg_tp") || "0"));
  return fallback;
}

let runProfile = _loadRunProfile();
let runMode = "campaign"; // "campaign" | "endless"; tutorial хранится в gameMode

function getRunRecord(format = runMode, diff = difficulty) {
  const safeFormat = format === "endless" ? "endless" : "campaign";
  const safeDiff = diff === "chaos" ? "chaos" : "normal";
  return runProfile.records[safeFormat][safeDiff];
}

const stats = {
  get highScore() { return getRunRecord().highScore; },
  set highScore(value) { getRunRecord().highScore = Math.max(0, Math.floor(_numberOr(value, 0))); },
  get bestLevel() { return getRunRecord().bestLevel; },
  set bestLevel(value) { getRunRecord().bestLevel = Math.max(1, Math.floor(_numberOr(value, 1))); },
  get totalCaught() { return runProfile.totals.caught; },
  set totalCaught(value) { runProfile.totals.caught = Math.max(0, Math.floor(_numberOr(value, 0))); },
  get totalAccidents() { return runProfile.totals.accidents; },
  set totalAccidents(value) { runProfile.totals.accidents = Math.max(0, Math.floor(_numberOr(value, 0))); },
  get totalPoops() { return runProfile.totals.poops; },
  set totalPoops(value) { runProfile.totals.poops = Math.max(0, Math.floor(_numberOr(value, 0))); },

  save() {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(runProfile));
    // Старые ключи остаются зеркалом активного рекорда для бесшовного отката.
    localStorage.setItem("cpg_hs", this.highScore);
    localStorage.setItem("cpg_bl", this.bestLevel);
    localStorage.setItem("cpg_tc", this.totalCaught);
    localStorage.setItem("cpg_ta", this.totalAccidents);
    localStorage.setItem("cpg_tp", this.totalPoops);
  },

  update(s, l) {
    if (typeof shouldRecordRunStats === "function" && !shouldRecordRunStats()) return;
    const record = getRunRecord();
    if (s > record.highScore) record.highScore = s;
    if (l > record.bestLevel) record.bestLevel = l;
    this.save();
  },

  discoverLocation(key) {
    if (!key || runProfile.unlocks.locations.includes(key)) return;
    runProfile.unlocks.locations.push(key);
    this.save();
  },
};

function unlockAchievement(key) {
  if (!ACHIEVEMENTS.some(item => item.key === key)) return false;
  if (runProfile.unlocks.achievements.includes(key)) return false;
  runProfile.unlocks.achievements.push(key);
  stats.save();
  return true;
}

function _unlockCosmetic(group, key) {
  const list = runProfile.cosmetics[group];
  if (!list.includes(key)) list.push(key);
}

function cycleRunCosmetic(group) {
  const list = runProfile.cosmetics[group];
  if (!list || list.length < 2) return false;
  const settingKey = group === "pawStyles" ? "pawStyle" : "hudFrame";
  const current = list.indexOf(runProfile.settings[settingKey]);
  runProfile.settings[settingKey] = list[(current + 1) % list.length];
  stats.save();
  return true;
}

function getSelectedPawStyle() { return runProfile.settings.pawStyle; }
function getSelectedHudFrame() { return runProfile.settings.hudFrame; }

function _emptyActMetrics(startTimeMs = 0) {
  return {
    startTimeMs,
    shots:0, hits:0, misses:0,
    livesLost:0, riskyBonuses:0,
    levelsCompleted:0, urgeFinishTotal:0,
  };
}

function _emptyTotalMetrics() {
  return {
    shots:0, hits:0, misses:0,
    livesLost:0, riskyBonuses:0,
    levelsCompleted:0, urgeFinishTotal:0,
  };
}

let selectedHabitKeys = [];
let runActMetrics = _emptyActMetrics(0);
let runTotalMetrics = _emptyTotalMetrics();
let runActReports = [];
let currentActReport = null;
let currentHabitChoices = [];
let pendingNextLevel = 1;

function resetRunProgress() {
  selectedHabitKeys = [];
  runActMetrics = _emptyActMetrics(0);
  runTotalMetrics = _emptyTotalMetrics();
  runActReports = [];
  currentActReport = null;
  currentHabitChoices = [];
  pendingNextLevel = 1;
}

function getSelectedHabits() {
  return selectedHabitKeys
    .map(key => RUN_HABITS.find(habit => habit.key === key))
    .filter(Boolean);
}

function getRunEffectScale(field) {
  let scale = 1;
  for (const habit of getSelectedHabits()) {
    if (Number.isFinite(habit.effects[field])) scale *= habit.effects[field];
  }
  return scale;
}

function getRunEffectTicks(field) {
  let ticks = 0;
  for (const habit of getSelectedHabits()) {
    if (Number.isFinite(habit.effects[field])) ticks += habit.effects[field];
  }
  return ticks;
}

function getRunPlayerSpeedScale(urgeRatio) {
  let scale = getRunEffectScale("playerSpeedScale");
  if (urgeRatio > 0.75) scale *= getRunEffectScale("panicSpeedScale");
  return scale;
}

function getRunUrgeRateScale() { return getRunEffectScale("urgeRateScale"); }
function getRunOwnerSpeedScale() { return getRunEffectScale("ownerSpeedScale"); }
function getRunHitReliefScale() { return getRunEffectScale("hitReliefScale"); }
function getRunBonusDurationScale() { return getRunEffectScale("bonusDurationScale"); }
function getRunHeardDurationScale() { return getRunEffectScale("heardDurationScale"); }
function getRunComboWindowTicks() { return 180 + getRunEffectTicks("comboWindowTicks"); }
function getRunPoopTime(baseTicks) { return baseTicks + getRunEffectTicks("poopTimeTicks"); }
function getRunShootCooldown(baseTicks) {
  return Math.max(1, Math.round(baseTicks * getRunEffectScale("shootCooldownScale")));
}

function recordRunShot() {
  if (!shouldRecordRunStats()) return;
  runActMetrics.shots++;
  runTotalMetrics.shots++;
}

function recordRunHit() {
  if (!shouldRecordRunStats()) return;
  runActMetrics.hits++;
  runTotalMetrics.hits++;
}

function recordRunMiss() {
  if (!shouldRecordRunStats()) return;
  runActMetrics.misses++;
  runTotalMetrics.misses++;
}

function recordRunLifeLost() {
  if (!shouldRecordRunStats()) return;
  runActMetrics.livesLost++;
  runTotalMetrics.livesLost++;
}

function recordRiskyBonusPickup(bonus) {
  if (!shouldRecordRunStats() || !bonus || !bonus.risky) return;
  runActMetrics.riskyBonuses++;
  runTotalMetrics.riskyBonuses++;
  if (runTotalMetrics.riskyBonuses >= 5) unlockAchievement("risk_taker");
}

function _rankForScore(value) {
  if (value >= RUN.gradeThresholds.S) return "S";
  if (value >= RUN.gradeThresholds.A) return "A";
  if (value >= RUN.gradeThresholds.B) return "B";
  return "C";
}

function _buildActReport(actNumber) {
  const elapsedMs = Math.max(0, simulationTimeMs - runActMetrics.startTimeMs);
  const seconds = Math.round(elapsedMs / 1000);
  const shots = runActMetrics.shots;
  const hits = runActMetrics.hits;
  const accuracy = shots > 0 ? hits / shots : 0.5;
  const avgUrge = runActMetrics.levelsCompleted > 0
    ? runActMetrics.urgeFinishTotal / runActMetrics.levelsCompleted : 100;

  const timePoints = clamp(30 - Math.max(0, seconds - 120) * 0.15, 5, 30);
  const urgePoints = clamp((100 - avgUrge) * 0.25, 0, 25);
  const accuracyPoints = accuracy * 20;
  const livesPoints = clamp(20 - runActMetrics.livesLost * 7, 0, 20);
  const riskPoints = Math.min(5, runActMetrics.riskyBonuses);
  const gradeScore = Math.round(timePoints + urgePoints + accuracyPoints + livesPoints + riskPoints);

  return {
    actNumber,
    seconds,
    avgUrge:Math.round(avgUrge),
    shots,
    hits,
    misses:Math.max(runActMetrics.misses, shots - hits),
    accuracy:Math.round(accuracy * 100),
    livesLost:runActMetrics.livesLost,
    riskyBonuses:runActMetrics.riskyBonuses,
    gradeScore,
    rank:_rankForScore(gradeScore),
  };
}

function _habitChoicesForAct(actNumber) {
  if (selectedHabitKeys.length >= RUN.maxHabits) return [];
  const available = RUN_HABITS.filter(habit => !selectedHabitKeys.includes(habit.key));
  const rng = createRng((globalSeed ^ Math.imul(actNumber, 0x45D9F3B)) & 0x7FFFFFFF);
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, 3);
}

function _finalizeCurrentAct(actNumber) {
  const report = _buildActReport(actNumber);
  runActReports.push(report);
  currentActReport = report;
  if (actNumber === 1) unlockAchievement("first_act");
  if (report.shots >= 4 && report.accuracy >= 75) unlockAchievement("sharpshooter");
  return report;
}

function _resetTransientRunEffects() {
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  catnipTimer = 0;
  comboCount = 0;
  comboTimer = 0;
  shootCooldown = 0;
}

function _startPendingLevel() {
  level = pendingNextLevel;
  runActMetrics = _emptyActMetrics(simulationTimeMs);
  _resetTransientRunEffects();
  generateLevel();
  syncLocationMelody();
  owner.activate();
  levelMessageTimer = 180;
  gameState = "playing";
  startMelody();
}

function chooseActHabit(index) {
  if (gameState !== "actComplete") return false;
  if (currentHabitChoices.length === 0) {
    _startPendingLevel();
    return true;
  }
  const habit = currentHabitChoices[index];
  if (!habit) return false;
  selectedHabitKeys.push(habit.key);
  _startPendingLevel();
  return true;
}

function _completeCampaign() {
  const record = getRunRecord("campaign", difficulty);
  record.wins++;
  record.highScore = Math.max(record.highScore, score);
  record.bestLevel = Math.max(record.bestLevel, RUN.campaignLevels);
  const elapsed = Math.round(simulationTimeMs);
  if (record.bestTimeMs === 0 || elapsed < record.bestTimeMs) record.bestTimeMs = elapsed;
  const rankOrder = { C:1, B:2, A:3, S:4 };
  const finalRank = currentActReport ? currentActReport.rank : "C";
  if (!record.bestRank || rankOrder[finalRank] > rankOrder[record.bestRank]) record.bestRank = finalRank;

  runProfile.unlocks.endless = true;
  _unlockCosmetic("pawStyles", "spark");
  _unlockCosmetic("hudFrames", "gold");
  runProfile.settings.pawStyle = "spark";
  runProfile.settings.hudFrame = "gold";
  unlockAchievement("campaign_win");
  if (runTotalMetrics.livesLost === 0) unlockAchievement("survivor");
  if (difficulty === "chaos") {
    _unlockCosmetic("pawStyles", "shadow");
    _unlockCosmetic("hudFrames", "danger");
    runProfile.settings.pawStyle = "shadow";
    runProfile.settings.hudFrame = "danger";
    unlockAchievement("chaos_win");
  }
  stats.save();
}

function getRunFailureTip() {
  const shots = runTotalMetrics.shots;
  const accuracy = shots > 0 ? runTotalMetrics.hits / shots : 1;
  const avgUrge = runTotalMetrics.levelsCompleted > 0
    ? runTotalMetrics.urgeFinishTotal / runTotalMetrics.levelsCompleted : player.urge;
  if (lifeLostReason === "accident") return "Ищи таблетки и не откладывай путь к лотку.";
  if (runTotalMetrics.livesLost >= 2) return "Попробуй раньше разрывать видимость и беречь жизни.";
  if (shots >= 5 && accuracy < 0.45) return "Стреляй только по чистой линии — промахи не дают облегчения.";
  if (avgUrge > 70) return "Ищи таблетки и не откладывай путь к лотку.";
  if (runTotalMetrics.riskyBonuses === 0) return "Боковые бонусы могут окупить опасный маршрут.";
  return "Сохрани сильную привычку и смени маршрут в следующем забеге.";
}

function completeScoredLevel() {
  const completedLevel = level;
  const earned = Math.max(1, Math.floor((1 - player.urge / player.maxUrge) * 10) + completedLevel);
  score += earned;
  runActMetrics.levelsCompleted++;
  runActMetrics.urgeFinishTotal += player.urge;
  runTotalMetrics.levelsCompleted++;
  runTotalMetrics.urgeFinishTotal += player.urge;
  stats.update(score, completedLevel);

  player.urge = clamp(player.urge - 30, 0, player.maxUrge);
  updateUrgencyFeedback(player.urge / player.maxUrge);
  _resetTransientRunEffects();
  spawnConfetti(litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height / 2);
  sndWin();

  const actEnded = completedLevel % ACT.length === 0;
  if (runMode === "campaign" && completedLevel >= RUN.campaignLevels) {
    _finalizeCurrentAct(Math.ceil(completedLevel / ACT.length));
    _completeCampaign();
    gameState = "win";
    overlayTimer = 0;
    stopPanicMelody();
    stopMelody();
    return;
  }

  pendingNextLevel = completedLevel + 1;
  if (actEnded) {
    const actNumber = Math.ceil(completedLevel / ACT.length);
    _finalizeCurrentAct(actNumber);
    currentHabitChoices = _habitChoicesForAct(actNumber);
    gameState = "actComplete";
    overlayTimer = 0;
    stopPanicMelody();
    stopMelody();
    return;
  }

  level = pendingNextLevel;
  generateLevel();
  syncLocationMelody();
  owner.activate();
  levelMessageTimer = 180;
}

function runProgressLabel() {
  if (runMode === "endless") return "Уровень " + level + " · Endless";
  const completed = gameState === "win" ? RUN.campaignLevels : Math.max(0, level - 1);
  return "Пройдено " + completed + "/" + RUN.campaignLevels + " · Акт " +
    Math.min(5, Math.floor(completed / ACT.length) + 1) + "/5";
}
