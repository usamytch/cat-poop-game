// ==========================================
// CAT POOP GAME — БЭНГЕР EDITION
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1200;
canvas.height = 700;

const WORLD = { width: 1200, height: 700, floorHeight: 90, topPadding: 70, sidePadding: 40 };

const catImage = new Image(); catImage.src = "cat.png";
const masterImage = new Image(); masterImage.src = "master.png";

// ===== ФАЗА 3.2: HIGH SCORE =====
const stats = {
  highScore:      parseInt(localStorage.getItem("cpg_hs")  || "0"),
  bestLevel:      parseInt(localStorage.getItem("cpg_bl")  || "1"),
  totalCaught:    parseInt(localStorage.getItem("cpg_tc")  || "0"),
  totalAccidents: parseInt(localStorage.getItem("cpg_ta")  || "0"),
  totalPoops:     parseInt(localStorage.getItem("cpg_tp")  || "0"),
  save() {
    localStorage.setItem("cpg_hs", this.highScore);
    localStorage.setItem("cpg_bl", this.bestLevel);
    localStorage.setItem("cpg_tc", this.totalCaught);
    localStorage.setItem("cpg_ta", this.totalAccidents);
    localStorage.setItem("cpg_tp", this.totalPoops);
  },
  update(s, l) {
    if (s > this.highScore) this.highScore = s;
    if (l > this.bestLevel) this.bestLevel = l;
    this.save();
  },
};

// ===== ФАЗА 1.1: WEB AUDIO =====
let _ac = null;
let muted = false;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  return _ac;
}
function tone(freq, type, dur, vol, delay) {
  if (muted) return;
  vol = vol || 0.3; delay = delay || 0;
  try {
    const ac = getAC();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(vol, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur + 0.05);
  } catch(e) {}
}
function sndMeow()   { tone(600,"sine",0.12,0.25); tone(900,"sine",0.08,0.2,0.1); tone(700,"sine",0.1,0.15,0.18); }
function sndFart()   { tone(120,"sawtooth",0.08,0.35); tone(90,"sawtooth",0.06,0.3,0.06); tone(60,"square",0.04,0.2,0.1); }
function sndHit()    { tone(200,"square",0.05,0.4); tone(150,"sawtooth",0.04,0.3,0.04); }
function sndAlarm()  { tone(880,"square",0.06,0.15); tone(660,"square",0.06,0.15,0.1); }
function sndWin()    { [523,659,784,1047].forEach((f,i) => tone(f,"sine",0.18,0.3,i*0.12)); }
function sndLose()   { [400,300,200,150].forEach((f,i) => tone(f,"sawtooth",0.2,0.35,i*0.14)); }
function sndCombo()  { [800,1000,1200,1500].forEach((f,i) => tone(f,"sine",0.1,0.3,i*0.07)); }
function sndPickup() { tone(1200,"sine",0.08,0.2); tone(1500,"sine",0.06,0.15,0.07); }

// ===== ФАЗА 3.3: СЛОЖНОСТЬ =====
const DIFF = {
  easy:   { label:"😸 Лёгкий", urgeRate:0.7,  baseSpd:1.2, spdPerLvl:0.2,  firstLvl:2 },
  normal: { label:"😼 Нормал", urgeRate:1.0,  baseSpd:1.8, spdPerLvl:0.35, firstLvl:1 },
  chaos:  { label:"😈 Хаос",   urgeRate:1.5,  baseSpd:2.8, spdPerLvl:0.55, firstLvl:1 },
};
let difficulty = "normal";

// ===== СОСТОЯНИЕ =====
let gameState = "start";
let score = 0;
let level = 1;

// ===== ФАЗА 2.4: КОМБО =====
let comboCount = 0;
let comboTimer = 0;
const comboPopups = [];

// ===== ФАЗА 1.3: ЧАСТИЦЫ =====
const overlayParticles = [];
let puddleAlpha = 0;
let overlayTimer = 0;

// ===== ФАЗА 1.2: ПАНИКА =====
let panicShake = 0;
let alarmTimer = 0;

// ===== ЛОКАЦИИ =====
const locationThemes = [
  { key:"hall",    name:"Зал",            palette:{wall:"#e8d8c3",floor:"#b98f68",trim:"#8f6548",accent:"#d9bfa3",shadow:"rgba(70,40,20,0.18)",ui:"rgba(40,24,16,0.72)"},   decorations:["window","painting","lamp"],     obstacleTypes:["wardrobe","dresser","armchair","plant"] },
  { key:"bathroom",name:"Ванная",         palette:{wall:"#d9eef7",floor:"#9fc4d1",trim:"#5f8ea0",accent:"#f7fbfd",shadow:"rgba(30,70,90,0.18)",ui:"rgba(20,55,70,0.72)"},   decorations:["mirror","tiles","towel"],       obstacleTypes:["sink","toilet","laundry","cabinet"] },
  { key:"kitchen", name:"Кухня",          palette:{wall:"#f4ead2",floor:"#caa56d",trim:"#8d6b3f",accent:"#fff4dc",shadow:"rgba(80,55,20,0.18)",ui:"rgba(65,45,18,0.72)"},   decorations:["shelves","fridge","clock"],     obstacleTypes:["table","fridge","stool","counter"] },
  { key:"street",  name:"Двор",           palette:{wall:"#b9d8f0",floor:"#7ea35f",trim:"#4f6f3d",accent:"#dff2ff",shadow:"rgba(30,60,20,0.18)",ui:"rgba(28,52,20,0.72)"},   decorations:["clouds","fence","sun"],         obstacleTypes:["tree","bench","bush","crate"] },
  { key:"country", name:"Загородный дом", palette:{wall:"#efe2c8",floor:"#a97d4f",trim:"#6f4d2d",accent:"#f8f0df",shadow:"rgba(60,35,15,0.2)", ui:"rgba(55,32,14,0.72)"},   decorations:["fireplace","window","rack"],    obstacleTypes:["dresser","woodpile","rockingChair","barrel"] },
];

const obstacleCatalog = {
  wardrobe:     {label:"Шкаф",          minW:76, maxW:112,minH:102,maxH:145,color:"#7b4f2f",detail:"#c89b6d"},
  dresser:      {label:"Комод",         minW:76, maxW:112,minH:60, maxH:86, color:"#8b5e3c",detail:"#d8b07f"},
  armchair:     {label:"Кресло",        minW:68, maxW:94, minH:60, maxH:82, color:"#8e5ea2",detail:"#caa7d8"},
  plant:        {label:"Фикус",         minW:46, maxW:68, minH:72, maxH:102,color:"#4f8a3f",detail:"#8b5a2b"},
  sink:         {label:"Раковина",      minW:68, maxW:94, minH:68, maxH:94, color:"#dfe8ee",detail:"#8aa4b3"},
  toilet:       {label:"Унитаз",        minW:60, maxW:82, minH:76, maxH:102,color:"#f7fbff",detail:"#9bb7c7"},
  laundry:      {label:"Корзина",       minW:60, maxW:82, minH:60, maxH:82, color:"#d8c3a5",detail:"#9c7b5a"},
  cabinet:      {label:"Шкафчик",       minW:68, maxW:94, minH:86, maxH:120,color:"#9bc0d0",detail:"#f5fbff"},
  table:        {label:"Стол",          minW:94, maxW:136,minH:60, maxH:82, color:"#9b6b3f",detail:"#e7c28f"},
  fridge:       {label:"Холодильник",   minW:68, maxW:90, minH:110,maxH:152,color:"#e8f0f4",detail:"#9fb4c0"},
  stool:        {label:"Табурет",       minW:46, maxW:64, minH:46, maxH:64, color:"#b07a45",detail:"#6f4a2a"},
  counter:      {label:"Тумба",         minW:86, maxW:120,minH:64, maxH:86, color:"#c49a6c",detail:"#7d5b3d"},
  tree:         {label:"Дерево",        minW:68, maxW:102,minH:102,maxH:152,color:"#4f8f3f",detail:"#6b4423"},
  bench:        {label:"Лавка",         minW:86, maxW:120,minH:46, maxH:68, color:"#8b5a2b",detail:"#5f3d1f"},
  bush:         {label:"Куст",          minW:68, maxW:102,minH:46, maxH:72, color:"#4f9a4f",detail:"#2f6f2f"},
  crate:        {label:"Ящик",          minW:60, maxW:82, minH:60, maxH:82, color:"#9b6a3a",detail:"#d8b07f"},
  woodpile:     {label:"Поленница",     minW:86, maxW:120,minH:56, maxH:82, color:"#8b5a2b",detail:"#d9a066"},
  rockingChair: {label:"Кресло-качалка",minW:76, maxW:102,minH:76, maxH:102,color:"#7a5230",detail:"#c79a6d"},
  barrel:       {label:"Бочка",         minW:56, maxW:76, minH:72, maxH:98, color:"#8b5a2b",detail:"#5f3d1f"},
};

let currentLocation = locationThemes[0];
let levelSeed = 1;
let levelMessageTimer = 180;
const obstacles = [];
const poops = [];
let shootCooldown = 0;
let lastDir = {x:1, y:0};

// ===== ФАЗА 2.3: БОНУСЫ =====
const bonuses = [];
const BONUS_TYPES = {
  fish: {emoji:"🐟", label:"Ускорение!",     color:"#4fc3f7"},
  yarn: {emoji:"🧶", label:"Хозяин стоит!",  color:"#ce93d8"},
  pill: {emoji:"💊", label:"-30% срочности!", color:"#a5d6a7"},
};
let speedBoostTimer = 0;
let yarnFreezeTimer = 0;

// ===== УТИЛИТЫ =====
function createRng(seed) {
  let v = seed % 2147483647; if (v <= 0) v += 2147483646;
  return () => { v = (v * 16807) % 2147483647; return (v-1)/2147483646; };
}
function randRange(rng,min,max) { return min + rng()*(max-min); }
function randInt(rng,min,max)   { return Math.floor(randRange(rng,min,max+1)); }
function clamp(v,mn,mx)         { return Math.max(mn,Math.min(mx,v)); }
function rectsOverlap(a,b,pad)  {
  pad = pad||0;
  return a.x<b.x+b.width+pad && a.x+a.width+pad>b.x && a.y<b.y+b.height+pad && a.y+a.height+pad>b.y;
}
function circleRect(c,r) {
  const cx=clamp(c.x,r.x,r.x+r.width), cy=clamp(c.y,r.y,r.y+r.height);
  const dx=c.x-cx, dy=c.y-cy; return dx*dx+dy*dy < c.r*c.r;
}
function getPlayBounds() {
  return {left:WORLD.sidePadding, top:WORLD.topPadding, right:canvas.width-WORLD.sidePadding, bottom:canvas.height-WORLD.floorHeight};
}
function playerRect(x,y) { x=x!==undefined?x:player.x; y=y!==undefined?y:player.y; return {x,y,width:player.size,height:player.size}; }
function ownerRect(x,y)  { x=x!==undefined?x:owner.x;  y=y!==undefined?y:owner.y;  return {x,y,width:owner.width,height:owner.height}; }
function hitsObstacles(rect,ignId) { return obstacles.some(o => o.id!==ignId && rectsOverlap(rect,o)); }
function drawSprite(img,x,y,w,h,fb) { if(img.complete&&img.naturalWidth>0){ctx.drawImage(img,x,y,w,h);}else{fb();} }
function rrect(x,y,w,h,r,fill) { ctx.fillStyle=fill; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill(); }
// ===== РИСОВАНИЕ ПРЕПЯТСТВИЙ =====
function drawObstacle(ob) {
  const {x,y,width:w,height:h,type} = ob;
  const meta = obstacleCatalog[type];
  const sway = ob.moving ? Math.sin(ob.movingOffset||0)*4 : 0;
  const ox = x+(ob.axis==="x"?sway:0), oy = y+(ob.axis==="y"?sway:0);
  ctx.save(); ctx.translate(ox,oy);
  ctx.fillStyle=currentLocation.palette.shadow; ctx.fillRect(8,h-10,w-16,12);
  switch(type) {
    case"wardrobe":case"cabinet":case"fridge":
      rrect(0,0,w,h,10,meta.color); rrect(8,8,w-16,h-16,8,meta.detail);
      ctx.fillStyle=meta.color; ctx.fillRect(w/2-3,12,6,h-24); ctx.fillRect(w/2-12,h/2,5,18); ctx.fillRect(w/2+7,h/2,5,18); break;
    case"dresser":case"counter":
      rrect(0,0,w,h,10,meta.color);
      for(let i=1;i<=3;i++){const dy=(h/4)*i-10; ctx.fillStyle=meta.detail; ctx.fillRect(10,dy,w-20,12); ctx.fillStyle=meta.color; ctx.fillRect(w/2-8,dy+3,16,6);} break;
    case"armchair":case"rockingChair":
      rrect(10,18,w-20,h-18,18,meta.color); rrect(0,0,w,34,16,meta.detail);
      ctx.fillStyle=meta.color; ctx.fillRect(8,h-18,10,18); ctx.fillRect(w-18,h-18,10,18);
      if(type==="rockingChair"){ctx.strokeStyle=meta.detail;ctx.lineWidth=4;ctx.beginPath();ctx.arc(w/2,h-2,w/2-8,Math.PI*0.1,Math.PI*0.9);ctx.stroke();} break;
    case"plant":case"tree":case"bush":
      ctx.fillStyle=meta.detail; ctx.fillRect(w/2-10,h*0.45,20,h*0.55);
      ctx.fillStyle=meta.color; ctx.beginPath(); ctx.arc(w/2,h*0.28,w*0.28,0,Math.PI*2); ctx.arc(w*0.32,h*0.42,w*0.22,0,Math.PI*2); ctx.arc(w*0.68,h*0.42,w*0.22,0,Math.PI*2); ctx.fill();
      if(type==="plant"){ctx.fillStyle=meta.detail;ctx.fillRect(w/2-18,h-18,36,18);} break;
    case"sink":
      rrect(10,0,w-20,26,10,meta.detail); rrect(0,18,w,h-18,12,meta.color);
      ctx.fillStyle="#9bb7c7"; ctx.fillRect(w/2-4,6,8,18); break;
    case"toilet":
      rrect(12,0,w-24,28,10,meta.detail); rrect(18,24,w-36,26,12,meta.color); rrect(8,44,w-16,h-44,18,meta.detail); break;
    case"laundry":case"barrel":
      rrect(8,0,w-16,h,18,meta.color); ctx.strokeStyle=meta.detail; ctx.lineWidth=4;
      ctx.strokeRect(14,12,w-28,h-24); ctx.strokeRect(14,h/2-8,w-28,16); break;
    case"table":case"bench":case"woodpile":
      rrect(0,0,w,20,10,meta.detail); ctx.fillStyle=meta.color; ctx.fillRect(10,18,12,h-18); ctx.fillRect(w-22,18,12,h-18);
      if(type==="woodpile"){for(let j=0;j<4;j++){ctx.fillStyle=meta.detail;ctx.beginPath();ctx.arc(24+j*((w-48)/3),h-18,12,0,Math.PI*2);ctx.fill();}} break;
    case"stool":case"crate":
      rrect(0,0,w,h,10,meta.color); ctx.strokeStyle=meta.detail; ctx.lineWidth=3;
      ctx.strokeRect(8,8,w-16,h-16); ctx.beginPath(); ctx.moveTo(8,8); ctx.lineTo(w-8,h-8); ctx.moveTo(w-8,8); ctx.lineTo(8,h-8); ctx.stroke(); break;
  }
  ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.fillRect(8,8,w*0.35,10);
  ctx.restore();
}

// ===== ФОН ЛОКАЦИИ =====
function drawBg() {
  const p=currentLocation.palette;
  ctx.fillStyle=p.wall; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=p.floor; ctx.fillRect(0,canvas.height-WORLD.floorHeight,canvas.width,WORLD.floorHeight);
  ctx.fillStyle=p.trim; ctx.fillRect(0,canvas.height-WORLD.floorHeight-6,canvas.width,6);
  const dec=currentLocation.decorations;
  if(dec.includes("window")){rrect(70,70,170,120,16,"#dff4ff");ctx.strokeStyle=p.trim;ctx.lineWidth=6;ctx.strokeRect(70,70,170,120);ctx.beginPath();ctx.moveTo(155,70);ctx.lineTo(155,190);ctx.moveTo(70,130);ctx.lineTo(240,130);ctx.stroke();}
  if(dec.includes("painting")){rrect(canvas.width-260,80,150,90,12,p.accent);ctx.strokeStyle=p.trim;ctx.lineWidth=5;ctx.strokeRect(canvas.width-260,80,150,90);ctx.fillStyle="rgba(120,80,40,0.25)";ctx.beginPath();ctx.arc(canvas.width-185,125,24,0,Math.PI*2);ctx.fill();}
  if(dec.includes("lamp")){ctx.fillStyle=p.trim;ctx.fillRect(canvas.width-120,70,8,120);rrect(canvas.width-150,90,70,40,18,p.accent);}
  if(dec.includes("mirror")){rrect(canvas.width-250,70,120,150,18,"#f7fbff");ctx.strokeStyle=p.trim;ctx.lineWidth=6;ctx.strokeRect(canvas.width-250,70,120,150);}
  if(dec.includes("tiles")){ctx.strokeStyle="rgba(255,255,255,0.35)";ctx.lineWidth=1;for(let tx=0;tx<canvas.width;tx+=60){ctx.beginPath();ctx.moveTo(tx,0);ctx.lineTo(tx,canvas.height-WORLD.floorHeight);ctx.stroke();}for(let ty=0;ty<canvas.height-WORLD.floorHeight;ty+=60){ctx.beginPath();ctx.moveTo(0,ty);ctx.lineTo(canvas.width,ty);ctx.stroke();}}
  if(dec.includes("towel")){rrect(90,220,90,24,8,"#f7c6d0");ctx.fillStyle=p.trim;ctx.fillRect(82,220,8,24);}
  if(dec.includes("shelves")){ctx.fillStyle=p.trim;ctx.fillRect(70,90,180,10);ctx.fillRect(70,140,180,10);ctx.fillStyle=p.accent;ctx.fillRect(90,60,24,30);ctx.fillRect(140,110,24,30);ctx.fillRect(190,60,24,30);}
  if(dec.includes("fridge")){rrect(canvas.width-180,90,90,170,14,"#eef5f8");ctx.fillStyle="#9fb4c0";ctx.fillRect(canvas.width-110,130,6,40);}
  if(dec.includes("clock")){ctx.fillStyle=p.accent;ctx.beginPath();ctx.arc(canvas.width-260,90,28,0,Math.PI*2);ctx.fill();ctx.strokeStyle=p.trim;ctx.lineWidth=4;ctx.stroke();}
  if(dec.includes("clouds")){ctx.fillStyle="rgba(255,255,255,0.8)";[[120,90],[340,70],[980,110]].forEach(c=>{ctx.beginPath();ctx.arc(c[0],c[1],24,0,Math.PI*2);ctx.arc(c[0]+24,c[1]-10,20,0,Math.PI*2);ctx.arc(c[0]+48,c[1],24,0,Math.PI*2);ctx.fill();});}
  if(dec.includes("fence")){ctx.fillStyle="#d8c39a";for(let fx=0;fx<canvas.width;fx+=34){ctx.fillRect(fx,canvas.height-WORLD.floorHeight-70,18,70);}ctx.fillRect(0,canvas.height-WORLD.floorHeight-48,canvas.width,10);}
  if(dec.includes("sun")){ctx.fillStyle="#ffd54f";ctx.beginPath();ctx.arc(canvas.width-120,90,34,0,Math.PI*2);ctx.fill();}
  if(dec.includes("fireplace")){rrect(canvas.width-260,90,170,150,14,"#c79a6d");rrect(canvas.width-220,130,90,80,10,"#5a3420");ctx.fillStyle="#ffb347";ctx.beginPath();ctx.arc(canvas.width-175,185,18,0,Math.PI*2);ctx.fill();}
  if(dec.includes("rack")){ctx.fillStyle=p.trim;ctx.fillRect(90,80,10,170);ctx.fillRect(90,80,120,10);ctx.fillRect(90,160,120,10);}
}

// ===== ЛОТОК =====
const litterBox = { x:620, y:310, width:92, height:62 };

function drawLitterBox() {
  const urgeRatio = player.urge / player.maxUrge;
  let pulse = 0;
  if (urgeRatio > 0.75) pulse = Math.sin(Date.now()*0.015)*4;
  const lx=litterBox.x-pulse/2, ly=litterBox.y-pulse/2;
  const lw=litterBox.width+pulse, lh=litterBox.height+pulse;
  ctx.fillStyle="#8B6914"; ctx.fillRect(lx,ly+12,lw,lh-12);
  ctx.fillStyle="#A0522D"; ctx.fillRect(lx-5,ly,lw+10,16);
  ctx.fillStyle="#D2B48C"; ctx.fillRect(lx+6,ly+16,lw-12,lh-24);
  if (urgeRatio > 0.75) {
    ctx.fillStyle=`rgba(255,50,50,${0.3+Math.sin(Date.now()*0.015)*0.2})`;
    ctx.fillRect(lx-5,ly,lw+10,lh+4);
  }
  ctx.fillStyle="#5a3a00"; ctx.font="bold 12px Arial"; ctx.textAlign="center";
  ctx.fillText("🐾 Лоток",litterBox.x+litterBox.width/2,litterBox.y+litterBox.height+20);
  ctx.textAlign="left";
}

// ===== ГЕНЕРАЦИЯ ПРЕПЯТСТВИЙ =====
function generateObstacle(theme, rng, index, movingAllowed) {
  const type=theme.obstacleTypes[randInt(rng,0,theme.obstacleTypes.length-1)];
  const meta=obstacleCatalog[type];
  const w=randInt(rng,meta.minW,meta.maxW), h=randInt(rng,meta.minH,meta.maxH);
  const b=getPlayBounds();
  const x=randInt(rng,b.left+20,b.right-w-20), y=randInt(rng,b.top+20,b.bottom-h-20);
  const moving=movingAllowed&&rng()>0.72;
  const axis=rng()>0.5?"x":"y";
  const range=moving?randInt(rng,30,70):0;
  const speed=moving?randRange(rng,0.008,0.02):0;
  return {id:`${type}-${index}-${Math.floor(rng()*100000)}`,type,x,y,width:w,height:h,moving,axis,range,speed,phase:randRange(rng,0,Math.PI*2),movingOffset:0,baseX:x,baseY:y};
}

function placeLitterBox(rng, spawn) {
  const b=getPlayBounds();
  const hud={x:0,y:0,width:360,height:220};
  const minDist=Math.min(420+(level-1)*45,760);
  const candidates=[
    {x:b.right-litterBox.width-40,y:b.top+40},
    {x:b.right-litterBox.width-60,y:b.bottom-litterBox.height-40},
    {x:canvas.width/2-litterBox.width/2,y:b.top+60},
    {x:canvas.width/2-litterBox.width/2,y:b.bottom-litterBox.height-50},
    {x:b.left+60,y:b.top+40},
    {x:b.left+60,y:b.bottom-litterBox.height-40},
  ];
  function farEnough(r) {
    const dx=(r.x+r.width/2)-(spawn.x+spawn.width/2), dy=(r.y+r.height/2)-(spawn.y+spawn.height/2);
    return Math.sqrt(dx*dx+dy*dy)>=minDist;
  }
  for(let i=candidates.length-1;i>0;i--){const j=randInt(rng,0,i);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  for(const c of candidates){
    const r={x:c.x,y:c.y,width:litterBox.width,height:litterBox.height};
    if(!farEnough(r))continue; if(rectsOverlap(r,hud,12))continue; if(hitsObstacles(r))continue;
    litterBox.x=r.x; litterBox.y=r.y; return;
  }
  for(let att=0;att<180;att++){
    const r={x:randInt(rng,b.left+20,b.right-litterBox.width-20),y:randInt(rng,b.top+20,b.bottom-litterBox.height-20),width:litterBox.width,height:litterBox.height};
    if(!farEnough(r))continue; if(rectsOverlap(r,hud,12))continue; if(hitsObstacles(r))continue;
    litterBox.x=r.x; litterBox.y=r.y; return;
  }
  litterBox.x=b.right-litterBox.width-40; litterBox.y=b.bottom-litterBox.height-40;
}

// ===== ГЕНЕРАЦИЯ УРОВНЯ =====
function generateLevel() {
  levelSeed = level*9973 + score*17 + 13;
  const rng = createRng(levelSeed);
  currentLocation = locationThemes[randInt(rng,0,locationThemes.length-1)];
  obstacles.length = 0;
  bonuses.length = 0;

  const obstCount = Math.min(4+level, 12);
  const movingAllowed = level >= 5;
  const spawn = {x:90, y:canvas.height-WORLD.floorHeight-player.size-30, width:player.size, height:player.size};

  let att=0;
  while(obstacles.length<obstCount && att<obstCount*40){
    att++;
    const ob = generateObstacle(currentLocation,rng,obstacles.length,movingAllowed);
    const pr = {x:ob.x-24,y:ob.y-24,width:ob.width+48,height:ob.height+48};
    if(rectsOverlap(pr,spawn))continue;
    if(rectsOverlap(pr,litterBox,18))continue;
    if(hitsObstacles(pr))continue;
    obstacles.push(ob);
  }

  placeLitterBox(rng, spawn);
  player.x = spawn.x; player.y = spawn.y;
  levelMessageTimer = 180;

  // Спавн бонусов
  const bonusKeys = Object.keys(BONUS_TYPES);
  const bonusCount = 2 + (level > 3 ? 1 : 0);
  let batt = 0;
  while(bonuses.length < bonusCount && batt < 200) {
    batt++;
    const bx = randInt(rng, 80, canvas.width-80);
    const by = randInt(rng, WORLD.topPadding+20, canvas.height-WORLD.floorHeight-40);
    const br = {x:bx-20,y:by-20,width:40,height:40};
    if(hitsObstacles(br))continue;
    if(rectsOverlap(br,litterBox,20))continue;
    if(rectsOverlap(br,spawn,30))continue;
    const btype = bonusKeys[randInt(rng,0,bonusKeys.length-1)];
    bonuses.push({x:bx,y:by,type:btype,alive:true,pulse:Math.random()*Math.PI*2});
  }
}
// ===== ИГРОК =====
const player = {
  x:90, y:400, size:48, speed:3.9,
  urge:0, maxUrge:100,
  pooping:false, poopTimer:0,
  draw() {
    const urgeRatio = this.urge / this.maxUrge;
    const panic = urgeRatio > 0.75;
    const sx = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    const sy = panic ? (Math.random()-0.5)*panicShake*2 : 0;
    ctx.save(); ctx.translate(sx, sy);
    drawSprite(catImage, this.x, this.y, this.size, this.size, () => {
      ctx.fillStyle="#f5a623"; ctx.beginPath();
      ctx.arc(this.x+this.size/2, this.y+this.size/2, this.size/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 28px Arial"; ctx.textAlign="center";
      ctx.fillText("🐱", this.x+this.size/2, this.y+this.size/2+10);
      ctx.textAlign="left";
    });
    // Бонус-иконки над котом
    let iconX = this.x;
    if (speedBoostTimer > 0) { ctx.font="18px Arial"; ctx.fillText("🐟", iconX, this.y-6); iconX+=22; }
    if (yarnFreezeTimer > 0) { ctx.font="18px Arial"; ctx.fillText("🧶", iconX, this.y-6); }
    ctx.restore();
  },
  update() {
    const diff = DIFF[difficulty];
    const b = getPlayBounds();
    const spd = this.speed * (speedBoostTimer > 0 ? 1.7 : 1.0);
    let dx=0, dy=0;
    if (keys["ArrowLeft"]||keys["a"]||keys["A"])  { dx=-1; lastDir={x:-1,y:0}; }
    if (keys["ArrowRight"]||keys["d"]||keys["D"]) { dx= 1; lastDir={x: 1,y:0}; }
    if (keys["ArrowUp"]||keys["w"]||keys["W"])    { dy=-1; lastDir={x:0,y:-1}; }
    if (keys["ArrowDown"]||keys["s"]||keys["S"])  { dy= 1; lastDir={x:0,y: 1}; }
    if (dx!==0&&dy!==0) { dx*=0.707; dy*=0.707; }

    const nx = clamp(this.x+dx*spd, b.left, b.right-this.size);
    const ny = clamp(this.y+dy*spd, b.top,  b.bottom-this.size);
    if (!hitsObstacles(playerRect(nx, this.y))) this.x = nx;
    if (!hitsObstacles(playerRect(this.x, ny))) this.y = ny;

    // Срочность
    const urgeRate = diff.urgeRate * (1 + (level-1)*0.08);
    this.urge = clamp(this.urge + urgeRate/60, 0, this.maxUrge);

    // Паника
    const urgeRatio = this.urge / this.maxUrge;
    if (urgeRatio > 0.75) {
      panicShake = clamp((urgeRatio-0.75)/0.25*8, 0, 8);
      alarmTimer++;
      if (alarmTimer % 36 === 0) sndAlarm();
    } else {
      panicShake = 0; alarmTimer = 0;
    }

    // Авария
    if (this.urge >= this.maxUrge) {
      stats.totalAccidents++;
      stats.update(score, level);
      spawnPuddle(this.x+this.size/2, this.y+this.size/2);
      gameState = "accident";
      overlayTimer = 0;
      sndLose();
      return;
    }

    // Достиг лотка
    const pr = playerRect();
    const lr = {x:litterBox.x,y:litterBox.y,width:litterBox.width,height:litterBox.height};
    if (rectsOverlap(pr, lr)) {
      score += Math.max(1, Math.floor((1 - this.urge/this.maxUrge)*10) + level);
      stats.update(score, level);
      level++;
      this.urge = clamp(this.urge - 30, 0, this.maxUrge);
      speedBoostTimer = 0; yarnFreezeTimer = 0;
      comboCount = 0; comboTimer = 0;
      spawnConfetti(litterBox.x+litterBox.width/2, litterBox.y+litterBox.height/2);
      generateLevel();
      owner.activate();
      sndWin();
      levelMessageTimer = 180;
    }

    // Подбор бонусов
    for (const b of bonuses) {
      if (!b.alive) continue;
      const br = {x:b.x-20,y:b.y-20,width:40,height:40};
      if (rectsOverlap(pr, br)) { applyBonus(b.type); b.alive=false; sndPickup(); }
    }

    // Таймеры бонусов
    if (speedBoostTimer > 0) speedBoostTimer--;
    if (yarnFreezeTimer > 0) yarnFreezeTimer--;
    if (shootCooldown > 0) shootCooldown--;
    if (this.poopTimer > 0) this.poopTimer--;
  },
};

// ===== ХОЗЯИН =====
const owner = {
  x:800, y:300, width:52, height:72,
  active:false, speed:1.0,
  activate() {
    const diff = DIFF[difficulty];
    if (level < diff.firstLvl) { this.active=false; return; }
    this.active = true;
    this.speed = diff.baseSpd + (level-1)*diff.spdPerLvl;
    const b = getPlayBounds();
    // Спавн в случайном углу, подальше от кота
    const corners = [
      {x:b.right-this.width-20, y:b.top+20},
      {x:b.right-this.width-20, y:b.bottom-this.height-20},
      {x:b.left+20, y:b.top+20},
    ];
    let best = corners[0], bestDist = 0;
    for (const c of corners) {
      const dx=c.x-player.x, dy=c.y-player.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if (d>bestDist) { bestDist=d; best=c; }
    }
    this.x=best.x; this.y=best.y;
  },
  draw() {
    if (!this.active) return;
    drawSprite(masterImage, this.x, this.y, this.width, this.height, () => {
      ctx.fillStyle="#e07b39"; ctx.beginPath();
      ctx.arc(this.x+this.width/2, this.y+this.height/2, this.width/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 28px Arial"; ctx.textAlign="center";
      ctx.fillText("👨", this.x+this.width/2, this.y+this.height/2+10);
      ctx.textAlign="left";
    });
  },
  update() {
    if (!this.active) return;
    if (yarnFreezeTimer > 0) return;
    const spd = this.speed;
    const tx = player.x + player.size/2 - this.width/2;
    const ty = player.y + player.size/2 - this.height/2;
    let dx = tx-this.x, dy = ty-this.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist > 1) { dx/=dist; dy/=dist; }
    const nx = this.x+dx*spd, ny = this.y+dy*spd;
    const b = getPlayBounds();
    const nr = {x:nx,y:ny,width:this.width,height:this.height};
    if (!hitsObstacles(nr) && nx>=b.left && nx<=b.right-this.width) this.x=nx;
    if (!hitsObstacles(nr) && ny>=b.top  && ny<=b.bottom-this.height) this.y=ny;

    // Поймал кота
    if (rectsOverlap(playerRect(), ownerRect(), -6)) {
      stats.totalCaught++;
      stats.update(score, level);
      gameState = "caught";
      overlayTimer = 0;
      sndHit(); sndLose();
    }
  },
};

// ===== КЛАВИШИ =====
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (gameState === "start") {
    if (e.key==="1") difficulty="easy";
    if (e.key==="2") difficulty="normal";
    if (e.key==="3") difficulty="chaos";
    if (e.key==="Enter"||e.key===" ") startGame();
  } else if (gameState === "playing") {
    if (e.key===" "||e.key==="x"||e.key==="X") shootPoop();
    if (e.key==="m"||e.key==="M") muted=!muted;
  } else if (gameState==="win"||gameState==="lose"||gameState==="caught"||gameState==="accident") {
    if (e.key==="Enter"||e.key===" ") { gameState="start"; }
  }
});
window.addEventListener("keyup", e => { keys[e.key]=false; });

// ===== СТАРТ ИГРЫ =====
function startGame() {
  score = 0; level = 1;
  player.urge = 0; player.pooping = false; player.poopTimer = 0;
  poops.length = 0; overlayParticles.length = 0; comboPopups.length = 0;
  comboCount = 0; comboTimer = 0;
  speedBoostTimer = 0; yarnFreezeTimer = 0;
  shootCooldown = 0; panicShake = 0; alarmTimer = 0;
  puddleAlpha = 0;
  generateLevel();
  owner.activate();
  sndMeow();
  gameState = "playing";
}
// ===== СТРЕЛЬБА КАКАШКАМИ =====
function shootPoop() {
  if (shootCooldown > 0) return;
  const cx = player.x + player.size/2;
  const cy = player.y + player.size/2;
  const spd = 7;
  poops.push({
    x: cx, y: cy,
    dx: lastDir.x * spd,
    dy: lastDir.y * spd,
    r: 10, alive: true,
    trail: [],
  });
  stats.totalPoops++;
  shootCooldown = 22;
  sndFart();
}

// ===== ОБНОВЛЕНИЕ КАКАШЕК =====
function updatePoops() {
  const b = getPlayBounds();
  for (const p of poops) {
    if (!p.alive) continue;
    p.trail.push({x:p.x, y:p.y});
    if (p.trail.length > 6) p.trail.shift();
    p.x += p.dx; p.y += p.dy;

    // Вышла за границы
    if (p.x < b.left-20 || p.x > b.right+20 || p.y < b.top-20 || p.y > b.bottom+20) {
      p.alive = false; comboCount = 0; continue;
    }

    // Попала в препятствие
    const pr = {x:p.x-p.r, y:p.y-p.r, width:p.r*2, height:p.r*2};
    if (hitsObstacles(pr)) { p.alive=false; comboCount=0; continue; }

    // Попала в хозяина
    if (owner.active && circleRect({x:p.x,y:p.y,r:p.r}, ownerRect())) {
      p.alive = false;
      comboCount++;
      comboTimer = 180;
      if (comboCount >= 3) {
        comboPopups.push({x:owner.x+owner.width/2, y:owner.y-20, text:"COMBO! x"+comboCount, timer:90, color:"#ff9800"});
        sndCombo();
        // Бонус за комбо — заморозка хозяина
        yarnFreezeTimer = Math.max(yarnFreezeTimer, 180);
        comboCount = 0; comboTimer = 0;
      } else {
        comboPopups.push({x:owner.x+owner.width/2, y:owner.y-20, text:"HIT! "+comboCount+"/3", timer:60, color:"#fff176"});
        sndHit();
      }
      score += 2;
    }
  }
  // Убираем мёртвые
  for (let i=poops.length-1; i>=0; i--) { if (!poops[i].alive) poops.splice(i,1); }
  // Сброс комбо по таймеру
  if (comboTimer > 0) { comboTimer--; if (comboTimer===0) comboCount=0; }
}

// ===== РИСОВАНИЕ КАКАШЕК =====
function drawPoops() {
  for (const p of poops) {
    if (!p.alive) continue;
    // Шлейф
    for (let i=0; i<p.trail.length; i++) {
      const t = p.trail[i];
      const alpha = (i+1)/p.trail.length * 0.4;
      ctx.globalAlpha = alpha;
      ctx.font = "14px Arial"; ctx.textAlign="center";
      ctx.fillText("💩", t.x, t.y+5);
    }
    ctx.globalAlpha = 1;
    ctx.font = "20px Arial"; ctx.textAlign="center";
    ctx.fillText("💩", p.x, p.y+7);
    ctx.textAlign="left";
  }
}

// ===== ПРИМЕНЕНИЕ БОНУСА =====
function applyBonus(type) {
  if (type==="fish") {
    speedBoostTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🐟 Ускорение!", timer:80, color:"#4fc3f7"});
  } else if (type==="yarn") {
    yarnFreezeTimer = 300;
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"🧶 Стоп хозяин!", timer:80, color:"#ce93d8"});
  } else if (type==="pill") {
    player.urge = clamp(player.urge * 0.7, 0, player.maxUrge);
    comboPopups.push({x:player.x+player.size/2, y:player.y-20, text:"💊 -30% срочности!", timer:80, color:"#a5d6a7"});
  }
}

// ===== ОБНОВЛЕНИЕ БОНУСОВ =====
function updateBonuses() {
  for (const b of bonuses) {
    b.pulse = (b.pulse || 0) + 0.07;
  }
}

// ===== РИСОВАНИЕ БОНУСОВ =====
function drawBonuses() {
  for (const b of bonuses) {
    if (!b.alive) continue;
    const sc = 1 + Math.sin(b.pulse)*0.12;
    const meta = BONUS_TYPES[b.type];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(sc, sc);
    // Свечение
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 14;
    ctx.font = "28px Arial"; ctx.textAlign="center";
    ctx.fillText(meta.emoji, 0, 10);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ===== ОБНОВЛЕНИЕ ПРЕПЯТСТВИЙ =====
function updateObstacles() {
  for (const ob of obstacles) {
    if (!ob.moving) continue;
    ob.movingOffset = Math.sin(ob.phase + performance.now()*ob.speed) * ob.range;
    if (ob.axis==="x") ob.x = ob.baseX + ob.movingOffset;
    else ob.y = ob.baseY + ob.movingOffset;
  }
}

// ===== ПРОВЕРКА КОЛЛИЗИЙ (прямоугольник) =====
function checkCollisionRect(rect) {
  return hitsObstacles(rect);
}
// ===== ФАЗА 1.3: ЧАСТИЦЫ =====
function spawnConfetti(cx, cy) {
  const emojis = ["💩","⭐","✨","🎉","💫","🌟"];
  for (let i=0; i<28; i++) {
    const angle = Math.random()*Math.PI*2;
    const spd = 2 + Math.random()*5;
    overlayParticles.push({
      x:cx, y:cy,
      dx:Math.cos(angle)*spd, dy:Math.sin(angle)*spd - 2,
      gravity:0.18,
      emoji: emojis[Math.floor(Math.random()*emojis.length)],
      alpha:1, fade:0.018,
      size: 16+Math.random()*14,
      rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*0.18,
      type:"confetti",
    });
  }
}

function spawnPuddle(cx, cy) {
  puddleAlpha = 0.85;
  for (let i=0; i<18; i++) {
    const angle = Math.random()*Math.PI*2;
    const spd = 1 + Math.random()*3;
    overlayParticles.push({
      x:cx, y:cy,
      dx:Math.cos(angle)*spd, dy:Math.sin(angle)*spd,
      gravity:0.12,
      emoji:"💧",
      alpha:1, fade:0.022,
      size:14+Math.random()*10,
      rot:0, rotSpd:0,
      type:"puddle",
    });
  }
}

function updateOverlayParticles() {
  for (const p of overlayParticles) {
    p.x += p.dx; p.y += p.dy;
    p.dy += p.gravity;
    p.alpha -= p.fade;
    p.rot += p.rotSpd;
  }
  for (let i=overlayParticles.length-1; i>=0; i--) {
    if (overlayParticles[i].alpha <= 0) overlayParticles.splice(i,1);
  }
  if (puddleAlpha > 0) puddleAlpha -= 0.008;
}

function drawOverlayParticles() {
  for (const p of overlayParticles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.font = p.size+"px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.emoji, 0, p.size/3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ===== КОМБО-ПОПАПЫ =====
function updateComboPopups() {
  for (const p of comboPopups) { p.timer--; p.y -= 0.7; }
  for (let i=comboPopups.length-1; i>=0; i--) {
    if (comboPopups[i].timer <= 0) comboPopups.splice(i,1);
  }
}

function drawComboPopups() {
  for (const p of comboPopups) {
    const alpha = Math.min(1, p.timer/30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = p.color || "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

// ===== HUD =====
function drawUI() {
  const p = currentLocation.palette;
  const urgeRatio = player.urge / player.maxUrge;
  const panic = urgeRatio > 0.75;

  // Панель HUD
  const hudX=14, hudY=14, hudW=310, hudH=190;
  ctx.fillStyle = p.ui || "rgba(30,20,10,0.72)";
  ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 18); ctx.fill();

  // Уровень и счёт
  ctx.fillStyle="#fff"; ctx.font="bold 18px Arial"; ctx.textAlign="left";
  ctx.fillText("Уровень "+level, hudX+18, hudY+34);
  ctx.fillStyle="#ffd54f"; ctx.font="bold 16px Arial";
  ctx.fillText("Счёт: "+score, hudX+18, hudY+58);
  ctx.fillStyle="#b0bec5"; ctx.font="14px Arial";
  ctx.fillText("Рекорд: "+stats.highScore, hudX+18, hudY+78);

  // Сложность
  ctx.fillStyle="#90caf9"; ctx.font="13px Arial";
  ctx.fillText(DIFF[difficulty].label, hudX+18, hudY+98);

  // Шкала срочности
  const barX=hudX+18, barY=hudY+112, barW=hudW-36, barH=22;
  ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,10); ctx.fill();

  // Цвет шкалы
  let barColor;
  if (urgeRatio < 0.5) barColor="#66bb6a";
  else if (urgeRatio < 0.75) barColor="#ffa726";
  else barColor = panic ? `hsl(${Date.now()*0.5%60},100%,55%)` : "#ef5350";

  const fillW = barW * urgeRatio;
  if (fillW > 0) {
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 10); ctx.fill();
  }

  // Паника-пульс
  if (panic) {
    ctx.strokeStyle = `rgba(255,50,50,${0.5+Math.sin(Date.now()*0.015)*0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(barX-2, barY-2, barW+4, barH+4, 12); ctx.stroke();
  }

  ctx.fillStyle="#fff"; ctx.font="bold 13px Arial"; ctx.textAlign="center";
  ctx.fillText(panic?"😱 СРОЧНО!":"💩 Срочность: "+Math.floor(urgeRatio*100)+"%", barX+barW/2, barY+15);

  // Таймеры бонусов
  let bx = hudX+18;
  if (speedBoostTimer > 0) {
    ctx.fillStyle="#4fc3f7"; ctx.font="13px Arial"; ctx.textAlign="left";
    ctx.fillText("🐟 "+Math.ceil(speedBoostTimer/60)+"с", bx, hudY+152); bx+=70;
  }
  if (yarnFreezeTimer > 0) {
    ctx.fillStyle="#ce93d8"; ctx.font="13px Arial"; ctx.textAlign="left";
    ctx.fillText("🧶 "+Math.ceil(yarnFreezeTimer/60)+"с", bx, hudY+152); bx+=70;
  }

  // Подсказка стрельбы
  ctx.fillStyle="rgba(255,255,255,0.55)"; ctx.font="12px Arial"; ctx.textAlign="left";
  ctx.fillText("Пробел — стрелять  M — звук", hudX+18, hudY+174);

  // Сообщение об уровне
  if (levelMessageTimer > 0) {
    const alpha = Math.min(1, levelMessageTimer/40);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.beginPath(); ctx.roundRect(canvas.width/2-160, 20, 320, 52, 18); ctx.fill();
    ctx.fillStyle="#ffd54f"; ctx.font="bold 26px Arial"; ctx.textAlign="center";
    ctx.fillText("📍 "+currentLocation.name+" — Уровень "+level, canvas.width/2, 54);
    ctx.restore();
    levelMessageTimer--;
  }

  ctx.textAlign="left";
}

// ===== СТАРТОВЫЙ ЭКРАН =====
function drawStartScreen() {
  // Фон
  ctx.fillStyle="#1a1a2e"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Звёзды
  ctx.fillStyle="rgba(255,255,255,0.6)";
  for (let i=0; i<60; i++) {
    const sx=(i*137.5)%canvas.width, sy=(i*97.3)%canvas.height;
    ctx.fillRect(sx,sy,2,2);
  }

  // Заголовок
  ctx.save();
  ctx.textAlign="center";
  ctx.font="bold 72px Arial";
  ctx.fillStyle="#ffd54f";
  ctx.shadowColor="#ff9800"; ctx.shadowBlur=30;
  ctx.fillText("🐱 CAT POOP GAME", canvas.width/2, 130);
  ctx.shadowBlur=0;

  ctx.font="bold 26px Arial"; ctx.fillStyle="#fff";
  ctx.fillText("Доведи кота до лотка — пока не поздно!", canvas.width/2, 178);

  // Рекорд
  if (stats.highScore > 0) {
    ctx.font="bold 22px Arial"; ctx.fillStyle="#ffd54f";
    ctx.fillText("🏆 Рекорд: "+stats.highScore+"  |  Лучший уровень: "+stats.bestLevel, canvas.width/2, 218);
  }

  // Статистика
  ctx.font="16px Arial"; ctx.fillStyle="#b0bec5";
  ctx.fillText("Поймано хозяином: "+stats.totalCaught+"  |  Аварий: "+stats.totalAccidents+"  |  Какашек выпущено: "+stats.totalPoops, canvas.width/2, 248);

  // Выбор сложности
  ctx.font="bold 24px Arial"; ctx.fillStyle="#fff";
  ctx.fillText("Выбери сложность:", canvas.width/2, 300);

  const diffs = [
    {key:"easy",   label:"1 — 😸 Лёгкий",  desc:"Медленная срочность, хозяин со 2 уровня"},
    {key:"normal", label:"2 — 😼 Нормал",   desc:"Стандартный режим"},
    {key:"chaos",  label:"3 — 😈 Хаос",     desc:"Быстрая срочность, хозяин с 1 уровня"},
  ];
  diffs.forEach((d,i) => {
    const sel = difficulty===d.key;
    const bx=canvas.width/2-220, by=330+i*80, bw=440, bh=62;
    ctx.fillStyle = sel ? "rgba(255,213,79,0.22)" : "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.fill();
    if (sel) { ctx.strokeStyle="#ffd54f"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,16); ctx.stroke(); }
    ctx.font="bold 22px Arial"; ctx.fillStyle= sel?"#ffd54f":"#fff";
    ctx.fillText(d.label, canvas.width/2, by+26);
    ctx.font="14px Arial"; ctx.fillStyle="#b0bec5";
    ctx.fillText(d.desc, canvas.width/2, by+48);
  });

  // Кнопка старта
  const t = Date.now()*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(canvas.width/2, 590); ctx.scale(sc,sc);
  ctx.fillStyle="#ffd54f";
  ctx.beginPath(); ctx.roundRect(-140,-28,280,56,28); ctx.fill();
  ctx.font="bold 26px Arial"; ctx.fillStyle="#1a1a2e";
  ctx.fillText("▶  ИГРАТЬ  (Enter)", 0, 10);
  ctx.restore();

  // Управление
  ctx.font="15px Arial"; ctx.fillStyle="rgba(255,255,255,0.45)";
  ctx.fillText("WASD / Стрелки — движение  |  Пробел — стрелять  |  M — звук", canvas.width/2, 650);

  ctx.restore();
}

// ===== ОВЕРЛЕЙ КОНЦА =====
function drawOverlay() {
  // Лужа при аварии
  if (gameState==="accident" && puddleAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = puddleAlpha * 0.55;
    ctx.fillStyle="#8B4513";
    ctx.beginPath(); ctx.ellipse(player.x+player.size/2, player.y+player.size, 80, 30, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // Затемнение
  ctx.fillStyle="rgba(0,0,0,0.62)"; ctx.fillRect(0,0,canvas.width,canvas.height);

  drawOverlayParticles();

  ctx.save(); ctx.textAlign="center";
  const cx=canvas.width/2, cy=canvas.height/2;

  if (gameState==="win") {
    ctx.font="bold 72px Arial"; ctx.fillStyle="#ffd54f";
    ctx.shadowColor="#ff9800"; ctx.shadowBlur=30;
    ctx.fillText("🎉 ПОБЕДА!", cx, cy-60);
    ctx.shadowBlur=0;
    ctx.font="bold 28px Arial"; ctx.fillStyle="#fff";
    ctx.fillText("Уровень "+level+" пройден!", cx, cy-10);
    ctx.font="22px Arial"; ctx.fillStyle="#b0bec5";
    ctx.fillText("Счёт: "+score, cx, cy+30);
  } else if (gameState==="accident") {
    ctx.font="bold 64px Arial"; ctx.fillStyle="#ef5350";
    ctx.shadowColor="#b71c1c"; ctx.shadowBlur=24;
    ctx.fillText("💩 АВАРИЯ!", cx, cy-60);
    ctx.shadowBlur=0;
    ctx.font="bold 26px Arial"; ctx.fillStyle="#fff";
    ctx.fillText("Кот не добежал до лотка...", cx, cy-10);
    ctx.font="20px Arial"; ctx.fillStyle="#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  } else if (gameState==="caught") {
    ctx.font="bold 64px Arial"; ctx.fillStyle="#ff7043";
    ctx.shadowColor="#bf360c"; ctx.shadowBlur=24;
    ctx.fillText("😾 ПОЙМАЛИ!", cx, cy-60);
    ctx.shadowBlur=0;
    ctx.font="bold 26px Arial"; ctx.fillStyle="#fff";
    ctx.fillText("Хозяин схватил кота!", cx, cy-10);
    ctx.font="20px Arial"; ctx.fillStyle="#b0bec5";
    ctx.fillText("Счёт: "+score+"  |  Уровень: "+level, cx, cy+30);
  }

  // Рекорд
  if (score >= stats.highScore && score > 0) {
    ctx.font="bold 22px Arial"; ctx.fillStyle="#ffd54f";
    ctx.fillText("🏆 НОВЫЙ РЕКОРД!", cx, cy+70);
  }

  // Кнопка
  const t = Date.now()*0.003;
  const sc = 1 + Math.sin(t)*0.04;
  ctx.save(); ctx.translate(cx, cy+120); ctx.scale(sc,sc);
  ctx.fillStyle="#ffd54f";
  ctx.beginPath(); ctx.roundRect(-130,-26,260,52,26); ctx.fill();
  ctx.font="bold 22px Arial"; ctx.fillStyle="#1a1a2e";
  ctx.fillText("↩  В меню  (Enter)", 0, 8);
  ctx.restore();

  ctx.restore();
}

// ===== ОБНОВЛЕНИЕ =====
function update() {
  if (gameState !== "playing") {
    updateOverlayParticles();
    updateComboPopups();
    overlayTimer++;
    return;
  }
  player.update();
  owner.update();
  updatePoops();
  updateBonuses();
  updateObstacles();
  updateOverlayParticles();
  updateComboPopups();
}

// ===== РИСОВАНИЕ =====
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (gameState === "start") {
    drawStartScreen();
    return;
  }

  drawBg();
  drawLitterBox();
  for (const ob of obstacles) drawObstacle(ob);
  drawBonuses();
  drawPoops();
  owner.draw();
  player.draw();
  drawOverlayParticles();
  drawComboPopups();
  drawUI();

  if (gameState !== "playing") drawOverlay();
}

// ===== ИГРОВОЙ ЦИКЛ =====
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
generateLevel();
gameLoop();
