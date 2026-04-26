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
  x: 800, y: 300, width: 36, height: 52,
  active: false, speed: 1.0,

  // A* навигация
  path: [],           // [{col, row}, ...] — текущий путь по сетке
  pathTimer: 0,       // пересчитываем путь каждые N кадров
  PATH_RECALC: 30,    // пересчёт каждые 30 кадров (~0.5 сек)

  // Бегство после комбо
  fleeTimer: 0,
  fleeTarget: null,

  // Какашки на лице
  poopHits: 0,
  facePoops: [],

  // Анти-застревание
  stuckTimer: 0,      // кадры без значимого движения
  stuckNudge: null,   // временный вектор "толчка" при застревании
  lastX: 800,
  lastY: 300,

  // Человечность
  driftAngle: 0,      // текущее угловое отклонение (рад)
  driftTimer: 0,      // кадры до следующей смены дрейфа
  hesitateTimer: 0,   // кадры микро-заморозки
  shotReactTimer: 0,  // кадры отображения реакции на выстрел

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
    this.stuckTimer = 0; this.stuckNudge = null;
    this.lastX = this.x; this.lastY = this.y;
    this.driftAngle = 0; this.driftTimer = 0; this.hesitateTimer = 0;
    this.shotReactTimer = 0;
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
      // OPT 10: используем квадрат дистанции для сравнения
      const d2 = dx*dx + dy*dy;
      if (d2 > bestDist) { bestDist = d2; best = c; }
    }
    this.fleeTarget = best;
    this.fleeTimer = 300; // 5 секунд при 60fps
    this.path = [];
    this.pathTimer = 0;
    this.hesitateTimer = 0;
  },

  // Вызывается при выстреле кота — хозяин реагирует
  onShotFired() {
    if (!this.active || this.fleeTimer > 0) return;
    this.pathTimer = 0;       // форсируем пересчёт пути на следующем кадре
    this.shotReactTimer = 30; // ~0.5 сек показываем знак паники ‼
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
      ctx.fillStyle = "#fff"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center";
      ctx.fillText("👨", this.x+this.width/2, this.y+this.height/2+8);
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
        // OPT 6: emoji-кэш для какашек на лице
        drawEmoji("💩", 0, 0, 14);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ===== ЗНАК НАД ГОЛОВОЙ =====
    if (this.fleeTimer === 0) {
      const cx = this.x + this.width / 2;
      // OPT 5: используем _now вместо Date.now()
      const bounce = Math.sin(_now / 180) * 3;
      const cy = this.y - 10;

      if (this.shotReactTimer > 0) {
        // Реакция на выстрел — эмодзи паники
        ctx.save();
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("😱", cx, cy + bounce);
        ctx.restore();
      } else if (this.path.length >= 2) {
        // Преследует кота — восклицательный знак
        ctx.save();
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        // Тень
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillText("!", cx + 1, cy + bounce + 1);
        // Знак
        ctx.fillStyle = "#ff2222";
        ctx.fillText("!", cx, cy + bounce);
        ctx.restore();
      } else if (this.stuckTimer > 20 || this.hesitateTimer > 0) {
        // Тупит / не знает куда идти — знак вопроса
        ctx.save();
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillText("?", cx + 1, cy + bounce + 1);
        ctx.fillStyle = "#ffdd00";
        ctx.fillText("?", cx, cy + bounce);
        ctx.restore();
      }
    }
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
      const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row, this.width, this.height);
      if (newPath) {
        this.path = newPath;
      } else {
        // Путь не найден — форсируем пересчёт на следующем кадре
        this.path = [];
        this.pathTimer = 0;
      }
    }

    // Определяем направление движения
    let dx = 0, dy = 0;

    if (this.path.length >= 2) {
      // Следующая ячейка в пути (пропускаем текущую [0])
      const nextCell = this.path[1];
      const nextPx = cellToPixelCenter(nextCell.col, nextCell.row);

      dx = nextPx.x - ownerCx;
      dy = nextPx.y - ownerCy;

      // OPT 10: сравниваем квадраты дистанций вместо sqrt
      const dist2 = dx*dx + dy*dy;
      const threshold = spd + 2;

      // Если достигли центра следующей ячейки — переходим к следующей
      if (dist2 < threshold * threshold) {
        this.path.shift();
      } else {
        const dist = Math.sqrt(dist2);
        dx /= dist;
        dy /= dist;
      }

      // Применяем дрейф (человечность) — небольшое угловое отклонение
      if (this.driftAngle !== 0) {
        const cos = Math.cos(this.driftAngle);
        const sin = Math.sin(this.driftAngle);
        const ndx = dx * cos - dy * sin;
        const ndy = dx * sin + dy * cos;
        dx = ndx; dy = ndy;
      }
    } else {
      // Нет пути или уже в цели — двигаемся напрямую
      dx = tx - this.x;
      dy = ty - this.y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 > 1) {
        const dist = Math.sqrt(dist2);
        dx /= dist; dy /= dist;
      }
    }

    // Применяем stuckNudge если есть
    if (this.stuckNudge) {
      dx += this.stuckNudge.x * 0.5;
      dy += this.stuckNudge.y * 0.5;
      const nd2 = dx*dx + dy*dy;
      if (nd2 > 0) { const nd = Math.sqrt(nd2); dx /= nd; dy /= nd; }
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

    // Гарантия: хозяин не может быть внутри препятствия (напр. из-за движущегося)
    if (escapeObstacles(this)) {
      this.path = []; this.pathTimer = 0;
    }

    // Режим бегства: двигаемся к fleeTarget
    if (this.fleeTimer > 0) {
      this.fleeTimer--;
      const tx = this.fleeTarget.x;
      const ty = this.fleeTarget.y;
      const dx = tx - this.x, dy = ty - this.y;
      // OPT 10: квадрат дистанции для сравнения dist > 2
      const dist2 = dx*dx + dy*dy;
      if (dist2 > 4) {
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

    // ===== ТАЙМЕР РЕАКЦИИ НА ВЫСТРЕЛ =====
    if (this.shotReactTimer > 0) this.shotReactTimer--;

    // ===== МИКРО-ЗАМОРОЗКА (человечность) =====
    if (this.hesitateTimer > 0) {
      this.hesitateTimer--;
      return; // стоим на месте
    }

    // ===== ОБНОВЛЕНИЕ ДРЕЙФА (человечность) =====
    this.driftTimer--;
    if (this.driftTimer <= 0) {
      // Новый случайный дрейф ±0.18 рад (~±10°)
      this.driftAngle = (Math.random() - 0.5) * 0.36;
      this.driftTimer = 80 + Math.floor(Math.random() * 40); // 80–120 кадров
    }

    // ===== СЛУЧАЙНАЯ МИКРО-ЗАМОРОЗКА =====
    // ~0.4% шанс в кадр ≈ раз в ~4 сек
    if (Math.random() < 0.004) {
      this.hesitateTimer = 12; // ~0.2 сек
    }

    // Запоминаем позицию до движения
    const prevX = this.x;
    const prevY = this.y;

    // Преследование кота через A*
    const tx = player.x + player.size/2 - this.width/2;
    const ty = player.y + player.size/2 - this.height/2;
    this._moveTowardTarget(tx, ty, this.speed);

    // ===== АНТИ-ЗАСТРЕВАНИЕ =====
    // OPT 10: квадрат дистанции для сравнения movedDist < 0.5
    const ddx = this.x - prevX, ddy = this.y - prevY;
    const movedDist2 = ddx*ddx + ddy*ddy;
    if (movedDist2 < 0.25) { // 0.5² = 0.25
      this.stuckTimer++;
      if (this.stuckTimer > 30) {
        // Застрял — форсируем пересчёт пути и добавляем случайный толчок
        this.path = [];
        this.pathTimer = 0;
        // Случайный толчок в одном из 4 направлений
        const nudges = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
        this.stuckNudge = nudges[Math.floor(Math.random() * nudges.length)];
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckNudge = null;
    }

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
