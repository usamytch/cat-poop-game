// ==========================================
// RENDERER-HUD — litter box, HUD, start screen, overlay
// ==========================================

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
