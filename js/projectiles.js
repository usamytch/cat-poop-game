// ==========================================
// PROJECTILES — poops, shooting, homing
// ==========================================

const poops = [];
let shootCooldown = 0;
let lastDir = {x:1, y:0};

function getShotAim() {
  const cx = player.x + player.size/2;
  const cy = player.y + player.size/2;
  let dx = lastDir.x;
  let dy = lastDir.y;
  let targetX = cx + dx * POOP_SPEED;
  let targetY = cy + dy * POOP_SPEED;

  if (owner.active) {
    targetX = owner.x + owner.width/2;
    targetY = owner.y + owner.height/2;
    const toX = targetX - cx;
    const toY = targetY - cy;
    const len = Math.sqrt(toX*toX + toY*toY);
    if (len > 0) { dx = toX/len; dy = toY/len; }
  }
  return { cx, cy, dx, dy, targetX, targetY };
}

function getShotPreview() {
  const aim = getShotAim();
  const hit = owner.active
    ? firstObstacleOnSegment(aim.cx, aim.cy, aim.targetX, aim.targetY, POOP_RADIUS)
    : null;
  return { ...aim, clear: hit === null, hit };
}

function shootPoop() {
  if (!tutorialCanShoot()) return;
  if (shootCooldown > 0) return;
  const aim = getShotAim();

  poops.push({
    x: aim.cx, y: aim.cy,
    dx: aim.dx * POOP_SPEED,
    dy: aim.dy * POOP_SPEED,
    r: POOP_RADIUS, alive: true,
    trail: [],
  });
  if (shouldRecordRunStats()) {
    stats.totalPoops++;
    recordRunShot();
  }
  tutorialOnShotFired();
  shootCooldown = getRunShootCooldown(22);
  sndFart();
  // Сам выстрел больше не лечит: облегчение даёт только подтверждённое попадание.
  // Хозяин слышит точку выстрела, даже если мебель перекрыла снаряд.
  owner.onShotFired(aim.cx, aim.cy);
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
      p.alive = false; comboCount = 0; recordRunMiss(); continue;
    }

    // Попала в препятствие
    const pr = {x:p.x-p.r, y:p.y-p.r, width:p.r*2, height:p.r*2};
    if (hitsObstacles(pr)) {
      p.alive = false;
      comboCount = 0;
      recordRunMiss();
      tutorialOnShotBlocked();
      continue;
    }

    // Попала в хозяина
    if (owner.active && circleRect({x:p.x, y:p.y, r:p.r}, ownerRect())) {
      p.alive = false;
      comboCount++;
      comboTimer = getRunComboWindowTicks();
      recordRunHit();

      // Попадание снижает срочность
      player.urge = clamp(
        player.urge - DIFF[difficulty].hitUrgeReduce * getRunHitReliefScale(),
        0,
        player.maxUrge
      );

      // Добавляем какашку на лицо хозяина
      owner.poopHits++;
      owner.onPoopHit(comboCount);
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
        tutorialOnCombo();
        comboCount = 0; comboTimer = 0;
      } else {
        comboPopups.push({x:owner.x+owner.width/2, y:owner.y-20, text:"HIT! "+comboCount+"/3", timer:60, color:"#fff176"});
        sndComboHit(comboCount);
      }
      if (shouldRecordRunStats()) score += 2;
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

function drawShotPreview() {
  if (gameState !== "playing" || !owner.active || shootCooldown > 0 || yarnFreezeTimer > 0) return;
  const preview = getShotPreview();
  const color = preview.clear ? "#54e6a4" : "#ffad42";
  const rayLen = 54;
  const endX = preview.cx + preview.dx * rayLen;
  const endY = preview.cy + preview.dy * rayLen;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(preview.cx + preview.dx * 22, preview.cy + preview.dy * 22);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(preview.cx, preview.cy, player.size * 0.68, -0.55, 0.55);
  ctx.stroke();

  if (!preview.clear && preview.hit) {
    const pulse = 7 + Math.sin(_now / 140) * 1.5;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(preview.hit.x, preview.hit.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(preview.hit.x - 4, preview.hit.y - 4);
    ctx.lineTo(preview.hit.x + 4, preview.hit.y + 4);
    ctx.moveTo(preview.hit.x + 4, preview.hit.y - 4);
    ctx.lineTo(preview.hit.x - 4, preview.hit.y + 4);
    ctx.stroke();
  }
  ctx.restore();
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
