// ==========================================
// LEVEL — grid system, level generation, obstacles
// ==========================================

let currentLocation = locationThemes[0];
let currentLevelProgression = null;
let levelSeed = 1;
let currentLevelVariant = 0;
let currentLevelQualityReport = null;
// "corridor" | "dfs" | "" — режим подвала для текущего уровня
let basementMode = "";
// Флаг чит-кода: при true следующий generateLevel() форсирует подвал (corridor)
let cheatBasement = false;
// Флаг чит-кода: при true следующий generateLevel() форсирует подвал (dfs)
let cheatDfs = false;
// QA-only: пропустить случайную аномалию и открыть конкретную обычную комнату.
let cheatLocationKey = "";
// Per-run random seed set from Date.now() at startGame(). Geometry is derived
// only from this seed + level + bounded candidate variant: score never changes
// the map. AI has its own deterministic stream; cosmetic FX may stay random.
let globalSeed = 0;
let aiRng = createRng(1);
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

function makeCellRect(col, row, wCells, hCells) {
  return { col, row, wCells, hCells };
}

function clampCellRect(rect) {
  const col = clamp(rect.col, 0, GRID_COLS);
  const row = clamp(rect.row, 0, GRID_ROWS);
  const right = clamp(rect.col + rect.wCells, 0, GRID_COLS);
  const bottom = clamp(rect.row + rect.hCells, 0, GRID_ROWS);
  return makeCellRect(col, row, Math.max(0, right - col), Math.max(0, bottom - row));
}

function expandCellRect(rect, margin) {
  return makeCellRect(
    rect.col - margin,
    rect.row - margin,
    rect.wCells + margin * 2,
    rect.hCells + margin * 2
  );
}

function eachCellInRect(rect, fn) {
  for (let r = rect.row; r < rect.row + rect.hCells; r++) {
    for (let c = rect.col; c < rect.col + rect.wCells; c++) {
      fn(c, r);
    }
  }
}

function setHasRectCells(set, rect) {
  const clamped = clampCellRect(rect);
  if (clamped.wCells !== rect.wCells || clamped.hCells !== rect.hCells) return true;
  let found = false;
  eachCellInRect(clamped, (c, r) => {
    if (set.has(cellKey(c, r))) found = true;
  });
  return found;
}

function addRectCells(set, rect) {
  eachCellInRect(clampCellRect(rect), (c, r) => {
    set.add(cellKey(c, r));
  });
}

function addCellSet(dst, src) {
  if (!src) return;
  for (const k of src) dst.add(k);
}

function markCells(col, row, wCells, hCells) {
  addRectCells(occupiedCells, makeCellRect(col, row, wCells, hCells));
}

function unmarkCells(col, row, wCells, hCells) {
  eachCellInRect(clampCellRect(makeCellRect(col, row, wCells, hCells)), (c, r) => {
    occupiedCells.delete(cellKey(c, r));
  });
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

function pixelRectToCellRect(x, y, width, height, marginCells) {
  const b = getPlayBounds();
  const col = Math.floor((x - b.left) / GRID) - marginCells;
  const row = Math.floor((y - b.top) / GRID) - marginCells;
  const right = Math.ceil((x + width - b.left) / GRID) + marginCells;
  const bottom = Math.ceil((y + height - b.top) / GRID) + marginCells;
  return clampCellRect(makeCellRect(col, row, right - col, bottom - row));
}

function getFixedDecorationRects(theme) {
  const dec = theme.decorations || [];
  const rects = [];
  const add = (name, x, y, w, h, margin = 1) => {
    if (dec.includes(name)) rects.push(pixelRectToCellRect(x, y, w, h, margin));
  };

  // Fixed fixtures are wall/furniture-like background objects. They are not
  // gameplay blockers, but generated obstacles must not visually cover them.
  add("window", 70, 70, 170, 120);
  add("painting", WORLD.width - 260, 80, 150, 90);
  add("lamp", WORLD.width - 150, 70, 70, 120);
  add("mirror", WORLD.width - 250, 70, 120, 150);
  add("towel", 82, 220, 98, 24);
  add("shelves", 70, 60, 180, 90);
  add("fridge", WORLD.width - 180, 90, 90, 170);
  add("clock", WORLD.width - 288, 62, 56, 56);
  add("fireplace", WORLD.width - 260, 90, 170, 150);
  add("rack", 90, 80, 120, 170);

  return rects;
}

function buildFixedDecorationCells(theme) {
  const cells = new Set();
  for (const rect of getFixedDecorationRects(theme)) {
    addRectCells(cells, rect);
  }
  return cells;
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

// ===== АКТОВАЯ ПРОГРЕССИЯ =====
function getNormalLocationThemes() {
  return locationThemes.filter(t => t.key !== "basement");
}

function romanNumeral(n) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [value, glyph] of map) {
    while (n >= value) { out += glyph; n -= value; }
  }
  return out || "I";
}

function adjustHexColor(hex, amount) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function tintPaletteForVariant(palette, variantTier) {
  if (variantTier <= 0) return palette;
  const tier = Math.min(variantTier, 6);
  const floorShift = -10 * tier;
  const wallShift = -6 * tier;
  const trimShift = -14 * tier;
  const accentShift = tier % 2 === 0 ? 8 * tier : -4 * tier;
  return {
    ...palette,
    wall:   adjustHexColor(palette.wall, wallShift),
    floor:  adjustHexColor(palette.floor, floorShift),
    trim:   adjustHexColor(palette.trim, trimShift),
    accent: adjustHexColor(palette.accent, accentShift),
  };
}

function makeActLocationTheme(theme, variantTier) {
  if (variantTier <= 0) return theme;
  const copy = {
    ...theme,
    name: `${theme.name} ${romanNumeral(variantTier + 1)}`,
    palette: tintPaletteForVariant(theme.palette, variantTier),
  };
  return copy;
}

function getLevelProgression(lvl = level) {
  const normalThemes = getNormalLocationThemes();
  const rawLevel = Math.max(1, Math.floor(lvl || 1));
  const actIndex = Math.floor((rawLevel - 1) / ACT.length);
  const actStep = ((rawLevel - 1) % ACT.length) + 1;
  const variantTier = Math.floor(actIndex / normalThemes.length);
  const locationIndex = actIndex % normalThemes.length;
  const effectiveLevel = 1 + Math.min(actIndex, ACT.maxScalingAct) * 1.5 + ACT.stepCurve[actStep - 1];
  const modifier = variantTier > 0
    ? ACT.modifiers[actIndex % ACT.modifiers.length]
    : null;

  return {
    rawLevel,
    actIndex,
    actNumber: actIndex + 1,
    actStep,
    actLength: ACT.length,
    variantTier,
    locationIndex,
    locationTheme: normalThemes[locationIndex],
    effectiveLevel,
    isActPeak: actStep === ACT.length,
    isActBreather: actStep === 1,
    modifier,
  };
}

function getEffectiveLevel(lvl = level) {
  return getLevelProgression(lvl).effectiveLevel;
}

function getUrgeScale(lvl = level) {
  const p = getLevelProgression(lvl);
  let scale = Math.min(1 + (p.effectiveLevel - 1) * 0.08, 1.8);
  if (p.modifier && p.modifier.key === "panic") scale = Math.min(scale * 1.08, 1.9);
  return scale;
}

function getOwnerSpeedScale(lvl = level) {
  const p = getLevelProgression(lvl);
  return p.modifier && p.modifier.key === "hunt" ? 1.08 : 1.0;
}

// ===== ПРОФИЛЬ УРОВНЯ =====
// Определяет параметры генерации в зависимости от уровня:
// - padding: зазор вокруг объекта при проверке свободности (0 = вплотную разрешено)
// - wallBias: вероятность выбора позиции у стены (для zone="wall"/"corner")
// - centerOpen: вероятность отклонить позицию в центре (сохраняет открытое пространство)
// - noiseThreshold: порог noise для принятия позиции (ниже = плотнее кластеры)
function getLevelProfile(lvl) {
  const p = getLevelProgression(lvl);
  const actPressure = Math.min(p.actIndex, ACT.maxScalingAct);
  const profiles = [
    { padding: 1, wallBias: 0.80, centerOpen: 0.66, noiseThreshold: 0.40, movingChance: 0.02, movingSpeedScale: 0.85 },
    { padding: 1, wallBias: 0.68, centerOpen: 0.48, noiseThreshold: 0.32, movingChance: 0.08, movingSpeedScale: 0.95 },
    { padding: 1, wallBias: 0.58, centerOpen: 0.32, noiseThreshold: 0.25, movingChance: 0.18, movingSpeedScale: 1.00 },
    { padding: p.actIndex >= 2 ? 0 : 1, wallBias: 0.50, centerOpen: 0.18, noiseThreshold: 0.20, movingChance: 0.30, movingSpeedScale: 1.10 },
    { padding: 0, wallBias: 0.42, centerOpen: 0.08, noiseThreshold: 0.16, movingChance: 0.46, movingSpeedScale: 1.20 },
  ];
  const profile = { ...profiles[p.actStep - 1] };

  profile.wallBias = clamp(profile.wallBias - actPressure * 0.018, 0.35, 0.82);
  profile.centerOpen = clamp(profile.centerOpen - actPressure * 0.018, 0.04, 0.70);
  profile.noiseThreshold = clamp(profile.noiseThreshold - actPressure * 0.010, 0.11, 0.42);
  profile.movingChance = clamp(profile.movingChance + actPressure * 0.010, 0, 0.58);

  if (p.modifier) {
    if (p.modifier.key === "clutter") {
      profile.centerOpen = clamp(profile.centerOpen - 0.08, 0.03, 0.70);
      profile.noiseThreshold = clamp(profile.noiseThreshold - 0.04, 0.08, 0.42);
    } else if (p.modifier.key === "motion") {
      profile.movingChance = clamp(profile.movingChance + 0.18, 0, 0.72);
      profile.movingSpeedScale += 0.18;
    } else if (p.modifier.key === "open") {
      profile.centerOpen = clamp(profile.centerOpen + 0.20, 0.03, 0.76);
      profile.noiseThreshold = clamp(profile.noiseThreshold + 0.06, 0.08, 0.46);
    }
  }

  return profile;
}

function getObstacleCount(progress) {
  const actPressure = Math.min(progress.actIndex, ACT.maxScalingAct);
  const stepAdd = [0, 1, 2, 3, 4][progress.actStep - 1];
  let count = 4 + Math.floor(actPressure * 0.6) + stepAdd;
  if (progress.isActPeak) count++;
  if (progress.modifier) {
    if (progress.modifier.key === "clutter") count++;
    if (progress.modifier.key === "open") count--;
  }
  return clamp(count, 4, 13);
}

function getDecorCountRange(progress) {
  if (progress.actStep <= 2) return { min: 4, max: 6 };
  if (progress.actStep <= 4) return { min: 5, max: 7 };
  return { min: 6, max: 8 };
}

function getBonusCount(progress) {
  let count = progress.effectiveLevel >= 11 ? 6 :
    progress.effectiveLevel >= 8 ? 5 :
    progress.effectiveLevel >= 5 ? 4 :
    progress.effectiveLevel >= 3 ? 3 : 2;
  if (progress.isActPeak) count = Math.max(count, 4);
  return clamp(count, 2, 6);
}

function getBonusPool(progress) {
  const pool = progress.effectiveLevel >= 8
    ? ["fish","yarn","yarn","pill","pill","pill","catnip","catnip","life","life"]
    : progress.effectiveLevel >= 5
      ? ["fish","fish","yarn","yarn","pill","pill","pill","pill","catnip","life"]
      : progress.effectiveLevel >= 3
        ? ["fish","fish","fish","yarn","yarn","yarn","pill","pill","pill","pill"]
        : ["fish","fish","fish","fish","yarn","yarn","yarn","pill","pill","pill"];

  let filtered = pool.filter(type => {
    if (type === "life" && progress.rawLevel < 5) return false;
    if (type === "catnip" && progress.rawLevel < 7) return false;
    return true;
  });

  // Анти-сноуболл: жизнь чаще при угрозе проигрыша и почти исчезает при запасе.
  if (progress.rawLevel >= 5) {
    if (lives <= 2) filtered = filtered.concat(["life","life","life"]);
    else if (lives >= 4) filtered = filtered.filter(type => type !== "life").concat(["life"]);
  }

  return filtered.length > 0 ? filtered : ["fish","yarn","pill"];
}

function getGuaranteedBonusTypes(progress) {
  if (!progress.isActPeak) return [];
  return ["pill", progress.rawLevel >= 7 ? "catnip" : "yarn"];
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
function obstacleSweepCellRect(col, row, wCells, hCells, moving, axis, range) {
  let sweepCol = col;
  let sweepRow = row;
  let sweepW = wCells;
  let sweepH = hCells;

  if (moving && range > 0) {
    const rangeCells = Math.ceil(range / GRID);
    if (axis === "x") {
      sweepCol -= rangeCells;
      sweepW += rangeCells * 2;
    } else {
      sweepRow -= rangeCells;
      sweepH += rangeCells * 2;
    }
  }

  return clampCellRect(makeCellRect(sweepCol, sweepRow, sweepW, sweepH));
}

function generateObstacle(theme, rng, index, movingAllowed, profile, visualBlockedCells = null) {
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

  let moving = movingAllowed && rng() < (profile.movingChance || 0);
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
  const speed = moving ? randRange(rng, 0.008, 0.02) * (profile.movingSpeedScale || 1) : 0;

  if (visualBlockedCells &&
      setHasRectCells(visualBlockedCells, obstacleSweepCellRect(col, row, wCells, hCells, moving, axis, range))) {
    return null;
  }

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

function _litterBoxCellRect(margin) {
  const lb = pixelToCell(litterBox.x, litterBox.y);
  const wCells = Math.ceil(litterBox.width / GRID);
  const hCells = Math.ceil(litterBox.height / GRID);
  return makeCellRect(lb.col - margin, lb.row - margin, wCells + margin * 2, hCells + margin * 2);
}

function _obstacleVisualCellRect(ob) {
  // Obstacles draw shadows, rounded corners and rocking-chair arcs close to
  // their cell edges. Keep one visual cell of air so decor cannot read as
  // being tucked under furniture.
  return clampCellRect(expandCellRect(
    obstacleSweepCellRect(ob.col, ob.row, ob.wCells, ob.hCells, ob.moving, ob.axis, ob.range),
    1
  ));
}

function _buildDecorReservedCells(options) {
  const reserved = new Set();

  addCellSet(reserved, options && options.fixedDecorationCells);

  for (const ob of obstacles) {
    addRectCells(reserved, _obstacleVisualCellRect(ob));
  }

  addRectCells(reserved, _litterBoxCellRect(1));

  if (options && options.spawnZone) {
    addRectCells(reserved, options.spawnZone);
  }

  return reserved;
}

// ===== ГЕНЕРАЦИЯ ДЕКОРА =====
function generateDecor(theme, rng, count, options = {}) {
  decorItems.length = 0;
  if (!theme.decorTypes || theme.decorTypes.length === 0) return;

  // Отдельный визуальный резерв: декор остаётся без коллизий, но не ложится
  // под препятствия, лоток, спавн и swept-зону движущихся объектов.
  const decorCells = _buildDecorReservedCells(options);

  let placed = 0;
  let attempts = 0;
  const maxAttempts = Math.max(240, count * 120);

  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const type = theme.decorTypes[randInt(rng, 0, theme.decorTypes.length - 1)];
    const meta = decorCatalog[type];
    const wCells = randInt(rng, meta.wCells[0], meta.wCells[1]);
    const hCells = randInt(rng, meta.hCells[0], meta.hCells[1]);
    const col = randInt(rng, 0, GRID_COLS - wCells);
    const row = randInt(rng, 0, GRID_ROWS - hCells);
    const decorRect = makeCellRect(col, row, wCells, hCells);

    if (setHasRectCells(decorCells, decorRect)) continue;
    addRectCells(decorCells, decorRect);

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

function _currentLitterCellRect() {
  const lb = pixelToCell(litterBox.x, litterBox.y);
  return makeCellRect(
    lb.col,
    lb.row,
    Math.ceil(litterBox.width / GRID),
    Math.ceil(litterBox.height / GRID)
  );
}

function _forEachLitterEntryCell(litterRect, fn) {
  const seen = new Set();
  const tryCell = (c, r) => {
    if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) return;
    const key = cellKey(c, r);
    if (seen.has(key)) return;
    seen.add(key);
    fn(c, r);
  };

  for (let r = litterRect.row; r < litterRect.row + litterRect.hCells; r++) {
    tryCell(litterRect.col - 1, r);
    tryCell(litterRect.col + litterRect.wCells, r);
  }
  for (let c = litterRect.col; c < litterRect.col + litterRect.wCells; c++) {
    tryCell(c, litterRect.row - 1);
    tryCell(c, litterRect.row + litterRect.hCells);
  }
}

function _canEntityOccupyCell(col, row, entityW, entityH) {
  if (!isCellFree(col, row)) return false;
  if (entityW && entityH) {
    const center = cellToPixelCenter(col, row);
    const rect = {
      x: center.x - entityW / 2,
      y: center.y - entityH / 2,
      width: entityW,
      height: entityH,
    };
    if (hitsObstacles(rect)) return false;
  }
  return true;
}

function _findPathToLitterEntry(spawnCol, spawnRow, entityW, entityH, litterRect) {
  const lb = litterRect || _currentLitterCellRect();
  let bestPath = null;

  _forEachLitterEntryCell(lb, (entryCol, entryRow) => {
    if (!_canEntityOccupyCell(entryCol, entryRow, entityW, entityH)) return;
    const path = aStarPath(spawnCol, spawnRow, entryCol, entryRow, entityW, entityH, 2000);
    if (path && (!bestPath || path.length < bestPath.length)) bestPath = path;
  });

  return bestPath;
}

// ===== LEVEL QUALITY REPORT =====
// These helpers run only while a level is generated. Runtime A* remains the
// small hot-path implementation in pathfinding.js.
function _gridIndex(col, row) {
  return row * GRID_COLS + col;
}

function _movingSweepBlockedCells() {
  const blocked = new Set();
  for (const ob of obstacles) {
    if (!ob.moving || ob.range <= 0) continue;
    addRectCells(blocked, obstacleSweepCellRect(
      ob.col, ob.row, ob.wCells, ob.hCells, ob.moving, ob.axis, ob.range
    ));
  }
  return blocked;
}

function _buildReachability(spawnCol, spawnRow, extraBlocked = null) {
  const size = GRID_COLS * GRID_ROWS;
  const distance = new Int16Array(size);
  const parent = new Int16Array(size);
  distance.fill(-1);
  parent.fill(-1);

  const start = _gridIndex(spawnCol, spawnRow);
  if (!isCellFree(spawnCol, spawnRow) || (extraBlocked && extraBlocked.has(cellKey(spawnCol, spawnRow)))) {
    return { distance, parent, start, reachableCount: 0 };
  }

  const queue = new Int16Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  distance[start] = 0;
  const dc = [1, -1, 0, 0];
  const dr = [0, 0, 1, -1];

  while (head < tail) {
    const index = queue[head++];
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    for (let i = 0; i < 4; i++) {
      const nc = col + dc[i];
      const nr = row + dr[i];
      if (nc < 0 || nr < 0 || nc >= GRID_COLS || nr >= GRID_ROWS) continue;
      const next = _gridIndex(nc, nr);
      if (distance[next] !== -1 || !isCellFree(nc, nr)) continue;
      if (extraBlocked && extraBlocked.has(cellKey(nc, nr))) continue;
      distance[next] = distance[index] + 1;
      parent[next] = index;
      queue[tail++] = next;
    }
  }

  return { distance, parent, start, reachableCount: tail };
}

function _pathToReachableLitterEntry(reachability) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  _forEachLitterEntryCell(_currentLitterCellRect(), (col, row) => {
    const index = _gridIndex(col, row);
    const distance = reachability.distance[index];
    if (distance >= 0 && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  if (bestIndex < 0) return null;

  const path = [];
  let index = bestIndex;
  while (index >= 0) {
    path.push({ col: index % GRID_COLS, row: Math.floor(index / GRID_COLS) });
    if (index === reachability.start) break;
    index = reachability.parent[index];
  }
  if (path[path.length - 1].col !== reachability.start % GRID_COLS ||
      path[path.length - 1].row !== Math.floor(reachability.start / GRID_COLS)) return null;
  path.reverse();
  return path;
}

function _freeExitCount(col, row, extraBlocked = null) {
  let exits = 0;
  const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dc, dr] of neighbors) {
    const nc = col + dc;
    const nr = row + dr;
    if (!isCellFree(nc, nr)) continue;
    if (extraBlocked && extraBlocked.has(cellKey(nc, nr))) continue;
    exits++;
  }
  return exits;
}

function _criticalPathWidth(path, extraBlocked) {
  if (!path || path.length < 5) return 1;
  let minimum = 5;
  for (let i = 2; i < path.length - 2; i++) {
    const prev = path[i - 1];
    const next = path[i + 1];
    const horizontal = prev.col !== next.col;
    const dc = horizontal ? 0 : 1;
    const dr = horizontal ? 1 : 0;
    let width = 1;
    for (const direction of [-1, 1]) {
      for (let step = 1; step <= 2; step++) {
        const col = path[i].col + dc * step * direction;
        const row = path[i].row + dr * step * direction;
        if (!isCellFree(col, row) || (extraBlocked && extraBlocked.has(cellKey(col, row)))) break;
        width++;
      }
    }
    minimum = Math.min(minimum, width);
  }
  return minimum;
}

function _componentTopology(reachability, extraBlocked) {
  let branches = 0;
  let deadEnds = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (reachability.distance[_gridIndex(col, row)] < 0) continue;
      const exits = _freeExitCount(col, row, extraBlocked);
      if (exits >= 3) branches++;
      else if (exits <= 1) deadEnds++;
    }
  }
  return { branches, deadEnds };
}

function _estimateOwnerIntercept(path) {
  const diff = DIFF[difficulty];
  if (!path || level < diff.firstLvl) {
    return { ownerSeconds: null, playerSeconds: null, leadSeconds: null };
  }

  const spawn = path[0];
  const corners = [
    { col: 0, row: 0 }, { col: GRID_COLS - 1, row: 0 },
    { col: 0, row: GRID_ROWS - 1 }, { col: GRID_COLS - 1, row: GRID_ROWS - 1 },
  ].sort((a, b) => {
    const ad = (a.col - spawn.col) ** 2 + (a.row - spawn.row) ** 2;
    const bd = (b.col - spawn.col) ** 2 + (b.row - spawn.row) ** 2;
    return bd - ad;
  });

  let ownerStart = null;
  for (const corner of corners) {
    for (let radius = 0; radius <= 6 && !ownerStart; radius++) {
      for (let dr = -radius; dr <= radius && !ownerStart; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
          const col = corner.col + dc;
          const row = corner.row + dr;
          if (_canEntityOccupyCell(col, row, owner.width, owner.height)) {
            ownerStart = { col, row };
            break;
          }
        }
      }
    }
    if (ownerStart) break;
  }
  if (!ownerStart) return { ownerSeconds: 0, playerSeconds: 0, leadSeconds: -Infinity };

  const interceptIndex = Math.min(
    path.length - 1,
    Math.max(0, Math.floor((path.length - 1) * 0.55))
  );
  const intercept = path[interceptIndex];
  const ownerPath = aStarPath(
    ownerStart.col, ownerStart.row, intercept.col, intercept.row,
    owner.width, owner.height, 2000
  );
  if (!ownerPath) return { ownerSeconds: Infinity, playerSeconds: null, leadSeconds: Infinity };

  const ownerSpeed = Math.min(
    (diff.baseSpd + (getEffectiveLevel(level) - 1) * diff.spdPerLvl) * getOwnerSpeedScale(level),
    diff.maxSpd
  );
  const ownerSeconds = Math.max(0, ownerPath.length - 1) * GRID / ownerSpeed / 60;
  const playerSeconds = interceptIndex * GRID / player.speed / 60;
  return { ownerSeconds, playerSeconds, leadSeconds: ownerSeconds - playerSeconds };
}

function buildLevelQualityReport(spawnCol, spawnRow, progression = currentLevelProgression) {
  const sweptCells = _movingSweepBlockedCells();
  const baseReachability = _buildReachability(spawnCol, spawnRow);
  const safeReachability = _buildReachability(spawnCol, spawnRow, sweptCells);
  const basePath = _pathToReachableLitterEntry(baseReachability);
  const safePath = _pathToReachableLitterEntry(safeReachability);
  const path = safePath || basePath;
  const reasons = [];
  const stepIndex = progression.actStep - 1;
  const pathSteps = path ? Math.max(0, path.length - 1) : Infinity;
  const directSteps = path
    ? Math.max(1, Math.abs(path[0].col - path[path.length - 1].col) + Math.abs(path[0].row - path[path.length - 1].row))
    : 0;
  const pathDirectRatio = path ? pathSteps / directSteps : Infinity;
  const diff = DIFF[difficulty];
  const travelSeconds = path ? pathSteps * GRID / player.speed / 60 : Infinity;
  const requiredSeconds = travelSeconds + diff.poopTime / 60;
  const accidentSeconds = player.maxUrge / (diff.urgeRate * getUrgeScale(level));
  const travelBudgetRatio = requiredSeconds / accidentSeconds;
  const spawnExits = _freeExitCount(spawnCol, spawnRow, sweptCells);
  const litterEnd = path ? path[path.length - 1] : null;
  const litterEntryExits = litterEnd ? _freeExitCount(litterEnd.col, litterEnd.row, sweptCells) : 0;
  const topology = _componentTopology(safeReachability, sweptCells);
  const intercept = _estimateOwnerIntercept(path);

  if (!basePath) reasons.push("no_path");
  if (!safePath) reasons.push("moving_sweep_blocks_route");
  const conservativePathSteps = currentLocation.key === "country" &&
    typeof locationRuleState !== "undefined"
      ? Math.max(pathSteps, locationRuleState.countryConservativePathSteps || 0)
      : pathSteps;
  if (conservativePathSteps < LEVEL_QUALITY.minPathLengthByStep[stepIndex]) reasons.push("path_too_short");
  if (travelBudgetRatio > LEVEL_QUALITY.maxTravelBudgetRatioByStep[stepIndex]) reasons.push("travel_budget");
  if (spawnExits < LEVEL_QUALITY.minSpawnExitsByStep[stepIndex]) reasons.push("spawn_safety");
  if (litterEntryExits < LEVEL_QUALITY.minLitterEntryExitsByStep[stepIndex]) reasons.push("litter_safety");
  if (intercept.leadSeconds !== null &&
      intercept.leadSeconds < -LEVEL_QUALITY.maxOwnerInterceptAdvantageByStep[stepIndex]) {
    reasons.push("owner_intercept");
  }

  let reachableBonusCount = 0;
  for (const bonus of bonuses) {
    const cell = pixelToCell(bonus.x, bonus.y);
    if (safeReachability.distance[_gridIndex(cell.col, cell.row)] >= 0) reachableBonusCount++;
  }
  const unreachableBonusCount = bonuses.length - reachableBonusCount;
  if (unreachableBonusCount > 0) reasons.push("unreachable_bonus");

  const valid = reasons.length === 0;
  const qualityScore = (valid ? 1000 : 0)
    + Math.min(safeReachability.reachableCount, 450)
    + Math.min(topology.branches, 80) * 2
    + Math.max(0, 100 - travelBudgetRatio * 100)
    + Math.min(_criticalPathWidth(path, sweptCells), 5) * 12
    - reasons.length * 180;

  return {
    valid,
    qualityScore,
    reasons,
    runSeed: globalSeed,
    levelSeed,
    variant: currentLevelVariant,
    location: currentLocation.key,
    basementMode,
    pathLengthCells: Number.isFinite(pathSteps) ? pathSteps : null,
    directDistanceCells: directSteps || null,
    pathDirectRatio: Number.isFinite(pathDirectRatio) ? pathDirectRatio : null,
    reachableCells: safeReachability.reachableCount,
    branchCells: topology.branches,
    deadEndCells: topology.deadEnds,
    criticalPassageWidthCells: _criticalPathWidth(path, sweptCells),
    spawnExits,
    litterEntryExits,
    movingSweepCellCount: sweptCells.size,
    travelSeconds: Number.isFinite(travelSeconds) ? travelSeconds : null,
    requiredSeconds: Number.isFinite(requiredSeconds) ? requiredSeconds : null,
    accidentSeconds,
    travelBudgetRatio: Number.isFinite(travelBudgetRatio) ? travelBudgetRatio : null,
    ownerInterceptSeconds: intercept.ownerSeconds,
    playerToInterceptSeconds: intercept.playerSeconds,
    interceptLeadSeconds: intercept.leadSeconds,
    bonusCount: bonuses.length,
    reachableBonusCount,
    unreachableBonusCount,
    path,
  };
}

function _candidateHasReachableLitterEntry(
  c, r, lbW, lbH, spawnCol, spawnRow, entityW, entityH, minPathSteps = 0
) {
  markCells(c, r, lbW, lbH);
  const path = _findPathToLitterEntry(
    spawnCol,
    spawnRow,
    entityW,
    entityH,
    makeCellRect(c, r, lbW, lbH)
  );
  unmarkCells(c, r, lbW, lbH);
  return !!path && path.length - 1 >= minPathSteps;
}

function _litterBoxAllowedAt(c, lbW) {
  if (basementMode === "corridor") {
    return c >= 2 && c + lbW <= GRID_COLS - 2;
  }
  return true;
}

function _relocateLitterBoxToReachableEntry(rng, spawnCol, spawnRow) {
  const oldRect = _currentLitterCellRect();
  const lbW = oldRect.wCells || 2;
  const lbH = oldRect.hCells || 2;
  const minDist = Math.min(3 + Math.floor((getEffectiveLevel(level) - 1) * 0.5), 8);
  const minPathSteps = LEVEL_QUALITY.minPathLengthByStep[currentLevelProgression.actStep - 1];

  unmarkCells(oldRect.col, oldRect.row, oldRect.wCells, oldRect.hCells);

  const candidates = [];
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      const dist = Math.abs(c - spawnCol) + Math.abs(r - spawnRow);
      candidates.push({ c, r, preferred: dist >= minDist });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const hudCols = 8, hudRows = 6;
  for (const preferredOnly of [true, false]) {
    for (const { c, r, preferred } of candidates) {
      if (preferredOnly && !preferred) continue;
      if (c < hudCols && r < hudRows) continue;
      if (!_litterBoxAllowedAt(c, lbW)) continue;
      if (!cellsFree(c, r, lbW, lbH)) continue;
      if (!_candidateHasReachableLitterEntry(
        c, r, lbW, lbH, spawnCol, spawnRow, player.size, player.size, minPathSteps
      )) continue;
      _placeLitterBoxAt(c, r, lbW, lbH);
      return true;
    }
  }

  if (cellsFree(oldRect.col, oldRect.row, oldRect.wCells, oldRect.hCells)) {
    _placeLitterBoxAt(oldRect.col, oldRect.row, oldRect.wCells, oldRect.hCells);
  }
  return false;
}

// ===== РАЗМЕЩЕНИЕ ЛОТКА =====
function placeLitterBox(rng, spawnCol, spawnRow) {
  // Лоток занимает 2×2 ячейки (80×80px при GRID=40)
  const lbW = 2, lbH = 2;
  const minDist = Math.min(3 + Math.floor((getEffectiveLevel(level) - 1) * 0.5), 8); // минимум ячеек от спавна
  const minPathSteps = LEVEL_QUALITY.minPathLengthByStep[currentLevelProgression.actStep - 1];

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
    if (!_litterBoxAllowedAt(c, lbW)) continue;
    // Проверяем лоток + 2 ячейки отступа со всех сторон (чтобы не касался препятствий)
    const pad = 2;
    const mc = Math.max(0, c - pad);
    const mr = Math.max(0, r - pad);
    const rightPad = Math.min(pad, GRID_COLS - (c + lbW));
    const bottomPad = Math.min(pad, GRID_ROWS - (r + lbH));
    const mw = (c - mc) + lbW + rightPad;
    const mh = (r - mr) + lbH + bottomPad;
    if (!cellsFree(mc, mr, mw, mh)) continue;
    if (!_candidateHasReachableLitterEntry(
      c, r, lbW, lbH, spawnCol, spawnRow, player.size, player.size, minPathSteps
    )) continue;
    _placeLitterBoxAt(c, r, lbW, lbH);
    return;
  }

  // Fallback — ищем любую свободную позицию без ограничения дистанции, но с отступом
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      if (c < hudCols && r < hudRows) continue;
      if (!_litterBoxAllowedAt(c, lbW)) continue;
      const pad = 1; // в крайнем случае хватит 1 ячейки
      const mc = Math.max(0, c - pad);
      const mr = Math.max(0, r - pad);
      const rightPad = Math.min(pad, GRID_COLS - (c + lbW));
      const bottomPad = Math.min(pad, GRID_ROWS - (r + lbH));
      const mw = (c - mc) + lbW + rightPad;
      const mh = (r - mr) + lbH + bottomPad;
      if (!cellsFree(mc, mr, mw, mh)) continue;
      if (!_candidateHasReachableLitterEntry(
        c, r, lbW, lbH, spawnCol, spawnRow, player.size, player.size, minPathSteps
      )) continue;
      _placeLitterBoxAt(c, r, lbW, lbH);
      return;
    }
  }
  // Абсолютный fallback — ищем первую свободную позицию без ограничений по дистанции
  // и без отступа. Проверяем occupiedCells, чтобы не попасть в DFS-полосы или стены.
  for (let r = 0; r < GRID_ROWS - lbH + 1; r++) {
    for (let c = 0; c < GRID_COLS - lbW + 1; c++) {
      if (!_litterBoxAllowedAt(c, lbW)) continue;
      if (!cellsFree(c, r, lbW, lbH)) continue;
      if (!_candidateHasReachableLitterEntry(
        c, r, lbW, lbH, spawnCol, spawnRow, player.size, player.size, minPathSteps
      )) continue;
      _placeLitterBoxAt(c, r, lbW, lbH);
      return;
    }
  }
  // Последний резерв — фиксированная позиция (на практике не должна достигаться)
  const fallbackCol = basementMode === "corridor" ? 2 : Math.max(0, GRID_COLS - lbW - 2);
  _placeLitterBoxAt(fallbackCol, Math.max(0, GRID_ROWS - lbH - 2), lbW, lbH);
}

// ===== ПОДВАЛ: CORRIDOR MAZE =====
// Размещает горизонтальные и вертикальные стены с проходами.
// Стены — объекты типа wall_h / wall_v в массиве obstacles.
// Гарантирует проходимость: каждая стена имеет проходы шириной минимум 2 ячейки.
function generateCorridorMaze(rng) {
  const hWallRows = [3, 6, 9, 12];
  const vWallCols = [7, 14, 21];

  // Вспомогательная функция: добавить wall-сегмент в obstacles
  function addWall(col, row, wCells, hCells) {
    _makeWallObstacle(col, row, wCells, hCells);
  }

  function sealBoundedOneCellRuns(length, isFree, sealCell) {
    let changed = false;
    let i = 0;
    while (i < length) {
      while (i < length && !isFree(i)) i++;
      const start = i;
      while (i < length && isFree(i)) i++;
      const end = i;
      const run = end - start;
      const boundedBefore = start > 0 && !isFree(start - 1);
      const boundedAfter = end < length && !isFree(end);
      if (run === 1 && boundedBefore && boundedAfter) {
        sealCell(start);
        changed = true;
      }
    }
    return changed;
  }

  function sealNarrowGaps() {
    let changed = true;
    let guard = 0;
    while (changed && guard < 4) {
      changed = false;
      guard++;
      for (const row of hWallRows) {
        changed = sealBoundedOneCellRuns(
          GRID_COLS,
          c => isCellFree(c, row),
          c => addWall(c, row, 1, 1)
        ) || changed;
      }
      for (const col of vWallCols) {
        changed = sealBoundedOneCellRuns(
          GRID_ROWS,
          r => isCellFree(col, r),
          r => addWall(col, r, 1, 1)
        ) || changed;
      }
    }
  }

  // Горизонтальные стены на строках 3, 6, 9, 12
  // Каждая стена — полная ширина с 2 проходами по 2 ячейки
  for (const row of hWallRows) {
    // Генерируем 2 прохода: случайные позиции, не перекрывающиеся.
    // Горизонтальные стены не трогают две крайние колонки с каждой стороны,
    // чтобы боковые полосы не превращались в тесные одноклеточные щели.
    const gapWidth = 2;
    const wallStart = 2;
    const wallEnd = GRID_COLS - 2;
    const totalCols = wallEnd - wallStart; // 26
    // Делим на 3 зоны, в каждой зоне один проход
    const zoneW = Math.floor(totalCols / 3); // 9
    const gaps = [];
    for (let z = 0; z < 3; z++) {
      // Берём 2 из 3 зон для проходов (случайно пропускаем одну)
      if (z === Math.floor(rng() * 3)) continue;
      const zoneStart = wallStart + z * zoneW;
      const gapCol = zoneStart + randInt(rng, 0, zoneW - gapWidth - 1);
      gaps.push(gapCol);
    }
    // Строим стену: сегменты между проходами
    let col = wallStart;
    // Сортируем проходы
    gaps.sort((a, b) => a - b);
    for (const gapCol of gaps) {
      if (col < gapCol) {
        addWall(col, row, gapCol - col, 1);
      }
      col = gapCol + gapWidth;
    }
    if (col < wallEnd) {
      addWall(col, row, wallEnd - col, 1);
    }
  }

  // Вертикальные стены в колонках 7, 14, 21
  // Начинаем с row=0 — чтобы верхняя полоса не была открытым карманом.
  // Хозяин 36×36px перекрывает row=0 и row=1 одновременно (y=10..46 при row=0).
  // Если вертикальная стена начинается с row=1, хозяин застревает в row=0
  // между стеной и верхней границей игровой зоны.
  for (const col of vWallCols) {
    // Первый сегмент всегда от row=0 — закрываем верхний карман
    let row = 0;
    while (row < GRID_ROWS - 2) {
      const segH = randInt(rng, 2, 3);
      if (row + segH > GRID_ROWS - 1) break;
      addWall(col, row, 1, segH);
      row += segH + randInt(rng, 2, 3); // проход 2–3 ячейки
    }
  }

  // Пересечения горизонтальных и вертикальных стен иногда дробят широкий проход
  // в одиночную клетку. В подвале такие щели выглядят как проход, но играются плохо.
  sealNarrowGaps();
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
// После генерации лабиринта + размещения лотка проверяем, что кот физически
// может дойти до свободной клетки у входа в лоток.
function _ensureBasementReachable(spawnCol, spawnRow, rng) {
  // Собираем декоративные препятствия (не стены лабиринта)
  const decorObs = obstacles.filter(o => o.type !== 'wall_h' && o.type !== 'wall_v');

  // Проверяем проходимость; если заблокировано — удаляем декор по одному.
  // Используем увеличенный лимит итераций (2000) — вызывается только при генерации уровня,
  // не в рантайме, поэтому производительность не критична.
  for (let attempt = 0; attempt <= decorObs.length; attempt++) {
    const path = _findPathToLitterEntry(spawnCol, spawnRow, player.size, player.size);
    if (path) return; // путь найден — готово

    if (decorObs.length === 0) break; // нечего удалять
    // Удаляем последний декоративный объект
    const toRemove = decorObs.pop();
    const idx = obstacles.indexOf(toRemove);
    if (idx !== -1) obstacles.splice(idx, 1);
    unmarkCells(toRemove.col, toRemove.row, toRemove.wCells, toRemove.hCells);
  }

  _relocateLitterBoxToReachableEntry(rng, spawnCol, spawnRow);
}

function _ensureLevelReachable(spawnCol, spawnRow) {
  for (let attempt = 0; attempt <= obstacles.length; attempt++) {
    const path = _findPathToLitterEntry(spawnCol, spawnRow, player.size, player.size);
    if (path) break;

    const toRemove = obstacles.pop();
    if (!toRemove) break;
    unmarkCells(toRemove.col, toRemove.row, toRemove.wCells, toRemove.hCells);
  }
}

// ===== ВМУРОВАННЫЕ ПРЕДМЕТЫ В СТЕНАХ ПОДВАЛА =====
// Выбирает случайные ячейки внутри wall_h/wall_v и добавляет декоративные предметы
// в decorItems (без коллизий). Работает для обоих режимов: corridor и dfs.
// Количество предметов задаётся через BASEMENT.wallEmbedCount.
function _placeWallEmbeds(rng) {
  // Собираем все ячейки, занятые стенами лабиринта (wall_h / wall_v)
  const wallCells = [];
  for (const ob of obstacles) {
    if (ob.type !== 'wall_h' && ob.type !== 'wall_v') continue;
    for (let r = ob.row; r < ob.row + ob.hCells; r++) {
      for (let c = ob.col; c < ob.col + ob.wCells; c++) {
        wallCells.push({ c, r });
      }
    }
  }
  if (wallCells.length === 0) return;

  // Перемешиваем Fisher-Yates через детерминированный rng
  for (let i = wallCells.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [wallCells[i], wallCells[j]] = [wallCells[j], wallCells[i]];
  }

  const types = currentLocation.obstacleTypes; // 6 вмурованных типов
  const count = randInt(rng, BASEMENT.wallEmbedCount.min, BASEMENT.wallEmbedCount.max);
  const limit = Math.min(count, wallCells.length);
  for (let i = 0; i < limit; i++) {
    const { c, r } = wallCells[i];
    const type = types[randInt(rng, 0, types.length - 1)];
    const pos = cellToPixel(c, r);
    decorItems.push({
      type, col: c, row: r, wCells: 1, hCells: 1,
      x: pos.x, y: pos.y, width: GRID, height: GRID,
      drawStyle: type,
      wallEmbed: true,
    });
  }
}

// ===== ГЕНЕРАЦИЯ УРОВНЯ =====
function _generateLevelCandidate(rng, progression) {
  obstacles.length = 0;
  bonuses.length = 0;
  catnipTimer = 0;  // сброс котовника при старте нового уровня
  occupiedCells.clear();
  const fixedDecorationCells = buildFixedDecorationCells(currentLocation);

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
    const obstCount = getObstacleCount(progression);
    const movingAllowed = level >= 5;
    const profile = getLevelProfile(level);
    let att = 0;
    while (obstacles.length < obstCount && att < obstCount * 80) {
      att++;
      const ob = generateObstacle(currentLocation, rng, obstacles.length, movingAllowed, profile, fixedDecorationCells);
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

  // Гарантия проходимости подвала: путь должен вести к свободной входной
  // клетке у лотка, а не к занятой клетке в его центре.
  if (currentLocation.key === "basement") {
    _ensureBasementReachable(spawnCol, spawnRow, rng);
  } else {
    _ensureLevelReachable(spawnCol, spawnRow);
  }

  // Позиция игрока
  player.x = spawn.x;
  player.y = spawn.y;
  levelMessageTimer = 180;

  // Декор следует шагу акта: на выдохе меньше шума, на пике богаче сцена.
  const decorRange = getDecorCountRange(progression);
  const decorMin = decorRange.min;
  const decorMax = decorRange.max;
  const decorCount = randInt(rng, decorMin, decorMax);
  generateDecor(currentLocation, rng, decorCount, {
    fixedDecorationCells,
    spawnZone: makeCellRect(blockCol, blockRow, 3, 3),
  });

  // Вмурованные предметы в стенах подвала — добавляются ПОСЛЕ generateDecor(),
  // т.к. generateDecor() сбрасывает decorItems.length = 0 в начале.
  // Работает для обоих режимов: corridor и dfs.
  if (currentLocation.key === "basement") {
    _placeWallEmbeds(rng);
  }

  return { spawnCol, spawnRow };
}

function _selectLevelLocation(progression) {
  const rng = createRng(mixSeed(globalSeed, level, 0x4c4f4341));
  const anomalyRoll = rng();
  basementMode = "";
  if (cheatLocationKey) {
    const forced = locationThemes.find(t => t.key === cheatLocationKey && t.key !== "basement");
    currentLocation = makeActLocationTheme(forced || progression.locationTheme, progression.variantTier);
  } else if (cheatDfs) {
    currentLocation = locationThemes.find(t => t.key === "basement");
    basementMode = "dfs";
  } else if (cheatBasement) {
    currentLocation = locationThemes.find(t => t.key === "basement");
    basementMode = "corridor";
  } else if (level >= BASEMENT.dfsMinLevel) {
    // Один взаимоисключающий бросок: 10% DFS + 8% corridor, а не два
    // последовательных шанса, которые раньше давали почти 50% Подвала.
    if (anomalyRoll < BASEMENT.dfsProb) {
      currentLocation = locationThemes.find(t => t.key === "basement");
      basementMode = "dfs";
    } else if (anomalyRoll < BASEMENT.dfsProb + BASEMENT.corridorProb) {
      currentLocation = locationThemes.find(t => t.key === "basement");
      basementMode = "corridor";
    } else {
      currentLocation = makeActLocationTheme(progression.locationTheme, progression.variantTier);
    }
  } else if (level >= BASEMENT.corridorMinLevel && anomalyRoll < BASEMENT.corridorProb) {
    currentLocation = locationThemes.find(t => t.key === "basement");
    basementMode = "corridor";
  } else {
    currentLocation = makeActLocationTheme(progression.locationTheme, progression.variantTier);
  }
  cheatDfs = false;
  cheatBasement = false;
  cheatLocationKey = "";
}

function _snapshotLevelCandidate(spawnCol, spawnRow, report) {
  return {
    obstacles: obstacles.map(ob => ({ ...ob })),
    decorItems: decorItems.map(item => ({ ...item })),
    occupiedCells: new Set(occupiedCells),
    litterBox: { ...litterBox },
    playerX: player.x,
    playerY: player.y,
    spawnCol,
    spawnRow,
    levelSeed,
    variant: currentLevelVariant,
    report,
  };
}

function _restoreLevelCandidate(candidate) {
  obstacles.length = 0;
  obstacles.push(...candidate.obstacles);
  decorItems.length = 0;
  decorItems.push(...candidate.decorItems);
  occupiedCells.clear();
  for (const key of candidate.occupiedCells) occupiedCells.add(key);
  Object.assign(litterBox, candidate.litterBox);
  player.x = candidate.playerX;
  player.y = candidate.playerY;
  levelSeed = candidate.levelSeed;
  currentLevelVariant = candidate.variant;
}

function _collectBonusCandidates(spawnCol, spawnRow, path, rng) {
  const sweptCells = _movingSweepBlockedCells();
  const reachability = _buildReachability(spawnCol, spawnRow, sweptCells);
  const pathCells = new Set((path || []).map(cell => cellKey(cell.col, cell.row)));
  const candidates = [];

  for (let row = 1; row < GRID_ROWS - 1; row++) {
    for (let col = 1; col < GRID_COLS - 1; col++) {
      const index = _gridIndex(col, row);
      if (reachability.distance[index] < 0 || pathCells.has(cellKey(col, row))) continue;
      if (typeof locationRuleCellReserved === "function" && locationRuleCellReserved(col, row)) continue;
      let detour = 8;
      for (const cell of path || []) {
        detour = Math.min(detour, Math.abs(cell.col - col) + Math.abs(cell.row - row));
      }
      candidates.push({
        col,
        row,
        distance: reachability.distance[index],
        detour,
        tieBreak: rng(),
      });
    }
  }

  // Prefer visible, meaningful side trips rather than cells on the mandatory
  // shortest route. tieBreak keeps equal-quality choices seed-deterministic.
  candidates.sort((a, b) => {
    const scoreA = (a.detour >= 2 ? 100 : 0) + Math.min(a.detour, 6) * 10 + Math.min(a.distance, 30);
    const scoreB = (b.detour >= 2 ? 100 : 0) + Math.min(b.detour, 6) * 10 + Math.min(b.distance, 30);
    return scoreB - scoreA || a.tieBreak - b.tieBreak;
  });
  return candidates;
}

function _spawnReachableBonuses(progression, spawnCol, spawnRow, rng, path) {
  bonuses.length = 0;
  const bonusCount = getBonusCount(progression);
  const bonusPool = getBonusPool(progression);
  const candidates = _collectBonusCandidates(spawnCol, spawnRow, path, rng);
  let lifeSpawned = 0;

  function normalizedType(type) {
    if (type === "life") {
      if (lifeSpawned >= 1 || progression.rawLevel < 5) return "pill";
      lifeSpawned++;
    }
    if (type === "catnip" && progression.rawLevel < 7) return "yarn";
    return type;
  }

  function spawn(type) {
    const candidate = candidates.shift();
    if (!candidate) return false;
    const center = cellToPixelCenter(candidate.col, candidate.row);
    bonuses.push({
      x: center.x,
      y: center.y,
      type: normalizedType(type),
      alive: true,
      pulse: rng() * Math.PI * 2,
    });
    return true;
  }

  for (const type of getGuaranteedBonusTypes(progression)) {
    if (bonuses.length >= bonusCount || !spawn(type)) break;
  }
  while (bonuses.length < bonusCount && candidates.length > 0) {
    spawn(bonusPool[randInt(rng, 0, bonusPool.length - 1)]);
  }
}

function generateLevel() {
  const progression = getLevelProgression(level);
  currentLevelProgression = progression;
  _selectLevelLocation(progression);

  const attempts = currentLocation.key === "basement"
    ? LEVEL_QUALITY.basementCandidateAttempts
    : LEVEL_QUALITY.candidateAttempts;
  let bestCandidate = null;

  for (let variant = 0; variant < attempts; variant++) {
    currentLevelVariant = variant;
    levelSeed = mixSeed(globalSeed, level, variant, 0x4c564c31);
    const candidateRng = createRng(levelSeed);
    const spawn = _generateLevelCandidate(candidateRng, progression);
    const report = buildLevelQualityReport(spawn.spawnCol, spawn.spawnRow, progression);
    const candidate = _snapshotLevelCandidate(spawn.spawnCol, spawn.spawnRow, report);

    if (!bestCandidate ||
        (report.valid && !bestCandidate.report.valid) ||
        (report.valid === bestCandidate.report.valid && report.qualityScore > bestCandidate.report.qualityScore)) {
      bestCandidate = candidate;
    }
  }

  _restoreLevelCandidate(bestCandidate);
  // Правило размечается только на выбранном кандидате: не добавляет работу в
  // candidate loop и не влияет на детерминированность геометрии.
  if (typeof initLocationRule === "function") initLocationRule(progression);
  if (currentLocation.key === "country" && typeof locationRuleState !== "undefined") {
    locationRuleState.countryConservativePathSteps = bestCandidate.report.pathLengthCells || 0;
  }
  const bonusRng = createRng(mixSeed(levelSeed, 0x424f4e55));
  _spawnReachableBonuses(
    progression,
    bestCandidate.spawnCol,
    bestCandidate.spawnRow,
    bonusRng,
    bestCandidate.report.path
  );
  currentLevelQualityReport = buildLevelQualityReport(
    bestCandidate.spawnCol,
    bestCandidate.spawnRow,
    progression
  );
  aiRng = createRng(mixSeed(globalSeed, level, currentLevelVariant, 0x4149524e));

  // OPT 4: rebuild the offscreen layer once, after candidate selection.
  if (typeof rebuildBgLayer === "function") rebuildBgLayer();
}

// ===== ОБНОВЛЕНИЕ ПРЕПЯТСТВИЙ =====
function updateObstacles() {
  for (const ob of obstacles) {
    if (!ob.moving) continue;
    ob.movingOffset = Math.sin(ob.phase + simulationTimeMs * ob.speed) * ob.range;
    if (ob.axis === "x") ob.x = ob.baseX + ob.movingOffset;
    else                  ob.y = ob.baseY + ob.movingOffset;
  }
}
