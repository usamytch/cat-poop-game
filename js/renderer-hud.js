// ==========================================
// RENDERER-HUD — litter box, HUD, start screen, overlay
// ==========================================

// ===== ЛОТОК =====
function drawLitterBox() {
  const urgeRatio = player.urge / player.maxUrge;
  const isPanic = urgeRatio > 0.75;
  const isBasement = currentLocation.key === "basement";

  // Пульсация при панике
  let pulse = 0;
  if (isPanic) pulse = Math.sin(_now * 0.015) * 4;
  const lx = litterBox.x - pulse / 2;
  const ly = litterBox.y - pulse / 2;
  const lw = litterBox.width + pulse;
  const lh = litterBox.height + pulse;
  const r = 10; // радиус скругления

  // Палитра: тёмная для подвала, обычная для остальных локаций
  const bodyColor = isBasement ? "#1e1510" : "#7a5520";
  const rimColor  = isBasement ? "#2e2018" : "#a0692a";
  const sandColor = isBasement ? "#3a2e1e" : "#d9b87a";
  const dotColor  = isBasement ? "rgba(15,10,5,0.60)"   : "rgba(120,80,30,0.22)";
  const sandShine = isBasement ? "rgba(80,65,45,0.20)"  : "rgba(255,245,200,0.30)";
  const labelColor = isBasement ? "rgba(160,140,100,0.65)" : "#4a2800";

  ctx.save();

  // --- Тень под лотком ---
  ctx.shadowColor = isBasement ? "rgba(0,0,0,0.70)" : "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;

  // --- Корпус лотка (скруглённый) ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath(); ctx.roundRect(lx, ly + 10, lw, lh - 10, r); ctx.fill();

  // Сбрасываем тень для внутренних деталей
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // --- Бортик / ободок (выступает по бокам) ---
  ctx.fillStyle = rimColor;
  ctx.beginPath(); ctx.roundRect(lx - 5, ly, lw + 10, 18, r); ctx.fill();

  // Блик на ободке — только не в подвале
  if (!isBasement) {
    ctx.fillStyle = "rgba(255,220,150,0.28)";
    ctx.beginPath(); ctx.roundRect(lx + 4, ly + 2, lw - 8, 6, 4); ctx.fill();
  }

  // --- Наполнитель — скруглённый прямоугольник внутри ---
  ctx.fillStyle = sandColor;
  ctx.beginPath(); ctx.roundRect(lx + 7, ly + 18, lw - 14, lh - 28, 7); ctx.fill();

  // Текстура наполнителя — несколько тёмных точек
  ctx.fillStyle = dotColor;
  const sandDots = [
    [lx + 18, ly + 28], [lx + lw*0.4, ly + 32], [lx + lw*0.65, ly + 26],
    [lx + lw*0.3, ly + lh - 20], [lx + lw*0.7, ly + lh - 18],
    [lx + lw*0.5, ly + lh*0.55],
  ];
  for (const [dx, dy] of sandDots) {
    ctx.beginPath(); ctx.ellipse(dx, dy, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Блик на наполнителе — светлая полоска сверху
  ctx.fillStyle = sandShine;
  ctx.beginPath(); ctx.roundRect(lx + 12, ly + 20, lw - 24, 7, 4); ctx.fill();

  // --- Плесень (только в подвале) ---
  if (isBasement) {
    const moldSpots = [
      { rx: lw * 0.15, ry: lh * 0.40, rx2: 7, ry2: 4, rot: 0.3  },
      { rx: lw * 0.70, ry: lh * 0.60, rx2: 5, ry2: 3, rot: -0.5 },
      { rx: lw * 0.45, ry: lh * 0.75, rx2: 8, ry2: 3, rot: 0.8  },
      { rx: lw * 0.85, ry: lh * 0.35, rx2: 4, ry2: 4, rot: 0.1  },
    ];
    ctx.fillStyle = "rgba(35,65,25,0.60)";
    for (const m of moldSpots) {
      ctx.save();
      ctx.translate(lx + m.rx, ly + 10 + m.ry);
      ctx.rotate(m.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, m.rx2, m.ry2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Маленькие точки плесени
    ctx.fillStyle = "rgba(50,90,30,0.45)";
    [[lw*0.25, lh*0.50], [lw*0.60, lh*0.30], [lw*0.80, lh*0.65]].forEach(([rx, ry]) => {
      ctx.beginPath();
      ctx.arc(lx + rx, ly + 10 + ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- Паника: красное свечение поверх ---
  if (isPanic) {
    const alpha = 0.25 + Math.sin(_now * 0.015) * 0.15;
    ctx.fillStyle = `rgba(255,40,40,${alpha})`;
    ctx.beginPath(); ctx.roundRect(lx - 5, ly, lw + 10, lh + 4, r); ctx.fill();
  }

  // --- Подпись ---
  ctx.fillStyle = labelColor;
  setFont("bold 12px Arial");
  ctx.textAlign = "center";
  ctx.fillText("🐾 Лоток", litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height + 20);

  ctx.restore();

  // --- Прогресс-бар покакания ---
  if (isPooping && poopProgress > 0) {
    const poopTime = DIFF[difficulty].poopTime;
    const ratio = poopProgress / poopTime;
    const bw = lw + 10;
    const bx = lx - 5;
    const by = litterBox.y + litterBox.height + 26;
    const bh = 10;

    // Фон бара
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();

    // Заполнение с пульсацией
    const pulse2 = 0.7 + Math.sin(_now * 0.02) * 0.3;
    ctx.fillStyle = `rgba(139,69,19,${pulse2})`;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 5); ctx.fill();

    // Блик на баре
    ctx.fillStyle = "rgba(255,200,100,0.25)";
    ctx.beginPath(); ctx.roundRect(bx + 2, by + 1, bw * ratio - 4, 4, 3); ctx.fill();

    setFont("16px Arial");
    ctx.textAlign = "center";
    ctx.fillText("💩", litterBox.x + litterBox.width / 2, by - 2);
  }

  ctx.textAlign = "left";
}

// ===== HUD =====
function drawUI() {
  const p = currentLocation.palette;
  const urgeRatio = player.urge / player.maxUrge;
  const panic = urgeRatio > 0.75;

  const hudX=14, hudY=14, hudW=310, hudH=188;
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
  ctx.fillText(panic ? "😱 СРОЧНО!" : "💩 Хочется: "+Math.floor(urgeRatio*100)+"%", barX+barW/2, barY+15);

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

// ===== ЖИЗНИ (нижний левый угол) =====
function drawLivesHUD() {
  const lifeIconSize = 26;
  const gap = 5;
  // Максимум 9 слотов (кошек 9 жизней)
  const lifeSlots = 9;
  const totalW = lifeSlots * lifeIconSize + (lifeSlots - 1) * gap;
  const panelPad = 10;
  const panelX = 14;
  const panelY = WORLD.height - WORLD.floorHeight + 28;
  const panelW = totalW + panelPad * 2;
  const panelH = lifeIconSize + panelPad * 2;

  // Фон панели
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 12); ctx.fill();

  const iconsStartX = panelX + panelPad;
  const iconsY = panelY + panelPad;
  const useImg = typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0;

  for (let i = 0; i < lifeSlots; i++) {
    const ix = iconsStartX + i * (lifeIconSize + gap);
    ctx.globalAlpha = i < lives ? 1.0 : 0.22;
    if (useImg) {
      ctx.drawImage(lifeImage, ix, iconsY, lifeIconSize, lifeIconSize);
    } else {
      setFont(lifeIconSize + "px Arial"); ctx.textAlign = "left";
      ctx.fillText("🐱", ix, iconsY + lifeIconSize - 2);
    }
  }
  ctx.globalAlpha = 1.0;
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
    {key:"easy",   label:"😸 Лёгкий",  desc:"Медленная срочность · хозяин с 3 уровня · облегчение на ходу"},
    {key:"normal", label:"😼 Нормал",   desc:"Стандартный режим · хозяин со 2 уровня · облегчение на ходу"},
    {key:"chaos",  label:"😈 Хаос",     desc:"Быстрая срочность · хозяин с 1 уровня · меткое облегчение"},
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

  // На мобиле кнопку "ИГРАТЬ" и подсказку с клавишами рисует drawTouchControls()
  if (!IS_MOBILE) {
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
    setFont("13px Arial"); ctx.fillStyle = "rgba(255,200,80,0.50)";
    ctx.fillText("[Shift+B] — 🏚️ Подвал (чит)", WORLD.width/2, 672);
  }

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

    const lifeIconSize = 30;
    const lifeGap = 6;
    const lifeSlots = 9;
    const totalW = lifeSlots * lifeIconSize + (lifeSlots - 1) * lifeGap;
    const lifeStartX = cx - totalW / 2;
    const useImg = typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0;
    for (let i = 0; i < lifeSlots; i++) {
      const lx = lifeStartX + i * (lifeIconSize + lifeGap);
      ctx.globalAlpha = i < lives ? 1.0 : 0.22;
      if (useImg) {
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

  // На мобиле кнопку "В меню" рисует drawTouchControls()
  if (!IS_MOBILE) {
    const t = _now*0.003;
    const sc = 1 + Math.sin(t)*0.04;
    ctx.save(); ctx.translate(cx, cy+120); ctx.scale(sc, sc);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath(); ctx.roundRect(-130,-26,260,52,26); ctx.fill();
    setFont("bold 22px Arial"); ctx.fillStyle = "#1a1a2e";
    ctx.fillText("↩  В меню  (Enter)", 0, 8);
    ctx.restore();
  }

  ctx.restore();
}
