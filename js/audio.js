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
function sndLifeLost() {
  tone(523,"sine",0.15,0.3,0.0);
  tone(415,"sine",0.15,0.3,0.18);
  tone(330,"sine",0.2, 0.3,0.36);
  tone(262,"sine",0.3, 0.25,0.56);
}

// ==========================================
// МЕЛОДИЯ: ГРЕМЛИНЫ (Jerry Goldsmith)
//
// Бесшовная петля через Web Audio API scheduling:
//   - все ноты планируются через абсолютный ac.currentTime
//   - следующая итерация планируется заранее, пока текущая ещё играет
//   - последняя нота (F5) = первая нота следующей итерации (F5) → шов незаметен
//
// 138 BPM, восьмая = 0.2174 сек, 64 восьмых = ~13.9 сек на петлю
// Тональность: Bb минор
// ==========================================

const _BPM = 138;
const _E   = 60 / _BPM / 2;  // восьмая
const _S   = _E / 2;          // шестнадцатая

// [freq, beatOffset, durBeats, vol, type]  (beatOffset и durBeats в восьмых)
const _MELODY_NOTES = [
  // --- БАС: фанк-синкопы, ноты каждые 1–2 восьмых ---
  // vol: акцент 0.12, слабая доля 0.08, синкопа 0.10
  // dur: короткие staccato 0.7–1.2 восьмых для фанкового щипка

  // Секция A (биты 0–15): Bb-центр, синкопы на F и Eb
  [117, 0,   0.8, 0.12, "sawtooth"],  // Bb1 — удар на 1
  [117, 1,   0.7, 0.08, "sawtooth"],  // Bb1 — слабая
  [88,  1.5, 0.8, 0.10, "sawtooth"],  // F1  — синкопа (между 1 и 2)
  [117, 3,   0.8, 0.11, "sawtooth"],  // Bb1 — 2-я доля
  [88,  4,   0.8, 0.12, "sawtooth"],  // F1  — удар на 3
  [78,  5,   0.7, 0.08, "sawtooth"],  // Eb1 — слабая
  [88,  5.5, 0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 7,   0.8, 0.11, "sawtooth"],  // Bb1 — 4-я доля
  [78,  8,   0.8, 0.12, "sawtooth"],  // Eb1 — удар на 5
  [78,  9,   0.7, 0.08, "sawtooth"],  // Eb1 — слабая
  [88,  9.5, 0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 11,  0.8, 0.11, "sawtooth"],  // Bb1 — 6-я доля
  [88,  12,  0.8, 0.12, "sawtooth"],  // F1  — удар на 7
  [117, 13,  0.7, 0.08, "sawtooth"],  // Bb1 — слабая
  [88,  13.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 15,  0.8, 0.11, "sawtooth"],  // Bb1 — 8-я доля

  // Секция B (биты 16–31): F-центр, подъём к Bb
  [88,  16,  0.8, 0.12, "sawtooth"],  // F1
  [104, 17,  0.7, 0.08, "sawtooth"],  // Ab1
  [88,  17.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [104, 19,  0.8, 0.11, "sawtooth"],  // Ab1
  [104, 20,  0.8, 0.12, "sawtooth"],  // Ab1 — удар
  [117, 21,  0.7, 0.08, "sawtooth"],  // Bb1
  [104, 21.5,0.8, 0.10, "sawtooth"],  // Ab1 — синкопа
  [88,  23,  0.8, 0.11, "sawtooth"],  // F1
  [117, 24,  0.8, 0.12, "sawtooth"],  // Bb1 — удар
  [117, 25,  0.7, 0.08, "sawtooth"],  // Bb1
  [88,  25.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа вниз
  [117, 27,  0.8, 0.11, "sawtooth"],  // Bb1
  [88,  28,  0.8, 0.12, "sawtooth"],  // F1  — удар
  [88,  29,  0.7, 0.08, "sawtooth"],  // F1
  [117, 29.5,0.8, 0.10, "sawtooth"],  // Bb1 — синкопа вверх
  [88,  31,  0.8, 0.11, "sawtooth"],  // F1

  // Секция A' (биты 32–47): Bb с напряжением через Db
  [117, 32,  0.8, 0.12, "sawtooth"],  // Bb1
  [117, 33,  0.7, 0.08, "sawtooth"],  // Bb1
  [88,  33.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 35,  0.8, 0.11, "sawtooth"],  // Bb1
  [88,  36,  0.8, 0.12, "sawtooth"],  // F1
  [78,  37,  0.7, 0.08, "sawtooth"],  // Eb1
  [88,  37.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [78,  39,  0.8, 0.11, "sawtooth"],  // Eb1
  [78,  40,  0.8, 0.12, "sawtooth"],  // Eb1 — удар
  [69,  41,  0.7, 0.09, "sawtooth"],  // Db1 — напряжение
  [78,  41.5,0.8, 0.10, "sawtooth"],  // Eb1 — синкопа
  [69,  43,  0.8, 0.10, "sawtooth"],  // Db1
  [69,  44,  0.8, 0.12, "sawtooth"],  // Db1 — удар
  [78,  45,  0.7, 0.08, "sawtooth"],  // Eb1
  [88,  45.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа вверх
  [117, 47,  0.8, 0.11, "sawtooth"],  // Bb1 — разрядка

  // Секция C (биты 48–63): кульминация, плотный фанк
  [117, 48,  0.8, 0.12, "sawtooth"],  // Bb1
  [78,  49,  0.7, 0.09, "sawtooth"],  // Eb1
  [117, 49.5,0.8, 0.11, "sawtooth"],  // Bb1 — синкопа
  [78,  51,  0.8, 0.10, "sawtooth"],  // Eb1
  [78,  52,  0.8, 0.12, "sawtooth"],  // Eb1 — удар
  [88,  53,  0.7, 0.09, "sawtooth"],  // F1
  [78,  53.5,0.8, 0.10, "sawtooth"],  // Eb1 — синкопа
  [88,  55,  0.8, 0.11, "sawtooth"],  // F1
  [88,  56,  0.8, 0.12, "sawtooth"],  // F1  — удар
  [117, 57,  0.7, 0.09, "sawtooth"],  // Bb1
  [88,  57.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 59,  0.8, 0.11, "sawtooth"],  // Bb1
  [117, 60,  0.8, 0.12, "sawtooth"],  // Bb1 — финальный удар
  [117, 61,  0.7, 0.08, "sawtooth"],  // Bb1
  [88,  61.5,0.8, 0.10, "sawtooth"],  // F1  — синкопа
  [117, 63,  0.8, 0.11, "sawtooth"],  // Bb1 → петля

  // --- СЕКЦИЯ A (биты 0–15): нисходящий хук F5→F4 ---
  [698, 0,   3.5, 0.20, "triangle"],  // F5
  [622, 3.5, 1.5, 0.17, "triangle"],  // Eb5
  [554, 5,   1.5, 0.17, "triangle"],  // Db5
  [523, 6.5, 2.5, 0.18, "triangle"],  // C5
  [466, 9,   1.5, 0.16, "triangle"],  // Bb4
  [415, 10.5,1.5, 0.15, "triangle"],  // Ab4
  [392, 12,  1.5, 0.15, "triangle"],  // G4
  [349, 13.5,2.5, 0.17, "triangle"],  // F4

  // --- СЕКЦИЯ B (биты 16–31): подъём F4→F5 ---
  [349, 16,  2.0, 0.15, "triangle"],  // F4
  [392, 18,  1.5, 0.15, "triangle"],  // G4
  [415, 19.5,1.5, 0.16, "triangle"],  // Ab4
  [466, 21,  2.5, 0.17, "triangle"],  // Bb4
  [523, 23.5,1.5, 0.17, "triangle"],  // C5
  [554, 25,  1.5, 0.17, "triangle"],  // Db5
  [622, 26.5,1.5, 0.18, "triangle"],  // Eb5
  [698, 28,  4.0, 0.20, "triangle"],  // F5

  // --- СЕКЦИЯ A' (биты 32–47): хук с форшлагами ---
  [698, 32,  2.5, 0.20, "triangle"],  // F5
  [784, 34.5,0.5, 0.14, "triangle"],  // G5 — форшлаг
  [698, 35,  1.0, 0.18, "triangle"],  // F5
  [622, 36,  1.5, 0.17, "triangle"],  // Eb5
  [554, 37.5,1.0, 0.16, "triangle"],  // Db5
  [523, 38.5,0.5, 0.15, "triangle"],  // C5
  [466, 39,  2.0, 0.17, "triangle"],  // Bb4
  [415, 41,  1.0, 0.15, "triangle"],  // Ab4
  [392, 42,  1.0, 0.14, "triangle"],  // G4
  [349, 43,  1.5, 0.15, "triangle"],  // F4
  [311, 44.5,1.5, 0.14, "triangle"],  // Eb4
  [349, 46,  2.0, 0.16, "triangle"],  // F4

  // --- СЕКЦИЯ C (биты 48–63): кульминация G5, спуск к F5 → петля ---
  [466, 48,  1.5, 0.17, "triangle"],  // Bb4
  [554, 49.5,1.5, 0.18, "triangle"],  // Db5
  [622, 51,  1.5, 0.19, "triangle"],  // Eb5
  [698, 52.5,1.5, 0.20, "triangle"],  // F5
  [784, 54,  3.0, 0.22, "triangle"],  // G5 — пик
  [698, 57,  1.5, 0.19, "triangle"],  // F5
  [622, 58.5,1.5, 0.17, "triangle"],  // Eb5
  [554, 60,  1.0, 0.16, "triangle"],  // Db5
  [523, 61,  1.0, 0.16, "triangle"],  // C5
  [466, 62,  1.0, 0.17, "triangle"],  // Bb4
  // Последняя нота F5 затухает — следующая петля начинается с F5: шов незаметен
  [698, 63,  1.3, 0.18, "triangle"],  // F5 → петля
];

// Длительность петли: ровно 64 восьмых
const _MELODY_DUR = 64 * _E;

// ==========================================
// Планировщик с Web Audio API clock
// ==========================================

let _melodyStartTime = null;  // ac.currentTime момента старта
let _melodyScheduled = -1;    // последняя запланированная итерация
let _melodyRAF = null;
let _melodyNodes = [];        // все активные [oscillator, gain] пары

function _scheduleMelodyIteration(iteration) {
  const ac = getAC();
  const iterStart = _melodyStartTime + iteration * _MELODY_DUR;
  _MELODY_NOTES.forEach(function(note) {
    const freq = note[0], beat = note[1], durBeats = note[2], vol = note[3], type = note[4];
    const t   = iterStart + beat * _E;
    const dur = durBeats * _E;
    if (t + dur < ac.currentTime) return; // уже прошло
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
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
  _melodyRAF = requestAnimationFrame(_melodyTick);
}

function startMelody() {
  stopMelody();
  if (muted) return;
  const ac = getAC();
  _melodyStartTime = ac.currentTime;
  _melodyScheduled = -1;
  // Планируем сразу первые две итерации
  _scheduleMelodyIteration(0);
  _scheduleMelodyIteration(1);
  _melodyRAF = requestAnimationFrame(_melodyTick);
}

function stopMelody() {
  if (_melodyRAF) { cancelAnimationFrame(_melodyRAF); _melodyRAF = null; }
  // Немедленно останавливаем все запланированные осцилляторы
  for (const [o, g] of _melodyNodes) {
    try {
      g.gain.cancelScheduledValues(0);
      g.gain.setValueAtTime(0, 0);
      o.stop(0);
      o.disconnect();
      g.disconnect();
    } catch(e) {}
  }
  _melodyNodes = [];
  _melodyStartTime = null;
  _melodyScheduled = -1;
}

function toggleMute() {
  muted = !muted;
  if (muted) {
    stopMelody();
  } else {
    if (typeof gameState !== "undefined" && gameState === "playing") startMelody();
  }
}
