// ==========================================
// UTILS — pure helper functions
// ==========================================

function createRng(seed) {
  let v = seed % 2147483647; if (v <= 0) v += 2147483646;
  return () => { v = (v * 16807) % 2147483647; return (v-1)/2147483646; };
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

function getPlayBounds() {
  return {
    left:   WORLD.sidePadding,
    top:    WORLD.topPadding,
    right:  canvas.width  - WORLD.sidePadding,
    bottom: canvas.height - WORLD.floorHeight,
  };
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
