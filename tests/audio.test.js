// ==========================================
// audio.test.js — panic melody, mutual exclusion, state transitions
// ==========================================
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  if (_audioPauseTimer) clearTimeout(_audioPauseTimer);
  _audioPauseTimer = null;
  _audioPaused = false;
  muted = false;
  currentLocation = locationThemes[0];
  if (_ac) { _ac.currentTime = 0; _ac.state = 'running'; }
  // Сбрасываем состояние мелодий перед каждым тестом
  stopMelody();
  stopPanicMelody();
});

afterEach(() => {
  if (_audioPauseTimer) clearTimeout(_audioPauseTimer);
  _audioPauseTimer = null;
  _audioPaused = false;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('melody data constants', () => {
  it('has one original theme for every location', () => {
    const locationKeys = locationThemes.map(theme => theme.key).sort();
    expect(Object.keys(_LOCATION_MELODIES).sort()).toEqual(locationKeys);
    expect(Object.keys(_LOCATION_PANIC_MELODIES).sort()).toEqual(locationKeys);
  });

  it('every location theme has valid notes and loop metadata', () => {
    for (const theme of Object.values(_LOCATION_MELODIES)) {
      expect(theme.title.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
      expect(theme.bpm).toBeGreaterThan(0);
      expect(theme.beats).toBeGreaterThan(0);
      expect(theme.duration).toBeCloseTo(theme.beats * theme.eighth);
      expect(theme.notes.length).toBeGreaterThan(0);

      for (const note of theme.notes) {
        expect(note).toHaveLength(5);
        expect(note[0]).toBeGreaterThan(0);
        expect(note[1]).toBeGreaterThanOrEqual(0);
        expect(note[1] + note[2]).toBeLessThanOrEqual(theme.beats);
        expect(['sine', 'square', 'sawtooth', 'triangle']).toContain(note[4]);
      }
    }
  });

  it('panic variants are exact faster timeline reversals of their location themes', () => {
    for (const [key, normal] of Object.entries(_LOCATION_MELODIES)) {
      const panic = _LOCATION_PANIC_MELODIES[key];
      const expected = normal.notes.map(note => [
        note[0], normal.beats - note[1] - note[2], note[2], note[3], note[4],
      ]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);

      expect(panic.bpm).toBeCloseTo(normal.bpm * _PANIC_SPEED);
      expect(panic.duration).toBeLessThan(normal.duration);
      expect(panic.notes).toEqual(expected);
    }
  });

  it('_PANIC_BPM is faster than _BPM', () => {
    expect(_PANIC_BPM).toBeGreaterThan(_BPM);
  });

  it('_PE is shorter than _E (faster tempo)', () => {
    expect(_PE).toBeLessThan(_E);
  });

  it('_PANIC_MELODY_NOTES is a non-empty array', () => {
    expect(Array.isArray(_PANIC_MELODY_NOTES)).toBe(true);
    expect(_PANIC_MELODY_NOTES.length).toBeGreaterThan(0);
  });

  it('each panic note has 5 fields [freq, beat, dur, vol, type]', () => {
    for (const note of _PANIC_MELODY_NOTES) {
      expect(note).toHaveLength(5);
      expect(typeof note[0]).toBe('number'); // freq
      expect(typeof note[1]).toBe('number'); // beat offset
      expect(typeof note[2]).toBe('number'); // duration
      expect(typeof note[3]).toBe('number'); // volume
      expect(typeof note[4]).toBe('string'); // oscillator type
    }
  });

  it('_PANIC_MELODY_DUR is positive', () => {
    expect(_PANIC_MELODY_DUR).toBeGreaterThan(0);
  });

  it('panic loop is shorter than normal loop (more tension)', () => {
    expect(_PANIC_MELODY_DUR).toBeLessThan(_MELODY_DUR);
  });
});

// ---------------------------------------------------------------------------
describe('location-aware soundtrack selection', () => {
  it('startMelody selects the current location theme', () => {
    currentLocation = locationThemes.find(theme => theme.key === 'bathroom');
    startMelody();
    expect(_melodyTheme.key).toBe('bathroom');
  });

  it('startPanicMelody selects the matching reversed theme', () => {
    currentLocation = locationThemes.find(theme => theme.key === 'basement');
    startPanicMelody();
    expect(_panicTheme.key).toBe('basement');
    expect(_panicTheme).toBe(_LOCATION_PANIC_MELODIES.basement);
  });

  it('syncLocationMelody switches themes when a new location starts', () => {
    gameState = 'playing';
    currentLocation = locationThemes.find(theme => theme.key === 'hall');
    startMelody();
    const hallStart = _melodyStartTime;

    currentLocation = locationThemes.find(theme => theme.key === 'kitchen');
    _ac.currentTime = hallStart + 1;
    syncLocationMelody();

    expect(_melodyTheme.key).toBe('kitchen');
    expect(_melodyStartTime).toBe(hallStart + 1);
  });

  it('syncLocationMelody keeps playing within the same location act', () => {
    gameState = 'playing';
    currentLocation = locationThemes.find(theme => theme.key === 'country');
    startMelody();
    const startTime = _melodyStartTime;

    _ac.currentTime = startTime + 1;
    syncLocationMelody();

    expect(_melodyStartTime).toBe(startTime);
  });
});

// ---------------------------------------------------------------------------
describe('audio pause / resume', () => {
  it('fades, suspends and resumes the same melody clock', () => {
    vi.useFakeTimers();
    gameState = 'playing';
    startMelody();
    const startTime = _melodyStartTime;
    const master = _melodyMaster;

    pauseAudio();

    expect(_audioPaused).toBe(true);
    expect(_melodyTimer).toBeNull();
    expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.001, 0.04);

    vi.advanceTimersByTime(50);
    expect(_ac.state).toBe('suspended');

    resumeAudio();

    expect(_audioPaused).toBe(false);
    expect(_ac.state).toBe('running');
    expect(_melodyStartTime).toBe(startTime);
    expect(_melodyMaster).toBe(master);
    expect(_melodyTimer).not.toBeNull();
    stopMelody();
  });

  it('restores the correct panic theme after pause', () => {
    vi.useFakeTimers();
    gameState = 'playing';
    player.urge = 80;
    startPanicMelody();
    const panicStart = _panicStartTime;

    pauseAudio();
    vi.advanceTimersByTime(50);
    resumeAudio();

    expect(_panicStartTime).toBe(panicStart);
    expect(_panicTimer).not.toBeNull();
    expect(_melodyStartTime).toBeNull();
    stopPanicMelody();
  });
});

// ---------------------------------------------------------------------------
describe('startPanicMelody / stopPanicMelody state', () => {
  it('_panicStartTime is null initially', () => {
    expect(_panicStartTime).toBeNull();
  });

  it('startPanicMelody sets _panicStartTime', () => {
    startPanicMelody();
    expect(_panicStartTime).not.toBeNull();
    stopPanicMelody();
  });

  it('stopPanicMelody resets _panicStartTime to null', () => {
    startPanicMelody();
    stopPanicMelody();
    expect(_panicStartTime).toBeNull();
  });

  it('stopPanicMelody clears _panicNodes', () => {
    startPanicMelody();
    stopPanicMelody();
    expect(_panicNodes.length).toBe(0);
  });

  it('stopPanicMelody resets _panicScheduled to -1', () => {
    startPanicMelody();
    stopPanicMelody();
    expect(_panicScheduled).toBe(-1);
  });

  it('calling startPanicMelody twice does not double-start (idempotent)', () => {
    startPanicMelody();
    const firstStartTime = _panicStartTime;
    startPanicMelody(); // второй вызов должен быть проигнорирован
    expect(_panicStartTime).toBe(firstStartTime);
    stopPanicMelody();
  });
});

// ---------------------------------------------------------------------------
describe('mutual exclusion — panic and normal melody cannot play together', () => {
  it('startPanicMelody stops normal melody (_melodyStartTime becomes null)', () => {
    startMelody();
    expect(_melodyStartTime).not.toBeNull();
    startPanicMelody();
    // startPanicMelody вызывает stopMelody() внутри
    expect(_melodyStartTime).toBeNull();
    stopPanicMelody();
  });

  it('startMelody stops panic melody (_panicStartTime becomes null)', () => {
    startPanicMelody();
    expect(_panicStartTime).not.toBeNull();
    startMelody();
    // startMelody вызывает stopPanicMelody() внутри
    expect(_panicStartTime).toBeNull();
    stopMelody();
  });

  it('after startPanicMelody, normal melody nodes are cleared', () => {
    startMelody();
    startPanicMelody();
    expect(_melodyNodes.length).toBe(0);
    stopPanicMelody();
  });

  it('after startMelody, panic melody nodes are cleared', () => {
    startPanicMelody();
    startMelody();
    expect(_panicNodes.length).toBe(0);
    stopMelody();
  });

  it('both melodies are stopped simultaneously by stopMelody + stopPanicMelody', () => {
    startMelody();
    stopMelody();
    stopPanicMelody();
    expect(_melodyStartTime).toBeNull();
    expect(_panicStartTime).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('panic melody triggered by player urge threshold', () => {
  beforeEach(() => {
    gameState = 'playing';
    difficulty = 'normal';
    obstacles.length = 0;
    owner.active = false;
    // Стартуем обычную мелодию как в реальной игре
    startMelody();
  });

  it('normal melody plays when urge < 75%', () => {
    player.urge = 70; // ниже порога
    player.update();
    // Обычная мелодия должна играть, паника — нет
    expect(_melodyStartTime).not.toBeNull();
    expect(_panicStartTime).toBeNull();
  });

  it('panic melody starts when urge crosses 75%', () => {
    player.urge = 76; // выше порога
    player.update();
    expect(_panicStartTime).not.toBeNull();
    expect(_melodyStartTime).toBeNull(); // обычная остановлена
  });

  it('panic melody does not restart on every frame (idempotent)', () => {
    player.urge = 80;
    player.update();
    const firstPanicStart = _panicStartTime;
    player.update(); // второй кадр
    player.update(); // третий кадр
    expect(_panicStartTime).toBe(firstPanicStart); // не изменился
  });

  it('normal melody resumes when urge drops below 75% (e.g. after pill)', () => {
    // Сначала входим в панику
    player.urge = 80;
    player.update();
    expect(_panicStartTime).not.toBeNull();

    // Симулируем таблетку: резко снижаем срочность
    player.urge = 50;
    player.update();

    // Паника должна остановиться, обычная — возобновиться
    expect(_panicStartTime).toBeNull();
    expect(_melodyStartTime).not.toBeNull();
  });

  it('panic melody stops on accident (urge >= 100)', () => {
    player.urge = 80;
    player.update(); // входим в панику
    expect(_panicStartTime).not.toBeNull();

    // Форсируем аварию
    player.urge = 100;
    player.update();

    // После аварии обе мелодии должны быть остановлены
    expect(_panicStartTime).toBeNull();
    expect(_melodyStartTime).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('toggleMute restores correct melody', () => {
  it('unmuting in panic state restores panic melody', () => {
    gameState = 'playing';
    player.urge = 80; // паника
    muted = true;
    stopMelody();
    stopPanicMelody();

    toggleMute(); // unmute
    expect(muted).toBe(false);
    expect(_panicStartTime).not.toBeNull();
    expect(_melodyStartTime).toBeNull();
    stopPanicMelody();
  });

  it('unmuting in normal state restores normal melody', () => {
    gameState = 'playing';
    player.urge = 30; // не паника
    muted = true;
    stopMelody();
    stopPanicMelody();

    toggleMute(); // unmute
    expect(muted).toBe(false);
    expect(_melodyStartTime).not.toBeNull();
    expect(_panicStartTime).toBeNull();
    stopMelody();
  });

  it('muting stops both melodies', () => {
    gameState = 'playing';
    startMelody();
    muted = false;
    toggleMute(); // mute
    expect(muted).toBe(true);
    expect(_melodyStartTime).toBeNull();
    expect(_panicStartTime).toBeNull();
  });
});
