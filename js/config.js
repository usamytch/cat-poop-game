// ==========================================
// CONFIG — constants, themes, catalog
// ==========================================

// ===== ОПРЕДЕЛЕНИЕ УСТРОЙСТВА =====
const IS_MOBILE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 700;

const WORLD = { width: 1200, height: 700, floorHeight: 90, topPadding: 70, sidePadding: 40 };

const catImage = new Image(); catImage.src = "cat.png";
const masterImage = new Image(); masterImage.src = "master.png";
const lifeImage = new Image(); lifeImage.src = "favicon-32.png";

// ===== СЛОЖНОСТЬ =====
const DIFF = {
  easy:   { label:"😸 Лёгкий", urgeRate:1.0,  baseSpd:1.2, spdPerLvl:0.2,  firstLvl:2, poopTime:120, hitUrgeReduce:1.5 },
  normal: { label:"😼 Нормал", urgeRate:1.9,  baseSpd:1.8, spdPerLvl:0.35, firstLvl:1, poopTime:180, hitUrgeReduce:1.0 },
  chaos:  { label:"😈 Хаос",   urgeRate:3.0,  baseSpd:2.8, spdPerLvl:0.55, firstLvl:1, poopTime:240, hitUrgeReduce:0.6 },
};

// Скорость снаряда-какашки
const POOP_SPEED = 7;

// ===== ЛОКАЦИИ =====
const locationThemes = [
  { key:"hall",    name:"Зал",            palette:{wall:"#e8d8c3",floor:"#b98f68",trim:"#8f6548",accent:"#d9bfa3",shadow:"rgba(70,40,20,0.18)",ui:"rgba(40,24,16,0.72)"},   decorations:["window","painting","lamp"],     obstacleTypes:["wardrobe","dresser","armchair","plant"] },
  { key:"bathroom",name:"Ванная",         palette:{wall:"#d9eef7",floor:"#9fc4d1",trim:"#5f8ea0",accent:"#f7fbfd",shadow:"rgba(30,70,90,0.18)",ui:"rgba(20,55,70,0.72)"},   decorations:["mirror","tiles","towel"],       obstacleTypes:["sink","toilet","laundry","cabinet"] },
  { key:"kitchen", name:"Кухня",          palette:{wall:"#f4ead2",floor:"#caa56d",trim:"#8d6b3f",accent:"#fff4dc",shadow:"rgba(80,55,20,0.18)",ui:"rgba(65,45,18,0.72)"},   decorations:["shelves","fridge","clock"],     obstacleTypes:["table","fridge","stool","counter"] },
  { key:"street",  name:"Двор",           palette:{wall:"#b9d8f0",floor:"#7ea35f",trim:"#4f6f3d",accent:"#dff2ff",shadow:"rgba(30,60,20,0.18)",ui:"rgba(28,52,20,0.72)"},   decorations:["clouds","fence","sun"],         obstacleTypes:["tree","bench","bush","crate"] },
  { key:"country", name:"Загородный дом", palette:{wall:"#efe2c8",floor:"#a97d4f",trim:"#6f4d2d",accent:"#f8f0df",shadow:"rgba(60,35,15,0.2)", ui:"rgba(55,32,14,0.72)"},   decorations:["fireplace","window","rack"],    obstacleTypes:["dresser","woodpile","rockingChair","barrel"] },
];

const obstacleCatalog = {
  wardrobe:     {label:"Шкаф",          minW:76, maxW:112,minH:102,maxH:145,color:"#7b4f2f",detail:"#c89b6d"},
  dresser:      {label:"Комод",         minW:76, maxW:112,minH:60, maxH:86, color:"#8b5e3c",detail:"#d8b07f"},
  armchair:     {label:"Кресло",        minW:68, maxW:94, minH:60, maxH:82, color:"#8e5ea2",detail:"#caa7d8"},
  plant:        {label:"Фикус",         minW:46, maxW:68, minH:72, maxH:102,color:"#4f8a3f",detail:"#8b5a2b"},
  sink:         {label:"Раковина",      minW:68, maxW:94, minH:68, maxH:94, color:"#dfe8ee",detail:"#8aa4b3"},
  toilet:       {label:"Унитаз",        minW:60, maxW:82, minH:76, maxH:102,color:"#f7fbff",detail:"#9bb7c7"},
  laundry:      {label:"Корзина",       minW:60, maxW:82, minH:60, maxH:82, color:"#d8c3a5",detail:"#9c7b5a"},
  cabinet:      {label:"Шкафчик",       minW:68, maxW:94, minH:86, maxH:120,color:"#9bc0d0",detail:"#f5fbff"},
  table:        {label:"Стол",          minW:94, maxW:136,minH:60, maxH:82, color:"#9b6b3f",detail:"#e7c28f"},
  fridge:       {label:"Холодильник",   minW:68, maxW:90, minH:110,maxH:152,color:"#e8f0f4",detail:"#9fb4c0"},
  stool:        {label:"Табурет",       minW:46, maxW:64, minH:46, maxH:64, color:"#b07a45",detail:"#6f4a2a"},
  counter:      {label:"Тумба",         minW:86, maxW:120,minH:64, maxH:86, color:"#c49a6c",detail:"#7d5b3d"},
  tree:         {label:"Дерево",        minW:68, maxW:102,minH:102,maxH:152,color:"#4f8f3f",detail:"#6b4423"},
  bench:        {label:"Лавка",         minW:86, maxW:120,minH:46, maxH:68, color:"#8b5a2b",detail:"#5f3d1f"},
  bush:         {label:"Куст",          minW:68, maxW:102,minH:46, maxH:72, color:"#4f9a4f",detail:"#2f6f2f"},
  crate:        {label:"Ящик",          minW:60, maxW:82, minH:60, maxH:82, color:"#9b6a3a",detail:"#d8b07f"},
  woodpile:     {label:"Поленница",     minW:86, maxW:120,minH:56, maxH:82, color:"#8b5a2b",detail:"#d9a066"},
  rockingChair: {label:"Кресло-качалка",minW:76, maxW:102,minH:76, maxH:102,color:"#7a5230",detail:"#c79a6d"},
  barrel:       {label:"Бочка",         minW:56, maxW:76, minH:72, maxH:98, color:"#8b5a2b",detail:"#5f3d1f"},
};

// ===== БОНУСЫ =====
const BONUS_TYPES = {
  fish: {emoji:"🐟", label:"Ускорение!",     color:"#4fc3f7"},
  yarn: {emoji:"🧶", label:"Хозяин стоит!",  color:"#ce93d8"},
  pill: {emoji:"💊", label:"-30% срочности!", color:"#a5d6a7"},
};
