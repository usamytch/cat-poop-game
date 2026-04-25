// ==========================================
// TOUCH — мобильное управление (только IS_MOBILE)
// Виртуальный джойстик + кнопки действий
// Пишет в тот же объект keys{}, что и клавиатура —
// логика игры (entities.js) не меняется.
// ==========================================

if (IS_MOBILE) {

  // ===== КОНФИГУРАЦИЯ ДЖОЙСТИКА =====
  // Все координаты — в пространстве canvas (1200×700)
  const JOY = {
    cx: 130,        // центр джойстика X
    cy: 580,        // центр джойстика Y
    outerR: 80,     // радиус внешнего кольца
    innerR: 36,     // радиус ручки
    stickX: 130,    // текущее положение ручки X
    stickY: 580,    // текущее положение ручки Y
    active: false,  // палец на джойстике
    touchId: null,  // идентификатор касания
  };

  // ===== КНОПКИ ДЕЙСТВИЙ =====
  // Кнопка "Выстрел 💩" — правый нижний угол
  const BTN_SHOOT = { cx: 1100, cy: 590, r: 60, label: "💩", touchId: null };
  // Кнопка "Старт / Продолжить" — центр экрана (только на стартовом/оверлейном экране)
  const BTN_ACTION = { cx: 600, cy: 590, r: 55, label: "▶", touchId: null };
  // Кнопка мьюта — верхний правый угол, всегда видна
  const BTN_MUTE = { cx: 1155, cy: 45, r: 38 };

  // ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: canvas-координаты из touch =====
  function canvasCoords(touch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top)  * scaleY,
    };
  }

  // ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: попадание в круг =====
  function inCircle(px, py, cx, cy, r) {
    const dx = px - cx, dy = py - cy;
    return dx*dx + dy*dy <= r*r;
  }

  // ===== ОБНОВЛЕНИЕ keys{} ПО ПОЛОЖЕНИЮ РУЧКИ =====
  function updateKeysFromJoystick() {
    if (!JOY.active) {
      keys["ArrowLeft"]  = false;
      keys["ArrowRight"] = false;
      keys["ArrowUp"]    = false;
      keys["ArrowDown"]  = false;
      return;
    }
    const dx = JOY.stickX - JOY.cx;
    const dy = JOY.stickY - JOY.cy;
    const dead = 12; // мёртвая зона в пикселях canvas
    keys["ArrowLeft"]  = dx < -dead;
    keys["ArrowRight"] = dx >  dead;
    keys["ArrowUp"]    = dy < -dead;
    keys["ArrowDown"]  = dy >  dead;
  }

  // ===== TOUCHSTART =====
  canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const { x, y } = canvasCoords(touch);

      // Кнопка мьюта — всегда первой, в любом состоянии
      if (inCircle(x, y, BTN_MUTE.cx, BTN_MUTE.cy, BTN_MUTE.r)) {
        toggleMute();
        continue;
      }

      // Джойстик
      if (inCircle(x, y, JOY.cx, JOY.cy, JOY.outerR + 20) && JOY.touchId === null) {
        JOY.active  = true;
        JOY.touchId = touch.identifier;
        JOY.stickX  = x;
        JOY.stickY  = y;
        updateKeysFromJoystick();
        continue;
      }

      // Кнопка выстрела (только во время игры)
      if (gameState === "playing" && inCircle(x, y, BTN_SHOOT.cx, BTN_SHOOT.cy, BTN_SHOOT.r)) {
        BTN_SHOOT.touchId = touch.identifier;
        shootPoop();
        continue;
      }

      // Кнопка действия (старт / меню)
      if (gameState !== "playing") {
        if (inCircle(x, y, BTN_ACTION.cx, BTN_ACTION.cy, BTN_ACTION.r + 30)) {
          if (gameState === "start") {
            startGame();
          } else if (gameState === "lifeLost") {
            respawnPlayer();
          } else {
            gameState = "start";
          }
          continue;
        }
        // Тап по карточкам сложности на стартовом экране
        if (gameState === "start") {
          const diffs = ["easy", "normal", "chaos"];
          diffs.forEach((key, i) => {
            const bx = canvas.width/2 - 220, by = 330 + i*80, bw = 440, bh = 62;
            if (x >= bx && x <= bx+bw && y >= by && y <= by+bh) {
              difficulty = key;
            }
          });
        }
      }
    }
  }, { passive: false });

  // ===== TOUCHMOVE =====
  canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === JOY.touchId) {
        const { x, y } = canvasCoords(touch);
        // Ограничиваем ручку радиусом внешнего кольца
        const dx = x - JOY.cx, dy = y - JOY.cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= JOY.outerR) {
          JOY.stickX = x;
          JOY.stickY = y;
        } else {
          JOY.stickX = JOY.cx + dx/dist * JOY.outerR;
          JOY.stickY = JOY.cy + dy/dist * JOY.outerR;
        }
        updateKeysFromJoystick();
      }
    }
  }, { passive: false });

  // ===== TOUCHEND / TOUCHCANCEL =====
  function onTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === JOY.touchId) {
        JOY.active  = false;
        JOY.touchId = null;
        JOY.stickX  = JOY.cx;
        JOY.stickY  = JOY.cy;
        updateKeysFromJoystick();
      }
      if (touch.identifier === BTN_SHOOT.touchId) {
        BTN_SHOOT.touchId = null;
      }
    }
  }
  canvas.addEventListener("touchend",    onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

  // ===== ОТРИСОВКА МОБИЛЬНЫХ КОНТРОЛОВ =====
  // Вызывается из draw() в renderer.js
  function drawTouchControls() {
    ctx.save();

    // --- Кнопка мьюта — всегда видна в правом верхнем углу ---
    ctx.beginPath();
    ctx.arc(BTN_MUTE.cx, BTN_MUTE.cy, BTN_MUTE.r, 0, Math.PI*2);
    ctx.fillStyle = muted ? "rgba(255,80,80,0.75)" : "rgba(30,30,30,0.60)";
    ctx.fill();
    ctx.strokeStyle = muted ? "rgba(255,120,120,0.9)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = "26px Arial";
    ctx.textAlign = "center";
    ctx.fillText(muted ? "🔇" : "🔊", BTN_MUTE.cx, BTN_MUTE.cy + 9);

    if (gameState === "playing") {
      // --- Джойстик ---
      // Внешнее кольцо
      ctx.beginPath();
      ctx.arc(JOY.cx, JOY.cy, JOY.outerR, 0, Math.PI*2);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Крестик-направления (подсказка)
      ctx.strokeStyle = "rgba(255,255,255,0.20)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(JOY.cx - JOY.outerR + 10, JOY.cy);
      ctx.lineTo(JOY.cx + JOY.outerR - 10, JOY.cy);
      ctx.moveTo(JOY.cx, JOY.cy - JOY.outerR + 10);
      ctx.lineTo(JOY.cx, JOY.cy + JOY.outerR - 10);
      ctx.stroke();

      // Ручка джойстика
      ctx.beginPath();
      ctx.arc(JOY.stickX, JOY.stickY, JOY.innerR, 0, Math.PI*2);
      ctx.fillStyle = JOY.active ? "rgba(255,213,79,0.65)" : "rgba(255,255,255,0.35)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // --- Кнопка выстрела ---
      ctx.beginPath();
      ctx.arc(BTN_SHOOT.cx, BTN_SHOOT.cy, BTN_SHOOT.r, 0, Math.PI*2);
      ctx.fillStyle = BTN_SHOOT.touchId !== null
        ? "rgba(255,213,79,0.65)"
        : "rgba(139,69,19,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "36px Arial";
      ctx.textAlign = "center";
      ctx.fillText(BTN_SHOOT.label, BTN_SHOOT.cx, BTN_SHOOT.cy + 13);

    } else {
      // --- Кнопка действия (старт / в меню) ---
      const label = gameState === "start" ? "▶ ИГРАТЬ" : "↩ МЕНЮ";
      const t = Date.now() * 0.003;
      const sc = 1 + Math.sin(t) * 0.04;
      ctx.translate(BTN_ACTION.cx, BTN_ACTION.cy);
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.roundRect(-130, -36, 260, 72, 36);
      ctx.fillStyle = "#ffd54f";
      ctx.fill();
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "#1a1a2e";
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 11);
    }

    ctx.restore();
  }

  // Экспортируем функцию в глобальный скоуп
  window.drawTouchControls = drawTouchControls;

} else {
  // На десктопе — заглушка, чтобы renderer.js не падал
  window.drawTouchControls = function() {};
}
