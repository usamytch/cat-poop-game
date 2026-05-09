// ==========================================
// LEVEL — grid system, level generation, obstacles
// ==========================================

let currentLocation = locationThemes[0];
let levelSeed = 1;
// "corridor" | "dfs" | "" — режим подвала для текущего уровня
let basementMode = "";
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
// GRID_ROWS=15, GRID_COLS=30 → max key = 29*100+14 = 2914 (уникален при col<100, row<100)
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

// ===== VALUE NOISE =====
// Дешёвый seeded hash без зависимостей — даёт [0..1] для любой (col, row, seed).
// Используется для создания карты "плотности" — естественные кластеры вместо чистого рандома.
function valueNoise(col, row, seed) {
  let h = (col * 374761393 + row * 1103515245 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1540483477);
  h = h ^ (h >>> 15);
  return (h & 0x7fffffff) / 0x7fffffff; // [0..1]
}

// ===== ПРОФИЛЬ УРОВНЯ =====
// Определяет параметры генерации в зависимости от уровня:
// - padding: зазор вокруг объекта при проверке свободности (0 = вплотную разрешено)
// - wallBias: вероятность выбора позиции у стены (для zone="wall"/"corner")
// - centerOpen: вероятность отклонить позицию в центре (сохраняет открытое пространство)
// - noiseThreshold: порог noise для принятия позиции (ниже = плотнее кластеры)
function getLevelProfile(lvl) {
  if (lvl <= 3) {
    // Просторно: объекты у стен, центр свободен, большие зазоры
    return { padding: 1, wallBias: 0.80, centerOpen: 0.70, noiseThreshold: 0.40 };
  }
  if (lvl <= 7) {
    // Обжитое: смешанное размещение, умеренные кластеры
    return { padding: 1, wallBias: 0.60, centerOpen: 0.35, noiseThreshold: 0.28 };
  }
  // Захламлено: плотные кластеры, объекты могут касаться
  return { padding: 0, wallBias: 0.45, centerOpen: 0.10, noiseThreshold: 0.18 };
}

// ===== ЗОНАЛЬНОЕ РАЗМЕЩЕНИЕ =====
// Возвращает {col, row} с учётом предпочтительной зоны объекта и профиля уровня.
// Зоны:
//   "wall"   — края сетки (col 0-3 или 24-27, или row 0-2 или 12-14)
//   "corner" — угловые области (col 0-4 и row 0-4, или аналогичные углы)
//   "center" — центральная область (col 8-20, row 4-11)
//   "any"    — любая позиция
// С вероятностью wallBias выбирает из предпочтительной зоны, иначе — случайно.
function pickZonedPosition(rng, zone, wCells, hCells, profile) {
  const maxCol = GRID_COLS - wCells;
  const maxRow = GRID_ROWS - hCells;

  // Попытка выбрать позицию из предпочтительной зоны
  const useZone = rng() < profile.wallBias && zone !== "any";

  if (useZone) {
    let col, row;
    if (zone === "wall") {
      // Выбираем случайную стену: левая, правая, верхняя, нижняя
      const wall = Math.floor(rng() * 4);
      if (wall === 0) { // левая стена
        col = randInt(rng, 0, Math.min(3, maxCol));
        row = randInt(rng, 0, maxRow);
      } else if (wall === 1) { // правая стена
        col = randInt(rng, Math.max(0, GRID_COLS - 4 - wCells), maxCol);
        row = randInt(rng, 0, maxRow);
      } else if (wall === 2) { // верхняя стена
        col = randInt(rng, 0, maxCol);
        row = randInt(rng, 0, Math.min(2, maxRow));
      } else { // нижняя стена
        col = randInt(rng, 0, maxCol);
        row = randInt(rng, Math.max(0, GRID_ROWS - 3 - hCells), maxRow);
      }
      return { col, row };
    } else if (zone === "corner") {
      // Выбираем случайный угол
      const corner = Math.floor(rng() * 4);
      const cw = Math.min(5, maxCol + 1);
      const ch = Math.min(5, maxRow + 1);
      if (corner === 0) { // верхний левый
        col = randInt(rng, 0, Math.min(cw - 1, maxCol));
        row = randInt(rng, 0, Math.min(ch - 1, maxRow));
      } else if (corner === 1) { // верхний правый
        col = randInt(rng, Math.max(0, GRID_COLS - cw - wCells), maxCol);
        row = randInt(rng, 0, Math.min(ch - 1, maxRow));
      } else if (corner === 2) { // нижний левый
        col = randInt(rng, 0, Math.min(cw - 1, maxCol));
        row = randInt(rng, Math.max(0, GRID_ROWS - ch - hCells), maxRow);
      } else { // нижний правый
        col = randInt(rng, Math.max(0, GRID_COLS - cw - wCells), maxCol);
        row = randInt(rng, Math.max(0, GRID_ROWS - ch - hCells), maxRow);
      }
      return { col, row };
    } else if (zone === "center") {
      // Центральная зона
      const cColMin = Math.min(8, maxCol);
      const cColMax = Math.min(20, maxCol);
      const cRowMin = Math.min(4, maxRow);
      const cRowMax = Math.min(11, maxRow);
      col = randInt(rng, cColMin, cColMax);
      row = randInt(rng, cRowMin, cRowMax);
      return { col, row };
    }
  }

  // Случайная позиция (fallback или zone="any")
  const col = randInt(rng, 0, maxCol);
  const row = randInt(rng, 0, maxRow);
  return { col, row };
}

// ===== ГЕНЕРАЦИЯ ПРЕПЯТСТВИЯ =====
function generateObstacle(theme, rng, index, movingAllowed, profile) {
  const type = theme.obstacleTypes[randInt(rng, 0, theme.obstacleTypes.length - 1)];
  const meta = obstacleCatalog[type];

  // Размер в ячейках (случайный в диапазоне)
  const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
  const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);

  // Зональное размещение с учётом профиля уровня
  const zone = meta.zone || "any";
  const { col, row } = pickZonedPosition(rng, zone, wCells, hCells, profile);

  // Noise-фильтр: отклоняем позиции в "пустых" зонах карты плотности.
  // Это создаёт естественные кластеры — где-то густо, где-то пусто.
  const n = valueNoise(col, row, levelSeed);
  if (n < profile.noiseThreshold && rng() > 0.35) return null;

  // Для центральных объектов на ранних уровнях — дополнительный шанс отклонить
  // позицию в центре, чтобы сохранить открытое пространство для манёвра.
  if (profile.centerOpen > 0) {
    const inCenter = col >= 7 && col <= 21 && row >= 3 && row <= 12;
    if (inCenter && rng() < profile.centerOpen && zone !== "center") return null;
  }

  // Пиксельный размер кратен сетке
  const w = wCells * GRID;
  const h = hCells * GRID;

  // Padding при проверке свободности — создаёт "воздух" между объектами.
  // Маркируем только сам объект (без padding) — коллизии и A* не меняются.
  const pad = profile.padding;
  const checkCol = col - pad;
  const checkRow = row - pad;
  const checkW = wCells + pad * 2;
  const checkH = hCells + pad * 2;
  if (!cellsFree(checkCol, checkRow, checkW, checkH)) return null;

  const pos = cellToPixel(col, row);

  let moving = movingAllowed && rng() > 0.72;
  const axis = rng() > 0.5 ? "x" : "y";
  // Движущиеся препятствия двигаются на 1 ячейку в каждую сторону.
  // Инвариант: щель между препятствиями должна быть либо 0 (вплотную),
  // либо ≥1 ячейка (40px, проходима для кота 36px и хозяина 36px).
  // Движущееся препятствие с range=GRID создаёт промежуточные позиции
  // (например, 20px), нарушая инвариант, если соседняя ячейка занята.
  // Поэтому: движущееся препятствие должно иметь ≥2 свободных ячейки
  // в направлении движения с каждой стороны (чтобы в крайней точке
  // оставался зазор ≥1 ячейка).
  if (moving) {
    const clearOk = axis === "x"
      ? cellsFree(col - 2, row, 2, hCells) && cellsFree(col + wCells, row, 2, hCells)
      : cellsFree(col, row - 2, wCells, 2) && cellsFree(col, row + hCells, wCells, 2);
    if (!clearOk) moving = false;
  }
  const range = moving ? GRID : 0;
  const speed = moving ? randRange(rng, 0.008, 0.02) : 0;

  // Маркируем только сам объект (без padding) — инвариант коллизий сохраняется
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

    // Единый проход: пробуем занять ячейки; при первом конфликте откатываем уже добавленные.
    // Это вдвое сокращает число Set-операций на happy path (нет отдельного check-прохода).
    const added = [];
    let overlap = false;
    for (let r = row; r < row + hCells && !overlap; r++) {
      for (let c = col; c < col + wCells && !overlap; c++) {
        const k = cellKey(c, r);
        if (decorCells.has(k)) {
          overlap = true;
        } else {
          decorCells.add(k);
          added.push(k);
        }
      }
    }
    if (overlap) {
      // Откат: удаляем только те ячейки, что успели добавить до конфликта
      for (const k of added) decorCells.delete(k);
      continue;
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Создаёт объект стены-препятствия и добавляет его в obstacles.
// Тип определяется автоматически: wall_h (горизонталь) или wall_v (вертикаль).
// Возвращает true если стена добавлена, false если ячейки заняты.
function _makeWallObstacle(col, row, wCells, hCells) {
  if (!cellsFree(col, row, wCells, hCells)) return false;
  markCells(col, row, wCells, hCells);
  const pos = cellToPixel(col, row);
  const type = hCells <= wCells ? "wall_h" : "wall_v";
  obstacles.push({
    id: `${type}-${obstacles.length}-${col}-${row}`,
    type, col, row, wCells, hCells,
    x: pos.x, y: pos.y,
    width: wCells * GRID, height: hCells * GRID,
    moving: false, axis: "x", range: 0, speed: 0,
    phase: 0, movingOffset: 0, baseX: pos.x, baseY: pos.y,
  });
  return true;
}

// Размещает лоток в ячейке (c, r) и обновляет litterBox.
// Предполагает, что ячейки уже проверены как свободные.
function _placeLitterBoxAt(c, r, lbW, lbH) {
  markCells(c, r, lbW, lbH);
  const pos = cellToPixel(c, r);
  litterBox.x = pos.x;
  litterBox.y = pos.y;
  litterBox.width  = lbW * GRID;
  litterBox.height = lbH * GRID;
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
    _placeLitterBoxAt(c, r, lbW, lbH);
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
      _placeLitterBoxAt(c, r, lbW, lbH);
      return;
    }
  }
  // Абсолютный fallback — ищем первую свободную позицию без ограничений по дистанции
  // и без отступа. Проверяем occupiedCells, чтобы не попасть в DFS-полосы или стены.
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      if (!cellsFree(c, r, lbW, lbH)) continue;
      _placeLitterBoxAt(c, r, lbW, lbH);
      return;
    }
  }
  // Последний резерв — фиксированная позиция (на практике не должна достигаться)
  _placeLitterBoxAt(Math.max(0, GRID_COLS - lbW - 2), Math.max(0, GRID_ROWS - lbH - 2), lbW, lbH);
}

// ===== ПОДВАЛ: CORRIDOR MAZE =====
// Размещает горизонтальные и вертикальные стены с проходами.
// Стены — объекты типа wall_h / wall_v в массиве obstacles.
// Гарантирует проходимость: каждая стена имеет минимум 2 прохода шириной 2 ячейки.
function generateCorridorMaze(rng) {
  const b = getPlayBounds();

  // Вспомогательная функция: добавить wall-сегмент в obstacles
  function addWall(col, row, wCells, hCells) {
    _makeWallObstacle(col, row, wCells, hCells);
  }

  // Горизонтальные стены на строках 3, 6, 9, 12
  // Каждая стена — полная ширина с 2 проходами по 2 ячейки
  const hWallRows = [3, 6, 9, 12];
  for (const row of hWallRows) {
    // Генерируем 2 прохода: случайные позиции, не перекрывающиеся
    const gapWidth = 2;
    const totalCols = GRID_COLS; // 28
    // Делим на 3 зоны, в каждой зоне один проход
    const zoneW = Math.floor(totalCols / 3);
    const gaps = [];
    for (let z = 0; z < 3; z++) {
      // Берём 2 из 3 зон для проходов (случайно пропускаем одну)
      if (z === Math.floor(rng() * 3)) continue;
      const zoneStart = z * zoneW;
      const gapCol = zoneStart + randInt(rng, 0, zoneW - gapWidth - 1);
      gaps.push(gapCol);
    }
    // Строим стену: сегменты между проходами
    let col = 0;
    // Сортируем проходы
    gaps.sort((a, b) => a - b);
    for (const gapCol of gaps) {
      if (col < gapCol) {
        addWall(col, row, gapCol - col, 1);
      }
      col = gapCol + gapWidth;
    }
    if (col < GRID_COLS) {
      addWall(col, row, GRID_COLS - col, 1);
    }
  }

  // Вертикальные стены в колонках 7, 14, 21
  // Каждая — высота 3–4 ячейки с проходом
  const vWallCols = [7, 14, 21];
  for (const col of vWallCols) {
    // Размещаем 2–3 вертикальных сегмента с проходами между ними
    let row = 1;
    while (row < GRID_ROWS - 2) {
      const segH = randInt(rng, 2, 3);
      if (row + segH > GRID_ROWS - 1) break;
      addWall(col, row, 1, segH);
      row += segH + randInt(rng, 1, 2); // проход 1–2 ячейки
    }
  }

  // Боковые граничные стены (левый и правый края) — делают края играбельными.
  // Стены разбиты на секции между горизонтальными стенами (hWallRows).
  // В каждой секции — один проход шириной 2 ячейки, чтобы игрок мог
  // перемещаться между коридорами через боковые края.
  // Секции: [0..hWallRows[0]-1], [hWallRows[0]+1..hWallRows[1]-1], ..., [hWallRows[last]+1..GRID_ROWS-1]
  const gapW = 2; // ширина прохода в ячейках
  const sectionBounds = [];
  {
    let prev = 0;
    for (const wr of hWallRows) {
      // секция от prev до wr-1 (не включая саму горизонтальную стену)
      if (wr - 1 >= prev) sectionBounds.push({ from: prev, to: wr - 1 });
      prev = wr + 1; // пропускаем строку горизонтальной стены
    }
    // последняя секция после последней горизонтальной стены
    if (prev < GRID_ROWS) sectionBounds.push({ from: prev, to: GRID_ROWS - 1 });
  }

  for (const boundCol of [0, GRID_COLS - 1]) {
    for (const { from, to } of sectionBounds) {
      const segLen = to - from + 1;
      if (segLen <= gapW) {
        // Секция слишком короткая — оставляем полностью открытой (проход)
        continue;
      }
      // Случайная позиция прохода внутри секции
      const gapStart = from + randInt(rng, 0, segLen - gapW - 1);
      // Сегмент до прохода
      if (gapStart > from) {
        addWall(boundCol, from, 1, gapStart - from);
      }
      // Сегмент после прохода
      const afterGap = gapStart + gapW;
      if (afterGap <= to) {
        addWall(boundCol, afterGap, 1, to - afterGap + 1);
      }
    }
  }

  // Несколько декоративных препятствий из obstacleTypes подвала
  const decorTypes = currentLocation.obstacleTypes;
  let decorAtt = 0;
  let decorPlaced = 0;
  while (decorPlaced < 4 && decorAtt < 120) {
    decorAtt++;
    const type = decorTypes[randInt(rng, 0, decorTypes.length - 1)];
    const meta = obstacleCatalog[type];
    const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
    const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);
    const col = randInt(rng, 0, GRID_COLS - wCells);
    const row = randInt(rng, 0, GRID_ROWS - hCells);
    if (!_makeWallObstacle(col, row, wCells, hCells)) continue;
    decorPlaced++;
  }
}

// ===== ПОДВАЛ: DFS MAZE =====
// Классический лабиринт на основе DFS (Recursive Backtracker).
// Сетка комнат: каждая комната = 2×2 ячейки, стена между комнатами = 1 ячейка.
// Итого: 9 комнат по горизонтали × 4 по вертикали (при GRID_COLS=30, GRID_ROWS=15).
// Коридоры шириной 2 ячейки (80px) — гарантированно проходимы.
function generateDfsMaze(rng) {
  // Размер комнаты в ячейках (коридор + стена)
  const ROOM = 2;  // ячейки на комнату (коридор)
  const WALL = 1;  // ячейки на стену между комнатами
  const CELL = ROOM + WALL; // 3 ячейки на "шаг" сетки комнат

  // Количество комнат по горизонтали и вертикали
  // Оставляем по 1 ячейке отступа с каждой стороны
  const mCols = Math.floor((GRID_COLS - 1) / CELL); // ~9
  const mRows = Math.floor((GRID_ROWS - 1) / CELL); // ~4

  // Матрица посещённых комнат
  const visited = new Array(mCols * mRows).fill(false);
  // Матрица стен: true = стена стоит (закрыта)
  // Горизонтальные стены (между комнатами по вертикали): (mCols) × (mRows-1)
  const hWalls = new Array(mCols * (mRows - 1)).fill(true);
  // Вертикальные стены (между комнатами по горизонтали): (mCols-1) × mRows
  const vWalls = new Array((mCols - 1) * mRows).fill(true);

  function roomIdx(c, r) { return r * mCols + c; }

  // DFS с явным стеком (не рекурсия — избегаем stack overflow)
  const startC = randInt(rng, 0, mCols - 1);
  const startR = randInt(rng, 0, mRows - 1);
  const stack = [{ c: startC, r: startR }];
  visited[roomIdx(startC, startR)] = true;

  const dirs = [
    { dc: 0, dr: -1, name: "up" },
    { dc: 1, dr:  0, name: "right" },
    { dc: 0, dr:  1, name: "down" },
    { dc: -1, dr: 0, name: "left" },
  ];

  while (stack.length > 0) {
    const { c, r } = stack[stack.length - 1];
    // Перемешиваем направления через rng
    const shuffled = [...dirs].sort(() => rng() - 0.5);
    let moved = false;
    for (const { dc, dr, name } of shuffled) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= mCols || nr < 0 || nr >= mRows) continue;
      if (visited[roomIdx(nc, nr)]) continue;
      // Убираем стену между (c,r) и (nc,nr)
      if (name === "right") vWalls[(mCols - 1) * r + c] = false;
      else if (name === "left") vWalls[(mCols - 1) * r + (nc)] = false;
      else if (name === "down") hWalls[mCols * r + c] = false;
      else if (name === "up")   hWalls[mCols * (nr) + c] = false;
      visited[roomIdx(nc, nr)] = true;
      stack.push({ c: nc, r: nr });
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }

  // Конвертируем стены в объекты obstacles
  // Начальный offset: 1 ячейка отступа от края
  const offC = 1, offR = 1;

  function addWallSeg(col, row, wCells, hCells) {
    if (col < 0 || row < 0 || col + wCells > GRID_COLS || row + hCells > GRID_ROWS) return;
    _makeWallObstacle(col, row, wCells, hCells);
  }

  // Внешние стены (периметр)
  // Верхняя и нижняя
  addWallSeg(offC, offR - 1, mCols * CELL - WALL, 1);
  addWallSeg(offC, offR + mRows * CELL - WALL, mCols * CELL - WALL, 1);
  // Левая и правая
  addWallSeg(offC - 1, offR, 1, mRows * CELL - WALL);
  addWallSeg(offC + mCols * CELL - WALL, offR, 1, mRows * CELL - WALL);

  // Внутренние вертикальные стены (между комнатами по горизонтали)
  for (let r = 0; r < mRows; r++) {
    for (let c = 0; c < mCols - 1; c++) {
      if (vWalls[(mCols - 1) * r + c]) {
        // Стена между комнатой (c,r) и (c+1,r)
        const wallCol = offC + (c + 1) * CELL - WALL;
        const wallRow = offR + r * CELL;
        addWallSeg(wallCol, wallRow, WALL, ROOM);
      }
    }
  }

  // Внутренние горизонтальные стены (между комнатами по вертикали)
  for (let r = 0; r < mRows - 1; r++) {
    for (let c = 0; c < mCols; c++) {
      if (hWalls[mCols * r + c]) {
        // Стена между комнатой (c,r) и (c,r+1)
        const wallCol = offC + c * CELL;
        const wallRow = offR + (r + 1) * CELL - WALL;
        addWallSeg(wallCol, wallRow, ROOM, WALL);
      }
    }
  }

  // Угловые столбики на пересечениях стен
  for (let r = 0; r <= mRows; r++) {
    for (let c = 0; c <= mCols; c++) {
      const col = offC + c * CELL - (c > 0 ? WALL : 0) - (c === 0 ? 1 : 0);
      const row = offR + r * CELL - (r > 0 ? WALL : 0) - (r === 0 ? 1 : 0);
      // Только угловые точки на пересечениях внутренних стен
      if (c > 0 && c < mCols && r > 0 && r < mRows) {
        const wallCol = offC + c * CELL - WALL;
        const wallRow = offR + r * CELL - WALL;
        addWallSeg(wallCol, wallRow, WALL, WALL);
      }
    }
  }

  // Вернуть границы DFS-сетки для последующего заполнения полос в generateLevel().
  // DFS-сетка занимает cols [offC-1 .. mazeRightEdge].
  // При GRID_COLS=30 и offC=1: mazeRightEdge = 1 + 9*3 - 1 = 27.
  // Колонки 28..29 остаются вне лабиринта и должны быть заполнены кирпичами.
  // Заполнение делается в generateLevel() ПОСЛЕ unmarkCells(spawn), чтобы
  // unmarkCells не снял маркировку полос.
  return { offC, mazeRightEdge: offC + mCols * CELL - WALL };
}

// Заполняет колонки вне DFS-сетки сплошными стенами.
// Вызывается из generateLevel() ПОСЛЕ unmarkCells(spawn).
function _fillDfsStrips(offC, mazeRightEdge) {
  function addSolidStrip(col) {
    if (col < 0 || col >= GRID_COLS) return;
    _makeWallObstacle(col, 0, 1, GRID_ROWS);
  }
  for (let c = mazeRightEdge + 1; c < GRID_COLS; c++) addSolidStrip(c);
  for (let c = 0; c < offC - 1; c++) addSolidStrip(c);
}

// ===== ПРОВЕРКА ПРОХОДИМОСТИ ПОДВАЛА =====
// После генерации лабиринта + размещения лотка проверяем, что A* находит путь
// от спавна кота до лотка. Если нет — удаляем декоративные препятствия по одному.
// Это гарантирует, что ящик/бочка не заблокирует единственный путь в DFS-лабиринте.
function _ensureBasementReachable(spawnCol, spawnRow) {
  const lbCell = pixelToCell(
    litterBox.x + litterBox.width / 2,
    litterBox.y + litterBox.height / 2
  );

  // Собираем декоративные препятствия (не стены лабиринта)
  const decorObs = obstacles.filter(o => o.type !== 'wall_h' && o.type !== 'wall_v');

  // Проверяем проходимость; если заблокировано — удаляем декор по одному.
  // Используем увеличенный лимит итераций (2000) — вызывается только при генерации уровня,
  // не в рантайме, поэтому производительность не критична.
  for (let attempt = 0; attempt <= decorObs.length; attempt++) {
    const path = aStarPath(spawnCol, spawnRow, lbCell.col, lbCell.row, undefined, undefined, 2000);
    if (path) break; // путь найден — готово

    if (decorObs.length === 0) break; // нечего удалять
    // Удаляем последний декоративный объект
    const toRemove = decorObs.pop();
    const idx = obstacles.indexOf(toRemove);
    if (idx !== -1) obstacles.splice(idx, 1);
    unmarkCells(toRemove.col, toRemove.row, toRemove.wCells, toRemove.hCells);
  }
}

// ===== ГЕНЕРАЦИЯ УРОВНЯ =====
function generateLevel() {
  levelSeed = level * 9973 + score * 17 + globalSeed * 31 + 13;
  const rng = createRng(levelSeed);

  // ===== ВЫБОР ЛОКАЦИИ =====
  // Подвал — закрытая локация, появляется только с уровня 9+.
  // DFS-режим (сложнее) проверяется первым — он перекрывает corridor при level>=20.
  // Обычные локации выбираются из 5 тем (без подвала).
  const normalThemes = locationThemes.filter(t => t.key !== "basement");
  basementMode = "";
  if (level >= BASEMENT.dfsMinLevel && rng() < BASEMENT.dfsProb) {
    currentLocation = locationThemes.find(t => t.key === "basement");
    basementMode = "dfs";
  } else if (level >= BASEMENT.corridorMinLevel && rng() < BASEMENT.corridorProb) {
    currentLocation = locationThemes.find(t => t.key === "basement");
    basementMode = "corridor";
  } else {
    currentLocation = normalThemes[randInt(rng, 0, normalThemes.length - 1)];
  }

  obstacles.length = 0;
  bonuses.length = 0;
  catnipTimer = 0;  // сброс котовника при старте нового уровня
  occupiedCells.clear();

  // Спавн кота — случайный угол сетки (детерминировано через RNG)
  // 0=левый нижний, 1=правый нижний, 2=левый верхний, 3=правый верхний
  const cornerIdx = randInt(rng, 0, 3);
  let spawnCol = (cornerIdx === 1 || cornerIdx === 3) ? GRID_COLS - 1 : 0;
  const spawnRow = (cornerIdx === 0 || cornerIdx === 1) ? GRID_ROWS - 1 : 0;

  // В DFS-режиме лабиринт занимает cols offC..mazeRightEdge (1..27 при GRID_COLS=30).
  // Cols 28..29 будут заполнены сплошными стенами — спавн там невозможен.
  // Зажимаем spawnCol в пределы лабиринта, чтобы кот не оказался замурован.
  if (basementMode === "dfs") {
    const _dfsOffC = 1;
    const _dfsCELL = 3; // ROOM(2) + WALL(1)
    const _dfsMCols = Math.floor((GRID_COLS - 1) / _dfsCELL); // 9
    const _dfsMazeRight = _dfsOffC + _dfsMCols * _dfsCELL - 1; // 27
    spawnCol = Math.min(spawnCol, _dfsMazeRight - 1); // не дальше col 26 (с запасом)
  }

  const b = getPlayBounds();
  const spawnPos = cellToPixel(spawnCol, spawnRow);
  const spawn = { x: spawnPos.x, y: spawnPos.y, width: player.size, height: player.size };

  // Заблокировать ячейки вокруг спавна (3×3 зона, с учётом границ)
  const blockCol = Math.max(0, Math.min(spawnCol, GRID_COLS - 3));
  const blockRow = Math.max(0, Math.min(spawnRow - (spawnRow > 0 ? 2 : 0), GRID_ROWS - 3));
  markCells(blockCol, blockRow, 3, 3);

  let _dfsStrips = null; // данные для заполнения полос DFS после unmarkCells
  if (currentLocation.key === "basement") {
    // ===== ПОДВАЛ: лабиринт =====
    if (basementMode === "dfs") {
      _dfsStrips = generateDfsMaze(rng);
    } else {
      generateCorridorMaze(rng);
    }
  } else {
    // ===== ОБЫЧНЫЙ УРОВЕНЬ: препятствия =====
    const obstCount = Math.min(4 + level, 12);
    const movingAllowed = level >= 5;
    const profile = getLevelProfile(level);
    let att = 0;
    while (obstacles.length < obstCount && att < obstCount * 80) {
      att++;
      const ob = generateObstacle(currentLocation, rng, obstacles.length, movingAllowed, profile);
      if (ob) obstacles.push(ob);
    }
  }

  // Размещение лотка
  // Снять блокировку спавна (кот может туда вернуться)
  unmarkCells(blockCol, blockRow, 3, 3);

  // DFS: заполнить колонки вне сетки лабиринта сплошными стенами.
  // Делается ПОСЛЕ unmarkCells (чтобы unmarkCells не снял маркировку полос)
  // и ДО placeLitterBox (чтобы лоток не попал в заблокированные колонки).
  if (_dfsStrips) {
    _fillDfsStrips(_dfsStrips.offC, _dfsStrips.mazeRightEdge);
  }

  // Размещение лотка — после заполнения DFS-полос, чтобы лоток не попал туда
  placeLitterBox(rng, spawnCol, spawnRow);

  // Гарантия проходимости подвала: если ящик/бочка заблокировали единственный
  // путь к лотку — удаляем декоративные препятствия по одному до восстановления пути.
  if (currentLocation.key === "basement") {
    _ensureBasementReachable(spawnCol, spawnRow);
  }

  // Позиция игрока
  player.x = spawn.x;
  player.y = spawn.y;
  levelMessageTimer = 180;

  // Декор: больше элементов на поздних уровнях (5–8 вместо 3–5)
  // Ранние уровни — меньше декора, поздние — богаче
  const decorMin = level <= 3 ? 4 : level <= 7 ? 5 : 6;
  const decorMax = level <= 3 ? 6 : level <= 7 ? 7 : 8;
  const decorCount = randInt(rng, decorMin, decorMax);
  generateDecor(currentLocation, rng, decorCount);

  // Спавн бонусов — на свободных ячейках сетки
  // Количество бонусов растёт с уровнем: больше бонусов на поздних уровнях
  const bonusCount = level >= 12 ? 6 : level >= 10 ? 5 : level >= 7 ? 4 : level >= 4 ? 3 : 2;

  // Взвешенный пул типов бонусов — на поздних уровнях больше таблеток, жизней и котовника.
  // Жизнь (life) появляется только с уровня 5.
  // Котовник (catnip) появляется только с уровня 7.
  // Уровни 1–3:  fish 40%, yarn 30%, pill 30%
  // Уровни 4–6:  fish 30%, yarn 30%, pill 40%
  // Уровни 7–9:  fish 18%, yarn 18%, pill 36%, life 18%, catnip 9%
  // Уровни 10+:  fish 9%, yarn 18%, pill 27%, life 27%, catnip 18%
  const bonusPool = level >= 10
    ? ["fish","yarn","yarn","pill","pill","pill","catnip","catnip","life","life","life"]
    : level >= 7
      ? ["fish","fish","yarn","yarn","pill","pill","pill","pill","catnip","life","life"]
      : level >= 4
        ? ["fish","fish","fish","yarn","yarn","yarn","pill","pill","pill","pill"]
        : ["fish","fish","fish","fish","yarn","yarn","yarn","pill","pill","pill"];

  let batt = 0;
  let lifeSpawned = 0; // не более 1 жизни за уровень
  while (bonuses.length < bonusCount && batt < 200) {
    batt++;
    const bc = randInt(rng, 1, GRID_COLS - 2);
    const br = randInt(rng, 1, GRID_ROWS - 2);
    if (!isCellFree(bc, br)) continue;
    const center = cellToPixelCenter(bc, br);
    let btype = bonusPool[randInt(rng, 0, bonusPool.length - 1)];
    // Ограничиваем жизнь: максимум 1 за уровень
    if (btype === "life") {
      if (lifeSpawned >= 1) btype = "pill";
      else lifeSpawned++;
    }
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
