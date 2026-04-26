// ==========================================
// BONUSES — pickup items, effects, timers
// ==========================================

const bonuses = [];
let speedBoostTimer = 0;
let yarnFreezeTimer = 0;

function applyBonus(type) {
  if (type === "fish") {
    speedBoostTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🐟 Ускорение!", timer:80, color:"#4fc3f7"});
  } else if (type === "yarn") {
    yarnFreezeTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🧶 Стоп хозяин!", timer:80, color:"#ce93d8"});
  } else if (type === "pill") {
    player.urge = clamp(player.urge * 0.7, 0, player.maxUrge);
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"💊 -30% срочности!", timer:80, color:"#a5d6a7"});
  }
}

function updateBonuses() {
  for (const b of bonuses) {
    b.pulse = (b.pulse || 0) + 0.07;
  }
}

function drawBonuses() {
  for (const b of bonuses) {
    if (!b.alive) continue;
    const sc = 1 + Math.sin(b.pulse)*0.12;
    const meta = BONUS_TYPES[b.type];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sc, sc);
    // OPT 6: shadowBlur для бонусов оставляем (это визуальный эффект свечения),
    // но emoji рисуем через кэш
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 14;
    // OPT 6: используем emoji-кэш вместо fillText
    drawEmoji(meta.emoji, 0, 10, 28);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
