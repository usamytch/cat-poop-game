// ==========================================
// RENDERER-BG — offscreen canvas, background, decor, obstacles
// ==========================================

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
  // Обычный декор рисуется ДО стен (под кирпичами)
  _drawDecorTo(bctx, false);
  // Рисуем только статичные препятствия
  for (const ob of obstacles) {
    if (!ob.moving) _drawObstacleTo(bctx, ob);
  }
  // Вмурованные предметы рисуются ПОСЛЕ стен — поверх кирпичей
  _drawDecorTo(bctx, true);
  // Лампочка подвала рисуется ПОСЛЕ стен — конус света поверх кирпичей
  if (currentLocation.key === "basement" &&
      currentLocation.decorations.includes("bulb")) {
    _drawBasementBulb(bctx);
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
      // Lower alpha for tile grid — it's a dense pattern and looks like a debug overlay at 0.38
      bctx.globalAlpha = 0.13;
      bctx.strokeStyle = p.trim; bctx.lineWidth = 1;
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
    case "stone_patch": {
      // Каменная плитка подвала — тёмные прямоугольники с трещинами
      bctx.fillStyle = "#2a2420";
      bctx.beginPath(); bctx.roundRect(x + 4, y + 4, w - 8, h - 8, 4); bctx.fill();
      bctx.strokeStyle = "#3e3530"; bctx.lineWidth = 1;
      // Сетка плит
      const ps = Math.floor(w / 2);
      for (let px = x + 4; px < x + w - 4; px += ps) {
        bctx.beginPath(); bctx.moveTo(px, y + 4); bctx.lineTo(px, y + h - 4); bctx.stroke();
      }
      for (let py = y + 4; py < y + h - 4; py += ps) {
        bctx.beginPath(); bctx.moveTo(x + 4, py); bctx.lineTo(x + w - 4, py); bctx.stroke();
      }
      break;
    }
    case "fishBones": {
      // Вмурованный предмет — полупрозрачный, кирпичи просвечивают сквозь него
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Рыбий скелет: позвоночник
      bctx.strokeStyle = "#c8c0b0"; bctx.lineWidth = 1.5;
      bctx.beginPath(); bctx.moveTo(x + 5, y + h / 2); bctx.lineTo(x + w - 5, y + h / 2); bctx.stroke();
      // Рёбра
      bctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const rx = x + 8 + i * 7;
        bctx.beginPath(); bctx.moveTo(rx, y + h / 2); bctx.lineTo(rx - 3, y + h / 2 - 6); bctx.stroke();
        bctx.beginPath(); bctx.moveTo(rx, y + h / 2); bctx.lineTo(rx - 3, y + h / 2 + 6); bctx.stroke();
      }
      // Голова (треугольник)
      bctx.beginPath();
      bctx.moveTo(x + 5, y + h / 2 - 4); bctx.lineTo(x + 5, y + h / 2 + 4); bctx.lineTo(x + 2, y + h / 2);
      bctx.closePath(); bctx.stroke();
      break;
    }
    case "ragMouse": {
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Тело мышки (эллипс)
      bctx.fillStyle = "#9a8878";
      bctx.beginPath(); bctx.ellipse(x + w / 2, y + h * 0.64, 10, 7, 0, 0, Math.PI * 2); bctx.fill();
      // Ушки (два кружка)
      bctx.beginPath(); bctx.arc(x + w / 2 - 7, y + h * 0.38, 5, 0, Math.PI * 2); bctx.fill();
      bctx.beginPath(); bctx.arc(x + w / 2 + 3, y + h * 0.36, 4, 0, Math.PI * 2); bctx.fill();
      // Хвостик (дуга)
      bctx.strokeStyle = "#9a8878"; bctx.lineWidth = 1.2;
      bctx.beginPath(); bctx.arc(x + w - 6, y + h * 0.76, 6, Math.PI * 1.2, Math.PI * 0.2); bctx.stroke();
      break;
    }
    case "teddyBear": {
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Тело
      bctx.fillStyle = "#8b6848";
      bctx.beginPath(); bctx.ellipse(x + w / 2, y + h * 0.72, 8, 10, 0, 0, Math.PI * 2); bctx.fill();
      // Голова
      bctx.beginPath(); bctx.arc(x + w / 2, y + h * 0.42, 9, 0, Math.PI * 2); bctx.fill();
      // Ушки
      bctx.beginPath(); bctx.arc(x + w / 2 - 8, y + h * 0.28, 5, 0, Math.PI * 2); bctx.fill();
      bctx.beginPath(); bctx.arc(x + w / 2 + 8, y + h * 0.28, 5, 0, Math.PI * 2); bctx.fill();
      // Мордочка (тёмный нос)
      bctx.fillStyle = "#5a3020";
      bctx.beginPath(); bctx.arc(x + w / 2, y + h * 0.46, 3, 0, Math.PI * 2); bctx.fill();
      break;
    }
    case "toyCar": {
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Кузов
      bctx.fillStyle = "#aa3830";
      bctx.fillRect(x + 4, y + h * 0.48, w - 8, h * 0.22);
      // Кабина
      bctx.fillRect(x + 8, y + h * 0.34, w - 18, h * 0.16);
      // Колёса
      bctx.fillStyle = "#4a3a28";
      bctx.beginPath(); bctx.arc(x + 9, y + h * 0.73, 5, 0, Math.PI * 2); bctx.fill();
      bctx.beginPath(); bctx.arc(x + w - 9, y + h * 0.73, 5, 0, Math.PI * 2); bctx.fill();
      break;
    }
    case "toyPlane": {
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Фюзеляж (горизонтальный)
      bctx.fillStyle = "#3858a8";
      bctx.fillRect(x + 4, y + h / 2 - 3, w - 8, 6);
      // Крылья (треугольники вверх и вниз)
      bctx.beginPath();
      bctx.moveTo(x + w / 2 - 2, y + h / 2);
      bctx.lineTo(x + 5, y + h / 2 - 10);
      bctx.lineTo(x + 5, y + h / 2 + 2);
      bctx.closePath(); bctx.fill();
      bctx.beginPath();
      bctx.moveTo(x + w / 2 - 2, y + h / 2);
      bctx.lineTo(x + 5, y + h / 2 + 10);
      bctx.lineTo(x + 5, y + h / 2 + 2);
      bctx.closePath(); bctx.fill();
      // Хвостовое оперение
      bctx.beginPath();
      bctx.moveTo(x + w - 6, y + h / 2 - 3);
      bctx.lineTo(x + w - 6, y + h / 2 - 10);
      bctx.lineTo(x + w - 13, y + h / 2 - 3);
      bctx.closePath(); bctx.fill();
      break;
    }
    case "juiceCan": {
      bctx.globalAlpha = BASEMENT.wallEmbedAlpha;
      // Тело банки (цилиндр)
      bctx.fillStyle = "#aa6820";
      bctx.fillRect(x + 9, y + h * 0.28, w - 18, h * 0.52);
      // Крышка (эллипс сверху)
      bctx.beginPath(); bctx.ellipse(x + w / 2, y + h * 0.28, (w - 18) / 2, 4, 0, 0, Math.PI * 2); bctx.fill();
      // Дно (эллипс снизу)
      bctx.beginPath(); bctx.ellipse(x + w / 2, y + h * 0.80, (w - 18) / 2, 4, 0, 0, Math.PI * 2); bctx.fill();
      // Блик (светлая полоска)
      bctx.fillStyle = "rgba(255,200,100,0.35)";
      bctx.fillRect(x + 11, y + h * 0.30, 4, h * 0.48);
      break;
    }
    default:
      break;
  }
  bctx.globalAlpha = 1;
  bctx.restore();
}

function _drawDecorTo(bctx, wallEmbedOnly) {
  for (const d of decorItems) {
    if (wallEmbedOnly ? d.wallEmbed : !d.wallEmbed) _drawDecorItemTo(bctx, d);
  }
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
  // Ground shadow — ellipse for organic shapes, rect for furniture
  if (type === "plant" || type === "tree" || type === "bush") {
    bctx.fillStyle = currentLocation.palette.shadow;
    bctx.beginPath(); bctx.ellipse(w/2, h-4, w*0.42, 7, 0, 0, Math.PI*2); bctx.fill();
  } else {
    bctx.fillStyle = currentLocation.palette.shadow; bctx.fillRect(8, h-10, w-16, 12);
  }
  switch (type) {
    case "wardrobe": case "cabinet": case "fridge":
      _rrectTo(bctx,0,0,w,h,10,meta.color); _rrectTo(bctx,8,8,w-16,h-16,8,meta.detail);
      // Divider line
      bctx.fillStyle = meta.color; bctx.fillRect(w/2-3,12,6,h-24);
      // Door handles — visible contrasting rounded rects
      _rrectTo(bctx, w/4-3, h/2-7, 6, 14, 3, meta.detail === "#c89b6d" ? "#5a3010" : "#4a7a90");
      _rrectTo(bctx, w*3/4-3, h/2-7, 6, 14, 3, meta.detail === "#c89b6d" ? "#5a3010" : "#4a7a90");
      // Top-edge sheen — narrow rounded strip, not a floating rect
      _rrectTo(bctx, 12, 10, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      break;
    case "dresser": case "counter":
      _rrectTo(bctx,0,0,w,h,10,meta.color);
      for (let i=1; i<=3; i++) {
        const dy=(h/4)*i-10;
        bctx.fillStyle=meta.detail; bctx.fillRect(10,dy,w-20,12);
        // Drawer pull — small dark rounded rect centered on each drawer
        _rrectTo(bctx, w/2-6, dy+3, 12, 6, 3, "rgba(0,0,0,0.28)");
      }
      // Top-edge sheen
      _rrectTo(bctx, 12, 10, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      break;
    case "armchair": case "rockingChair":
      _rrectTo(bctx,10,18,w-20,h-18,18,meta.color); _rrectTo(bctx,0,0,w,34,16,meta.detail);
      // Seat cushion — slightly lighter inset rounded rect
      _rrectTo(bctx, 16, 36, w-32, h-54, 12, "rgba(255,255,255,0.22)");
      bctx.fillStyle = meta.color; bctx.fillRect(8,h-18,10,18); bctx.fillRect(w-18,h-18,10,18);
      if (type === "rockingChair") { bctx.strokeStyle=meta.detail; bctx.lineWidth=4; bctx.beginPath(); bctx.arc(w/2,h-2,w/2-8,Math.PI*0.1,Math.PI*0.9); bctx.stroke(); }
      // Top-edge sheen on backrest
      _rrectTo(bctx, 8, 6, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      break;
    case "plant": case "tree": case "bush":
      // Trunk (not for bush — it has no trunk)
      if (type !== "bush") {
        bctx.fillStyle = meta.detail; bctx.fillRect(w/2-10,h*0.45,20,h*0.55);
      }
      // Fix: separate beginPath per circle to avoid triangle artifacts between arcs
      bctx.fillStyle = meta.color;
      bctx.beginPath(); bctx.arc(w/2,   h*0.28, w*0.28, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w*0.32, h*0.42, w*0.22, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w*0.68, h*0.42, w*0.22, 0, Math.PI*2); bctx.fill();
      if (type === "plant") {
        // Pot body
        _rrectTo(bctx, w/2-18, h-20, 36, 20, 6, meta.detail);
        // Pot rim — slightly wider lighter strip at top of pot
        _rrectTo(bctx, w/2-20, h-22, 40, 6, 3, "rgba(255,255,255,0.25)");
      }
      // No highlight for organic shapes
      break;
    case "sink":
      _rrectTo(bctx,10,0,w-20,26,10,meta.detail); _rrectTo(bctx,0,18,w,h-18,12,meta.color);
      // Faucet
      bctx.fillStyle = "#9bb7c7"; bctx.fillRect(w/2-4,6,8,18);
      // Drain hole — small dark circle in basin center
      bctx.fillStyle = "rgba(0,0,0,0.30)";
      bctx.beginPath(); bctx.arc(w/2, h*0.65, 5, 0, Math.PI*2); bctx.fill();
      // Drain ring
      bctx.strokeStyle = "rgba(0,0,0,0.18)"; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(w/2, h*0.65, 9, 0, Math.PI*2); bctx.stroke();
      break;
    case "toilet":
      _rrectTo(bctx,12,0,w-24,28,10,meta.detail);
      _rrectTo(bctx,18,24,w-36,26,12,meta.color);
      _rrectTo(bctx,8,44,w-16,h-44,18,meta.detail);
      // Flush button on tank
      _rrectTo(bctx, w/2-8, 8, 16, 10, 4, "rgba(0,0,0,0.18)");
      // Seat hinge dots
      bctx.fillStyle = "rgba(0,0,0,0.22)";
      bctx.beginPath(); bctx.arc(w/2-10, 26, 3, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w/2+10, 26, 3, 0, Math.PI*2); bctx.fill();
      break;
    case "laundry": case "barrel":
      _rrectTo(bctx,8,0,w-16,h,18,meta.color);
      bctx.strokeStyle=meta.detail; bctx.lineWidth=4;
      bctx.strokeRect(14,12,w-28,h-24); bctx.strokeRect(14,h/2-8,w-28,16);
      if (type === "laundry") {
        // Lid line across top
        bctx.strokeStyle = "rgba(0,0,0,0.20)"; bctx.lineWidth = 3;
        bctx.beginPath(); bctx.moveTo(14,20); bctx.lineTo(w-14,20); bctx.stroke();
        // Lid handle — small rounded rect
        _rrectTo(bctx, w/2-10, 12, 20, 8, 4, "rgba(0,0,0,0.22)");
      } else {
        // Barrel: extra metal ring near bottom
        bctx.strokeStyle=meta.detail; bctx.lineWidth=3;
        bctx.strokeRect(14, h*0.72, w-28, 10);
      }
      // No wide highlight for laundry/barrel — rounded body doesn't suit a rect sheen
      break;
    case "table": case "bench": case "woodpile":
      // Tabletop
      _rrectTo(bctx,0,0,w,20,10,meta.detail);
      bctx.fillStyle = meta.color;
      if (type === "table") {
        // Varying leg thickness: left thin (8px), inner-left (10px), inner-right (10px), right thick (14px)
        bctx.fillRect(10,   18, 8,  h-18);
        bctx.fillRect(Math.floor(w/3)-5, 18, 10, h-18);
        bctx.fillRect(Math.floor(w*2/3)-5, 18, 10, h-18);
        bctx.fillRect(w-24, 18, 14, h-18);
      } else {
        bctx.fillRect(10,18,12,h-18); bctx.fillRect(w-22,18,12,h-18);
      }
      if (type === "bench") {
        // Seat slats — vertical lines across the top surface
        bctx.strokeStyle = "rgba(0,0,0,0.18)"; bctx.lineWidth = 2;
        for (let s=1; s<=2; s++) {
          const sx = Math.floor(w * s / 3);
          bctx.beginPath(); bctx.moveTo(sx, 2); bctx.lineTo(sx, 18); bctx.stroke();
        }
      }
      if (type === "woodpile") { for (let j=0; j<4; j++) { bctx.fillStyle=meta.detail; bctx.beginPath(); bctx.arc(24+j*((w-48)/3),h-18,12,0,Math.PI*2); bctx.fill(); } }
      // Narrow sheen on tabletop edge only
      _rrectTo(bctx, 10, 3, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      break;
    case "stool": case "crate":
      // No white highlight for crate/stool — it clashes with the X pattern
      _rrectTo(bctx,0,0,w,h,10,meta.color); bctx.strokeStyle=meta.detail; bctx.lineWidth=3;
      bctx.strokeRect(8,8,w-16,h-16);
      bctx.beginPath(); bctx.moveTo(8,8); bctx.lineTo(w-8,h-8); bctx.moveTo(w-8,8); bctx.lineTo(8,h-8); bctx.stroke();
      if (type === "crate") {
        // Nail dots at corners of inner rect
        bctx.fillStyle = "rgba(0,0,0,0.35)";
        [[10,10],[w-10,10],[10,h-10],[w-10,h-10]].forEach(([nx,ny]) => {
          bctx.beginPath(); bctx.arc(nx, ny, 2.5, 0, Math.PI*2); bctx.fill();
        });
      }
      break;
    // ===== ПОДВАЛ =====
    case "wall_h": case "wall_v": {
      // Кирпичная стена — тёмный блок с кирпичными швами
      _rrectTo(bctx, 0, 0, w, h, 4, meta.color);
      bctx.strokeStyle = meta.detail; bctx.lineWidth = 1;
      if (type === "wall_h") {
        // Горизонтальные швы
        const bH = 10;
        for (let by = bH; by < h; by += bH) {
          bctx.beginPath(); bctx.moveTo(0, by); bctx.lineTo(w, by); bctx.stroke();
        }
        // Вертикальные швы — кирпичная раскладка
        const bW = 20;
        let row = 0;
        for (let by = 0; by < h; by += bH, row++) {
          const off = (row % 2) * (bW / 2);
          for (let bx = off; bx < w; bx += bW) {
            bctx.beginPath(); bctx.moveTo(bx, by); bctx.lineTo(bx, by + bH); bctx.stroke();
          }
        }
      } else {
        // Вертикальная стена — те же кирпичи 20×10px, что и у wall_h (running bond)
        // Одинаковые пропорции делают горизонтальные и вертикальные стены частью
        // одной кирпичной кладки.
        const bH = 10, bW = 20;
        // Горизонтальные швы
        for (let by = bH; by < h; by += bH) {
          bctx.beginPath(); bctx.moveTo(0, by); bctx.lineTo(w, by); bctx.stroke();
        }
        // Вертикальные швы — кирпичная раскладка (offset через строку)
        let row = 0;
        for (let by = 0; by < h; by += bH, row++) {
          const off = (row % 2) * (bW / 2);
          for (let bx = off; bx < w; bx += bW) {
            bctx.beginPath(); bctx.moveTo(bx, by); bctx.lineTo(bx, by + bH); bctx.stroke();
          }
        }
      }
      break;
    }
    case "pipe": {
      // Вертикальная труба — серый цилиндр с фланцами и бликом
      _rrectTo(bctx, w/2 - 6, 0, 12, h, 4, meta.color);
      // Фланцы сверху и снизу
      _rrectTo(bctx, w/2 - 10, 0, 20, 8, 3, meta.detail);
      _rrectTo(bctx, w/2 - 10, h - 8, 20, 8, 3, meta.detail);
      // Блик
      _rrectTo(bctx, w/2 - 3, 10, 3, h - 20, 2, "rgba(255,255,255,0.18)");
      break;
    }
    case "crate_stack": {
      // Стопка ящиков — несколько смещённых прямоугольников
      const boxH = Math.max(16, Math.floor(h / 3));
      for (let i = 0; i < 3 && i * boxH < h; i++) {
        const by = h - (i + 1) * boxH;
        const bx = (i % 2) * 4;
        _rrectTo(bctx, bx, by, w - bx - 2, boxH - 2, 4, meta.color);
        bctx.strokeStyle = meta.detail; bctx.lineWidth = 2;
        bctx.strokeRect(bx + 4, by + 4, w - bx - 10, boxH - 10);
        bctx.beginPath();
        bctx.moveTo(bx + 4, by + 4); bctx.lineTo(w - bx - 6, by + boxH - 6);
        bctx.moveTo(w - bx - 6, by + 4); bctx.lineTo(bx + 4, by + boxH - 6);
        bctx.stroke();
      }
      break;
    }
    case "barrel_stack": {
      // Стопка бочек — ряд бочек
      const barrelW = Math.max(20, Math.floor(w / 2));
      const barrelH = Math.min(h, 36);
      const count = Math.max(1, Math.floor(w / barrelW));
      for (let i = 0; i < count; i++) {
        const bx = i * barrelW + 2;
        _rrectTo(bctx, bx, h - barrelH, barrelW - 4, barrelH, 8, meta.color);
        bctx.strokeStyle = meta.detail; bctx.lineWidth = 2;
        bctx.strokeRect(bx + 4, h - barrelH + 6, barrelW - 12, barrelH - 12);
        bctx.strokeRect(bx + 4, h - barrelH + barrelH / 2 - 4, barrelW - 12, 8);
      }
      // Второй ряд если высота позволяет
      if (h > barrelH + 10) {
        for (let i = 0; i < count - 1; i++) {
          const bx = i * barrelW + barrelW / 2 + 2;
          _rrectTo(bctx, bx, h - barrelH * 2 + 4, barrelW - 4, barrelH, 8, meta.color);
          bctx.strokeStyle = meta.detail; bctx.lineWidth = 2;
          bctx.strokeRect(bx + 4, h - barrelH * 2 + 10, barrelW - 12, barrelH - 12);
        }
      }
      break;
    }
    case "chain": {
      // Цепь — серия соединённых звеньев по вертикали
      const linkH = 10, linkW = 8;
      bctx.strokeStyle = meta.color; bctx.lineWidth = 2.5;
      for (let cy = 4; cy < h - 4; cy += linkH) {
        const isEven = Math.floor(cy / linkH) % 2 === 0;
        if (isEven) {
          bctx.beginPath(); bctx.ellipse(w/2, cy + linkH/2, linkW/2, linkH/2, 0, 0, Math.PI*2); bctx.stroke();
        } else {
          bctx.beginPath(); bctx.ellipse(w/2, cy + linkH/2, linkH/2, linkW/2, 0, 0, Math.PI*2); bctx.stroke();
        }
      }
      // Крюк сверху
      _rrectTo(bctx, w/2 - 5, 0, 10, 6, 3, meta.detail);
      break;
    }
  }
  bctx.restore();
}

// Рисует движущееся препятствие на основном ctx (вызывается каждый кадр)
function drawObstacle(ob) {
  _drawObstacleTo(ctx, ob);
}

// ===== ПАТТЕРНЫ ПОЛА =====
// Все паттерны рисуются с низкой прозрачностью поверх базового цвета пола.
// Это создаёт текстуру без перегруза — едва заметно, но убирает "пустоту".

// Паркет ёлочкой (hall, country) — чередующиеся диагональные полосы 20×20px
function _drawParquet(bctx, b, floorY) {
  const size = 20;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 0.8;
  for (let gx = b.left; gx < b.right; gx += size) {
    for (let gy = floorY; gy < WORLD.height; gy += size) {
      const flip = (((gx - b.left) / size + (gy - floorY) / size) | 0) % 2 === 0;
      bctx.beginPath();
      if (flip) {
        bctx.moveTo(gx, gy);
        bctx.lineTo(gx + size, gy + size);
      } else {
        bctx.moveTo(gx + size, gy);
        bctx.lineTo(gx, gy + size);
      }
      bctx.stroke();
    }
  }
}

// Шахматная плитка (bathroom) — квадраты 30×30px, каждый второй темнее
function _drawCheckerboard(bctx, b, floorY) {
  const size = 30;
  bctx.fillStyle = "rgba(0,0,0,1)";
  for (let gx = b.left; gx < b.right; gx += size) {
    for (let gy = floorY; gy < WORLD.height; gy += size) {
      if ((((gx - b.left) / size + (gy - floorY) / size) | 0) % 2 === 0) {
        bctx.fillRect(gx, gy, size, size);
      }
    }
  }
}

// Горизонтальные доски (kitchen) — полосы 18px с тонкими швами
function _drawPlanks(bctx, b, floorY) {
  const plankH = 18;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 1;
  // Горизонтальные швы между досками
  for (let gy = floorY; gy < WORLD.height; gy += plankH) {
    bctx.beginPath();
    bctx.moveTo(b.left, gy);
    bctx.lineTo(b.right, gy);
    bctx.stroke();
  }
  // Вертикальные стыки — смещены на каждой доске (кирпичная раскладка)
  const plankW = 80;
  let row = 0;
  for (let gy = floorY; gy < WORLD.height; gy += plankH, row++) {
    const offset = (row % 2) * (plankW / 2);
    for (let gx = b.left + offset; gx < b.right; gx += plankW) {
      bctx.beginPath();
      bctx.moveTo(gx, gy);
      bctx.lineTo(gx, gy + plankH);
      bctx.stroke();
    }
  }
}

// Трава с вариациями (street) — noise-based тёмные пятна
function _drawGrassNoise(bctx, b, floorY, seed) {
  const step = 12;
  bctx.fillStyle = "rgba(0,0,0,1)";
  for (let gx = b.left; gx < b.right; gx += step) {
    for (let gy = floorY; gy < WORLD.height; gy += step) {
      // Используем valueNoise из level.js (доступна глобально)
      const n = valueNoise(
        Math.floor((gx - b.left) / step),
        Math.floor((gy - floorY) / step),
        seed
      );
      if (n > 0.62) {
        // Маленькое пятно травы
        bctx.beginPath();
        bctx.ellipse(gx + step / 2, gy + step / 2, step * 0.35, step * 0.25, n * Math.PI, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  }
}

// Каменная плитка с трещинами (basement) — квадраты 40×40px + noise-трещины
function _drawBasementFloor(bctx, b, floorY, seed) {
  const size = GRID; // 40px — совпадает с сеткой
  bctx.strokeStyle = "rgba(255,255,255,1)";
  bctx.lineWidth = 0.8;
  // Горизонтальные швы
  for (let gy = floorY; gy < WORLD.height; gy += size) {
    bctx.beginPath(); bctx.moveTo(b.left, gy); bctx.lineTo(b.right, gy); bctx.stroke();
  }
  // Вертикальные швы
  for (let gx = b.left; gx < b.right; gx += size) {
    bctx.beginPath(); bctx.moveTo(gx, floorY); bctx.lineTo(gx, WORLD.height); bctx.stroke();
  }
  // Трещины — noise-based короткие линии внутри некоторых плит
  bctx.strokeStyle = "rgba(255,255,255,1)";
  bctx.lineWidth = 0.5;
  let crackIdx = 0;
  for (let gx = b.left; gx < b.right; gx += size) {
    for (let gy = floorY; gy < WORLD.height; gy += size) {
      const n = valueNoise(crackIdx, Math.floor((gy - floorY) / size), seed + 3);
      crackIdx++;
      if (n > 0.72) {
        // Диагональная трещина внутри плиты
        const cx = gx + size * 0.3 + n * size * 0.2;
        const cy = gy + size * 0.2;
        bctx.beginPath();
        bctx.moveTo(cx, cy);
        bctx.lineTo(cx + size * 0.35, cy + size * 0.55);
        bctx.stroke();
      }
    }
  }
}

// Деревянные доски с сучками (country) — широкие доски 24px + случайные сучки
function _drawWoodPlanks(bctx, b, floorY, seed) {
  const plankH = 24;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 1.5;
  // Горизонтальные швы
  for (let gy = floorY; gy < WORLD.height; gy += plankH) {
    bctx.beginPath();
    bctx.moveTo(b.left, gy);
    bctx.lineTo(b.right, gy);
    bctx.stroke();
  }
  // Сучки — маленькие эллипсы, позиция детерминирована через noise
  bctx.fillStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 0.8;
  let knotIdx = 0;
  for (let gy = floorY + plankH / 2; gy < WORLD.height; gy += plankH) {
    for (let gx = b.left + 40; gx < b.right - 40; gx += 90) {
      const n = valueNoise(knotIdx, Math.floor((gy - floorY) / plankH), seed + 7);
      knotIdx++;
      if (n > 0.55) {
        const kx = gx + (n - 0.55) * 60;
        bctx.beginPath();
        bctx.ellipse(kx, gy, 6, 4, 0, 0, Math.PI * 2);
        bctx.fill();
        bctx.strokeStyle = "rgba(0,0,0,1)";
        bctx.beginPath();
        bctx.ellipse(kx, gy, 10, 7, 0, 0, Math.PI * 2);
        bctx.stroke();
      }
    }
  }
}

// Диспетчер паттернов пола — вызывается из _drawBgTo()
function _drawFloorPattern(bctx, locationKey, seed) {
  const b = getPlayBounds();
  const floorY = WORLD.height - WORLD.floorHeight;
  bctx.save();
  bctx.globalAlpha = 0.10; // едва заметно — текстура, не доминанта
  switch (locationKey) {
    case "hall":     _drawParquet(bctx, b, floorY);              break;
    case "bathroom": _drawCheckerboard(bctx, b, floorY);         break;
    case "kitchen":  _drawPlanks(bctx, b, floorY);               break;
    case "street":   _drawGrassNoise(bctx, b, floorY, seed);     break;
    case "country":  _drawWoodPlanks(bctx, b, floorY, seed);     break;
    case "basement": _drawBasementFloor(bctx, b, floorY, seed);  break;
  }
  bctx.restore();
}

// ===== ПАТТЕРНЫ СТЕН =====
// Все паттерны рисуются с очень низкой прозрачностью (0.07) — фактура, не узор.
// Обрезаются clip-регионом стены, не заходят на пол.

// Обои с ромбами (hall) — диагональная сетка, образующая ромбы
function _drawWallDiamonds(bctx) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const step = 48;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 0.7;
  for (let x = -wallH; x < WORLD.width + wallH; x += step) {
    bctx.beginPath(); bctx.moveTo(x, 0); bctx.lineTo(x + wallH, wallH); bctx.stroke();
    bctx.beginPath(); bctx.moveTo(x, 0); bctx.lineTo(x - wallH, wallH); bctx.stroke();
  }
}

// Кафельная плитка на стене (bathroom) — крупные квадраты 60×60px, кирпичная раскладка
function _drawWallTiles(bctx) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const size = 60;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 1.5;
  for (let y = 0; y < wallH; y += size) {
    bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(WORLD.width, y); bctx.stroke();
  }
  let row = 0;
  for (let y = 0; y < wallH; y += size, row++) {
    const offset = (row % 2) * (size / 2);
    for (let x = offset; x < WORLD.width; x += size) {
      bctx.beginPath(); bctx.moveTo(x, y); bctx.lineTo(x, y + size); bctx.stroke();
    }
  }
}

// Прямоугольные плитки-кафель (kitchen) — фартук 80×40px
function _drawWallKitchenTiles(bctx) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const tileW = 80, tileH = 40;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 1;
  for (let y = 0; y < wallH; y += tileH) {
    bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(WORLD.width, y); bctx.stroke();
  }
  let row = 0;
  for (let y = 0; y < wallH; y += tileH, row++) {
    const offset = (row % 2) * (tileW / 2);
    for (let x = offset; x < WORLD.width; x += tileW) {
      bctx.beginPath(); bctx.moveTo(x, y); bctx.lineTo(x, y + tileH); bctx.stroke();
    }
  }
}

// Лёгкие горизонтальные полосы неба (street) — атмосферные слои
function _drawWallSkyBands(bctx) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const bandH = 28;
  bctx.fillStyle = "rgba(255,255,255,1)";
  for (let y = 0; y < wallH; y += bandH * 2) {
    bctx.fillRect(0, y, WORLD.width, bandH * 0.25);
  }
}

// Кирпичная кладка (basement) — кирпичи 60×20px, кирпичная раскладка, тёмная
function _drawBasementWall(bctx, seed) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const brickW = 60, brickH = 20;
  bctx.strokeStyle = "rgba(255,255,255,1)";
  bctx.lineWidth = 1;
  // Горизонтальные швы
  for (let y = 0; y < wallH; y += brickH) {
    bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(WORLD.width, y); bctx.stroke();
  }
  // Вертикальные швы — кирпичная раскладка (offset через строку)
  let row = 0;
  for (let y = 0; y < wallH; y += brickH, row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let x = offset; x < WORLD.width; x += brickW) {
      bctx.beginPath(); bctx.moveTo(x, y); bctx.lineTo(x, y + brickH); bctx.stroke();
    }
  }
  // Пятна сырости — noise-based тёмные эллипсы
  bctx.fillStyle = "rgba(0,0,0,1)";
  let moistIdx = 0;
  for (let x = 40; x < WORLD.width - 40; x += 120) {
    for (let y = 10; y < wallH - 10; y += 80) {
      const n = valueNoise(moistIdx, Math.floor(y / 80), seed + 11);
      moistIdx++;
      if (n > 0.68) {
        bctx.beginPath();
        bctx.ellipse(x + n * 40, y + n * 20, 18 + n * 12, 10 + n * 8, n * Math.PI, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  }
}

// Вагонка / горизонтальные доски (country) — широкие доски 32px с тенью
function _drawWallPlanks(bctx, seed) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  const plankH = 32;
  bctx.strokeStyle = "rgba(0,0,0,1)";
  bctx.lineWidth = 1.2;
  for (let y = 0; y < wallH; y += plankH) {
    bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(WORLD.width, y); bctx.stroke();
    // Тонкая тень под каждой доской
    bctx.lineWidth = 0.4;
    bctx.beginPath(); bctx.moveTo(0, y + 3); bctx.lineTo(WORLD.width, y + 3); bctx.stroke();
    bctx.lineWidth = 1.2;
  }
  // Редкие вертикальные стыки (как у вагонки)
  bctx.lineWidth = 0.6;
  let row = 0;
  for (let y = 0; y < wallH; y += plankH, row++) {
    const staggerX = (row % 3) * (WORLD.width / 3);
    for (let x = staggerX; x < WORLD.width + WORLD.width / 3; x += (WORLD.width / 3) * 2) {
      if (x > 0 && x < WORLD.width) {
        bctx.beginPath(); bctx.moveTo(x, y); bctx.lineTo(x, y + plankH); bctx.stroke();
      }
    }
  }
}

// Диспетчер паттернов стен — вызывается из _drawBgTo() до декораций
function _drawWallPattern(bctx, locationKey, seed) {
  const wallH = WORLD.height - WORLD.floorHeight - 6;
  bctx.save();
  // Clip: рисуем только в области стены, не заходим на пол
  bctx.beginPath();
  bctx.rect(0, 0, WORLD.width, wallH);
  bctx.clip();
  bctx.globalAlpha = 0.07; // очень тонко — фактура, не доминанта
  switch (locationKey) {
    case "hall":     _drawWallDiamonds(bctx);         break;
    case "bathroom": _drawWallTiles(bctx);             break;
    case "kitchen":  _drawWallKitchenTiles(bctx);      break;
    case "street":   _drawWallSkyBands(bctx);          break;
    case "country":  _drawWallPlanks(bctx, seed);      break;
    case "basement": _drawBasementWall(bctx, seed);    break;
  }
  bctx.restore();
}

// ===== ФОН ЛОКАЦИИ =====
function _drawBgTo(bctx) {
  const p = currentLocation.palette;
  // OPT 13: используем WORLD.width/height вместо canvas.width/height
  bctx.fillStyle = p.wall; bctx.fillRect(0,0,WORLD.width,WORLD.height);
  bctx.fillStyle = p.floor; bctx.fillRect(0,WORLD.height-WORLD.floorHeight,WORLD.width,WORLD.floorHeight);
  bctx.fillStyle = p.trim; bctx.fillRect(0,WORLD.height-WORLD.floorHeight-6,WORLD.width,6);

  // Паттерн стены — рисуется поверх базового цвета стены, до декораций
  _drawWallPattern(bctx, currentLocation.key, levelSeed);

  // Паттерн пола — рисуется поверх базового цвета пола, до декораций стен
  _drawFloorPattern(bctx, currentLocation.key, levelSeed);

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
  // ===== ПОДВАЛ =====
  if (dec.includes("cobweb")) {
    // Паутина в верхнем левом углу
    bctx.save();
    bctx.strokeStyle = "rgba(200,200,200,0.45)"; bctx.lineWidth = 0.8;
    const cx = 60, cy = 20, cr = 55;
    // Радиальные нити
    for (let a = 0; a < Math.PI / 2; a += Math.PI / 8) {
      bctx.beginPath(); bctx.moveTo(cx, cy); bctx.lineTo(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr); bctx.stroke();
    }
    // Концентрические дуги
    for (let r = 12; r <= cr; r += 14) {
      bctx.beginPath(); bctx.arc(cx, cy, r, 0, Math.PI / 2); bctx.stroke();
    }
    bctx.restore();
  }
  if (dec.includes("wallpipe")) {
    // Горизонтальная труба вдоль стены
    bctx.save();
    const py = 110;
    bctx.fillStyle = "#4a4a4a"; bctx.fillRect(0, py - 7, WORLD.width, 14);
    bctx.fillStyle = "#606060"; bctx.fillRect(0, py - 5, WORLD.width, 4); // блик
    // Фланцы
    for (let fx = 80; fx < WORLD.width - 80; fx += 220) {
      bctx.fillStyle = "#3a3a3a"; bctx.fillRect(fx - 8, py - 12, 16, 24);
      bctx.fillStyle = "#555"; bctx.fillRect(fx - 6, py - 10, 12, 20);
    }
    bctx.restore();
  }
  // Лампочка (bulb) намеренно НЕ рисуется здесь — она рисуется в _drawBasementBulb()
  // ПОСЛЕ стен, чтобы конус света был поверх кирпичей, а не под ними.
}

// ===== ЛАМПОЧКА ПОДВАЛА — рисуется поверх всех стен =====
// Вызывается из rebuildBgLayer() после отрисовки статичных препятствий.
// Это гарантирует:
//   1. Конус света поверх кирпичных стен (не закрывается ими)
//   2. Зона вокруг лампочки визуально чистая — патрон и колба перекрывают кирпичи
function _drawBasementBulb(bctx) {
  bctx.save();
  const bx = WORLD.width / 2, by = 18;

  // Конус света — рисуем первым, он самый нижний слой лампочки
  bctx.fillStyle = "rgba(200,160,40,0.07)";
  bctx.beginPath();
  bctx.moveTo(bx - 12, by + 22);
  bctx.lineTo(bx - 90, WORLD.height - WORLD.floorHeight - 6);
  bctx.lineTo(bx + 90, WORLD.height - WORLD.floorHeight - 6);
  bctx.lineTo(bx + 12, by + 22);
  bctx.closePath(); bctx.fill();

  // Зачищаем кирпичи вокруг патрона и колбы — небольшой прямоугольник у потолка
  // Используем цвет стены подвала, чтобы "стереть" кирпичный паттерн
  bctx.fillStyle = "#1e1c1a"; // palette.wall подвала
  bctx.fillRect(bx - 20, 0, 40, by + 36);

  // Провод
  bctx.strokeStyle = "#3a3a3a"; bctx.lineWidth = 2;
  bctx.beginPath(); bctx.moveTo(bx, 0); bctx.lineTo(bx, by); bctx.stroke();

  // Патрон
  _rrectTo(bctx, bx - 6, by, 12, 10, 3, "#4a4a4a");

  // Колба
  bctx.fillStyle = "#c8a840";
  bctx.beginPath(); bctx.arc(bx, by + 22, 12, 0, Math.PI * 2); bctx.fill();

  bctx.restore();
}
