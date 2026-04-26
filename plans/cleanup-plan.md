# 🧹 Cleanup Plan — Cat Poop Game

> Цель: сделать проект удобным для чтения людьми и LLM-агентами.
> Разбить большие файлы, устранить дублирование, навести порядок в тестах.

---

## 📊 Текущее состояние файлов

### Исходный код (`js/`)

| Файл | Строк | Статус |
|---|---|---|
| `js/renderer.js` | 556 | 🔴 Слишком большой — 3 независимых слоя |
| `js/entities.js` | 521 | 🔴 Слишком большой — player и owner смешаны |
| `js/level.js` | 433 | 🟡 Приемлемо, но A* можно вынести |
| `js/audio.js` | 275 | 🟡 Мелодия занимает 200 строк данных |
| `js/touch.js` | 249 | 🟢 Нормально |
| `js/config.js` | 116 | 🟢 Нормально |
| `js/utils.js` | 106 | 🟢 Нормально |
| `js/particles.js` | 137 | 🟢 Нормально |
| `js/projectiles.js` | 116 | 🟢 Нормально |
| `js/bonuses.js` | 46 | 🟢 Нормально |
| `js/game.js` | 136 | 🟢 Нормально |

### Тесты (`tests/`)

| Файл | Строк | Статус |
|---|---|---|
| `tests/entities.test.js` | 718 | 🔴 Слишком большой — 10 describe-блоков |
| `tests/level.test.js` | 489 | 🔴 Слишком большой — 4 независимых темы |
| `tests/projectiles.test.js` | 285 | 🟡 Можно разбить |
| `tests/game.test.js` | 245 | 🟢 Нормально |
| `tests/utils.test.js` | 285 | 🟡 Можно разбить |
| `tests/config.test.js` | 130 | 🟢 Нормально |
| `tests/bonuses.test.js` | 105 | 🟢 Нормально |
| `tests/particles.test.js` | 114 | 🟢 Нормально |
| `tests/integration/combo-flow.test.js` | 135 | 🟢 Нормально |
| `tests/integration/urge-flow.test.js` | 173 | 🟢 Нормально |
| `tests/integration/level-progression.test.js` | 160 | 🟢 Нормально |

---

## 🔍 Найденные проблемы

### 1. Дублирование `resetState` в тестах

В **каждом** тестовом файле есть своя функция сброса состояния (`resetCommon`, `fullReset`, `resetForCombo`, `resetUrge`, `resetForLevel`, `resetState`). Все они сбрасывают одни и те же ~20 переменных с одинаковыми значениями. Это:
- Хрупко: добавление новой переменной требует правки 6 файлов
- Дублирование: `obstacles.length = 0`, `poops.length = 0`, `comboCount = 0` и т.д. повторяются везде

**Решение:** вынести `resetGameState()` в `tests/setup.js` и экспортировать.

### 2. Хардкод размеров сущностей в тестах

В `combo-flow.test.js`, `urge-flow.test.js`, `level-progression.test.js`, `projectiles.test.js` хардкодятся:
```js
player.size = 48;   // но в entities.js player.size = 36!
owner.width = 52;   // но в entities.js owner.width = 36!
owner.height = 72;  // но в entities.js owner.height = 52!
```
Это **несоответствие реальным значениям** — тесты используют другие размеры, чем игра. Комментарий в `entities.test.js` правильно говорит «не хардкодим размеры», но другие файлы это нарушают.

**Решение:** убрать хардкод размеров из тестов, использовать `player.size`, `owner.width`, `owner.height` напрямую.

### 3. `js/renderer.js` — три независимых слоя в одном файле

Файл содержит три совершенно разных ответственности:
- **Offscreen/background layer** (`rebuildBgLayer`, `_drawBgTo`, `_drawDecorTo`, `_drawObstacleTo`) — статичный слой
- **HUD и UI** (`drawUI`, `drawStartScreen`, `drawOverlay`, `drawLitterBox`) — интерфейс
- **Главный цикл рисования** (`draw`) — оркестратор

**Решение:** разбить на:
- `js/renderer-bg.js` — фон, декор, препятствия, offscreen canvas
- `js/renderer-hud.js` — HUD, стартовый экран, оверлеи, лоток
- `js/renderer.js` — только `draw()` как оркестратор (30-40 строк)

### 4. `js/entities.js` — player и owner в одном файле

521 строка содержит два независимых объекта с разной логикой:
- `player` — движение, срочность, лоток, бонусы (~120 строк)
- `owner` — A*-навигация, бегство, анти-застревание, человечность (~380 строк)

**Решение:** разбить на:
- `js/player.js` — объект `player` + `panicShake`, `alarmTimer`, `poopProgress`, `isPooping`
- `js/owner.js` — объект `owner` со всей AI-логикой

### 5. `js/level.js` — A* и генерация уровня в одном файле

433 строки содержат:
- `MinHeap` + `aStarPath` — алгоритм поиска пути (~130 строк)
- Утилиты сетки (`cellKey`, `markCells`, `cellsFree`, `pixelToCell` и т.д.) — ~70 строк
- `generateLevel`, `generateObstacle`, `generateDecor`, `placeLitterBox` — ~170 строк
- `updateObstacles` — ~10 строк

**Решение:** разбить на:
- `js/pathfinding.js` — `MinHeap` + `aStarPath` (~130 строк)
- `js/level.js` — сетка + генерация + обновление (~300 строк)

### 6. `js/audio.js` — данные мелодии захламляют файл

200 из 275 строк — это массив `_MELODY_NOTES` с нотами. Логика аудио (тоны, планировщик) занимает только ~75 строк.

**Решение:** вынести данные в `js/melody-data.js` (просто `const _MELODY_NOTES = [...]`), оставить логику в `js/audio.js`.

### 7. `tests/entities.test.js` — 718 строк, 10 describe-блоков

Тест покрывает слишком много разных тем:
- Размеры сущностей
- `owner.activate()`
- `owner.flee()`
- `owner.onShotFired()`
- `owner.update()` — flee mode
- `owner.update()` — face poop cleanup
- `owner.update()` — pursuit and catch
- `owner.update()` — anti-stuck
- `owner.update()` — shotReactTimer
- `owner.update()` — hesitateTimer
- `escapeObstacles`
- `player.update()` — urge, accident, litter box, panic, bonus pickup

**Решение:** разбить на:
- `tests/player.test.js` — всё про player
- `tests/owner.test.js` — всё про owner

### 8. `tests/level.test.js` — 489 строк, 4 независимых темы

- `generateLevel()` — 20 тестов
- `updateObstacles()` — 2 теста
- Grid utility functions — 7 тестов
- `aStarPath()` — 6 тестов

**Решение:** разбить на:
- `tests/level.test.js` — только `generateLevel()` и `updateObstacles()`
- `tests/grid.test.js` — grid utilities + `aStarPath()`

### 9. `tests/utils.test.js` — смешаны чистые функции и игровые объекты

285 строк содержат:
- `clamp`, `createRng`, `randRange`, `randInt` — чистые функции (не зависят от игры)
- `rectsOverlap`, `circleRect` — чистые функции
- `getPlayBounds`, `playerRect`, `ownerRect` — зависят от `player`/`owner`
- `escapeObstacles`, `hitsObstacles` — зависят от `obstacles`

**Решение:** разбить на:
- `tests/math.test.js` — `clamp`, RNG, `rectsOverlap`, `circleRect` (чистые)
- `tests/utils.test.js` — `getPlayBounds`, `playerRect`, `ownerRect`, `escapeObstacles`, `hitsObstacles`

### 10. Дублирование `hitOwner()` в тестах

Функция `hitOwner()` определена **дважды** — в `tests/integration/combo-flow.test.js` и в `tests/projectiles.test.js` с идентичной логикой.

**Решение:** вынести в `tests/setup.js` как экспортируемую хелпер-функцию.

### 11. `js/config.js` — инициализация canvas смешана с константами

Строки 8-11 в `config.js`:
```js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 700;
```
Это DOM-операции в файле констант. Логически они принадлежат `game.js` или отдельному `init.js`.

**Решение:** перенести инициализацию canvas в `js/game.js` (в начало, до всех других операций).

---

## 📋 План действий

### Фаза 1: Тесты — устранение дублирования (быстрые wins)

**1.1** Добавить `resetGameState()` в `tests/setup.js`
- Единая функция сброса всех игровых переменных
- Все тестовые файлы импортируют и используют её

**1.2** Исправить хардкод размеров сущностей
- Убрать `player.size = 48`, `owner.width = 52`, `owner.height = 72` из тестов
- Использовать реальные значения из игровых объектов

**1.3** Вынести `hitOwner()` в `tests/setup.js`

### Фаза 2: Разбивка тестовых файлов

**2.1** `tests/entities.test.js` → `tests/player.test.js` + `tests/owner.test.js`

**2.2** `tests/level.test.js` → `tests/level.test.js` + `tests/grid.test.js`

**2.3** `tests/utils.test.js` → `tests/math.test.js` + `tests/utils.test.js`

### Фаза 3: Разбивка исходного кода

**3.1** `js/entities.js` → `js/player.js` + `js/owner.js`
- Обновить `index.html` (порядок загрузки)
- Обновить `tests/setup.js` (список файлов в `loadGame()`)

**3.2** `js/renderer.js` → `js/renderer-bg.js` + `js/renderer-hud.js` + `js/renderer.js`
- Обновить `index.html`

**3.3** `js/level.js` → `js/pathfinding.js` + `js/level.js`
- Обновить `index.html` и `tests/setup.js`

**3.4** `js/audio.js` → `js/melody-data.js` + `js/audio.js`
- Обновить `index.html`

### Фаза 4: Перенос canvas-инициализации

**4.1** Перенести DOM-операции из `js/config.js` в `js/game.js`

### Фаза 5: Обновление документации

**5.1** Обновить `README.md` — новая структура файлов
**5.2** Обновить `plans/agent-plan.md` — новая карта модулей

---

## 🗂️ Целевая структура файлов

```
js/
├── config.js          # Только константы: WORLD, DIFF, GRID, BONUS_TYPES, каталоги
├── utils.js           # Утилиты: RNG, clamp, коллизии, drawSprite, rrect, setFont
├── audio.js           # Web Audio API: tone(), snd*(), startMelody/stopMelody
├── melody-data.js     # Данные нот мелодии (_MELODY_NOTES, _BPM, _E, _S, _MELODY_DUR)
├── particles.js       # Частицы: конфетти, лужа, комбо-попапы, emoji-кэш
├── bonuses.js         # Бонусы: подбор, эффекты, таймеры
├── pathfinding.js     # MinHeap + aStarPath (A* алгоритм)
├── level.js           # Сетка + generateLevel + updateObstacles
├── player.js          # Объект player: движение, срочность, лоток, паника
├── owner.js           # Объект owner: AI, A*-навигация, бегство, человечность
├── projectiles.js     # Какашки: выстрел, движение, попадание, комбо
├── renderer-bg.js     # Offscreen canvas: фон, декор, статичные препятствия
├── renderer-hud.js    # HUD, стартовый экран, оверлеи, лоток
├── renderer.js        # draw() — главный оркестратор рендеринга (~40 строк)
├── touch.js           # Мобильное управление
└── game.js            # Canvas init, состояние, ввод, игровой цикл

tests/
├── setup.js           # Моки + loadGame() + resetGameState() + hitOwner()
├── math.test.js       # clamp, RNG, rectsOverlap, circleRect (чистые функции)
├── utils.test.js      # getPlayBounds, playerRect, ownerRect, escapeObstacles, hitsObstacles
├── config.test.js     # DIFF, WORLD, BONUS_TYPES, obstacleCatalog
├── bonuses.test.js    # applyBonus, updateBonuses
├── particles.test.js  # конфетти, лужа, комбо-попапы
├── projectiles.test.js # выстрел, движение, попадание, комбо
├── player.test.js     # player: движение, срочность, авария, лоток, паника, бонусы
├── owner.test.js      # owner: activate, flee, onShotFired, update, AI
├── level.test.js      # generateLevel, updateObstacles
├── grid.test.js       # cellKey, markCells, cellsFree, pixelToCell, aStarPath
├── game.test.js       # stats, startGame, respawnPlayer, update, input
└── integration/
    ├── combo-flow.test.js
    ├── urge-flow.test.js
    └── level-progression.test.js
```

---

## 📏 Ожидаемые размеры после рефакторинга

| Файл | До | После |
|---|---|---|
| `js/renderer.js` | 556 | ~40 |
| `js/renderer-bg.js` | — | ~200 |
| `js/renderer-hud.js` | — | ~320 |
| `js/entities.js` | 521 | удалён |
| `js/player.js` | — | ~140 |
| `js/owner.js` | — | ~390 |
| `js/level.js` | 433 | ~300 |
| `js/pathfinding.js` | — | ~140 |
| `js/audio.js` | 275 | ~80 |
| `js/melody-data.js` | — | ~140 |
| `tests/entities.test.js` | 718 | удалён |
| `tests/player.test.js` | — | ~280 |
| `tests/owner.test.js` | — | ~450 |
| `tests/level.test.js` | 489 | ~200 |
| `tests/grid.test.js` | — | ~200 |
| `tests/utils.test.js` | 285 | ~150 |
| `tests/math.test.js` | — | ~140 |

---

## ⚠️ Важные ограничения

1. **Порядок загрузки в `index.html`** — строго соблюдать зависимости:
   - `melody-data.js` до `audio.js`
   - `pathfinding.js` до `level.js`
   - `player.js` и `owner.js` до `projectiles.js`
   - `renderer-bg.js` и `renderer-hud.js` до `renderer.js`

2. **`tests/setup.js` — список файлов в `loadGame()`** — обновить в том же порядке

3. **Глобальные переменные** — все `const`/`let` остаются глобальными (Vanilla JS, без модулей)

4. **Тесты должны проходить** — после каждой фазы запускать `npm test` (224 passed, 0 failed)

5. **Не менять игровую логику** — только структурный рефакторинг, никаких изменений поведения

---

## 🎯 Приоритеты

| Приоритет | Задача | Сложность | Польза |
|---|---|---|---|
| 🔥 Высокий | Исправить хардкод размеров в тестах | Низкая | Корректность тестов |
| 🔥 Высокий | `resetGameState()` в setup.js | Низкая | Устранение дублирования |
| 🔥 Высокий | Разбить `entities.js` → player + owner | Средняя | Читаемость |
| 🔥 Высокий | Разбить `entities.test.js` → player + owner | Средняя | Читаемость |
| 🟡 Средний | Разбить `renderer.js` → bg + hud + draw | Средняя | Читаемость |
| 🟡 Средний | Разбить `level.js` → pathfinding + level | Средняя | Читаемость |
| 🟡 Средний | Разбить `level.test.js` → level + grid | Низкая | Читаемость |
| 🟡 Средний | Разбить `utils.test.js` → math + utils | Низкая | Читаемость |
| 🟢 Низкий | Вынести `melody-data.js` из `audio.js` | Низкая | Читаемость |
| 🟢 Низкий | Перенести canvas init из `config.js` | Низкая | Чистота архитектуры |
