# 📐 Plan: Owner 36×36 — Fix Size Mismatch

## Проблема

Корень всех багов хозяина в лабиринте — несоответствие размеров:

| Сущность | Размер | Ячейка (GRID=40px) | Влезает? |
|---|---|---|---|
| 🐱 Кот | 36×36px | 40×40px | ✅ +4px зазор |
| 👨 Хозяин | 36×**52**px | 40×40px | ❌ 52 > 40 по высоте! |

Из-за этого в коде накопились хаки:
- `pathW/pathH` — A* использует размер **кота** вместо хозяина в подвале
- `EPSILON = GRID*0.4 = 16px` — увеличенный порог из-за 52px
- Комментарии про "центр хозяина физически не может достичь cellToPixelCenter"

## Решение: хозяин → 36×36 (глобально)

```
GRID = 40px
Cat:   36×36px  → зазор 4px в ячейке ✅
Owner: 36×36px  → зазор 4px в ячейке ✅
Corridor (2 cells): 80px → оба влезают с 8px зазором ✅
```

---

## Файлы и изменения

### 1. `js/owner.js` — строка 6: height 52 → 36

```js
// БЫЛО:
const owner = { x: 800, y: 300, width: 36, height: 52, ... }

// СТАЛО:
const owner = { x: 800, y: 300, width: 36, height: 36, ... }
```

### 2. `js/owner.js` — `_moveTowardTarget()`: удалить хак pathW/pathH (~строка 489)

```js
// БЫЛО:
const pathW = (basementMode !== "") ? player.size : this.width;
const pathH = (basementMode !== "") ? player.size : this.height;
const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row, pathW, pathH);

// СТАЛО:
const newPath = aStarPath(ownerCell.col, ownerCell.row, goalCell.col, goalCell.row, this.width, this.height);
```

Также удалить комментарий-объяснение хака (5 строк про "коридоры шириной 2 ячейки (80px)...").

### 3. `js/owner.js` — `_moveTowardTarget()`: упростить EPSILON (~строка 541)

```js
// БЫЛО:
// В подвале используем порог GRID*0.4 = 16px из-за 52px высоты хозяина:
// ...
const EPSILON = (basementMode !== "") ? GRID * 0.4 : 8;

// СТАЛО:
// Порог завершения сегмента: 8px достаточно для обоих размеров 36×36
const EPSILON = 8;
```

Удалить 4 строки комментария про 52px.

### 4. `js/owner.js` — обновить комментарий в ARCHITECTURE (~строка 521)

```js
// БЫЛО:
// EPSILON = GRID/2 (20px): хозяин 36×52px центрируется на ячейке 40px,
// поэтому его центр физически не может достичь точного cellToPixelCenter
// конечной ячейки — стена блокирует на ~6px раньше по перпендикулярной оси.

// СТАЛО:
// EPSILON = 8px: небольшой порог для плавного перехода к следующему сегменту.
```

---

## Тесты — что обновить

### `tests/player.test.js` — строки 82–84: обновить тест размера

```js
// БЫЛО:
it('owner.height = 52', () => {
  expect(owner.height).toBe(52);
});

// СТАЛО:
it('owner.height = 36 (fits in 1 grid cell with margin)', () => {
  expect(owner.height).toBe(36);
  expect(owner.height).toBeLessThan(40); // GRID = 40
});
```

### `tests/owner-steering.test.js` — строки 612–653: обновить regression-тест

Тест `corner-freeze regression — basement epsilon GRID*0.4` проверяет что `EPSILON=16px` работает.
После изменения `EPSILON=8px` тест нужно переписать:

```js
// БЫЛО: описание про EPSILON=GRID*0.4=16px из-за 52px высоты
// СТАЛО: тест проверяет что EPSILON=8px работает для 36×36 хозяина

describe('segment completion — epsilon 8px', () => {
  it('segmentIndex advances when owner is within 8px of segment end', () => {
    // Owner 36×36 fits in 40px cell — EPSILON=8px достаточно
    // Place owner center at segLen - 6px from start (within 8px of end)
    owner.x = startPx.x + segLen - 6 - owner.width / 2;
    owner.y = startPx.y - owner.height / 2;
    // ... expect(owner.segmentIndex).toBeGreaterThan(0)
  });

  it('segmentIndex does NOT advance when owner is 10px from segment end', () => {
    // 10px > EPSILON=8px → should NOT advance
    owner.x = startPx.x + segLen - 10 - owner.width / 2;
    // ... expect(owner.segmentIndex).toBe(0)
  });
});
```

Также удалить строки 613–615 (упоминание lateral snap и stuckTimer threshold=20 как части corner-freeze fix).

---

## ARCHITECTURE.md — что обновить

### Раздел "Гарантии проходимости"

```markdown
// БЫЛО:
- **Хозяин в лабиринте**: A* использует размер кота (36×36px) вместо своего (36×52px) — корректно проходит коридоры шириной 2 ячейки (80px)

// СТАЛО:
- **Хозяин в лабиринте**: A* использует реальный размер хозяина (36×36px) — коридоры шириной 2 ячейки (80px) вмещают обоих с 8px зазором
```

### Раздел "A* навигация хозяина"

Удалить пункт:
> **Footprint для A* в подвале**: используется размер кота (36×36px) вместо хозяина (36×52px) — коридоры шириной 2 ячейки (80px) физически вмещают хозяина, но `canPass` с 36×52 ложно видит коллизию со стеной

Удалить пункт:
> **Почему EPSILON = GRID*0.4 в подвале**: хозяин 36×52px центрируется на ячейке 40px → его центр физически не может достичь точного `cellToPixelCenter` конечной ячейки...

Обновить описание EPSILON:
```markdown
// БЫЛО:
- **Segment completion** — сегмент засчитывается когда `progress >= segLen - EPSILON` (прогресс вдоль оси): `EPSILON = GRID * 0.4 = 16px` в подвале, `8px` на открытых уровнях

// СТАЛО:
- **Segment completion** — сегмент засчитывается когда `progress >= segLen - EPSILON` (прогресс вдоль оси): `EPSILON = 8px` (единый для всех уровней)
```

Обновить таблицу размеров (если есть) или добавить:
```markdown
- Кот: 36×36px, Хозяин: 36×36px — оба помещаются в ячейку 40×40px с зазором 4px
```

---

## Порядок выполнения

1. `js/owner.js` — height 52→36, удалить pathW/pathH хак, упростить EPSILON
2. `tests/player.test.js` — обновить тест owner.height
3. `tests/owner-steering.test.js` — переписать corner-freeze regression тест
4. `ARCHITECTURE.md` — обновить документацию
5. `npm test` — убедиться что все тесты зелёные

---

## Визуальные последствия

- Спрайт `master.png` рисуется через `drawSprite(masterImage, this.x, this.y, this.width, this.height)` — при 36×36 спрайт станет квадратным. Если спрайт вытянутый по вертикали — нужно проверить визуально.
- Коллизия поимки: `rectsOverlap(playerRect(), ownerRect(), -6)` — с 36×36 хозяин чуть меньше. Возможно стоит убрать `-6` или уменьшить до `-4` для баланса.
- Фонарик: `cx + this.facingX * (this.width/2 + 2)` — позиция сдвинется на 2px, некритично.
