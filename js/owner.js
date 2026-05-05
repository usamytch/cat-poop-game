// ==========================================
// OWNER — human AI: A* navigation, flee, humanness
// ==========================================

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

  // Котовник — хозяин уходит в угол и игнорирует кота
  catnipTarget: null,

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
    this.speed = Math.min(diff.baseSpd + (level-1)*diff.spdPerLvl, diff.maxSpd);
    const b = getPlayBounds();
    const corners = [
      {x:b.right-this.width-20, y:b.top+20},
      {x:b.right-this.width-20, y:b.bottom-this.height-20},
      {x:b.left+20,             y:b.top+20},
      {x:b.left+20,             y:b.bottom-this.height-20},
    ];
    // Sort corners farthest-first from player
    corners.sort((a, c) => {
      const da = (a.x-player.x)**2 + (a.y-player.y)**2;
      const dc = (c.x-player.x)**2 + (c.y-player.y)**2;
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
    this.catnipTarget = null;
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

      if (catnipTimer > 0) {
        // Котовник — хозяин одурманен
        ctx.save();
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("😵", cx, cy + bounce);
        ctx.restore();
      } else if (this.shotReactTimer > 0) {
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

    // ===== КОТОВНИК: хозяин уходит в угол и игнорирует кота =====
    if (catnipTimer > 0) {
      catnipTimer--;
      // Выбираем цель один раз — дальний угол от кота
      if (!this.catnipTarget) {
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
          const d2 = dx*dx + dy*dy;
          if (d2 > bestDist) { bestDist = d2; best = c; }
        }
        this.catnipTarget = best;
      }
      // Медленно бредёт к углу (0.6 от обычной скорости)
      const cdx = this.catnipTarget.x - this.x;
      const cdy = this.catnipTarget.y - this.y;
      const cdist2 = cdx*cdx + cdy*cdy;
      if (cdist2 > 4) {
        this._moveTowardTarget(this.catnipTarget.x, this.catnipTarget.y, this.speed * 0.6);
      }
      // Таймер истёк — сбрасываем цель
      if (catnipTimer === 0) this.catnipTarget = null;
      return; // не преследует кота
    }

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
