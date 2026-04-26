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

// ===== КЛАВИШИ =====
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  // M — мьют работает в любом состоянии игры
  if (e.key === "m" || e.key === "M") {
    toggleMute();
    return;
  }
  if (gameState === "start") {
    if (e.key === "1") difficulty = "easy";
    if (e.key === "2") difficulty = "normal";
    if (e.key === "3") difficulty = "chaos";
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const order = ["easy", "normal", "chaos"];
      const idx = order.indexOf(difficulty);
      difficulty = order[(idx + (e.key === "ArrowDown" ? 1 : -1) + 3) % 3];
    }
    if (e.key === "Enter" || e.key === " ") startGame();
  } else if (gameState === "playing") {
    if (e.key === " " || e.key === "x" || e.key === "X") shootPoop();
  } else if (gameState === "lifeLost") {
    // Enter/пробел — пропустить ожидание и сразу возобновить
    if (e.key === "Enter" || e.key === " ") respawnPlayer();
  } else if (gameState === "win" || gameState === "lose" || gameState === "caught" || gameState === "accident") {
    if (e.key === "Enter" || e.key === " ") { gameState = "start"; }
  }
});
window.addEventListener("keyup", e => { keys[e.key] = false; });

// ===== СТАРТ ИГРЫ =====
function startGame() {
  globalSeed = Date.now() & 0x7FFFFFFF; // timestamp-based seed, positive 31-bit int
  score = 0; level = 1; lives = 3;
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  poops.length = 0; overlayParticles.length = 0; comboPopups.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false;
  generateLevel();
  owner.activate();
  sndMeow();
  gameState = "playing";
  stopPanicMelody();
  startMelody();
}

// ===== ВОЗОБНОВЛЕНИЕ ПОСЛЕ ПОТЕРИ ЖИЗНИ =====
function respawnPlayer() {
  const b = getPlayBounds();
  player.x = b.left + 60;
  player.y = b.top + (b.bottom - b.top) / 2 - player.size / 2;
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  poops.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0; isPooping = false;
  owner.activate();
  sndMeow();
  gameState = "playing";
  startMelody();
}

// ===== ОБНОВЛЕНИЕ =====
function update() {
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
  player.update();
  owner.update();
  updatePoops();
  updateBonuses();
  updateObstacles();
  updateOverlayParticles();
  updateComboPopups();
}

// ===== ИГРОВОЙ ЦИКЛ =====
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
generateLevel();
gameLoop();
