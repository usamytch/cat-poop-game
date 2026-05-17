// ==========================================
// OWNER — human AI: A* navigation, flee, humanness
// ==========================================

const owner = {
  x: 800, y: 300, width: 36, height: 36,
  active: false, speed: 1.0,

  // Направление взгляда (нормализованный вектор) — для фонарика в подвале
  facingX: 1,
  facingY: 0,

  // A* навигация
  path: [],           // [{col, row}, ...] — текущий путь по сетке (для sign logic и repath)
  pathTimer: 0,       // пересчитываем путь каждые N кадров
  PATH_RECALC: 30,    // пересчёт каждые 30 кадров (~0.5 сек)

  // ===== GRID-NODE MOVEMENT (только в подвале) =====
  // Парадигма: AI думает в ячейках, физика рендерит в пикселях.
  // Хозяин гарантированно переходит из node A в node B — нет осцилляции,
  // нет threshold hell, нет perpendicular drift.
  currentNode: null,   // {col, row} — узел, из которого движемся
  nextNode: null,      // {col, row} — узел, к которому движемся
  moveProgress: 0,     // 0.0 → 1.0, прогресс между currentNode и nextNode
  segmentLength: 40,   // px между currentNode и nextNode (явно, не GRID — future-proof)
  nodeQueue: [],       // [{col, row}, ...] — оставшиеся узлы A* пути
  lastPlayerCell: null, // для детекции смены ячейки игрока (event-based repath)

  // Steering corridor model (только на открытых уровнях)
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

  // Анти-застревание (только на открытых уровнях)
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
      // Spiral search от каждого угла — ищем свободную ячейку.
      const minRow = 1;
      const maxRow = GRID_ROWS - 2;
      outer: for (const corner of cornerCells) {
        for (let radius = 0; radius <= 8; radius++) {
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
              const col = corner.col + dc;
              const row = corner.row + dr;
              if (col < 0 || row < minRow || col + ownerWCells > GRID_COLS || row + ownerHCells > GRID_ROWS || row > maxRow) continue;
              if (!cellsFree(col, row, ownerWCells, ownerHCells)) continue;
              const pos = cellToPixel(col, row);
              if (!hitsObstacles({ x: pos.x, y: pos.y, width: this.width, height: this.height })) {
                best = { x: pos.x, y: pos.y, col, row };
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
    // Grid-node state reset
    this.currentNode = (best.col !== undefined) ? { col: best.col, row: best.row } : null;
    this.nextNode = null;
    this.moveProgress = 0;
    this.segmentLength = GRID;
    this.nodeQueue = [];
    this.lastPlayerCell = null;
    // Corridor steering state reset (open levels)
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
      const d2 = dx*dx + dy*dy;
      if (d2 > bestDist) { bestDist = d2; best = c; }
    }
    this.fleeTarget = best;
    this.fleeTimer = 300; // 5 секунд при 60fps
    this.path = [];
    // Grid-node reset
    this.currentNode = null;
    this.nextNode = null;
    this.nodeQueue = [];
    this.moveProgress = 0;
    // Corridor steering reset
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
        drawEmoji("💩", 0, 0, 14);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ===== ЗНАК НАД ГОЛОВОЙ =====
    if (this.fleeTimer === 0) {
      const cx = this.x + this.width / 2;
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
      } else {
        // Преследует кота — восклицательный знак
        // В подвале: проверяем nodeQueue/nextNode; на открытых уровнях: path.length >= 2
        const isChasing = (basementMode !== "")
          ? (this.nodeQueue.length > 0 || this.nextNode !== null)
          : this.path.length >= 2;

        if (isChasing) {
          ctx.save();
          ctx.font = "bold 20px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillText("!", cx + 1, cy + bounce + 1);
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
    }
  },

  // ===== GRID-NODE: Переход к следующему узлу =====
  // Вычисляет segmentLength явно (future-proof: не предполагает GRID).
  // Обновляет facingX/Y для фонарика.
  _advanceToNextNode() {
    if (this.nodeQueue.length === 0) {
      this.nextNode = null;
      this.segmentLength = GRID;
      return;
    }
    this.nextNode = this.nodeQueue.shift();
    // Вычисляем длину сегмента явно (обычно 40px, но future-proof)
    const fromPx = cellToPixel(this.currentNode.col, this.currentNode.row);
    const toPx   = cellToPixel(this.nextNode.col,    this.nextNode.row);
    const dx = toPx.x - fromPx.x;
    const dy = toPx.y - fromPx.y;
    this.segmentLength = Math.sqrt(dx*dx + dy*dy) || GRID;
    // Обновляем направление взгляда
    if (dx !== 0 || dy !== 0) {
      const len = this.segmentLength;
      this.facingX = dx / len;
      this.facingY = dy / len;
    }
  },

  // ===== GRID-NODE: Инициализация движения по пути =====
  // Вызывается при получении нового A* пути в basement.
  // Snap к первому узлу только при старте или после escape (не mid-transition).
  _startGridMovement(path, snapToFirst) {
    if (!path || path.length < 2) {
      this.nodeQueue = [];
      this.nextNode = null;
      return;
    }
    if (snapToFirst) {
      // Snap к первому узлу (старт или после escape)
      this.currentNode = path[0];
      const px = cellToPixel(this.currentNode.col, this.currentNode.row);
      this.x = px.x;
      this.y = px.y;
      this.moveProgress = 0;
    }
    // Очередь = остаток пути (начиная с узла после currentNode)
    // Если currentNode уже установлен (mid-path repath), ищем его в пути
    this.nodeQueue = path.slice(1);
    if (!this.nextNode) {
      this._advanceToNextNode();
    }
  },

  // ===== GRID-NODE: Обновление позиции (вызывается каждый кадр в basement) =====
  // moveProgress монотонно возрастает — никакой осцилляции невозможно.
  // Визуальная позиция — lerp между currentNode и nextNode.
  _updateGridMovement(spd) {
    if (!this.currentNode) return;

    if (!this.nextNode) {
      // Путь исчерпан — запрашиваем repath
      this.pathTimer = 0;
      return;
    }

    // Advance progress (нормализовано по длине сегмента)
    this.moveProgress += spd / this.segmentLength;

    if (this.moveProgress >= 1.0) {
      // Прибыли в nextNode
      this.moveProgress -= 1.0;  // carry-over для плавности
      this.currentNode = this.nextNode;

      // Snap к точному пикселю (устраняет float drift)
      const px = cellToPixel(this.currentNode.col, this.currentNode.row);
      this.x = px.x;
      this.y = px.y;

      // Переходим к следующему узлу
      this._advanceToNextNode();

      // Если очередь исчерпана — repath
      if (!this.nextNode) {
        this.pathTimer = 0;
      }
    } else {
      // Визуальная интерполяция между узлами (lerp)
      const fromPx = cellToPixel(this.currentNode.col, this.currentNode.row);
      const toPx   = cellToPixel(this.nextNode.col,    this.nextNode.row);
      this.x = fromPx.x + (toPx.x - fromPx.x) * this.moveProgress;
      this.y = fromPx.y + (toPx.y - fromPx.y) * this.moveProgress;
    }

    if (typeof _debugSteering !== "undefined" && _debugSteering) {
      const cn = this.currentNode, nn = this.nextNode;
      console.log(`[GRID] (${cn.col},${cn.row})->(${nn ? nn.col+','+nn.row : 'null'}) progress=${this.moveProgress.toFixed(2)} x=${this.x.toFixed(1)} y=${this.y.toFixed(1)}`);
    }
  },

  // ===== УЛУЧШЕНИЕ 2: Проверка прямой видимости (Bresenham по сетке) =====
  // Возвращает true если между ячейками (c1,r1) и (c2,r2) нет стен.
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

  // ===== УЛУЧШЕНИЕ 2: Path Smoothing (только на открытых уровнях) =====
  // В подвале не нужен — grid-node модель не использует сегменты.
  _smoothPath(ownerCol, ownerRow) {
    if (this.path.length < 3) return;
    const prev = this.path[0];
    const cur  = this.path[1];
    const next = this.path[2];
    const curDc  = cur.col  - prev.col,  curDr  = cur.row  - prev.row;
    const nextDc = next.col - cur.col,   nextDr = next.row - cur.row;
    const isTurn = (curDc !== nextDc || curDr !== nextDr);
    if (isTurn) return;
    for (let k = this.path.length - 1; k >= 2; k--) {
      if (this._hasLineOfSight(ownerCol, ownerRow, this.path[k].col, this.path[k].row)) {
        this.path.splice(1, k - 1);
        break;
      }
    }
  },

  // ===== STEERING: Сжатие пути в сегменты (только на открытых уровнях) =====
  _compressToSegments(path) {
    if (!path || path.length < 2) {
      this.pathSegments = [];
      this.segmentIndex = 0;
      return;
    }

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
        dirX = stepX;
        dirY = stepY;
      } else if (stepX !== dirX || stepY !== dirY) {
        const segEnd = cellToPixelCenter(prev.col, prev.row);
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        segments.push({
          startPx: segStart,
          endPx: segEnd,
          dir: { x: dirX / len, y: dirY / len },
        });
        segStart = cellToPixelCenter(prev.col, prev.row);
        dirX = stepX;
        dirY = stepY;
      }
    }

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

  // ===== STEERING: Вычисление цели движения (только на открытых уровнях) =====
  _getSteeringTarget() {
    const LOOKAHEAD = GRID * 0.8;
    const ALIGN_THRESHOLD = 2;

    if (this.segmentIndex >= this.pathSegments.length) return null;

    const seg = this.pathSegments[this.segmentIndex];
    const ownerCx = this.x + this.width / 2;
    const ownerCy = this.y + this.height / 2;

    const toEndX = seg.endPx.x - seg.startPx.x;
    const toEndY = seg.endPx.y - seg.startPx.y;
    const segLen = toEndX * seg.dir.x + toEndY * seg.dir.y;

    if (seg.dir.x !== 0) {
      const axisY = seg.startPx.y;
      const perpDist = axisY - ownerCy;

      if (Math.abs(perpDist) > ALIGN_THRESHOLD) {
        if (typeof _debugSteering !== "undefined" && _debugSteering) {
          console.log(`[STEER] seg=H state=CENTERING ownerX=${this.x.toFixed(1)} ownerY=${this.y.toFixed(1)} axisY=${axisY} perpDist=${perpDist.toFixed(2)}`);
        }
        return { x: ownerCx, y: axisY };
      } else {
        const t = (ownerCx - seg.startPx.x) * seg.dir.x;
        const tTarget = Math.min(Math.max(t, 0) + LOOKAHEAD, segLen);
        const targetX = seg.startPx.x + seg.dir.x * tTarget;
        if (typeof _debugSteering !== "undefined" && _debugSteering) {
          console.log(`[STEER] seg=H state=ADVANCING ownerX=${this.x.toFixed(1)} ownerY=${this.y.toFixed(1)} targetX=${targetX.toFixed(1)} axisY=${axisY}`);
        }
        return { x: targetX, y: axisY };
      }
    } else {
      const axisX = seg.startPx.x;
      const perpDist = axisX - ownerCx;

      if (Math.abs(perpDist) > ALIGN_THRESHOLD) {
        if (typeof _debugSteering !== "undefined" && _debugSteering) {
          console.log(`[STEER] seg=V state=CENTERING ownerX=${this.x.toFixed(1)} ownerY=${this.y.toFixed(1)} axisX=${axisX} perpDist=${perpDist.toFixed(2)}`);
        }
        return { x: axisX, y: ownerCy };
      } else {
        const t = (ownerCy - seg.startPx.y) * seg.dir.y;
        const tTarget = Math.min(Math.max(t, 0) + LOOKAHEAD, segLen);
        const targetY = seg.startPx.y + seg.dir.y * tTarget;
        if (typeof _debugSteering !== "undefined" && _debugSteering) {
          console.log(`[STEER] seg=V state=ADVANCING ownerX=${this.x.toFixed(1)} ownerY=${this.y.toFixed(1)} targetY=${targetY.toFixed(1)} axisX=${axisX}`);
        }
        return { x: axisX, y: targetY };
      }
    }
  },

  // ===== A* ДВИЖЕНИЕ К ЦЕЛИ =====
  _moveTowardTarget(tx, ty, spd) {
    // ===== BASEMENT: Grid-node movement =====
    // AI думает в ячейках, физика рендерит в пикселях.
    // Нет wall sliding, нет centering, нет threshold oscillation.
    if (basementMode !== "") {
      const goalCell = pixelToCell(tx + this.width/2, ty + this.height/2);

      // Event-based repath triggers (не только по таймеру):
      // 1. Таймер истёк (fallback)
      // 2. Путь исчерпан (nextNode === null и очередь пуста)
      // 3. Игрок перешёл в другую ячейку
      const playerCellChanged = this.lastPlayerCell !== null &&
        (goalCell.col !== this.lastPlayerCell.col || goalCell.row !== this.lastPlayerCell.row);

      this.pathTimer--;
      const needRepath = this.pathTimer <= 0 ||
                         (!this.nextNode && this.nodeQueue.length === 0) ||
                         playerCellChanged;

      // Repath только при прибытии в узел (moveProgress < 0.1) — предотвращает телепорт.
      // Исключение: nextNode === null (путь исчерпан) — repath всегда разрешён.
      const canRepath = needRepath && (this.moveProgress < 0.1 || !this.nextNode);

      if (canRepath) {
        this.pathTimer = 30; // fallback интервал в basement
        this.lastPlayerCell = { col: goalCell.col, row: goalCell.row };

        // Стартовая ячейка: currentNode если есть, иначе вычисляем из пикселей
        const ownerCell = this.currentNode ||
          pixelToCell(this.x + this.width/2, this.y + this.height/2);

        if (typeof _debugSteering !== "undefined" && _debugSteering) {
          console.log(`[GRID-REPATH] from=(${ownerCell.col},${ownerCell.row}) to=(${goalCell.col},${goalCell.row}) progress=${this.moveProgress.toFixed(2)}`);
        }

        const newPath = aStarPath(
          ownerCell.col, ownerCell.row,
          goalCell.col, goalCell.row,
          this.width, this.height
        );

        if (newPath && newPath.length >= 2) {
          this.path = newPath; // для draw() sign logic
          if (!this.currentNode) {
            // Первый старт — snap к первому узлу
            this._startGridMovement(newPath, true);
          } else {
            // Mid-path repath — не сбрасываем currentNode, только обновляем очередь
            this._startGridMovement(newPath, false);
          }
        } else {
          // A* не нашёл путь — ждём следующего интервала
          this.path = [];
          this.nodeQueue = [];
          // nextNode оставляем — продолжаем текущее движение если есть
        }
      }

      this._updateGridMovement(spd);
      return;
    }

    // ===== OPEN LEVELS: существующий continuous steering (без изменений) =====
    const b = getPlayBounds();

    const ownerCx = this.x + this.width / 2;
    const ownerCy = this.y + this.height / 2;
    const ownerCell = pixelToCell(ownerCx, ownerCy);
    const goalCell = pixelToCell(tx + this.width / 2, ty + this.height / 2);

    const recalcInterval = this.PATH_RECALC;

    this.pathTimer--;
    if (this.pathTimer <= 0 || this.path.length === 0) {
      if (typeof _debugSteering !== "undefined" && _debugSteering) {
        const _timerFired = this.pathTimer <= 0;
        const _emptyFired = this.path.length === 0;
        const _reason = (_timerFired && _emptyFired) ? "both" : _timerFired ? "timer" : "emptyPath";
        console.log(`[REPATH] reason=${_reason} pathTimer=${this.pathTimer} pathLen=${this.path.length} segIdx=${this.segmentIndex}/${this.pathSegments.length}`);
      }
      this.pathTimer = recalcInterval;
      const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row, this.width, this.height);
      if (newPath) {
        this.path = newPath;
        this._smoothPath(ownerCell.col, ownerCell.row);
        this._compressToSegments(this.path);
      } else {
        this.path = [];
        this.pathSegments = [];
        this.segmentIndex = 0;
        this.pathTimer = recalcInterval;
      }
    }

    // Определяем направление движения
    let dx = 0, dy = 0;

    if (this.path.length >= 2) {
      // Проверяем завершение текущего сегмента
      if (this.segmentIndex < this.pathSegments.length) {
        const seg = this.pathSegments[this.segmentIndex];
        const toOwnerX = ownerCx - seg.startPx.x;
        const toOwnerY = ownerCy - seg.startPx.y;
        const progress = toOwnerX * seg.dir.x + toOwnerY * seg.dir.y;

        const toEndX = seg.endPx.x - seg.startPx.x;
        const toEndY = seg.endPx.y - seg.startPx.y;
        const segLen = toEndX * seg.dir.x + toEndY * seg.dir.y;

        const EPSILON = 8;
        if (progress >= segLen - EPSILON) {
          this.segmentIndex++;
          if (this.path.length > 1) this.path.shift();
          if (this.segmentIndex >= this.pathSegments.length) {
            this.pathTimer = Math.min(this.pathTimer, recalcInterval);
          }
        }
      }

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

      // Дрейф (человечность) — только на открытых уровнях
      if (this.driftAngle !== 0) {
        const cos = Math.cos(this.driftAngle);
        const sin = Math.sin(this.driftAngle);
        const ndx = dx * cos - dy * sin;
        const ndy = dx * sin + dy * cos;
        dx = ndx; dy = ndy;
      }
    } else {
      dx = tx - this.x;
      dy = ty - this.y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 > 0.01) {
        const dist = Math.sqrt(dist2);
        dx /= dist; dy /= dist;
        this.facingX = dx;
        this.facingY = dy;
      }
    }

    // Применяем движение с раздельной проверкой осей (скольжение вдоль стен)
    const nx = this.x + dx * spd;
    const ny = this.y + dy * spd;
    const nrX = {x:nx,      y:this.y, width:this.width, height:this.height};
    const nrY = {x:this.x,  y:ny,     width:this.width, height:this.height};
    const xOk = !hitsObstacles(nrX) && nx >= b.left && nx <= b.right  - this.width;
    const yOk = !hitsObstacles(nrY) && ny >= b.top  && ny <= b.bottom - this.height;
    if (xOk) this.x = nx;
    if (yOk) this.y = ny;
  },

  update() {
    if (!this.active) return;
    if (yarnFreezeTimer > 0) return;

    // ===== КОТОВНИК: хозяин уходит в угол и игнорирует кота =====
    if (catnipTimer > 0) {
      catnipTimer--;
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
      const cdx = this.catnipTarget.x - this.x;
      const cdy = this.catnipTarget.y - this.y;
      const cdist2 = cdx*cdx + cdy*cdy;
      if (cdist2 > 4) {
        this._moveTowardTarget(this.catnipTarget.x, this.catnipTarget.y, this.speed * 0.6);
      }
      if (catnipTimer === 0) this.catnipTarget = null;
      return;
    }

    const b = getPlayBounds();

    // ===== ESCAPE OBSTACLES =====
    // В подвале: hard snap к ближайшей свободной ячейке + repath.
    // На открытых уровнях: существующий snap-to-cell код.
    if (escapeObstacles(this)) {
      if (typeof _debugSteering !== "undefined" && _debugSteering) {
        console.log(`[ESCAPE] owner inside obstacle → escaped to ownerX=${Math.round(this.x)} ownerY=${Math.round(this.y)}`);
      }

      // Spiral search к ближайшей свободной ячейке
      const snapCx = this.x + this.width / 2;
      const snapCy = this.y + this.height / 2;
      const snapCell = pixelToCell(snapCx, snapCy);
      let snapped = false;
      outer_snap: for (let radius = 0; radius <= 3; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
            const sc = snapCell.col + dc;
            const sr = snapCell.row + dr;
            if (sc < 0 || sr < 0 || sc >= GRID_COLS || sr >= GRID_ROWS) continue;
            const sp = cellToPixel(sc, sr);
            const snapRect = { x: sp.x, y: sp.y, width: this.width, height: this.height };
            const b2 = getPlayBounds();
            if (!hitsObstacles(snapRect) &&
                sp.x >= b2.left && sp.y >= b2.top &&
                sp.x + this.width <= b2.right && sp.y + this.height <= b2.bottom) {
              this.x = sp.x;
              this.y = sp.y;
              snapped = true;
              if (typeof _debugSteering !== "undefined" && _debugSteering) {
                console.log(`[SNAP] snapped to cell (${sc},${sr}) ownerX=${this.x} ownerY=${this.y}`);
              }
              if (basementMode !== "") {
                // В подвале: полный сброс grid state — repath с новой позиции
                this.currentNode = { col: sc, row: sr };
                this.nextNode = null;
                this.nodeQueue = [];
                this.moveProgress = 0;
              }
              break outer_snap;
            }
          }
        }
      }

      // Сбрасываем путь и форсируем repath
      this.pathSegments = [];
      this.segmentIndex = 0;
      this.pathTimer = 0;
    }

    // Режим бегства: двигаемся к fleeTarget
    if (this.fleeTimer > 0) {
      this.fleeTimer--;
      const tx = this.fleeTarget.x;
      const ty = this.fleeTarget.y;
      const dx = tx - this.x, dy = ty - this.y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 > 4) {
        this._moveTowardTarget(tx, ty, this.speed * 1.4);
      }
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

    // ===== МИКРО-ЗАМОРОЗКА (человечность, только на открытых уровнях) =====
    if (this.hesitateTimer > 0) {
      this.hesitateTimer--;
      return;
    }

    // ===== ДРЕЙФ И МИКРО-ЗАМОРОЗКИ — только на открытых уровнях =====
    if (basementMode === "") {
      this.driftTimer--;
      if (this.driftTimer <= 0) {
        this.driftAngle = (Math.random() - 0.5) * 0.36;
        this.driftTimer = 80 + Math.floor(Math.random() * 40);
      }
      if (Math.random() < 0.004) {
        this.hesitateTimer = 12;
      }
    } else {
      this.driftAngle = 0;
    }

    // Преследование кота через A*
    const tx = player.x + player.size/2 - this.width/2;
    const ty = player.y + player.size/2 - this.height/2;
    this._moveTowardTarget(tx, ty, this.speed);

    // ===== АНТИ-ЗАСТРЕВАНИЕ (только на открытых уровнях) =====
    // В подвале grid-node модель не может осциллировать — moveProgress монотонно возрастает.
    if (basementMode === "") {
      const CHECK_INTERVAL = 15;
      const NET_THRESHOLD2 = 4;
      const MAX_STUCK_CHECKS = 3;

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
            this.pathSegments = [];
            this.segmentIndex = 0;
            this.pathTimer = 0;
            this.stuckTimer = 0;
          }
        } else {
          this.stuckTimer = 0;
        }
        this.lastX = this.x;
        this.lastY = this.y;
      }
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
