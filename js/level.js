// ==========================================
// LEVEL — grid-based generation, litter box placement
// ==========================================

let currentLocation = locationThemes[0];
let levelSeed = 1;
// Per-run random seed set from Date.now() at startGame().
// Mixing it into levelSeed makes every game run produce a unique map
// while keeping tests deterministic (tests set globalSeed = 0).
let globalSeed = 0;
let levelMessageTimer = 180;
const obstacles = [];
const decorItems = []; // фоновые декоративные элементы (без коллизий)

const litterBox = { x:620, y:310, width: GRID*2, height: GRID*2 };

// ===== СЕТКА =====
// OPT 2: Целочисленный ключ вместо строки `${col},${row}`.
// GRID_ROWS=13, GRID_COLS=28 → max key = 27*100+12 = 2712 (уникален при col<100, row<100)
// occupiedCells хранит числовые ключи col*100+row для всех занятых ячеек.
// Декор не занимает ячейки.
const occupiedCells = new Set();

function cellKey(col, row) {
  return col * 100 + row;
}

function markCells(col, row, wCells, hCells) {
  for (let r = row; r < row + hCells; r++) {
    for (let c = col; c < col + wCells; c++) {
      occupiedCells.add(cellKey(c, r));
    }
  }
}

function unmarkCells(col, row, wCells, hCells) {
  for (let r = row; r < row + hCells; r++) {
    for (let c = col; c < col + wCells; c++) {
      occupiedCells.delete(cellKey(c, r));
    }
  }
}

// Проверяет, что все ячейки в прямоугольнике col..col+wCells-1, row..row+hCells-1
// свободны И находятся в пределах сетки
function cellsFree(col, row, wCells, hCells) {
  if (col < 0 || row < 0 || col + wCells > GRID_COLS || row + hCells > GRID_ROWS) return false;
  for (let r = row; r < row + hCells; r++) {
    for (let c = col; c < col + wCells; c++) {
      if (occupiedCells.has(cellKey(c, r))) return false;
    }
  }
  return true;
}

// Проверяет, что ячейка (col, row) свободна (для A* и навигации)
function isCellFree(col, row) {
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return false;
  return !occupiedCells.has(cellKey(col, row));
}

// Конвертация пиксельных координат в ячейку сетки
function pixelToCell(px, py) {
  const b = getPlayBounds();
  return {
    col: Math.floor((px - b.left) / GRID),
    row: Math.floor((py - b.top)  / GRID),
  };
}

// Центр ячейки в пикселях
function cellToPixelCenter(col, row) {
  const b = getPlayBounds();
  return {
    x: b.left + col * GRID + GRID / 2,
    y: b.top  + row * GRID + GRID / 2,
  };
}

// Левый верхний угол ячейки в пикселях
function cellToPixel(col, row) {
  const b = getPlayBounds();
  return {
    x: b.left + col * GRID,
    y: b.top  + row * GRID,
  };
}

// ===== OPT 1: A* PATHFINDING с min-heap =====
// MinHeap — бинарная куча с минимальным элементом наверху.
// Заменяет O(n) линейный поиск на O(log n) push/pop.
class MinHeap {
  constructor(cmp) {
    this._data = [];
    this._cmp = cmp;
  }
  get size() { return this._data.length; }
  isEmpty() { return this._data.length === 0; }
  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }
  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._cmp(this._data[i], this._data[parent]) < 0) {
        const tmp = this._data[i]; this._data[i] = this._data[parent]; this._data[parent] = tmp;
        i = parent;
      } else break;
    }
  }
  _siftDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2*i+1, r = 2*i+2;
      if (l < n && this._cmp(this._data[l], this._data[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this._data[r], this._data[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      const tmp = this._data[i]; this._data[i] = this._data[smallest]; this._data[smallest] = tmp;
      i = smallest;
    }
  }
}

// OPT 9: Переиспользуемые Map/Set для A* — не создаём new каждый раз
const _astarOpen = new Map();    // key → node
const _astarClosed = new Set();  // key

// Возвращает массив {col, row} от startCell до goalCell, или null если пути нет.
// Использует 4-связную сетку (вверх/вниз/влево/вправо).
// entityW/entityH — физический размер сущности (px) для проверки проходимости ячеек.
function aStarPath(startCol, startRow, goalCol, goalRow, entityW, entityH) {
  const heuristic = (c, r) => Math.abs(c - goalCol) + Math.abs(r - goalRow);

  // Проверяет, может ли сущность физически находиться в центре ячейки (nc, nr)
  const canPass = (nc, nr) => {
    if (!isCellFree(nc, nr)) return false;
    if (entityW && entityH) {
      const center = cellToPixelCenter(nc, nr);
      const rect = {
        x: center.x - entityW / 2,
        y: center.y - entityH / 2,
        width: entityW,
        height: entityH,
      };
      if (hitsObstacles(rect)) return false;
    }
    return true;
  };

  // OPT 9: очищаем переиспользуемые структуры
  _astarOpen.clear();
  _astarClosed.clear();

  // OPT 1: min-heap по f вместо линейного поиска
  const heap = new MinHeap((a, b) => a.f - b.f);

  const startKey = cellKey(startCol, startRow);
  const startNode = { col: startCol, row: startRow, g: 0, f: heuristic(startCol, startRow), parent: null };
  _astarOpen.set(startKey, startNode);
  heap.push(startNode);

  const dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}];

  let iterations = 0;
  while (!heap.isEmpty() && iterations < 600) {
    iterations++;

    // OPT 1: O(log n) вместо O(n)
    const current = heap.pop();
    const ck = cellKey(current.col, current.row);

    // Узел мог быть обновлён — пропускаем устаревшие копии
    if (_astarClosed.has(ck)) continue;
    _astarClosed.add(ck);
    _astarOpen.delete(ck);

    if (current.col === goalCol && current.row === goalRow) {
      // Восстановить путь
      const path = [];
      let n = current;
      while (n) { path.unshift({col: n.col, row: n.row}); n = n.parent; }
      return path;
    }

    for (const {dc, dr} of dirs) {
      const nc = current.col + dc;
      const nr = current.row + dr;
      const nk = cellKey(nc, nr);
      if (_astarClosed.has(nk)) continue;
      // Разрешаем проход через свободные ячейки ИЛИ через цель (даже если занята лотком)
      const isGoal = nc === goalCol && nr === goalRow;
      if (!isGoal && !canPass(nc, nr)) continue;

      const g = current.g + 1;
      const existing = _astarOpen.get(nk);
      if (!existing || g < existing.g) {
        const node = { col: nc, row: nr, g, f: g + heuristic(nc, nr), parent: current };
        _astarOpen.set(nk, node);
        heap.push(node); // старая копия будет пропущена через _astarClosed
      }
    }
  }
  return null; // путь не найден
}

// ===== ГЕНЕРАЦИЯ ПРЕПЯТСТВИЯ =====
function generateObstacle(theme, rng, index, movingAllowed) {
  const type = theme.obstacleTypes[randInt(rng, 0, theme.obstacleTypes.length - 1)];
  const meta = obstacleCatalog[type];

  // Размер в ячейках (случайный в диапазоне)
  const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
  const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);

  // Пиксельный размер кратен сетке
  const w = wCells * GRID;
  const h = hCells * GRID;

  // Случайная позиция в сетке
  const col = randInt(rng, 0, GRID_COLS - wCells);
  const row = randInt(rng, 0, GRID_ROWS - hCells);

  if (!cellsFree(col, row, wCells, hCells)) return null;

  const pos = cellToPixel(col, row);

  const moving = movingAllowed && rng() > 0.72;
  const axis = rng() > 0.5 ? "x" : "y";
  // Движущиеся препятствия двигаются на 1 ячейку в каждую сторону
  const range = moving ? GRID : 0;
  const speed = moving ? randRange(rng, 0.008, 0.02) : 0;

  markCells(col, row, wCells, hCells);

  return {
    id: `${type}-${index}-${Math.floor(rng() * 100000)}`,
    type, col, row, wCells, hCells,
    x: pos.x, y: pos.y, width: w, height: h,
    moving, axis, range, speed,
    phase: randRange(rng, 0, Math.PI * 2),
    movingOffset: 0,
    baseX: pos.x, baseY: pos.y,
  };
}

// ===== ГЕНЕРАЦИЯ ДЕКОРА =====
function generateDecor(theme, rng, count) {
  decorItems.length = 0;
  if (!theme.decorTypes || theme.decorTypes.length === 0) return;

  for (let i = 0; i < count; i++) {
    const type = theme.decorTypes[randInt(rng, 0, theme.decorTypes.length - 1)];
    const meta = decorCatalog[type];
    const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
    const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);
    const col = randInt(rng, 0, GRID_COLS - wCells);
    const row = randInt(rng, 0, GRID_ROWS - hCells);
    const pos = cellToPixel(col, row);
    decorItems.push({
      type, col, row, wCells, hCells,
      x: pos.x, y: pos.y,
      width: wCells * GRID, height: hCells * GRID,
      drawStyle: meta.draw,
    });
  }
}

// ===== РАЗМЕЩЕНИЕ ЛОТКА =====
function placeLitterBox(rng, spawnCol, spawnRow) {
  // Лоток занимает 2×2 ячейки (80×80px при GRID=40)
  const lbW = 2, lbH = 2;
  const minDist = Math.min(3 + Math.floor((level - 1) * 0.5), 8); // минимум ячеек от спавна

  // Перемешанный список всех возможных позиций
  const candidates = [];
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      const dist = Math.abs(c - spawnCol) + Math.abs(r - spawnRow);
      if (dist >= minDist) candidates.push({c, r});
    }
  }

  // Перемешать кандидатов
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // HUD занимает примерно первые 8 колонок × 6 строк (левый верхний угол)
  const hudCols = 8, hudRows = 6;

  for (const {c, r} of candidates) {
    // Не ставить под HUD
    if (c < hudCols && r < hudRows) continue;
    // Проверяем лоток + 2 ячейки отступа со всех сторон (чтобы не касался препятствий)
    const pad = 2;
    const mc = Math.max(0, c - pad);
    const mr = Math.max(0, r - pad);
    const rightPad = Math.min(pad, GRID_COLS - (c + lbW));
    const bottomPad = Math.min(pad, GRID_ROWS - (r + lbH));
    const mw = (c - mc) + lbW + rightPad;
    const mh = (r - mr) + lbH + bottomPad;
    if (!cellsFree(mc, mr, mw, mh)) continue;

    markCells(c, r, lbW, lbH);
    const pos = cellToPixel(c, r);
    litterBox.x = pos.x;
    litterBox.y = pos.y;
    litterBox.width  = lbW * GRID;
    litterBox.height = lbH * GRID;
    return;
  }

  // Fallback — ищем любую свободную позицию без ограничения дистанции, но с отступом
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      if (c < hudCols && r < hudRows) continue;
      const pad = 1; // в крайнем случае хватит 1 ячейки
      const mc = Math.max(0, c - pad);
      const mr = Math.max(0, r - pad);
      const rightPad = Math.min(pad, GRID_COLS - (c + lbW));
      const bottomPad = Math.min(pad, GRID_ROWS - (r + lbH));
      const mw = (c - mc) + lbW + rightPad;
      const mh = (r - mr) + lbH + bottomPad;
      if (!cellsFree(mc, mr, mw, mh)) continue;
      markCells(c, r, lbW, lbH);
      const pos = cellToPixel(c, r);
      litterBox.x = pos.x;
      litterBox.y = pos.y;
      litterBox.width  = lbW * GRID;
      litterBox.height = lbH * GRID;
      return;
    }
  }
  // Абсолютный fallback — правый нижний угол (без проверок, крайний случай)
  const fc = GRID_COLS - lbW;
  const fr = GRID_ROWS - lbH;
  const pos = cellToPixel(fc, fr);
  litterBox.x = pos.x;
  litterBox.y = pos.y;
  litterBox.width  = lbW * GRID;
  litterBox.height = lbH * GRID;
}

// ===== ГЕНЕРАЦИЯ УРОВНЯ =====
function generateLevel() {
  levelSeed = level * 9973 + score * 17 + globalSeed * 31 + 13;
  const rng = createRng(levelSeed);
  currentLocation = locationThemes[randInt(rng, 0, locationThemes.length - 1)];

  obstacles.length = 0;
  bonuses.length = 0;
  occupiedCells.clear();

  const obstCount = Math.min(4 + level, 12);
  const movingAllowed = level >= 5;

  // Спавн кота — левый нижний угол сетки
  const spawnCol = 0;
  const spawnRow = GRID_ROWS - 1;
  const b = getPlayBounds();
  const spawnPos = cellToPixel(spawnCol, spawnRow);
  const spawn = { x: spawnPos.x, y: spawnPos.y, width: player.size, height: player.size };

  // Заблокировать ячейки вокруг спавна (3×3 зона)
  markCells(spawnCol, Math.max(0, spawnRow - 2), 3, 3);

  // Генерация препятствий
  let att = 0;
  while (obstacles.length < obstCount && att < obstCount * 60) {
    att++;
    const ob = generateObstacle(currentLocation, rng, obstacles.length, movingAllowed);
    if (ob) obstacles.push(ob);
  }

  // Размещение лотка
  placeLitterBox(rng, spawnCol, spawnRow);

  // Снять блокировку спавна (кот может туда вернуться)
  unmarkCells(spawnCol, Math.max(0, spawnRow - 2), 3, 3);

  // Позиция игрока
  player.x = spawn.x;
  player.y = spawn.y;
  levelMessageTimer = 180;

  // Декор (3–5 элементов, не блокируют)
  const decorCount = randInt(rng, 3, 5);
  generateDecor(currentLocation, rng, decorCount);

  // Спавн бонусов — на свободных ячейках сетки
  const bonusKeys = Object.keys(BONUS_TYPES);
  const bonusCount = 2 + (level > 3 ? 1 : 0);
  let batt = 0;
  while (bonuses.length < bonusCount && batt < 200) {
    batt++;
    const bc = randInt(rng, 1, GRID_COLS - 2);
    const br = randInt(rng, 1, GRID_ROWS - 2);
    if (!isCellFree(bc, br)) continue;
    const center = cellToPixelCenter(bc, br);
    const btype = bonusKeys[randInt(rng, 0, bonusKeys.length - 1)];
    bonuses.push({ x: center.x, y: center.y, type: btype, alive: true, pulse: Math.random() * Math.PI * 2 });
  }

  // OPT 4: Перестраиваем offscreen-слой фона при каждой генерации уровня
  if (typeof rebuildBgLayer === 'function') rebuildBgLayer();
}

// ===== ОБНОВЛЕНИЕ ПРЕПЯТСТВИЙ =====
function updateObstacles() {
  for (const ob of obstacles) {
    if (!ob.moving) continue;
    ob.movingOffset = Math.sin(ob.phase + performance.now() * ob.speed) * ob.range;
    if (ob.axis === "x") ob.x = ob.baseX + ob.movingOffset;
    else                  ob.y = ob.baseY + ob.movingOffset;
  }
}
