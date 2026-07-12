// ==========================================
// LOCATION RULES — one authored rule per room
// ==========================================
// Mechanics live here; rendering stays in renderer-bg / renderer-hud.
// Hot-path rules reuse one result object and scan at most 8 decor items.

const locationRuleState = {
  key: "none",
  actStep: 1,
  hallCharge: 0,
  hallDirX: 0,
  hallDirY: 0,
  bathroomVX: 0,
  bathroomVY: 0,
  streetStillTicks: 0,
  streetHidden: false,
  streetRustleCooldown: 0,
  kitchenBlockedPulse: 0,
  countryPhase: 0,
  countryPhaseTicks: 0,
  countryTransitionFlash: 0,
  countryPendingCount: 0,
  countryConservativePathSteps: 0,
};

const locationRulePerf = {
  phaseSwitches: 0,
  occupancyRebuilds: 0,
  backgroundRebuilds: 0,
  totalSwitchMs: 0,
  maxSwitchMs: 0,
};

const _locationMovementResult = { stepX: 0, stepY: 0, onRug: false, onWet: false };

function _resetLocationRulePerf() {
  locationRulePerf.phaseSwitches = 0;
  locationRulePerf.occupancyRebuilds = 0;
  locationRulePerf.backgroundRebuilds = 0;
  locationRulePerf.totalSwitchMs = 0;
  locationRulePerf.maxSwitchMs = 0;
}

function getLocationRulePerformanceReport() {
  const switches = locationRulePerf.phaseSwitches;
  return {
    key: locationRuleState.key,
    phaseSwitches: switches,
    occupancyRebuilds: locationRulePerf.occupancyRebuilds,
    backgroundRebuilds: locationRulePerf.backgroundRebuilds,
    meanSwitchMs: switches > 0 ? locationRulePerf.totalSwitchMs / switches : 0,
    maxSwitchMs: locationRulePerf.maxSwitchMs,
    markedObstacles: obstacles.reduce((count, ob) => count + (ob.surrealRule ? 1 : 0), 0),
  };
}

function resetLocationRuleState(key = "none") {
  locationRuleState.key = key;
  locationRuleState.actStep = 1;
  locationRuleState.hallCharge = 0;
  locationRuleState.hallDirX = 0;
  locationRuleState.hallDirY = 0;
  locationRuleState.bathroomVX = 0;
  locationRuleState.bathroomVY = 0;
  locationRuleState.streetStillTicks = 0;
  locationRuleState.streetHidden = false;
  locationRuleState.streetRustleCooldown = 0;
  locationRuleState.kitchenBlockedPulse = 0;
  locationRuleState.countryPhase = 0;
  locationRuleState.countryPhaseTicks = 0;
  locationRuleState.countryTransitionFlash = 0;
  locationRuleState.countryPendingCount = 0;
  locationRuleState.countryConservativePathSteps = 0;
  for (const d of decorItems) {
    delete d.ruleKind;
    delete d.ruleConsumed;
    delete d.ruleId;
  }
  for (const ob of obstacles) {
    delete ob.surrealRule;
    delete ob.surrealGroup;
    delete ob.ruleSolid;
    delete ob.rulePendingSolid;
  }
  _resetLocationRulePerf();
}

function _markDecorRule(count, kind, drawStyle) {
  const limit = Math.min(count, decorItems.length);
  for (let i = 0; i < limit; i++) {
    const d = decorItems[i];
    d.ruleKind = kind;
    d.ruleId = i;
    d.ruleConsumed = false;
    if (drawStyle) d.drawStyle = drawStyle;
  }
  return limit;
}

function _entityOverlapsObstacle(entity, ob) {
  if (!entity) return false;
  const w = entity.width || entity.size;
  const h = entity.height || entity.size;
  return entity.x < ob.x + ob.width && entity.x + w > ob.x &&
         entity.y < ob.y + ob.height && entity.y + h > ob.y;
}

function _rebuildCountryOccupancy() {
  occupiedCells.clear();
  for (const ob of obstacles) {
    if (ob.surrealRule && !ob.ruleSolid) continue;
    markCells(ob.col, ob.row, ob.wCells, ob.hCells);
  }
  locationRulePerf.occupancyRebuilds++;
}

function _notifyCountryGeometryChanged() {
  if (typeof owner !== "undefined" && owner.active && typeof owner.onWorldGeometryChanged === "function") {
    owner.onWorldGeometryChanged();
  }
  if (typeof rebuildBgLayer === "function") {
    rebuildBgLayer();
    locationRulePerf.backgroundRebuilds++;
  }
}

function initLocationRule(progression) {
  resetLocationRuleState(currentLocation.key);
  locationRuleState.actStep = progression.actStep;

  if (isTutorialActive()) {
    locationRuleState.key = "tutorial";
    return;
  }

  const step = progression.actStep;
  if (currentLocation.key === "hall") {
    _markDecorRule(Math.min(3, 1 + Math.floor(step / 2)), "hallRug", "rug");
  } else if (currentLocation.key === "bathroom") {
    const wetCount = Math.min(3, 1 + Math.floor(step / 2));
    _markDecorRule(wetCount, "bathroomWet", "tiles_decor");
    if (decorItems.length > wetCount) {
      const dry = decorItems[wetCount];
      dry.ruleKind = "bathroomDry";
      dry.ruleId = wetCount;
      dry.ruleConsumed = false;
      dry.drawStyle = "bathmat";
    }
  } else if (currentLocation.key === "kitchen") {
    _markDecorRule(Math.min(3, 1 + Math.floor(step / 2)), "kitchenFood");
  } else if (currentLocation.key === "street") {
    _markDecorRule(Math.min(4, 2 + Math.floor(step / 2)), "streetGrass", "patch");
  } else if (currentLocation.key === "country") {
    const maxMarked = Math.min(LOCATION_RULES.country.maxSurrealObstacles, 2 + step);
    let marked = 0;
    for (const ob of obstacles) {
      if (ob.moving || marked >= maxMarked) continue;
      ob.surrealRule = true;
      ob.surrealGroup = marked % 2;
      ob.ruleSolid = ob.surrealGroup === locationRuleState.countryPhase;
      ob.rulePendingSolid = false;
      marked++;
    }
    locationRuleState.countryPhaseTicks = LOCATION_RULES.country.phaseTicksByStep[step - 1];
    _rebuildCountryOccupancy();
  }
}

function _pointInsideRuleDecor(x, y, kind) {
  for (const d of decorItems) {
    if (d.ruleKind !== kind) continue;
    if (x >= d.x && x <= d.x + d.width && y >= d.y && y <= d.y + d.height) return d;
  }
  return null;
}

function _entityCenterInRuleDecor(entity, kind) {
  const sizeW = entity.width || entity.size;
  const sizeH = entity.height || entity.size;
  return _pointInsideRuleDecor(entity.x + sizeW / 2, entity.y + sizeH / 2, kind);
}

function applyLocationPlayerMovementRule(entity, dx, dy, speed) {
  const result = _locationMovementResult;
  result.stepX = dx * speed;
  result.stepY = dy * speed;
  result.onRug = false;
  result.onWet = false;

  if (locationRuleState.key === "hall") {
    const rug = _entityCenterInRuleDecor(entity, "hallRug");
    const moving = dx !== 0 || dy !== 0;
    if (rug && moving) {
      const dot = dx * locationRuleState.hallDirX + dy * locationRuleState.hallDirY;
      if (dot > 0.92 || (locationRuleState.hallDirX === 0 && locationRuleState.hallDirY === 0)) {
        locationRuleState.hallCharge = clamp(
          locationRuleState.hallCharge + 1 / LOCATION_RULES.hall.chargeTicks,
          0, 1
        );
      } else {
        locationRuleState.hallCharge *= 0.35;
      }
      locationRuleState.hallDirX = dx;
      locationRuleState.hallDirY = dy;
      const scale = 1 + (LOCATION_RULES.hall.maxSpeedScale - 1) * locationRuleState.hallCharge;
      result.stepX *= scale;
      result.stepY *= scale;
      result.onRug = true;
    } else {
      locationRuleState.hallCharge = Math.max(0, locationRuleState.hallCharge - 0.08);
      if (!moving) {
        locationRuleState.hallDirX = 0;
        locationRuleState.hallDirY = 0;
      }
    }
  } else if (locationRuleState.key === "bathroom") {
    const onDry = _entityCenterInRuleDecor(entity, "bathroomDry");
    const onWet = !onDry && _entityCenterInRuleDecor(entity, "bathroomWet");
    if (onWet) {
      const rule = LOCATION_RULES.bathroom;
      locationRuleState.bathroomVX = locationRuleState.bathroomVX * rule.wetFriction + dx * speed * rule.wetControl;
      locationRuleState.bathroomVY = locationRuleState.bathroomVY * rule.wetFriction + dy * speed * rule.wetControl;
      const max = speed * rule.wetMaxSpeedScale;
      const mag = Math.hypot(locationRuleState.bathroomVX, locationRuleState.bathroomVY);
      if (mag > max && mag > 0) {
        locationRuleState.bathroomVX = locationRuleState.bathroomVX / mag * max;
        locationRuleState.bathroomVY = locationRuleState.bathroomVY / mag * max;
      }
      result.stepX = locationRuleState.bathroomVX;
      result.stepY = locationRuleState.bathroomVY;
      result.onWet = true;
    } else {
      locationRuleState.bathroomVX = 0;
      locationRuleState.bathroomVY = 0;
    }
  }

  return result;
}

function onLocationRuleCollision(axis) {
  if (locationRuleState.key !== "bathroom") return;
  if (axis === "x") locationRuleState.bathroomVX = 0;
  else locationRuleState.bathroomVY = 0;
}

function updateLocationPlayerPresence(entity, moving) {
  if (locationRuleState.streetRustleCooldown > 0) locationRuleState.streetRustleCooldown--;
  if (locationRuleState.key !== "street") return;

  const grass = _entityCenterInRuleDecor(entity, "streetGrass");
  if (!grass) {
    locationRuleState.streetStillTicks = 0;
    locationRuleState.streetHidden = false;
    return;
  }

  if (!moving) {
    locationRuleState.streetStillTicks++;
    locationRuleState.streetHidden =
      locationRuleState.streetStillTicks >= LOCATION_RULES.street.hideTicks;
  } else {
    locationRuleState.streetStillTicks = 0;
    locationRuleState.streetHidden = false;
    if (locationRuleState.streetRustleCooldown <= 0 &&
        typeof owner !== "undefined" && typeof owner.onLocationNoise === "function") {
      owner.onLocationNoise(entity.x + entity.size / 2, entity.y + entity.size / 2, "🌿");
      locationRuleState.streetRustleCooldown = LOCATION_RULES.street.rustleCooldown;
    }
  }
}

function isPlayerHiddenByLocationRule() {
  return locationRuleState.key === "street" && locationRuleState.streetHidden;
}

function _updateKitchenRule() {
  if (!owner.active) return;
  const cx = player.x + player.size / 2;
  const cy = player.y + player.size / 2;
  for (const d of decorItems) {
    if (d.ruleKind !== "kitchenFood" || d.ruleConsumed) continue;
    if (cx < d.x || cx > d.x + d.width || cy < d.y || cy > d.y + d.height) continue;
    if (owner._canSeePlayer()) {
      locationRuleState.kitchenBlockedPulse = 24;
      return;
    }
    d.ruleConsumed = true;
    owner.onFoodSmell(d.x + d.width / 2, d.y + d.height / 2);
    return;
  }
}

function _switchCountryPhase() {
  const started = typeof performance !== "undefined" && performance.now ? performance.now() : 0;
  locationRuleState.countryPhase = 1 - locationRuleState.countryPhase;
  locationRuleState.countryPhaseTicks =
    LOCATION_RULES.country.phaseTicksByStep[locationRuleState.actStep - 1];
  locationRuleState.countryTransitionFlash = LOCATION_RULES.country.transitionTicks;
  locationRuleState.countryPendingCount = 0;

  for (const ob of obstacles) {
    if (!ob.surrealRule) continue;
    const shouldBeSolid = ob.surrealGroup === locationRuleState.countryPhase;
    ob.rulePendingSolid = shouldBeSolid &&
      (_entityOverlapsObstacle(player, ob) || (owner.active && _entityOverlapsObstacle(owner, ob)));
    ob.ruleSolid = shouldBeSolid && !ob.rulePendingSolid;
    if (ob.rulePendingSolid) locationRuleState.countryPendingCount++;
  }

  _rebuildCountryOccupancy();
  _notifyCountryGeometryChanged();

  const ended = typeof performance !== "undefined" && performance.now ? performance.now() : started;
  const elapsed = Math.max(0, ended - started);
  locationRulePerf.phaseSwitches++;
  locationRulePerf.totalSwitchMs += elapsed;
  locationRulePerf.maxSwitchMs = Math.max(locationRulePerf.maxSwitchMs, elapsed);
}

function _activatePendingCountryObstacles() {
  if (locationRuleState.countryPendingCount <= 0) return;
  let changed = false;
  let pending = 0;
  for (const ob of obstacles) {
    if (!ob.rulePendingSolid) continue;
    if (_entityOverlapsObstacle(player, ob) || (owner.active && _entityOverlapsObstacle(owner, ob))) {
      pending++;
      continue;
    }
    ob.rulePendingSolid = false;
    ob.ruleSolid = true;
    changed = true;
  }
  locationRuleState.countryPendingCount = pending;
  if (changed) {
    _rebuildCountryOccupancy();
    _notifyCountryGeometryChanged();
  }
}

function updateLocationRule() {
  if (locationRuleState.kitchenBlockedPulse > 0) locationRuleState.kitchenBlockedPulse--;
  if (locationRuleState.countryTransitionFlash > 0) locationRuleState.countryTransitionFlash--;

  if (locationRuleState.key === "kitchen") {
    _updateKitchenRule();
  } else if (locationRuleState.key === "country") {
    _activatePendingCountryObstacles();
    locationRuleState.countryPhaseTicks--;
    if (locationRuleState.countryPhaseTicks <= 0) _switchCountryPhase();
  }
}

function locationRuleCellReserved(col, row) {
  if (locationRuleState.key === "kitchen") {
    for (const d of decorItems) {
      if (d.ruleKind !== "kitchenFood" || d.ruleConsumed) continue;
      if (col >= d.col && col < d.col + d.wCells && row >= d.row && row < d.row + d.hCells) return true;
    }
  } else if (locationRuleState.key === "country") {
    // Бонус не должен оказаться внутри мебели, которая сейчас расплавлена,
    // но станет твёрдой на следующей музыкальной фазе.
    for (const ob of obstacles) {
      if (!ob.surrealRule) continue;
      if (col >= ob.col && col < ob.col + ob.wCells && row >= ob.row && row < ob.row + ob.hCells) return true;
    }
  }
  return false;
}

function shouldShowLocationRuleBanner() {
  if (locationRuleState.key === "none" || locationRuleState.key === "tutorial") return false;
  if (levelMessageTimer <= 0) return false;
  return locationRuleState.key === "basement" ||
    locationRuleState.actStep === 1 || locationRuleState.actStep === ACT.length;
}

function getLocationRuleBannerTitle() {
  const rule = currentLocation.rule;
  if (!rule) return "";
  return locationRuleState.actStep === ACT.length ? rule.peakTitle : rule.title;
}
