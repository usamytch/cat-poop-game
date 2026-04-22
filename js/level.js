// ==========================================
// LEVEL — generation, litter box placement
// ==========================================

let currentLocation = locationThemes[0];
let levelSeed = 1;
let levelMessageTimer = 180;
const obstacles = [];

const litterBox = { x:620, y:310, width:92, height:62 };

function generateObstacle(theme, rng, index, movingAllowed) {
  const type = theme.obstacleTypes[randInt(rng, 0, theme.obstacleTypes.length-1)];
  const meta = obstacleCatalog[type];
  const w = randInt(rng, meta.minW, meta.maxW);
  const h = randInt(rng, meta.minH, meta.maxH);
  const b = getPlayBounds();
  const x = randInt(rng, b.left+20, b.right-w-20);
  const y = randInt(rng, b.top+20, b.bottom-h-20);
  const moving = movingAllowed && rng() > 0.72;
  const axis = rng() > 0.5 ? "x" : "y";
  const range = moving ? randInt(rng, 30, 70) : 0;
  const speed = moving ? randRange(rng, 0.008, 0.02) : 0;
  return {
    id: `${type}-${index}-${Math.floor(rng()*100000)}`,
    type, x, y, width:w, height:h,
    moving, axis, range, speed,
    phase: randRange(rng, 0, Math.PI*2),
    movingOffset: 0,
    baseX: x, baseY: y,
  };
}

function placeLitterBox(rng, spawn) {
  const b = getPlayBounds();
  const hud = {x:0, y:0, width:360, height:220};
  const minDist = Math.min(420+(level-1)*45, 760);
  const candidates = [
    {x:b.right-litterBox.width-40,  y:b.top+40},
    {x:b.right-litterBox.width-60,  y:b.bottom-litterBox.height-40},
    {x:canvas.width/2-litterBox.width/2, y:b.top+60},
    {x:canvas.width/2-litterBox.width/2, y:b.bottom-litterBox.height-50},
    {x:b.left+60, y:b.top+40},
    {x:b.left+60, y:b.bottom-litterBox.height-40},
  ];
  function farEnough(r) {
    const dx = (r.x+r.width/2)-(spawn.x+spawn.width/2);
    const dy = (r.y+r.height/2)-(spawn.y+spawn.height/2);
    return Math.sqrt(dx*dx+dy*dy) >= minDist;
  }
  for (let i=candidates.length-1; i>0; i--) {
    const j = randInt(rng, 0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const c of candidates) {
    const r = {x:c.x, y:c.y, width:litterBox.width, height:litterBox.height};
    if (!farEnough(r)) continue;
    if (rectsOverlap(r, hud, 12)) continue;
    if (hitsObstacles(r)) continue;
    litterBox.x = r.x; litterBox.y = r.y; return;
  }
  for (let att=0; att<180; att++) {
    const r = {
      x: randInt(rng, b.left+20, b.right-litterBox.width-20),
      y: randInt(rng, b.top+20, b.bottom-litterBox.height-20),
      width: litterBox.width, height: litterBox.height,
    };
    if (!farEnough(r)) continue;
    if (rectsOverlap(r, hud, 12)) continue;
    if (hitsObstacles(r)) continue;
    litterBox.x = r.x; litterBox.y = r.y; return;
  }
  litterBox.x = b.right-litterBox.width-40;
  litterBox.y = b.bottom-litterBox.height-40;
}

function generateLevel() {
  levelSeed = level*9973 + score*17 + 13;
  const rng = createRng(levelSeed);
  currentLocation = locationThemes[randInt(rng, 0, locationThemes.length-1)];
  obstacles.length = 0;
  bonuses.length = 0;

  const obstCount = Math.min(4+level, 12);
  const movingAllowed = level >= 5;
  const spawn = {x:90, y:canvas.height-WORLD.floorHeight-player.size-30, width:player.size, height:player.size};

  let att = 0;
  while (obstacles.length < obstCount && att < obstCount*40) {
    att++;
    const ob = generateObstacle(currentLocation, rng, obstacles.length, movingAllowed);
    const pr = {x:ob.x-24, y:ob.y-24, width:ob.width+48, height:ob.height+48};
    if (rectsOverlap(pr, spawn)) continue;
    if (rectsOverlap(pr, litterBox, 18)) continue;
    if (hitsObstacles(pr)) continue;
    obstacles.push(ob);
  }

  placeLitterBox(rng, spawn);
  player.x = spawn.x; player.y = spawn.y;
  levelMessageTimer = 180;

  // Спавн бонусов
  const bonusKeys = Object.keys(BONUS_TYPES);
  const bonusCount = 2 + (level > 3 ? 1 : 0);
  let batt = 0;
  while (bonuses.length < bonusCount && batt < 200) {
    batt++;
    const bx = randInt(rng, 80, canvas.width-80);
    const by = randInt(rng, WORLD.topPadding+20, canvas.height-WORLD.floorHeight-40);
    const br = {x:bx-20, y:by-20, width:40, height:40};
    if (hitsObstacles(br)) continue;
    if (rectsOverlap(br, litterBox, 20)) continue;
    if (rectsOverlap(br, spawn, 30)) continue;
    const btype = bonusKeys[randInt(rng, 0, bonusKeys.length-1)];
    bonuses.push({x:bx, y:by, type:btype, alive:true, pulse:Math.random()*Math.PI*2});
  }
}

// ===== ОБНОВЛЕНИЕ ПРЕПЯТСТВИЙ =====
function updateObstacles() {
  for (const ob of obstacles) {
    if (!ob.moving) continue;
    ob.movingOffset = Math.sin(ob.phase + performance.now()*ob.speed) * ob.range;
    if (ob.axis === "x") ob.x = ob.baseX + ob.movingOffset;
    else                  ob.y = ob.baseY + ob.movingOffset;
  }
}
