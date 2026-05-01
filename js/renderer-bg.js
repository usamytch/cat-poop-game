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
  _drawDecorTo(bctx);
  // Рисуем только статичные препятствия
  for (const ob of obstacles) {
    if (!ob.moving) _drawObstacleTo(bctx, ob);
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
    default:
      break;
  }
  bctx.globalAlpha = 1;
  bctx.restore();
}

function _drawDecorTo(bctx) {
  for (const d of decorItems) _drawDecorItemTo(bctx, d);
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
  }
  bctx.restore();
}

// Рисует движущееся препятствие на основном ctx (вызывается каждый кадр)
function drawObstacle(ob) {
  _drawObstacleTo(ctx, ob);
}

// ===== ФОН ЛОКАЦИИ =====
function _drawBgTo(bctx) {
  const p = currentLocation.palette;
  // OPT 13: используем WORLD.width/height вместо canvas.width/height
  bctx.fillStyle = p.wall; bctx.fillRect(0,0,WORLD.width,WORLD.height);
  bctx.fillStyle = p.floor; bctx.fillRect(0,WORLD.height-WORLD.floorHeight,WORLD.width,WORLD.floorHeight);
  bctx.fillStyle = p.trim; bctx.fillRect(0,WORLD.height-WORLD.floorHeight-6,WORLD.width,6);
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
}
