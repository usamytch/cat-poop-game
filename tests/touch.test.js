// ==========================================
// TOUCH — тесты мобильного управления
// Проверяет:
//   1. canvas доступен когда touch.js загружается (регрессия: canvas был в game.js)
//   2. Карточки сложности тапаются без запуска игры (регрессия: BTN_ACTION перекрывал "Хаос")
//   3. BTN_ACTION запускает игру / возвращает в меню
//   4. Джойстик обновляет keys{}
//   5. Кнопка выстрела вызывает shootPoop()
// ==========================================

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { loadGame, resetGameState, canvasMock } from './setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ===== Загружаем игру один раз для всего файла =====
beforeAll(() => {
  loadGame();
});

// ===== Вспомогательная функция: установить vm-local переменные игры =====
// game.js использует `let gameState`, `let difficulty` и т.д. через vm.runInThisContext.
// В Node.js vm `let`/`const` на верхнем уровне НЕ попадают в globalThis —
// они script-local. Чтобы изменить их из теста, запускаем присваивание в том же vm-контексте.
function setGameVar(name, value) {
  // Сериализуем значение в JS-литерал
  const literal = JSON.stringify(value);
  vm.runInThisContext(`${name} = ${literal};`);
}

// ===== Вспомогательная функция: загрузить touch.js с IS_MOBILE=true =====
// Должна вызываться ПОСЛЕ loadGame() (чтобы canvas был определён).
// Патчит `if (IS_MOBILE)` → `if (true)` и перехватывает canvas.addEventListener.
// Возвращает Map зарегистрированных обработчиков { eventName -> handler }.
function loadTouchJS() {
  const handlers = {};
  canvasMock.addEventListener = vi.fn((event, handler) => {
    handlers[event] = handler;
  });

  // Патчим touch.js: заменяем `if (IS_MOBILE) {` на `if (true) {`
  // чтобы гарантированно войти в мобильную ветку
  let code = readFileSync(join(ROOT, 'js/touch.js'), 'utf8');
  code = code.replace(/^if \(IS_MOBILE\) \{/m, 'if (true) {');
  vm.runInThisContext(code, { filename: 'js/touch.js' });

  return handlers;
}

// ===== Вспомогательная функция: читать vm-local переменную =====
function getGameVar(name) {
  return vm.runInThisContext(name);
}

// ===== Вспомогательная функция: создать фейковый touch-объект =====
// canvasX/canvasY — координаты в пространстве canvas (1200×700)
// canvasCoords() в touch.js: x = (clientX - rect.left) * scaleX
// При rect={left:0,top:0,width:1200,height:700} и canvas 1200×700 → scaleX=1
function makeTouch(canvasX, canvasY, id = 0) {
  canvasMock.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, width: 1200, height: 700,
  }));
  return { clientX: canvasX, clientY: canvasY, identifier: id };
}

// ===== Вспомогательная функция: симулировать touchstart =====
function touchStart(handler, touches) {
  const event = { preventDefault: vi.fn(), changedTouches: touches };
  handler(event);
  return event;
}

// ===== ТЕСТЫ =====

describe('touch.js — регрессия: canvas доступен при загрузке', () => {
  it('canvas определён до загрузки touch.js (config.js загружается первым)', () => {
    // Ключевая регрессия: canvas должен быть в globalThis ДО touch.js.
    // В реальном браузере canvas объявлен в config.js (до touch.js).
    // В тестах loadGame() устанавливает globalThis.canvas = canvasMock.
    expect(globalThis.canvas).toBeDefined();
    expect(globalThis.canvas).not.toBeNull();
  });

  it('touch.js загружается без ошибок когда canvas определён', () => {
    // Если canvas не определён — canvas.addEventListener бросит ReferenceError
    expect(() => loadTouchJS()).not.toThrow();
  });

  it('canvas.addEventListener вызывается при IS_MOBILE=true', () => {
    loadTouchJS();
    expect(canvasMock.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.any(Object));
    expect(canvasMock.addEventListener).toHaveBeenCalledWith('touchmove',  expect.any(Function), expect.any(Object));
    expect(canvasMock.addEventListener).toHaveBeenCalledWith('touchend',   expect.any(Function), expect.any(Object));
    expect(canvasMock.addEventListener).toHaveBeenCalledWith('touchcancel',expect.any(Function), expect.any(Object));
  });

  it('drawTouchControls экспортируется в window при IS_MOBILE=true', () => {
    loadTouchJS();
    expect(typeof globalThis.drawTouchControls).toBe('function');
  });
});

describe('touch.js — карточки сложности на стартовом экране', () => {
  let handlers;
  let startGameCalled;

  beforeEach(() => {
    resetGameState();
    setGameVar('gameState', 'start');
    setGameVar('difficulty', 'normal');
    setGameVar('gameMode', 'normal');
    // Мокаем startGame через vm-контекст
    startGameCalled = false;
    vm.runInThisContext('startGame = function() { startGameCalled_touch = true; }');
    globalThis.startGameCalled_touch = false;
    handlers = loadTouchJS();
  });

  it('тап по карточке "Обучение" выбирает tutorial на Normal-физике', () => {
    touchStart(handlers['touchstart'], [makeTouch(280, 291)]);
    expect(getGameVar('gameMode')).toBe('tutorial');
    expect(getGameVar('difficulty')).toBe('normal');
    expect(globalThis.startGameCalled_touch).toBe(false);
  });

  it('тап по карточке "Нормал" (normal, i=1) меняет difficulty на normal', () => {
    setGameVar('gameMode', 'tutorial');
    // normal: bx=455, by=250, bw=290, bh=82 → центр (600, 291)
    touchStart(handlers['touchstart'], [makeTouch(600, 291)]);
    expect(getGameVar('difficulty')).toBe('normal');
    expect(getGameVar('gameMode')).toBe('normal');
    expect(globalThis.startGameCalled_touch).toBe(false);
  });

  it('тап по карточке "Хаос" (chaos, i=2) меняет difficulty на chaos — регрессия BTN_ACTION overlap', () => {
    // chaos: bx=775, by=250, bw=290, bh=82 → центр (920, 291)
    touchStart(handlers['touchstart'], [makeTouch(920, 291)]);
    expect(getGameVar('difficulty')).toBe('chaos');
    expect(getGameVar('gameMode')).toBe('chaos');
    expect(globalThis.startGameCalled_touch).toBe(false);
  });

  it('тап по нижнему краю карточки "Хаос" не запускает игру', () => {
    touchStart(handlers['touchstart'], [makeTouch(920, 331)]);
    expect(getGameVar('difficulty')).toBe('chaos');
    expect(globalThis.startGameCalled_touch).toBe(false);
  });

  it('тап вне карточек не меняет difficulty', () => {
    setGameVar('difficulty', 'normal');
    setGameVar('gameMode', 'normal');
    // y=280 — выше всех карточек
    touchStart(handlers['touchstart'], [makeTouch(600, 280)]);
    expect(getGameVar('difficulty')).toBe('normal');
    expect(getGameVar('gameMode')).toBe('normal');
  });

  it('закрытый Endless нельзя выбрать тапом', () => {
    setGameVar('gameMode', 'normal');
    setGameVar('runMode', 'campaign');
    runProfile.unlocks.endless = false;
    touchStart(handlers['touchstart'], [makeTouch(760, 438)]);
    expect(getGameVar('runMode')).toBe('campaign');
  });

  it('открытый Endless выбирается отдельной карточкой', () => {
    setGameVar('gameMode', 'normal');
    setGameVar('runMode', 'campaign');
    runProfile.unlocks.endless = true;
    touchStart(handlers['touchstart'], [makeTouch(760, 438)]);
    expect(getGameVar('runMode')).toBe('endless');
  });
});

describe('touch.js — кнопка BTN_ACTION (ИГРАТЬ / В меню)', () => {
  let handlers;

  beforeEach(() => {
    resetGameState();
    // Мокаем startGame и respawnPlayer через vm-контекст
    vm.runInThisContext('startGame = function() { startGameCalled_btn = true; }');
    vm.runInThisContext('respawnPlayer = function() { respawnCalled_btn = true; }');
    vm.runInThisContext('resumeGame = function() { resumeCalled_btn = true; }');
    vm.runInThisContext('finishTutorialToMenu = function() { finishTutorialCalled_btn = true; }');
    globalThis.startGameCalled_btn = false;
    globalThis.respawnCalled_btn = false;
    globalThis.resumeCalled_btn = false;
    globalThis.finishTutorialCalled_btn = false;
    handlers = loadTouchJS();
  });

  it('тап по BTN_ACTION в gameState=start вызывает startGame()', () => {
    setGameVar('gameState', 'start');
    // BTN_ACTION: cx=600, cy=560, r=50 → тап прямо в центр
    touchStart(handlers['touchstart'], [makeTouch(600, 560)]);
    expect(globalThis.startGameCalled_btn).toBe(true);
  });

  it('тап по BTN_ACTION в gameState=win переводит в start', () => {
    setGameVar('gameState', 'win');
    touchStart(handlers['touchstart'], [makeTouch(600, 560)]);
    expect(getGameVar('gameState')).toBe('start');
  });

  it('тап по BTN_ACTION в gameState=caught переводит в start', () => {
    setGameVar('gameState', 'caught');
    touchStart(handlers['touchstart'], [makeTouch(600, 560)]);
    expect(getGameVar('gameState')).toBe('start');
  });

  it('тап по BTN_ACTION в gameState=lifeLost вызывает respawnPlayer()', () => {
    setGameVar('gameState', 'lifeLost');
    touchStart(handlers['touchstart'], [makeTouch(600, 560)]);
    expect(globalThis.respawnCalled_btn).toBe(true);
  });

  it('тап по BTN_ACTION в gameState=paused вызывает resumeGame()', () => {
    setGameVar('gameState', 'paused');
    touchStart(handlers['touchstart'], [makeTouch(600, 560)]);
    expect(globalThis.resumeCalled_btn).toBe(true);
  });

  it('тап по BTN_ACTION после обучения подтверждает финал', () => {
    setGameVar('gameState', 'tutorialComplete');
    touchStart(handlers['touchstart'], [makeTouch(600, 445)]);
    expect(globalThis.finishTutorialCalled_btn).toBe(true);
  });

  it('тап далеко от BTN_ACTION (y=400) не запускает игру', () => {
    setGameVar('gameState', 'start');
    touchStart(handlers['touchstart'], [makeTouch(600, 400)]);
    expect(globalThis.startGameCalled_btn).toBe(false);
  });
});

describe('touch.js — джойстик обновляет keys{}', () => {
  let handlers;

  beforeEach(() => {
    resetGameState();
    setGameVar('gameState', 'playing');
    handlers = loadTouchJS();
  });

  it('touchstart на джойстике не бросает ошибку', () => {
    // JOY: cx=130, cy=580, outerR=80 → тап в центр
    expect(() => touchStart(handlers['touchstart'], [makeTouch(130, 580, 1)])).not.toThrow();
    // keys — объект из game.js, доступен через vm
    expect(getGameVar('keys')).toBeDefined();
  });

  it('touchmove вправо устанавливает ArrowRight=true', () => {
    // Активируем джойстик
    touchStart(handlers['touchstart'], [makeTouch(130, 580, 1)]);
    // Двигаем вправо на 30px (> dead zone 12px)
    handlers['touchmove']({ preventDefault: vi.fn(), changedTouches: [makeTouch(160, 580, 1)] });
    const k = getGameVar('keys');
    expect(k['ArrowRight']).toBe(true);
    expect(k['ArrowLeft']).toBe(false);
  });

  it('touchmove влево устанавливает ArrowLeft=true', () => {
    touchStart(handlers['touchstart'], [makeTouch(130, 580, 1)]);
    handlers['touchmove']({ preventDefault: vi.fn(), changedTouches: [makeTouch(100, 580, 1)] });
    const k = getGameVar('keys');
    expect(k['ArrowLeft']).toBe(true);
    expect(k['ArrowRight']).toBe(false);
  });

  it('touchmove вверх устанавливает ArrowUp=true', () => {
    touchStart(handlers['touchstart'], [makeTouch(130, 580, 1)]);
    handlers['touchmove']({ preventDefault: vi.fn(), changedTouches: [makeTouch(130, 550, 1)] });
    const k = getGameVar('keys');
    expect(k['ArrowUp']).toBe(true);
    expect(k['ArrowDown']).toBe(false);
  });

  it('touchend сбрасывает все стрелки в false', () => {
    touchStart(handlers['touchstart'], [makeTouch(130, 580, 1)]);
    handlers['touchmove']({ preventDefault: vi.fn(), changedTouches: [makeTouch(160, 580, 1)] });
    expect(getGameVar('keys')['ArrowRight']).toBe(true);

    handlers['touchend']({ preventDefault: vi.fn(), changedTouches: [makeTouch(160, 580, 1)] });
    const k = getGameVar('keys');
    expect(k['ArrowRight']).toBe(false);
    expect(k['ArrowLeft']).toBe(false);
    expect(k['ArrowUp']).toBe(false);
    expect(k['ArrowDown']).toBe(false);
  });
});

describe('touch.js — кнопка выстрела', () => {
  let handlers;

  beforeEach(() => {
    resetGameState();
    setGameVar('gameState', 'playing');
    // Мокаем shootPoop через vm-контекст
    vm.runInThisContext('shootPoop = function() { shootPoopCalled_touch = true; }');
    globalThis.shootPoopCalled_touch = false;
    handlers = loadTouchJS();
  });

  it('тап по BTN_SHOOT в gameState=playing вызывает shootPoop()', () => {
    // BTN_SHOOT: cx=1100, cy=590, r=60
    touchStart(handlers['touchstart'], [makeTouch(1100, 590)]);
    expect(globalThis.shootPoopCalled_touch).toBe(true);
  });

  it('тап по BTN_SHOOT вне игры не вызывает shootPoop()', () => {
    setGameVar('gameState', 'start');
    touchStart(handlers['touchstart'], [makeTouch(1100, 590)]);
    expect(globalThis.shootPoopCalled_touch).toBe(false);
  });
});

describe('touch.js — кнопка мьюта', () => {
  let handlers;

  beforeEach(() => {
    resetGameState();
    // Мокаем toggleMute через vm-контекст
    vm.runInThisContext('toggleMute = function() { toggleMuteCalled_touch = true; }');
    globalThis.toggleMuteCalled_touch = false;
    handlers = loadTouchJS();
  });

  it('тап по BTN_MUTE вызывает toggleMute()', () => {
    // BTN_MUTE: cx=1155, cy=45, r=38
    touchStart(handlers['touchstart'], [makeTouch(1155, 45)]);
    expect(globalThis.toggleMuteCalled_touch).toBe(true);
  });

  it('тап по BTN_MUTE работает в любом gameState', () => {
    setGameVar('gameState', 'playing');
    touchStart(handlers['touchstart'], [makeTouch(1155, 45)]);
    expect(globalThis.toggleMuteCalled_touch).toBe(true);
  });
});

describe('touch.js — пауза обучения', () => {
  let handlers;

  beforeEach(() => {
    resetGameState();
    vm.runInThisContext('pauseGame = function() { pauseGameCalled_touch = true; }');
    vm.runInThisContext('exitTutorialToMenu = function() { exitTutorialCalled_touch = true; }');
    globalThis.pauseGameCalled_touch = false;
    globalThis.exitTutorialCalled_touch = false;
    handlers = loadTouchJS();
  });

  it('тап по кнопке паузы во время игры вызывает pauseGame()', () => {
    setGameVar('gameState', 'playing');
    touchStart(handlers['touchstart'], [makeTouch(1070, 45)]);
    expect(globalThis.pauseGameCalled_touch).toBe(true);
  });

  it('из паузы обучения можно выйти в меню отдельной кнопкой', () => {
    setGameVar('gameState', 'paused');
    vm.runInThisContext('tutorialState.active = true;');
    touchStart(handlers['touchstart'], [makeTouch(600, 520)]);
    expect(globalThis.exitTutorialCalled_touch).toBe(true);
  });
});
