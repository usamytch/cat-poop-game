// ==========================================
// UTILS — pure helper functions
// ==========================================

function createRng(seed) {
  let v = seed % 2147483647; if (v <= 0) v += 2147483646;
  return () => { v = (v * 16807) % 2147483647; return (v-1)/2147483646; };
}

// Stable 31-bit seed derivation for independent gameplay streams.
// Math.imul keeps the result identical in every JS engine and avoids the
// precision loss of multiplying timestamp-sized numbers as regular doubles.
function mixSeed(...parts) {
  let hash = 2166136261 >>> 0;
  for (const part of parts) {
    let value = Number(part) >>> 0;
    hash ^= value;
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= hash >>> 13;
  }
  return (hash & 0x7fffffff) || 1;
}
function randRange(rng, min, max) { return min + rng()*(max-min); }
function randInt(rng, min, max)   { return Math.floor(randRange(rng, min, max+1)); }
function clamp(v, mn, mx)         { return Math.max(mn, Math.min(mx, v)); }

function rectsOverlap(a, b, pad) {
  pad = pad || 0;
  return a.x < b.x+b.width+pad && a.x+a.width+pad > b.x &&
         a.y < b.y+b.height+pad && a.y+a.height+pad > b.y;
}

function circleRect(c, r) {
  const cx = clamp(c.x, r.x, r.x+r.width);
  const cy = clamp(c.y, r.y, r.y+r.height);
  const dx = c.x-cx, dy = c.y-cy;
  return dx*dx+dy*dy < c.r*c.r;
}

// ===== OPT 3: Кэшированный объект bounds (canvas фиксирован 1200×700) =====
// Создаётся один раз, не аллоцирует новый объект при каждом вызове.
const _playBounds = {
  left:   WORLD.sidePadding,
  top:    WORLD.topPadding,
  right:  WORLD.width  - WORLD.sidePadding,
  bottom: WORLD.height - WORLD.floorHeight,
};

function getPlayBounds() {
  return _playBounds;
}

function playerRect(x, y) {
  x = x !== undefined ? x : player.x;
  y = y !== undefined ? y : player.y;
  return { x, y, width: player.size, height: player.size };
}

function ownerRect(x, y) {
  x = x !== undefined ? x : owner.x;
  y = y !== undefined ? y : owner.y;
  return { x, y, width: owner.width, height: owner.height };
}

function hitsObstacles(rect, ignId) {
  return obstacles.some(o => o.id !== ignId && rectsOverlap(rect, o));
}

// Возвращает параметр t (0..1) первой точки пересечения отрезка с AABB.
// padding расширяет прямоугольник: для снаряда это его радиус, для зрения —
// небольшой запас, чтобы луч не "просачивался" по самому краю мебели.
function segmentRectHitT(x1, y1, x2, y2, rect, padding) {
  padding = padding || 0;
  const minX = rect.x - padding;
  const maxX = rect.x + rect.width + padding;
  const minY = rect.y - padding;
  const maxY = rect.y + rect.height + padding;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (x1 < minX || x1 > maxX) return null;
  } else {
    let tx1 = (minX - x1) / dx;
    let tx2 = (maxX - x1) / dx;
    if (tx1 > tx2) { const tmp = tx1; tx1 = tx2; tx2 = tmp; }
    tMin = Math.max(tMin, tx1);
    tMax = Math.min(tMax, tx2);
    if (tMin > tMax) return null;
  }

  if (Math.abs(dy) < 1e-9) {
    if (y1 < minY || y1 > maxY) return null;
  } else {
    let ty1 = (minY - y1) / dy;
    let ty2 = (maxY - y1) / dy;
    if (ty1 > ty2) { const tmp = ty1; ty1 = ty2; ty2 = tmp; }
    tMin = Math.max(tMin, ty1);
    tMax = Math.min(tMax, ty2);
    if (tMin > tMax) return null;
  }

  return tMin;
}

// Ближайшее препятствие на отрезке. Один и тот же helper используют зрение
// хозяина и preview выстрела, поэтому визуальная подсказка совпадает с логикой.
function firstObstacleOnSegment(x1, y1, x2, y2, padding, ignId) {
  let nearest = null;
  let nearestT = Infinity;
  for (const obstacle of obstacles) {
    if (obstacle.id === ignId) continue;
    const t = segmentRectHitT(x1, y1, x2, y2, obstacle, padding);
    if (t !== null && t < nearestT) {
      nearestT = t;
      nearest = obstacle;
    }
  }
  if (!nearest) return null;
  return {
    obstacle: nearest,
    t: nearestT,
    x: x1 + (x2 - x1) * nearestT,
    y: y1 + (y2 - y1) * nearestT,
  };
}

// Выталкивает сущность из препятствий если она внутри.
// Возвращает true если пришлось выталкивать.
function escapeObstacles(entity) {
  const b = getPlayBounds();
  const selfRect = {x: entity.x, y: entity.y, width: entity.width || entity.size, height: entity.height || entity.size};
  if (!hitsObstacles(selfRect)) return false;

  const dirs = [
    {dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
    {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1},
  ];
  const w = entity.width || entity.size;
  const h = entity.height || entity.size;
  for (let step = 2; step <= 80; step += 2) {
    for (const {dx, dy} of dirs) {
      const ex = entity.x + dx * step;
      const ey = entity.y + dy * step;
      const er = {x:ex, y:ey, width:w, height:h};
      if (!hitsObstacles(er) &&
          ex >= b.left && ey >= b.top &&
          ex + w <= b.right && ey + h <= b.bottom) {
        entity.x = ex;
        entity.y = ey;
        return true;
      }
    }
  }
  return false;
}

// Canvas helpers
function drawSprite(img, x, y, w, h, fb) {
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    fb();
  }
}

function rrect(x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ===== OPT 12: Кэш ctx.font — не переустанавливать без изменений =====
let _currentFont = '';
function setFont(f) {
  if (f !== _currentFont) { ctx.font = f; _currentFont = f; }
}
