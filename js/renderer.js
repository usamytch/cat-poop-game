// ==========================================
// RENDERER — all canvas drawing functions
// ==========================================

// ===== РИСОВАНИЕ ДЕКОРА (фоновые элементы, без коллизий) =====
function drawDecorItem(d) {
  const {x, y, width: w, height: h, drawStyle} = d;
  const p = currentLocation.palette;
  ctx.save();
  ctx.globalAlpha = 0.38;
  switch (drawStyle) {
    case "rug": {
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 12); ctx.fill();
      ctx.strokeStyle = p.trim; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8); ctx.stroke();
      ctx.strokeStyle = p.trim; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w/2, y + 14); ctx.lineTo(x + w/2, y + h - 14);
      ctx.moveTo(x + 14, y + h/2); ctx.lineTo(x + w - 14, y + h/2);
      ctx.stroke();
      break;
    }
    case "mat": {
      ctx.fillStyle = p.trim;
      ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 8); ctx.fill();
      ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x + 8, y + 8, w - 16, h - 16, 5); ctx.stroke();
      break;
    }
    case "bathmat": {
      ctx.fillStyle = "#f0e8d8";
      ctx.beginPath(); ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 10); ctx.fill();
      ctx.strokeStyle = "#c8b89a"; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 8 + i * ((w - 16) / 3), y + 8);
        ctx.lineTo(x + 8 + i * ((w - 16) / 3), y + h - 8);
        ctx.stroke();
      }
      break;
    }
    case "tiles_decor": {
      ctx.strokeStyle = p.trim; ctx.lineWidth = 1.5;
      const tileSize = GRID / 2;
      for (let ty = y; ty < y + h; ty += tileSize) {
        for (let tx = x; tx < x + w; tx += tileSize) {
          ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
        }
      }
      break;
    }
    case "patch": {
      ctx.fillStyle = "#8faf6f";
      ctx.beginPath(); ctx.ellipse(x + w/2, y + h/2, w/2 - 4, h/2 - 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#6f8f4f"; ctx.font = "14px Arial"; ctx.textAlign = "center";
      ctx.fillText("🌿", x + w/2, y + h/2 + 5);
      break;
    }
    case "stone": {
      ctx.fillStyle = "#a0a0a0";
      ctx.beginPath(); ctx.ellipse(x + w/2, y + h/2, w/2 - 6, h/2 - 8, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#c8c8c8";
      ctx.beginPath(); ctx.ellipse(x + w/2 - 4, y + h/2 - 4, w/4, h/4, 0.3, 0, Math.PI*2); ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDecor() {
  for (const d of decorItems) drawDecorItem(d);
}

// ===== РИСОВАНИЕ ПРЕПЯТСТВИЙ =====
function drawObstacle(ob) {
  const {x, y, width:w, height:h, type} = ob;
  const meta = obstacleCatalog[type];
  const sway = ob.moving ? Math.sin(ob.movingOffset || 0)*4 : 0;
  const ox = x + (ob.axis === "x" ? sway : 0);
  const oy = y + (ob.axis === "y" ? sway : 0);
  ctx.save(); ctx.translate(ox, oy);
  ctx.fillStyle = currentLocation.palette.shadow; ctx.fillRect(8, h-10, w-16, 12);
  switch (type) {
    case "wardrobe": case "cabinet": case "fridge":
      rrect(0,0,w,h,10,meta.color); rrect(8,8,w-16,h-16,8,meta.detail);
      ctx.fillStyle = meta.color; ctx.fillRect(w/2-3,12,6,h-24); ctx.fillRect(w/2-12,h/2,5,18); ctx.fillRect(w/2+7,h/2,5,18); break;
    case "dresser": case "counter":
      rrect(0,0,w,h,10,meta.color);
      for (let i=1; i<=3; i++) { const dy=(h/4)*i-10; ctx.fillStyle=meta.detail; ctx.fillRect(10,dy,w-20,12); ctx.fillStyle=meta.color; ctx.fillRect(w/2-8,dy+3,16,6); } break;
    case "armchair": case "rockingChair":
      rrect(10,18,w-20,h-18,18,meta.color); rrect(0,0,w,34,16,meta.detail);
      ctx.fillStyle = meta.color; ctx.fillRect(8,h-18,10,18); ctx.fillRect(w-18,h-18,10,18);
      if (type === "rockingChair") { ctx.strokeStyle=meta.detail; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(w/2,h-2,w/2-8,Math.PI*0.1,Math.PI*0.9); ctx.stroke(); } break;
    case "plant": case "tree": case "bush":
      ctx.fillStyle = meta.detail; ctx.fillRect(w/2-10,h*0.45,20,h*0.55);
      ctx.fillStyle = meta.color; ctx.beginPath(); ctx.arc(w/2,h*0.28,w*0.28,0,Math.PI*2); ctx.arc(w*0.32,h*0.42,w*0.22,0,Math.PI*2); ctx.arc(w*0.68,h*0.42,w*0.22,0,Math.PI*2); ctx.fill();
      if (type === "plant") { ctx.fillStyle=meta.detail; ctx.fillRect(w/2-18,h-18,36,18); } break;
    case "sink":
      rrect(10,0,w-20,26,10,meta.detail); rrect(0,18,w,h-18,12,meta.color);
      ctx.fillStyle = "#9bb7c7"; ctx.fillRect(w/2-4,6,8,18); break;
    case "toilet":
      rrect(12,0,w-24,28,10,meta.detail); rrect(18,24,w-36,26,12,meta.color); rrect(8,44,w-16,h-44,18,meta.detail); break;
    case "laundry": case "barrel":
      rrect(8,0,w-16,h,18,meta.color); ctx.strokeStyle=meta.detail; ctx.lineWidth=4;
      ctx.strokeRect(14,12,w-28,h-24); ctx.strokeRect(14,h/2-8,w-28,16); break;
    case "table": case "bench": case "woodpile":
      rrect(0,0,w,20,10,meta.detail); ctx.fillStyle=meta.color; ctx.fillRect(10,18,12,h-18); ctx.fillRect(w-22,18,12,h-18);
      if (type === "woodpile") { for (let j=0; j<4; j++) { ctx.fillStyle=meta.detail; ctx.beginPath(); ctx.arc(24+j*((w-48)/3),h-18,12,0,Math.PI*2); ctx.fill(); } } break;
    case "stool": case "crate":
      rrect(0,0,w,h,10,meta.color); ctx.strokeStyle=meta.detail; ctx.lineWidth=3;
      ctx.strokeRect(8,8,w-16,h-16); ctx.beginPath(); ctx.moveTo(8,8); ctx.lineTo(w-8,h-8); ctx.moveTo(w-8,8); ctx.lineTo(8,h-8); ctx.stroke(); break;
  }
  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(8,8,w*0.35,10);
  ctx.restore();
}

// ===== ФОН ЛОКАЦИИ =====
function drawBg() {
  const p = currentLocation.palette;
  ctx.fillStyle = p.wall; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = p.floor; ctx.fillRect(0,canvas.height-WORLD.floorHeight,canvas.width,WORLD.floorHeight);
  ctx.fillStyle = p.trim; ctx.fillRect(0,canvas.height-WORLD.floorHeight-6,canvas.width,6);
  const dec = currentLocation.decorations;
  if (dec.includes("window"))   { rrect(70,70,170,120,16,"#dff4ff"); ctx.strokeStyle=p.trim; ctx.lineWidth=6; ctx.strokeRect(70,70,170,120); ctx.beginPath(); ctx.moveTo(155,70); ctx.lineTo(155,190); ctx.moveTo(70,130); ctx.lineTo(240,130); ctx.stroke(); }
  if (dec.includes("painting")) { rrect(canvas.width-260,80,150,90,12,p.accent); ctx.strokeStyle=p.trim; ctx.lineWidth=5; ctx.strokeRect(canvas.width-260,80,150,90); ctx.fillStyle="rgba(120,80,40,0.25)"; ctx.beginPath(); ctx.arc(canvas.width-185,125,24,0,Math.PI*2); ctx.fill(); }
  if (dec.includes("lamp"))     { ctx.fillStyle=p.trim; ctx.fillRect(canvas.width-120,70,8,120); rrect(canvas.width-150,90,70,40,18,p.accent); }
  if (dec.includes("mirror"))   { rrect(canvas.width-250,70,120,150,18,"#f7fbff"); ctx.strokeStyle=p.trim; ctx.lineWidth=6; ctx.strokeRect(canvas.width-250,70,120,150); }
  if (dec.includes("tiles"))    { ctx.strokeStyle="rgba(255,255,255,0.35)"; ctx.lineWidth=1; for (let tx=0; tx<canvas.width; tx+=60) { ctx.beginPath(); ctx.moveTo(tx,0); ctx.lineTo(tx,canvas.height-WORLD.floorHeight); ctx.stroke(); } for (let ty=0; ty<canvas.height-WORLD.floorHeight; ty+=60) { ctx.beginPath(); ctx.moveTo(0,ty); ctx.lineTo(canvas.width,ty); ctx.stroke(); } }
  if (dec.includes("towel"))    { rrect(90,220,90,24,8,"#f7c6d0"); ctx.fillStyle=p.trim; ctx.fillRect(82,220,8,24); }
  if (dec.includes("shelves"))  { ctx.fillStyle=p.trim; ctx.fillRect(70,90,180,10); ctx.fillRect(70,140,180,10); ctx.fillStyle=p.accent; ctx.fillRect(90,60,24,30); ctx.fillRect(140,110,24,30); ctx.fillRect(190,60,24,30); }
  if (dec.includes("fridge"))   { rrect(canvas.width-180,90,90,170,14,"#eef5f8"); ctx.fillStyle="#9fb4c0"; ctx.fillRect(canvas.width-110,130,6,40); }
  if (dec.includes("clock"))    { ctx.fillStyle=p.accent; ctx.beginPath(); ctx.arc(canvas.width-260,90,28,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=p.trim; ctx.lineWidth=4; ctx.stroke(); }
  if (dec.includes("clouds"))   { ctx.fillStyle="rgba(255,255,255,0.8)"; [[120,90],[340,70],[980,110]].forEach(c => { ctx.beginPath(); ctx.arc(c[0],c[1],24,0,Math.PI*2); ctx.arc(c[0]+24,c[1]-10,20,0,Math.PI*2); ctx.arc(c[0]+48,c[1],24,0,Math.PI*2); ctx.fill(); }); }
  if (dec.includes("fence"))    { ctx.fillStyle="#d8c39a"; for (let fx=0; fx<canvas.width; fx+=34) { ctx.fillRect(fx,canvas.height-WORLD.floorHeight-70,18,70); } ctx.fillRect(0,canvas.height-WORLD.floorHeight-48,canvas.width,10); }
  if (dec.includes("sun"))      { ctx.fillStyle="#ffd54f"; ctx.beginPath(); ctx.arc(canvas.width-120,90,34,0,Math.PI*2); ctx.fill(); }
  if (dec.includes("fireplace")){ rrect(canvas.width-260,90,170,150,14,"#c79a6d"); rrect(canvas.width-220,130,90,80,10,"#5a3420"); ctx.fillStyle="#ffb347"; ctx.beginPath(); ctx.arc(canvas.width-175,185,18,0,Math.PI*2); ctx.fill(); }
  if (dec.includes("rack"))     { ctx.fillStyle=p.trim; ctx.fillRect(90,80,10,170); ctx.fillRect(90,80,120,10); ctx.fillRect(90,160,120,10); }
}

// ===== ЛОТОК =====
function drawLitterBox() {
  const urgeRatio = player.urge / player.maxUrge;
  let pulse = 0;
  if (urgeRatio > 0.75) pulse = Math.sin(Date.now()*0.015)*4;
  const lx = litterBox.x-pulse/2, ly = litterBox.y-pulse/2;
  const lw = litterBox.width+pulse, lh = litterBox.height+pulse;
  ctx.fillStyle = "#8B6914"; ctx.fillRect(lx,ly+12,lw,lh-12);
  ctx.fillStyle = "#A0522D"; ctx.fillRect(lx-5,ly,lw+10,16);
  ctx.fillStyle = "#D2B48C"; ctx.fillRect(lx+6,ly+16,lw-12,lh-24);
  if (urgeRatio > 0.75) {
    ctx.fillStyle = `rgba(255,50,50,${0.3+Math.sin(Date.now()*0.015)*0.2})`;
    ctx.fillRect(lx-5,ly,lw+10,lh+4);
  }
  ctx.fillStyle = "#5a3a00"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
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
    const pulse2 = 0.7 + Math.sin(Date.now()*0.02)*0.3;
    ctx.fillStyle = `rgba(139,69,19,${pulse2})`;
    ctx.beginPath(); ctx.roundRect(bx, by, bw*ratio, bh, 5); ctx.fill();
    ctx.font = "16px Arial";
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

  ctx.fillStyle = "#fff"; ctx.font = "bold 18px Arial"; ctx.textAlign = "left";
  ctx.fillText("Уровень "+level, hudX+18, hudY+34);
  ctx.fillStyle = "#ffd54f"; ctx.font = "bold 16px Arial";
  ctx.fillText("Счёт: "+score, hudX+18, hudY+58);
  ctx.fillStyle = "#b0bec5"; ctx.font = "14px Arial";
  ctx.fillText("Рекорд: "+stats.highScore, hudX+18, hudY+78);

  ctx.fillStyle = "#90caf9"; ctx.font = "13px Arial";
  ctx.fillText(DIFF[difficulty].label, hudX+18, hudY+98);

  const barX=hudX+18, barY=hudY+112, barW=hudW-36, barH=22;
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,10); ctx.fill();

  let barColor;
  if (urgeRatio < 0.5)       barColor = "#66bb6a";
  else if (urgeRatio < 0.75) barColor = "#ffa726";
  else                        barColor = panic ? `hsl(${Date.now()*0.5%60},100%,55%)` : "#ef5350";

  const fillW = barW * urgeRatio;
  if (fillW > 0) {
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 10); ctx.fill();
  }

  if (panic) {
    ctx.strokeStyle = `rgba(255,50,50,${0.5+Math.sin(Date.now()*0.015)*0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(barX-2, barY-2, barW+4, barH+4, 12); ctx.stroke();
  }

  ctx.fillStyle = "#fff"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
  ctx.fillText(panic ? "😱 СРОЧНО!" : "💩 Срочность: "+Math.floor(urgeRatio*100)+"%", barX+barW/2, barY+15);

  let bx = hudX+18;
  if (speedBoostTimer > 0) {
    ctx.fillStyle = "#4fc3f7"; ctx.font = "13px Arial"; ctx.textAlign = "left";
    ctx.fillText("🐟 "+Math.ceil(speedBoostTimer/60)+"с", bx, hudY+152); bx += 70;
  }
  if (yarnFreezeTimer > 0) {
    ctx.fillStyle = "#ce93d8"; ctx.font = "13px Arial"; ctx.textAlign = "left";
    ctx.fillText("🧶 "+Math.ceil(yarnFreezeTimer/60)+"с", bx, hudY+152);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "12px Arial"; ctx.textAlign = "left";
  ctx.fillText("Пробел — стрелять", hudX+18, hudY+174);
  const muteIcon = muted ? "🔇" : "🔊";
  ctx.font = "16px Arial"; ctx.textAlign = "right";
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
        ctx.font = lifeIconSize + "px Arial"; ctx.textAlign = "left";
        ctx.fillText("🐱", lx, lifeY + lifeIconSize - 2);
      }
    } else {
      ctx.globalAlpha = 0.28;
      if (typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0) {
        ctx.drawImage(lifeImage, lx, lifeY, lifeIconSize, lifeIconSize);
      } else {
        ctx.font = lifeIconSize + "px Arial"; ctx.textAlign = "left";
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
    ctx.beginPath(); ctx.roundRect(canvas.width/2-160, 20, 320, 52, 18); ctx.fill();
    ctx.fillStyle = "#ffd54f"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
    ctx.fillText("📍 "+currentLocation.name+" — Уровень "+level, canvas.width/2, 54);
    ctx.restore();
    levelMessageTimer--;
  }

  ctx.textAlign = "left";
}

// ===== СТАРТОВЫЙ ЭКРАН =====
function drawStartScreen() {
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i=0; i<60; i++) {
    const sx = (i*137.5)%canvas.width, sy = (i*97.3)%canvas.height;
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 72px Arial";
  ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
  ctx.fillText("🐱 CAT POOP GAME", canvas.width/2, 130);
  ctx.shadowBlur = 0;

  ctx.font = "bold 26px Arial"; ctx.fillStyle = "#fff";
  ctx.fillText("Доведи кота до лотка — пока не поздно!", canvas.width/2, 178);

  if (stats.highScore > 0) {
    ctx.font = "bold 22px Arial"; ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 Рекорд: "+stats.highScore+"  |  Лучший уровень: "+stats.bestLevel, canvas.width/2, 218);
  }

  ctx.font = "16px Arial"; ctx.fillStyle = "#b0bec5";
  ctx.fillText("Поймано хозяином: "+stats.totalCaught+"  |  Аварий: "+stats.totalAccidents+"  |  Какашек выпущено: "+stats.totalPoops, canvas.width/2, 248);

  ctx.font = "bold 24px Arial"; ctx.fillStyle = "#fff";
  ctx.fillText("Выбери сложность:", canvas.width/2, 300);

  const diffs = [
    {key:"easy",   label:"😸 Лёгкий",  desc:"Медленная срочность, хозяин со 2 уровня, наведение какашек"},
    {key:"normal", label:"😼 Нормал",   desc:"Стандартный режим, лёгкое наведение какашек"},
    {key:"chaos",  label:"😈 Хаос",     desc:"Быстрая срочность, хозяин с 1 уровня, прямой выстрел"},
  ];
  diffs.forEach((d, i) => {
    const sel = difficulty === d.key;
    const bx = canvas.width/2-220, by = 330+i*80, bw = 440, bh = 62;
    ctx.fillStyle = sel ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.fill();
    if (sel) { ctx.strokeStyle="#ffd54f"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.stroke(); }
    ctx.font = "bold 22px Arial"; ctx.fillStyle = sel ? "#ffd54f" : "#fff";
    ctx.fillText(d.label, canvas.width/2, by+26);
    ctx.font = "14px Arial"; ctx.fillStyle = "#b0bec5";
    ctx.fillText(d.desc, canvas.width/2, by+48);
  });

  const t = Date.now()*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(canvas.width/2, 590); ctx.scale(sc, sc);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath(); ctx.roundRect(-140,-28,280,56,28); ctx.fill();
  ctx.font = "bold 26px Arial"; ctx.fillStyle = "#1a1a2e";
  ctx.fillText("▶  ИГРАТЬ  (Enter)", 0, 10);
  ctx.restore();

  ctx.font = "15px Arial"; ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("WASD / Стрелки — движение  |  Пробел — стрелять  |  M — " + (muted ? "🔇 выкл" : "🔊 вкл"), canvas.width/2, 650);

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

  ctx.fillStyle = "rgba(0,0,0,0.62)"; ctx.fillRect(0,0,canvas.width,canvas.height);
  drawOverlayParticles();

  ctx.save(); ctx.textAlign = "center";
  const cx = canvas.width/2, cy = canvas.height/2;

  if (gameState === "lifeLost") {
    const reason = lifeLostReason === "caught" ? "😾 Поймали!" : "💩 Авария!";
    ctx.font = "bold 64px Arial";
    ctx.fillStyle = lifeLostReason === "caught" ? "#ff7043" : "#ef5350";
    ctx.shadowColor = lifeLostReason === "caught" ? "#bf360c" : "#b71c1c";
    ctx.shadowBlur = 24;
    ctx.fillText(reason, cx, cy - 70);
    ctx.shadowBlur = 0;

    ctx.font = "bold 36px Arial"; ctx.fillStyle = "#fff";
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
        ctx.font = lifeIconSize + "px Arial";
        ctx.fillText("🐱", lx, cy + 20 + lifeIconSize - 2);
      }
    }
    ctx.globalAlpha = 1.0;

    const secsLeft = Math.ceil(lifeLostTimer / 60);
    ctx.font = "20px Arial"; ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Продолжаем через " + secsLeft + "с...  (Enter — пропустить)", cx, cy + 80);

    ctx.restore();
    return;
  }

  if (gameState === "win") {
    ctx.font = "bold 72px Arial"; ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
    ctx.fillText("🎉 ПОБЕДА!", cx, cy-60);
    ctx.shadowBlur = 0;
    ctx.font = "bold 28px Arial"; ctx.fillStyle = "#fff";
    ctx.fillText("Уровень "+level+" пройден!", cx, cy-10);
    ctx.font = "22px Arial"; ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score, cx, cy+30);
  } else if (gameState === "accident") {
    ctx.font = "bold 64px Arial"; ctx.fillStyle = "#ef5350";
    ctx.shadowColor = "#b71c1c"; ctx.shadowBlur = 24;
    ctx.fillText("💩 АВАРИЯ!", cx, cy-60);
    ctx.shadowBlur = 0;
    ctx.font = "bold 26px Arial"; ctx.fillStyle = "#fff";
    ctx.fillText("Кот не добежал до лотка...", cx, cy-10);
    ctx.font = "20px Arial"; ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  } else if (gameState === "caught") {
    ctx.font = "bold 64px Arial"; ctx.fillStyle = "#ff7043";
    ctx.shadowColor = "#bf360c"; ctx.shadowBlur = 24;
    ctx.fillText("😾 ПОЙМАЛИ!", cx, cy-60);
    ctx.shadowBlur = 0;
    ctx.font = "bold 26px Arial"; ctx.fillStyle = "#fff";
    ctx.fillText("Хозяин схватил кота!", cx, cy-10);
    ctx.font = "20px Arial"; ctx.fillStyle = "#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  }

  if (score >= stats.highScore && score > 0) {
    ctx.font = "bold 22px Arial"; ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 НОВЫЙ РЕКОРД!", cx, cy+70);
  }

  const t = Date.now()*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(cx, cy+120); ctx.scale(sc, sc);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath(); ctx.roundRect(-130,-26,260,52,26); ctx.fill();
  ctx.font = "bold 22px Arial"; ctx.fillStyle = "#1a1a2e";
  ctx.fillText("↩  В меню  (Enter)", 0, 8);
  ctx.restore();

  ctx.restore();
}

// ===== ГЛАВНАЯ ФУНКЦИЯ РИСОВАНИЯ =====
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (gameState === "start") {
    drawStartScreen();
    if (IS_MOBILE) drawTouchControls();
    return;
  }

  drawBg();
  drawDecor();
  drawLitterBox();
  for (const ob of obstacles) drawObstacle(ob);
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
