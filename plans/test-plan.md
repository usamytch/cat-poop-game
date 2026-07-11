# План тестирования — Cat Poop Game

Цель: держать игровую логику, балансные инварианты и ключевой play-feel под повторяемой проверкой в Node.js через Vitest. Canvas, DOM, изображения, localStorage и Web Audio мокируются в `tests/setup.js`.

## Запуск

```bash
npm test
```

Для узкой проверки:

```bash
npx vitest run tests/owner-grid.test.js
npx vitest run tests/integration/play-feel-regression.test.js
```

## Основные группы тестов

| Файл | Назначение |
|---|---|
| `tests/audio.test.js` | Web Audio моки, звуковые эффекты, темы локаций, reverse panic |
| `tests/math.test.js` | `clamp`, RNG, геометрия |
| `tests/utils.test.js` | границы поля, rect helpers, столкновения, `escapeObstacles` |
| `tests/config.test.js` | `DIFF`, `WORLD`, `BONUS_TYPES`, каталоги, `BASEMENT` |
| `tests/bonuses.test.js` | эффекты бонусов и таймеры |
| `tests/particles.test.js` | конфетти, лужи, combo popups, emoji cache |
| `tests/projectiles.test.js` | выстрелы, попадания, промахи, combo |
| `tests/player.test.js` | движение кота, срочность, авария, лоток, паника, бонусы |
| `tests/owner.test.js` | активация хозяина, бегство, поимка, catnip, speed cap |
| `tests/owner-grid.test.js` | grid-node движение, repath hysteresis, self-loop guard |
| `tests/level.test.js` | генерация уровней, препятствия, подвал |
| `tests/grid.test.js` | сетка, занятость клеток, `aStarPath` |
| `tests/game.test.js` | состояние игры, старт, respawn, ввод |
| `tests/touch.test.js` | мобильное управление |
| `tests/integration/combo-flow.test.js` | полный флоу 3 попаданий |
| `tests/integration/urge-flow.test.js` | рост срочности, таблетка, авария, паника |
| `tests/integration/level-progression.test.js` | переход уровней и активация хозяина |
| `tests/integration/play-feel-regression.test.js` | повторяемые сценарии ощущения игры |

## Инварианты, которые должны оставаться покрытыми

- Срочность растёт по формуле `urgeRate / 60 * getUrgeScale(level)`, где `getUrgeScale()` использует актовый `effectiveLevel` и мягкий кап.
- `getLevelProgression()` делит уровни на 5-уровневые акты, даёт sawtooth-инвариант `L5 > L4`, `L6 < L5`, `L6 > L1`.
- Обычные локации идут блоками по 5 уровней и повторяются вариантами `II`, `III`, ...
- Паника начинается при `urge / maxUrge > 0.75`, авария при `urge >= maxUrge`.
- Для каждой локации есть обычная тема и ускоренный panic-вариант с математически развёрнутым таймлайном нот.
- Таблетка снижает срочность по фазам игры, не уводя значение ниже 0.
- 3 попадания подряд вызывают combo, `owner.flee()` и последующую очистку следов после бегства.
- `DIFF.easy.firstLvl === 3`, `DIFF.normal.firstLvl === 2`, `DIFF.chaos.firstLvl === 1`.
- Бонусы `life` и `catnip` появляются только с нужных уровней, жизнь не чаще 1 раза за уровень.
- На `5/5` гарантированы `pill` и контрольный бонус; `life` чаще при низких жизнях и реже при высоких.
- Хозяин и кот 36x36, `GRID === 40`, оба проходят через 1-клеточные щели.
- Коридорный подвал не оставляет одноклеточные ложные проходы; путь проверяется до свободной клетки у входа в лоток.
- Grid-node движение хозяина сохраняет `moveProgress` монотонным.
- `nextNode` не совпадает с `currentNode`; self-loop узлы пропускаются.
- Repath hysteresis использует `lastRepathGoalCell`, `repathMinDist` и `plannedGoalStillClose`.
- Старые steering-поля (`pathSegments`, `segmentIndex`, `stuckTimer`, `driftAngle`) не возвращаются.

## Play-Feel Checks

`tests/integration/play-feel-regression.test.js` фиксирует сценарии, которые раньше легко ломались визуально:

- открытая погоня должна давать уверенный прогресс без частой смены направления;
- движение в подвале по горизонтальному коридору должно оставаться на оси;
- паника на 95% срочности должна быть сильнее, чем на 80%;
- combo из 3 попаданий должно отправлять хозяина в бегство и очищаться после таймера.

## Когда расширять покрытие

- Любая правка `js/owner.js` требует как минимум `tests/owner-grid.test.js` и релевантный integration-test.
- Любая правка генерации уровня требует `tests/level.test.js`, `tests/grid.test.js`, проверки подвала и обычной reachability-проверки от спавна до лотка.
- Любая правка баланса сложности требует `tests/config.test.js`, `tests/player.test.js` и интеграционных сценариев срочности.
- Любая новая механика бонуса требует unit-теста бонуса, pickup-теста игрока и хотя бы одного интеграционного сценария.
