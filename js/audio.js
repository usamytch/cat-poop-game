// ==========================================
// AUDIO — Web Audio API, procedural sounds, melody scheduler
// ==========================================
// Note: melody note data (_BPM, _E, _S, _MELODY_NOTES, _MELODY_DUR)
// is defined in js/melody-data.js (loaded before this file).

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
function sndLifeLost() {
  tone(523,"sine",0.15,0.3,0.0);
  tone(415,"sine",0.15,0.3,0.18);
  tone(330,"sine",0.2, 0.3,0.36);
  tone(262,"sine",0.3, 0.25,0.56);
}

// ==========================================
// Планировщик с Web Audio API clock
// ==========================================

// --- Обычная мелодия ---
let _melodyStartTime = null;  // ac.currentTime момента старта
let _melodyScheduled = -1;    // последняя запланированная итерация
// OPT 11: setTimeout вместо rAF — планировщик мелодии нужен раз в 500мс, не 60fps
let _melodyTimer = null;
let _melodyNodes = [];        // все активные [oscillator, gain] пары
// Мастер-шина обычной мелодии: обнуление gain мгновенно глушит все ноты,
// даже те что запланированы в будущем (o.stop(futureTime) ненадёжен в Web Audio)
let _melodyMaster = null;

function _getMelodyMaster() {
  const ac = getAC();
  if (!_melodyMaster) {
    _melodyMaster = ac.createGain();
    _melodyMaster.connect(ac.destination);
  }
  return _melodyMaster;
}

function _scheduleMelodyIteration(iteration) {
  const ac = getAC();
  const master = _getMelodyMaster();
  const iterStart = _melodyStartTime + iteration * _MELODY_DUR;
  _MELODY_NOTES.forEach(function(note) {
    const freq = note[0], beat = note[1], durBeats = note[2], vol = note[3], type = note[4];
    const t   = iterStart + beat * _E;
    const dur = durBeats * _E;
    if (t + dur < ac.currentTime) return; // уже прошло
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      // Осциллятор → нота-gain → мастер-gain → destination
      o.connect(g); g.connect(master);
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
      _melodyNodes.push([o, g]);
    } catch(e) {}
  });
  _melodyScheduled = iteration;
}

function _melodyTick() {
  if (muted || _melodyStartTime === null) return;
  const ac = getAC();
  const elapsed = ac.currentTime - _melodyStartTime;
  const currentIter = Math.floor(elapsed / _MELODY_DUR);
  // Всегда держим запланированными текущую + следующую итерации
  const needed = currentIter + 1;
  if (needed > _melodyScheduled) {
    _scheduleMelodyIteration(needed);
  }
  // OPT 11: проверяем раз в 500мс — достаточно для lookahead ~14 сек
  _melodyTimer = setTimeout(_melodyTick, 500);
}

function startMelody() {
  stopMelody();
  stopPanicMelody();
  if (muted) return;
  const ac = getAC();
  // Создаём свежую мастер-шину (старая была отключена в stopMelody)
  _melodyMaster = ac.createGain();
  _melodyMaster.gain.setValueAtTime(1, ac.currentTime);
  _melodyMaster.connect(ac.destination);
  _melodyStartTime = ac.currentTime;
  _melodyScheduled = -1;
  // Планируем сразу первые две итерации
  _scheduleMelodyIteration(0);
  _scheduleMelodyIteration(1);
  // OPT 11: setTimeout вместо requestAnimationFrame
  _melodyTimer = setTimeout(_melodyTick, 500);
}

function stopMelody() {
  if (_melodyTimer) { clearTimeout(_melodyTimer); _melodyTimer = null; }
  // Мгновенно глушим мастер-шину — все ноты (включая будущие) замолкают
  if (_melodyMaster) {
    try {
      const now = _ac ? _ac.currentTime : 0;
      _melodyMaster.gain.cancelScheduledValues(now);
      _melodyMaster.gain.setValueAtTime(0, now);
      _melodyMaster.disconnect();
    } catch(e) {}
    _melodyMaster = null;
  }
  // Освобождаем осцилляторы (они уже не слышны, но нужно для GC)
  for (const [o, g] of _melodyNodes) {
    try { o.stop(0); o.disconnect(); g.disconnect(); } catch(e) {}
  }
  _melodyNodes = [];
  _melodyStartTime = null;
  _melodyScheduled = -1;
}

// --- Паника-мелодия ---
let _panicStartTime = null;
let _panicScheduled = -1;
let _panicTimer = null;
let _panicNodes = [];
// Мастер-шина паника-мелодии — аналогично обычной
let _panicMaster = null;

function _getPanicMaster() {
  const ac = getAC();
  if (!_panicMaster) {
    _panicMaster = ac.createGain();
    _panicMaster.connect(ac.destination);
  }
  return _panicMaster;
}

function _schedulePanicIteration(iteration) {
  const ac = getAC();
  const master = _getPanicMaster();
  const iterStart = _panicStartTime + iteration * _PANIC_MELODY_DUR;
  _PANIC_MELODY_NOTES.forEach(function(note) {
    const freq = note[0], beat = note[1], durBeats = note[2], vol = note[3], type = note[4];
    const t   = iterStart + beat * _PE;
    const dur = durBeats * _PE;
    if (t + dur < ac.currentTime) return; // уже прошло
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(master);
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
      _panicNodes.push([o, g]);
    } catch(e) {}
  });
  _panicScheduled = iteration;
}

function _panicTick() {
  if (muted || _panicStartTime === null) return;
  const ac = getAC();
  const elapsed = ac.currentTime - _panicStartTime;
  const currentIter = Math.floor(elapsed / _PANIC_MELODY_DUR);
  const needed = currentIter + 1;
  if (needed > _panicScheduled) {
    _schedulePanicIteration(needed);
  }
  // Паника-петля короткая (~5 сек), проверяем чаще — раз в 300мс
  _panicTimer = setTimeout(_panicTick, 300);
}

function startPanicMelody() {
  if (_panicStartTime !== null) return; // уже играет
  stopMelody();
  if (muted) return;
  const ac = getAC();
  // Создаём свежую мастер-шину паники
  _panicMaster = ac.createGain();
  _panicMaster.gain.setValueAtTime(1, ac.currentTime);
  _panicMaster.connect(ac.destination);
  _panicStartTime = ac.currentTime;
  _panicScheduled = -1;
  _schedulePanicIteration(0);
  _schedulePanicIteration(1);
  _panicTimer = setTimeout(_panicTick, 300);
}

function stopPanicMelody() {
  if (_panicTimer) { clearTimeout(_panicTimer); _panicTimer = null; }
  // Мгновенно глушим мастер-шину паники
  if (_panicMaster) {
    try {
      const now = _ac ? _ac.currentTime : 0;
      _panicMaster.gain.cancelScheduledValues(now);
      _panicMaster.gain.setValueAtTime(0, now);
      _panicMaster.disconnect();
    } catch(e) {}
    _panicMaster = null;
  }
  for (const [o, g] of _panicNodes) {
    try { o.stop(0); o.disconnect(); g.disconnect(); } catch(e) {}
  }
  _panicNodes = [];
  _panicStartTime = null;
  _panicScheduled = -1;
}

function toggleMute() {
  muted = !muted;
  if (muted) {
    stopMelody();
    stopPanicMelody();
  } else {
    if (typeof gameState !== "undefined" && gameState === "playing") {
      // Восстанавливаем нужную мелодию в зависимости от состояния паники
      const inPanic = typeof player !== "undefined" && player.urge / player.maxUrge > 0.75;
      if (inPanic) startPanicMelody(); else startMelody();
    }
  }
}
