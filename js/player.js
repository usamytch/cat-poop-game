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
let litterCueStep = -1;

// ===== ИГРОК =====
const player = {
  x: 90, y: 400, size: 36, speed: 3.9,
  urge: 0, maxUrge: 100,
  pooping: false, poopTimer: 0,
  visualMotion: 0,
  visualDirX: 1,
  visualDirY: 0,

  draw() {
    const urgeRatio = this.urge / this.maxUrge;
    const panic = urgencyFeedbackStage > 0;
    const sx = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    const sy = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    const visualSize = FEEDBACK.playerVisualSize;
    const visualHalf=visualSize/2+3;
    const cx = clamp(this.x+this.size/2+sx,visualHalf,WORLD.width-visualHalf);
    const cy = clamp(this.y+this.size/2+sy,getPlayBounds().top+visualHalf,getPlayBounds().bottom-visualHalf);
    const gait = Math.sin(_now * 0.018) * this.visualMotion;
    let scaleX = 1 + gait * 0.055;
    let scaleY = 1 - gait * 0.045;
    let rotation = this.visualDirX * this.visualMotion * 0.075;
    if (isPooping) {
      const poopTime = getRunPoopTime(DIFF[difficulty].poopTime);
      const settle = clamp(poopProgress / Math.max(1, poopTime * 0.2), 0, 1);
      scaleX = 1 + settle * 0.14;
      scaleY = 1 - settle * 0.23 + Math.sin(_now * 0.025) * 0.018;
      rotation = Math.sin(_now * 0.012) * 0.025;
    }
    drawCollageSprite(catImage, cx, cy, visualSize, {
      scaleX, scaleY, rotation,
      overlay: function(size) {
        if (basementMode === "") return;
        const blinking = Math.sin(_now * 0.0018) > 0.96;
        if (blinking) return;
        ctx.save();
        ctx.shadowColor = "rgba(180,255,80,0.9)"; ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(200,255,100,0.92)";
        ctx.beginPath(); ctx.ellipse(-size*0.06, size*0.08, 3.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(size*0.25, size*0.06, 3.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      },
    }, function(x, y, size) {
      ctx.fillStyle="#f5a623"; ctx.fillRect(x,y,size,size);
      ctx.fillStyle="#fff"; ctx.font="bold 24px Arial"; ctx.textAlign="center";
      ctx.fillText("🐱",0,8); ctx.textAlign="left";
    });
    // Бонус-иконки над котом
    let iconX = cx - visualSize/2;
    if (speedBoostTimer > 0) { drawEmoji("🐟", iconX+9,cy-visualSize/2-5,18); iconX+=22; }
    if (yarnFreezeTimer > 0) drawEmoji("🧶",iconX+9,cy-visualSize/2-5,18);
  },

  update() {
    const diff = DIFF[difficulty];
    const b = getPlayBounds();

    // Гарантия: кот не может быть внутри препятствия (напр. из-за движущегося)
    escapeObstacles(this);

    const currentUrgeRatio = this.urge / this.maxUrge;
    const spd = this.speed *
      (speedBoostTimer > 0 ? 1.7 : 1.0) *
      getRunPlayerSpeedScale(currentUrgeRatio);
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"]  || keys["a"] || keys["A"]) { dx = -1; lastDir = {x:-1, y:0}; }
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) { dx =  1; lastDir = {x: 1, y:0}; }
    if (keys["ArrowUp"]    || keys["w"] || keys["W"]) { dy = -1; lastDir = {x:0, y:-1}; }
    if (keys["ArrowDown"]  || keys["s"] || keys["S"]) { dy =  1; lastDir = {x:0, y: 1}; }
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const movement = applyLocationPlayerMovementRule(this, dx, dy, spd);
    const oldX = this.x;
    const oldY = this.y;
    const nx = clamp(this.x+movement.stepX, b.left, b.right-this.size);
    const ny = clamp(this.y+movement.stepY, b.top,  b.bottom-this.size);
    if (!hitsObstacles(playerRect(nx, this.y))) this.x = nx;
    else onLocationRuleCollision("x");
    if (!hitsObstacles(playerRect(this.x, ny))) this.y = ny;
    else onLocationRuleCollision("y");
    const moved = Math.abs(this.x - oldX) > 0.01 || Math.abs(this.y - oldY) > 0.01;
    this.visualMotion += ((moved ? 1 : 0) - this.visualMotion) * 0.22;
    if (moved) {
      const len = Math.sqrt(movement.stepX*movement.stepX + movement.stepY*movement.stepY) || 1;
      this.visualDirX = movement.stepX / len;
      this.visualDirY = movement.stepY / len;
    }
    updateLocationPlayerPresence(this, moved);

    // Следы лапок — спавним при движении
    if (moved) {
      spawnPawTrail(this.x + this.size / 2, this.y + this.size * 0.75);
    }

    // Срочность растёт по актовому effectiveLevel и ограничена мягким капом.
    const urgeRate = diff.urgeRate * getUrgeScale(level) * getRunUrgeRateScale();
    this.urge = clamp(this.urge + urgeRate/60, 0, this.maxUrge);

    // Паника
    const urgeRatio = this.urge / this.maxUrge;
    updateUrgencyFeedback(urgeRatio);
    const inPanic = urgencyFeedbackStage > 0;
    if (inPanic) {
      panicShake = clamp((urgeRatio-0.75)/0.25*8, 0, 8);
      alarmTimer++;
      const alarmDue = urgencyFeedbackStage === 1
        ? alarmTimer % 48 === 0
        : urgencyFeedbackStage === 2
          ? alarmTimer % 30 === 0
          : alarmTimer % 46 === 0 || alarmTimer % 46 === 17;
      if (alarmDue) {
        sndAlarm(urgencyFeedbackStage);
        if (urgencyFeedbackStage >= 3) sndBodyPulse((urgeRatio-0.95)/0.05);
      }
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
    }

    // Авария
    if (this.urge >= this.maxUrge) {
      if (tutorialHandleFailure()) return;
      stats.totalAccidents++;
      stats.update(score, level);
      spawnPuddle(this.x+this.size/2, this.y+this.size/2);
      stopPanicMelody();
      stopMelody();
      lives--;
      recordRunLifeLost();
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
    const onLitter = rectsOverlap(pr, lr) && tutorialCanUseLitter();
    if (onLitter) {
      const poopTime = getRunPoopTime(DIFF[difficulty].poopTime);
      poopProgress++;
      isPooping = true;
      const holdRatio = poopProgress / poopTime;
      const cueStep = holdRatio >= 0.9 ? 3 : holdRatio >= 0.62 ? 2 : holdRatio >= 0.3 ? 1 : 0;
      if (cueStep > litterCueStep) {
        if (cueStep === 0) sndLitterStart(); else sndLitterStep(cueStep);
        litterCueStep = cueStep;
      }
      if (poopProgress >= poopTime) {
        // Успешно покакал!
        sndLitterComplete();
        poopProgress = 0; isPooping = false; litterCueStep = -1;
        if (isTutorialActive()) {
          spawnConfetti(litterBox.x+litterBox.width/2, litterBox.y+litterBox.height/2);
          sndWin();
          completeTutorialStage();
          return;
        }
        completeScoredLevel();
        return;
      }
    } else {
      // Ушёл с лотка — сбрасываем прогресс
      if (poopProgress > 0) poopProgress = 0;
      isPooping = false; litterCueStep = -1;
    }

    // Подбор бонусов
    for (const b of bonuses) {
      if (!b.alive) continue;
      const br = {x:b.x-20, y:b.y-20, width:40, height:40};
      if (rectsOverlap(pr, br)) {
        applyBonus(b.type);
        recordRiskyBonusPickup(b);
        tutorialOnBonusPicked(b.type);
        b.alive = false;
        sndPickup();
      }
    }

    // Таймеры бонусов
    if (speedBoostTimer > 0) speedBoostTimer--;
    if (yarnFreezeTimer > 0) yarnFreezeTimer--;
    if (shootCooldown > 0) shootCooldown--;
    if (this.poopTimer > 0) this.poopTimer--;
  },
};
