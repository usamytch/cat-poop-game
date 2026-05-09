// ==========================================
// PLAYER — cat object, urge, litter box, panic
// ==========================================

// ===== ПАНИКА =====
let panicShake = 0;
let alarmTimer = 0;
let panicFlashAlpha = 0;   // 0..1 — текущая яркость красной вспышки (убывает каждый кадр)
let panicFlashTimer = 0;   // счётчик для триггера вспышки каждые ~60 кадров

// ===== ЛОТОК — таймер покакания =====
let poopProgress = 0;   // 0..poopTime — сколько кадров кот стоит на лотке
let isPooping = false;  // кот сейчас на лотке и "делает дело"

// ===== ИГРОК =====
const player = {
  x: 90, y: 400, size: 36, speed: 3.9,
  urge: 0, maxUrge: 100,
  pooping: false, poopTimer: 0,

  draw() {
    const urgeRatio = this.urge / this.maxUrge;
    const panic = urgeRatio > 0.75;
    const sx = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    const sy = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    ctx.save(); ctx.translate(sx, sy);
    drawSprite(catImage, this.x, this.y, this.size, this.size, () => {
      ctx.fillStyle = "#f5a623"; ctx.beginPath();
      ctx.arc(this.x+this.size/2, this.y+this.size/2, this.size/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
      ctx.fillText("🐱", this.x+this.size/2, this.y+this.size/2+8);
      ctx.textAlign = "left";
    });
    // Бонус-иконки над котом
    let iconX = this.x;
    if (speedBoostTimer > 0) { drawEmoji("🐟", iconX + 9, this.y - 6 + 9, 18); iconX += 22; }
    if (yarnFreezeTimer > 0) { drawEmoji("🧶", iconX + 9, this.y - 6 + 9, 18); }

    // Светящиеся глаза в подвале
    if (basementMode !== "") {
      // Моргание: ~раз в 3.5 сек глаза закрыты на мгновение
      const blinking = Math.sin(_now * 0.0018) > 0.96;
      if (!blinking) {
        ctx.save();
        ctx.shadowColor = "rgba(180,255,80,0.9)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(200,255,100,0.92)";
        // Абсолютные пиксели по спрайту cat.png (36×36px):
        // левый глаз ≈ (16, 21), правый глаз ≈ (28, 20)
        ctx.beginPath();
        ctx.ellipse(this.x + 16, this.y + 21, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(this.x + 28, this.y + 20, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  },

  update() {
    const diff = DIFF[difficulty];
    const b = getPlayBounds();

    // Гарантия: кот не может быть внутри препятствия (напр. из-за движущегося)
    escapeObstacles(this);

    const spd = this.speed * (speedBoostTimer > 0 ? 1.7 : 1.0);
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) { dx = -1; lastDir = {x:-1, y:0}; }
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) { dx =  1; lastDir = {x: 1, y:0}; }
    if (keys["ArrowUp"]    || keys["w"] || keys["W"]) { dy = -1; lastDir = {x:0, y:-1}; }
    if (keys["ArrowDown"]  || keys["s"] || keys["S"]) { dy =  1; lastDir = {x:0, y: 1}; }
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const nx = clamp(this.x+dx*spd, b.left, b.right-this.size);
    const ny = clamp(this.y+dy*spd, b.top,  b.bottom-this.size);
    if (!hitsObstacles(playerRect(nx, this.y))) this.x = nx;
    if (!hitsObstacles(playerRect(this.x, ny))) this.y = ny;

    // Следы лапок — спавним при движении
    if (dx !== 0 || dy !== 0) {
      spawnPawTrail(this.x + this.size / 2, this.y + this.size * 0.75);
    }

    // Срочность — рост ограничен мягким капом ×1.8 (достигается ~на уровне 11)
    const urgeRate = diff.urgeRate * Math.min(1 + (level-1)*0.08, 1.8);
    this.urge = clamp(this.urge + urgeRate/60, 0, this.maxUrge);

    // Паника
    const urgeRatio = this.urge / this.maxUrge;
    const inPanic = urgeRatio > 0.75;
    if (inPanic) {
      panicShake = clamp((urgeRatio-0.75)/0.25*8, 0, 8);
      alarmTimer++;
      if (alarmTimer % 36 === 0) sndAlarm();
      // Переключаем на паника-мелодию при пересечении порога
      if (_panicStartTime === null) startPanicMelody();
      // Красная вспышка — триггер каждые ~60 кадров, интенсивность растёт с urge
      panicFlashTimer++;
      const flashInterval = Math.round(60 - (urgeRatio - 0.75) / 0.25 * 30); // 60→30 кадров
      if (panicFlashTimer >= flashInterval) {
        panicFlashAlpha = 0.18 + (urgeRatio - 0.75) / 0.25 * 0.22; // 0.18..0.40
        panicFlashTimer = 0;
      }
      // Убываем вспышку каждый кадр
      if (panicFlashAlpha > 0) panicFlashAlpha = Math.max(0, panicFlashAlpha - 0.025);
    } else {
      panicShake = 0; alarmTimer = 0; panicFlashTimer = 0; panicFlashAlpha = 0;
      // Возвращаем обычную мелодию, если паника прошла (напр. таблетка)
      if (_panicStartTime !== null) {
        stopPanicMelody();
        startMelody();
      }
    }

    // Авария
    if (this.urge >= this.maxUrge) {
      stats.totalAccidents++;
      stats.update(score, level);
      spawnPuddle(this.x+this.size/2, this.y+this.size/2);
      stopPanicMelody();
      stopMelody();
      lives--;
      if (lives <= 0) {
        gameState = "accident";
        overlayTimer = 0;
        sndLose();
      } else {
        gameState = "lifeLost";
        lifeLostTimer = 150; // 2.5 сек при 60fps
        lifeLostReason = "accident";
        sndLifeLost();
      }
      return;
    }

    // Лоток — нужно постоять poopTime кадров чтобы покакать
    const pr = playerRect();
    const lr = {x:litterBox.x, y:litterBox.y, width:litterBox.width, height:litterBox.height};
    const onLitter = rectsOverlap(pr, lr);
    if (onLitter) {
      const poopTime = DIFF[difficulty].poopTime;
      poopProgress++;
      isPooping = true;
      if (poopProgress >= poopTime) {
        // Успешно покакал!
        poopProgress = 0; isPooping = false;
        score += Math.max(1, Math.floor((1 - this.urge/this.maxUrge)*10) + level);
        stats.update(score, level);
        level++;
        this.urge = clamp(this.urge - 30, 0, this.maxUrge);
        speedBoostTimer = 0; yarnFreezeTimer = 0;
        comboCount = 0; comboTimer = 0;
        spawnConfetti(litterBox.x+litterBox.width/2, litterBox.y+litterBox.height/2);
        generateLevel();
        owner.activate();
        sndWin();
        levelMessageTimer = 180;
      }
    } else {
      // Ушёл с лотка — сбрасываем прогресс
      if (poopProgress > 0) poopProgress = 0;
      isPooping = false;
    }

    // Подбор бонусов
    for (const b of bonuses) {
      if (!b.alive) continue;
      const br = {x:b.x-20, y:b.y-20, width:40, height:40};
      if (rectsOverlap(pr, br)) { applyBonus(b.type); b.alive = false; sndPickup(); }
    }

    // Таймеры бонусов
    if (speedBoostTimer > 0) speedBoostTimer--;
    if (yarnFreezeTimer > 0) yarnFreezeTimer--;
    if (shootCooldown > 0) shootCooldown--;
    if (this.poopTimer > 0) this.poopTimer--;
  },
};
