// ==========================================
// AUDIO — procedural SFX, buses, phase-aware music scheduler
// ==========================================

let _ac = null;
let muted = false;
let _audioPaused = false;
let _audioPauseTimer = null;

let _audioMaster = null;
let _musicBus = null;
let _sfxBus = null;
let _tensionBus = null;

function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  _ensureAudioGraph();
  return _ac;
}

function _ensureAudioGraph() {
  if (!_ac || _audioMaster) return;
  _audioMaster = _ac.createGain();
  _musicBus = _ac.createGain();
  _sfxBus = _ac.createGain();
  _tensionBus = _ac.createGain();

  _musicBus.gain.setValueAtTime(AUDIO_MIX.music, _ac.currentTime);
  _sfxBus.gain.setValueAtTime(AUDIO_MIX.sfx, _ac.currentTime);
  _tensionBus.gain.setValueAtTime(AUDIO_MIX.tension, _ac.currentTime);
  _audioMaster.gain.setValueAtTime(muted ? 0.001 : 1, _ac.currentTime);

  _musicBus.connect(_audioMaster);
  _sfxBus.connect(_audioMaster);
  _tensionBus.connect(_audioMaster);
  _audioMaster.connect(_ac.destination);
}

function _releaseOscillator(o, g) {
  try { o.disconnect(); } catch(e) {}
  try { g.disconnect(); } catch(e) {}
}

function _toneToBus(freq, type, dur, vol, delay, busName) {
  if (muted || _audioPaused) return null;
  vol = vol === undefined ? 0.3 : vol;
  delay = delay || 0;
  try {
    const ac = getAC();
    const o = ac.createOscillator(), g = ac.createGain();
    const bus = busName === "tension" ? _tensionBus : _sfxBus;
    o.connect(g); g.connect(bus);
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + delay);
    g.gain.setValueAtTime(vol, ac.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    o.onended = function() { _releaseOscillator(o, g); };
    o.start(ac.currentTime + delay);
    o.stop(ac.currentTime + delay + dur + 0.05);
    return [o, g];
  } catch(e) { return null; }
}

function tone(freq, type, dur, vol, delay) {
  return _toneToBus(freq, type, dur, vol, delay, "sfx");
}

function sndMeow()   { tone(600,"sine",0.12,0.25); tone(900,"sine",0.08,0.2,0.1); tone(700,"sine",0.1,0.15,0.18); }
function sndFart()   { tone(120,"sawtooth",0.08,0.35); tone(90,"sawtooth",0.06,0.3,0.06); tone(60,"square",0.04,0.2,0.1); }
function sndHit()    { tone(200,"square",0.05,0.4); tone(150,"sawtooth",0.04,0.3,0.04); }
function sndAlarm(stage) {
  const urgent = stage >= 3;
  tone(urgent ? 930 : 880,"square",0.055,urgent ? 0.19 : 0.15);
  tone(urgent ? 610 : 660,"square",0.06,urgent ? 0.18 : 0.15,urgent ? 0.075 : 0.1);
}
function sndBodyPulse(strength) {
  const vol = 0.09 + clamp(strength || 0, 0, 1) * 0.08;
  _toneToBus(58,"sine",0.12,vol,0,"tension");
  _toneToBus(42,"triangle",0.09,vol*0.7,0.035,"tension");
}
function sndWin()    { [523,659,784,1047].forEach((f,i) => tone(f,"sine",0.18,0.3,i*0.12)); }
function sndLose()   { [400,300,200,150].forEach((f,i) => tone(f,"sawtooth",0.2,0.35,i*0.14)); }
function sndCombo()  { [800,1000,1200,1500].forEach((f,i) => tone(f,"sine",0.1,0.3,i*0.07)); }
function sndComboHit(stage) {
  const base = stage === 2 ? 330 : 260;
  tone(base, "square", 0.055, 0.32);
  tone(base * 1.5, "sine", 0.07, 0.20, 0.045);
}
function sndOwnerHeard() { tone(520,"triangle",0.07,0.14); tone(690,"triangle",0.08,0.12,0.07); }
function sndOwnerAlert() { tone(760,"square",0.055,0.12); }
function sndPickup() { tone(1200,"sine",0.08,0.2); tone(1500,"sine",0.06,0.15,0.07); }
function sndLifeLost() {
  tone(523,"sine",0.15,0.3,0.0); tone(415,"sine",0.15,0.3,0.18);
  tone(330,"sine",0.2,0.3,0.36); tone(262,"sine",0.3,0.25,0.56);
}
function sndLitterStart() { tone(145,"triangle",0.07,0.12); tone(205,"sine",0.06,0.08,0.045); }
function sndLitterStep(step) {
  const base = 170 + step * 34;
  tone(base,"triangle",0.05,0.09); tone(base*1.36,"sine",0.045,0.06,0.035);
}
function sndLitterComplete() {
  tone(92,"sawtooth",0.12,0.22); tone(64,"sine",0.18,0.20,0.06);
  tone(620,"triangle",0.08,0.13,0.12);
}

// ==========================================
// Unified music scheduler
// ==========================================

let _musicChannel = null;
let _retiringMusicChannels = [];
let _musicTimer = null;
let _musicPressureStage = 0;
let _entryStingerToken = "";

// Backward-compatible debug/test handles. They describe the active unified
// channel rather than owning separate schedulers.
let _melodyStartTime = null, _pressureStartTime = null, _panicStartTime = null;
let _melodyScheduled = -1, _pressureScheduled = -1, _panicScheduled = -1;
let _melodyTimer = null, _pressureTimer = null, _panicTimer = null;
let _melodyNodes = [], _pressureNodes = [], _panicNodes = [];
let _melodyTheme = null, _pressureTheme = null, _panicTheme = null;
let _melodyLayerGains = [], _pressureLayerGains = [], _panicLayerGains = [];
let _melodyMaster = null, _pressureMaster = null, _panicMaster = null;

function _activeArrangementStep() {
  if (typeof getLevelProgression !== "function" || typeof level === "undefined") return ACT.length;
  return getLevelProgression(level).actStep;
}

function _createLayerGains(master) {
  const ac = getAC();
  const activeStep = _activeArrangementStep();
  const gains = [];
  for (let layer = 1; layer <= ACT.length; layer++) {
    const gain = ac.createGain();
    gain.gain.setValueAtTime(layer <= activeStep ? 1 : 0, ac.currentTime);
    gain.connect(master);
    gains.push(gain);
  }
  return gains;
}

function _syncLayerGains(gains) {
  if (!_ac || !gains || gains.length === 0) return;
  const activeStep = _activeArrangementStep();
  for (let i = 0; i < gains.length; i++) {
    const param = gains[i].gain;
    const target = i + 1 <= activeStep ? 1 : 0;
    param.cancelScheduledValues(_ac.currentTime);
    param.setValueAtTime(param.value || 0.0001, _ac.currentTime);
    param.linearRampToValueAtTime(target, _ac.currentTime + 0.24);
  }
}

function _modeForPressureStage(stage) {
  if (stage >= 2) return "panic";
  if (stage === 1) return "pressure";
  return "calm";
}

function _syncLegacyMusicState() {
  _melodyStartTime = _pressureStartTime = _panicStartTime = null;
  _melodyScheduled = _pressureScheduled = _panicScheduled = -1;
  _melodyTimer = _pressureTimer = _panicTimer = null;
  _melodyNodes = []; _pressureNodes = []; _panicNodes = [];
  _melodyTheme = _pressureTheme = _panicTheme = null;
  _melodyLayerGains = []; _pressureLayerGains = []; _panicLayerGains = [];
  _melodyMaster = _pressureMaster = _panicMaster = null;
  if (!_musicChannel) return;
  const c = _musicChannel;
  if (c.mode === "calm") {
    _melodyStartTime=c.startTime; _melodyScheduled=c.scheduled; _melodyTimer=_musicTimer;
    _melodyNodes=c.nodes; _melodyTheme=c.theme; _melodyLayerGains=c.layerGains; _melodyMaster=c.master;
  } else if (c.mode === "pressure") {
    _pressureStartTime=c.startTime; _pressureScheduled=c.scheduled; _pressureTimer=_musicTimer;
    _pressureNodes=c.nodes; _pressureTheme=c.theme; _pressureLayerGains=c.layerGains; _pressureMaster=c.master;
  } else {
    _panicStartTime=c.startTime; _panicScheduled=c.scheduled; _panicTimer=_musicTimer;
    _panicNodes=c.nodes; _panicTheme=c.theme; _panicLayerGains=c.layerGains; _panicMaster=c.master;
  }
}

function _removeMusicNode(channel, pair) {
  const index = channel.nodes.indexOf(pair);
  if (index >= 0) channel.nodes.splice(index, 1);
  _releaseOscillator(pair[0], pair[1]);
}

function _scheduleMusicIteration(channel, iteration) {
  const ac = getAC();
  const iterStart = channel.startTime + iteration * channel.theme.duration;
  channel.theme.notes.forEach(function(note) {
    const freq=note[0], beat=note[1], durBeats=note[2], vol=note[3], type=note[4];
    const layer = clamp(note[5] || 1, 1, ACT.length);
    const t = iterStart + beat * channel.theme.eighth;
    const dur = durBeats * channel.theme.eighth;
    if (t + dur < ac.currentTime) return;
    try {
      const o=ac.createOscillator(), g=ac.createGain();
      o.connect(g); g.connect(channel.layerGains[layer-1] || channel.master);
      o.type=type; o.frequency.setValueAtTime(freq,t);
      g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
      const pair=[o,g]; channel.nodes.push(pair);
      o.onended=function() { _removeMusicNode(channel,pair); };
      o.start(t); o.stop(t+dur+0.05);
    } catch(e) {}
  });
  channel.scheduled = iteration;
}

function _createMusicChannel(theme, mode, beatPosition, initialGain) {
  const ac = getAC();
  const master = ac.createGain();
  master.gain.setValueAtTime(initialGain, ac.currentTime);
  master.connect(_musicBus);
  const channel = {
    theme, mode, master,
    layerGains: _createLayerGains(master),
    nodes: [], scheduled: -1, active: true,
    startTime: ac.currentTime - beatPosition * theme.eighth,
  };
  const currentIteration = Math.max(0, Math.floor((ac.currentTime-channel.startTime)/theme.duration));
  _scheduleMusicIteration(channel,currentIteration);
  _scheduleMusicIteration(channel,currentIteration+1);
  return channel;
}

function _releaseMusicChannel(channel) {
  if (!channel || !channel.active) return;
  channel.active = false;
  for (const pair of channel.nodes.slice()) {
    try { pair[0].onended = null; pair[0].stop(0); } catch(e) {}
    _releaseOscillator(pair[0],pair[1]);
  }
  channel.nodes.length=0;
  for (const gain of channel.layerGains) { try { gain.disconnect(); } catch(e) {} }
  channel.layerGains.length=0;
  try { channel.master.disconnect(); } catch(e) {}
  const index=_retiringMusicChannels.indexOf(channel);
  if (index>=0) _retiringMusicChannels.splice(index,1);
}

function _musicBeatPosition(channel) {
  if (!channel || !_ac) return 0;
  const beats = (_ac.currentTime-channel.startTime)/channel.theme.eighth;
  return ((beats % channel.theme.beats)+channel.theme.beats)%channel.theme.beats;
}

function _scheduleMusicTimer(delay) {
  if (_musicTimer) clearTimeout(_musicTimer);
  _musicTimer=setTimeout(_musicTick,delay === undefined ? 300 : delay);
  _syncLegacyMusicState();
}

function _musicTick() {
  _musicTimer=null;
  if (_audioPaused || !_musicChannel) { _syncLegacyMusicState(); return; }
  const ac=getAC(), c=_musicChannel;
  const currentIteration=Math.max(0,Math.floor((ac.currentTime-c.startTime)/c.theme.duration));
  const needed=currentIteration+1;
  if (needed>c.scheduled) _scheduleMusicIteration(c,needed);
  _scheduleMusicTimer(300);
}

function _transitionMusic(mode, preservePhase) {
  const ac=getAC();
  const locationKey=typeof currentLocation!=="undefined" ? currentLocation.key : "hall";
  const theme=getLocationMelody(locationKey,mode);
  const old=_musicChannel;
  if (old && old.mode===mode && old.theme.key===theme.key) {
    _syncLayerGains(old.layerGains); _syncLegacyMusicState(); return;
  }
  const beatPosition=old && preservePhase ? _musicBeatPosition(old) : 0;
  const next=_createMusicChannel(theme,mode,beatPosition,old ? 0.001 : 1);
  _musicChannel=next;
  if (old) {
    const fade=AUDIO_MIX.crossfadeSeconds;
    old.master.gain.cancelScheduledValues(ac.currentTime);
    old.master.gain.setValueAtTime(Math.max(0.001,old.master.gain.value || 1),ac.currentTime);
    old.master.gain.linearRampToValueAtTime(0.001,ac.currentTime+fade);
    next.master.gain.linearRampToValueAtTime(1,ac.currentTime+fade);
    _retiringMusicChannels.push(old);
    setTimeout(function() { _releaseMusicChannel(old); },Math.round((fade+0.08)*1000));
  }
  _scheduleMusicTimer(300);
}

function _stopAllMusic() {
  if (_musicTimer) { clearTimeout(_musicTimer); _musicTimer=null; }
  if (_musicChannel) _releaseMusicChannel(_musicChannel);
  _musicChannel=null;
  for (const channel of _retiringMusicChannels.slice()) _releaseMusicChannel(channel);
  _retiringMusicChannels.length=0;
  _syncLegacyMusicState();
}

function startMelody() {
  _musicPressureStage=0;
  if (_audioPaused) return;
  _transitionMusic("calm",false);
  _maybePlayEntryStinger();
}

function stopMelody() { _stopAllMusic(); }

function startPanicMelody() {
  _musicPressureStage=Math.max(2,_musicPressureStage);
  if (_audioPaused) return;
  _transitionMusic("panic",!!_musicChannel);
}

function stopPanicMelody() { _stopAllMusic(); }

function setMusicPressureStage(stage) {
  stage=clamp(Math.floor(stage || 0),0,3);
  _musicPressureStage=stage;
  if (_audioPaused || typeof gameState==="undefined" || gameState!=="playing") return;
  _transitionMusic(_modeForPressureStage(stage),true);
}

function syncLocationMelody() {
  if (typeof gameState==="undefined" || gameState!=="playing") return;
  const mode=_modeForPressureStage(_musicPressureStage);
  const locationKey=typeof currentLocation!=="undefined" ? currentLocation.key : "hall";
  if (_musicChannel && _musicChannel.theme.key===locationKey && _musicChannel.mode===mode) {
    _syncLayerGains(_musicChannel.layerGains);
  } else {
    _transitionMusic(mode,false);
  }
  _maybePlayEntryStinger();
}

function _fadeParam(param,target,duration) {
  if (!param || !_ac) return;
  const now=_ac.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(0.001,param.value || 1),now);
  param.linearRampToValueAtTime(target,now+duration);
}

function _duckMusic(duration) {
  if (!_musicBus || !_ac) return;
  const now=_ac.currentTime;
  _musicBus.gain.cancelScheduledValues(now);
  _musicBus.gain.setValueAtTime(AUDIO_MIX.music,now);
  _musicBus.gain.linearRampToValueAtTime(AUDIO_MIX.music*0.52,now+0.04);
  _musicBus.gain.linearRampToValueAtTime(AUDIO_MIX.music,now+(duration || 0.8));
}

function _maybePlayEntryStinger() {
  if (typeof level==="undefined" || typeof currentLocation==="undefined" || muted) return;
  const token=level+":"+currentLocation.key;
  if (_entryStingerToken===token) return;
  _entryStingerToken=token;
  const progression=typeof getLevelProgression==="function" ? getLevelProgression(level) : null;
  if (currentLocation.key==="basement") {
    _duckMusic(1.0);
    [196,208,247,196].forEach((f,i)=>tone(f,i===3?"sawtooth":"triangle",0.16,0.14,i*0.11));
  } else if (progression && progression.isActPeak) {
    _duckMusic(0.85);
    [392,523,659,784].forEach((f,i)=>tone(f,"triangle",0.12,0.12,i*0.075));
  }
}

function pauseAudio() {
  if (_audioPaused) return;
  _audioPaused=true;
  if (_musicTimer) { clearTimeout(_musicTimer); _musicTimer=null; }
  _syncLegacyMusicState();
  if (!_ac) return;
  _fadeParam(_audioMaster.gain,0.001,0.04);
  if (_audioPauseTimer) clearTimeout(_audioPauseTimer);
  _audioPauseTimer=setTimeout(function() {
    _audioPauseTimer=null;
    if (!_audioPaused || !_ac || typeof _ac.suspend!=="function") return;
    try { const result=_ac.suspend(); if (result && result.catch) result.catch(function(){}); } catch(e) {}
  },50);
}

function resumeAudio() {
  if (!_audioPaused) return;
  _audioPaused=false;
  if (_audioPauseTimer) { clearTimeout(_audioPauseTimer); _audioPauseTimer=null; }
  if (_ac && typeof _ac.resume==="function") {
    try { const result=_ac.resume(); if (result && result.catch) result.catch(function(){}); } catch(e) {}
  }
  if (_audioMaster) _fadeParam(_audioMaster.gain,muted ? 0.001 : 1,0.04);
  if (_musicChannel) _scheduleMusicTimer(0);
  else if (typeof gameState!=="undefined" && gameState==="playing") {
    _transitionMusic(_modeForPressureStage(_musicPressureStage),false);
  }
}

function toggleMute() {
  muted=!muted;
  const ac=getAC();
  _audioMaster.gain.cancelScheduledValues(ac.currentTime);
  _audioMaster.gain.setValueAtTime(Math.max(0.001,_audioMaster.gain.value || 1),ac.currentTime);
  _audioMaster.gain.linearRampToValueAtTime(muted ? 0.001 : 1,ac.currentTime+0.04);
  if (!muted && typeof gameState!=="undefined" && gameState==="playing" && !_musicChannel) {
    _transitionMusic(_modeForPressureStage(_musicPressureStage),false);
  }
}
