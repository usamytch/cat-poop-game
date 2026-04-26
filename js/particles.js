// ==========================================
// PARTICLES — confetti, puddle, combo popups
// ==========================================

const overlayParticles = [];
let puddleAlpha = 0;
let overlayTimer = 0;

const comboPopups = [];
let comboCount = 0;
let comboTimer = 0;

// OPT 6: Кэш emoji → offscreen canvas
// Emoji-рендеринг через fillText — самая медленная операция Canvas 2D.
// Pre-render один раз, затем drawImage (в 3–5× быстрее).
const _emojiCache = new Map();

function getEmojiCanvas(emoji, size) {
  const key = emoji + '_' + size;
  if (_emojiCache.has(key)) return _emojiCache.get(key);
  const ec = document.createElement('canvas');
  const pad = 4;
  ec.width = ec.height = size + pad * 2;
  const ectx = ec.getContext('2d');
  ectx.font = size + 'px Arial';
  ectx.textAlign = 'center';
  ectx.textBaseline = 'middle';
  ectx.fillText(emoji, (size + pad * 2) / 2, (size + pad * 2) / 2);
  _emojiCache.set(key, ec);
  return ec;
}

// Рисует emoji через кэш (быстрее fillText)
function drawEmoji(emoji, x, y, size) {
  const ec = getEmojiCanvas(emoji, size);
  const half = ec.width / 2;
  ctx.drawImage(ec, x - half, y - half);
}

function spawnConfetti(cx, cy) {
  const emojis = ["💩","⭐","✨","🎉","💫","🌟"];
  for (let i=0; i<28; i++) {
    const angle = Math.random()*Math.PI*2;
    const spd = 2 + Math.random()*5;
    overlayParticles.push({
      x:cx, y:cy,
      dx:Math.cos(angle)*spd, dy:Math.sin(angle)*spd - 2,
      gravity: 0.18,
      emoji: emojis[Math.floor(Math.random()*emojis.length)],
      alpha: 1, fade: 0.018,
      size: 16+Math.random()*14,
      rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*0.18,
      type: "confetti",
    });
  }
}

function spawnPuddle(cx, cy) {
  puddleAlpha = 0.85;
  for (let i=0; i<18; i++) {
    const angle = Math.random()*Math.PI*2;
    const spd = 1 + Math.random()*3;
    overlayParticles.push({
      x:cx, y:cy,
      dx:Math.cos(angle)*spd, dy:Math.sin(angle)*spd,
      gravity: 0.12,
      emoji: "💧",
      alpha: 1, fade: 0.022,
      size: 14+Math.random()*10,
      rot: 0, rotSpd: 0,
      type: "puddle",
    });
  }
}

function updateOverlayParticles() {
  for (const p of overlayParticles) {
    p.x += p.dx; p.y += p.dy;
    p.dy += p.gravity;
    p.alpha -= p.fade;
    p.rot += p.rotSpd;
  }
  // OPT 8: swap-and-pop вместо splice — O(1) вместо O(n)
  for (let i = overlayParticles.length - 1; i >= 0; i--) {
    if (overlayParticles[i].alpha <= 0) {
      overlayParticles[i] = overlayParticles[overlayParticles.length - 1];
      overlayParticles.pop();
    }
  }
  if (puddleAlpha > 0) puddleAlpha -= 0.008;
}

function drawOverlayParticles() {
  for (const p of overlayParticles) {
    const alpha = Math.max(0, p.alpha);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // OPT 6: используем emoji-кэш вместо fillText
    const size = Math.round(p.size);
    const ec = getEmojiCanvas(p.emoji, size);
    const half = ec.width / 2;
    ctx.drawImage(ec, -half, -half + size / 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function updateComboPopups() {
  for (const p of comboPopups) { p.timer--; p.y -= 0.7; }
  // OPT 8: swap-and-pop
  for (let i = comboPopups.length - 1; i >= 0; i--) {
    if (comboPopups[i].timer <= 0) {
      comboPopups[i] = comboPopups[comboPopups.length - 1];
      comboPopups.pop();
    }
  }
}

function drawComboPopups() {
  for (const p of comboPopups) {
    const alpha = Math.min(1, p.timer/30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = p.color || "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}
