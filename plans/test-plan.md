# 🧪 План тестирования — Cat Poop Game

> Цель: покрыть всю игровую логику unit- и интеграционными тестами.
> Тесты пишутся на чистом JS (без фреймворков) или с минимальным test-runner (например Vitest / Jest).
> Canvas, Audio и DOM мокируются — тесты должны запускаться в Node.js без браузера.

---

## 📁 Структура тестов

```
tests/
├── setup.js              # Глобальные моки: canvas, ctx, Audio, localStorage, Image
├── utils.test.js
├── config.test.js
├── bonuses.test.js
├── projectiles.test.js
├── entities.test.js
├── level.test.js
├── particles.test.js
├── game.test.js
└── integration/
    ├── combo-flow.test.js
    ├── urge-flow.test.js
    └── level-progression.test.js
```

---

## 🔧 setup.js — моки окружения

- Мок `canvas` и `ctx` (все методы — пустые функции / jest.fn())
- Мок `Image` (complete=true, naturalWidth=1)
- Мок `localStorage` (in-memory Map)
- Мок `window.addEventListener`
- Мок Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`)
- Экспорт глобальных переменных игры через `globalThis`

---

## 1. `utils.test.js` — чистые функции

### `clamp(v, min, max)`
- [ ] `clamp(5, 0, 10)` → `5`
- [ ] `clamp(-5, 0, 10)` → `0`
- [ ] `clamp(15, 0, 10)` → `10`
- [ ] `clamp(0, 0, 0)` → `0`

### `createRng(seed)`
- [ ] Одинаковый seed → одинаковая последовательность чисел
- [ ] Разные seeds → разные последовательности
- [ ] Все значения в диапазоне `[0, 1)`
- [ ] Детерминированность: 100 вызовов с seed=42 дают фиксированный массив

### `randRange(rng, min, max)`
- [ ] Результат всегда в `[min, max)`
- [ ] При min=max возвращает min

### `randInt(rng, min, max)`
- [ ] Результат — целое число
- [ ] Результат в `[min, max]` включительно

### `rectsOverlap(a, b, pad)`
- [ ] Перекрывающиеся прямоугольники → `true`
- [ ] Не перекрывающиеся → `false`
- [ ] Касающиеся по краю → `false` (без pad)
- [ ] Касающиеся по краю с `pad=1` → `true`
- [ ] Отрицательный pad уменьшает зону пересечения

### `circleRect(c, r)`
- [ ] Центр круга внутри прямоугольника → `true`
- [ ] Круг касается угла прямоугольника → `true` (если r достаточен)
- [ ] Круг далеко от прямоугольника → `false`
- [ ] Круг рядом с краем, но не касается → `false`

### `getPlayBounds()`
- [ ] `left` = `WORLD.sidePadding`
- [ ] `top` = `WORLD.topPadding`
- [ ] `right` = `canvas.width - WORLD.sidePadding`
- [ ] `bottom` = `canvas.height - WORLD.floorHeight`

### `playerRect(x, y)`
- [ ] Без аргументов использует `player.x`, `player.y`
- [ ] С аргументами использует переданные координаты
- [ ] `width` = `player.size`, `height` = `player.size`

### `ownerRect(x, y)`
- [ ] Без аргументов использует `owner.x`, `owner.y`
- [ ] С аргументами использует переданные координаты
- [ ] `width` = `owner.width`, `height` = `owner.height`

### `hitsObstacles(rect, ignId)`
- [ ] Пустой массив `obstacles` → `false`
- [ ] Rect пересекается с одним препятствием → `true`
- [ ] Rect пересекается с препятствием, но оно в `ignId` → `false`
- [ ] Rect не пересекается ни с одним → `false`

---

## 2. `config.test.js` — константы и структуры

### DIFF
- [ ] Все три режима присутствуют: `easy`, `normal`, `chaos`
- [ ] Каждый режим содержит поля: `urgeRate`, `baseSpd`, `spdPerLvl`, `firstLvl`, `poopTime`, `hitUrgeReduce`
- [ ] `chaos.urgeRate > normal.urgeRate > easy.urgeRate`
- [ ] `chaos.baseSpd > normal.baseSpd > easy.baseSpd`
- [ ] `hitUrgeReduce` у каждого режима — число > 0
- [ ] `easy.hitUrgeReduce > normal.hitUrgeReduce > chaos.hitUrgeReduce` (на лёгком снижение больше)

### Баланс: снижение не превышает прирост за кулдаун
- [ ] Для `normal`: `hitUrgeReduce < urgeRate / 60 * 22` (кулдаун 22 кадра)
- [ ] Для `chaos`: `hitUrgeReduce < urgeRate / 60 * 22`
- [ ] Для `easy`: допустимо превышение (лёгкий режим)

### WORLD
- [ ] `width`, `height`, `floorHeight`, `topPadding`, `sidePadding` — все числа > 0

### BONUS_TYPES
- [ ] Содержит `fish`, `yarn`, `pill`
- [ ] Каждый тип имеет `emoji`, `label`, `color`

### obstacleCatalog
- [ ] Все типы из `locationThemes[*].obstacleTypes` присутствуют в каталоге
- [ ] Каждый тип имеет `minW`, `maxW`, `minH`, `maxH`, `color`, `detail`
- [ ] `minW <= maxW`, `minH <= maxH` для всех типов

---

## 3. `bonuses.test.js`

### `applyBonus("fish")`
- [ ] `speedBoostTimer` устанавливается в 300
- [ ] `yarnFreezeTimer` не изменяется
- [ ] В `comboPopups` добавляется запись с текстом "Ускорение!"

### `applyBonus("yarn")`
- [ ] `yarnFreezeTimer` устанавливается в 300
- [ ] `speedBoostTimer` не изменяется
- [ ] В `comboPopups` добавляется запись с текстом "Стоп хозяин!"

### `applyBonus("pill")`
- [ ] `player.urge` уменьшается до `urge * 0.7`
- [ ] При `urge = 0` остаётся 0 (не уходит в минус)
- [ ] При `urge = 100` становится 70
- [ ] В `comboPopups` добавляется запись с текстом "-30% срочности!"

### `updateBonuses()`
- [ ] Каждый бонус получает инкремент `pulse += 0.07`
- [ ] Мёртвые бонусы (`alive=false`) тоже обновляют pulse (или нет — зафиксировать поведение)

---

## 4. `projectiles.test.js`

### `shootPoop()`
- [ ] При `shootCooldown > 0` — снаряд не создаётся
- [ ] При `shootCooldown = 0` — снаряд добавляется в `poops`
- [ ] `shootCooldown` устанавливается в 22
- [ ] `stats.totalPoops` инкрементируется
- [ ] Снаряд стартует из центра игрока `(player.x + size/2, player.y + size/2)`
- [ ] При активном хозяине — направление к хозяину
- [ ] При неактивном хозяине — направление `lastDir`

### `updatePoops()` — движение
- [ ] Снаряд перемещается на `(dx, dy)` каждый кадр
- [ ] Снаряд за границами поля → `alive = false`, `comboCount = 0`
- [ ] Снаряд попадает в препятствие → `alive = false`, `comboCount = 0`

### `updatePoops()` — попадание в хозяина
- [ ] `circleRect` возвращает true → `p.alive = false`
- [ ] `comboCount` инкрементируется
- [ ] `comboTimer` устанавливается в 180
- [ ] `player.urge` уменьшается на `DIFF[difficulty].hitUrgeReduce`
- [ ] `player.urge` не уходит ниже 0 (clamp)
- [ ] `score` увеличивается на 2
- [ ] В `owner.facePoops` добавляется запись `{rx, ry, rot, scale}`
- [ ] `owner.poopHits` инкрементируется

### `updatePoops()` — комбо (3-е попадание)
- [ ] При `comboCount >= 3` вызывается `owner.flee()`
- [ ] `comboCount` сбрасывается в 0
- [ ] `comboTimer` сбрасывается в 0
- [ ] В `comboPopups` добавляется запись "COMBO!"

### `updatePoops()` — не-комбо попадание
- [ ] При `comboCount < 3` `owner.flee()` не вызывается
- [ ] В `comboPopups` добавляется запись "HIT! N/3"

### Сброс комбо по таймеру
- [ ] `comboTimer` убывает каждый кадр
- [ ] При `comboTimer === 0` → `comboCount = 0`

### Шлейф снаряда
- [ ] `trail` накапливает позиции, максимум 6 элементов
- [ ] При превышении — старые удаляются (`shift`)

---

## 5. `entities.test.js`

### `owner` — начальное состояние
- [ ] `poopHits = 0`
- [ ] `facePoops = []`
- [ ] `fleeTimer = 0`
- [ ] `active = false`

### `owner.activate()`
- [ ] При `level < diff.firstLvl` → `active = false`
- [ ] При `level >= diff.firstLvl` → `active = true`
- [ ] `speed` = `baseSpd + (level-1) * spdPerLvl`
- [ ] `poopHits` сбрасывается в 0
- [ ] `facePoops` очищается
- [ ] `fleeTimer` сбрасывается в 0
- [ ] Позиция устанавливается в дальний от игрока угол

### `owner.flee()`
- [ ] `fleeTimer` устанавливается в 300
- [ ] `fleeTarget` — угол, максимально удалённый от игрока
- [ ] При разных позициях игрока выбирается правильный угол

### `owner.update()` — режим бегства
- [ ] При `fleeTimer > 0` хозяин движется к `fleeTarget`
- [ ] `fleeTimer` убывает каждый кадр
- [ ] Кот не преследуется во время бегства (нет проверки поимки)
- [ ] При `yarnFreezeTimer > 0` хозяин не двигается

### `owner.update()` — очистка какашек после бегства
- [ ] Когда `fleeTimer` становится 0 и `poopHits >= 3` → `facePoops = []`, `poopHits = 0`
- [ ] Когда `fleeTimer` становится 0 и `poopHits < 3` → `facePoops` не очищается

### `owner.update()` — преследование
- [ ] Хозяин движется в сторону игрока
- [ ] Скорость не превышает `this.speed`
- [ ] Не выходит за границы `getPlayBounds()`
- [ ] Не проходит сквозь препятствия (раздельная проверка осей)

### `owner.update()` — поимка кота
- [ ] При пересечении с игроком → `stats.totalCaught++`
- [ ] При `lives > 1` → `gameState = "lifeLost"`
- [ ] При `lives <= 1` → `gameState = "caught"`

### `owner.update()` — анти-залипание
- [ ] При движении < 0.5 пикселей за кадр `stuckTimer` растёт
- [ ] При `stuckTimer > 30` → генерируется `stuckNudge`
- [ ] При нормальном движении `stuckNudge = null`

### `player.update()` — срочность
- [ ] Каждый кадр `urge` растёт на `urgeRate/60 * (1 + (level-1)*0.08)`
- [ ] `urge` не превышает `maxUrge`
- [ ] При `urge >= maxUrge` → авария

### `player.update()` — авария
- [ ] `stats.totalAccidents++`
- [ ] `lives--`
- [ ] При `lives <= 0` → `gameState = "accident"`
- [ ] При `lives > 0` → `gameState = "lifeLost"`, `lifeLostReason = "accident"`

### `player.update()` — лоток
- [ ] На лотке `poopProgress` растёт
- [ ] `isPooping = true` пока на лотке
- [ ] При `poopProgress >= poopTime` → уровень пройден, `level++`
- [ ] Уход с лотка → `poopProgress = 0`, `isPooping = false`

### `player.update()` — паника
- [ ] При `urge/maxUrge > 0.75` → `panicShake > 0`
- [ ] При `urge/maxUrge <= 0.75` → `panicShake = 0`

### `player.update()` — подбор бонусов
- [ ] При пересечении с бонусом → `applyBonus(type)`, `b.alive = false`

---

## 6. `level.test.js`

### `generateLevel()`
- [ ] `obstacles` не пустой после генерации
- [ ] `litterBox` имеет `x`, `y`, `width`, `height`
- [ ] `bonuses` содержит хотя бы один элемент
- [ ] Препятствия не пересекаются с лотком
- [ ] Препятствия не пересекаются друг с другом (или допустимое перекрытие — зафиксировать)
- [ ] Препятствия не выходят за `getPlayBounds()`
- [ ] Одинаковый `level` → одинаковая генерация (детерминированность через seed)
- [ ] С уровня 5 некоторые препятствия имеют `moving = true`

### `updateObstacles()`
- [ ] Движущиеся препятствия меняют `movingOffset`
- [ ] Статичные препятствия не меняют позицию

---

## 7. `particles.test.js`

### `spawnConfetti(x, y)`
- [ ] В `overlayParticles` добавляются частицы
- [ ] Каждая частица имеет `x`, `y`, `vx`, `vy`, `life`, `emoji`

### `spawnPuddle(x, y)`
- [ ] `puddleAlpha` устанавливается > 0

### `updateOverlayParticles()`
- [ ] Частицы перемещаются по `vx`, `vy`
- [ ] `life` убывает каждый кадр
- [ ] Мёртвые частицы (`life <= 0`) удаляются

### `comboPopups`
- [ ] Таймер убывает каждый кадр
- [ ] При `timer <= 0` запись удаляется

---

## 8. `game.test.js`

### `stats`
- [ ] Инициализируется из `localStorage` (или 0 если нет)
- [ ] `stats.update(score, level)` обновляет `highScore` если score больше
- [ ] `stats.update(score, level)` обновляет `bestLevel` если level больше
- [ ] `stats.save()` записывает все поля в `localStorage`

### `startGame()`
- [ ] `score = 0`, `level = 1`, `lives = 3`
- [ ] `player.urge = 0`
- [ ] `poops` очищается
- [ ] `gameState = "playing"`
- [ ] `owner.activate()` вызывается

### `respawnPlayer()`
- [ ] Игрок перемещается в левую часть поля
- [ ] `player.urge = 0`
- [ ] `gameState = "playing"`
- [ ] `owner.activate()` вызывается

### `update()` — диспетчер состояний
- [ ] В состоянии `"playing"` вызываются все update-функции
- [ ] В состоянии `"lifeLost"` убывает `lifeLostTimer`, при 0 → `respawnPlayer()`
- [ ] В состоянии `"start"` ничего не обновляется (кроме частиц)

### Обработка клавиш
- [ ] `1`/`2`/`3` на старте меняют `difficulty`
- [ ] `Enter` на старте вызывает `startGame()`
- [ ] `Пробел`/`X` в игре вызывают `shootPoop()`
- [ ] `M` в любом состоянии переключает мьют
- [ ] `Enter` в `lifeLost` вызывает `respawnPlayer()`
- [ ] `Enter` в `caught`/`accident` → `gameState = "start"`

---

## 9. Интеграционные тесты

### `integration/combo-flow.test.js` — полный флоу комбо

- [ ] 1-е попадание: `comboCount=1`, `facePoops.length=1`, `poopHits=1`, HIT-попап
- [ ] 2-е попадание: `comboCount=2`, `facePoops.length=2`, `poopHits=2`, HIT-попап
- [ ] 3-е попадание: `comboCount=0` (сброс), `facePoops.length=3`, `poopHits=3`, COMBO-попап, `owner.fleeTimer=300`
- [ ] Пока `fleeTimer > 0`: `facePoops.length=3` (какашки видны)
- [ ] После `fleeTimer = 0` (300 тиков): `facePoops=[]`, `poopHits=0`
- [ ] Промах между попаданиями: `comboCount=0` (сброс)
- [ ] Попадание в препятствие: `comboCount=0`

### `integration/urge-flow.test.js` — срочность и стрельба

- [ ] Без стрельбы: за N кадров `urge` растёт ровно на `urgeRate/60 * N`
- [ ] После попадания: `urge` снижается на `hitUrgeReduce`
- [ ] Нельзя снизить `urge` ниже 0
- [ ] Таблетка снижает `urge` до `urge * 0.7`
- [ ] При `urge >= 100` → авария, `gameState` меняется
- [ ] Паника активируется при `urge > 75`

### `integration/level-progression.test.js` — прогресс уровней

- [ ] Стояние на лотке `poopTime` кадров → `level++`
- [ ] После перехода `urge` снижается на 30
- [ ] `score` увеличивается
- [ ] `generateLevel()` вызывается (новые препятствия)
- [ ] `owner.activate()` вызывается с новым уровнем
- [ ] На уровне `diff.firstLvl - 1` хозяин неактивен
- [ ] На уровне `diff.firstLvl` хозяин активен

---

## 🛠️ Технические заметки

### Что мокировать
| Зависимость | Мок |
|---|---|
| `canvas`, `ctx` | Объект с пустыми методами |
| `Image` | `{complete: true, naturalWidth: 1}` |
| `localStorage` | In-memory объект |
| `requestAnimationFrame` | `fn => fn()` или no-op |
| `sndMeow`, `sndFart`, `sndHit`, etc. | Пустые функции |
| `startMelody`, `stopMelody` | Пустые функции |
| `Date.now` | Фиксированное значение для детерминированности |

### Порядок загрузки модулей
Поскольку игра использует глобальные переменные, тесты должны загружать файлы в том же порядке что и `index.html`:
1. `config.js`
2. `utils.js`
3. `audio.js` (мок)
4. `particles.js`
5. `bonuses.js`
6. `level.js`
7. `entities.js`
8. `projectiles.js`
9. `game.js`

### Рекомендуемый test runner
- **Vitest** — нативная поддержка ESM, быстрый, хорошая совместимость с браузерными глобалами через `jsdom`
- Альтернатива: **Jest** с `testEnvironment: 'jsdom'`
