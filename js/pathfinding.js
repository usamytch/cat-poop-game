// ==========================================
// PATHFINDING — MinHeap + A* algorithm
// ==========================================

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
// maxIter — лимит итераций (по умолчанию 600 для рантайма; передавай 2000 при генерации уровня).
function aStarPath(startCol, startRow, goalCol, goalRow, entityW, entityH, maxIter = 600) {
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
  while (!heap.isEmpty() && iterations < maxIter) {
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
