// ==========================================
// FEEDBACK — urgency direction, hit-stop, local attention signals
// ==========================================

let urgencyFeedbackStage = 0; // 0 calm, 1 pressed, 2 critical, 3 imminent
let feedbackHitStopTicks = 0;
let feedbackImpactTicks = 0;
let feedbackThreatPingTicks = 0;

function _feedbackStageForRatio(ratio, previousStage) {
  // Hysteresis belongs only to presentation. Urge, failure and HUD values stay
  // exact, while audio does not crossfade back and forth after a 1–2% hit.
  if (previousStage >= 3 && ratio > FEEDBACK.panicExit[2]) return 3;
  if (ratio > FEEDBACK.panicEnter[2]) return 3;
  if (previousStage >= 2 && ratio > FEEDBACK.panicExit[1]) return 2;
  if (ratio > FEEDBACK.panicEnter[1]) return 2;
  if (previousStage >= 1 && ratio > FEEDBACK.panicExit[0]) return 1;
  if (ratio > FEEDBACK.panicEnter[0]) return 1;
  return 0;
}

function updateUrgencyFeedback(ratio) {
  const nextStage = _feedbackStageForRatio(ratio, urgencyFeedbackStage);
  if (nextStage === urgencyFeedbackStage) return false;
  urgencyFeedbackStage = nextStage;
  if (typeof setMusicPressureStage === "function") setMusicPressureStage(nextStage);
  return true;
}

function resetFeedbackState() {
  urgencyFeedbackStage = 0;
  feedbackHitStopTicks = 0;
  feedbackImpactTicks = 0;
  feedbackThreatPingTicks = 0;
  if (typeof _musicPressureStage !== "undefined") _musicPressureStage = 0;
}

function triggerComboHitStop() {
  feedbackHitStopTicks = Math.max(feedbackHitStopTicks, FEEDBACK.comboHitStopTicks);
  feedbackImpactTicks = Math.max(feedbackImpactTicks, FEEDBACK.impactTicks);
}

function consumeFeedbackHitStopTick() {
  if (feedbackHitStopTicks <= 0) return false;
  feedbackHitStopTicks--;
  return true;
}

function triggerThreatPing() {
  feedbackThreatPingTicks = FEEDBACK.threatPingTicks;
}

function updateFeedbackTimers() {
  if (feedbackImpactTicks > 0) feedbackImpactTicks--;
  if (feedbackThreatPingTicks > 0) feedbackThreatPingTicks--;
}

function getFeedbackImpactRatio() {
  if (feedbackHitStopTicks > 0) return 1;
  return clamp(feedbackImpactTicks / FEEDBACK.impactTicks, 0, 1);
}

function getThreatPingRatio() {
  return clamp(feedbackThreatPingTicks / FEEDBACK.threatPingTicks, 0, 1);
}
