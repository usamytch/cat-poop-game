// ==========================================
// MELODY DATA — original procedural themes by location
// ==========================================
//
// Each note is [frequency, beatOffset, durationInEighths, volume, oscillator].
// Themes use short, original motifs rather than quoted film/game melodies.
// Panic mode is generated from the active theme: the whole note timeline is
// reversed and played 38% faster.

const _PRESSURE_SPEED = AUDIO_MIX.pressureSpeed;
const _PANIC_SPEED = AUDIO_MIX.panicSpeed;

function _midi(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function _addSequence(notes, pitches, start, step, duration, volume, type, minActStep) {
  pitches.forEach(function(pitch, index) {
    if (pitch === null) return;
    const note = [_midi(pitch), start + index * step, duration, volume, type];
    if (minActStep && minActStep > 1) note.push(minActStep);
    notes.push(note);
  });
}

function _addPattern(notes, pitches, start, step, duration, volume, type, repeats, minActStep) {
  for (let repeat = 0; repeat < repeats; repeat++) {
    _addSequence(notes, pitches, start + repeat * pitches.length * step, step, duration, volume, type, minActStep);
  }
}

function _addChord(notes, pitches, beat, duration, volume, type, minActStep) {
  pitches.forEach(function(pitch) {
    const note = [_midi(pitch), beat, duration, volume, type];
    if (minActStep && minActStep > 1) note.push(minActStep);
    notes.push(note);
  });
}

function _makeTheme(key, title, description, bpm, beats, build) {
  const notes = [];
  build(notes);
  notes.sort(function(a, b) { return a[1] - b[1] || a[0] - b[0]; });
  const eighth = 60 / bpm / 2;
  return {
    key: key,
    title: title,
    description: description,
    bpm: bpm,
    beats: beats,
    eighth: eighth,
    duration: beats * eighth,
    notes: notes,
  };
}

const _LOCATION_MELODIES = {
  // Warm hearth-folk: rocking 6/8, open fifths and a small whistle-like hook.
  hall: _makeTheme("hall", "Уют у очага", "домашний фолк у камина", 96, 32, function(n) {
    _addPattern(n, [48,55,60,55,52,55,60,55], 0, 1, 0.82, 0.038, "triangle", 4);
    _addSequence(n, [36,null,null,null,41,null,null,null,43,null,null,null,38,null,null,null,
                     36,null,null,null,41,null,null,null,43,null,38,null,36,null,null,null],
                     0, 1, 2.6, 0.065, "sine");
    _addSequence(n, [67,null,69,67,64,null,62,null,64,null,67,69,67,null,64,null,
                     72,null,71,69,67,null,64,null,62,64,67,null,64,62,60,null],
                     0, 1, 1.55, 0.095, "sine");
    [0,8,16,24].forEach(function(beat, i) {
      _addChord(n, i % 2 ? [53,57,60] : [48,52,55], beat, 3.4, 0.022, "triangle");
    });
  }),

  // Sea waltz: rolling arpeggios rise and fall like water in a light 6/8 sway.
  bathroom: _makeTheme("bathroom", "Солёные брызги", "морской вальс с волнами", 112, 36, function(n) {
    _addPattern(n, [45,52,57,60,57,52,43,50,55,59,55,50], 0, 0.5, 0.43, 0.034, "sine", 3);
    _addSequence(n, [33,null,null,null,null,null,31,null,null,null,null,null,
                     29,null,null,null,null,null,33,null,null,null,null,null,
                     31,null,null,null,null,null,28,null,null,null,null,null],
                     0, 1, 3.8, 0.06, "triangle");
    _addSequence(n, [69,null,72,74,null,72,69,null,67,69,72,null,
                     76,null,74,72,null,69,67,null,69,71,72,null,
                     74,null,76,74,null,72,69,67,69,null,64,null],
                     0, 1, 1.7, 0.09, "sine");
    _addSequence(n, [81,null,null,79,null,null,76,null,null,79,null,null],
                     0, 3, 2.2, 0.028, "triangle");
  }),

  // Kitchen comedy: clipped bass, off-beat chords and a wooden mallet lead.
  kitchen: _makeTheme("kitchen", "Поварской переполох", "кухонный ксилофонный свинг", 132, 32, function(n) {
    _addPattern(n, [36,null,43,36,null,45,43,null], 0, 1, 0.62, 0.07, "square", 4);
    _addSequence(n, [72,76,79,null,78,76,74,null,72,74,76,77,76,null,72,null,
                     79,78,76,74,72,null,69,null,71,72,74,76,72,null,67,null],
                     0, 1, 0.72, 0.085, "triangle");
    [1.5,5.5,9.5,13.5,17.5,21.5,25.5,29.5].forEach(function(beat, i) {
      _addChord(n, i % 2 ? [62,65,69] : [60,64,67], beat, 0.48, 0.026, "square");
    });
    _addSequence(n, [84,null,null,83,null,null,81,null,79,null,null,76,null,null,79,null],
                     0, 2, 0.38, 0.027, "sine");
  }),

  // Slapstick chase: chromatic scurrying and emphatic cartoon punctuation.
  street: _makeTheme("street", "Хвост трубой", "мультяшная погоня во дворе", 154, 32, function(n) {
    _addPattern(n, [40,47,40,48,40,49,47,43], 0, 0.5, 0.34, 0.055, "sawtooth", 8);
    _addSequence(n, [67,69,70,71,72,null,76,null,74,72,71,69,67,null,66,null,
                     67,70,74,77,76,74,72,70,69,71,72,74,71,67,null,null],
                     0, 1, 0.58, 0.082, "triangle");
    _addSequence(n, [79,null,78,null,77,null,76,null,84,null,81,null,78,null,74,null],
                     0, 2, 0.4, 0.032, "square");
    [7.5,15.5,23.5,31].forEach(function(beat, i) {
      _addChord(n, i === 3 ? [60,64,67,72] : [59,62,65], beat, 0.42, 0.045, "sawtooth");
    });
  }),

  // Original psychedelic-rock jam. Layers 2..5 are scheduled from the start
  // but opened by gain as the act advances, so the clock never restarts.
  country: _makeTheme("country", "Кислота в сметане", "дачный психоделический джем", 120, 32, function(n) {
    // 1/5: lazy bass riff + pulse.
    _addPattern(n, [40,null,40,43,45,null,43,38], 0, 1, 0.82, 0.068, "triangle", 4);
    _addPattern(n, [52,52,null,55,57,null,55,null], 0, 1, 0.42, 0.030, "square", 4);
    // 2/5: trembling organ chords.
    [0,8,16,24].forEach(function(beat, i) {
      _addChord(n, i % 2 ? [55,60,64] : [52,57,60], beat, 6.2, 0.024, "triangle", 2);
    });
    // 3/5: fuzz-like saw lead, entirely original.
    _addSequence(n, [64,null,67,69,67,64,null,62,64,67,null,71,69,67,64,null,
                     64,67,69,71,74,null,71,69,67,null,64,62,64,null,null],
                     0, 1, 0.78, 0.072, "sawtooth", 3);
    // 4/5: floating high response.
    _addSequence(n, [76,null,null,79,null,78,null,74,76,null,81,null,79,null,76,null],
                     0, 2, 1.45, 0.030, "sine", 4);
    // 5/5: CATSTOCK punctuation on phrase boundaries.
    [7.5,15.5,23.5,31].forEach(function(beat, i) {
      _addChord(n, i === 3 ? [52,59,64,71] : [50,57,62], beat, 0.44, 0.050, "square", 5);
    });
  }),

  // Desert stealth: Phrygian colour, low drone and an angular plucked motif.
  basement: _makeTheme("basement", "Песок под камнем", "персидский стелс в темноте", 104, 32, function(n) {
    _addPattern(n, [38,null,39,38,45,null,43,39], 0, 1, 0.62, 0.065, "sawtooth", 4);
    _addSequence(n, [50,51,54,55,57,55,54,51,50,null,46,48,50,null,51,null,
                     62,63,66,67,69,67,66,63,62,58,60,62,63,60,58,null],
                     0, 1, 0.74, 0.082, "triangle");
    _addSequence(n, [26,null,null,null,26,null,null,null,27,null,null,null,26,null,null,null,
                     26,null,null,null,22,null,null,null,24,null,null,null,26,null,null,null],
                     0, 1, 3.2, 0.07, "sine");
    _addSequence(n, [74,null,null,75,null,72,null,null,70,null,72,null,74,null,70,null],
                     0, 2, 0.52, 0.027, "square");
  }),
};

function _reverseTheme(theme) {
  const bpm = theme.bpm * _PANIC_SPEED;
  const eighth = 60 / bpm / 2;
  const notes = theme.notes.map(function(note) {
    const reversed = [note[0], theme.beats - note[1] - note[2], note[2], note[3], note[4]];
    if (note[5]) reversed.push(note[5]);
    return reversed;
  }).sort(function(a, b) { return a[1] - b[1] || a[0] - b[0]; });

  return {
    key: theme.key,
    title: theme.title + " — паника",
    description: "ускоренная обратная версия",
    bpm: bpm,
    beats: theme.beats,
    eighth: eighth,
    duration: theme.beats * eighth,
    notes: notes,
  };
}

function _makePressureTheme(theme) {
  const bpm = theme.bpm * _PRESSURE_SPEED;
  const eighth = 60 / bpm / 2;
  return {
    key: theme.key,
    title: theme.title + " — прижало",
    description: "слегка ускоренная исходная версия",
    bpm: bpm,
    beats: theme.beats,
    eighth: eighth,
    duration: theme.beats * eighth,
    notes: theme.notes.map(function(note) { return note.slice(); }),
  };
}

const _LOCATION_PRESSURE_MELODIES = {};
Object.keys(_LOCATION_MELODIES).forEach(function(key) {
  _LOCATION_PRESSURE_MELODIES[key] = _makePressureTheme(_LOCATION_MELODIES[key]);
});

const _LOCATION_PANIC_MELODIES = {};
Object.keys(_LOCATION_MELODIES).forEach(function(key) {
  _LOCATION_PANIC_MELODIES[key] = _reverseTheme(_LOCATION_MELODIES[key]);
});

function getLocationMelody(locationKey, mode) {
  // Boolean mode remains compatible with older console experiments/tests.
  if (mode === true) mode = "panic";
  if (mode === false || mode === undefined) mode = "calm";
  const catalog = mode === "panic"
    ? _LOCATION_PANIC_MELODIES
    : mode === "pressure" ? _LOCATION_PRESSURE_MELODIES : _LOCATION_MELODIES;
  return catalog[locationKey] || catalog.hall;
}

// Backward-compatible aliases for older tests and console experiments.
const _BPM = _LOCATION_MELODIES.hall.bpm;
const _E = _LOCATION_MELODIES.hall.eighth;
const _S = _E / 2;
const _MELODY_NOTES = _LOCATION_MELODIES.hall.notes;
const _MELODY_DUR = _LOCATION_MELODIES.hall.duration;
const _PANIC_BPM = _LOCATION_PANIC_MELODIES.hall.bpm;
const _PE = _LOCATION_PANIC_MELODIES.hall.eighth;
const _PANIC_MELODY_NOTES = _LOCATION_PANIC_MELODIES.hall.notes;
const _PANIC_MELODY_DUR = _LOCATION_PANIC_MELODIES.hall.duration;
