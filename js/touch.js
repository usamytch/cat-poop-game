// ==========================================
// TOUCH — мобильное управление (только IS_MOBILE)
// Виртуальный джойстик + кнопки действий
// Пишет в тот же объект keys{}, что и клавиатура —
// логика игры (entities.js) не меняется.
// ==========================================

if (IS_MOBILE) {

  // ===== БЛОКИРОВКА ОРИЕНТАЦИИ (landscape) =====
  // Пробуем через Screen Orientation API (Chrome/Android).
  // На iOS Safari API недоступен — там работает CSS-оверлей из style.css.
  (function tryLockOrientation() {
    if (typeof screen === "undefined") return; // Node.js / тесты
    const so = screen.orientation || screen.msOrientation || screen.mozOrientation;
    if (so && typeof so.lock === "function") {
      so.lock("landscape").catch(() => {
        // Браузер отклонил (например, не в полноэкранном режиме) — ничего страшного,
        // CSS-оверлей всё равно покажет подсказку при портретном режиме.
      });
    }
  })();


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
  // Кнопка "Старт / Продолжить / Меню" — центр экрана вне активной игры
  const BTN_ACTION = { cx: 600, cy: 560, r: 50, label: "▶", touchId: null };
  // Кнопка мьюта — верхний правый угол, всегда видна
  const BTN_MUTE = { cx: 1155, cy: 45, r: 38 };
  const BTN_PAUSE = { cx: 1070, cy: 45, r: 32 };
  const BTN_EXIT_TUTORIAL = { cx: 600, cy: 520, r: 55 };

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

  function actionCenterY() {
    return gameState === "tutorialComplete" ? 445 : BTN_ACTION.cy;
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

      if (gameState === "playing" && inCircle(x, y, BTN_PAUSE.cx, BTN_PAUSE.cy, BTN_PAUSE.r)) {
        pauseGame("manual");
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
        // Тап по карточкам сложности — проверяем ПЕРВЫМИ, до BTN_ACTION
        // (иначе нижняя карточка "Хаос" перекрывается кругом BTN_ACTION)
        if (gameState === "start") {
          const diffs = ["tutorial", "normal", "chaos"];
          let diffSelected = false;
          diffs.forEach((key, i) => {
            const bx = 135 + i*320, by = 250, bw = 290, bh = 82;
            if (x >= bx && x <= bx+bw && y >= by && y <= by+bh) {
              gameMode = key;
              difficulty = key === "chaos" ? "chaos" : "normal";
              diffSelected = true;
            }
          });
          if (diffSelected) continue;

          if (gameMode !== "tutorial" && y >= 400 && y <= 476) {
            if (x >= 295 && x <= 585) { runMode = "campaign"; continue; }
            if (x >= 615 && x <= 905 && runProfile.unlocks.endless) { runMode = "endless"; continue; }
          }

          if (y >= 488 && y <= 522) {
            if (x < canvas.width/2) cycleRunCosmetic("pawStyles");
            else cycleRunCosmetic("hudFrames");
            continue;
          }
        }

        if (gameState === "actComplete") {
          if (currentHabitChoices.length === 0 && x >= 410 && x <= 790 && y >= 350 && y <= 414) {
            chooseActHabit(0);
            continue;
          }
          const cardW = 300, cardGap = 24;
          const startX = (canvas.width - (cardW*3 + cardGap*2))/2;
          for (let i = 0; i < currentHabitChoices.length; i++) {
            const bx = startX + i*(cardW+cardGap);
            if (x >= bx && x <= bx+cardW && y >= 270 && y <= 494) {
              chooseActHabit(i);
              break;
            }
          }
          continue;
        }

        if (gameState === "paused" && isTutorialActive() &&
            inCircle(x, y, BTN_EXIT_TUTORIAL.cx, BTN_EXIT_TUTORIAL.cy, BTN_EXIT_TUTORIAL.r)) {
          exitTutorialToMenu();
          continue;
        }

        // Кнопка "ИГРАТЬ" / "В меню" — точный радиус без лишнего запаса
        if (inCircle(x, y, BTN_ACTION.cx, actionCenterY(), BTN_ACTION.r)) {
          if (gameState === "start") {
            startGame();
          } else if (gameState === "paused") {
            resumeGame();
          } else if (gameState === "lifeLost") {
            respawnPlayer();
          } else if (gameState === "tutorialComplete") {
            finishTutorialToMenu();
          } else if (gameState === "actComplete") {
            chooseActHabit(0);
          } else {
            gameState = "start";
          }
          continue;
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
      ctx.beginPath();
      ctx.arc(BTN_PAUSE.cx, BTN_PAUSE.cy, BTN_PAUSE.r, 0, Math.PI*2);
      ctx.fillStyle = "rgba(30,30,30,0.60)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.font = "bold 22px Arial";
      ctx.fillStyle = "#fff";
      ctx.fillText("Ⅱ", BTN_PAUSE.cx, BTN_PAUSE.cy + 8);

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
        : tutorialCanShoot() ? "rgba(139,69,19,0.55)" : "rgba(80,80,80,0.40)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "36px Arial";
      ctx.textAlign = "center";
      ctx.fillText(tutorialCanShoot() ? BTN_SHOOT.label : "🔒", BTN_SHOOT.cx, BTN_SHOOT.cy + 13);

    } else {
      if (gameState === "paused" && isTutorialActive()) {
        ctx.beginPath();
        ctx.roundRect(BTN_EXIT_TUTORIAL.cx-110, BTN_EXIT_TUTORIAL.cy-30, 220, 60, 30);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.stroke();
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText("↩ В МЕНЮ", BTN_EXIT_TUTORIAL.cx, BTN_EXIT_TUTORIAL.cy + 7);
      }
      if (gameState === "actComplete") {
        ctx.restore();
        return;
      }
      // --- Кнопка действия (старт / в меню) ---
      const label = gameState === "start" ? "▶ ИГРАТЬ" :
        gameState === "paused" ? "▶ ПРОДОЛЖИТЬ" :
        gameState === "tutorialComplete" ? "▶ ДАЛЬШЕ" : "↩ МЕНЮ";
      const t = Date.now() * 0.003;
      const sc = 1 + Math.sin(t) * 0.04;
      ctx.translate(BTN_ACTION.cx, actionCenterY());
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.roundRect(-130, -30, 260, 60, 30);
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
