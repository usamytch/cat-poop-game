# 🐛 Corner-Freeze Fix Plan — Owner Navigation

## Проблема

Хозяин застывает на углах стен в лабиринте (corridor и dfs режимы подвала), дёргаясь туда-сюда и не двигаясь к коту. Видно на скриншоте: хозяин прижат к углу стены справа и не может выйти.

---

## Root Cause Analysis

### Причина 1: Адаптивный threshold + wall sliding = бесконечная осцилляция

В [`_moveTowardTarget()`](../js/owner.js:331) при повороте:

```js
threshold = isTurn ? Math.max(spd + 2, GRID / 2) : spd + 2;
// = Math.max(6.5, 20) = 20px на повороте
```

Хозяин пытается достичь центра следующей ячейки (`nextPx`). Но **wall sliding** (строки 459–460) блокирует одну ось при прижатии к стене. Хозяин скользит вдоль стены, но **никогда не достигает порога 20px** по нужной оси — стена мешает. Условие `dist2 < threshold²` никогда не выполняется → `path.shift()` не срабатывает → хозяин осциллирует, пытаясь достичь одного и того же waypoint.

**Конкретный сценарий:**
1. Хозяин идёт вниз вдоль правой стены
2. A* строит путь: `[текущая, поворот_влево, следующая]`
3. `isTurn = true` → `threshold = 20px`
4. Хозяин прижат к стене справа → движение вправо заблокировано
5. Центр waypoint находится в 15px по X (за стеной) и 5px по Y
6. `dist2 = 15² + 5² = 250 > 20² = 400` — НЕТ, подождите...
7. Реальный случай: waypoint в 12px по X, 8px по Y → `dist2 = 144+64 = 208 < 400` — должно работать?

**Реальная проблема глубже**: когда `dist2 < threshold²` срабатывает и `path.shift()` удаляет waypoint, `dx/dy` для этого кадра **не устанавливаются** (код выходит из ветки без движения). На следующем кадре новый waypoint может быть ещё дальше → threshold снова большой → цикл.

### Причина 2: Path Smoothing убирает нужные промежуточные waypoints

[`_smoothPath()`](../js/owner.js:318) использует Bresenham line-of-sight. На углу хозяин может иметь "прямую видимость" до waypoint через 2 шага (диагонально через щель угла), и удаляет промежуточный waypoint, который должен был провести его вокруг угла. Теперь хозяин пытается идти напрямую через стену → блокируется → осциллирует.

### Причина 3: После `path.shift()` нет движения в текущем кадре

```js
if (dist2 < threshold * threshold) {
    this.path.shift();  // ← удалили waypoint
    // dx/dy остались 0 — хозяин стоит этот кадр
} else {
    const dist = Math.sqrt(dist2);
    dx /= dist;
    dy /= dist;
}
```

После `shift()` хозяин не двигается в текущем кадре. В узком коридоре это создаёт микро-паузы, которые накапливаются и выглядят как "дёргание".

---

## Решение

### Подход: "Waypoint advance by projection" (продвижение по проекции)

**Идея**: вместо проверки расстояния до waypoint, проверяем **прошёл ли хозяин мимо него** (dot product). Waypoint считается достигнутым, когда вектор "хозяин → waypoint" направлен **против** направления движения (т.е. хозяин уже прошёл мимо или находится на уровне waypoint).

```
Advance when: dot(toWaypoint, moveDir) <= 0
```

Это означает: "если я уже не приближаюсь к waypoint — переходи к следующему". Это **всегда делает прогресс** — хозяин не может застрять, потому что он либо приближается к waypoint, либо уже прошёл мимо.

**Дополнительно**: после `path.shift()` немедленно вычислять направление к новому waypoint и двигаться в этом кадре (не терять кадр).

### Изменения в `_moveTowardTarget()` (js/owner.js)

**Было:**
```js
const dist2 = dx*dx + dy*dy;
let threshold;
if (basementMode !== "") {
    if (this.path.length >= 3) {
        const isTurn = (curDc !== nextDc || curDr !== nextDr);
        threshold = isTurn ? Math.max(spd + 2, GRID / 2) : spd + 2;
    } else {
        threshold = Math.max(spd + 2, GRID / 2);
    }
} else {
    threshold = spd + 2;
}

if (dist2 < threshold * threshold) {
    this.path.shift();
} else {
    const dist = Math.sqrt(dist2);
    dx /= dist;
    dy /= dist;
    this.facingX = dx;
    this.facingY = dy;
}
```

**Станет:**
```js
const dist2 = dx*dx + dy*dy;

// Базовый threshold — маленький, только для "уже в точке"
const threshold = spd + 2;

// Проверка "прошли мимо waypoint" через dot product с предыдущим направлением
// Если facingX/Y указывает в сторону waypoint, а теперь dot <= 0 — прошли мимо
let passedWaypoint = false;
if (dist2 > 0.01) {
    // dot(текущий вектор к waypoint, предыдущее направление движения)
    const dot = dx * this.facingX + dy * this.facingY;
    // Если dot <= 0: хозяин уже прошёл мимо waypoint или стоит перпендикулярно
    passedWaypoint = dot <= 0;
}

if (dist2 < threshold * threshold || passedWaypoint) {
    this.path.shift();
    // Немедленно вычисляем направление к новому waypoint (не теряем кадр)
    if (this.path.length >= 2) {
        const newNext = this.path[1];
        const newPx = cellToPixelCenter(newNext.col, newNext.row);
        dx = newPx.x - ownerCx;
        dy = newPx.y - ownerCy;
        const nd2 = dx*dx + dy*dy;
        if (nd2 > 0.01) {
            const nd = Math.sqrt(nd2);
            dx /= nd; dy /= nd;
            this.facingX = dx; this.facingY = dy;
        }
    }
} else {
    const dist = Math.sqrt(dist2);
    dx /= dist;
    dy /= dist;
    this.facingX = dx;
    this.facingY = dy;
}
```

### Изменения в `_smoothPath()` (js/owner.js)

**Проблема**: path smoothing убирает waypoints на углах, из-за чего хозяин пытается идти через стену.

**Решение**: применять smoothing только если следующий waypoint находится на **прямом** участке (не поворот). На поворотах — не трогать путь.

```js
_smoothPath(ownerCol, ownerRow) {
    if (this.path.length < 3) return;
    // Проверяем: следующий шаг — поворот или прямо?
    const prev = this.path[0];
    const cur  = this.path[1];
    const next = this.path[2];
    const curDc  = cur.col  - prev.col,  curDr  = cur.row  - prev.row;
    const nextDc = next.col - cur.col,   nextDr = next.row - cur.row;
    const isTurn = (curDc !== nextDc || curDr !== nextDr);
    // На повороте — НЕ применяем smoothing (хозяин должен обойти угол)
    if (isTurn) return;
    // На прямом участке — ищем самый дальний waypoint с прямой видимостью
    for (let k = this.path.length - 1; k >= 2; k--) {
        if (this._hasLineOfSight(ownerCol, ownerRow, this.path[k].col, this.path[k].row)) {
            this.path.splice(1, k - 1);
            break;
        }
    }
},
```

### Открытые уровни — без изменений

На открытых уровнях (`basementMode === ""`):
- `threshold = spd + 2` — уже был таким, не меняется
- `passedWaypoint` — работает корректно (не может застрять у стены, стен нет)
- `_smoothPath` — не вызывается на открытых уровнях (уже так)
- Дрейф и микро-заморозки — не трогаем

---

## Диаграмма: старое vs новое поведение

```
СТАРОЕ (застревание):
Хозяин → waypoint (20px threshold)
  ↓ стена блокирует X
  ↓ dist2 = 208 < 400 → shift() → dx=0, dy=0 (стоим)
  ↓ новый waypoint ещё дальше → threshold=20 снова
  ↓ стена блокирует → dist2 > threshold → нормализуем
  ↓ двигаемся к стене → блокируемся → осциллируем ♻️

НОВОЕ (projection):
Хозяин → waypoint
  ↓ facingX/Y = направление к waypoint
  ↓ двигаемся (wall sliding работает)
  ↓ прошли мимо waypoint → dot(toWaypoint, facing) <= 0
  ↓ shift() + немедленно вычисляем новое направление
  ↓ продолжаем движение в этом же кадре ✅
```

---

## Файлы для изменения

| Файл | Изменение |
|---|---|
| [`js/owner.js`](../js/owner.js) | `_moveTowardTarget()`: заменить threshold-логику на projection; `_smoothPath()`: не применять на поворотах |
| [`tests/owner.test.js`](../tests/owner.test.js) | Добавить тесты: corner не застревает, projection advance работает |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Обновить описание A* навигации |

---

## Тесты для добавления

1. **"owner advances past waypoint via projection"** — хозяин с `facingX/Y` против вектора к waypoint → `path.shift()` срабатывает
2. **"owner does not freeze at corner in corridor maze"** — симуляция: хозяин у угла стены, путь с поворотом → за N кадров хозяин продвигается вперёд
3. **"smoothPath skips turn waypoints"** — путь с поворотом → `_smoothPath` не удаляет промежуточный waypoint
4. **"smoothPath still works on straight segments"** — прямой путь → `_smoothPath` удаляет промежуточные waypoints

---

## Что НЕ меняем

- Поведение на открытых уровнях (дрейф, микро-заморозки, threshold `spd+2`)
- Частоту пересчёта пути (15/30 кадров)
- Анти-застревание (`stuckTimer`, `stuckNudge`)
- Скорость хозяина, балансные константы
- Визуальные эффекты (фонарик, знаки над головой)
- Плавность движения кота (player.js не трогаем)
