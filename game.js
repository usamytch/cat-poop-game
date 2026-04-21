const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 1200;
canvas.height = 700;

const WORLD = {
  width: canvas.width,
  height: canvas.height,
  floorHeight: 90,
  topPadding: 70,
  sidePadding: 40,
};

const catImage = new Image();
catImage.src = "cat.png";

const masterImage = new Image();
masterImage.src = "master.png";

const locationThemes = [
  {
    key: "hall",
    name: "Зал",
    palette: {
      wall: "#e8d8c3",
      floor: "#b98f68",
      trim: "#8f6548",
      accent: "#d9bfa3",
      shadow: "rgba(70, 40, 20, 0.18)",
      ui: "rgba(40, 24, 16, 0.72)",
    },
    decorations: ["window", "painting", "lamp"],
    obstacleTypes: ["wardrobe", "dresser", "armchair", "plant"],
  },
  {
    key: "bathroom",
    name: "Ванная",
    palette: {
      wall: "#d9eef7",
      floor: "#9fc4d1",
      trim: "#5f8ea0",
      accent: "#f7fbfd",
      shadow: "rgba(30, 70, 90, 0.18)",
      ui: "rgba(20, 55, 70, 0.72)",
    },
    decorations: ["mirror", "tiles", "towel"],
    obstacleTypes: ["sink", "toilet", "laundry", "cabinet"],
  },
  {
    key: "kitchen",
    name: "Кухня",
    palette: {
      wall: "#f4ead2",
      floor: "#caa56d",
      trim: "#8d6b3f",
      accent: "#fff4dc",
      shadow: "rgba(80, 55, 20, 0.18)",
      ui: "rgba(65, 45, 18, 0.72)",
    },
    decorations: ["shelves", "fridge", "clock"],
    obstacleTypes: ["table", "fridge", "stool", "counter"],
  },
  {
    key: "street",
    name: "Двор",
    palette: {
      wall: "#b9d8f0",
      floor: "#7ea35f",
      trim: "#4f6f3d",
      accent: "#dff2ff",
      shadow: "rgba(30, 60, 20, 0.18)",
      ui: "rgba(28, 52, 20, 0.72)",
    },
    decorations: ["clouds", "fence", "sun"],
    obstacleTypes: ["tree", "bench", "bush", "crate"],
  },
  {
    key: "country",
    name: "Загородный дом",
    palette: {
      wall: "#efe2c8",
      floor: "#a97d4f",
      trim: "#6f4d2d",
      accent: "#f8f0df",
      shadow: "rgba(60, 35, 15, 0.2)",
      ui: "rgba(55, 32, 14, 0.72)",
    },
    decorations: ["fireplace", "window", "rack"],
    obstacleTypes: ["dresser", "woodpile", "rockingChair", "barrel"],
  },
];

const obstacleCatalog = {
  wardrobe: { label: "Шкаф", minW: 76, maxW: 112, minH: 102, maxH: 145, color: "#7b4f2f", detail: "#c89b6d" },
  dresser: { label: "Комод", minW: 76, maxW: 112, minH: 60, maxH: 86, color: "#8b5e3c", detail: "#d8b07f" },
  armchair: { label: "Кресло", minW: 68, maxW: 94, minH: 60, maxH: 82, color: "#8e5ea2", detail: "#caa7d8" },
  plant: { label: "Фикус", minW: 46, maxW: 68, minH: 72, maxH: 102, color: "#4f8a3f", detail: "#8b5a2b" },
  sink: { label: "Раковина", minW: 68, maxW: 94, minH: 68, maxH: 94, color: "#dfe8ee", detail: "#8aa4b3" },
  toilet: { label: "Унитаз", minW: 60, maxW: 82, minH: 76, maxH: 102, color: "#f7fbff", detail: "#9bb7c7" },
  laundry: { label: "Корзина", minW: 60, maxW: 82, minH: 60, maxH: 82, color: "#d8c3a5", detail: "#9c7b5a" },
  cabinet: { label: "Шкафчик", minW: 68, maxW: 94, minH: 86, maxH: 120, color: "#9bc0d0", detail: "#f5fbff" },
  table: { label: "Стол", minW: 94, maxW: 136, minH: 60, maxH: 82, color: "#9b6b3f", detail: "#e7c28f" },
  fridge: { label: "Холодильник", minW: 68, maxW: 90, minH: 110, maxH: 152, color: "#e8f0f4", detail: "#9fb4c0" },
  stool: { label: "Табурет", minW: 46, maxW: 64, minH: 46, maxH: 64, color: "#b07a45", detail: "#6f4a2a" },
  counter: { label: "Тумба", minW: 86, maxW: 120, minH: 64, maxH: 86, color: "#c49a6c", detail: "#7d5b3d" },
  tree: { label: "Дерево", minW: 68, maxW: 102, minH: 102, maxH: 152, color: "#4f8f3f", detail: "#6b4423" },
  bench: { label: "Лавка", minW: 86, maxW: 120, minH: 46, maxH: 68, color: "#8b5a2b", detail: "#5f3d1f" },
  bush: { label: "Куст", minW: 68, maxW: 102, minH: 46, maxH: 72, color: "#4f9a4f", detail: "#2f6f2f" },
  crate: { label: "Ящик", minW: 60, maxW: 82, minH: 60, maxH: 82, color: "#9b6a3a", detail: "#d8b07f" },
  woodpile: { label: "Поленница", minW: 86, maxW: 120, minH: 56, maxH: 82, color: "#8b5a2b", detail: "#d9a066" },
  rockingChair: { label: "Кресло-качалка", minW: 76, maxW: 102, minH: 76, maxH: 102, color: "#7a5230", detail: "#c79a6d" },
  barrel: { label: "Бочка", minW: 56, maxW: 76, minH: 72, maxH: 98, color: "#8b5a2b", detail: "#5f3d1f" },
};

let currentLocation = locationThemes[0];
let levelSeed = 1;
let levelMessageTimer = 180;
const obstacles = [];

// ===== Состояние игры =====
let gameState = "playing"; // "playing" | "success" | "caught" | "accident"
let score = 0;
let level = 1;

// ===== Снаряды (какашки) =====
const poops = [];
let shootCooldown = 0;
let lastDir = { x: 1, y: 0 };

function createRng(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

function randInt(rng, min, max) {
  return Math.floor(randRange(rng, min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b, padding = 0) {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}

function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function getPlayBounds() {
  return {
    left: WORLD.sidePadding,
    top: WORLD.topPadding,
    right: canvas.width - WORLD.sidePadding,
    bottom: canvas.height - WORLD.floorHeight,
  };
}

function getPlayerRect(x = player.x, y = player.y) {
  return {
    x,
    y,
    width: player.size,
    height: player.size,
  };
}

function getOwnerRect(x = owner.x, y = owner.y) {
  return {
    x,
    y,
    width: owner.width,
    height: owner.height,
  };
}

function collidesWithObstacles(rect, ignoreId = null) {
  return obstacles.some((obstacle) => obstacle.id !== ignoreId && rectsOverlap(rect, obstacle));
}

function collidesWithAnything(rect, ignoreId = null) {
  return collidesWithObstacles(rect, ignoreId) || rectsOverlap(rect, litterBox, 6);
}

function drawSprite(image, x, y, width, height, fallback) {
  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  fallback();
}

function drawRoundedRect(x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawObstacle(obstacle) {
  const { x, y, width, height, type, movingOffset = 0 } = obstacle;
  const meta = obstacleCatalog[type];
  const sway = obstacle.moving ? Math.sin(movingOffset) * 4 : 0;
  const ox = x + (obstacle.axis === "x" ? sway : 0);
  const oy = y + (obstacle.axis === "y" ? sway : 0);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = currentLocation.palette.shadow;
  ctx.fillRect(8, height - 10, width - 16, 12);

  switch (type) {
    case "wardrobe":
    case "cabinet":
    case "fridge":
      drawRoundedRect(0, 0, width, height, 10, meta.color);
      drawRoundedRect(8, 8, width - 16, height - 16, 8, meta.detail);
      ctx.fillStyle = meta.color;
      ctx.fillRect(width / 2 - 3, 12, 6, height - 24);
      ctx.fillRect(width / 2 - 12, height / 2, 5, 18);
      ctx.fillRect(width / 2 + 7, height / 2, 5, 18);
      break;
    case "dresser":
    case "counter":
      drawRoundedRect(0, 0, width, height, 10, meta.color);
      for (let i = 1; i <= 3; i++) {
        const drawerY = (height / 4) * i - 10;
        ctx.fillStyle = meta.detail;
        ctx.fillRect(10, drawerY, width - 20, 12);
        ctx.fillStyle = meta.color;
        ctx.fillRect(width / 2 - 8, drawerY + 3, 16, 6);
      }
      break;
    case "armchair":
    case "rockingChair":
      drawRoundedRect(10, 18, width - 20, height - 18, 18, meta.color);
      drawRoundedRect(0, 0, width, 34, 16, meta.detail);
      ctx.fillStyle = meta.color;
      ctx.fillRect(8, height - 18, 10, 18);
      ctx.fillRect(width - 18, height - 18, 10, 18);
      if (type === "rockingChair") {
        ctx.strokeStyle = meta.detail;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(width / 2, height - 2, width / 2 - 8, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
      break;
    case "plant":
    case "tree":
    case "bush":
      ctx.fillStyle = meta.detail;
      ctx.fillRect(width / 2 - 10, height * 0.45, 20, height * 0.55);
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.28, width * 0.28, 0, Math.PI * 2);
      ctx.arc(width * 0.32, height * 0.42, width * 0.22, 0, Math.PI * 2);
      ctx.arc(width * 0.68, height * 0.42, width * 0.22, 0, Math.PI * 2);
      ctx.fill();
      if (type === "plant") {
        ctx.fillStyle = meta.detail;
        ctx.fillRect(width / 2 - 18, height - 18, 36, 18);
      }
      break;
    case "sink":
      drawRoundedRect(10, 0, width - 20, 26, 10, meta.detail);
      drawRoundedRect(0, 18, width, height - 18, 12, meta.color);
      ctx.fillStyle = "#9bb7c7";
      ctx.fillRect(width / 2 - 4, 6, 8, 18);
      break;
    case "toilet":
      drawRoundedRect(12, 0, width - 24, 28, 10, meta.detail);
      drawRoundedRect(18, 24, width - 36, 26, 12, meta.color);
      drawRoundedRect(8, 44, width - 16, height - 44, 18, meta.detail);
      break;
    case "laundry":
    case "barrel":
      drawRoundedRect(8, 0, width - 16, height, 18, meta.color);
      ctx.strokeStyle = meta.detail;
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 12, width - 28, height - 24);
      ctx.strokeRect(14, height / 2 - 8, width - 28, 16);
      break;
    case "table":
    case "bench":
    case "woodpile":
      drawRoundedRect(0, 0, width, 20, 10, meta.detail);
      ctx.fillStyle = meta.color;
      ctx.fillRect(10, 18, 12, height - 18);
      ctx.fillRect(width - 22, 18, 12, height - 18);
      if (type === "woodpile") {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = meta.detail;
          ctx.beginPath();
          ctx.arc(24 + i * ((width - 48) / 3), height - 18, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case "stool":
    case "crate":
      drawRoundedRect(0, 0, width, height, 10, meta.color);
      ctx.strokeStyle = meta.detail;
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, width - 16, height - 16);
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(width - 8, height - 8);
      ctx.moveTo(width - 8, 8);
      ctx.lineTo(8, height - 8);
      ctx.stroke();
      break;
  }

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(8, 8, width * 0.35, 10);
  ctx.restore();
}

function drawLocationBackground() {
  const palette = currentLocation.palette;
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, canvas.height - WORLD.floorHeight, canvas.width, WORLD.floorHeight);

  ctx.fillStyle = palette.trim;
  ctx.fillRect(0, canvas.height - WORLD.floorHeight - 6, canvas.width, 6);

  if (currentLocation.decorations.includes("window")) {
    drawRoundedRect(70, 70, 170, 120, 16, "#dff4ff");
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 6;
    ctx.strokeRect(70, 70, 170, 120);
    ctx.beginPath();
    ctx.moveTo(155, 70);
    ctx.lineTo(155, 190);
    ctx.moveTo(70, 130);
    ctx.lineTo(240, 130);
    ctx.stroke();
  }

  if (currentLocation.decorations.includes("painting")) {
    drawRoundedRect(canvas.width - 260, 80, 150, 90, 12, palette.accent);
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 5;
    ctx.strokeRect(canvas.width - 260, 80, 150, 90);
    ctx.fillStyle = "rgba(120, 80, 40, 0.25)";
    ctx.beginPath();
    ctx.arc(canvas.width - 185, 125, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  if (currentLocation.decorations.includes("lamp")) {
    ctx.fillStyle = palette.trim;
    ctx.fillRect(canvas.width - 120, 70, 8, 120);
    drawRoundedRect(canvas.width - 150, 90, 70, 40, 18, palette.accent);
  }

  if (currentLocation.decorations.includes("mirror")) {
    drawRoundedRect(canvas.width - 250, 70, 120, 150, 18, "#f7fbff");
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 6;
    ctx.strokeRect(canvas.width - 250, 70, 120, 150);
  }

  if (currentLocation.decorations.includes("tiles")) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height - WORLD.floorHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height - WORLD.floorHeight; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  if (currentLocation.decorations.includes("towel")) {
    drawRoundedRect(90, 220, 90, 24, 8, "#f7c6d0");
    ctx.fillStyle = palette.trim;
    ctx.fillRect(82, 220, 8, 24);
  }

  if (currentLocation.decorations.includes("shelves")) {
    ctx.fillStyle = palette.trim;
    ctx.fillRect(70, 90, 180, 10);
    ctx.fillRect(70, 140, 180, 10);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(90, 60, 24, 30);
    ctx.fillRect(140, 110, 24, 30);
    ctx.fillRect(190, 60, 24, 30);
  }

  if (currentLocation.decorations.includes("fridge")) {
    drawRoundedRect(canvas.width - 180, 90, 90, 170, 14, "#eef5f8");
    ctx.fillStyle = "#9fb4c0";
    ctx.fillRect(canvas.width - 110, 130, 6, 40);
  }

  if (currentLocation.decorations.includes("clock")) {
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(canvas.width - 260, 90, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.trim;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  if (currentLocation.decorations.includes("clouds")) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const cloud of [{ x: 120, y: 90 }, { x: 340, y: 70 }, { x: 980, y: 110 }]) {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 24, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24, cloud.y - 10, 20, 0, Math.PI * 2);
      ctx.arc(cloud.x + 48, cloud.y, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (currentLocation.decorations.includes("fence")) {
    ctx.fillStyle = "#d8c39a";
    for (let x = 0; x < canvas.width; x += 34) {
      ctx.fillRect(x, canvas.height - WORLD.floorHeight - 70, 18, 70);
    }
    ctx.fillRect(0, canvas.height - WORLD.floorHeight - 48, canvas.width, 10);
  }

  if (currentLocation.decorations.includes("sun")) {
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(canvas.width - 120, 90, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  if (currentLocation.decorations.includes("fireplace")) {
    drawRoundedRect(canvas.width - 260, 90, 170, 150, 14, "#c79a6d");
    drawRoundedRect(canvas.width - 220, 130, 90, 80, 10, "#5a3420");
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.arc(canvas.width - 175, 185, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  if (currentLocation.decorations.includes("rack")) {
    ctx.fillStyle = palette.trim;
    ctx.fillRect(90, 80, 10, 170);
    ctx.fillRect(90, 80, 120, 10);
    ctx.fillRect(90, 160, 120, 10);
  }
}

function drawLitterBox() {
  ctx.fillStyle = "#8B6914";
  ctx.fillRect(litterBox.x, litterBox.y + 12, litterBox.width, litterBox.height - 12);
  ctx.fillStyle = "#A0522D";
  ctx.fillRect(litterBox.x - 5, litterBox.y, litterBox.width + 10, 16);
  ctx.fillStyle = "#D2B48C";
  ctx.fillRect(litterBox.x + 6, litterBox.y + 16, litterBox.width - 12, litterBox.height - 24);
  ctx.fillStyle = "#5a3a00";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("🐾 Лоток", litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height + 20);
  ctx.textAlign = "left";
}

function generateObstacle(theme, rng, index, movingAllowed) {
  const type = theme.obstacleTypes[randInt(rng, 0, theme.obstacleTypes.length - 1)];
  const meta = obstacleCatalog[type];
  const width = randInt(rng, meta.minW, meta.maxW);
  const height = randInt(rng, meta.minH, meta.maxH);
  const bounds = getPlayBounds();
  const x = randInt(rng, bounds.left + 20, bounds.right - width - 20);
  const y = randInt(rng, bounds.top + 20, bounds.bottom - height - 20);
  const moving = movingAllowed && rng() > 0.72;
  const axis = rng() > 0.5 ? "x" : "y";
  const range = moving ? randInt(rng, 30, 70) : 0;
  const speed = moving ? randRange(rng, 0.008, 0.02) : 0;

  return {
    id: `${type}-${index}-${Math.floor(rng() * 100000)}`,
    type,
    x,
    y,
    width,
    height,
    moving,
    axis,
    range,
    speed,
    phase: randRange(rng, 0, Math.PI * 2),
    movingOffset: 0,
    baseX: x,
    baseY: y,
  };
}

function placeLitterBox(rng, playerSpawn) {
  const bounds = getPlayBounds();
  const hudSafeZone = { x: 0, y: 0, width: 360, height: 220 };
  const minDistance = Math.min(420 + (level - 1) * 45, 760);
  const candidates = [
    { x: bounds.right - litterBox.width - 40, y: bounds.top + 40 },
    { x: bounds.right - litterBox.width - 60, y: bounds.bottom - litterBox.height - 40 },
    { x: canvas.width / 2 - litterBox.width / 2, y: bounds.top + 60 },
    { x: canvas.width / 2 - litterBox.width / 2, y: bounds.bottom - litterBox.height - 50 },
    { x: bounds.left + 60, y: bounds.top + 40 },
    { x: bounds.left + 60, y: bounds.bottom - litterBox.height - 40 },
  ];

  function isFarEnough(rect) {
    const litterCenterX = rect.x + rect.width / 2;
    const litterCenterY = rect.y + rect.height / 2;
    const playerCenterX = playerSpawn.x + playerSpawn.width / 2;
    const playerCenterY = playerSpawn.y + playerSpawn.height / 2;
    const dx = litterCenterX - playerCenterX;
    const dy = litterCenterY - playerCenterY;
    return Math.sqrt(dx * dx + dy * dy) >= minDistance;
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (const candidate of candidates) {
    const rect = { x: candidate.x, y: candidate.y, width: litterBox.width, height: litterBox.height };
    if (!isFarEnough(rect)) continue;
    if (rectsOverlap(rect, hudSafeZone, 12)) continue;
    if (collidesWithObstacles(rect)) continue;
    litterBox.x = candidate.x;
    litterBox.y = candidate.y;
    return;
  }

  for (let attempt = 0; attempt < 180; attempt++) {
    const rect = {
      x: randInt(rng, bounds.left + 20, bounds.right - litterBox.width - 20),
      y: randInt(rng, bounds.top + 20, bounds.bottom - litterBox.height - 20),
      width: litterBox.width,
      height: litterBox.height,
    };
    if (!isFarEnough(rect)) continue;
    if (rectsOverlap(rect, hudSafeZone, 12)) continue;
    if (collidesWithObstacles(rect)) continue;
    litterBox.x = rect.x;
    litterBox.y = rect.y;
    return;
  }

  litterBox.x = bounds.right - litterBox.width - 40;
  litterBox.y = bounds.bottom - litterBox.height - 40;
}

function generateLevel() {
  levelSeed = level * 9973 + score * 17 + 13;
  const rng = createRng(levelSeed);
  currentLocation = locationThemes[randInt(rng, 0, locationThemes.length - 1)];
  obstacles.length = 0;

  const obstacleCount = Math.min(4 + level, 12);
  const movingAllowed = level >= 5;
  const playerSpawn = { x: 90, y: canvas.height - WORLD.floorHeight - player.size - 30, width: player.size, height: player.size };

  let attempts = 0;
  while (obstacles.length < obstacleCount && attempts < obstacleCount * 40) {
    attempts++;
    const obstacle = generateObstacle(currentLocation, rng, obstacles.length, movingAllowed);
    const paddedRect = { x: obstacle.x - 24, y: obstacle.y - 24, width: obstacle.width + 48, height: obstacle.height + 48 };
    if (rectsOverlap(paddedRect, playerSpawn)) continue;
    if (rectsOverlap(paddedRect, litterBox, 18)) continue;
    if (collidesWithObstacles(paddedRect)) continue;
    obstacles.push(obstacle);
  }

  placeLitterBox(rng, playerSpawn);
  player.x = playerSpawn.x;
  player.y = playerSpawn.y;
  levelMessageTimer = 180;
}

// ===== Игрок (кот) =====
const player = {
  x: 100,
  y: 220,
  size: 48,
  speed: 3.9,
  urge: 0,
  maxUrge: 100,
  pooping: false,
  poopTimer: 0,

  draw() {
    const x = this.x;
    const y = this.y;
    const s = this.size;

    drawSprite(catImage, x - 4, y - 7, s + 12, s + 12, () => {
      ctx.fillStyle = this.pooping ? "#cc6600" : "#ff9900";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s / 2 + 6, s / 2, s / 2 - 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9900";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + 14, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    if (this.pooping) {
      ctx.fillStyle = "rgba(139,69,19,0.7)";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s + 5, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  update() {
    if (gameState !== "playing") return;

    let mx = 0;
    let my = 0;
    if (keys["ArrowUp"] || keys["w"] || keys["ц"]) my = -1;
    if (keys["ArrowDown"] || keys["s"] || keys["ы"]) my = 1;
    if (keys["ArrowLeft"] || keys["a"] || keys["ф"]) mx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["в"]) mx = 1;

    if (mx !== 0 || my !== 0) {
      const len = Math.sqrt(mx * mx + my * my);
      lastDir = { x: mx / len, y: my / len };
    }

    const bounds = getPlayBounds();
    const nextX = clamp(this.x + mx * this.speed, bounds.left, bounds.right - this.size);
    const nextY = clamp(this.y + my * this.speed, bounds.top, bounds.bottom - this.size);

    const rectX = getPlayerRect(nextX, this.y);
    if (!collidesWithObstacles(rectX)) {
      this.x = nextX;
    }

    const rectY = getPlayerRect(this.x, nextY);
    if (!collidesWithObstacles(rectY)) {
      this.y = nextY;
    }

    this.urge += 0.045 + level * 0.055;
    if (this.urge >= this.maxUrge) {
      gameState = "accident";
    }

    if (checkCollision(this, litterBox) && !this.pooping) {
      this.pooping = true;
      this.poopTimer = 90;
    }

    if (this.pooping) {
      this.poopTimer--;
      if (this.poopTimer <= 0) {
        this.pooping = false;
        this.urge = 0;
        score += 10 * level;
        level++;
        owner.activate();
        gameState = "success";
      }
    }
  },
};

// ===== Лоток =====
const litterBox = {
  x: 620,
  y: 310,
  width: 92,
  height: 62,
  update() {},
  draw() {
    drawLitterBox();
  },
};

// ===== Хозяин =====
const owner = {
  x: -120,
  y: 50,
  width: 48,
  height: 75,
  speed: 0,
  active: false,
  baseSpeed: 1.8,
  reappearTimer: 0,
  hits: 0,
  maxHits: 3,
  stunTimer: 0,
  dirtSpots: [],
  fleeing: false,
  fleeDir: 1,
  entryTimer: 0,

  activate() {
    this.x = canvas.width + 20;
    this.y = Math.random() * (canvas.height - this.height - WORLD.floorHeight - 80) + 40;
    this.fleeDir = 1;
    this.speed = this.baseSpeed + level * 0.35;
    this.active = true;
    this.reappearTimer = 0;
    this.hits = 0;
    this.stunTimer = 0;
    this.dirtSpots = [];
    this.fleeing = false;
    this.entryTimer = 120;
  },

  draw() {
    if (!this.active) return;
    const x = this.x;
    const y = this.y;

    drawSprite(masterImage, x - 5, y - 5, this.width + 10, this.height + 10, () => {
      ctx.fillStyle = this.stunTimer > 0 ? "#6a8fd8" : "#4169E1";
      ctx.fillRect(x + 12, y + 34, 48, 54);
      ctx.fillStyle = "#FFDAB9";
      ctx.beginPath();
      ctx.arc(x + 36, y + 22, 20, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(101,67,33,0.85)";
    for (const s of this.dirtSpots) {
      ctx.beginPath();
      ctx.ellipse(x + s.ox, y + s.oy, s.rx, s.ry, s.angle, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.stunTimer > 0) {
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("★★★", x + this.width / 2, y - 8);
      ctx.textAlign = "left";
    } else if (!this.fleeing) {
      ctx.fillStyle = "red";
      ctx.font = "bold 22px Arial";
      ctx.fillText("!", x + this.width / 2 - 4, y - 8);
    }

    for (let i = 0; i < this.hits; i++) {
      ctx.font = "16px Arial";
      ctx.fillText("💩", x + i * 18, y - 24);
    }
  },

  update() {
    if (gameState !== "playing") return;

    if (!this.active) {
      const interval = Math.max(60, 240 - level * 18);
      this.reappearTimer++;
      if (this.reappearTimer >= interval) {
        this.activate();
      }
      return;
    }

    if (this.stunTimer > 0) {
      this.stunTimer--;
    }

    const effectiveSpeed = this.stunTimer > 0 ? this.speed * 0.25 : this.speed;

    if (this.fleeing) {
      this.x += this.fleeDir * effectiveSpeed * 2.5;
      const offscreen = this.fleeDir > 0 ? this.x > canvas.width + 120 : this.x < -120;
      if (offscreen) {
        this.active = false;
        this.reappearTimer = 0;
      }
      return;
    }

    if (this.entryTimer > 0) {
      this.entryTimer--;
      this.x -= this.fleeDir * effectiveSpeed * 0.5;
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      const nextX = this.x + (dx / dist) * effectiveSpeed;
      const nextY = this.y + (dy / dist) * effectiveSpeed;
      const rectX = getOwnerRect(nextX, this.y);
      if (!collidesWithObstacles(rectX)) {
        this.x = nextX;
      }
      const rectY = getOwnerRect(this.x, nextY);
      if (!collidesWithObstacles(rectY)) {
        this.y = nextY;
      }
    }

    if (checkCollisionRect(this, player)) {
      gameState = "caught";
    }
  },
};

// ===== Клавиши =====
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (e.key === "Enter" && gameState !== "playing") {
    if (gameState === "success") {
      gameState = "playing";
      generateLevel();
      owner.active = false;
      owner.reappearTimer = Math.max(0, Math.max(60, 240 - level * 18) - 60);
      poops.length = 0;
      shootCooldown = 0;
    } else {
      resetGame();
    }
  }
  if (e.key === " " && gameState === "playing") {
    e.preventDefault();
    shootPoop();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// ===== Стрельба какашками =====
function shootPoop() {
  if (shootCooldown > 0) return;
  if (player.urge < 3) return;

  const speed = 9;
  let dx = lastDir.x;
  let dy = lastDir.y;
  if (owner.active && !owner.fleeing) {
    const ox = owner.x + owner.width / 2 - (player.x + player.size / 2);
    const oy = owner.y + owner.height / 2 - (player.y + player.size / 2);
    const dist = Math.sqrt(ox * ox + oy * oy);
    if (dist > 0) {
      dx = ox / dist;
      dy = oy / dist;
    }
  }

  poops.push({
    x: player.x + player.size / 2,
    y: player.y + player.size / 2,
    vx: dx * speed,
    vy: dy * speed,
    r: 8,
    alive: true,
  });
  player.urge = Math.max(0, player.urge - 8);
  shootCooldown = 20;
}

function updatePoops() {
  if (shootCooldown > 0) shootCooldown--;

  for (const p of poops) {
    if (!p.alive) continue;
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -20 || p.x > canvas.width + 20 || p.y < -20 || p.y > canvas.height + 20) {
      p.alive = false;
      continue;
    }

    if (obstacles.some((obstacle) => circleRectCollision(p, obstacle))) {
      p.alive = false;
      continue;
    }

    if (owner.active && !owner.fleeing) {
      const cx = owner.x + owner.width / 2;
      const cy = owner.y + owner.height / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < owner.width / 2 + p.r) {
        p.alive = false;
        owner.hits++;
        owner.stunTimer = 80;
        score += 5 * level;
        owner.dirtSpots.push({
          ox: 12 + Math.random() * (owner.width - 24),
          oy: 16 + Math.random() * (owner.height - 24),
          rx: 5 + Math.random() * 6,
          ry: 3 + Math.random() * 5,
          angle: Math.random() * Math.PI,
        });
        if (owner.hits >= owner.maxHits) {
          owner.fleeing = true;
          score += 20 * level;
        }
      }
    }
  }

  for (let i = poops.length - 1; i >= 0; i--) {
    if (!poops[i].alive) poops.splice(i, 1);
  }
}

function drawPoops() {
  for (const p of poops) {
    if (!p.alive) continue;
    ctx.fillStyle = "#6B3A2A";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,200,100,0.35)";
    ctx.beginPath();
    ctx.arc(p.x - 2, p.y - 2, p.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${p.r * 2}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("💩", p.x, p.y + p.r * 0.7);
    ctx.textAlign = "left";
  }
}

function updateObstacles() {
  for (const obstacle of obstacles) {
    if (!obstacle.moving || gameState !== "playing") {
      obstacle.movingOffset = obstacle.phase;
      continue;
    }

    obstacle.phase += obstacle.speed;
    const offset = Math.sin(obstacle.phase) * obstacle.range;
    const nextX = obstacle.axis === "x" ? obstacle.baseX + offset : obstacle.baseX;
    const nextY = obstacle.axis === "y" ? obstacle.baseY + offset : obstacle.baseY;
    const nextRect = { x: nextX, y: nextY, width: obstacle.width, height: obstacle.height };

    const blockedByPlayer = rectsOverlap(nextRect, getPlayerRect(), 4);
    const blockedByOwner = owner.active && rectsOverlap(nextRect, getOwnerRect(), 4);
    const blockedByLitter = rectsOverlap(nextRect, litterBox, 4);
    const blockedByObstacle = obstacles.some((other) => other.id !== obstacle.id && rectsOverlap(nextRect, other, 4));

    if (!blockedByPlayer && !blockedByOwner && !blockedByLitter && !blockedByObstacle) {
      obstacle.x = nextX;
      obstacle.y = nextY;
    }
    obstacle.movingOffset = obstacle.phase;
  }
}

// ===== Коллизии =====
function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.size > b.x &&
    a.y < b.y + b.height &&
    a.y + a.size > b.y
  );
}

function checkCollisionRect(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.width > b.x &&
    a.y < b.y + b.size &&
    a.y + a.height > b.y
  );
}

// ===== UI =====
function drawUI() {
  const panelWidth = 320;
  const panelHeight = 176;
  const panelX = 18;
  const panelY = 18;

  ctx.fillStyle = currentLocation.palette.ui;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  const urgeRatio = player.urge / player.maxUrge;
  const urgeColor = urgeRatio < 0.5 ? "#4caf50" : urgeRatio < 0.75 ? "#ff9800" : "#f44336";
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(panelX + 16, panelY + 16, 220, 24);
  ctx.fillStyle = urgeColor;
  ctx.fillRect(panelX + 16, panelY + 16, urgeRatio * 220, 24);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX + 16, panelY + 16, 220, 24);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px Arial";
  ctx.fillText("💩 Хочется", panelX + 246, panelY + 33);

  ctx.font = "bold 18px Arial";
  ctx.fillText(`Счёт: ${score}`, panelX + 16, panelY + 66);
  ctx.fillText(`Уровень: ${level}`, panelX + 16, panelY + 92);
  ctx.fillText(`Локация: ${currentLocation.name}`, panelX + 16, panelY + 118);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "13px Arial";
  ctx.fillText("Пробел — стрелять 💩", panelX + 16, panelY + 144);
  ctx.fillText("Enter — следующий уровень / рестарт", panelX + 16, panelY + 164);

  if (shootCooldown > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(panelX + 16, panelY + 172, 140, 8);
    ctx.fillStyle = "#ff9800";
    ctx.fillRect(panelX + 16, panelY + 172, (1 - shootCooldown / 25) * 140, 8);
  }

  if (levelMessageTimer > 0 && gameState === "playing") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(canvas.width / 2 - 180, 18, 360, 42);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Локация: ${currentLocation.name}`, canvas.width / 2, 46);
    ctx.textAlign = "left";
  }
}

function drawOverlay(title, subtitle, emoji) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 220, canvas.height / 2 - 110, 440, 220, 20);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${emoji} ${title}`, canvas.width / 2, canvas.height / 2 - 42);

  ctx.font = "18px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 4);

  ctx.font = "bold 15px Arial";
  ctx.fillStyle = "#888";
  ctx.fillText("Нажми Enter для продолжения", canvas.width / 2, canvas.height / 2 + 54);

  ctx.textAlign = "left";
}

// ===== Сброс =====
function resetGame() {
  score = 0;
  level = 1;
  player.urge = 0;
  player.pooping = false;
  player.poopTimer = 0;
  owner.active = false;
  owner.x = -120;
  owner.reappearTimer = 0;
  owner.hits = 0;
  owner.stunTimer = 0;
  owner.dirtSpots = [];
  owner.fleeing = false;
  owner.entryTimer = 0;
  poops.length = 0;
  shootCooldown = 0;
  generateLevel();
  gameState = "playing";
}

// ===== Игровой цикл =====
function update() {
  if (levelMessageTimer > 0 && gameState === "playing") {
    levelMessageTimer--;
  }
  updateObstacles();
  player.update();
  litterBox.update();
  owner.update();
  updatePoops();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLocationBackground();

  for (const obstacle of obstacles) {
    drawObstacle(obstacle);
  }

  litterBox.draw();
  drawPoops();
  player.draw();
  owner.draw();
  drawUI();

  if (gameState === "success") {
    drawOverlay("Молодец!", `Ура! Кот сделал дела! +${10 * (level - 1)} очков`, "✅");
  } else if (gameState === "caught") {
    drawOverlay("Поймали!", "Хозяин поймал кота! 😾", "😤");
  } else if (gameState === "accident") {
    drawOverlay("Авария!", "Кот не выдержал 😿", "💩");
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

generateLevel();
gameLoop();
