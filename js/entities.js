// ==========================================
// ENTITIES — player and owner objects
// ==========================================

// ===== ПАНИКА =====
let panicShake = 0;
let alarmTimer = 0;

// ===== ЛОТОК — таймер покакания =====
let poopProgress = 0;   // 0..poopTime — сколько кадров кот стоит на лотке
let isPooping = false;  // кот сейчас на лотке и "делает дело"

// ===== ИГРОК =====
const player = {
  x: 90, y: 400, size: 48, speed: 3.9,
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
      ctx.fillStyle = "#fff"; ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
      ctx.fillText("🐱", this.x+this.size/2, this.y+this.size/2+10);
      ctx.textAlign = "left";
    });
    // Бонус-иконки над котом
    let iconX = this.x;
    if (speedBoostTimer > 0) { ctx.font = "18px Arial"; ctx.fillText("🐟", iconX, this.y-6); iconX += 22; }
    if (yarnFreezeTimer > 0) { ctx.font = "18px Arial"; ctx.fillText("🧶", iconX, this.y-6); }
    ctx.restore();
  },

  update() {
    const diff = DIFF[difficulty];
    const b = getPlayBounds();
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

    // Срочность
    const urgeRate = diff.urgeRate * (1 + (level-1)*0.08);
    this.urge = clamp(this.urge + urgeRate/60, 0, this.maxUrge);

    // Паника
    const urgeRatio = this.urge / this.maxUrge;
    if (urgeRatio > 0.75) {
      panicShake = clamp((urgeRatio-0.75)/0.25*8, 0, 8);
      alarmTimer++;
      if (alarmTimer % 36 === 0) sndAlarm();
    } else {
      panicShake = 0; alarmTimer = 0;
    }

    // Авария
    if (this.urge >= this.maxUrge) {
      stats.totalAccidents++;
      stats.update(score, level);
      spawnPuddle(this.x+this.size/2, this.y+this.size/2);
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

// ===== ХОЗЯИН =====
const owner = {
  x: 800, y: 300, width: 52, height: 72,
  active: false, speed: 1.0,
  // Анти-залипание
  stuckTimer: 0,
  lastX: 800, lastY: 300,
  stuckNudge: null,
  // Бегство после комбо
  fleeTimer: 0,
  fleeTarget: null,

  activate() {
    const diff = DIFF[difficulty];
    if (level < diff.firstLvl) { this.active = false; return; }
    this.active = true;
    this.speed = diff.baseSpd + (level-1)*diff.spdPerLvl;
    const b = getPlayBounds();
    const corners = [
      {x:b.right-this.width-20, y:b.top+20},
      {x:b.right-this.width-20, y:b.bottom-this.height-20},
      {x:b.left+20,             y:b.top+20},
    ];
    let best = corners[0], bestDist = 0;
    for (const c of corners) {
      const dx = c.x-player.x, dy = c.y-player.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d > bestDist) { bestDist = d; best = c; }
    }
    this.x = best.x; this.y = best.y;
    this.lastX = this.x; this.lastY = this.y;
    this.stuckTimer = 0; this.stuckNudge = null;
    this.fleeTimer = 0; this.fleeTarget = null;
  },

  // Запускает режим бегства — хозяин убегает в дальний угол от кота
  flee() {
    const b = getPlayBounds();
    const corners = [
      {x:b.right-this.width-20, y:b.top+20},
      {x:b.right-this.width-20, y:b.bottom-this.height-20},
      {x:b.left+20,             y:b.top+20},
      {x:b.left+20,             y:b.bottom-this.height-20},
    ];
    let best = corners[0], bestDist = 0;
    for (const c of corners) {
      const dx = c.x - player.x, dy = c.y - player.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d > bestDist) { bestDist = d; best = c; }
    }
    this.fleeTarget = best;
    this.fleeTimer = 300; // 5 секунд при 60fps
  },

  draw() {
    if (!this.active) return;
    // Мигание во время бегства
    if (this.fleeTimer > 0 && Math.floor(this.fleeTimer / 8) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }
    drawSprite(masterImage, this.x, this.y, this.width, this.height, () => {
      ctx.fillStyle = "#e07b39"; ctx.beginPath();
      ctx.arc(this.x+this.width/2, this.y+this.height/2, this.width/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
      ctx.fillText("👨", this.x+this.width/2, this.y+this.height/2+10);
      ctx.textAlign = "left";
    });
    ctx.globalAlpha = 1;
  },

  update() {
    if (!this.active) return;
    if (yarnFreezeTimer > 0) return;

    const b = getPlayBounds();

    // Режим бегства: двигаемся к fleeTarget, а не к коту
    if (this.fleeTimer > 0) {
      this.fleeTimer--;
      const tx = this.fleeTarget.x;
      const ty = this.fleeTarget.y;
      let dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      // Если добрались до угла — просто стоим там до конца таймера
      if (dist > 2) {
        dx /= dist; dy /= dist;
        const spd = this.speed * 1.4; // убегает чуть быстрее обычного
        const nx = this.x + dx*spd;
        const ny = this.y + dy*spd;
        const nrX = {x:nx,     y:this.y, width:this.width, height:this.height};
        const nrY = {x:this.x, y:ny,     width:this.width, height:this.height};
        if (!hitsObstacles(nrX) && nx >= b.left && nx <= b.right-this.width)   this.x = nx;
        if (!hitsObstacles(nrY) && ny >= b.top  && ny <= b.bottom-this.height) this.y = ny;
      }
      this.lastX = this.x; this.lastY = this.y;
      return; // не преследуем кота во время бегства
    }

    const spd = this.speed;
    const tx = player.x + player.size/2 - this.width/2;
    const ty = player.y + player.size/2 - this.height/2;
    let dx = tx - this.x, dy = ty - this.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist > 1) { dx /= dist; dy /= dist; }

    // Применяем nudge при залипании
    if (this.stuckNudge) {
      dx += this.stuckNudge.x;
      dy += this.stuckNudge.y;
      // Нормализуем обратно
      const len = Math.sqrt(dx*dx+dy*dy);
      if (len > 0) { dx /= len; dy /= len; }
    }

    const nx = this.x + dx*spd;
    const ny = this.y + dy*spd;

    // FIX: раздельная проверка осей — хозяин скользит вдоль препятствий
    // вместо того чтобы залипать на углах
    const nrX = {x:nx,      y:this.y, width:this.width, height:this.height};
    const nrY = {x:this.x,  y:ny,     width:this.width, height:this.height};
    if (!hitsObstacles(nrX) && nx >= b.left && nx <= b.right-this.width)   this.x = nx;
    if (!hitsObstacles(nrY) && ny >= b.top  && ny <= b.bottom-this.height) this.y = ny;

    // Детектор залипания: если почти не двигался — накапливаем таймер
    const moved = Math.abs(this.x - this.lastX) + Math.abs(this.y - this.lastY);
    if (moved < 0.5) {
      this.stuckTimer++;
      if (this.stuckTimer > 30) {
        // Случайный боковой толчок для выхода из угла
        this.stuckNudge = {
          x: (Math.random()-0.5) * 2,
          y: (Math.random()-0.5) * 2,
        };
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckNudge = null;
    }
    this.lastX = this.x;
    this.lastY = this.y;

    // Поймал кота
    if (rectsOverlap(playerRect(), ownerRect(), -6)) {
      stats.totalCaught++;
      stats.update(score, level);
      stopMelody();
      lives--;
      if (lives <= 0) {
        gameState = "caught";
        overlayTimer = 0;
        sndHit(); sndLose();
      } else {
        gameState = "lifeLost";
        lifeLostTimer = 150;
        lifeLostReason = "caught";
        sndHit(); sndLifeLost();
      }
    }
  },
};
