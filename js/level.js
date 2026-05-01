// ==========================================
// LEVEL — grid system, level generation, obstacles
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

  // Отдельный Set занятых декором ячеек — декор не перекрывает другой декор,
  // но может лежать под препятствиями (это нормально визуально)
  const decorCells = new Set();

  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 40;

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const type = theme.decorTypes[randInt(rng, 0, theme.decorTypes.length - 1)];
    const meta = decorCatalog[type];
    const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
    const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);
    const col = randInt(rng, 0, GRID_COLS - wCells);
    const row = randInt(rng, 0, GRID_ROWS - hCells);

    // Проверяем, что ни одна ячейка не занята другим декором
    let overlap = false;
    outer: for (let r = row; r < row + hCells; r++) {
      for (let c = col; c < col + wCells; c++) {
        if (decorCells.has(cellKey(c, r))) { overlap = true; break outer; }
      }
    }
    if (overlap) continue;

    // Занимаем ячейки в decorCells
    for (let r = row; r < row + hCells; r++) {
      for (let c = col; c < col + wCells; c++) {
        decorCells.add(cellKey(c, r));
      }
    }

    const pos = cellToPixel(col, row);
    decorItems.push({
      type, col, row, wCells, hCells,
      x: pos.x, y: pos.y,
      width: wCells * GRID, height: hCells * GRID,
      drawStyle: meta.draw,
    });
    placed++;
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

  // Спавн кота — случайный угол сетки (детерминировано через RNG)
  // 0=левый нижний, 1=правый нижний, 2=левый верхний, 3=правый верхний
  const cornerIdx = randInt(rng, 0, 3);
  const spawnCol = (cornerIdx === 1 || cornerIdx === 3) ? GRID_COLS - 1 : 0;
  const spawnRow = (cornerIdx === 0 || cornerIdx === 1) ? GRID_ROWS - 1 : 0;
  const b = getPlayBounds();
  const spawnPos = cellToPixel(spawnCol, spawnRow);
  const spawn = { x: spawnPos.x, y: spawnPos.y, width: player.size, height: player.size };

  // Заблокировать ячейки вокруг спавна (3×3 зона, с учётом границ)
  const blockCol = Math.max(0, Math.min(spawnCol, GRID_COLS - 3));
  const blockRow = Math.max(0, Math.min(spawnRow - (spawnRow > 0 ? 2 : 0), GRID_ROWS - 3));
  markCells(blockCol, blockRow, 3, 3);

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
  unmarkCells(blockCol, blockRow, 3, 3);

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
