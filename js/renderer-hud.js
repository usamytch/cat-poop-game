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
  const litterLabel = isTutorialActive() && tutorialState.stage === 1 && !tutorialState.comboDone
    ? "🔒 Сначала COMBO"
    : "🐾 Лоток";
  ctx.fillText(litterLabel, litterBox.x + litterBox.width / 2, litterBox.y + litterBox.height + 20);

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
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
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
    : (currentLocation.icon || "📍")+" "+currentLocation.name+" · "+actLabel+" · Уровень "+level;
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
      : progression.modifier ? DIFF[difficulty].label+" · "+progression.modifier.label : DIFF[difficulty].label;
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
  ctx.fillText("Выбери режим:", WORLD.width/2, 300);

  const diffs = [
    {key:"tutorial", label:"🎓 Обучение", desc:"3 постановочных экрана · без рекордов · можно повторять"},
    {key:"normal", label:"😼 Нормал",   desc:"Стандартный режим · хозяин со 2 уровня · облегчение на ходу"},
    {key:"chaos",  label:"😈 Хаос",     desc:"Быстрая срочность · хозяин с 1 уровня · меткое облегчение"},
  ];
  diffs.forEach((d, i) => {
    const sel = gameMode === d.key;
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

  if (gameState === "tutorialComplete") {
    setFont("bold 58px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 30;
    ctx.fillText("🎓 ОБУЧЕНИЕ ПРОЙДЕНО", cx, cy-70);
    ctx.shadowBlur = 0;
    setFont("bold 26px Arial"); ctx.fillStyle = "#fff";
    ctx.fillText("Теперь правила будут честными, но пощады не будет.", cx, cy-15);
    setFont("20px Arial"); ctx.fillStyle = "#b0bec5";
    ctx.fillText("Основным режимом выбран 😼 Нормал", cx, cy+25);
  } else if (gameState === "win") {
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

  if (gameState !== "tutorialComplete") {
    setFont("14px monospace"); ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.fillText("Seed: "+globalSeed, cx, cy+55);
    if (!IS_MOBILE) {
      setFont("14px Arial");
      ctx.fillText("R — повторить этот забег", cx, cy+75);
    }
  }

  if (gameState !== "tutorialComplete" && score >= stats.highScore && score > 0) {
    setFont("bold 22px Arial"); ctx.fillStyle = "#ffd54f";
    ctx.fillText("🏆 НОВЫЙ РЕКОРД!", cx, cy+100);
  }

  // На мобиле кнопку "В меню" рисует drawTouchControls()
  if (!IS_MOBILE) {
    const tutorialComplete = gameState === "tutorialComplete";
    const buttonW = tutorialComplete ? 360 : 260;
    const buttonH = tutorialComplete ? 60 : 52;
    const buttonLabel = tutorialComplete ? "▶  ПРОДОЛЖИТЬ" : "↩  В меню  (Enter)";
    const t = _now*0.003;
    const sc = 1 + Math.sin(t)*0.04;
    ctx.save(); ctx.translate(cx, cy+155); ctx.scale(sc, sc);
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
