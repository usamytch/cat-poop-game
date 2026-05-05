// ==========================================
// BONUSES — pickup items, effects, timers
// ==========================================

const bonuses = [];
let speedBoostTimer = 0;
let yarnFreezeTimer = 0;
let catnipTimer = 0;  // хозяин уходит в угол и игнорирует кота

function applyBonus(type) {
  if (type === "fish") {
    speedBoostTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🐟 Ускорение!", timer:80, color:"#4fc3f7"});
  } else if (type === "yarn") {
    yarnFreezeTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🧶 Стоп хозяин!", timer:80, color:"#ce93d8"});
  } else if (type === "pill") {
    // На поздних уровнях таблетка снижает срочность сильнее:
    // уровни 1–6: -30%, уровни 7–9: -40%, уровни 10+: -50%
    const reduction = level >= 10 ? 0.5 : level >= 7 ? 0.4 : 0.3;
    player.urge = clamp(player.urge * (1 - reduction), 0, player.maxUrge);
    const pct = Math.round(reduction * 100);
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:`💊 -${pct}% срочности!`, timer:80, color:"#a5d6a7"});
  } else if (type === "life") {
    // Бонус жизни — только на уровне 5+, максимум 9 жизней
    lives = Math.min(lives + 1, 9);
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"❤️ +1 жизнь!", timer:80, color:"#ef9a9a"});
  } else if (type === "catnip") {
    // Котовник: хозяин уходит в дальний угол на 10 секунд и игнорирует кота
    catnipTimer = 600;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🌿 Хозяин ушёл!", timer:80, color:"#80cbc4"});
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
