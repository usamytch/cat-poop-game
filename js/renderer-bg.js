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

function _strokeRrectTo(bctx, x, y, w, h, r, stroke, lineWidth) {
  bctx.strokeStyle = stroke;
  bctx.lineWidth = lineWidth;
  bctx.beginPath();
  bctx.roundRect(x, y, w, h, r);
  bctx.stroke();
}

function _softLineTo(bctx, x1, y1, x2, y2, stroke, lineWidth) {
  bctx.save();
  bctx.strokeStyle = stroke;
  bctx.lineWidth = lineWidth;
  bctx.lineCap = "round";
  bctx.beginPath();
  bctx.moveTo(x1, y1);
  bctx.lineTo(x2, y2);
  bctx.stroke();
  bctx.restore();
}

function _woodGrainTo(bctx, x, y, w, h, stroke) {
  const lines = Math.max(2, Math.min(4, Math.floor(h / 24)));
  for (let i = 0; i < lines; i++) {
    const yy = y + 12 + i * Math.max(12, (h - 24) / Math.max(1, lines - 1));
    _softLineTo(bctx, x + 16, yy, x + w - 18, yy + (i % 2 ? -2 : 2), stroke, 2);
  }
}

function _simpleWeaveTo(bctx, x, y, w, h, stroke) {
  const cols = Math.max(2, Math.min(5, Math.floor(w / 42)));
  const rows = Math.max(1, Math.min(4, Math.floor(h / 34)));
  for (let i = 1; i < cols; i++) {
    const xx = x + (w * i) / cols;
    _softLineTo(bctx, xx, y + 14, xx, y + h - 14, stroke, 1.5);
  }
  for (let i = 1; i <= rows; i++) {
    const yy = y + (h * i) / (rows + 1);
    _softLineTo(bctx, x + 14, yy, x + w - 14, yy, stroke, 1.5);
  }
}

function _cornerDotsTo(bctx, x, y, w, h, fill) {
  bctx.fillStyle = fill;
  const dots = [
    [x + 18, y + 18],
    [x + w - 18, y + 18],
    [x + 18, y + h - 18],
    [x + w - 18, y + h - 18],
  ];
  for (const [dx, dy] of dots) {
    bctx.beginPath();
    bctx.arc(dx, dy, 3, 0, Math.PI * 2);
    bctx.fill();
  }
}

// ===== РИСОВАНИЕ ДЕКОРА (фоновые элементы, без коллизий) =====
function _drawWallEmbedSocketTo(bctx,d,foreground) {
  const x=d.x,y=d.y,w=d.width,h=d.height,v=d.embedVariant || 0;
  if (!foreground) {
    bctx.globalAlpha=0.72;
    bctx.fillStyle="rgba(8,6,5,0.72)";
    bctx.beginPath();
    bctx.moveTo(x+3+v,y+9); bctx.lineTo(x+9,y+3); bctx.lineTo(x+w-7,y+5+v);
    bctx.lineTo(x+w-3,y+h-10); bctx.lineTo(x+w-10-v,y+h-3);
    bctx.lineTo(x+5,y+h-7); bctx.closePath(); bctx.fill();
    bctx.strokeStyle="rgba(118,94,68,0.62)"; bctx.lineWidth=2;
    bctx.stroke();
    return;
  }
  // Mortar overlaps the object at a few corners, so it looks genuinely trapped
  // in masonry rather than pasted on top of a brick texture.
  bctx.globalAlpha=0.82;
  bctx.fillStyle="#4a3e30";
  [[6,8,7],[w-6,7+v,6],[8,h-6,6],[w-7,h-8,7]].forEach(function(chip,i) {
    if ((i+v)%3===0) return;
    bctx.beginPath(); bctx.arc(x+chip[0],y+chip[1],chip[2],0,Math.PI*2); bctx.fill();
  });
  bctx.strokeStyle="rgba(18,14,11,0.72)"; bctx.lineWidth=1.2;
  bctx.beginPath();
  bctx.moveTo(x+4,y+12+v); bctx.lineTo(x-2,y+17+v); bctx.lineTo(x+3,y+23+v);
  bctx.moveTo(x+w-4,y+h-13); bctx.lineTo(x+w+3,y+h-18); bctx.stroke();
}

function _drawDecorItemTo(bctx, d) {
  const {x, y, width: w, height: h, drawStyle} = d;
  const p = currentLocation.palette;
  bctx.save();
  if (d.wallEmbed) {
    bctx.translate(x+w/2,y+h/2); bctx.rotate(d.rotation || 0); bctx.translate(-x-w/2,-y-h/2);
    _drawWallEmbedSocketTo(bctx,d,false);
  }
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
      bctx.globalAlpha = 0.24;
      _softLineTo(bctx, x + 22, y + 24, x + w - 22, y + 24, p.trim, 2);
      _softLineTo(bctx, x + 22, y + h - 24, x + w - 22, y + h - 24, p.trim, 2);
      _simpleWeaveTo(bctx, x + 18, y + 18, w - 36, h - 36, p.trim);
      _cornerDotsTo(bctx, x + 12, y + 12, w - 24, h - 24, p.trim);
      break;
    }
    case "mat": {
      bctx.fillStyle = p.trim;
      bctx.beginPath(); bctx.roundRect(x + 4, y + 4, w - 8, h - 8, 8); bctx.fill();
      bctx.strokeStyle = p.accent; bctx.lineWidth = 3;
      bctx.beginPath(); bctx.roundRect(x + 8, y + 8, w - 16, h - 16, 5); bctx.stroke();
      bctx.globalAlpha = 0.24;
      _simpleWeaveTo(bctx, x + 10, y + 10, w - 20, h - 20, p.accent);
      _softLineTo(bctx, x + 18, y + h/2, x + w - 18, y + h/2, p.accent, 2);
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
      bctx.globalAlpha = 0.42;
      _softLineTo(bctx, x + 14, y + 18, x + w - 14, y + 18, "#d6c7aa", 2);
      _softLineTo(bctx, x + 14, y + h - 18, x + w - 14, y + h - 18, "#d6c7aa", 2);
      _cornerDotsTo(bctx, x + 4, y + 4, w - 8, h - 8, "#c8b89a");
      break;
    }
    case "tiles_decor": {
      // Lower alpha for tile grid — it's a dense pattern and looks like a debug overlay at 0.38
      bctx.globalAlpha = 0.16;
      bctx.strokeStyle = p.trim; bctx.lineWidth = 1;
      bctx.fillStyle = p.trim;
      const tileSize = GRID / 2;
      for (let ty = y; ty < y + h; ty += tileSize) {
        for (let tx = x; tx < x + w; tx += tileSize) {
          bctx.beginPath();
          bctx.roundRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4, 3);
          bctx.stroke();
          if ((((tx - x) / tileSize + (ty - y) / tileSize) | 0) % 2 === 0) {
            bctx.beginPath();
            bctx.arc(tx + tileSize / 2, ty + tileSize / 2, 2.2, 0, Math.PI * 2);
            bctx.fill();
          }
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
      bctx.globalAlpha = 0.28;
      _softLineTo(bctx, x + w*0.24, y + h*0.48, x + w*0.76, y + h*0.52, "#5f7f45", 2);
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
      bctx.beginPath(); bctx.roundRect(x + 4, y + 4, w - 8, h - 8, 7); bctx.fill();
      bctx.strokeStyle = "#3e3530"; bctx.lineWidth = 1;
      // Сетка плит
      const ps = Math.floor(w / 2);
      for (let px = x + 4; px < x + w - 4; px += ps) {
        bctx.beginPath(); bctx.moveTo(px, y + 4); bctx.lineTo(px, y + h - 4); bctx.stroke();
      }
      for (let py = y + 4; py < y + h - 4; py += ps) {
        bctx.beginPath(); bctx.moveTo(x + 4, py); bctx.lineTo(x + w - 4, py); bctx.stroke();
      }
      bctx.globalAlpha = 0.30;
      _softLineTo(bctx, x + 14, y + 18, x + w - 16, y + h - 20, "#4a4038", 1.5);
      _softLineTo(bctx, x + w - 18, y + 16, x + w*0.58, y + h - 16, "#4a4038", 1.5);
      _cornerDotsTo(bctx, x + 4, y + 4, w - 8, h - 8, "#3e3530");
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
      bctx.fillStyle="#d9d0bd";
      bctx.beginPath(); bctx.arc(x+5,y+h/2-1,1.5,0,Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.moveTo(x+w-5,y+h/2); bctx.lineTo(x+w-1,y+h/2-6); bctx.lineTo(x+w-1,y+h/2+6); bctx.closePath(); bctx.stroke();
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
      // Button eye and a crooked repair stitch sell the rag-doll material.
      bctx.fillStyle="#241b17"; bctx.beginPath(); bctx.arc(x+w*0.43,y+h*0.48,2.2,0,Math.PI*2); bctx.fill();
      bctx.strokeStyle="#d4b487"; bctx.lineWidth=1;
      for (let i=0;i<3;i++) _softLineTo(bctx,x+14+i*4,y+h*0.67-3,x+16+i*4,y+h*0.67+3,"#d4b487",1);
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
      bctx.fillStyle="#241b17";
      bctx.beginPath(); bctx.arc(x+w/2-4,y+h*0.39,1.6,0,Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(x+w/2+4,y+h*0.39,1.6,0,Math.PI*2); bctx.fill();
      bctx.strokeStyle="#d3a879"; bctx.lineWidth=1;
      bctx.beginPath(); bctx.moveTo(x+w/2-5,y+h*0.70); bctx.lineTo(x+w/2,y+h*0.76); bctx.lineTo(x+w/2+5,y+h*0.69); bctx.stroke();
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
      bctx.fillStyle="#7fb3c8"; bctx.beginPath(); bctx.roundRect(x+10,y+h*0.37,w-22,6,2); bctx.fill();
      bctx.fillStyle="#ffd166"; bctx.beginPath(); bctx.arc(x+w-5,y+h*0.56,2.5,0,Math.PI*2); bctx.fill();
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
      // Bent propeller and an off-register star preserve the toy/collage feel.
      bctx.strokeStyle="#9fc4ff"; bctx.lineWidth=1.5;
      bctx.beginPath(); bctx.moveTo(x+3,y+h/2-7); bctx.lineTo(x+3,y+h/2+7); bctx.stroke();
      bctx.fillStyle="#ffd166"; bctx.beginPath(); bctx.arc(x+w*0.62,y+h/2,2.5,0,Math.PI*2); bctx.fill();
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
      bctx.fillStyle="#f1c45d"; bctx.beginPath(); bctx.roundRect(x+13,y+h*0.45,w-26,8,2); bctx.fill();
      bctx.fillStyle="#5b3510"; bctx.font="bold 6px Arial"; bctx.textAlign="center"; bctx.fillText("СОК?",x+w/2,y+h*0.45+6);
      bctx.strokeStyle="#c9a77a"; bctx.lineWidth=1.5;
      bctx.beginPath(); bctx.moveTo(x+w/2+2,y+h*0.27); bctx.lineTo(x+w/2+7,y+h*0.15); bctx.stroke();
      break;
    }
    default:
      break;
  }
  if (d.wallEmbed) _drawWallEmbedSocketTo(bctx,d,true);
  // Интерактивные зоны получают читаемый, но дешёвый знак прямо в offscreen.
  if (d.ruleKind === "hallRug") {
    bctx.globalAlpha = 0.58;
    bctx.strokeStyle = "#fff3b0";
    bctx.lineWidth = 3;
    const cy = y + h / 2;
    for (let i = -1; i <= 1; i++) {
      const ax = x + w / 2 + i * 24;
      bctx.beginPath();
      bctx.moveTo(ax - 9, cy + 8); bctx.lineTo(ax, cy); bctx.lineTo(ax - 9, cy - 8);
      bctx.stroke();
    }
  } else if (d.ruleKind === "bathroomWet") {
    bctx.globalAlpha = 0.32;
    bctx.fillStyle = "#b7f0ff";
    for (let i = 0; i < 5; i++) {
      bctx.beginPath();
      bctx.ellipse(x + 18 + (i * 31) % Math.max(24, w - 30), y + 18 + (i * 19) % Math.max(24, h - 30), 8, 3, 0.3, 0, Math.PI * 2);
      bctx.fill();
    }
  } else if (d.ruleKind === "streetGrass") {
    bctx.globalAlpha = 0.78;
    bctx.strokeStyle = "#365f2b";
    bctx.lineWidth = 3;
    for (let gx = x + 12; gx < x + w - 8; gx += 16) {
      bctx.beginPath();
      bctx.moveTo(gx, y + h - 8);
      bctx.quadraticCurveTo(gx - 7, y + h * 0.55, gx + 2, y + 12);
      bctx.stroke();
    }
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
  // Расплавленная фаза целиком кэшируется в offscreen background. В обычном
  // кадре она не добавляет ни одного draw call сверх общего drawImage слоя.
  if (ob.surrealRule && !ob.ruleSolid) {
    bctx.fillStyle = ob.rulePendingSolid ? "rgba(255,210,80,0.62)" : "rgba(170,65,190,0.52)";
    bctx.beginPath();
    bctx.ellipse(w / 2, h - 10, Math.max(18, w * 0.46), Math.max(9, h * 0.16), 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.strokeStyle = "rgba(80,20,100,0.62)";
    bctx.lineWidth = 3;
    bctx.beginPath();
    bctx.moveTo(w * 0.18, h - 14);
    bctx.bezierCurveTo(w * 0.36, h - 30, w * 0.66, h + 4, w * 0.84, h - 14);
    bctx.stroke();
    bctx.fillStyle = "rgba(255,245,170,0.82)";
    bctx.beginPath(); bctx.arc(w * 0.58, h - 13, 9, 0, Math.PI * 2); bctx.fill();
    bctx.strokeStyle = "rgba(70,35,30,0.76)";
    bctx.lineWidth = 2;
    bctx.beginPath(); bctx.moveTo(w * 0.58, h - 13); bctx.lineTo(w * 0.58, h - 20); bctx.stroke();
    bctx.restore();
    return;
  }
  // Ground shadow — ellipse for organic shapes, rect for furniture
  if (type === "flowerPot" || type === "tree" || type === "bush") {
    bctx.fillStyle = currentLocation.palette.shadow;
    bctx.beginPath(); bctx.ellipse(w/2, h-4, w*0.42, 7, 0, 0, Math.PI*2); bctx.fill();
  } else {
    bctx.fillStyle = currentLocation.palette.shadow;
    bctx.beginPath();
    bctx.ellipse(w/2, h-4, Math.max(12, (w-16)/2), 7, 0, 0, Math.PI*2);
    bctx.fill();
  }
  switch (type) {
    case "wardrobe": case "cabinet": case "fridge":
      _rrectTo(bctx,0,0,w,h,10,meta.color); _rrectTo(bctx,8,8,w-16,h-16,8,meta.detail);
      _strokeRrectTo(bctx,14,14,w-28,h-28,6,"rgba(255,255,255,0.16)",2);
      // Divider line
      _rrectTo(bctx,w/2-3,12,6,h-24,3,meta.color);
      // Door handles — visible contrasting rounded rects
      _rrectTo(bctx, w/4-3, h/2-7, 6, 14, 3, meta.detail === "#c89b6d" ? "#5a3010" : "#4a7a90");
      _rrectTo(bctx, w*3/4-3, h/2-7, 6, 14, 3, meta.detail === "#c89b6d" ? "#5a3010" : "#4a7a90");
      // Top-edge sheen — narrow rounded strip, not a floating rect
      _rrectTo(bctx, 12, 10, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      if (type === "fridge") {
        bctx.fillStyle="#f06f62"; bctx.beginPath(); bctx.arc(w*0.28,h*0.28,5,0,Math.PI*2); bctx.fill();
        bctx.fillStyle="#ffd166"; bctx.beginPath(); bctx.roundRect(w*0.58,h*0.18,14,18,2); bctx.fill();
        _softLineTo(bctx,w*0.60,h*0.23,w*0.70,h*0.23,"#8d6b3f",1);
      } else if (type === "wardrobe") {
        bctx.save(); bctx.translate(w*0.68,h*0.22); bctx.rotate(-0.12);
        bctx.fillStyle="#ead9b8"; bctx.fillRect(-12,-7,24,14);
        bctx.strokeStyle="#6d4930"; bctx.lineWidth=1; bctx.strokeRect(-12,-7,24,14); bctx.restore();
      }
      break;
    case "dresser": case "counter":
      _rrectTo(bctx,0,0,w,h,12,meta.color);
      _woodGrainTo(bctx, 10, 10, w - 20, h - 20, "rgba(255,255,255,0.12)");
      for (let i=1; i<=3; i++) {
        const dy=(h/4)*i-10;
        _rrectTo(bctx,10,dy,w-20,12,3,meta.detail);
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
      _softLineTo(bctx, 22, 42, w - 22, 42, "rgba(255,255,255,0.12)", 2);
      _rrectTo(bctx,8,h-18,10,18,3,meta.color); _rrectTo(bctx,w-18,h-18,10,18,3,meta.color);
      if (type === "rockingChair") { bctx.strokeStyle=meta.detail; bctx.lineWidth=4; bctx.beginPath(); bctx.arc(w/2,h-2,w/2-8,Math.PI*0.1,Math.PI*0.9); bctx.stroke(); }
      // Top-edge sheen on backrest
      _rrectTo(bctx, 8, 6, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      bctx.fillStyle="rgba(60,30,75,0.30)";
      [-1,0,1].forEach(function(i) { bctx.beginPath(); bctx.arc(w/2+i*12,27,3,0,Math.PI*2); bctx.fill(); });
      break;
    case "flowerPot":
      // Indoor flowers for the Hall: a deliberately hand-drawn bouquet rather
      // than the outdoor-looking tree silhouette previously used here.
      bctx.strokeStyle = "#477a42";
      bctx.lineWidth = 4;
      const flowerHeads = [
        [w*0.28, h*0.30, "#ff8fa3"],
        [w*0.50, h*0.20, "#ffd166"],
        [w*0.70, h*0.34, "#b69cff"],
        [w*0.42, h*0.43, "#ff9f68"],
      ];
      for (const [fx, fy, flowerColor] of flowerHeads) {
        bctx.beginPath(); bctx.moveTo(w/2, h-30); bctx.lineTo(fx, fy+6); bctx.stroke();
        bctx.fillStyle = meta.color;
        bctx.beginPath(); bctx.ellipse((w/2+fx)/2-4, (h-30+fy)/2, 9, 4, -0.6, 0, Math.PI*2); bctx.fill();
        bctx.fillStyle = flowerColor;
        for (let petal=0; petal<5; petal++) {
          const a = petal*Math.PI*2/5;
          bctx.beginPath(); bctx.arc(fx+Math.cos(a)*7, fy+Math.sin(a)*7, 5, 0, Math.PI*2); bctx.fill();
        }
        bctx.fillStyle = "#6b4b2a";
        bctx.beginPath(); bctx.arc(fx, fy, 4, 0, Math.PI*2); bctx.fill();
      }
      _rrectTo(bctx, w/2-22, h-34, 44, 34, 8, meta.detail);
      _rrectTo(bctx, w/2-25, h-38, 50, 9, 4, "#d18a5d");
      _softLineTo(bctx, w/2-14, h-27, w/2+13, h-5, "rgba(255,255,255,0.20)", 3);
      break;
    case "tree": case "bush":
      // Trunk (not for bush — it has no trunk)
      if (type !== "bush") {
        _rrectTo(bctx,w/2-10,h*0.45,20,h*0.55,5,meta.detail);
      }
      // Fix: separate beginPath per circle to avoid triangle artifacts between arcs
      bctx.fillStyle = meta.color;
      bctx.beginPath(); bctx.arc(w/2,   h*0.28, w*0.28, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w*0.32, h*0.42, w*0.22, 0, Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w*0.68, h*0.42, w*0.22, 0, Math.PI*2); bctx.fill();
      bctx.fillStyle = "rgba(255,255,255,0.18)";
      bctx.beginPath(); bctx.arc(w*0.42, h*0.28, Math.max(4, w*0.06), 0, Math.PI*2); bctx.fill();
      bctx.fillStyle=type==="bush" ? "#e86f68" : "#f2c14e";
      bctx.beginPath(); bctx.arc(w*0.72,h*0.31,4,0,Math.PI*2); bctx.fill();
      bctx.beginPath(); bctx.arc(w*0.26,h*0.46,3,0,Math.PI*2); bctx.fill();
      // No highlight for organic shapes
      break;
    case "sink":
      _rrectTo(bctx,10,0,w-20,26,10,meta.detail); _rrectTo(bctx,0,18,w,h-18,12,meta.color);
      // Faucet
      _rrectTo(bctx,w/2-4,6,8,18,3,"#9bb7c7");
      // Drain hole — small dark circle in basin center
      bctx.fillStyle = "rgba(0,0,0,0.30)";
      bctx.beginPath(); bctx.arc(w/2, h*0.65, 5, 0, Math.PI*2); bctx.fill();
      // Drain ring
      bctx.strokeStyle = "rgba(0,0,0,0.18)"; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(w/2, h*0.65, 9, 0, Math.PI*2); bctx.stroke();
      _rrectTo(bctx,w*0.64,5,18,10,5,"#f7c6d0");
      bctx.fillStyle="#fff"; bctx.beginPath(); bctx.arc(w*0.72,9,3,0,Math.PI*2); bctx.fill();
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
      bctx.save(); bctx.translate(w*0.76,h*0.70); bctx.rotate(0.18);
      bctx.fillStyle="#9bd7e5"; bctx.fillRect(-7,-5,14,10);
      bctx.fillStyle="#fff"; bctx.fillRect(-5,-3,10,2); bctx.restore();
      break;
    case "laundry": case "barrel":
      _rrectTo(bctx,8,0,w-16,h,18,meta.color);
      bctx.strokeStyle=meta.detail; bctx.lineWidth=4;
      bctx.beginPath(); bctx.roundRect(14,12,w-28,h-24,8); bctx.stroke();
      bctx.beginPath(); bctx.roundRect(14,h/2-8,w-28,16,4); bctx.stroke();
      if (type === "laundry") {
        // Lid line across top
        bctx.strokeStyle = "rgba(0,0,0,0.20)"; bctx.lineWidth = 3;
        bctx.beginPath(); bctx.moveTo(14,20); bctx.lineTo(w-14,20); bctx.stroke();
        // Lid handle — small rounded rect
        _rrectTo(bctx, w/2-10, 12, 20, 8, 4, "rgba(0,0,0,0.22)");
      } else {
        // Barrel: extra metal ring near bottom
        bctx.strokeStyle=meta.detail; bctx.lineWidth=3;
        bctx.beginPath(); bctx.roundRect(14, h*0.72, w-28, 10, 4); bctx.stroke();
      }
      // No wide highlight for laundry/barrel — rounded body doesn't suit a rect sheen
      break;
    case "table": case "bench": case "woodpile":
      // Tabletop
      _rrectTo(bctx,0,0,w,20,10,meta.detail);
      _softLineTo(bctx, 16, 10, w - 18, 10, "rgba(255,255,255,0.14)", 2);
      bctx.fillStyle = meta.color;
      if (type === "table") {
        // Varying leg thickness: left thin (8px), inner-left (10px), inner-right (10px), right thick (14px)
        _rrectTo(bctx,10,18,8,h-18,3,meta.color);
        _rrectTo(bctx,Math.floor(w/3)-5,18,10,h-18,3,meta.color);
        _rrectTo(bctx,Math.floor(w*2/3)-5,18,10,h-18,3,meta.color);
        _rrectTo(bctx,w-24,18,14,h-18,4,meta.color);
      } else {
        _rrectTo(bctx,10,18,12,h-18,4,meta.color); _rrectTo(bctx,w-22,18,12,h-18,4,meta.color);
      }
      if (type === "bench") {
        // Seat slats — vertical lines across the top surface
        bctx.strokeStyle = "rgba(0,0,0,0.18)"; bctx.lineWidth = 2;
        for (let s=1; s<=2; s++) {
          const sx = Math.floor(w * s / 3);
          bctx.beginPath(); bctx.moveTo(sx, 2); bctx.lineTo(sx, 18); bctx.stroke();
        }
      }
      if (type === "table") {
        bctx.fillStyle="#f2d38b";
        bctx.beginPath(); bctx.moveTo(w*0.62,0); bctx.lineTo(w*0.82,0); bctx.lineTo(w*0.78,24); bctx.lineTo(w*0.66,18); bctx.closePath(); bctx.fill();
        bctx.strokeStyle="#c06d52"; bctx.lineWidth=1;
        _softLineTo(bctx,w*0.66,4,w*0.79,15,"#c06d52",1);
      }
      if (type === "woodpile") { for (let j=0; j<4; j++) { bctx.fillStyle=meta.detail; bctx.beginPath(); bctx.arc(24+j*((w-48)/3),h-18,12,0,Math.PI*2); bctx.fill(); } }
      // Narrow sheen on tabletop edge only
      _rrectTo(bctx, 10, 3, Math.min(w*0.28, 36), 6, 3, "rgba(255,255,255,0.22)");
      break;
    case "stool": case "crate":
      // No white highlight for crate/stool — it clashes with the X pattern
      _rrectTo(bctx,0,0,w,h,12,meta.color); bctx.strokeStyle=meta.detail; bctx.lineWidth=3;
      bctx.beginPath(); bctx.roundRect(8,8,w-16,h-16,5); bctx.stroke();
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
  if (ob.surrealRule) {
    // Собственная сюрреалистическая грамматика: длинные ноги и мягкие часы,
    // без копирования конкретной картины или дорогих Canvas filters.
    bctx.strokeStyle = "rgba(82,31,104,0.72)";
    bctx.lineWidth = 4;
    bctx.beginPath();
    bctx.moveTo(w * 0.22, h * 0.72); bctx.lineTo(w * 0.14, h + 18);
    bctx.moveTo(w * 0.78, h * 0.72); bctx.lineTo(w * 0.86, h + 18);
    bctx.stroke();
    bctx.fillStyle = "rgba(255,232,142,0.86)";
    bctx.beginPath();
    bctx.ellipse(w * 0.68, Math.max(16, h * 0.24), 18, 12, 0.28, 0, Math.PI * 2);
    bctx.fill();
    bctx.strokeStyle = "rgba(75,42,30,0.82)";
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.moveTo(w * 0.68, Math.max(16, h * 0.24));
    bctx.lineTo(w * 0.68 + 7, Math.max(16, h * 0.24) - 4);
    bctx.stroke();
  }
  bctx.restore();
}

// Рисует движущееся препятствие на основном ctx (вызывается каждый кадр)
function drawObstacle(ob) {
  _drawObstacleTo(ctx, ob);
}

// Небольшие интерактивные сигналы. Дача здесь рисует только телеграф смены;
// сама мебель уже запечена в offscreen слое.
function drawLocationRuleDynamic() {
  if (locationRuleState.key === "hall" && locationRuleState.hallCharge > 0.08) {
    ctx.save();
    ctx.globalAlpha = 0.18 + locationRuleState.hallCharge * 0.42;
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const back = 14 + i * 11;
      ctx.beginPath();
      ctx.moveTo(player.x + player.size / 2 - locationRuleState.hallDirX * back - locationRuleState.hallDirY * 8,
                 player.y + player.size / 2 - locationRuleState.hallDirY * back + locationRuleState.hallDirX * 8);
      ctx.lineTo(player.x + player.size / 2 - locationRuleState.hallDirX * (back + 12) - locationRuleState.hallDirY * 8,
                 player.y + player.size / 2 - locationRuleState.hallDirY * (back + 12) + locationRuleState.hallDirX * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (locationRuleState.key === "kitchen") {
    for (const d of decorItems) {
      if (d.ruleKind !== "kitchenFood" || d.ruleConsumed) continue;
      const cx = d.x + d.width / 2;
      const cy = d.y + d.height / 2;
      ctx.save();
      ctx.fillStyle = "rgba(255,248,220,0.88)";
      ctx.beginPath(); ctx.ellipse(cx, cy + 8, 25, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(130,70,20,0.55)"; ctx.lineWidth = 2; ctx.stroke();
      drawEmoji("🍗", cx, cy, 30);
      ctx.restore();
    }
  }

  if (locationRuleState.key === "country") {
    const rule = LOCATION_RULES.country;
    if (locationRuleState.countryPhaseTicks <= rule.telegraphTicks) {
      const ratio = 1 - locationRuleState.countryPhaseTicks / rule.telegraphTicks;
      ctx.save();
      ctx.globalAlpha = 0.18 + ratio * 0.42;
      ctx.strokeStyle = locationRuleState.countryPhase === 0 ? "#ffea70" : "#ef75ff";
      ctx.lineWidth = 4 + ratio * 5;
      const inset = 10 + ratio * 12;
      ctx.strokeRect(inset, WORLD.topPadding + inset, WORLD.width - inset * 2, getPlayBounds().bottom - inset * 2);
      ctx.globalAlpha = 0.16 + ratio * 0.22;
      for (let i = 0; i < 7; i++) {
        const y = 70 + i * 72;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(300, y - 22, 760, y + 28, WORLD.width, y - 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawLocationRuleForeground() {
  if (locationRuleState.key !== "street") return;
  const grass = _entityCenterInRuleDecor(player, "streetGrass");
  if (!grass) return;
  ctx.save();
  ctx.strokeStyle = locationRuleState.streetHidden ? "rgba(55,105,42,0.96)" : "rgba(65,120,48,0.80)";
  ctx.lineWidth = 4;
  const baseY = player.y + player.size + 5;
  for (let i = 0; i < 5; i++) {
    const x = player.x - 3 + i * 11;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x - 5, baseY - 17, x + 2, baseY - 34 - (i % 2) * 7);
    ctx.stroke();
  }
  if (locationRuleState.streetHidden) {
    ctx.fillStyle = "rgba(20,45,16,0.82)";
    ctx.beginPath(); ctx.roundRect(player.x - 9, player.y - 25, 54, 22, 10); ctx.fill();
    ctx.fillStyle = "#dff5d6";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("НЕ ВИДНО", player.x + player.size / 2, player.y - 10);
  }
  ctx.restore();
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

function _drawCountrySurrealBackground(bctx) {
  if (currentLocation.key !== "country") return;
  const step = (currentLevelProgression || getLevelProgression(level)).actStep;
  const intensity = step / ACT.length;
  const floorBottom = WORLD.height - WORLD.floorHeight - 6;
  bctx.save();
  bctx.globalAlpha = 0.08 + intensity * 0.16;

  // Невозможное внутреннее солнце и цветовые кольца — один раз в offscreen.
  const sx = WORLD.width * 0.54;
  const sy = 118;
  const colors = ["#ffef6e", "#ff7b5f", "#bb5cff", "#4ed7c8"];
  for (let i = 4; i >= 0; i--) {
    bctx.fillStyle = colors[i % colors.length];
    bctx.beginPath(); bctx.arc(sx, sy, 34 + i * 24 * intensity, 0, Math.PI * 2); bctx.fill();
  }

  bctx.strokeStyle = "#5c276f";
  bctx.lineWidth = 5;
  const waveCount = 2 + step;
  for (let i = 0; i < waveCount; i++) {
    const y = 250 + i * ((floorBottom - 270) / Math.max(1, waveCount - 1));
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.bezierCurveTo(260, y - 45 * intensity, 720, y + 55 * intensity, WORLD.width, y - 8);
    bctx.stroke();
  }

  // Парящие ящики и отдельные тени становятся заметнее по мере трипа.
  for (let i = 0; i < step + 1; i++) {
    const x = 120 + ((i * 197 + levelSeed) % 860);
    const y = 150 + ((i * 83 + levelSeed) % 280);
    bctx.fillStyle = colors[(i + 1) % colors.length];
    bctx.beginPath(); bctx.roundRect(x, y, 34, 20, 7); bctx.fill();
    bctx.fillStyle = "rgba(40,15,55,0.60)";
    bctx.beginPath(); bctx.ellipse(x + 42, y + 42, 28, 8, 0.2, 0, Math.PI * 2); bctx.fill();
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
  if (dec.includes("window"))   { _rrectTo(bctx,70,70,170,120,18,"#dff4ff"); _strokeRrectTo(bctx,70,70,170,120,18,p.trim,6); _softLineTo(bctx,155,74,155,186,p.trim,4); _softLineTo(bctx,74,130,236,130,p.trim,4); _softLineTo(bctx,92,92,128,92,"rgba(255,255,255,0.55)",5); }
  if (dec.includes("painting")) { _rrectTo(bctx,WORLD.width-260,80,150,90,14,p.accent); _strokeRrectTo(bctx,WORLD.width-260,80,150,90,14,p.trim,5); bctx.fillStyle="rgba(120,80,40,0.25)"; bctx.beginPath(); bctx.arc(WORLD.width-185,125,24,0,Math.PI*2); bctx.fill(); _softLineTo(bctx,WORLD.width-240,150,WORLD.width-130,150,"rgba(255,255,255,0.18)",3); }
  if (dec.includes("lamp"))     { _rrectTo(bctx,WORLD.width-120,70,8,120,4,p.trim); _rrectTo(bctx,WORLD.width-150,90,70,40,20,p.accent); _softLineTo(bctx,WORLD.width-136,102,WORLD.width-104,102,"rgba(255,255,255,0.28)",4); }
  if (dec.includes("mirror"))   { _rrectTo(bctx,WORLD.width-250,70,120,150,20,"#f7fbff"); _strokeRrectTo(bctx,WORLD.width-250,70,120,150,20,p.trim,6); _softLineTo(bctx,WORLD.width-228,94,WORLD.width-186,94,"rgba(255,255,255,0.85)",5); _softLineTo(bctx,WORLD.width-146,102,WORLD.width-146,188,"rgba(160,190,205,0.45)",4); }
  if (dec.includes("tiles"))    { bctx.strokeStyle="rgba(255,255,255,0.35)"; bctx.lineWidth=1; for (let tx=0; tx<WORLD.width; tx+=60) { bctx.beginPath(); bctx.moveTo(tx,0); bctx.lineTo(tx,WORLD.height-WORLD.floorHeight); bctx.stroke(); } for (let ty=0; ty<WORLD.height-WORLD.floorHeight; ty+=60) { bctx.beginPath(); bctx.moveTo(0,ty); bctx.lineTo(WORLD.width,ty); bctx.stroke(); } }
  if (dec.includes("towel"))    { _rrectTo(bctx,90,220,90,24,10,"#f7c6d0"); _rrectTo(bctx,82,220,8,24,3,p.trim); _softLineTo(bctx,106,228,154,228,"rgba(255,255,255,0.28)",3); }
  if (dec.includes("shelves"))  { _rrectTo(bctx,70,90,180,10,5,p.trim); _rrectTo(bctx,70,140,180,10,5,p.trim); _rrectTo(bctx,90,60,24,30,5,p.accent); _rrectTo(bctx,140,110,24,30,5,p.accent); _rrectTo(bctx,190,60,24,30,5,p.accent); _softLineTo(bctx,96,66,108,66,"rgba(255,255,255,0.22)",2); }
  if (dec.includes("fridge"))   { _rrectTo(bctx,WORLD.width-180,90,90,170,16,"#eef5f8"); _rrectTo(bctx,WORLD.width-110,130,6,40,3,"#9fb4c0"); _softLineTo(bctx,WORLD.width-164,106,WORLD.width-128,106,"rgba(255,255,255,0.55)",5); }
  if (dec.includes("clock"))    { bctx.fillStyle=p.accent; bctx.beginPath(); bctx.arc(WORLD.width-260,90,28,0,Math.PI*2); bctx.fill(); bctx.strokeStyle=p.trim; bctx.lineWidth=4; bctx.stroke(); }
  if (dec.includes("clouds"))   { bctx.fillStyle="rgba(255,255,255,0.8)"; [[120,90],[340,70],[980,110]].forEach(c => { bctx.beginPath(); bctx.arc(c[0],c[1],24,0,Math.PI*2); bctx.arc(c[0]+24,c[1]-10,20,0,Math.PI*2); bctx.arc(c[0]+48,c[1],24,0,Math.PI*2); bctx.fill(); }); }
  if (dec.includes("fence"))    { bctx.fillStyle="#d8c39a"; for (let fx=0; fx<WORLD.width; fx+=34) { _rrectTo(bctx,fx,WORLD.height-WORLD.floorHeight-70,18,70,4,"#d8c39a"); } _rrectTo(bctx,0,WORLD.height-WORLD.floorHeight-48,WORLD.width,10,4,"#d8c39a"); }
  if (dec.includes("sun"))      { bctx.fillStyle="#ffd54f"; bctx.beginPath(); bctx.arc(WORLD.width-120,90,34,0,Math.PI*2); bctx.fill(); }
  if (dec.includes("fireplace")){ _rrectTo(bctx,WORLD.width-260,90,170,150,16,"#c79a6d"); _rrectTo(bctx,WORLD.width-220,130,90,80,12,"#5a3420"); _softLineTo(bctx,WORLD.width-238,108,WORLD.width-130,108,"rgba(255,255,255,0.16)",3); bctx.fillStyle="#ffb347"; bctx.beginPath(); bctx.arc(WORLD.width-175,185,18,0,Math.PI*2); bctx.fill(); }
  if (dec.includes("rack"))     { _rrectTo(bctx,90,80,10,170,4,p.trim); _rrectTo(bctx,90,80,120,10,4,p.trim); _rrectTo(bctx,90,160,120,10,4,p.trim); }
  _drawCountrySurrealBackground(bctx);
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
