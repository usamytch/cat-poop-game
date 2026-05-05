// ==========================================
// RENDERER — main draw() orchestrator
// ==========================================

// OPT 5: Date.now() один раз за кадр
let _now = 0;

// ===== ПАНИКА — постпроцессинг-эффекты =====
// Все эффекты рисуются поверх готового кадра — не трогают логику.
// Blur пропущен: ctx.filter на Canvas 2D убивает 60fps.
function drawPanicEffects() {
  const urgeRatio = player.urge / player.maxUrge;
  if (urgeRatio <= 0.75) return;

  const intensity = (urgeRatio - 0.75) / 0.25; // 0..1
  const W = WORLD.width, H = WORLD.height;

  // --- 1. Виньетка — тёмные края, нарастают с паникой ---
  const vigAlpha = 0.35 + intensity * 0.35; // 0.35..0.70
  const grad = ctx.createRadialGradient(W/2, H/2, H * 0.25, W/2, H/2, H * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, `rgba(0,0,0,${vigAlpha.toFixed(2)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // --- 2. Красная вспышка — периодические импульсы ---
  if (panicFlashAlpha > 0) {
    ctx.fillStyle = `rgba(220,0,0,${panicFlashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- 3. Хроматическая аберрация по краям (вместо blur) ---
  // Красная полоса смещена вправо, синяя — влево; только по периметру
  const aberW = Math.round(18 + intensity * 22); // 18..40px
  const aberAlpha = (0.08 + intensity * 0.12).toFixed(3); // 0.08..0.20
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // Левый край — синий
  const gL = ctx.createLinearGradient(0, 0, aberW, 0);
  gL.addColorStop(0, `rgba(0,60,255,${aberAlpha})`);
  gL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gL; ctx.fillRect(0, 0, aberW, H);
  // Правый край — красный
  const gR = ctx.createLinearGradient(W, 0, W - aberW, 0);
  gR.addColorStop(0, `rgba(255,0,0,${aberAlpha})`);
  gR.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gR; ctx.fillRect(W - aberW, 0, aberW, H);
  // Верхний край — красный
  const gT = ctx.createLinearGradient(0, 0, 0, aberW);
  gT.addColorStop(0, `rgba(255,0,0,${aberAlpha})`);
  gT.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gT; ctx.fillRect(0, 0, W, aberW);
  // Нижний край — синий
  const gB = ctx.createLinearGradient(0, H, 0, H - aberW);
  gB.addColorStop(0, `rgba(0,60,255,${aberAlpha})`);
  gB.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gB; ctx.fillRect(0, H - aberW, W, aberW);
  ctx.restore();
}

// ===== ГЛАВНАЯ ФУНКЦИЯ РИСОВАНИЯ =====
function draw() {
  // OPT 5: Date.now() один раз за кадр
  _now = Date.now();

  // --- Wave distortion при панике: синусоидальный skew всего экрана ---
  // Применяется через ctx.setTransform ДО clearRect, чтобы охватить весь кадр включая HUD.
  const _urgeRatio = player.urge / player.maxUrge;
  const _inPanic = gameState === "playing" && _urgeRatio > 0.75;
  if (_inPanic) {
    const _waveIntensity = (_urgeRatio - 0.75) / 0.25; // 0..1
    const _skew = Math.sin(_now * 0.004) * 0.012 * _waveIntensity; // макс ±0.012 rad
    ctx.setTransform(1, _skew, 0, 1, 0, 0);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

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
  drawPawTrails();
  player.draw();
  drawOverlayParticles();
  drawComboPopups();
  drawUI();
  drawLivesHUD();

  if (gameState !== "playing" && gameState !== "start") drawOverlay();
  if (IS_MOBILE) drawTouchControls();

  // Паника-постпроцессинг — самый последний слой поверх всего
  if (gameState === "playing") drawPanicEffects();

  // Сбрасываем transform в конце кадра
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
