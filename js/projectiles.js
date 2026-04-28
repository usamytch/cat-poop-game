// ==========================================
// PROJECTILES — poops, shooting, homing
// ==========================================

const poops = [];
let shootCooldown = 0;
let lastDir = {x:1, y:0};

function shootPoop() {
  if (shootCooldown > 0) return;
  const cx = player.x + player.size/2;
  const cy = player.y + player.size/2;

  // Всегда целимся в хозяина если он активен (все уровни сложности).
  let dx = lastDir.x, dy = lastDir.y;
  if (owner.active) {
    const toX = (owner.x + owner.width/2)  - cx;
    const toY = (owner.y + owner.height/2) - cy;
    const len = Math.sqrt(toX*toX + toY*toY);
    if (len > 0) { dx = toX/len; dy = toY/len; }
  }

  poops.push({
    x: cx, y: cy,
    dx: dx * POOP_SPEED,
    dy: dy * POOP_SPEED,
    r: 10, alive: true,
    trail: [],
  });
  stats.totalPoops++;
  shootCooldown = 22;
  sndFart();
  // Снижаем срочность при выстреле (на лёгком и нормале)
  const shootReduce = DIFF[difficulty].shootUrgeReduce;
  if (shootReduce > 0) {
    player.urge = clamp(player.urge - shootReduce, 0, player.maxUrge);
  }
  // Хозяин реагирует на звук выстрела — немедленный пересчёт пути + знак паники
  owner.onShotFired();
}

function updatePoops() {
  const b = getPlayBounds();
  for (const p of poops) {
    if (!p.alive) continue;
    p.trail.push({x:p.x, y:p.y});
    if (p.trail.length > 6) p.trail.shift();

    p.x += p.dx; p.y += p.dy;

    // Вышла за границы
    if (p.x < b.left-20 || p.x > b.right+20 || p.y < b.top-20 || p.y > b.bottom+20) {
      p.alive = false; comboCount = 0; continue;
    }

    // Попала в препятствие
    const pr = {x:p.x-p.r, y:p.y-p.r, width:p.r*2, height:p.r*2};
    if (hitsObstacles(pr)) { p.alive = false; comboCount = 0; continue; }

    // Попала в хозяина
    if (owner.active && circleRect({x:p.x, y:p.y, r:p.r}, ownerRect())) {
      p.alive = false;
      comboCount++;
      comboTimer = 180;

      // Попадание снижает срочность
      player.urge = clamp(player.urge - DIFF[difficulty].hitUrgeReduce, 0, player.maxUrge);

      // Добавляем какашку на лицо хозяина
      owner.poopHits++;
      const faceW = owner.width * 0.7;
      const faceH = owner.height * 0.28;
      owner.facePoops.push({
        rx: (Math.random() - 0.5) * faceW,
        ry: (Math.random() - 0.5) * faceH,
        rot: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.5,
      });

      if (comboCount >= 3) {
        comboPopups.push({x:owner.x+owner.width/2, y:owner.y-20, text:"COMBO! x"+comboCount, timer:90, color:"#ff9800"});
        sndCombo();
        owner.flee();
        comboCount = 0; comboTimer = 0;
      } else {
        comboPopups.push({x:owner.x+owner.width/2, y:owner.y-20, text:"HIT! "+comboCount+"/3", timer:60, color:"#fff176"});
        sndHit();
      }
      score += 2;
    }
  }
  // OPT 8: swap-and-pop вместо splice — O(1) вместо O(n)
  for (let i = poops.length - 1; i >= 0; i--) {
    if (!poops[i].alive) {
      poops[i] = poops[poops.length - 1];
      poops.pop();
    }
  }
  // Сброс комбо по таймеру
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) comboCount = 0; }
}

function drawPoops() {
  for (const p of poops) {
    if (!p.alive) continue;

    // OPT 6: Шлейф через emoji-кэш
    for (let i=0; i<p.trail.length; i++) {
      const t = p.trail[i];
      const alpha = (i+1)/p.trail.length * 0.4;
      ctx.globalAlpha = alpha;
      drawEmoji("💩", t.x, t.y + 5, 14);
    }
    ctx.globalAlpha = 1;

    // OPT 6: Основная какашка через emoji-кэш
    drawEmoji("💩", p.x, p.y + 7, 20);
  }
  ctx.textAlign = "left";
}
