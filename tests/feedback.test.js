import { describe,it,expect,beforeAll,beforeEach } from 'vitest';
import { loadGame,resetGameState,hitOwner } from './setup.js';

beforeAll(()=>loadGame());
beforeEach(()=>{
  resetGameState();
  gameState='playing';
  difficulty='normal';
  obstacles.length=0;
  owner.active=false;
  litterBox.x=900; litterBox.y=400;
});

describe('urgency feedback direction',()=>{
  it('uses calm, pressure, critical and imminent tiers',()=>{
    updateUrgencyFeedback(0.76); expect(urgencyFeedbackStage).toBe(1);
    updateUrgencyFeedback(0.88); expect(urgencyFeedbackStage).toBe(2);
    updateUrgencyFeedback(0.97); expect(urgencyFeedbackStage).toBe(3);
  });

  it('uses presentation-only hysteresis without changing real urge',()=>{
    player.urge=86;
    updateUrgencyFeedback(0.86);
    expect(urgencyFeedbackStage).toBe(2);
    updateUrgencyFeedback(0.84);
    expect(urgencyFeedbackStage).toBe(2);
    updateUrgencyFeedback(0.82);
    expect(urgencyFeedbackStage).toBe(1);
    expect(player.urge).toBe(86);
  });
});

describe('combo hit-stop and visual sizing',()=>{
  it('third hit freezes exactly three simulation ticks',()=>{
    owner.active=true;
    owner.x=800; owner.y=300;
    hitOwner(); hitOwner(); hitOwner();
    expect(feedbackHitStopTicks).toBe(FEEDBACK.comboHitStopTicks);
    const before=simulationTimeMs;
    update(); update(); update();
    expect(simulationTimeMs).toBe(before);
    update();
    expect(simulationTimeMs).toBe(before+SIMULATION_STEP_MS);
  });

  it('larger collage faces do not change collision geometry',()=>{
    expect(FEEDBACK.playerVisualSize).toBeGreaterThan(player.size);
    expect(FEEDBACK.ownerVisualSize).toBeGreaterThan(owner.width);
    expect(playerRect().width).toBe(36);
    expect(ownerRect().width).toBe(36);
    expect(player.size).toBeLessThan(GRID);
    expect(owner.width).toBeLessThan(GRID);
  });
});
