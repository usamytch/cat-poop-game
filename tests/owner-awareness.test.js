// ==========================================
// owner-awareness.test.js — readable sight/hearing state machine
// ==========================================
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadGame, resetGameState } from './setup.js';

beforeAll(() => {
  loadGame();
});

beforeEach(() => {
  resetGameState();
  gameState = 'playing';
  difficulty = 'normal';
  level = 2;
  basementMode = '';
  player.x = 100;
  player.y = 300;
  owner.x = 800;
  owner.y = 300;
  owner.active = true;
  owner.speed = 2;
  owner.currentNode = pixelToCell(owner.x + owner.width / 2, owner.y + owner.height / 2);
  owner.facingX = 1;
  owner.facingY = 0;
});

function blockSight() {
  obstacles.push({ id: 'wardrobe', x: 430, y: 250, width: 80, height: 140 });
}

describe('owner line of sight', () => {
  it('sees the player across a clear room', () => {
    expect(owner._canSeePlayer()).toBe(true);
  });

  it('does not see through furniture', () => {
    blockSight();
    expect(owner._canSeePlayer()).toBe(false);
  });

  it('in the basement only sees beyond close range inside the flashlight cone', () => {
    basementMode = 'corridor';
    owner.x = 400;
    owner.y = 300;
    owner.facingX = 1;
    owner.facingY = 0;

    player.x = 650;
    expect(owner._canSeePlayer()).toBe(true);

    player.x = 100;
    expect(owner._canSeePlayer()).toBe(false);
  });
});

describe('awareness transitions', () => {
  it('guard → chase on clear visual contact', () => {
    owner.awarenessState = 'guard';
    owner._updateAwareness();
    expect(owner.awarenessState).toBe('chase');
    expect(owner.lastKnownTarget).not.toBeNull();
  });

  it('a shot behind furniture produces heard with the shot origin as target', () => {
    blockSight();
    const shotX = player.x + player.size / 2;
    const shotY = player.y + player.size / 2;
    owner.onShotFired(shotX, shotY);
    expect(owner.awarenessState).toBe('heard');
    expect(owner.heardTarget.x).toBeCloseTo(shotX - owner.width / 2);
    expect(owner.heardTimer).toBe(DIFF.normal.heardDuration);
  });

  it('heard → chase when the owner reaches a clear view', () => {
    blockSight();
    owner.onShotFired(player.x, player.y);
    expect(owner.awarenessState).toBe('heard');
    obstacles.length = 0;
    owner._updateAwareness();
    expect(owner.awarenessState).toBe('chase');
  });

  it('chase → search after memory expires behind furniture', () => {
    owner._rememberPlayer();
    owner.awarenessState = 'chase';
    owner.memoryTimer = 1;
    blockSight();
    owner._updateAwareness();
    expect(owner.awarenessState).toBe('search');
    expect(owner.searchTimer).toBe(DIFF.normal.searchDuration);
  });

  it('search → guard only after scanning the last known point', () => {
    blockSight();
    owner.awarenessState = 'search';
    owner.lastKnownTarget = { x: owner.x, y: owner.y };
    owner.searchTimer = 1;
    owner._updateAwareness();
    expect(owner.awarenessState).toBe('guard');
  });

  it('Chaos remembers and searches longer than Normal', () => {
    expect(DIFF.chaos.chaseMemory).toBeGreaterThan(DIFF.normal.chaseMemory);
    expect(DIFF.chaos.searchDuration).toBeGreaterThan(DIFF.normal.searchDuration);
  });
});

describe('initial Chaos awareness', () => {
  it('starts chasing immediately when the spawn has clear line of sight', () => {
    difficulty = 'chaos';
    level = 1;
    obstacles.length = 0;

    owner.activate();

    expect(owner.active).toBe(true);
    expect(owner.awarenessState).toBe('chase');
    expect(owner.lastKnownTarget).not.toBeNull();
  });

  it('investigates the cat spawn when furniture blocks initial sight', () => {
    difficulty = 'chaos';
    level = 1;
    obstacles.push({ id:'wall', x:430, y:10, width:80, height:600 });

    owner.activate();

    expect(owner.active).toBe(true);
    expect(owner.awarenessState).toBe('heard');
    expect(owner.heardTarget.x).toBeCloseTo(player.x);
    expect(owner.heardTarget.y).toBeCloseTo(player.y);
    expect(owner.heardTimer).toBe(DIFF.chaos.heardDuration);
  });

  it('keeps the existing quiet guard start in Normal behind furniture', () => {
    difficulty = 'normal';
    level = 2;
    obstacles.push({ id:'wall', x:430, y:10, width:80, height:600 });

    owner.activate();

    expect(owner.awarenessState).toBe('guard');
    expect(owner.heardTarget).toBeNull();
  });
});

describe('combo flee window', () => {
  it('is longer when the litter is farther away', () => {
    player.x = 850;
    player.y = 400;
    litterBox.x = 900;
    litterBox.y = 400;
    owner.flee();
    const nearDuration = owner.fleeTimer;

    player.x = 30;
    player.y = 40;
    litterBox.x = 1080;
    litterBox.y = 520;
    owner.flee();
    expect(owner.fleeTimer).toBeGreaterThan(nearDuration);
  });

  it('keeps a fixed five-second safety window in tutorial', () => {
    tutorialState.active = true;
    owner.flee();
    expect(owner.fleeTimer).toBe(300);
  });
});
