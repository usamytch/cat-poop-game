// ==========================================
// audio.test.js — panic melody, mutual exclusion, state transitions
// ==========================================
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  // Сбрасываем состояние мелодий перед каждым тестом
  stopMelody();
  stopPanicMelody();
});

// ---------------------------------------------------------------------------
describe('melody data constants', () => {
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
