// ==========================================
// GLOBAL MOCKS — canvas, audio, DOM, localStorage
// ==========================================
// Runs before every test file via vitest setupFiles.
// Installs all browser globals the game modules expect,
// then provides loadGame() to eval all JS files in order.

import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ===== localStorage mock =====
const _storage = new Map();
global.localStorage = {
  getItem:    (k) => _storage.has(k) ? _storage.get(k) : null,
  setItem:    (k, v) => _storage.set(k, String(v)),
  removeItem: (k) => _storage.delete(k),
  clear:      () => _storage.clear(),
};

// ===== ctx mock =====
const ctxMock = {
  fillStyle: '',
  strokeStyle: '',
  globalAlpha: 1,
  font: '',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  shadowColor: '',
  shadowBlur: 0,
  lineWidth: 1,
  save:                    vi.fn(),
  restore:                 vi.fn(),
  beginPath:               vi.fn(),
  arc:                     vi.fn(),
  fill:                    vi.fn(),
  stroke:                  vi.fn(),
  fillRect:                vi.fn(),
  strokeRect:              vi.fn(),
  clearRect:               vi.fn(),
  fillText:                vi.fn(),
  strokeText:              vi.fn(),
  drawImage:               vi.fn(),
  translate:               vi.fn(),
  rotate:                  vi.fn(),
  scale:                   vi.fn(),
  roundRect:               vi.fn(),
  moveTo:                  vi.fn(),
  lineTo:                  vi.fn(),
  closePath:               vi.fn(),
  clip:                    vi.fn(),
  rect:                    vi.fn(),
  setLineDash:             vi.fn(),
  measureText:             vi.fn(() => ({ width: 100 })),
  createLinearGradient:    vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient:    vi.fn(() => ({ addColorStop: vi.fn() })),
};

// ===== canvas mock =====
const canvasMock = {
  width: 1200,
  height: 700,
  getContext: vi.fn(() => ctxMock),
  addEventListener: vi.fn(),
};

// ===== document mock =====
global.document = {
  getElementById: vi.fn((id) => id === 'gameCanvas' ? canvasMock : null),
  addEventListener: vi.fn(),
  createElement: vi.fn(() => canvasMock),
};

// ===== window / navigator =====
global.window = {
  addEventListener: vi.fn(),
  ontouchstart: undefined,
  AudioContext: global.AudioContext,
  webkitAudioContext: global.AudioContext,
};
// navigator is a read-only getter in Node — use defineProperty
Object.defineProperty(global, 'navigator', {
  value: { maxTouchPoints: 0 },
  writable: true,
  configurable: true,
});

// ===== Image mock =====
global.Image = class {
  constructor() { this.complete = true; this.naturalWidth = 1; this.src = ''; }
};

// ===== requestAnimationFrame =====
global.requestAnimationFrame = vi.fn();
global.cancelAnimationFrame  = vi.fn();

// ===== performance =====
global.performance = { now: vi.fn(() => 0) };

// ===== Web Audio API mocks =====
const makeOscillator = () => ({
  type: 'sine',
  frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
  disconnect: vi.fn(),
});
const makeGain = () => ({
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    value: 1,
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
});

class MockAudioContext {
  constructor() {
    this.destination = {};
    this.currentTime = 0;
    this.state = 'running';
  }
  createOscillator() { return makeOscillator(); }
  createGain()       { return makeGain(); }
  resume()           { return Promise.resolve(); }
}

global.AudioContext = MockAudioContext;

// ===== loadGame() helper =====
// Evaluates each game file in order using vm.runInThisContext so that
// all `const`/`let`/`function` declarations land on globalThis.
// Call this at the top of each test file (or beforeEach if you need isolation).

// ===== resetGameState() — единый сброс игрового состояния для тестов =====
// Используйте вместо локальных reset-функций в каждом тестовом файле.
// Сбрасывает все глобальные переменные к начальным значениям.
export function resetGameState() {
  // Числовые переменные состояния
  score = 0;
  level = 1;
  lives = 3;
  difficulty = 'normal';
  gameState = 'start';
  overlayTimer = 0;
  lifeLostTimer = 0;
  lifeLostReason = '';

  // Игрок
  player.x = 100;
  player.y = 300;
  player.urge = 0;
  player.speed = 3.9;
  player.pooping = false;
  player.poopTimer = 0;

  // Хозяин
  owner.x = 800;
  owner.y = 300;
  owner.active = false;
  owner.speed = 1.0;
  owner.fleeTimer = 0;
  owner.fleeTarget = null;
  owner.catnipTarget = null;
  owner.poopHits = 0;
  owner.facePoops = [];
  owner.stuckTimer = 0;
  owner.lastCheckTimer = 0;
  owner.lastX = 800;
  owner.lastY = 300;
  owner.driftAngle = 0;
  owner.driftTimer = 0;
  owner.hesitateTimer = 0;
  owner.shotReactTimer = 0;
  owner.path = [];
  owner.pathSegments = [];
  owner.segmentIndex = 0;
  owner.pathTimer = 0;

  // Массивы
  poops.length = 0;
  overlayParticles.length = 0;
  comboPopups.length = 0;
  pawTrails.length = 0;
  bonuses.length = 0;
  obstacles.length = 0;

  // Таймеры и счётчики
  comboCount = 0;
  comboTimer = 0;
  speedBoostTimer = 0;
  yarnFreezeTimer = 0;
  catnipTimer = 0;
  shootCooldown = 0;
  panicShake = 0;
  alarmTimer = 0;
  puddleAlpha = 0;
  poopProgress = 0;
  isPooping = false;
  _pawSpawnCounter = 0;

  // Лоток — безопасная позиция далеко от игрока
  litterBox.x = 900;
  litterBox.y = 400;
  litterBox.width = 80;
  litterBox.height = 80;

  // RNG seed
  globalSeed = 0;
}

// ===== hitOwner() — вспомогательная функция для тестов комбо/попаданий =====
// Помещает какашку прямо в центр хозяина и вызывает updatePoops().
export function hitOwner() {
  poops.push({
    x: owner.x + owner.width / 2,
    y: owner.y + owner.height / 2,
    dx: 0, dy: 0, r: 10, alive: true, trail: [],
  });
  updatePoops();
}

export function loadGame() {
  // Reset mutable state
  _storage.clear();

  // Ensure canvas/ctx are on globalThis before config.js runs
  globalThis.canvas = canvasMock;
  globalThis.ctx    = ctxMock;

  // Mock draw() — defined in renderer.js which we don't load in tests
  globalThis.draw = vi.fn();

  // Patch window to expose AudioContext for audio.js (getAC uses window.AudioContext)
  globalThis.window.AudioContext = MockAudioContext;
  globalThis.window.webkitAudioContext = MockAudioContext;

  const files = [
    'js/config.js',
    'js/utils.js',
    'js/melody-data.js',
    'js/audio.js',
    'js/particles.js',
    'js/bonuses.js',
    'js/pathfinding.js',
    'js/level.js',
    'js/player.js',
    'js/owner.js',
    'js/projectiles.js',
    'js/game.js',
  ];

  for (const f of files) {
    let code = readFileSync(join(ROOT, f), 'utf8');

    // Patch game.js: remove the auto-start gameLoop() call at the bottom
    // so tests don't trigger requestAnimationFrame loops
    if (f === 'js/game.js') {
      code = code.replace(/^\s*generateLevel\(\);\s*$/m, '// generateLevel(); // patched by test setup');
      code = code.replace(/^\s*gameLoop\(\);\s*$/m,      '// gameLoop(); // patched by test setup');
    }

    vm.runInThisContext(code, { filename: f });
  }
}

export { ctxMock, canvasMock };
