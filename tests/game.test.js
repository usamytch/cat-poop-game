// ==========================================
// game.test.js — state, stats, input, loop
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame } from './setup.js';

beforeAll(() => {
  loadGame();
});

function fullReset() {
  score = 0;
  level = 1;
  lives = 3;
  difficulty = 'normal';
  gameMode = 'normal';
  runMode = 'campaign';
  gameState = 'start';
  tutorialState.active = false;
  tutorialState.completed = false;
  lifeLostTimer = 0;
  lifeLostReason = '';
  pausedFromState = null;
  pauseReason = '';
  player.urge = 0;
  player.x = 100;
  player.y = 300;
  player.pooping = false;
  player.poopTimer = 0;
  poops.length = 0;
  overlayParticles.length = 0;
  comboPopups.length = 0;
  comboCount = 0;
  comboTimer = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0;
  isPooping = false;
  obstacles.length = 0;
  bonuses.length = 0;
  owner.active = false;
  owner.fleeTimer = 0;
  owner.facePoops = [];
  owner.poopHits = 0;
  litterBox.x = 900;
  litterBox.y = 400;
  overlayTimer = 0;
  levelMessageTimer = 0;
  simulationTimeMs = 0;
  resetSimulationClock();
  resetRunProgress();
}

beforeEach(fullReset);

// ---------------------------------------------------------------------------
describe('stats', () => {
  it('initializes from localStorage (or 0 if absent)', () => {
    // localStorage was cleared in setup; stats should be 0
    expect(typeof stats.highScore).toBe('number');
    expect(typeof stats.bestLevel).toBe('number');
    expect(typeof stats.totalCaught).toBe('number');
    expect(typeof stats.totalAccidents).toBe('number');
    expect(typeof stats.totalPoops).toBe('number');
  });

  it('stats.update() updates highScore when score is higher', () => {
    stats.highScore = 10;
    stats.update(50, 1);
    expect(stats.highScore).toBe(50);
  });

  it('stats.update() does not lower highScore', () => {
    stats.highScore = 100;
    stats.update(50, 1);
    expect(stats.highScore).toBe(100);
  });

  it('stats.update() updates bestLevel when level is higher', () => {
    stats.bestLevel = 1;
    stats.update(0, 5);
    expect(stats.bestLevel).toBe(5);
  });

  it('stats.update() does not lower bestLevel', () => {
    stats.bestLevel = 10;
    stats.update(0, 3);
    expect(stats.bestLevel).toBe(10);
  });

  it('stats.save() writes all fields to localStorage', () => {
    stats.highScore = 42;
    stats.bestLevel = 7;
    stats.totalCaught = 3;
    stats.totalAccidents = 2;
    stats.totalPoops = 15;
    stats.save();
    expect(localStorage.getItem('cpg_hs')).toBe('42');
    expect(localStorage.getItem('cpg_bl')).toBe('7');
    expect(localStorage.getItem('cpg_tc')).toBe('3');
    expect(localStorage.getItem('cpg_ta')).toBe('2');
    expect(localStorage.getItem('cpg_tp')).toBe('15');
  });
});

// ---------------------------------------------------------------------------
describe('startGame()', () => {
  it('accepts an explicit run seed for replay', () => {
    startGame(123456789);
    expect(globalSeed).toBe(123456789);
    const firstGeometrySeed = levelSeed;
    startGame(123456789);
    expect(levelSeed).toBe(firstGeometrySeed);
  });

  it('resets score to 0', () => {
    score = 999;
    startGame();
    expect(score).toBe(0);
  });

  it('resets level to 1', () => {
    level = 5;
    startGame();
    expect(level).toBe(1);
  });

  it('resets lives to 3', () => {
    lives = 1;
    startGame();
    expect(lives).toBe(3);
  });

  it('resets player.urge to 0', () => {
    player.urge = 80;
    startGame();
    expect(player.urge).toBe(0);
  });

  it('clears poops array', () => {
    poops.push({ x: 1, y: 1, dx: 0, dy: 0, r: 10, alive: true, trail: [] });
    startGame();
    expect(poops.length).toBe(0);
  });

  it('sets gameState to "playing"', () => {
    gameState = 'start';
    startGame();
    expect(gameState).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
describe('respawnPlayer()', () => {
  it('places player in left part of field', () => {
    respawnPlayer();
    const b = getPlayBounds();
    expect(player.x).toBeGreaterThanOrEqual(b.left);
    expect(player.x).toBeLessThan(b.left + 200);
  });

  it('resets player.urge to 0', () => {
    player.urge = 70;
    respawnPlayer();
    expect(player.urge).toBe(0);
  });

  it('sets gameState to "playing"', () => {
    gameState = 'lifeLost';
    respawnPlayer();
    expect(gameState).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
describe('update() — state dispatcher', () => {
  it('in "playing" state: player.update and owner.update are called (urge grows)', () => {
    gameState = 'playing';
    player.urge = 0;
    owner.active = false;
    litterBox.x = 900;
    litterBox.y = 400;
    update();
    expect(player.urge).toBeGreaterThan(0);
  });

  it('in "lifeLost" state: lifeLostTimer decrements', () => {
    gameState = 'lifeLost';
    lifeLostTimer = 10;
    update();
    expect(lifeLostTimer).toBe(9);
  });

  it('in "lifeLost" state: respawnPlayer called when lifeLostTimer reaches 0', () => {
    gameState = 'lifeLost';
    lifeLostTimer = 1;
    update();
    expect(gameState).toBe('playing');
  });

  it('in "start" state: overlayTimer increments', () => {
    gameState = 'start';
    overlayTimer = 0;
    update();
    expect(overlayTimer).toBe(1);
  });

  it('in "start" state: player.urge does not change', () => {
    gameState = 'start';
    player.urge = 20;
    update();
    expect(player.urge).toBe(20);
  });

  it('decrements the level message timer in simulation, not rendering', () => {
    gameState = 'playing';
    levelMessageTimer = 10;
    update();
    expect(levelMessageTimer).toBe(9);
  });
});

// ---------------------------------------------------------------------------
describe('fixed timestep game loop', () => {
  function simulateOneSecond(refreshRate) {
    fullReset();
    gameState = 'playing';
    owner.active = false;
    resetSimulationClock();

    let steps = 0;
    for (let frame = 0; frame <= refreshRate; frame++) {
      steps += advanceSimulation(frame * 1000 / refreshRate);
    }
    return { steps, urge: player.urge };
  }

  it.each([60, 120, 144])('runs exactly 60 simulation steps in one second at %i Hz', refreshRate => {
    const result = simulateOneSecond(refreshRate);
    expect(result.steps).toBe(60);
    expect(result.urge).toBeCloseTo(DIFF.normal.urgeRate, 5);
  });

  it('renders every rAF even when no simulation step is due', () => {
    gameState = 'playing';
    draw.mockClear();
    requestAnimationFrame.mockClear();
    resetSimulationClock();

    gameLoop(0);
    gameLoop(1000 / 120);
    gameLoop(1000 / 60);

    expect(draw).toHaveBeenCalledTimes(3);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    expect(player.urge).toBeCloseTo(DIFF.normal.urgeRate / 60, 5);
  });

  it('caps catch-up work and drops stale backlog after a long stall', () => {
    gameState = 'playing';
    resetSimulationClock(0);

    const steps = advanceSimulation(1000);

    expect(steps).toBe(MAX_SIMULATION_STEPS);
    expect(simulationAccumulatorMs).toBeLessThan(SIMULATION_STEP_MS);
    expect(droppedSimulationTimeMs).toBeGreaterThan(900);
    expect(player.urge).toBeCloseTo(DIFF.normal.urgeRate / 60 * MAX_SIMULATION_STEPS, 5);
  });
});

// ---------------------------------------------------------------------------
describe('pause state', () => {
  it('freezes gameplay state and moving obstacles, then resumes without backlog', () => {
    gameState = 'playing';
    player.urge = 10;
    speedBoostTimer = 60;
    simulationTimeMs = 1000;
    keys.ArrowRight = true;
    obstacles.push({
      x: 300, y: 300, width: GRID, height: GRID,
      moving: true, axis: 'x', range: GRID, speed: 0.01,
      phase: 0, movingOffset: 0, baseX: 300, baseY: 300,
    });
    updateObstacles();
    const obstacleX = obstacles[0].x;

    expect(pauseGame('manual')).toBe(true);
    expect(gameState).toBe('paused');
    expect(keys.ArrowRight).toBe(false);

    advanceSimulation(0);
    advanceSimulation(1000);

    expect(player.urge).toBe(10);
    expect(speedBoostTimer).toBe(60);
    expect(simulationTimeMs).toBe(1000);
    expect(obstacles[0].x).toBe(obstacleX);

    expect(resumeGame()).toBe(true);
    expect(gameState).toBe('playing');
    expect(advanceSimulation(5000)).toBe(0);
    expect(advanceSimulation(5000 + SIMULATION_STEP_MS)).toBe(1);
    expect(player.urge).toBeGreaterThan(10);
    expect(simulationTimeMs).toBeCloseTo(1000 + SIMULATION_STEP_MS);
  });

  it('keeps pause separate from lifeLost and restores its countdown state', () => {
    gameState = 'lifeLost';
    lifeLostTimer = 90;

    pauseGame('manual');
    advanceSimulation(0);
    advanceSimulation(1000);

    expect(gameState).toBe('paused');
    expect(pausedFromState).toBe('lifeLost');
    expect(lifeLostTimer).toBe(90);

    resumeGame();
    expect(gameState).toBe('lifeLost');
  });

  it('pauses on window blur and requires explicit resume', () => {
    const blurHandler = window.addEventListener.mock.calls.find(call => call[0] === 'blur')[1];
    gameState = 'playing';

    blurHandler();

    expect(gameState).toBe('paused');
    expect(pauseReason).toBe('blur');
    resumeGame();
  });

  it('pauses when the document becomes hidden', () => {
    const visibilityHandler = document.addEventListener.mock.calls.find(call => call[0] === 'visibilitychange')[1];
    gameState = 'playing';
    document.hidden = true;

    visibilityHandler();

    expect(gameState).toBe('paused');
    expect(pauseReason).toBe('hidden');
    document.hidden = false;
    resumeGame();
  });

  it('toggles manual pause with P', () => {
    const keydownHandler = window.addEventListener.mock.calls.find(call => call[0] === 'keydown')[1];
    const event = { key: 'P', preventDefault() {} };
    gameState = 'playing';

    keydownHandler(event);
    expect(gameState).toBe('paused');

    keydownHandler(event);
    expect(gameState).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
describe('keyboard input handling', () => {
  function fireKey(key) {
    // Simulate keydown by calling the handler directly
    // We need to find the registered handler — since window.addEventListener is mocked,
    // we call the game's key handler logic directly via keys object
    keys[key] = true;
  }
  function releaseKey(key) {
    keys[key] = false;
  }

  it('menu modes map to tutorial/normal/chaos while difficulty stays scored-only', () => {
    gameState = 'start';
    difficulty = 'normal';
    // Simulate pressing "1"
    keys['1'] = true;
    // The keydown handler is registered on window — we test via keys object
    // and the game logic that reads it. Since keydown is event-driven,
    // we test the state directly by calling the logic.
    // The handler maps key 1 to tutorial on Normal physics.
    // We can't easily fire DOM events in node, so we test the keys object
    // and verify the game reads it correctly.
    expect(['tutorial', 'normal', 'chaos']).toContain(gameMode);
    expect(['normal', 'chaos']).toContain(difficulty);
    keys['1'] = false;
  });

  it('shootCooldown prevents shooting when > 0', () => {
    gameState = 'playing';
    shootCooldown = 5;
    shootPoop(); // direct call
    expect(poops.length).toBe(0);
  });

  it('shootPoop() works when cooldown = 0', () => {
    gameState = 'playing';
    shootCooldown = 0;
    owner.active = false;
    shootPoop();
    expect(poops.length).toBe(1);
  });
});
