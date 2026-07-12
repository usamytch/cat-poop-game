// ==========================================
// RENDERER-HUD — litter box, HUD, start screen, overlay
// ==========================================

// ===== ЛОТОК =====
function drawLitterBox() {
  const urgeRatio = player.urge / player.maxUrge;
  const isPanic = urgencyFeedbackStage > 0;
  const isBasement = currentLocation.key === "basement";

  // Пульсация при панике
  let pulse = 0;
  if (isPanic) pulse = Math.sin(_now * 0.015) * (2 + urgencyFeedbackStage * 1.4);
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

  if (urgencyFeedbackStage >= 2) {
    const halo=ctx.createRadialGradient(lx+lw/2,ly+lh/2,8,lx+lw/2,ly+lh/2,lw*0.9);
    const haloAlpha=0.14+urgencyFeedbackStage*0.055+Math.sin(_now*0.012)*0.04;
    halo.addColorStop(0,`rgba(255,210,60,${haloAlpha.toFixed(3)})`);
    halo.addColorStop(1,"rgba(255,70,30,0)");
    ctx.fillStyle=halo; ctx.fillRect(lx-lw*0.5,ly-lh*0.7,lw*2,lh*2.4);
  }

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

  if (isPooping && poopProgress > 0) {
    const poopTime=getRunPoopTime(DIFF[difficulty].poopTime);
    const ratio=clamp(poopProgress/poopTime,0,1);
    ctx.save();
    ctx.globalAlpha=0.32+ratio*0.38;
    ctx.strokeStyle=isBasement ? "#8e7a52" : "#9a6b35";
    ctx.lineWidth=2;
    for (let i=0;i<3;i++) {
      const wave=((_now*0.025+i*13)%30)/30;
      ctx.beginPath();
      ctx.ellipse(lx+lw/2,ly+lh*0.58,10+wave*lw*0.27,4+wave*7,0,Math.PI*0.08,Math.PI*0.92);
      ctx.stroke();
    }
    ctx.restore();
  }

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
  const litterLabel = isPooping ? "" : isTutorialActive() && tutorialState.stage === 1 && !tutorialState.comboDone
    ? "🔒 Сначала COMBO"
    : "🐾 Лоток";
  if (litterLabel) ctx.fillText(litterLabel,litterBox.x+litterBox.width/2,litterBox.y+litterBox.height+20);

  ctx.restore();

  // --- Прогресс-бар покакания ---
  if (isPooping && poopProgress > 0) {
    const poopTime = getRunPoopTime(DIFF[difficulty].poopTime);
    const ratio = poopProgress / poopTime;
    const bw = lw + 10;
    const bx = lx - 5;
    const by = litterBox.y + litterBox.height - 14;
    const bh = 10;

    // Фон бара
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();

    // Заполнение с пульсацией
    const pulse2 = 0.7 + Math.sin(_now * 0.02) * 0.3;
    ctx.fillStyle = ratio > 0.86
      ? `rgba(255,128,42,${pulse2})`
      : `rgba(139,69,19,${pulse2})`;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 5); ctx.fill();

    // Блик на баре
    const shineWidth=Math.max(0,bw*ratio-4);
    if (shineWidth>0) {
      ctx.fillStyle="rgba(255,200,100,0.25)";
      ctx.beginPath(); ctx.roundRect(bx+2,by+1,shineWidth,4,3); ctx.fill();
    }

    setFont("16px Arial");
    ctx.textAlign = "center";
    ctx.fillText(ratio>0.84 ? "💩 ПОЧТИ!" : "💩",litterBox.x+litterBox.width/2,by-3);
  }

  ctx.textAlign = "left";
}

// ===== HUD =====
function _drawHudEffectChip(x, y, emoji, seconds, color) {
  const w = 64, h = 24;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.globalAlpha = 0.58;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.globalAlpha = 1;
  setFont("bold 13px Arial");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(emoji+" "+seconds+"с", x+w/2, y+17);
  ctx.restore();
}

function drawUI() {
  const p = currentLocation.palette;
  const urgeRatio = player.urge / player.maxUrge;
  const panic = urgeRatio > 0.75;
  const tutorial = isTutorialActive();
  const dockX = 14;
  const dockY = WORLD.height - WORLD.floorHeight + 8;
  const dockW = WORLD.width - dockX * 2;
  const dockH = WORLD.floorHeight - 16;
  const panelColor = p.ui || "rgba(30,20,10,0.72)";
  const panelR = 16;

  // На touch нижние углы заняты джойстиком и кнопкой выстрела.
  // Фон остаётся единым, а полезный контент живёт в центральном safe corridor.
  const contentLeft = IS_MOBILE ? 230 : dockX + 18;
  const contentRight = IS_MOBILE ? 970 : dockX + dockW - 18;
  const topY = dockY + 25;

  ctx.fillStyle = panelColor;
  ctx.beginPath(); ctx.roundRect(dockX, dockY, dockW, dockH, panelR); ctx.fill();
  const hudFrame = getSelectedHudFrame();
  ctx.strokeStyle = hudFrame === "gold" ? "rgba(255,213,79,0.78)"
    : hudFrame === "danger" ? "rgba(255,82,120,0.82)"
    : "rgba(255,255,255,0.12)";
  ctx.lineWidth = hudFrame === "classic" ? 1 : 2;
  ctx.beginPath(); ctx.roundRect(dockX+0.5, dockY+0.5, dockW-1, dockH-1, panelR); ctx.stroke();
  ctx.fillStyle = p.accent || "rgba(255,255,255,0.25)";
  ctx.globalAlpha = 0.42;
  ctx.beginPath(); ctx.roundRect(dockX+16, dockY+1, dockW-32, 2, 1); ctx.fill();
  ctx.globalAlpha = 1;

  // Верхняя строка: жизни → контекст → счёт → эффекты → режим.
  let infoX = contentLeft;
  if (!tutorial) {
    const lifeSize = 20;
    const useImg = typeof lifeImage !== "undefined" && lifeImage.complete && lifeImage.naturalWidth > 0;
    if (useImg) ctx.drawImage(lifeImage, infoX, topY-lifeSize+4, lifeSize, lifeSize);
    else {
      setFont("19px Arial");
      ctx.textAlign = "left";
      ctx.fillText("🐱", infoX, topY+4);
    }
    ctx.fillStyle = "#fff";
    setFont("bold 15px Arial");
    ctx.textAlign = "left";
    ctx.fillText("×"+lives, infoX+26, topY);
    infoX += 66;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.moveTo(infoX-12, dockY+13); ctx.lineTo(infoX-12, dockY+34); ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  setFont("bold 15px Arial");
  ctx.textAlign = "left";
  const locationAlpha = levelMessageTimer > 0 ? 1 : 0.84;
  const progression = currentLevelProgression || getLevelProgression(level);
  const actLabel = progression.actStep + "/" + progression.actLength;
  ctx.globalAlpha = locationAlpha;
  const locationText = tutorial
    ? "🎓 "+(tutorialState.stage+1)+"/3 · "+TUTORIAL_STAGES[tutorialState.stage].title
    : (currentLocation.icon || "📍")+" "+currentLocation.name+" · "+actLabel+" · Уровень "+level+
      (runMode === "campaign" ? "/"+RUN.campaignLevels : " ∞");
  ctx.fillText(locationText, infoX, topY);
  ctx.globalAlpha = 1;

  if (!tutorial) {
    ctx.fillStyle = "#ffd54f";
    setFont("bold 15px Arial");
    ctx.textAlign = "center";
    ctx.fillText("СЧЁТ  "+score, IS_MOBILE ? 560 : WORLD.width/2, topY);
  }

  let effectX = IS_MOBILE ? 650 : 690;
  const effectY = dockY + 10;
  if (speedBoostTimer > 0) {
    _drawHudEffectChip(effectX, effectY, "🐟", Math.ceil(speedBoostTimer/60), "#4fc3f7");
    effectX += 72;
  }
  if (yarnFreezeTimer > 0) {
    _drawHudEffectChip(effectX, effectY, "🧶", Math.ceil(yarnFreezeTimer/60), "#ce93d8");
    effectX += 72;
  }
  if (catnipTimer > 0) {
    _drawHudEffectChip(effectX, effectY, "🌿", Math.ceil(catnipTimer/60), "#80cbc4");
  }

  const modeText = tutorial
    ? (IS_MOBILE ? "🎓" : "🎓 ОБУЧЕНИЕ")
    : IS_MOBILE
      ? (difficulty === "chaos" ? "😈" : "😼")
      : progression.modifier
        ? DIFF[difficulty].label+" · "+progression.modifier.label
        : DIFF[difficulty].label+" · "+(runMode === "campaign" ? "Кампания" : "Endless");
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  setFont("bold 13px Arial");
  ctx.textAlign = "right";
  ctx.fillText(modeText, contentRight, topY);

  // Нижняя строка: отдельный label, полноширинный bar и стабильный процент.
  const barY = dockY + 45;
  const barH = 17;
  const labelW = 116;
  const percentW = 50;
  const barX = contentLeft + labelW;
  const barW = contentRight - percentW - barX;

  ctx.fillStyle = panic ? "#ff6b6b" : "rgba(255,255,255,0.86)";
  setFont("bold 14px Arial");
  ctx.textAlign = "left";
  ctx.fillText((panic ? "😱 " : "💩 ")+"ХОЧЕТСЯ", contentLeft, barY+13);

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,barH/2); ctx.fill();

  let barColor;
  if (urgeRatio < 0.5)       barColor = "#66bb6a";
  else if (urgeRatio < 0.75) barColor = "#ffa726";
  else                        barColor = panic ? `hsl(${_now*0.5%60},100%,55%)` : "#ef5350";

  const fillW = barW * urgeRatio;
  if (fillW > 0) {
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, barH/2); ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 1;
  const marker50X = Math.round(barX + barW * 0.5) + 0.5;
  const marker75X = Math.round(barX + barW * 0.75) + 0.5;
  ctx.beginPath(); ctx.moveTo(marker50X, barY+3); ctx.lineTo(marker50X, barY+barH-3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(marker75X, barY+3); ctx.lineTo(marker75X, barY+barH-3); ctx.stroke();

  if (panic) {
    ctx.strokeStyle = `rgba(255,50,50,${0.5+Math.sin(_now*0.015)*0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(barX-2, barY-2, barW+4, barH+4, (barH+4)/2); ctx.stroke();
  }

  ctx.fillStyle = panic ? "#ff8a80" : "#fff";
  setFont("bold 14px Arial");
  ctx.textAlign = "right";
  ctx.fillText(Math.floor(urgeRatio*100)+"%", contentRight, barY+13);
  ctx.textAlign = "left";
}

function drawLocationRuleBanner() {
  if (locationRuleState.kitchenBlockedPulse > 0) {
    ctx.save();
    const alpha = Math.min(1, locationRuleState.kitchenBlockedPulse / 8);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(70,25,12,0.88)";
    ctx.beginPath(); ctx.roundRect(player.x - 68, player.y - 42, 172, 28, 12); ctx.fill();
    ctx.fillStyle = "#ffe0a8";
    setFont("bold 12px Arial");
    ctx.textAlign = "center";
    ctx.fillText("СНАЧАЛА СПРЯЧЬСЯ", player.x + player.size / 2, player.y - 23);
    ctx.restore();
  }

  if (!shouldShowLocationRuleBanner()) return;
  const rule = currentLocation.rule;
  if (!rule) return;

  const fadeIn = clamp((180 - levelMessageTimer) / 18, 0, 1);
  const fadeOut = clamp(levelMessageTimer / 24, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const w = 620;
  const h = 82;
  const x = (WORLD.width - w) / 2;
  const y = 14;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = currentLocation.key === "country"
    ? "rgba(45,14,60,0.90)"
    : (currentLocation.palette.ui || "rgba(25,20,15,0.88)");
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = currentLocation.key === "country" ? "#f4d35e" : "rgba(255,255,255,0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.stroke();

  ctx.fillStyle = "#fff";
  setFont("bold 22px Arial");
  ctx.textAlign = "center";
  ctx.fillText((currentLocation.icon || "📍") + "  " + getLocationRuleBannerTitle(), WORLD.width / 2, y + 32);
  ctx.fillStyle = currentLocation.key === "country" ? "#ffe888" : "rgba(255,255,255,0.78)";
  setFont("14px Arial");
  ctx.fillText(rule.hint, WORLD.width / 2, y + 66);
  ctx.restore();
}

// ===== СТАРТОВЫЙ ЭКРАН =====
function _drawStartMenuHover(x, y, w, h, targetId) {
  if (startMenuHover !== targetId) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x+2,y+2,w-4,h-4,14); ctx.stroke();
  ctx.restore();
}

function drawStartScreen() {
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0,0,WORLD.width,WORLD.height);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i=0; i<60; i++) {
    const sx = (i*137.5)%WORLD.width, sy = (i*97.3)%WORLD.height;
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.save();
  ctx.textAlign = "center";
  setFont("bold 54px Arial");
  ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
  ctx.fillText("🐱 CAT POOP GAME", WORLD.width/2, 82);
  ctx.shadowBlur = 0;

  setFont("bold 21px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("Доведи кота до лотка — пока не поздно!", WORLD.width/2, 120);

  if (gameMode !== "tutorial") {
    const record = getRunRecord(runMode, difficulty);
    setFont("bold 17px Arial"); ctx.fillStyle = "#ffd54f";
    const formatLabel = runMode === "campaign" ? "КАМПАНИЯ" : "ENDLESS";
    ctx.fillText("🏆 "+formatLabel+" · "+DIFF[difficulty].label+" · Рекорд "+record.highScore+
      " · Лучший уровень "+record.bestLevel+(record.wins ? " · Побед "+record.wins : ""), WORLD.width/2, 154);
  }

  setFont("14px Arial"); ctx.fillStyle = "#b0bec5";
  ctx.fillText("Поймано: "+stats.totalCaught+"  ·  Аварий: "+stats.totalAccidents+
    "  ·  Выстрелов: "+stats.totalPoops+"  ·  Журнал: "+runProfile.unlocks.locations.length+"/6"+
    "  ·  Достижения: "+runProfile.unlocks.achievements.length+"/"+ACHIEVEMENTS.length, WORLD.width/2, 184);

  setFont("bold 19px Arial"); ctx.fillStyle = startMenuFocus === "mode" ? "#ffd54f" : "#fff";
  ctx.fillText(startMenuFocus === "mode" ? "←  РЕЖИМ  →" : "РЕЖИМ", WORLD.width/2, 224);

  const diffs = [
    {key:"tutorial", label:"🎓 Обучение", desc:"3 постановочных экрана"},
    {key:"normal", label:"😼 Нормал", desc:"Хозяин со 2 уровня"},
    {key:"chaos", label:"😈 Хаос", desc:"Быстрее и агрессивнее"},
  ];
  diffs.forEach((d, i) => {
    const sel = gameMode === d.key;
    const bx = 135+i*320, by = 250, bw = 290, bh = 82;
    ctx.fillStyle = sel ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.fill();
    if (sel) { ctx.strokeStyle="#ffd54f"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.stroke(); }
    _drawStartMenuHover(bx, by, bw, bh, "mode:"+d.key);
    setFont("bold 21px Arial"); ctx.fillStyle = sel ? "#ffd54f" : "#fff";
    ctx.fillText(d.label, bx+bw/2, by+32);
    setFont("14px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText(d.desc, bx+bw/2, by+59);
  });

  setFont("bold 19px Arial");
  ctx.fillStyle = gameMode === "tutorial" ? "rgba(255,255,255,0.35)" : startMenuFocus === "format" ? "#ffd54f" : "#fff";
  ctx.fillText(startMenuFocus === "format" ? "←  ФОРМАТ ЗАБЕГА  →" : "ФОРМАТ ЗАБЕГА", WORLD.width/2, 374);
  const formats = [
    { key:"campaign", label:"🏁 КАМПАНИЯ", desc:"25 уровней · настоящий финал" },
    { key:"endless", label:"♾️ ENDLESS", desc:"После первой победы" },
  ];
  formats.forEach((format, i) => {
    const locked = format.key === "endless" && !runProfile.unlocks.endless;
    const selected = gameMode !== "tutorial" && runMode === format.key;
    const bx = 295+i*320, by = 400, bw = 290, bh = 76;
    ctx.globalAlpha = gameMode === "tutorial" ? 0.34 : locked ? 0.50 : 1;
    ctx.fillStyle = selected ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.fill();
    if (selected) { ctx.strokeStyle="#ffd54f"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.stroke(); }
    _drawStartMenuHover(bx, by, bw, bh, "format:"+format.key);
    setFont("bold 19px Arial"); ctx.fillStyle = selected ? "#ffd54f" : "#fff";
    ctx.fillText(locked ? "🔒 ENDLESS" : format.label, bx+bw/2, by+29);
    setFont("13px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText(format.desc, bx+bw/2, by+54);
    ctx.globalAlpha = 1;
  });

  // На мобиле кнопку "ИГРАТЬ" и подсказку с клавишами рисует drawTouchControls()
  if (!IS_MOBILE) {
    const t = _now*0.003;
    const sc = 1 + Math.sin(t)*0.04;
    const play = START_MENU_LAYOUT.play;
    ctx.save(); ctx.translate(play.x+play.w/2, play.y+play.h/2); ctx.scale(sc, sc);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath(); ctx.roundRect(-140,-28,280,56,28); ctx.fill();
    if (startMenuFocus === "play") {
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-136,-24,272,48,24); ctx.stroke();
    }
    setFont("bold 26px Arial"); ctx.fillStyle = "#1a1a2e";
    ctx.fillText(startMenuFocus === "play" ? "▶  ИГРАТЬ  ↵" : "▶  ИГРАТЬ", 0, 10);
    ctx.restore();
    _drawStartMenuHover(START_MENU_LAYOUT.play.x,START_MENU_LAYOUT.play.y,
      START_MENU_LAYOUT.play.w,START_MENU_LAYOUT.play.h,"play");

    setFont("15px Arial"); ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("↑/↓ — строка  ·  ←/→ — выбор  ·  Enter — дальше / играть  ·  мышь — выбрать", WORLD.width/2, 625);
    setFont("13px Arial"); ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.fillText("1/2/3 — быстрый режим  ·  M — "+(muted ? "🔇 выкл" : "🔊 вкл"), WORLD.width/2, 655);
  }

  ctx.restore();
}

function _drawActCompleteContent() {
  const report = currentActReport;
  if (!report) return;
  const cx = WORLD.width / 2;

  setFont("bold 42px Arial");
  ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ff9800";
  ctx.shadowBlur = 20;
  ctx.fillText("АКТ "+report.actNumber+" ПРОЙДЕН · РАНГ "+report.rank, cx, 70);
  ctx.shadowBlur = 0;

  const metrics = [
    ["⏱ ВРЕМЯ", report.seconds+" сек"],
    ["💩 СРОЧНОСТЬ", report.avgUrge+"% в среднем"],
    ["🎯 ТОЧНОСТЬ", report.accuracy+"% · "+report.hits+"/"+report.shots],
    ["💔 ЖИЗНИ", "Потеряно "+report.livesLost],
    ["🎁 РИСК", "Бонусов "+report.riskyBonuses],
  ];
  const metricW = 180, metricH = 74, metricGap = 16;
  const metricStart = (WORLD.width - (metrics.length*metricW + (metrics.length-1)*metricGap))/2;
  metrics.forEach((metric, i) => {
    const x = metricStart + i*(metricW+metricGap);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath(); ctx.roundRect(x, 98, metricW, metricH, 14); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x+0.5, 98.5, metricW-1, metricH-1, 14); ctx.stroke();
    setFont("bold 13px Arial"); ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(metric[0], x+metricW/2, 124);
    setFont("bold 16px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText(metric[1], x+metricW/2, 151);
  });

  if (currentHabitChoices.length === 0) {
    setFont("bold 28px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Все четыре привычки уже выбраны", cx, 260);
    setFont("20px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Дальше решает только мастерство", cx, 304);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath(); ctx.roundRect(cx-190, 350, 380, 64, 32); ctx.fill();
    setFont("bold 22px Arial"); ctx.fillStyle = "#1a1a2e";
    ctx.fillText(IS_MOBILE ? "▶ ПРОДОЛЖИТЬ" : "▶ ПРОДОЛЖИТЬ · Enter", cx, 390);
    return;
  }

  setFont("bold 23px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("ВЫБЕРИ ОДНУ КОШАЧЬЮ ПРИВЫЧКУ", cx, 218);
  setFont("14px Arial"); ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.fillText("Она останется до конца текущего забега", cx, 244);

  const cardW = 300, cardH = 224, cardGap = 24;
  const startX = (WORLD.width - (cardW*3 + cardGap*2))/2;
  currentHabitChoices.forEach((habit, i) => {
    const x = startX + i*(cardW+cardGap), y = 270;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.roundRect(x,y,cardW,cardH,18); ctx.fill();
    ctx.strokeStyle = "rgba(255,213,79,0.42)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x+1,y+1,cardW-2,cardH-2,18); ctx.stroke();
    setFont("32px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText(habit.icon, x+cardW/2, y+48);
    setFont("bold 18px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText(habit.title, x+cardW/2, y+82);
    setFont("bold 15px Arial"); ctx.fillStyle = "#8be9a8";
    ctx.fillText("+ "+habit.benefit, x+cardW/2, y+119);
    setFont("15px Arial"); ctx.fillStyle = "#ff9e9e";
    ctx.fillText("− "+habit.cost, x+cardW/2, y+151);
    ctx.fillStyle = "rgba(255,213,79,0.18)";
    ctx.beginPath(); ctx.roundRect(x+68,y+173,cardW-136,36,18); ctx.fill();
    setFont("bold 15px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText(IS_MOBILE ? "ВЫБРАТЬ" : (i+1)+" — ВЫБРАТЬ", x+cardW/2, y+197);
  });

  const chosen = getSelectedHabits().map(habit => habit.icon+" "+habit.title).join("  ·  ");
  setFont("14px Arial"); ctx.fillStyle = "rgba(255,255,255,0.56)";
  ctx.fillText(chosen ? "Уже в характере: "+chosen : "Пока привычек нет", cx, 535);
}

function _formatRunTime(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return minutes+":"+seconds;
}

function _drawVictoryContent() {
  const cx = WORLD.width/2;
  const finalReport = currentActReport;
  setFont("bold 58px Arial"); ctx.fillStyle = "#ffd54f";
  ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 28;
  ctx.fillText("🎉 ЗАБЕГ ЗАВЕРШЁН!", cx, 105);
  ctx.shadowBlur = 0;
  setFont("bold 23px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("Кот пережил пять актов и покорил Дачу", cx, 145);

  setFont("bold 24px Arial"); ctx.fillStyle = "#ffd54f";
  ctx.fillText("СЧЁТ "+score+"   ·   ВРЕМЯ "+_formatRunTime(simulationTimeMs)+
    "   ·   ФИНАЛЬНЫЙ РАНГ "+(finalReport ? finalReport.rank : "—"), cx, 200);
  const ranks = runActReports.map(report => report.rank).join("  ·  ");
  setFont("17px Arial"); ctx.fillStyle = "#b0bec5";
  ctx.fillText("Ранги актов: "+ranks, cx, 238);

  const habits = getSelectedHabits().map(habit => habit.icon+" "+habit.title).join("  ·  ");
  setFont("15px Arial"); ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(habits ? "Характер забега: "+habits : "Забег пройден без привычек", cx, 278);

  ctx.fillStyle = "rgba(255,213,79,0.12)";
  ctx.beginPath(); ctx.roundRect(cx-330, 314, 660, 100, 18); ctx.fill();
  ctx.strokeStyle = "rgba(255,213,79,0.48)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(cx-329, 315, 658, 98, 18); ctx.stroke();
  setFont("bold 22px Arial"); ctx.fillStyle = "#ffd54f";
  ctx.fillText("🔓 ОТКРЫТ ENDLESS", cx, 349);
  setFont("16px Arial"); ctx.fillStyle = "#fff";
  ctx.fillText("Новые следы лап и рамка HUD уже выбраны", cx, 382);

  setFont("14px monospace"); ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.fillText("Seed: "+globalSeed, cx, 444);
  if (!IS_MOBILE) {
    setFont("14px Arial");
    ctx.fillText("R — повторить этот забег", cx, 476);
  }
  if (score >= getRunRecord("campaign", difficulty).highScore && score > 0) {
    setFont("bold 20px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 ЛУЧШИЙ РЕЗУЛЬТАТ ЭТОГО ФОРМАТА", cx, IS_MOBILE ? 486 : 516);
  }

  if (!IS_MOBILE) {
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath(); ctx.roundRect(cx-160, 540, 320, 50, 25); ctx.fill();
    setFont("bold 22px Arial"); ctx.fillStyle = "#1a1a2e";
    ctx.fillText("↩ В МЕНЮ · Enter", cx, 573);
  }
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

  if (gameState === "actComplete") {
    _drawActCompleteContent();
    ctx.restore();
    return;
  }

  if (gameState === "paused") {
    setFont("bold 72px Arial");
    ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "#ff9800";
    ctx.shadowBlur = 24;
    ctx.fillText("⏸ ПАУЗА", cx, cy - 70);
    ctx.shadowBlur = 0;

    setFont("bold 28px Arial");
    ctx.fillStyle = "#fff";
    ctx.fillText(pauseReason === "manual" ? "Кот терпит. Пока что." : "Игра остановлена — фокус потерян.", cx, cy - 15);

    setFont("20px Arial");
    ctx.fillStyle = "#b0bec5";
    ctx.fillText("Срочность, хозяин, препятствия и таймеры заморожены", cx, cy + 25);
    ctx.fillText(IS_MOBILE ? "Нажми ▶, чтобы продолжить" : "Enter / Esc / P — продолжить", cx, cy + 62);
    if (isTutorialActive()) {
      const seen = getTutorialPauseLegend();
      setFont("16px Arial");
      ctx.fillStyle = "rgba(255,255,255,0.58)";
      ctx.fillText(seen.length > 0 ? "Встречено: "+seen.join("  ·  ") : "Бонусы откроются на третьем экране", cx, cy + 98);
      if (!IS_MOBILE) ctx.fillText("Q — выйти из обучения в меню", cx, cy + 128);
    }
    ctx.restore();
    return;
  }

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
    _drawVictoryContent();
    ctx.restore();
    return;
  }

  if (gameState === "tutorialComplete") {
    setFont("bold 58px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
    ctx.fillText("🎓 ОБУЧЕНИЕ ПРОЙДЕНО", cx, cy-70);
    ctx.shadowBlur = 0;
    setFont("bold 26px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Теперь правила будут честными, но пощады не будет.", cx, cy-15);
    setFont("20px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Основным режимом выбран 😼 Нормал", cx, cy+25);
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

  if (gameState !== "tutorialComplete") {
    setFont("bold 17px Arial"); ctx.fillStyle = "#fff";
    const failureRecord = score >= stats.highScore && score > 0;
    ctx.fillText(runProgressLabel()+(failureRecord ? " · 🏆 Новый рекорд" : ""), cx, cy+66);
    setFont("16px Arial"); ctx.fillStyle = "#ffccbc";
    ctx.fillText(getRunFailureTip(), cx, cy+98);
    setFont("14px monospace"); ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.fillText("Seed: "+globalSeed, cx, cy+132);
    if (!IS_MOBILE) {
      setFont("14px Arial");
      ctx.fillText("R — повторить этот забег", cx, cy+164);
    }
  }

  // На мобиле кнопку "В меню" рисует drawTouchControls()
  if (!IS_MOBILE) {
    const tutorialComplete = gameState === "tutorialComplete";
    const buttonW = tutorialComplete ? 360 : 260;
    const buttonH = tutorialComplete ? 60 : 52;
    const buttonLabel = tutorialComplete ? "▶  ПРОДОЛЖИТЬ" : "↩  В меню  (Enter)";
    const t = _now*0.003;
    const sc = 1 + Math.sin(t)*0.04;
    ctx.save(); ctx.translate(cx, tutorialComplete ? cy+95 : cy+218); ctx.scale(sc, sc);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath(); ctx.roundRect(-buttonW/2,-buttonH/2,buttonW,buttonH,buttonH/2); ctx.fill();
    setFont(tutorialComplete ? "bold 24px Arial" : "bold 22px Arial");
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(buttonLabel, 0, tutorialComplete ? 8 : 8);
    ctx.restore();
  }

  ctx.restore();
}

// ===== КОНТЕКСТНЫЕ ПОДСКАЗКИ ОБУЧЕНИЯ =====
function drawTutorialGuidance() {
  if (!isTutorialActive() || gameState !== "playing") return;

  const prompt = getTutorialPrompt();
  if (prompt) {
    const boxW = 760;
    const boxX = (WORLD.width - boxW) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(15,18,30,0.88)";
    ctx.beginPath(); ctx.roundRect(boxX, 14, boxW, 46, 18); ctx.fill();
    ctx.strokeStyle = tutorialState.bannerTimer > 90 ? "#ffd54f" : "rgba(255,255,255,0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(boxX, 14, boxW, 46, 18); ctx.stroke();
    setFont("bold 18px Arial");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(prompt, WORLD.width / 2, 43);
    ctx.restore();
  }

  if (tutorialState.stage === 2) {
    for (const bonus of bonuses) {
      if (!bonus.alive || !bonus.tutorialLabel) continue;
      const meta = BONUS_TYPES[bonus.type];
      ctx.save();
      setFont("bold 13px Arial");
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.beginPath(); ctx.roundRect(bonus.x-76, bonus.y-43, 152, 24, 10); ctx.fill();
      ctx.fillStyle = meta.color;
      ctx.fillText(meta.emoji+" "+meta.label, bonus.x, bonus.y-26);
      ctx.restore();
    }
  }
}
