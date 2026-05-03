// ==========================================
// CONFIG — constants, themes, catalog
// ==========================================

// ===== ОПРЕДЕЛЕНИЕ УСТРОЙСТВА =====
const IS_MOBILE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Canvas init здесь — до touch.js, который регистрирует canvas.addEventListener
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 700;

const WORLD = { width: 1200, height: 700, floorHeight: 90, topPadding: 10, sidePadding: 40 };

// ===== СЕТКА УРОВНЯ =====
// Play area: x=[40..1160], y=[10..610]  →  1120 × 600 px
// GRID=40 → 28 cols × 15 rows = 420 cells
const GRID = 40;
const GRID_COLS = 28; // Math.floor(1120 / 40)
const GRID_ROWS = 15; // Math.floor(600 / 40)

const catImage = new Image(); catImage.src = "cat.png";
const masterImage = new Image(); masterImage.src = "master.png";
const lifeImage = new Image(); lifeImage.src = "favicon-32.png";

// ===== СЛОЖНОСТЬ =====
const DIFF = {
  easy:   { label:"😸 Лёгкий", urgeRate:1.0,  baseSpd:1.2, spdPerLvl:0.2,  firstLvl:3, poopTime:120, hitUrgeReduce:3.0, shootUrgeReduce:1.5 },
  normal: { label:"😼 Нормал", urgeRate:1.9,  baseSpd:1.6, spdPerLvl:0.25, firstLvl:2, poopTime:180, hitUrgeReduce:2.0, shootUrgeReduce:1.0 },
  chaos:  { label:"😈 Хаос",   urgeRate:3.0,  baseSpd:2.3, spdPerLvl:0.40, firstLvl:1, poopTime:240, hitUrgeReduce:1.5, shootUrgeReduce:0   },
};

// Скорость снаряда-какашки
const POOP_SPEED = 7;

// ===== ЛОКАЦИИ =====
const locationThemes = [
  {
    key:"hall", name:"Зал",
    palette:{wall:"#e8d8c3",floor:"#b98f68",trim:"#8f6548",accent:"#d9bfa3",shadow:"rgba(70,40,20,0.18)",ui:"rgba(40,24,16,0.72)"},
    decorations:["window","painting","lamp"],
    obstacleTypes:["wardrobe","dresser","armchair","plant"],
    decorTypes:["rug","mat"],
  },
  {
    key:"bathroom", name:"Ванная",
    palette:{wall:"#d9eef7",floor:"#9fc4d1",trim:"#5f8ea0",accent:"#f7fbfd",shadow:"rgba(30,70,90,0.18)",ui:"rgba(20,55,70,0.72)"},
    decorations:["mirror","tiles","towel"],
    obstacleTypes:["sink","toilet","laundry","cabinet"],
    decorTypes:["bathmat","tiles_decor"],
  },
  {
    key:"kitchen", name:"Кухня",
    palette:{wall:"#f4ead2",floor:"#caa56d",trim:"#8d6b3f",accent:"#fff4dc",shadow:"rgba(80,55,20,0.18)",ui:"rgba(65,45,18,0.72)"},
    decorations:["shelves","fridge","clock"],
    obstacleTypes:["table","fridge","stool","counter"],
    decorTypes:["rug","mat"],
  },
  {
    key:"street", name:"Двор",
    palette:{wall:"#b9d8f0",floor:"#7ea35f",trim:"#4f6f3d",accent:"#dff2ff",shadow:"rgba(30,60,20,0.18)",ui:"rgba(28,52,20,0.72)"},
    decorations:["clouds","fence","sun"],
    obstacleTypes:["tree","bench","bush","crate"],
    decorTypes:["patch","stone"],
  },
  {
    key:"country", name:"Загородный дом",
    palette:{wall:"#efe2c8",floor:"#a97d4f",trim:"#6f4d2d",accent:"#f8f0df",shadow:"rgba(60,35,15,0.2)",ui:"rgba(55,32,14,0.72)"},
    decorations:["fireplace","window","rack"],
    obstacleTypes:["dresser","woodpile","rockingChair","barrel"],
    decorTypes:["rug","mat"],
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
  plant:        {label:"Фикус",          wCells:[2,2], hCells:[2,4], color:"#4f8a3f", detail:"#8b5a2b", zone:"wall"},
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
};

// ===== КАТАЛОГ ДЕКОРА (фоновые элементы, без коллизий) =====
const decorCatalog = {
  rug:         {wCells:[4,6], hCells:[4,6], draw:"rug"},
  mat:         {wCells:[2,4], hCells:[2,2], draw:"mat"},
  bathmat:     {wCells:[2,2], hCells:[2,2], draw:"bathmat"},
  tiles_decor: {wCells:[4,4], hCells:[4,4], draw:"tiles_decor"},
  patch:       {wCells:[2,4], hCells:[2,4], draw:"patch"},
  stone:       {wCells:[2,2], hCells:[2,2], draw:"stone"},
};

// ===== БОНУСЫ =====
const BONUS_TYPES = {
  fish: {emoji:"🐟", label:"Ускорение!",     color:"#4fc3f7"},
  yarn: {emoji:"🧶", label:"Хозяин стоит!",  color:"#ce93d8"},
  pill: {emoji:"💊", label:"-30% срочности!", color:"#a5d6a7"},
};
