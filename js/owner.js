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
  path: [],           // [{col, row}, ...] — текущий путь по сетке (для sign logic и repath)
  pathTimer: 0,       // пересчитываем путь каждые N кадров
  PATH_RECALC: 30,    // пересчёт каждые 30 кадров (~0.5 сек)

  // Steering corridor model
  pathSegments: [],   // [{startPx:{x,y}, endPx:{x,y}, dir:{x,y}}, ...] — сжатые сегменты пути
  segmentIndex: 0,    // индекс активного сегмента в pathSegments

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
  lastX: 800,         // позиция N кадров назад (для детекции осцилляции)
  lastY: 300,
  lastCheckTimer: 0,  // счётчик до следующей проверки net-displacement

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
    this.pathSegments = [];
    this.segmentIndex = 0;
    this.pathTimer = 0;
    this.fleeTimer = 0; this.fleeTarget = null;
    this.catnipTarget = null;
    this.poopHits = 0; this.facePoops = [];
    this.stuckTimer = 0;
    this.lastX = this.x; this.lastY = this.y;
    this.lastCheckTimer = 0;
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
    this.pathSegments = [];
    this.segmentIndex = 0;
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
  // На поворотах smoothing НЕ применяется — иначе хозяин пытается идти через стену.
  _smoothPath(ownerCol, ownerRow) {
    if (this.path.length < 3) return;
    // Проверяем: следующий шаг — поворот или прямо?
    // Если поворот — не трогаем путь, хозяин должен обойти угол по waypoints.
    const prev = this.path[0];
    const cur  = this.path[1];
    const next = this.path[2];
    const curDc  = cur.col  - prev.col,  curDr  = cur.row  - prev.row;
    const nextDc = next.col - cur.col,   nextDr = next.row - cur.row;
    const isTurn = (curDc !== nextDc || curDr !== nextDr);
    if (isTurn) return; // на повороте — не срезаем угол
    // На прямом участке — ищем самый дальний waypoint с прямой видимостью
    for (let k = this.path.length - 1; k >= 2; k--) {
      if (this._hasLineOfSight(ownerCol, ownerRow, this.path[k].col, this.path[k].row)) {
        // Удаляем промежуточные waypoints [1..k-1]
        this.path.splice(1, k - 1);
        break;
      }
    }
  },

  // ===== STEERING: Сжатие пути в сегменты =====
  // Конвертирует массив ячеек A* в массив направленных сегментов.
  // Последовательные ячейки с одинаковым направлением объединяются в один сегмент.
  //
  // Input:  [{col,row}, ...] — сырой путь A* (≥1 узлов)
  // Output: [{startPx:{x,y}, endPx:{x,y}, dir:{x,y}}, ...] — сегменты
  //
  // Пример: [(1,1),(2,1),(3,1),(3,2)] → [
  //   {startPx:(1,1)px, endPx:(3,1)px, dir:{x:1,y:0}},
  //   {startPx:(3,1)px, endPx:(3,2)px, dir:{x:0,y:1}}
  // ]
  _compressToSegments(path) {
    if (!path || path.length < 2) {
      this.pathSegments = [];
      this.segmentIndex = 0;
      return;
    }

    // Лог пути при включённом Shift+G debug overlay
    if (typeof _debugSteering !== "undefined" && _debugSteering) {
      const first = path[0], last = path[path.length - 1];
      console.log(`[STEER] path len=${path.length} first=(${first.col},${first.row}) last=(${last.col},${last.row}) ownerX=${Math.round(this.x)} playerX=${Math.round(player.x)}`);
    }

    const segments = [];
    let segStart = cellToPixelCenter(path[0].col, path[0].row);
    let dirX = 0, dirY = 0;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const stepX = curr.col - prev.col;
      const stepY = curr.row - prev.row;

      if (i === 1) {
        // Первый шаг — инициализируем направление
        dirX = stepX;
        dirY = stepY;
      } else if (stepX !== dirX || stepY !== dirY) {
        // Направление изменилось — закрываем текущий сегмент
        const segEnd = cellToPixelCenter(prev.col, prev.row);
        // Нормализуем dir (шаги всегда ±1 по одной оси, 0 по другой)
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        segments.push({
          startPx: segStart,
          endPx: segEnd,
          dir: { x: dirX / len, y: dirY / len },
        });
        // Начинаем новый сегмент
        segStart = cellToPixelCenter(prev.col, prev.row);
        dirX = stepX;
        dirY = stepY;
      }
    }

    // Закрываем последний сегмент
    const lastCell = path[path.length - 1];
    const segEnd = cellToPixelCenter(lastCell.col, lastCell.row);
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0) {
      segments.push({
        startPx: segStart,
        endPx: segEnd,
        dir: { x: dirX / len, y: dirY / len },
      });
    }

    this.pathSegments = segments;
    this.segmentIndex = 0;
  },

  // ===== STEERING: Вычисление цели движения =====
  // Проецирует центр хозяина на ось активного сегмента,
  // затем выдвигает цель на LOOKAHEAD пикселей вперёд по оси.
  // Цель зажата в пределах сегмента (не выходит за endPx).
  //
  // Возвращает {x, y} — точку, к которой нужно двигаться.
  // Если сегментов нет — возвращает null (вызывающий код использует fallback).
  _getSteeringTarget() {
    const LOOKAHEAD = GRID * 0.8; // 32px — достаточно для плавного движения

    if (this.segmentIndex >= this.pathSegments.length) return null;

    const seg = this.pathSegments[this.segmentIndex];
    const ownerCx = this.x + this.width / 2;
    const ownerCy = this.y + this.height / 2;

    // Проецируем центр хозяина на ось сегмента
    // t = dot(ownerCenter - seg.startPx, seg.dir)
    const toOwnerX = ownerCx - seg.startPx.x;
    const toOwnerY = ownerCy - seg.startPx.y;
    const t = toOwnerX * seg.dir.x + toOwnerY * seg.dir.y;

    // Длина сегмента вдоль оси
    const toEndX = seg.endPx.x - seg.startPx.x;
    const toEndY = seg.endPx.y - seg.startPx.y;
    const segLen = toEndX * seg.dir.x + toEndY * seg.dir.y;

    // Цель = max(t, 0) + LOOKAHEAD, зажатая до конца сегмента.
    // max(t, 0) — если хозяин позади startPx (t < 0), цель всё равно
    // выдвигается вперёд от startPx, а не назад.
    const tTarget = Math.min(Math.max(t, 0) + LOOKAHEAD, segLen);

    return {
      x: seg.startPx.x + seg.dir.x * tTarget,
      y: seg.startPx.y + seg.dir.y * tTarget,
    };
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
      if (typeof _debugSteering !== "undefined" && _debugSteering) {
        const _timerFired = this.pathTimer <= 0;
        const _emptyFired = this.path.length === 0;
        const _reason = (_timerFired && _emptyFired) ? "both" : _timerFired ? "timer" : "emptyPath";
        console.log(`[REPATH] reason=${_reason} pathTimer=${this.pathTimer} pathLen=${this.path.length} segIdx=${this.segmentIndex}/${this.pathSegments.length}`);
      }
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
        // Path Smoothing (только в подвале) — пропускаем промежуточные waypoints на прямых
        if (basementMode !== "") {
          this._smoothPath(ownerCell.col, ownerCell.row);
        }
        // Steering: сжимаем путь в сегменты для плавного движения вдоль коридоров
        this._compressToSegments(this.path);
      } else {
        // Путь не найден — ждём recalcInterval кадров перед повторной попыткой.
        // Немедленный pathTimer=0 вызывал бесконечный цикл: A* не находит путь →
        // pathTimer=0 → следующий кадр снова A* → снова не находит → 86+ раз/кадр.
        this.path = [];
        this.pathSegments = [];
        this.segmentIndex = 0;
        this.pathTimer = recalcInterval;
      }
    }

    // Определяем направление движения
    let dx = 0, dy = 0;

    if (this.path.length >= 2) {
      // ===== STEERING: движение вдоль коридорного сегмента =====
      // Вместо прицеливания в точный центр ячейки — проецируем на ось сегмента
      // и выдвигаем цель на LOOKAHEAD вперёд. Это совместимо с wall-sliding:
      // физическое скольжение вдоль стены не мешает прогрессу вдоль оси сегмента.

      // Проверяем завершение текущего сегмента (прогресс вдоль оси).
      // EPSILON = GRID/2 (20px): хозяин 36×52px центрируется на ячейке 40px,
      // поэтому его центр физически не может достичь точного cellToPixelCenter
      // конечной ячейки — стена блокирует на ~6px раньше по перпендикулярной оси.
      // Увеличенный порог гарантирует переход к следующему сегменту даже при
      // небольшом физическом смещении от оси коридора.
      if (this.segmentIndex < this.pathSegments.length) {
        const seg = this.pathSegments[this.segmentIndex];
        const toOwnerX = ownerCx - seg.startPx.x;
        const toOwnerY = ownerCy - seg.startPx.y;
        const progress = toOwnerX * seg.dir.x + toOwnerY * seg.dir.y;

        const toEndX = seg.endPx.x - seg.startPx.x;
        const toEndY = seg.endPx.y - seg.startPx.y;
        const segLen = toEndX * seg.dir.x + toEndY * seg.dir.y;

        // В подвале используем порог GRID*0.4 = 16px из-за 52px высоты хозяина:
        // центр хозяина физически не может достичь точного cellToPixelCenter конечной
        // ячейки — стена блокирует на ~6px раньше. 16px > 6px с запасом, но меньше
        // GRID/2=20px, чтобы не срабатывать на коротких сегментах (1 ячейка = 40px).
        // На открытых уровнях достаточно 8px.
        const EPSILON = (basementMode !== "") ? GRID * 0.4 : 8;
        if (progress >= segLen - EPSILON) {
          this.segmentIndex++;
          // Синхронизируем path[] для sign logic (draw() проверяет path.length >= 2)
          if (this.path.length > 1) this.path.shift();
          // Сегменты исчерпаны — пересчёт через нормальный интервал (не немедленно).
          // Немедленный pathTimer=0 вызывал бесконечный цикл пересчётов когда хозяин
          // физически не мог двигаться: сегменты исчерпывались → pathTimer=0 → новый
          // путь → те же сегменты → снова исчерпаны → 86+ пересчётов за кадр.
          if (this.segmentIndex >= this.pathSegments.length) {
            this.pathTimer = Math.min(this.pathTimer, recalcInterval);
          }
        }
      }

      // Получаем steering target
      const steerTarget = this._getSteeringTarget();
      if (steerTarget) {
        dx = steerTarget.x - ownerCx;
        dy = steerTarget.y - ownerCy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 0.01) {
          const dist = Math.sqrt(dist2);
          dx /= dist;
          dy /= dist;
          this.facingX = dx;
          this.facingY = dy;
        }
        if (typeof _debugSteering !== "undefined" && _debugSteering && dist2 < 1) {
          console.log(`[STEER-ZERO] steerTarget=(${Math.round(steerTarget.x)},${Math.round(steerTarget.y)}) ownerCx=${Math.round(ownerCx)} ownerCy=${Math.round(ownerCy)} dist2=${dist2.toFixed(3)} segIdx=${this.segmentIndex}/${this.pathSegments.length}`);
        }
      } else {
        // Fallback: нет активного сегмента — двигаемся напрямую к цели
        dx = tx - this.x;
        dy = ty - this.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 0.01) {
          const dist = Math.sqrt(dist2);
          dx /= dist; dy /= dist;
          this.facingX = dx;
          this.facingY = dy;
        }
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
      // Нет пути или уже в цели — двигаемся напрямую к цели
      dx = tx - this.x;
      dy = ty - this.y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 > 0.01) {
        const dist = Math.sqrt(dist2);
        dx /= dist; dy /= dist;
        // Обновляем направление взгляда из нормализованного вектора
        this.facingX = dx;
        this.facingY = dy;
      }
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
      if (typeof _debugSteering !== "undefined" && _debugSteering) {
        console.log(`[ESCAPE] owner inside obstacle → escaped to ownerX=${Math.round(this.x)} ownerY=${Math.round(this.y)}`);
      }
      // Сбрасываем только segmentIndex — steering пересчитается с новой позиции.
      // НЕ очищаем path и НЕ сбрасываем pathTimer:
      // - path=[] при pathTimer>0 триггерит немедленный пересчёт (строка 477)
      // - pathTimer=0 вызывал бесконечный цикл: escape → repath → движение обратно
      //   → снова внутри препятствия → снова escape → бесконечно.
      // Путь пересчитается через нормальный интервал таймера.
      this.segmentIndex = 0;
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
    // Используем net-displacement за CHECK_INTERVAL кадров вместо per-frame delta.
    // Это обнаруживает осцилляцию (движение туда-обратно), которая сбрасывает
    // per-frame stuckTimer каждый кадр, но не даёт реального прогресса.
    // В подвале CHECK_INTERVAL=10 кадров, порог 2px² (~1.4px net за 10 кадров).
    // На открытых уровнях CHECK_INTERVAL=15 кадров, порог 4px².
    const CHECK_INTERVAL = (basementMode !== "") ? 10 : 15;
    const NET_THRESHOLD2 = (basementMode !== "") ? 2 : 4; // px² net displacement
    const MAX_STUCK_CHECKS = (basementMode !== "") ? 2 : 3; // checks before repath

    this.lastCheckTimer++;
    if (this.lastCheckTimer >= CHECK_INTERVAL) {
      this.lastCheckTimer = 0;
      const netDx = this.x - this.lastX;
      const netDy = this.y - this.lastY;
      const netDist2 = netDx * netDx + netDy * netDy;
      if (netDist2 < NET_THRESHOLD2) {
        this.stuckTimer++;
        if (this.stuckTimer >= MAX_STUCK_CHECKS) {
          if (typeof _debugSteering !== "undefined" && _debugSteering) {
            console.log(`[STUCK] force repath at ownerX=${Math.round(this.x)} ownerY=${Math.round(this.y)} netDist2=${netDist2.toFixed(2)}`);
          }
          // Застрял — форсируем пересчёт пути.
          // НЕ очищаем path=[] — это триггерит немедленный repath через условие
          // path.length===0 (строка 477), что в сочетании с pathTimer=0 создаёт
          // бесконечный цикл: stuck → path=[] + pathTimer=0 → следующий кадр
          // pathTimer-- → -1, path.length===0 → repath → A* находит путь →
          // pathTimer=recalcInterval, но path=[] уже очищен → снова repath → цикл.
          // Решение: только сбрасываем сегменты и устанавливаем pathTimer=0.
          // pathTimer=0 → следующий кадр pathTimer-- → -1 → repath через таймер.
          // path остаётся непустым → условие path.length===0 не срабатывает.
          this.pathSegments = [];
          this.segmentIndex = 0;
          this.pathTimer = 0;
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
      // Обновляем опорную позицию для следующей проверки
      this.lastX = this.x;
      this.lastY = this.y;
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
