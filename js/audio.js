// ==========================================
// AUDIO — Web Audio API, procedural sounds
// ==========================================

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
