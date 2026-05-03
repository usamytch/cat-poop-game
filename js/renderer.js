// ==========================================
// RENDERER — main draw() orchestrator
// ==========================================

// OPT 5: Date.now() один раз за кадр
let _now = 0;

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
  drawPawTrails();
  player.draw();
  drawOverlayParticles();
  drawComboPopups();
  drawUI();

  if (gameState !== "playing" && gameState !== "start") drawOverlay();
  if (IS_MOBILE) drawTouchControls();
}
