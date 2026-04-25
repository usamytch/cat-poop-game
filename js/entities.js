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

  // A* навигация
  path: [],           // [{col, row}, ...] — текущий путь по сетке
  pathTimer: 0,       // пересчитываем путь каждые N кадров
  PATH_RECALC: 45,    // пересчёт каждые 45 кадров (~0.75 сек)

  // Бегство после комбо
  fleeTimer: 0,
  fleeTarget: null,

  // Какашки на лице
  poopHits: 0,
  facePoops: [],

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
    // Sort corners farthest-first from player
    corners.sort((a, c) => {
      const da = Math.sqrt((a.x-player.x)**2 + (a.y-player.y)**2);
      const dc = Math.sqrt((c.x-player.x)**2 + (c.y-player.y)**2);
      return dc - da;
    });
    // Pick the farthest corner that doesn't overlap any obstacle
    let best = null;
    for (const c of corners) {
      if (!hitsObstacles({x:c.x, y:c.y, width:this.width, height:this.height})) {
        best = c; break;
      }
    }
    // Fallback: spiral outward from the best corner to find a free grid cell
    if (!best) {
      const fc = corners[0];
      const ownerWCells = Math.ceil(this.width / GRID);
      const ownerHCells = Math.ceil(this.height / GRID);
      const startCell = pixelToCell(fc.x + this.width/2, fc.y + this.height/2);
      outer: for (let radius = 0; radius <= 6; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
            const col = startCell.col + dc;
            const row = startCell.row + dr;
            if (col < 0 || row < 0 || col + ownerWCells > GRID_COLS || row + ownerHCells > GRID_ROWS) continue;
            if (!cellsFree(col, row, ownerWCells, ownerHCells)) continue;
            const pos = cellToPixel(col, row);
            best = {x: pos.x, y: pos.y};
            break outer;
          }
        }
      }
      if (!best) best = fc; // absolute fallback
    }
    this.x = best.x; this.y = best.y;
    this.path = [];
    this.pathTimer = 0;
    this.fleeTimer = 0; this.fleeTarget = null;
    this.poopHits = 0; this.facePoops = [];
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
    this.path = [];
    this.pathTimer = 0;
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
    // Рисуем какашки на лице хозяина
    if (this.facePoops.length > 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height * 0.32;
      ctx.save();
      for (const sp of this.facePoops) {
        ctx.save();
        ctx.translate(cx + sp.rx, cy + sp.ry);
        ctx.rotate(sp.rot);
        ctx.scale(sp.scale, sp.scale);
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💩", 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },

  // ===== A* ДВИЖЕНИЕ К ЦЕЛИ =====
  _moveTowardTarget(tx, ty, spd) {
    const b = getPlayBounds();

    // Текущая ячейка хозяина (центр)
    const ownerCx = this.x + this.width / 2;
    const ownerCy = this.y + this.height / 2;
    const ownerCell = pixelToCell(ownerCx, ownerCy);

    // Целевая ячейка
    const goalCell = pixelToCell(tx + this.width / 2, ty + this.height / 2);

    // Пересчитываем путь по таймеру или если путь кончился
    this.pathTimer--;
    if (this.pathTimer <= 0 || this.path.length === 0) {
      this.pathTimer = this.PATH_RECALC;
      const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row);
      this.path = newPath ? newPath : [];
    }

    // Определяем направление движения
    let dx = 0, dy = 0;

    if (this.path.length >= 2) {
      // Следующая ячейка в пути (пропускаем текущую [0])
      const nextCell = this.path[1];
      const nextPx = cellToPixelCenter(nextCell.col, nextCell.row);

      dx = nextPx.x - ownerCx;
      dy = nextPx.y - ownerCy;
      const dist = Math.sqrt(dx*dx + dy*dy);

      // Если достигли центра следующей ячейки — переходим к следующей
      if (dist < spd + 2) {
        this.path.shift();
      } else {
        dx /= dist;
        dy /= dist;
      }
    } else {
      // Нет пути или уже в цели — двигаемся напрямую
      dx = tx - this.x;
      dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 1) { dx /= dist; dy /= dist; }
    }

    // Применяем движение с раздельной проверкой осей (скольжение вдоль стен)
    const nx = this.x + dx * spd;
    const ny = this.y + dy * spd;
    const nrX = {x:nx,      y:this.y, width:this.width, height:this.height};
    const nrY = {x:this.x,  y:ny,     width:this.width, height:this.height};
    if (!hitsObstacles(nrX) && nx >= b.left && nx <= b.right  - this.width)  this.x = nx;
    if (!hitsObstacles(nrY) && ny >= b.top  && ny <= b.bottom - this.height) this.y = ny;
  },

  update() {
    if (!this.active) return;
    if (yarnFreezeTimer > 0) return;

    const b = getPlayBounds();

    // Режим бегства: двигаемся к fleeTarget
    if (this.fleeTimer > 0) {
      this.fleeTimer--;
      const tx = this.fleeTarget.x;
      const ty = this.fleeTarget.y;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 2) {
        this._moveTowardTarget(tx, ty, this.speed * 1.4);
      }
      // Вернулся из угла (fleeTimer только что стал 0) — очищаем какашки с лица
      if (this.fleeTimer === 0 && this.facePoops.length > 0 && this.poopHits >= 3) {
        this.facePoops = [];
        this.poopHits = 0;
      }
      return;
    }

    // Вернулся из угла — очищаем какашки с лица
    if (this.facePoops.length > 0 && this.poopHits >= 3) {
      this.facePoops = [];
      this.poopHits = 0;
    }

    // Преследование кота через A*
    const tx = player.x + player.size/2 - this.width/2;
    const ty = player.y + player.size/2 - this.height/2;
    this._moveTowardTarget(tx, ty, this.speed);

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
