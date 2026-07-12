// ==========================================
// CONFIG — constants, themes, catalog
// ==========================================

// ===== ОПРЕДЕЛЕНИЕ УСТРОЙСТВА =====
const FORCE_TOUCH_QA = !!(
  window.location && typeof URLSearchParams !== "undefined" &&
  new URLSearchParams(window.location.search || "").get("touch") === "1"
);
const IS_MOBILE = FORCE_TOUCH_QA || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Canvas init здесь — до touch.js, который регистрирует canvas.addEventListener
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 700;

const WORLD = { width: 1200, height: 700, floorHeight: 90, topPadding: 10, sidePadding: 0 };

// Presentation-only feedback. Physics continues to use player.size and
// owner.width/height (36×36); the larger collage faces never enter collision,
// grid, LOS or A* calculations.
const FEEDBACK = {
  playerVisualSize: 44,
  ownerVisualSize: 44,
  panicEnter: [0.75, 0.85, 0.95],
  panicExit: [0.73, 0.83, 0.93],
  comboHitStopTicks: 3,
  impactTicks: 12,
  threatPingTicks: 34,
};

const AUDIO_MIX = {
  music: 0.78,
  sfx: 0.92,
  tension: 0.82,
  crossfadeSeconds: 0.18,
  pressureSpeed: 1.10,
  panicSpeed: 1.38,
};

// ===== СЕТКА УРОВНЯ =====
// Play area: x=[0..1200], y=[10..610]  →  1200 × 600 px
// GRID=40 → 30 cols × 15 rows = 450 cells
const GRID = 40;
const GRID_COLS = 30; // Math.floor(1200 / 40)
const GRID_ROWS = 15; // Math.floor(600 / 40)

const catImage = new Image(); catImage.src = "cat.png";
const masterImage = new Image(); masterImage.src = "master.png";
const lifeImage = new Image(); lifeImage.src = "favicon-32.png";

// ===== СЛОЖНОСТЬ =====
const DIFF = {
  // repathMinDist — Chebyshev cell distance deadzone for playerCellChanged repath trigger.
  //   Prevents oscillation on open levels: owner ignores micro-shifts < repathMinDist cells.
  //   Fallback timer (PATH_RECALC=30) still fires regardless of this value.
  //   Chaos=2 (not 1): aggressiveness via speed/hesitation, not repath churn.
  //
  // hesitateBaseProb  — base probability of micro-freeze per frame (~once per N sec at 60fps)
  // hesitateProbDecay — hyperbolic decay coefficient: prob = base / (1 + (level-1) * decay)
  // hesitateMinProb   — floor probability (never goes below this)
  // hesitateDur       — duration of micro-freeze in frames
  normal: { label:"😼 Нормал", urgeRate:1.9,  baseSpd:1.6, spdPerLvl:0.25, maxSpd:4.5, firstLvl:2, poopTime:180, hitUrgeReduce:2.0, shootUrgeReduce:0, repathMinDist:2, hesitateBaseProb:0.004, hesitateProbDecay:0.10, hesitateMinProb:0.001, hesitateDur:12, chaseMemory:45, searchDuration:75, heardDuration:120, comboFleeMin:180, comboFleeMax:270 },
  chaos:  { label:"😈 Хаос",   urgeRate:3.0,  baseSpd:2.3, spdPerLvl:0.40, maxSpd:6.5, firstLvl:1, poopTime:240, hitUrgeReduce:1.5, shootUrgeReduce:0, repathMinDist:2, hesitateBaseProb:0.002, hesitateProbDecay:0.20, hesitateMinProb:0.0,  hesitateDur:8,  chaseMemory:90, searchDuration:120, heardDuration:150, comboFleeMin:120, comboFleeMax:210 },
};

// Контракт восприятия хозяина. В обычных комнатах достаточно чистой линии
// зрения; в Подвале зрение ограничено нарисованным конусом фонарика.
const OWNER_AI = {
  sightPadding: 2,
  basementConeHalfAngle: Math.PI / 4.5,
  basementCloseVision: 72,
  targetArrivalRadius: GRID * 0.9,
};

// ===== АКТЫ ПОЗДНЕЙ ИГРЫ =====
// 5 уровней на акт: 1/5 выдох, 5/5 пик.
// effectiveLevel растёт ступеньками и насыщается, чтобы поздняя игра
// не превращалась в бесконечное выкручивание чисел.
const ACT = {
  length: 5,
  stepCurve: [0, 0.7, 1.5, 2.5, 4.0],
  maxScalingAct: 10,
  modifiers: [
    { key:"clutter", label:"Захламлено" },
    { key:"hunt",    label:"Охота" },
    { key:"panic",   label:"Паника" },
    { key:"motion",  label:"Движуха" },
    { key:"open",    label:"Открыто" },
  ],
};

// ===== ФОРМАТ ЗАБЕГА =====
// Кампания заканчивается после первого полного круга из пяти актов. Endless
// использует ту же актовую прогрессию, но продолжает варианты II, III, ...
const RUN = {
  campaignLevels: 25,
  maxHabits: 4,
  riskyBonusDetour: 2,
  gradeThresholds: { S:85, A:70, B:55 },
};

// Межактовые привычки намеренно двусторонние: это смена стиля текущего
// забега, а не постоянная мета-прокачка. Числа применяются через helpers в
// run.js, чтобы игровые модули не знали о структуре каталога.
const RUN_HABITS = [
  {
    key:"swift_paws", icon:"⚡", title:"ЛИХИЕ ЛАПЫ",
    benefit:"Скорость кота +10%", cost:"Срочность растёт +10%",
    effects:{ playerSpeedScale:1.10, urgeRateScale:1.10 },
  },
  {
    key:"iron_gut", icon:"🛡️", title:"ЖЕЛЕЗНЫЙ ЖИВОТ",
    benefit:"Срочность растёт −10%", cost:"Скорость кота −8%",
    effects:{ urgeRateScale:0.90, playerSpeedScale:0.92 },
  },
  {
    key:"long_combo", icon:"🎯", title:"ДЛИННАЯ СЕРИЯ",
    benefit:"Окно COMBO +1 сек", cost:"Облегчение от попадания −25%",
    effects:{ comboWindowTicks:60, hitReliefScale:0.75 },
  },
  {
    key:"bonus_nose", icon:"🐟", title:"НЮХ НА ПРИПАСЫ",
    benefit:"Временные бонусы +25%", cost:"Хозяин быстрее на 6%",
    effects:{ bonusDurationScale:1.25, ownerSpeedScale:1.06 },
  },
  {
    key:"panic_dash", icon:"😱", title:"ПАНИЧЕСКИЙ РЫВОК",
    benefit:"В панике скорость +18%", cost:"На лотке стоять +0.5 сек",
    effects:{ panicSpeedScale:1.18, poopTimeTicks:30 },
  },
  {
    key:"rapid_fire", icon:"💨", title:"ЧАСТЫЙ ОГОНЬ",
    benefit:"Перезарядка быстрее на 20%", cost:"Хозяин помнит шум +25%",
    effects:{ shootCooldownScale:0.80, heardDurationScale:1.25 },
  },
];

// ===== АВТОРСКИЕ ПРАВИЛА ЛОКАЦИЙ =====
// Все временные значения заданы в simulation ticks (60 Гц). Дача использует
// 120 BPM: один beat = 30 ticks, поэтому смены реальности всегда приходятся на
// музыкальную границу и остаются детерминированными даже при muted audio.
const LOCATION_RULES = {
  hall: {
    title:"КОВЁР ЛЮБИТ ПРЯМЫЕ",
    hint:"Держи курс — ковёр разгоняет кота",
    peakTitle:"КРАСНАЯ ДОРОЖКА",
    maxSpeedScale:1.45,
    chargeTicks:30,
  },
  bathroom: {
    title:"МОКРОЕ НЕ ПРОЩАЕТ ПОВОРОТОВ",
    hint:"Плитка скользит, коврик мгновенно тормозит",
    peakTitle:"БОЛЬШАЯ СТИРКА",
    wetFriction:0.90,
    wetControl:0.24,
    wetMaxSpeedScale:1.08,
  },
  kitchen: {
    title:"ХОЗЯИН СНАЧАЛА ЕСТ",
    hint:"Спрячься и проведи хозяина мимо блюда",
    peakTitle:"ОБЕД ИЗ ТРЁХ БЛЮД",
    smellTicks:180,
  },
  street: {
    title:"В ТРАВЕ — НЕ ШЕВЕЛИСЬ",
    hint:"Замри на четверть секунды и пропади из виду",
    peakTitle:"ТИХИЙ ЧАС",
    hideTicks:15,
    closeVision:72,
    rustleCooldown:30,
  },
  country: {
    title:"МУЗЫКА ПЛАВИТ РЕАЛЬНОСТЬ",
    hint:"На сильную долю мебель меняет состояние",
    peakTitle:"КОТСТОК '69",
    bpm:120,
    phaseTicksByStep:[480,480,360,360,240],
    telegraphTicks:60,
    transitionTicks:18,
    maxSurrealObstacles:8,
  },
  basement: {
    title:"СВЕТ — ЭТО ЕГО ВЗГЛЯД",
    hint:"Читай фонарик, слух и темноту",
    peakTitle:"ТЬМА ПОМНИТ ШУМ",
  },
};

// ===== КОНТРАКТ ЧЕСТНОСТИ ПРОЦЕДУРНЫХ УРОВНЕЙ =====
// Проверяется только при генерации, не участвует в горячем игровом цикле.
// На пике акта маршрут может быть теснее и хозяин может раньше прийти в
// точку перехвата, но генератор всё равно обязан оставить временной запас.
const LEVEL_QUALITY = {
  candidateAttempts: 3,
  basementCandidateAttempts: 3,
  minPathLengthByStep: [5, 6, 7, 8, 9],
  maxTravelBudgetRatioByStep: [0.44, 0.48, 0.53, 0.59, 0.65],
  minSpawnExitsByStep: [2, 2, 2, 1, 1],
  minLitterEntryExitsByStep: [2, 2, 1, 1, 1],
  maxOwnerInterceptAdvantageByStep: [2.5, 3.0, 3.5, 4.0, 4.5],
};

// Скорость снаряда-какашки
const POOP_SPEED = 7;
const POOP_RADIUS = 10;

// ===== ЛОКАЦИИ =====
const locationThemes = [
  {
    key:"hall", name:"Зал", icon:"🛋️",
    rule:LOCATION_RULES.hall,
    palette:{wall:"#e8d8c3",floor:"#b98f68",trim:"#8f6548",accent:"#d9bfa3",shadow:"rgba(70,40,20,0.18)",ui:"rgba(40,24,16,0.72)"},
    decorations:["window","painting","lamp"],
    obstacleTypes:["wardrobe","dresser","armchair","flowerPot"],
    decorTypes:["rug","mat"],
  },
  {
    key:"bathroom", name:"Ванная", icon:"🚿",
    rule:LOCATION_RULES.bathroom,
    palette:{wall:"#d9eef7",floor:"#9fc4d1",trim:"#5f8ea0",accent:"#f7fbfd",shadow:"rgba(30,70,90,0.18)",ui:"rgba(20,55,70,0.72)"},
    decorations:["mirror","tiles","towel"],
    obstacleTypes:["sink","toilet","laundry","cabinet"],
    decorTypes:["bathmat","tiles_decor"],
  },
  {
    key:"kitchen", name:"Кухня", icon:"🍳",
    rule:LOCATION_RULES.kitchen,
    palette:{wall:"#f4ead2",floor:"#caa56d",trim:"#8d6b3f",accent:"#fff4dc",shadow:"rgba(80,55,20,0.18)",ui:"rgba(65,45,18,0.72)"},
    decorations:["shelves","fridge","clock"],
    obstacleTypes:["table","fridge","stool","counter"],
    decorTypes:["rug","mat"],
  },
  {
    key:"street", name:"Двор", icon:"🌳",
    rule:LOCATION_RULES.street,
    palette:{wall:"#b9d8f0",floor:"#7ea35f",trim:"#4f6f3d",accent:"#dff2ff",shadow:"rgba(30,60,20,0.18)",ui:"rgba(28,52,20,0.72)"},
    decorations:["clouds","fence","sun"],
    obstacleTypes:["tree","bench","bush","crate"],
    decorTypes:["patch","stone"],
  },
  {
    key:"country", name:"Дача", icon:"🏡",
    rule:LOCATION_RULES.country,
    palette:{wall:"#efe2c8",floor:"#a97d4f",trim:"#6f4d2d",accent:"#f8f0df",shadow:"rgba(60,35,15,0.2)",ui:"rgba(55,32,14,0.72)"},
    decorations:["fireplace","window","rack"],
    obstacleTypes:["dresser","woodpile","rockingChair","barrel"],
    decorTypes:["rug","mat"],
  },
  // ===== ЗАКРЫТАЯ ЛОКАЦИЯ — появляется только с уровня 9+ =====
  {
    key:"basement", name:"Подвал", icon:"🕸️",
    rule:LOCATION_RULES.basement,
    palette:{wall:"#1e1c1a",floor:"#141210",trim:"#2e2620",accent:"#3a3028",shadow:"rgba(0,0,0,0.70)",ui:"rgba(8,5,3,0.88)"},
    decorations:["cobweb","wallpipe","bulb"],
    obstacleTypes:["fishBones","ragMouse","teddyBear","toyCar","toyPlane","juiceCan"],
    decorTypes:["stone_patch"],
  },
];

// ===== КАТАЛОГ ПРЕПЯТСТВИЙ =====
// wCells/hCells — размер в ячейках сетки (итоговый px = cells * GRID)
// color/detail — цвета для рендерера
// zone — предпочтительная зона размещения: "wall" | "corner" | "center" | "any"
const obstacleCatalog = {
  wardrobe:     {label:"Шкаф",           wCells:[2,4], hCells:[2,4], color:"#7b4f2f", detail:"#c89b6d", zone:"wall"},
  dresser:      {label:"Комод",          wCells:[2,4], hCells:[2,2], color:"#8b5e3c", detail:"#d8b07f", zone:"wall"},
  armchair:     {label:"Кресло",         wCells:[2,2], hCells:[2,2], color:"#8e5ea2", detail:"#caa7d8", zone:"corner"},
  flowerPot:    {label:"Горшок с цветами",wCells:[2,2], hCells:[2,4], color:"#5d9b55", detail:"#b86f45", zone:"wall"},
  sink:         {label:"Раковина",       wCells:[2,2], hCells:[2,2], color:"#dfe8ee", detail:"#8aa4b3", zone:"wall"},
  toilet:       {label:"Унитаз",         wCells:[2,2], hCells:[2,2], color:"#f7fbff", detail:"#9bb7c7", zone:"wall"},
  laundry:      {label:"Корзина",        wCells:[2,2], hCells:[2,2], color:"#d8c3a5", detail:"#9c7b5a", zone:"corner"},
  cabinet:      {label:"Шкафчик",        wCells:[2,2], hCells:[2,4], color:"#9bc0d0", detail:"#f5fbff", zone:"wall"},
  table:        {label:"Стол",           wCells:[4,4], hCells:[2,2], color:"#9b6b3f", detail:"#e7c28f", zone:"center"},
  fridge:       {label:"Холодильник",    wCells:[2,2], hCells:[2,4], color:"#e8f0f4", detail:"#9fb4c0", zone:"wall"},
  stool:        {label:"Табурет",        wCells:[1,2], hCells:[1,2], color:"#b07a45", detail:"#6f4a2a", zone:"any"},
  counter:      {label:"Тумба",          wCells:[4,4], hCells:[2,2], color:"#c49a6c", detail:"#7d5b3d", zone:"wall"},
  tree:         {label:"Дерево",         wCells:[2,2], hCells:[2,4], color:"#4f8f3f", detail:"#6b4423", zone:"any"},
  bench:        {label:"Лавка",          wCells:[4,4], hCells:[2,2], color:"#8b5a2b", detail:"#5f3d1f", zone:"center"},
  bush:         {label:"Куст",           wCells:[2,4], hCells:[2,2], color:"#4f9a4f", detail:"#2f6f2f", zone:"any"},
  crate:        {label:"Ящик",           wCells:[2,2], hCells:[2,2], color:"#9b6a3a", detail:"#d8b07f", zone:"corner"},
  woodpile:     {label:"Поленница",      wCells:[4,4], hCells:[2,2], color:"#8b5a2b", detail:"#d9a066", zone:"wall"},
  rockingChair: {label:"Кресло-качалка", wCells:[2,2], hCells:[2,2], color:"#7a5230", detail:"#c79a6d", zone:"corner"},
  barrel:       {label:"Бочка",          wCells:[2,2], hCells:[2,2], color:"#8b5a2b", detail:"#5f3d1f", zone:"corner"},
  // ===== ПОДВАЛ — стены лабиринта =====
  pipe:         {label:"Труба",          wCells:[1,1], hCells:[2,4], color:"#4a4a4a", detail:"#787878", zone:"wall"},
  crate_stack:  {label:"Ящики",          wCells:[2,2], hCells:[2,4], color:"#6a4e22", detail:"#9a7840", zone:"corner"},
  barrel_stack: {label:"Бочки",          wCells:[2,4], hCells:[2,2], color:"#5a3e18", detail:"#8a6028", zone:"corner"},
  chain:        {label:"Цепь",           wCells:[1,1], hCells:[2,3], color:"#606060", detail:"#404040", zone:"wall"},
  wall_h:       {label:"Стена",          wCells:[2,8], hCells:[1,1], color:"#2e2820", detail:"#4a3e30", zone:"any"},
  wall_v:       {label:"Стена",          wCells:[1,1], hCells:[2,8], color:"#2e2820", detail:"#4a3e30", zone:"any"},
  // ===== ПОДВАЛ — вмурованные предметы (декор поверх стен, без коллизий) =====
  fishBones:    {label:"Рыбьи кости",         wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#c8c0b0", zone:"wall"},
  ragMouse:     {label:"Тряпочная мышь",       wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#7a6858", zone:"wall"},
  teddyBear:    {label:"Плюшевый мишка",       wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#6b4830", zone:"corner"},
  toyCar:       {label:"Игрушечная машинка",   wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#8a2820", zone:"wall"},
  toyPlane:     {label:"Игрушечный самолётик", wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#284878", zone:"wall"},
  juiceCan:     {label:"Банка от сока",        wCells:[1,1], hCells:[1,1], color:"#1a1614", detail:"#8a5010", zone:"corner"},
};

// ===== КАТАЛОГ ДЕКОРА (фоновые элементы, без коллизий) =====
const decorCatalog = {
  rug:         {wCells:[4,6], hCells:[4,6], draw:"rug"},
  mat:         {wCells:[2,4], hCells:[2,2], draw:"mat"},
  bathmat:     {wCells:[2,2], hCells:[2,2], draw:"bathmat"},
  tiles_decor: {wCells:[4,4], hCells:[4,4], draw:"tiles_decor"},
  patch:       {wCells:[2,4], hCells:[2,4], draw:"patch"},
  stone:       {wCells:[2,2], hCells:[2,2], draw:"stone"},
  stone_patch: {wCells:[2,4], hCells:[2,4], draw:"stone_patch"},
};

// ===== ПОДВАЛ — настройки unlock =====
// Все пороги и вероятности вынесены сюда для удобной настройки.
const BASEMENT = {
  corridorMinLevel: 9,    // с какого уровня появляется corridor-подвал
  corridorProb:     0.08, // 8%; на 20+ складывается с DFS в едином броске
  dfsMinLevel:      20,   // с какого уровня появляется DFS-подвал
  dfsProb:          0.10, // 10%; суммарный шанс любой аномалии на 20+ = 18%
  // Количество вмурованных предметов в стенах лабиринта (corridor и dfs)
  wallEmbedCount:   {min: 10, max: 15},
  // Прозрачность вмурованных предметов (0=невидимо, 1=непрозрачно)
  // Значение < 1 позволяет кирпичной стене просвечивать сквозь предмет
  wallEmbedAlpha:   0.72,
};

// ===== БОНУСЫ =====
const BONUS_TYPES = {
  fish:   {emoji:"🐟", label:"Ускорение!",     color:"#4fc3f7"},
  yarn:   {emoji:"🧶", label:"Хозяин стоит!",  color:"#ce93d8"},
  pill:   {emoji:"💊", label:"-30% срочности!", color:"#a5d6a7"},
  life:   {emoji:"❤️", label:"+1 жизнь!",      color:"#ef9a9a"},
  catnip: {emoji:"🌿", label:"Хозяин ушёл!",   color:"#80cbc4"},
};
