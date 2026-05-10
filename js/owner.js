// ==========================================
// OWNER — human AI: A* navigation, flee, humanness
// ==========================================

const owner = {
  x: 800, y: 300, width: 36, height: 52,
  active: false, speed: 1.0,

  // Направление взгляда (нормализованный вектор) — для фонарика в подвале
  facingX: 1,
  facingY: 0,

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

    // ===== УЛУЧШЕНИЕ 5: Безопасный ячеечный спавн в подвале =====
    // В подвале пиксельные углы могут попасть в заблокированные колонки (DFS: cols 28-29).
    // Используем ячеечный поиск: spiral search от углов сетки, максимально далёких от кота.
    let best = null;
    if (basementMode !== "") {
      const catCell = pixelToCell(player.x + player.size/2, player.y + player.size/2);
      const ownerWCells = Math.ceil(this.width / GRID);
      const ownerHCells = Math.ceil(this.height / GRID);
      // Четыре угла сетки (ячеечные координаты)
      const cornerCells = [
        { col: 0,             row: 0             },
        { col: 0,             row: GRID_ROWS - 1 },
        { col: GRID_COLS - 1, row: 0             },
        { col: GRID_COLS - 1, row: GRID_ROWS - 1 },
      ];
      // Сортируем по убыванию расстояния от кота
      cornerCells.sort((a, b) => {
        const da = (a.col - catCell.col)**2 + (a.row - catCell.row)**2;
        const db = (b.col - catCell.col)**2 + (b.row - catCell.row)**2;
        return db - da;
      });
      // Spiral search от каждого угла — ищем свободную ячейку
      outer: for (const corner of cornerCells) {
        for (let radius = 0; radius <= 8; radius++) {
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
              const col = corner.col + dc;
              const row = corner.row + dr;
              if (col < 0 || row < 0 || col + ownerWCells > GRID_COLS || row + ownerHCells > GRID_ROWS) continue;
              if (!cellsFree(col, row, ownerWCells, ownerHCells)) continue;
              const pos = cellToPixel(col, row);
              if (!hitsObstacles({ x: pos.x, y: pos.y, width: this.width, height: this.height })) {
                best = { x: pos.x, y: pos.y };
                break outer;
              }
            }
          }
        }
      }
    }

    // Fallback (открытые уровни и подвал без свободной ячейки): пиксельные углы
    if (!best) {
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

  // Конус фонарика — рисуется ДО спрайта хозяина (под ним)
  _drawFlashlight() {
    if (basementMode === "") return; // только в подвале

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const angle = Math.atan2(this.facingY, this.facingX);
    const coneAngle = Math.PI / 4.5; // ~40° полуугол
    const coneLen = 220;

    ctx.save();

    // Радиальный градиент — тёплый жёлтый свет, затухает к краям
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, coneLen);
    grad.addColorStop(0,   "rgba(255,230,140,0.42)");
    grad.addColorStop(0.4, "rgba(255,210,100,0.22)");
    grad.addColorStop(1,   "rgba(255,190,60,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, coneLen, angle - coneAngle, angle + coneAngle);
    ctx.closePath();
    ctx.fill();

    // Маленький кружок — сам фонарик (источник света)
    ctx.fillStyle = "rgba(255,240,180,0.75)";
    ctx.beginPath();
    ctx.arc(
      cx + this.facingX * (this.width / 2 + 2),
      cy + this.facingY * (this.height / 2 + 2),
      5, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  },

  draw() {
    if (!this.active) return;
    // Фонарик рисуется под спрайтом хозяина
    this._drawFlashlight();
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

  // ===== УЛУЧШЕНИЕ 2: Проверка прямой видимости (Bresenham по сетке) =====
  // Возвращает true если между ячейками (c1,r1) и (c2,r2) нет стен.
  // O(max(|dc|,|dr|)) ≤ 30 итераций на сетке 30×15 — пренебрежимо мало.
  _hasLineOfSight(c1, r1, c2, r2) {
    let x = c1, y = r1;
    const dx = Math.abs(c2 - c1), dy = Math.abs(r2 - r1);
    const sx = c1 < c2 ? 1 : -1, sy = r1 < r2 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (!isCellFree(x, y)) return false;
      if (x === c2 && y === r2) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  },

  // ===== УЛУЧШЕНИЕ 2: Path Smoothing =====
  // Пропускает промежуточные waypoints если есть прямая видимость до более дальнего.
  // Устраняет «зигзаг» на прямых коридорах — хозяин идёт прямо, не тормозя у каждой ячейки.
  _smoothPath(ownerCol, ownerRow) {
    if (this.path.length < 3) return;
    // Ищем самый дальний waypoint с прямой видимостью от текущей позиции
    for (let k = this.path.length - 1; k >= 2; k--) {
      if (this._hasLineOfSight(ownerCol, ownerRow, this.path[k].col, this.path[k].row)) {
        // Удаляем промежуточные waypoints [1..k-1]
        this.path.splice(1, k - 1);
        break;
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

    // ===== УЛУЧШЕНИЕ 4: Более частый пересчёт пути в подвале =====
    // В подвале: 15 кадров (0.25 сек) — путь не устаревает пока кот убегает.
    // На открытых уровнях: 30 кадров (0.5 сек) — без изменений.
    const recalcInterval = (basementMode !== "") ? 15 : this.PATH_RECALC;

    // Пересчитываем путь по таймеру или если путь кончился
    this.pathTimer--;
    if (this.pathTimer <= 0 || this.path.length === 0) {
      this.pathTimer = recalcInterval;
      // В подвале используем размер кота (36×36) для A*.
      // Коридоры шириной 2 ячейки (80px) физически вмещают хозяина (52px),
      // но canPass центрирует прямоугольник 36×52 на ячейке 40px — это выходит
      // за пределы ячейки и ложно видит коллизию со стеной.
      const pathW = (basementMode !== "") ? player.size : this.width;
      const pathH = (basementMode !== "") ? player.size : this.height;
      const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row, pathW, pathH);
      if (newPath) {
        this.path = newPath;
        // ===== УЛУЧШЕНИЕ 2: Path Smoothing после пересчёта (только в подвале) =====
        // Пропускаем промежуточные waypoints на прямых коридорах.
        if (basementMode !== "") {
          this._smoothPath(ownerCell.col, ownerCell.row);
        }
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

      // ===== УЛУЧШЕНИЕ 3: Адаптивный waypoint threshold =====
      // На прямом коридоре: threshold = spd+2 (~6.5px) — плавное движение без рывков.
      // На повороте: threshold = GRID/2 (20px) — хозяин срезает угол заранее, не застревая.
      // На открытых уровнях: threshold = spd+2 — без изменений.
      let threshold;
      if (basementMode !== "") {
        if (this.path.length >= 3) {
          // Определяем: следующий шаг — поворот или прямо?
          const cur  = this.path[1];
          const next = this.path[2];
          const prev = this.path[0];
          const curDc = cur.col - prev.col, curDr = cur.row - prev.row;
          const nextDc = next.col - cur.col, nextDr = next.row - cur.row;
          const isTurn = (curDc !== nextDc || curDr !== nextDr);
          // На повороте — большой threshold (срезаем угол)
          // На прямой — маленький threshold (плавное движение)
          threshold = isTurn ? Math.max(spd + 2, GRID / 2) : spd + 2;
        } else {
          // Последний waypoint — используем большой threshold чтобы не застрять
          threshold = Math.max(spd + 2, GRID / 2);
        }
      } else {
        threshold = spd + 2;
      }

      // Если достигли центра следующей ячейки — переходим к следующей
      if (dist2 < threshold * threshold) {
        this.path.shift();
      } else {
        const dist = Math.sqrt(dist2);
        dx /= dist;
        dy /= dist;
        // Обновляем направление взгляда только из нормализованного вектора
        this.facingX = dx;
        this.facingY = dy;
      }

      // Применяем дрейф (человечность) — только на открытых уровнях
      // В подвале driftAngle = 0 (см. update()), поэтому ветка не выполняется
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
        // Обновляем направление взгляда из нормализованного вектора
        this.facingX = dx;
        this.facingY = dy;
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

    // ===== УЛУЧШЕНИЕ 1: Дрейф и микро-заморозки — только на открытых уровнях =====
    // В подвале дрейф ±10° вызывает застревание у стен коридоров.
    // Микро-заморозки в лабиринте выглядят как «тупит у поворота» — нечестно.
    // На открытых уровнях поведение не меняется.
    if (basementMode === "") {
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
    } else {
      // В подвале: сбрасываем дрейф — хозяин идёт строго по пути A*
      this.driftAngle = 0;
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
