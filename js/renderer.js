// ==========================================
// RENDERER — all canvas drawing functions
// ==========================================

// OPT 5: Date.now() один раз за кадр
let _now = 0;

// OPT 4: Offscreen canvas для статичного слоя (фон + декор + статичные препятствия)
// Перестраивается только при generateLevel()
let _bgCanvas = null;
let _bgCtx = null;

function _ensureBgCanvas() {
  if (!_bgCanvas) {
    _bgCanvas = document.createElement('canvas');
    _bgCanvas.width  = WORLD.width;
    _bgCanvas.height = WORLD.height;
    _bgCtx = _bgCanvas.getContext('2d');
  }
}

// Вызывается из generateLevel() после смены уровня
function rebuildBgLayer() {
  _ensureBgCanvas();
  const bctx = _bgCtx;
  bctx.clearRect(0, 0, WORLD.width, WORLD.height);
  _drawBgTo(bctx);
  _drawDecorTo(bctx);
  // Рисуем только статичные препятствия
  for (const ob of obstacles) {
    if (!ob.moving) _drawObstacleTo(bctx, ob);
  }
}

// Вспомогательная rrect для произвольного контекста
function _rrectTo(bctx, x, y, w, h, r, fill) {
  bctx.fillStyle = fill;
  bctx.beginPath();
  bctx.roundRect(x, y, w, h, r);
  bctx.fill();
}

// ===== РИСОВАНИЕ ДЕКОРА (фоновые элементы, без коллизий) =====
function _drawDecorItemTo(bctx, d) {
  const {x, y, width: w, height: h, drawStyle} = d;
  const p = currentLocation.palette;
  bctx.save();
  bctx.globalAlpha = 0.38;
  switch (drawStyle) {
    case "rug": {
      bctx.fillStyle = p.accent;
      bctx.beginPath(); bctx.roundRect(x + 6, y + 6, w - 12, h - 12, 12); bctx.fill();
      bctx.strokeStyle = p.trim; bctx.lineWidth = 4;
      bctx.beginPath(); bctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8); bctx.stroke();
      bctx.strokeStyle = p.trim; bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(x + w/2, y + 14); bctx.lineTo(x + w/2, y + h - 14);
      bctx.moveTo(x + 14, y + h/2); bctx.lineTo(x + w - 14, y + h/2);
      bctx.stroke();
      break;
    }
    case "mat": {
      bctx.fillStyle = p.trim;
      bctx.beginPath(); bctx.roundRect(x + 4, y + 4, w - 8, h - 8, 8); bctx.fill();
      bctx.strokeStyle = p.accent; bctx.lineWidth = 3;
      bctx.beginPath(); bctx.roundRect(x + 8, y + 8, w - 16, h - 16, 5); bctx.stroke();
      break;
    }
    case "bathmat": {
      bctx.fillStyle = "#f0e8d8";
      bctx.beginPath(); bctx.roundRect(x + 4, y + 4, w - 8, h - 8, 10); bctx.fill();
      bctx.strokeStyle = "#c8b89a"; bctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        bctx.beginPath();
        bctx.moveTo(x + 8 + i * ((w - 16) / 3), y + 8);
        bctx.lineTo(x + 8 + i * ((w - 16) / 3), y + h - 8);
        bctx.stroke();
      }
      break;
    }
    case "tiles_decor": {
      bctx.strokeStyle = p.trim; bctx.lineWidth = 1.5;
      const tileSize = GRID / 2;
      for (let ty = y; ty < y + h; ty += tileSize) {
        for (let tx = x; tx < x + w; tx += tileSize) {
          bctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
        }
      }
      break;
    }
    case "patch": {
      bctx.fillStyle = "#8faf6f";
      bctx.beginPath(); bctx.ellipse(x + w/2, y + h/2, w/2 - 4, h/2 - 4, 0, 0, Math.PI*2); bctx.fill();
      bctx.globalAlpha = 0.6;
      bctx.fillStyle = "#6f8f4f"; bctx.font = "14px Arial"; bctx.textAlign = "center";
      bctx.fillText("🌿", x + w/2, y + h/2 + 5);
      break;
    }
    case "stone": {
      bctx.fillStyle = "#a0a0a0";
      bctx.beginPath(); bctx.ellipse(x + w/2, y + h/2, w/2 - 6, h/2 - 8, 0.3, 0, Math.PI*2); bctx.fill();
      bctx.fillStyle = "#c8c8c8";
      bctx.beginPath(); bctx.ellipse(x + w/2 - 4, y + h/2 - 4, w/4, h/4, 0.3, 0, Math.PI*2); bctx.fill();
      break;
    }
    default:
      break;
  }
  bctx.globalAlpha = 1;
  bctx.restore();
}

function _drawDecorTo(bctx) {
  for (const d of decorItems) _drawDecorItemTo(bctx, d);
}

// ===== РИСОВАНИЕ ПРЕПЯТСТВИЙ =====
function _drawObstacleTo(bctx, ob) {
  const {x, y, width:w, height:h, type} = ob;
  const meta = obstacleCatalog[type];
  const sway = ob.moving ? Math.sin(ob.movingOffset || 0)*4 : 0;
  const ox = x + (ob.axis === "x" ? sway : 0);
  const oy = y + (ob.axis === "y" ? sway : 0);
  bctx.save();
  bctx.translate(ox, oy);
  bctx.fillStyle = currentLocation.palette.shadow; bctx.fillRect(8, h-10, w-16, 12);
  switch (type) {
    case "wardrobe": case "cabinet": case "fridge":
      _rrectTo(bctx,0,0,w,h,10,meta.color); _rrectTo(bctx,8,8,w-16,h-16,8,meta.detail);
      bctx.fillStyle = meta.color; bctx.fillRect(w/2-3,12,6,h-24); bctx.fillRect(w/2-12,h/2,5,18); bctx.fillRect(w/2+7,h/2,5,18); break;
    case "dresser": case "counter":
      _rrectTo(bctx,0,0,w,h,10,meta.color);
      for (let i=1; i<=3; i++) { const dy=(h/4)*i-10; bctx.fillStyle=meta.detail; bctx.fillRect(10,dy,w-20,12); bctx.fillStyle=meta.color; bctx.fillRect(w/2-8,dy+3,16,6); } break;
    case "armchair": case "rockingChair":
      _rrectTo(bctx,10,18,w-20,h-18,18,meta.color); _rrectTo(bctx,0,0,w,34,16,meta.detail);
      bctx.fillStyle = meta.color; bctx.fillRect(8,h-18,10,18); bctx.fillRect(w-18,h-18,10,18);
      if (type === "rockingChair") { bctx.strokeStyle=meta.detail; bctx.lineWidth=4; bctx.beginPath(); bctx.arc(w/2,h-2,w/2-8,Math.PI*0.1,Math.PI*0.9); bctx.stroke(); } break;
    case "plant": case "tree": case "bush":
      bctx.fillStyle = meta.detail; bctx.fillRect(w/2-10,h*0.45,20,h*0.55);
      bctx.fillStyle = meta.color; bctx.beginPath(); bctx.arc(w/2,h*0.28,w*0.28,0,Math.PI*2); bctx.arc(w*0.32,h*0.42,w*0.22,0,Math.PI*2); bctx.arc(w*0.68,h*0.42,w*0.22,0,Math.PI*2); bctx.fill();
      if (type === "plant") { bctx.fillStyle=meta.detail; bctx.fillRect(w/2-18,h-18,36,18); } break;
    case "sink":
      _rrectTo(bctx,10,0,w-20,26,10,meta.detail); _rrectTo(bctx,0,18,w,h-18,12,meta.color);
      bctx.fillStyle = "#9bb7c7"; bctx.fillRect(w/2-4,6,8,18); break;
    case "toilet":
      _rrectTo(bctx,12,0,w-24,28,10,meta.detail); _rrectTo(bctx,18,24,w-36,26,12,meta.color); _rrectTo(bctx,8,44,w-16,h-44,18,meta.detail); break;
    case "laundry": case "barrel":
      _rrectTo(bctx,8,0,w-16,h,18,meta.color); bctx.strokeStyle=meta.detail; bctx.lineWidth=4;
      bctx.strokeRect(14,12,w-28,h-24); bctx.strokeRect(14,h/2-8,w-28,16); break;
    case "table": case "bench": case "woodpile":
      _rrectTo(bctx,0,0,w,20,10,meta.detail); bctx.fillStyle=meta.color; bctx.fillRect(10,18,12,h-18); bctx.fillRect(w-22,18,12,h-18);
      if (type === "woodpile") { for (let j=0; j<4; j++) { bctx.fillStyle=meta.detail; bctx.beginPath(); bctx.arc(24+j*((w-48)/3),h-18,12,0,Math.PI*2); bctx.fill(); } } break;
    case "stool": case "crate":
      _rrectTo(bctx,0,0,w,h,10,meta.color); bctx.strokeStyle=meta.detail; bctx.lineWidth=3;
      bctx.strokeRect(8,8,w-16,h-16); bctx.beginPath(); bctx.moveTo(8,8); bctx.lineTo(w-8,h-8); bctx.moveTo(w-8,8); bctx.lineTo(8,h-8); bctx.stroke(); break;
  }
  bctx.fillStyle = "rgba(255,255,255,0.18)"; bctx.fillRect(8,8,w*0.35,10);
  bctx.restore();
}

// Рисует движущееся препятствие на основном ctx (вызывается каждый кадр)
function drawObstacle(ob) {
  _drawObstacleTo(ctx, ob);
}

// ===== ФОН ЛОКАЦИИ =====
function _drawBgTo(bctx) {
  const p = currentLocation.palette;
  // OPT 13: используем WORLD.width/height вместо canvas.width/height
  bctx.fillStyle = p.wall; bctx.fillRect(0,0,WORLD.width,WORLD.height);
  bctx.fillStyle = p.floor; bctx.fillRect(0,WORLD.height-WORLD.floorHeight,WORLD.width,WORLD.floorHeight);
  bctx.fillStyle = p.trim; bctx.fillRect(0,WORLD.height-WORLD.floorHeight-6,WORLD.width,6);
  const dec = currentLocation.decorations;
  if (dec.includes("window"))   { _rrectTo(bctx,70,70,170,120,16,"#dff4ff"); bctx.strokeStyle=p.trim; bctx.lineWidth=6; bctx.strokeRect(70,70,170,120); bctx.beginPath(); bctx.moveTo(155,70); bctx.lineTo(155,190); bctx.moveTo(70,130); bctx.lineTo(240,130); bctx.stroke(); }
  if (dec.includes("painting")) { _rrectTo(bctx,WORLD.width-260,80,150,90,12,p.accent); bctx.strokeStyle=p.trim; bctx.lineWidth=5; bctx.strokeRect(WORLD.width-260,80,150,90); bctx.fillStyle="rgba(120,80,40,0.25)"; bctx.beginPath(); bctx.arc(WORLD.width-185,125,24,0,Math.PI*2); bctx.fill(); }
  if (dec.includes("lamp"))     { bctx.fillStyle=p.trim; bctx.fillRect(WORLD.width-120,70,8,120); _rrectTo(bctx,WORLD.width-150,90,70,40,18,p.accent); }
  if (dec.includes("mirror"))   { _rrectTo(bctx,WORLD.width-250,70,120,150,18,"#f7fbff"); bctx.strokeStyle=p.trim; bctx.lineWidth=6; bctx.strokeRect(WORLD.width-250,70,120,150); }
  if (dec.includes("tiles"))    { bctx.strokeStyle="rgba(255,255,255,0.35)"; bctx.lineWidth=1; for (let tx=0; tx<WORLD.width; tx+=60) { bctx.beginPath(); bctx.moveTo(tx,0); bctx.lineTo(tx,WORLD.height-WORLD.floorHeight); bctx.stroke(); } for (let ty=0; ty<WORLD.height-WORLD.floorHeight; ty+=60) { bctx.beginPath(); bctx.moveTo(0,ty); bctx.lineTo(WORLD.width,ty); bctx.stroke(); } }
  if (dec.includes("towel"))    { _rrectTo(bctx,90,220,90,24,8,"#f7c6d0"); bctx.fillStyle=p.trim; bctx.fillRect(82,220,8,24); }
  if (dec.includes("shelves"))  { bctx.fillStyle=p.trim; bctx.fillRect(70,90,180,10); bctx.fillRect(70,140,180,10); bctx.fillStyle=p.accent; bctx.fillRect(90,60,24,30); bctx.fillRect(140,110,24,30); bctx.fillRect(190,60,24,30); }
  if (dec.includes("fridge"))   { _rrectTo(bctx,WORLD.width-180,90,90,170,14,"#eef5f8"); bctx.fillStyle="#9fb4c0"; bctx.fillRect(WORLD.width-110,130,6,40); }
  if (dec.includes("clock"))    { bctx.fillStyle=p.accent; bctx.beginPath(); bctx.arc(WORLD.width-260,90,28,0,Math.PI*2); bctx.fill(); bctx.strokeStyle=p.trim; bctx.lineWidth=4; bctx.stroke(); }
  if (dec.includes("clouds"))   { bctx.fillStyle="rgba(255,255,255,0.8)"; [[120,90],[340,70],[980,110]].forEach(c => { bctx.beginPath(); bctx.arc(c[0],c[1],24,0,Math.PI*2); bctx.arc(c[0]+24,c[1]-10,20,0,Math.PI*2); bctx.arc(c[0]+48,c[1],24,0,Math.PI*2); bctx.fill(); }); }
  if (dec.includes("fence"))    { bctx.fillStyle="#d8c39a"; for (let fx=0; fx<WORLD.width; fx+=34) { bctx.fillRect(fx,WORLD.height-WORLD.floorHeight-70,18,70); } bctx.fillRect(0,WORLD.height-WORLD.floorHeight-48,WORLD.width,10); }
  if (dec.includes("sun"))      { bctx.fillStyle="#ffd54f"; bctx.beginPath(); bctx.arc(WORLD.width-120,90,34,0,Math.PI*2); bctx.fill(); }
  if (dec.includes("fireplace")){ _rrectTo(bctx,WORLD.width-260,90,170,150,14,"#c79a6d"); _rrectTo(bctx,WORLD.width-220,130,90,80,10,"#5a3420"); bctx.fillStyle="#ffb347"; bctx.beginPath(); bctx.arc(WORLD.width-175,185,18,0,Math.PI*2); bctx.fill(); }
  if (dec.includes("rack"))     { bctx.fillStyle=p.trim; bctx.fillRect(90,80,10,170); bctx.fillRect(90,80,120,10); bctx.fillRect(90,160,120,10); }
}

// ===== ЛОТОК =====
function drawLitterBox() {
  const urgeRatio = player.urge / player.maxUrge;
  let pulse = 0;
  if (urgeRatio > 0.75) pulse = Math.sin(_now*0.015)*4;
  const lx = litterBox.x-pulse/2, ly = litterBox.y-pulse/2;
  const lw = litterBox.width+pulse, lh = litterBox.height+pulse;
  ctx.fillStyle = "#8B6914"; ctx.fillRect(lx,ly+12,lw,lh-12);
  ctx.fillStyle = "#A0522D"; ctx.fillRect(lx-5,ly,lw+10,16);
  ctx.fillStyle = "#D2B48C"; ctx.fillRect(lx+6,ly+16,lw-12,lh-24);
  if (urgeRatio > 0.75) {
    ctx.fillStyle = `rgba(255,50,50,${0.3+Math.sin(_now*0.015)*0.2})`;
    ctx.fillRect(lx-5,ly,lw+10,lh+4);
  }
  ctx.fillStyle = "#5a3a00";
  setFont("bold 12px Arial");
  ctx.textAlign = "center";
  ctx.fillText("🐾 Лоток", litterBox.x+litterBox.width/2, litterBox.y+litterBox.height+20);

  // Прогресс-бар покакания
  if (isPooping && poopProgress > 0) {
    const poopTime = DIFF[difficulty].poopTime;
    const ratio = poopProgress / poopTime;
    const bw = lw + 10;
    const bx = lx - 5;
    const by = litterBox.y + litterBox.height + 26;
    const bh = 10;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
    const pulse2 = 0.7 + Math.sin(_now*0.02)*0.3;
    ctx.fillStyle = `rgba(139,69,19,${pulse2})`;
    ctx.beginPath(); ctx.roundRect(bx, by, bw*ratio, bh, 5); ctx.fill();
    setFont("16px Arial");
    ctx.fillText("💩", litterBox.x+litterBox.width/2, by - 2);
  }

  ctx.textAlign = "left";
}

// ===== HUD =====
function drawUI() {
  const p = currentLocation.palette;
  const urgeRatio = player.urge / player.maxUrge;
  const panic = urgeRatio > 0.75;

  const hudX=14, hudY=14, hudW=310, hudH=220;
  ctx.fillStyle = p.ui || "rgba(30,20,10,0.72)";
  ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 18); ctx.fill();

  ctx.fillStyle = "#fff";
  setFont("bold 18px Arial");
  ctx.textAlign = "left";
  ctx.fillText("Уровень "+level, hudX+18, hudY+34);
  ctx.fillStyle = "#ffd54f";
  setFont("bold 16px Arial");
  ctx.fillText("Счёт: "+score, hudX+18, hudY+58);
  ctx.fillStyle = "#b0bec5";
  setFont("14px Arial");
  ctx.fillText("Рекорд: "+stats.highScore, hudX+18, hudY+78);

  ctx.fillStyle = "#90caf9";
  setFont("13px Arial");
  ctx.fillText(DIFF[difficulty].label, hudX+18, hudY+98);

  const barX=hudX+18, barY=hudY+112, barW=hudW-36, barH=22;
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,10); ctx.fill();

  let barColor;
  if (urgeRatio < 0.5)       barColor = "#66bb6a";
  else if (urgeRatio < 0.75) barColor = "#ffa726";
  else                        barColor = panic ? `hsl(${_now*0.5%60},100%,55%)` : "#ef5350";

  const fillW = barW * urgeRatio;
  if (fillW > 0) {
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 10); ctx.fill();
  }

  if (panic) {
    ctx.strokeStyle = `rgba(255,50,50,${0.5+Math.sin(_now*0.015)*0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(barX-2, barY-2, barW+4, barH+4, 12); ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  setFont("bold 13px Arial");
  ctx.textAlign = "center";
  ctx.fillText(panic ? "😱 СРОЧНО!" : "💩 Срочность: "+Math.floor(urgeRatio*100)+"%", barX+barW/2, barY+15);

  let bx = hudX+18;
  if (speedBoostTimer > 0) {
    ctx.fillStyle = "#4fc3f7";
    setFont("13px Arial");
    ctx.textAlign = "left";
    ctx.fillText("🐟 "+Math.ceil(speedBoostTimer/60)+"с", bx, hudY+152); bx += 70;
  }
  if (yarnFreezeTimer > 0) {
    ctx.fillStyle = "#ce93d8";
    setFont("13px Arial");
    ctx.textAlign = "left";
    ctx.fillText("🧶 "+Math.ceil(yarnFreezeTimer/60)+"с", bx, hudY+152);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  setFont("12px Arial");
  ctx.textAlign = "left";
  ctx.fillText("Пробел — стрелять", hudX+18, hudY+174);
  const muteIcon = muted ? "🔇" : "🔊";
  setFont("16px Arial");
  ctx.textAlign = "right";
  ctx.fillStyle = muted ? "rgba(255,100,100,0.9)" : "rgba(255,255,255,0.7)";
  ctx.fillText(muteIcon + " M", hudX+hudW-14, hudY+174);

  const lifeIconSize = 28;
  const lifeY = hudY + 188;
  const lifeStartX = hudX + 18;
  for (let i = 0; i < 3; i++) {
    const lx = lifeStartX + i * (lifeIconSize + 6);
    if (i < lives) {
      ctx.globalAlpha = 1.0;
      if (typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0) {
        ctx.drawImage(lifeImage, lx, lifeY, lifeIconSize, lifeIconSize);
      } else {
        setFont(lifeIconSize + "px Arial"); ctx.textAlign = "left";
        ctx.fillText("🐱", lx, lifeY + lifeIconSize - 2);
      }
    } else {
      ctx.globalAlpha = 0.28;
      if (typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0) {
        ctx.drawImage(lifeImage, lx, lifeY, lifeIconSize, lifeIconSize);
      } else {
        setFont(lifeIconSize + "px Arial"); ctx.textAlign = "left";
        ctx.fillText("🐱", lx, lifeY + lifeIconSize - 2);
      }
      ctx.globalAlpha = 1.0;
    }
  }
  ctx.globalAlpha = 1.0;

  if (levelMessageTimer > 0) {
    const alpha = Math.min(1, levelMessageTimer/40);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    // OPT 13: WORLD.width вместо canvas.width
    ctx.beginPath(); ctx.roundRect(WORLD.width/2-160, 20, 320, 52, 18); ctx.fill();
    ctx.fillStyle = "#ffd54f";
    setFont("bold 26px Arial");
    ctx.textAlign = "center";
    ctx.fillText("📍 "+currentLocation.name+" — Уровень "+level, WORLD.width/2, 54);
    ctx.restore();
    levelMessageTimer--;
  }

  ctx.textAlign = "left";
}

// ===== СТАРТОВЫЙ ЭКРАН =====
function drawStartScreen() {
  // OPT 13: WORLD.width/height вместо canvas.width/height
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0,0,WORLD.width,WORLD.height);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i=0; i<60; i++) {
    const sx = (i*137.5)%WORLD.width, sy = (i*97.3)%WORLD.height;
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.save();
  ctx.textAlign = "center";
  setFont("bold 72px Arial");
  ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
  ctx.fillText("🐱 CAT POOP GAME", WORLD.width/2, 130);
  ctx.shadowBlur = 0;

  setFont("bold 26px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("Доведи кота до лотка — пока не поздно!", WORLD.width/2, 178);

  if (stats.highScore > 0) {
    setFont("bold 22px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 Рекорд: "+stats.highScore+"  |  Лучший уровень: "+stats.bestLevel, WORLD.width/2, 218);
  }

  setFont("16px Arial"); ctx.fillStyle = "#b0bec5";
  ctx.fillText("Поймано хозяином: "+stats.totalCaught+"  |  Аварий: "+stats.totalAccidents+"  |  Какашек выпущено: "+stats.totalPoops, WORLD.width/2, 248);

  setFont("bold 24px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("Выбери сложность:", WORLD.width/2, 300);

  const diffs = [
    {key:"easy",   label:"😸 Лёгкий",  desc:"Медленная срочность, хозяин со 2 уровня, наведение какашек"},
    {key:"normal", label:"😼 Нормал",   desc:"Стандартный режим, лёгкое наведение какашек"},
    {key:"chaos",  label:"😈 Хаос",     desc:"Быстрая срочность, хозяин с 1 уровня, прямой выстрел"},
  ];
  diffs.forEach((d, i) => {
    const sel = difficulty === d.key;
    const bx = WORLD.width/2-220, by = 330+i*80, bw = 440, bh = 62;
    ctx.fillStyle = sel ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.fill();
    if (sel) { ctx.strokeStyle="#ffd54f"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.stroke(); }
    setFont("bold 22px Arial"); ctx.fillStyle = sel ? "#ffd54f" : "#fff";
    ctx.fillText(d.label, WORLD.width/2, by+26);
    setFont("14px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText(d.desc, WORLD.width/2, by+48);
  });

  const t = _now*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(WORLD.width/2, 590); ctx.scale(sc, sc);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath(); ctx.roundRect(-140,-28,280,56,28); ctx.fill();
  setFont("bold 26px Arial"); ctx.fillStyle = "#1a1a2e";
  ctx.fillText("▶  ИГРАТЬ  (Enter)", 0, 10);
  ctx.restore();

  setFont("15px Arial"); ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("WASD / Стрелки — движение  |  Пробел — стрелять  |  M — " + (muted ? "🔇 выкл" : "🔊 вкл"), WORLD.width/2, 650);

  ctx.restore();
}

// ===== ОВЕРЛЕЙ КОНЦА =====
function drawOverlay() {
  if ((gameState === "accident" || (gameState === "lifeLost" && lifeLostReason === "accident")) && puddleAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = puddleAlpha * 0.55;
    ctx.fillStyle = "#8B4513";
    ctx.beginPath(); ctx.ellipse(player.x+player.size/2, player.y+player.size, 80, 30, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0,0,0,0.62)"; ctx.fillRect(0,0,WORLD.width,WORLD.height);
  drawOverlayParticles();

  ctx.save(); ctx.textAlign = "center";
  const cx = WORLD.width/2, cy = WORLD.height/2;

  if (gameState === "lifeLost") {
    const reason = lifeLostReason === "caught" ? "😾 Поймали!" : "💩 Авария!";
    setFont("bold 64px Arial");
    ctx.fillStyle = lifeLostReason === "caught" ? "#ff7043" : "#ef5350";
    ctx.shadowColor = lifeLostReason === "caught" ? "#bf360c" : "#b71c1c";
    ctx.shadowBlur = 24;
    ctx.fillText(reason, cx, cy - 70);
    ctx.shadowBlur = 0;

    setFont("bold 36px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("💔 −1 жизнь", cx, cy - 10);

    const lifeIconSize = 36;
    const totalW = 3 * lifeIconSize + 2 * 10;
    const lifeStartX = cx - totalW / 2;
    for (let i = 0; i < 3; i++) {
      const lx = lifeStartX + i * (lifeIconSize + 10);
      if (i < lives) {
        ctx.globalAlpha = 1.0;
      } else {
        ctx.globalAlpha = 0.22;
      }
      if (typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0) {
        ctx.drawImage(lifeImage, lx, cy + 20, lifeIconSize, lifeIconSize);
      } else {
        setFont(lifeIconSize + "px Arial");
        ctx.fillText("🐱", lx, cy + 20 + lifeIconSize - 2);
      }
    }
    ctx.globalAlpha = 1.0;

    const secsLeft = Math.ceil(lifeLostTimer / 60);
    setFont("20px Arial"); ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Продолжаем через " + secsLeft + "с...  (Enter — пропустить)", cx, cy + 80);

    ctx.restore();
    return;
  }

  if (gameState === "win") {
    setFont("bold 72px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
    ctx.fillText("🎉 ПОБЕДА!", cx, cy-60);
    ctx.shadowBlur = 0;
    setFont("bold 28px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Уровень "+level+" пройден!", cx, cy-10);
    setFont("22px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score, cx, cy+30);
  } else if (gameState === "accident") {
    setFont("bold 64px Arial"); ctx.fillStyle = "#ef5350";
    ctx.shadowColor = "#b71c1c"; ctx.shadowBlur = 24;
    ctx.fillText("💩 АВАРИЯ!", cx, cy-60);
    ctx.shadowBlur = 0;
    setFont("bold 26px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Кот не добежал до лотка...", cx, cy-10);
    setFont("20px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  } else if (gameState === "caught") {
    setFont("bold 64px Arial"); ctx.fillStyle = "#ff7043";
    ctx.shadowColor = "#bf360c"; ctx.shadowBlur = 24;
    ctx.fillText("😾 ПОЙМАЛИ!", cx, cy-60);
    ctx.shadowBlur = 0;
    setFont("bold 26px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Хозяин схватил кота!", cx, cy-10);
    setFont("20px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  }

  if (score >= stats.highScore && score > 0) {
    setFont("bold 22px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 НОВЫЙ РЕКОРД!", cx, cy+70);
  }

  const t = _now*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(cx, cy+120); ctx.scale(sc, sc);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath(); ctx.roundRect(-130,-26,260,52,26); ctx.fill();
  setFont("bold 22px Arial"); ctx.fillStyle = "#1a1a2e";
  ctx.fillText("↩  В меню  (Enter)", 0, 8);
  ctx.restore();

  ctx.restore();
}

// ===== ГЛАВНАЯ ФУНКЦИЯ РИСОВАНИЯ =====
function draw() {
  // OPT 5: Date.now() один раз за кадр
  _now = Date.now();

  ctx.clearRect(0,0,WORLD.width,WORLD.height);

  if (gameState === "start") {
    drawStartScreen();
    if (IS_MOBILE) drawTouchControls();
    return;
  }

  // OPT 4: Рисуем статичный слой одним drawImage
  if (_bgCanvas) {
    ctx.drawImage(_bgCanvas, 0, 0);
  } else {
    // Fallback если bgCanvas ещё не создан (первый кадр до generateLevel)
    _drawBgTo(ctx);
    _drawDecorTo(ctx);
    for (const ob of obstacles) {
      if (!ob.moving) _drawObstacleTo(ctx, ob);
    }
  }

  drawLitterBox();

  // Рисуем только движущиеся препятствия поверх статичного слоя
  for (const ob of obstacles) {
    if (ob.moving) drawObstacle(ob);
  }

  drawBonuses();
  drawPoops();
  owner.draw();
  player.draw();
  drawOverlayParticles();
  drawComboPopups();
  drawUI();

  if (gameState !== "playing" && gameState !== "start") drawOverlay();
  if (IS_MOBILE) drawTouchControls();
}
