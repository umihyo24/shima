function update(deltaMs) {
  if (gameState.phase !== CONFIG.phase.playing) return;
  const safeDeltaMs = safeFiniteNumber(deltaMs, 0, 0);
  const dt = safeDeltaMs / 1000;
  gameState.frameTemps.occupied.clear();
  gameState.frameTemps.usableFacilities.length = 0;
  gameState.frameTemps.toRemoveMonsters.length = 0;
  updateCamera(dt);
  updatePlacementFeedback(dt);
  updateCalendar(safeDeltaMs);
  updateSpawner(dt);
  updateDungeons(safeDeltaMs);
  updateMonsters(dt);
  updateSeals(dt);
  updateCombatContacts();
  updateSkirmishes();
  removeDefeatedMonsters();
  updateAutoSave(safeDeltaMs);
  gameState.timers.ui += dt;
  if (gameState.timers.ui >= CONFIG.timing.uiMs / 1000) {
    markUIDirty('tick');
    gameState.timers.ui = 0;
  }
}

function clearMissingSelectedSeal() {
  if (gameState.ui?.selectedSealId && !(gameState.seals ?? []).some(seal => seal?.id === gameState.ui.selectedSealId)) gameState.ui.selectedSealId = null;
  if (gameState.ui?.selectedPersonRosterId?.startsWith?.('seal:') && !getSealById(gameState.ui.selectedPersonRosterId.slice('seal:'.length))) gameState.ui.selectedPersonRosterId = null;
  if (gameState.ui?.selectedPersonRosterId?.startsWith?.('profile:') && !getVisitorProfileById(gameState.ui.selectedPersonRosterId.slice('profile:'.length))) gameState.ui.selectedPersonRosterId = null;
}

function updateCalendar(deltaMs) {
  gameState.calendar.weekTimerMs = safeFiniteNumber(gameState.calendar?.weekTimerMs, 0, 0) + safeFiniteNumber(deltaMs, 0, 0);
  while (gameState.calendar.weekTimerMs >= CONFIG.CALENDAR.WEEK_DURATION_MS) {
    gameState.calendar.weekTimerMs -= CONFIG.CALENDAR.WEEK_DURATION_MS;
    gameState.calendar.week = clampInteger(gameState.calendar?.week, 1, CONFIG.CALENDAR.WEEKS_PER_MONTH, 1) + 1;
    if (gameState.calendar.week > CONFIG.CALENDAR.WEEKS_PER_MONTH) runMonthlyResults();
  }
}

function runMonthlyResults() {
  const previousYear = clampInteger(gameState.calendar?.year, 1, Number.MAX_SAFE_INTEGER, 1);
  const previousMonth = clampInteger(gameState.calendar?.month, 1, CONFIG.CALENDAR.MONTHS_PER_YEAR, 1);
  const hunts = clampInteger(gameState.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0);
  const reward = CONFIG.knownness.monthlyBaseReward + hunts * CONFIG.knownness.huntRewardPerMonthlyHunt;
  gameState.village.knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0) + reward;
  gameState.stats.monthlyKnownnessGained = reward;
  const income = safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0);
  gameState.calendar.week = 1;
  gameState.calendar.month = previousMonth + 1;
  if (gameState.calendar.month > CONFIG.CALENDAR.MONTHS_PER_YEAR) {
    gameState.calendar.month = 1;
    gameState.calendar.year = previousYear + 1;
  }
  unlockKnownVisitors();
  logMessage(`${previousYear}年${previousMonth}月の月末結果: 狩猟${hunts}回 / 知名度+${reward} / 収入${income}G。`);
  gameState.stats.monthlyHunts = 0;
  gameState.stats.monthlyPlayerIncome = 0;
}


function maybeAddMonthlyRelicDrop(hunts) {
  const threshold = clampInteger(CONFIG.EQUIPMENT?.MONTHLY_DROP_HUNT_THRESHOLD, 1, Number.MAX_SAFE_INTEGER, 3);
  if (clampInteger(hunts, 0, Number.MAX_SAFE_INTEGER, 0) < threshold) return;
  const table = CONFIG.EQUIPMENT?.MONTHLY_DROP_TABLE ?? CONFIG.EQUIPMENT?.monthlyDropTable ?? [];
  const index = Math.floor(Math.random() * Math.max(1, table.length));
  const item = getItemDef(table[index]);
  if (!item) return;
  const knownBefore = (gameState.shopCatalog?.unlockedItemIds ?? []).includes(item.id);
  addRelicItem(item.id, 1, '月末調査');
  if (knownBefore) {
    gameState.village.knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0) + CONFIG.knownness.duplicateRelicReward;
    logMessage(`月末の調査で${item.name}を追加発見しました（知名度+${CONFIG.knownness.duplicateRelicReward}）。`);
  } else {
    logMessage(`月末の調査で${item.name}を発見し、店の商品として解放しました。`);
  }
}

function addPlayerIncome(amount) {
  const value = safeFiniteNumber(amount, 0, 0);
  gameState.player.g = safeFiniteNumber(gameState.player?.g, 0, 0) + value;
  gameState.stats.monthlyPlayerIncome = safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0) + value;
}

function updateCamera(dt) {
  const keys = gameState.input.keys;
  const speed = CONFIG.camera.panSpeed * dt / (gameState.camera.zoom || 1);
  if (keys?.KeyA || keys?.ArrowLeft) gameState.camera.x -= speed;
  if (keys?.KeyD || keys?.ArrowRight) gameState.camera.x += speed;
  if (keys?.KeyW || keys?.ArrowUp) gameState.camera.y -= speed;
  if (keys?.KeyS || keys?.ArrowDown) gameState.camera.y += speed;
}

function updatePlacementFeedback(dt) {
  const feedback = gameState.ui.placementFeedback;
  if (!feedback) return;
  feedback.timer -= dt;
  if (feedback.timer <= 0) gameState.ui.placementFeedback = null;
}

function updateSpawner(dt) {
  updateMonsterSpawner(dt);
  updateVisitorSpawner(dt);
}

function updateMonsterSpawner(dt) {
  gameState.timers.monsterSpawn = safeFiniteNumber(gameState.timers?.monsterSpawn, gameState.timers?.spawn ?? 0, 0) + dt;
  gameState.timers.spawn = gameState.timers.monsterSpawn;
  if (gameState.timers.monsterSpawn < CONFIG.monster.spawnInterval) return;
  gameState.timers.monsterSpawn = 0;
  gameState.timers.spawn = 0;
  if ((gameState.monsters ?? []).length >= CONFIG.monster.cap) return;
  const p = randomCoastPoint();
  gameState.monsters.push(normalizeMonster({ id: `crab-${Date.now()}-${Math.random().toString(16).slice(2)}`, type: 'crab', areaId: 'coast', x: p.x, y: p.y, homeX: p.x, homeY: p.y, hp: CONFIG.monster.hp, maxHp: CONFIG.monster.hp, attack: CONFIG.monster.attack, defense: CONFIG.monster.defense, assignedSealId: null, assetKey: 'monsters.crab', facing: 'left', state: CONFIG.monster.states.idle }));
}

function updateVisitorSpawner(dt) {
  updateVisitorUnlocks();
  const activeVisitors = (gameState.seals ?? []).filter(seal => seal?.type === 'visitor').length;
  const safetyMax = clampInteger(CONFIG.visitor?.safetyMaxActive, 1, Number.MAX_SAFE_INTEGER, 30);
  if (activeVisitors >= safetyMax) return;
  const totalFavor = (gameState.visitorProfiles ?? []).reduce((sum, profile) => sum + safeFiniteNumber(profile?.favor, 0, 0), 0);
  const intervalMultiplier = Math.max(CONFIG.visitor.minSpawnIntervalMultiplier, 1 - totalFavor * CONFIG.visitor.spawnIntervalFavorReduction);
  const interval = CONFIG.visitor.spawnInterval * intervalMultiplier;
  gameState.timers.visitorSpawn = safeFiniteNumber(gameState.timers?.visitorSpawn, 0, 0) + dt;
  if (gameState.timers.visitorSpawn < interval) return;
  gameState.timers.visitorSpawn = 0;
  spawnVisitor();
}

function chooseVisitorProfileToSpawn() {
  const candidates = getVisitorSpawnCandidates();
  if (CONFIG.visitor?.debugSpawnCandidates) console.debug(`Visitor candidates: ${candidates.map(profile => profile?.name).filter(Boolean).join(', ') || 'なし'}`);
  if (candidates.length <= 0) return null;
  const maxVisits = candidates.reduce((max, profile) => Math.max(max, clampInteger(profile?.visits, 0, Number.MAX_SAFE_INTEGER, 0)), 0);
  const weighted = candidates.map(profile => {
    const visitGap = Math.max(0, maxVisits - clampInteger(profile?.visits, 0, Number.MAX_SAFE_INTEGER, 0));
    return {
      profile,
      weight: CONFIG.visitor.returnBaseWeight
        + CONFIG.visitor.inactiveWeightBonus
        + safeFiniteNumber(profile?.favor, 0, 0) * CONFIG.visitor.returnFavorWeight
        + visitGap * safeFiniteNumber(CONFIG.visitor?.fewerVisitsWeight, 0, 0)
    };
  });
  const total = weighted.reduce((sum, item) => sum + Math.max(0.01, item.weight), 0);
  let roll = Math.random() * Math.max(total, 0.01);
  for (const item of weighted) {
    roll -= Math.max(0.01, item.weight);
    if (roll <= 0) return item.profile;
  }
  return weighted[0]?.profile ?? null;
}

function spawnVisitorFromProfile(profile) {
  if (!profile || !isVisitorProfileUnlocked(profile) || isVisitorProfileActive(profile.id)) return null;
  const start = getVisitorPreferredSpawnPoint();
  if (!start || !isWaterWorldPoint(start)) {
    logVisitorIssue(null, 'no-sea-spawn', '訪問者の海上出現地点がないため、今回は来訪を見送りました。');
    return null;
  }
  gameState.warnings = gameState.warnings ?? {};
  gameState.warnings.visitorSpawnBlocked = false;
  profile.visits = clampInteger(profile.visits, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  profile.unlocked = true;
  const base = normalizeVisitorBaseStats(profile.baseStats);
  const favorBonus = Math.min(CONFIG.visitor.maxStayFavorBonusMs, safeFiniteNumber(profile.favor, 0, 0) * CONFIG.visitor.maxStayFavorMsPerFavor);
  const visitor = normalizeSeal({
    id: `visitor-${profile.id}-${Date.now()}`,
    profileId: profile.id,
    name: profile.name,
    personality: profile.personality,
    type: 'visitor',
    sizeClass: normalizeSealSizeClass(profile.sizeClass),
    assetKey: assetKeyForVisitorProfile(profile.id),
    facing: 'left',
    x: start.x,
    y: start.y,
    hp: safeFiniteNumber(base.maxHp, CONFIG.seal.maxHp, 1),
    maxHp: safeFiniteNumber(base.maxHp, CONFIG.seal.maxHp, 1) + Math.max(0, clampInteger(profile.level, 1, Number.MAX_SAFE_INTEGER, 1) - 1) * CONFIG.seal.levelHpGain,
    attack: safeFiniteNumber(base.attack, CONFIG.seal.attack, 0) + Math.max(0, clampInteger(profile.level, 1, Number.MAX_SAFE_INTEGER, 1) - 1) * CONFIG.seal.levelAttackGain,
    defense: safeFiniteNumber(base.defense, CONFIG.seal.defense, 0),
    carriedG: Math.floor(randomRange(CONFIG.VISITORS.ARRIVAL.initialCarriedGMin, CONFIG.VISITORS.ARRIVAL.initialCarriedGMax + 1)),
    gearBudget: safeFiniteNumber(profile.gearBudget, 0, 0),
    equipment: normalizeEquipment(profile.equipment),
    exp: profile.exp,
    level: profile.level,
    favor: profile.favor,
    visits: profile.visits,
    state: 'arrivingFromSea',
    minStayMs: CONFIG.visitor.minStayMs,
    maxStayMs: CONFIG.visitor.maxStayMs + favorBonus
  }, gameState.seals.length);
  const hpRatio = randomRange(CONFIG.VISITORS.ARRIVAL.initialHpRatioMin, CONFIG.VISITORS.ARRIVAL.initialHpRatioMax);
  visitor.hp = Math.max(1, Math.min(visitor.maxHp, visitor.maxHp * hpRatio));
  visitor.currentAction = '海から島へ向かっています';
  gameState.seals.push(visitor);
  logMessage(`${visitor.name} が島へ泳いできました。`);
  return visitor;
}

function spawnVisitor() {
  return spawnVisitorFromProfile(chooseVisitorProfileToSpawn());
}

function writeBackVisitorProfile(seal) {
  if (seal?.type !== 'visitor') return;
  const profile = getVisitorProfileById(seal.profileId);
  if (!profile) return;
  profile.level = clampInteger(seal.level, 1, Number.MAX_SAFE_INTEGER, profile.level);
  profile.exp = safeFiniteNumber(seal.exp, profile.exp, 0);
  profile.favor = safeFiniteNumber(seal.favor, profile.favor, 0);
  profile.equipment = normalizeEquipment(seal.equipment);
  profile.gearBudget = safeFiniteNumber(seal.gearBudget, 0, 0);
  profile.dungeonRuns = Math.max(clampInteger(profile.dungeonRuns, 0, Number.MAX_SAFE_INTEGER, 0), clampInteger(seal.dungeonRuns, 0, Number.MAX_SAFE_INTEGER, 0));
  profile.dungeonClears = Math.max(clampInteger(profile.dungeonClears, 0, Number.MAX_SAFE_INTEGER, 0), clampInteger(seal.dungeonClears, 0, Number.MAX_SAFE_INTEGER, 0));
  profile.dungeonBattles = Math.max(clampInteger(profile.dungeonBattles, 0, Number.MAX_SAFE_INTEGER, 0), clampInteger(seal.dungeonBattles, 0, Number.MAX_SAFE_INTEGER, 0));
  profile.chestsOpened = Math.max(clampInteger(profile.chestsOpened, 0, Number.MAX_SAFE_INTEGER, 0), clampInteger(seal.chestsOpened, 0, Number.MAX_SAFE_INTEGER, 0));
  profile.visits = Math.max(clampInteger(profile.visits, 0, Number.MAX_SAFE_INTEGER, 0), clampInteger(seal.visits, 0, Number.MAX_SAFE_INTEGER, 0));
  profile.personality = String(seal.personality || profile.personality || 'balanced');
  profile.baseStats = profile.baseStats ?? { maxHp: seal.maxHp, attack: seal.attack, defense: seal.defense };
}

function getPersonalityConfig(seal) {
  return CONFIG.personalities?.[seal?.personality] ?? CONFIG.personalities?.balanced;
}

function shouldContinueHunting(seal) {
  return !shouldReturnFromHunt(seal);
}

function shouldReturnFromHunt(seal) {
  const personality = getPersonalityConfig(seal);
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? seal.hp / effectiveMaxHp : 0;
  if (hpRatio <= personality.emergencyHpRatio) return true;
  const huntCount = clampInteger(seal?.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0);
  if (huntCount >= personality.maxHuntsPerTrip) return true;
  const favorBonus = Math.min(CONFIG.seal.maxFavorHuntDurationBonus, safeFiniteNumber(seal?.favor, 0, 0) * CONFIG.seal.favorHuntDurationBonus);
  const durationLimit = CONFIG.seal.huntDurationLimit + (seal?.type === 'visitor' ? favorBonus : 0);
  if (safeFiniteNumber(seal?.huntTimer, 0, 0) >= durationLimit) return true;
  if (safeFiniteNumber(seal?.noMonsterTimer, 0, 0) >= CONFIG.seal.noMonsterExploreSeconds) return true;
  if (huntCount < personality.preferredMinHunts && hpRatio > personality.returnHpRatio) return false;
  if (hpRatio <= personality.returnHpRatio && Math.random() < personality.returnChance) return true;
  if (safeFiniteNumber(seal?.carriedG, 0, 0) >= CONFIG.seal.carriedGReturnThreshold && Math.random() < CONFIG.seal.carriedGReturnChance) return true;
  return false;
}

function chooseNextHuntTarget(seal) {
  return claimNearestMonster(seal, seal?.selectedHuntAreaId ?? 'coast');
}



function getDistance(a, b) {
  return distance(safeFiniteNumber(a?.x, 0, 0), safeFiniteNumber(a?.y, 0, 0), safeFiniteNumber(b?.x, 0, 0), safeFiniteNumber(b?.y, 0, 0));
}

function isPointInsideMonsterTerritory(monster, point) {
  if (!monster || !point) return false;
  const area = CONFIG.DUNGEONS?.spawnAreas?.[monster.areaId ?? 'coast']?.bounds ?? CONFIG.DUNGEONS?.spawnAreas?.coast?.bounds;
  if (!area) return false;
  const gx = Math.floor(safeFiniteNumber(point.x, -1, -1) / CONFIG.world.tile);
  const gy = Math.floor(safeFiniteNumber(point.y, -1, -1) / CONFIG.world.tile);
  return inRect(gx, gy, area.x, area.y, area.w, area.h);
}

function isSealEnemyContact(seal, monster) {
  return !!seal && !!monster && getDistance(seal, monster) <= safeFiniteNumber(CONFIG.SKIRMISH?.triggerRadius, CONFIG.monster.territory?.reactionRadius, 0);
}

function canForceStartCombat(seal, monster) {
  if (!seal || !monster) return false;
  if (safeFiniteNumber(seal.hp, 0, 0) <= 0 || safeFiniteNumber(monster.hp, 0, 0) <= 0) return false;
  if (!isPointInsideMonsterTerritory(monster, seal) || !isPointInsideMonsterTerritory(monster, monster)) return false;
  return isSealAvailableForSkirmish(seal) && isEnemyAvailableForSkirmish(monster);
}

function getSkirmishById(id) {
  return (gameState.skirmishes ?? []).find(skirmish => skirmish?.id === id) ?? null;
}

function getActiveSkirmishForActor(seal, monster) {
  const sealSkirmish = seal?.skirmishId ? getSkirmishById(seal.skirmishId) : null;
  const monsterSkirmish = monster?.skirmishId ? getSkirmishById(monster.skirmishId) : null;
  return sealSkirmish ?? monsterSkirmish;
}

function isSealAvailableForSkirmish(seal) {
  if (!seal || safeFiniteNumber(seal.hp, 0, 0) <= 0) return false;
  if (seal.skirmishId && getSkirmishById(seal.skirmishId)) return false;
  return !['fallen', 'downed', 'beingCarried', 'rescuing', 'carryingFallenSeal', 'leaving', 'leavingToSea', 'movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon', 'questing', 'usingFacility'].includes(seal.state);
}

function isEnemyAvailableForSkirmish(enemy) {
  if (!enemy || safeFiniteNumber(enemy.hp, 0, 0) <= 0) return false;
  return !(enemy.skirmishId && getSkirmishById(enemy.skirmishId));
}

function createSkirmish(seal, enemy) {
  if (!canForceStartCombat(seal, enemy)) return null;
  const existing = getActiveSkirmishForActor(seal, enemy);
  if (existing) return existing;
  gameState.skirmishes = Array.isArray(gameState.skirmishes) ? gameState.skirmishes : [];
  const id = `skirmish-${clampInteger(gameState.nextSkirmishId, 1, Number.MAX_SAFE_INTEGER, 1)}`;
  gameState.nextSkirmishId = clampInteger(gameState.nextSkirmishId, 1, Number.MAX_SAFE_INTEGER, 1) + 1;
  const skirmish = { id, state: 'fighting', centerX: (seal.x + enemy.x) / 2, centerY: (seal.y + enemy.y) / 2, sealIds: [], enemyIds: [], timer: 0, joinTimer: 0, resultResolved: false };
  gameState.skirmishes.push(skirmish);
  addSealToSkirmish(skirmish, seal);
  addEnemyToSkirmish(skirmish, enemy);
  assignSkirmishSlots(skirmish);
  return skirmish;
}

function addSealToSkirmish(skirmish, seal) {
  if (!skirmish || !seal || skirmish.sealIds.includes(seal.id)) return false;
  if (skirmish.sealIds.length >= clampInteger(CONFIG.SKIRMISH?.maxSealParticipants, 1, 8, 3)) return false;
  skirmish.sealIds.push(seal.id); seal.skirmishId = skirmish.id; seal.state = 'fighting'; seal.targetId = skirmish.enemyIds[0] ?? seal.targetId; seal.combatTimer = 0; seal.monsterTimer = 0; seal.currentAction = '戦闘中'; return true;
}

function addEnemyToSkirmish(skirmish, enemy) {
  if (!skirmish || !enemy || skirmish.enemyIds.includes(enemy.id)) return false;
  if (skirmish.enemyIds.length >= clampInteger(CONFIG.SKIRMISH?.maxEnemyParticipants, 1, 8, 3)) return false;
  skirmish.enemyIds.push(enemy.id); enemy.skirmishId = skirmish.id; enemy.state = CONFIG.monster.states.engaged; enemy.assignedSealId = skirmish.sealIds[0] ?? enemy.assignedSealId; return true;
}

function getSkirmishSealSlot(skirmish, index, seal) {
  const radius = seal?.sizeClass === 'giant' ? safeFiniteNumber(CONFIG.SKIRMISH?.giantSlotRadius, 52, 0) : safeFiniteNumber(CONFIG.SKIRMISH?.slotRadius, 34, 0);
  const offset = (index - (skirmish.sealIds.length - 1) / 2) * radius;
  return { x: safeFiniteNumber(skirmish.centerX, 0, 0) - radius, y: safeFiniteNumber(skirmish.centerY, 0, 0) + offset };
}

function getSkirmishEnemySlot(skirmish, index, enemy) {
  const radius = safeFiniteNumber(CONFIG.SKIRMISH?.slotRadius, 34, 0);
  const offset = (index - (skirmish.enemyIds.length - 1) / 2) * radius;
  return clampMonsterPoint(enemy, { x: safeFiniteNumber(skirmish.centerX, 0, 0) + radius, y: safeFiniteNumber(skirmish.centerY, 0, 0) + offset });
}

function assignSkirmishSlots(skirmish) {
  const seals = (skirmish?.sealIds ?? []).map(getSealById).filter(Boolean);
  const enemies = (skirmish?.enemyIds ?? []).map(id => (gameState.monsters ?? []).find(m => m?.id === id)).filter(Boolean);
  seals.forEach((seal, index) => { const slot = getSkirmishSealSlot(skirmish, index, seal); seal.combatSlotX = slot.x; seal.combatSlotY = slot.y; seal.target = { ...slot, reason: 'skirmish-slot' }; seal.path = []; });
  enemies.forEach((enemy, index) => { const slot = getSkirmishEnemySlot(skirmish, index, enemy); enemy.combatSlotX = slot.x; enemy.combatSlotY = slot.y; enemy.target = slot; });
}

function resetCombatApproachState(actor) {
  if (!actor) return;
  actor.combatApproachStuckFrames = 0;
  actor.combatApproachLastX = actor.x;
  actor.combatApproachLastY = actor.y;
}

function snapActorToCombatSlot(actor, targetX, targetY) {
  actor.x = targetX;
  actor.y = targetY;
  resetCombatApproachState(actor);
}

function getCombatApproachSpeedMultiplier(actor) {
  const base = safeFiniteNumber(CONFIG.SKIRMISH_MOVEMENT?.approachSpeedMultiplier, 0.65, 0);
  if (actor?.sizeClass !== 'giant') return base;
  const sizeScale = safeFiniteNumber(CONFIG.RENDER?.ENTITIES?.sealSizeClassScale?.giant, 1, 0);
  return sizeScale > 0 ? base / sizeScale : base;
}

function moveActorTowardCombatSlot(actor, targetX = actor?.combatSlotX, targetY = actor?.combatSlotY) {
  if (!actor || !Number.isFinite(Number(targetX)) || !Number.isFinite(Number(targetY))) return;
  targetX = Number(targetX);
  targetY = Number(targetY);
  const d = distance(actor.x, actor.y, targetX, targetY);
  const snapDistance = safeFiniteNumber(CONFIG.SKIRMISH_MOVEMENT?.snapDistance, 3, 0);
  if (d <= snapDistance) { snapActorToCombatSlot(actor, targetX, targetY); return; }

  const movedSinceLastFrame = distance(actor.x, actor.y, actor.combatApproachLastX ?? actor.x, actor.combatApproachLastY ?? actor.y);
  if (movedSinceLastFrame < safeFiniteNumber(CONFIG.COMBAT_STUCK?.stuckMoveEpsilon, 0.2, 0)) actor.combatApproachStuckFrames = clampInteger(actor.combatApproachStuckFrames, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  else actor.combatApproachStuckFrames = 0;
  actor.combatApproachLastX = actor.x;
  actor.combatApproachLastY = actor.y;

  if (d >= safeFiniteNumber(CONFIG.SKIRMISH_MOVEMENT?.emergencySnapDistance, 120, 0) || actor.combatApproachStuckFrames >= clampInteger(CONFIG.SKIRMISH_MOVEMENT?.emergencySnapFrames, 1, Number.MAX_SAFE_INTEGER, 180)) {
    snapActorToCombatSlot(actor, targetX, targetY);
    return;
  }

  const smoothing = safeFiniteNumber(CONFIG.SKIRMISH_MOVEMENT?.smoothing, 0.12, 0);
  const maxStep = safeFiniteNumber(CONFIG.SKIRMISH_MOVEMENT?.maxApproachStep, 1.2, 0);
  const step = Math.min(d, maxStep, d * smoothing * getCombatApproachSpeedMultiplier(actor));
  if (step <= 0) return;
  const dx = ((targetX - actor.x) / d) * step;
  const dy = ((targetY - actor.y) / d) * step;
  if (dx > 0) actor.facing = 'right';
  else if (dx < 0) actor.facing = 'left';
  actor.x += dx;
  actor.y += dy;
}

function nearSkirmishJoinPoint(actor, skirmish, opponents) {
  const radius = safeFiniteNumber(CONFIG.SKIRMISH?.joinRadius, 160, 0);
  if (distance(actor.x, actor.y, skirmish.centerX, skirmish.centerY) <= radius) return true;
  return opponents.some(opponent => opponent && getDistance(actor, opponent) <= radius);
}

function tryJoinNearbySeals(skirmish) {
  const enemies = (skirmish.enemyIds ?? []).map(id => (gameState.monsters ?? []).find(m => m?.id === id)).filter(Boolean);
  for (const seal of gameState.seals ?? []) {
    if ((skirmish.sealIds ?? []).length >= clampInteger(CONFIG.SKIRMISH?.maxSealParticipants, 1, 8, 3)) break;
    if (isSealAvailableForSkirmish(seal) && nearSkirmishJoinPoint(seal, skirmish, enemies)) addSealToSkirmish(skirmish, seal);
  }
}

function tryJoinNearbyEnemies(skirmish) {
  const seals = (skirmish.sealIds ?? []).map(getSealById).filter(Boolean);
  for (const enemy of gameState.monsters ?? []) {
    if ((skirmish.enemyIds ?? []).length >= clampInteger(CONFIG.SKIRMISH?.maxEnemyParticipants, 1, 8, 3)) break;
    if (isEnemyAvailableForSkirmish(enemy) && nearSkirmishJoinPoint(enemy, skirmish, seals)) addEnemyToSkirmish(skirmish, enemy);
  }
}

function grantSkirmishReward(seal, enemy) {
  if (!seal || !enemy || enemy.rewardResolved) return;
  enemy.rewardResolved = true;
  seal.exp = safeFiniteNumber(seal.exp, 0, 0) + CONFIG.monster.rewardExp;
  const gearShare = Math.floor(CONFIG.monster.rewardG * CONFIG.EQUIPMENT.GEAR_BUDGET_RATE);
  seal.gearBudget = safeFiniteNumber(seal.gearBudget, 0, 0) + gearShare;
  seal.carriedG = safeFiniteNumber(seal.carriedG, 0, 0) + CONFIG.monster.rewardG - gearShare;
  addFavor(seal, CONFIG.seal.favorDefeat);
  seal.huntCountThisTrip = clampInteger(seal.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  if (seal.type === 'visitor') seal.huntsThisVisit = clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  gameState.stats.monthlyHunts = clampInteger(gameState.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  applyLevelUps(seal);
  gameState.frameTemps.toRemoveMonsters.push(enemy.id);
  logMessage(`${seal.name}がカニを倒して${CONFIG.monster.rewardG}Gを獲得！`);
}

function resolveSkirmish(skirmish, won) {
  if (!skirmish || skirmish.resultResolved) return;
  skirmish.resultResolved = true; skirmish.state = 'done';
  const seals = (skirmish.sealIds ?? []).map(getSealById).filter(seal => seal && safeFiniteNumber(seal.hp, 0, 0) > 0);
  if (won) for (const enemyId of skirmish.enemyIds ?? []) grantSkirmishReward(seals[0], (gameState.monsters ?? []).find(m => m?.id === enemyId));
}

function cleanupSkirmish(skirmish) {
  for (const sealId of skirmish?.sealIds ?? []) { const seal = getSealById(sealId); if (!seal) continue; seal.skirmishId = null; seal.combatSlotX = null; seal.combatSlotY = null; resetCombatApproachState(seal); seal.targetId = null; seal.target = null; seal.path = []; if (seal.state === 'fighting') { if (safeFiniteNumber(seal.hp, 0, 0) <= 0) seal.state = 'downed'; else if (shouldContinueHunting(seal)) { seal.state = 'hunting'; seal.currentAction = '探索中'; } else sendSealBackThroughHuntCorridor(seal); } }
  for (const enemyId of skirmish?.enemyIds ?? []) { const enemy = (gameState.monsters ?? []).find(m => m?.id === enemyId); if (!enemy) continue; enemy.skirmishId = null; enemy.combatSlotX = null; enemy.combatSlotY = null; resetCombatApproachState(enemy); enemy.assignedSealId = null; if (safeFiniteNumber(enemy.hp, 0, 0) > 0) enemy.state = CONFIG.monster.states.idle; }
}

function updateSkirmishes() {
  gameState.skirmishes = Array.isArray(gameState.skirmishes) ? gameState.skirmishes : [];
  const done = [];
  for (const skirmish of gameState.skirmishes) {
    if (!skirmish || skirmish.state !== 'fighting') { done.push(skirmish); continue; }
    skirmish.timer = clampInteger(skirmish.timer, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
    skirmish.joinTimer = clampInteger(skirmish.joinTimer, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
    const liveSeals = (skirmish.sealIds ?? []).map(getSealById).filter(seal => seal && safeFiniteNumber(seal.hp, 0, 0) > 0 && seal.state === 'fighting');
    const presentEnemies = (skirmish.enemyIds ?? []).map(id => (gameState.monsters ?? []).find(m => m?.id === id)).filter(Boolean);
    const liveEnemies = presentEnemies.filter(enemy => safeFiniteNumber(enemy.hp, 0, 0) > 0);
    if (liveSeals.length <= 0) resolveSkirmish(skirmish, false);
    else if (presentEnemies.length <= 0 || liveEnemies.length <= 0) resolveSkirmish(skirmish, true);
    else if (skirmish.timer >= clampInteger(CONFIG.SKIRMISH?.staleCombatTimeoutFrames, 1, Number.MAX_SAFE_INTEGER, 600)) resolveSkirmish(skirmish, false);
    if (skirmish.state !== 'fighting') { cleanupSkirmish(skirmish); done.push(skirmish); continue; }
    if (skirmish.joinTimer >= clampInteger(CONFIG.SKIRMISH?.joinCheckIntervalFrames, 1, Number.MAX_SAFE_INTEGER, 20)) { skirmish.joinTimer = 0; tryJoinNearbySeals(skirmish); tryJoinNearbyEnemies(skirmish); assignSkirmishSlots(skirmish); }
    assignSkirmishSlots(skirmish);
    const seals = skirmish.sealIds.map(getSealById).filter(seal => seal && safeFiniteNumber(seal.hp, 0, 0) > 0 && seal.state === 'fighting');
    const enemies = skirmish.enemyIds.map(id => (gameState.monsters ?? []).find(m => m?.id === id)).filter(enemy => enemy && safeFiniteNumber(enemy.hp, 0, 0) > 0);
    for (const actor of [...seals, ...enemies]) moveActorTowardCombatSlot(actor);
    if (skirmish.timer % clampInteger(CONFIG.SKIRMISH?.battleTickFrames, 1, Number.MAX_SAFE_INTEGER, 30) === 0) {
      for (const seal of seals) { const enemy = enemies.find(e => safeFiniteNumber(e.hp, 0, 0) > 0); if (enemy) enemy.hp -= Math.max(CONFIG.combat.minDamage, getSealEffectiveStats(seal).attack - safeFiniteNumber(enemy.defense, 0, 0)); }
      for (const enemy of enemies.filter(e => safeFiniteNumber(e.hp, 0, 0) > 0)) { const seal = seals.find(s => safeFiniteNumber(s.hp, 0, 0) > 0); if (seal) { seal.hp -= Math.max(CONFIG.combat.minDamage, safeFiniteNumber(enemy.attack, 0, 0) - getSealEffectiveStats(seal).defense); if (seal.hp <= 0) { seal.hp = 0; seal.state = 'downed'; seal.recoverySource = 'downed'; seal.rescueTargetId = null; seal.stuckFrames = 0; logMessage(`${seal.name}が倒れました。`); } } }
    }
  }
  gameState.skirmishes = gameState.skirmishes.filter(skirmish => !done.includes(skirmish));
}


function clearCombatContactState(monster) {
  if (!monster) return;
  monster.contactTimersBySealId = {};
  monster.stuckFrames = 0;
  monster.lastX = monster.x;
  monster.lastY = monster.y;
}

function updateCombatContacts() {
  for (const monster of gameState.monsters ?? []) {
    if (!monster || safeFiniteNumber(monster.hp, 0, 0) <= 0 || monster.skirmishId) { clearCombatContactState(monster); continue; }
    normalizeMonsterRuntime(monster);
    for (const seal of gameState.seals ?? []) if (seal && canForceStartCombat(seal, monster) && isSealEnemyContact(seal, monster)) createSkirmish(seal, monster);
  }
}

function updateMonsters(dt) {
  for (const monster of gameState.monsters ?? []) updateMonsterBehavior(monster, dt);
}

function updateMonsterBehavior(monster, dt) {
  if (!monster || safeFiniteNumber(monster.hp, 0, 0) <= 0 || monster.skirmishId) return;
  normalizeMonsterRuntime(monster);
  const assignedSeal = getSealById(monster.assignedSealId);
  const nearbySeal = findNearestThreateningSeal(monster);
  const engagedSeal = assignedSeal ?? nearbySeal;
  if (engagedSeal) {
    monster.state = CONFIG.monster.states.engaged;
    monster.alertTimer = safeFiniteNumber(monster.alertTimer, 0, 0) + dt;
    nudgeMonsterWithinTerritory(monster, engagedSeal, dt, CONFIG.monster.movement?.engagedSpeed);
    return;
  }
  monster.alertTimer = 0;
  monster.stateTimer = Math.max(0, safeFiniteNumber(monster.stateTimer, 0, 0) - dt);
  if (monster.stateTimer <= 0 || !monster.target) chooseMonsterIdleState(monster);
  if (monster.state === CONFIG.monster.states.patrol) moveMonsterTowardTarget(monster, dt, CONFIG.monster.movement?.patrolSpeed);
}

function normalizeMonsterRuntime(monster) {
  const states = CONFIG.monster.states ?? {};
  if (![states.idle, states.patrol, states.engaged].includes(monster.state)) monster.state = states.idle;
  monster.homeX = safeFiniteNumber(monster.homeX, monster.x, 0);
  monster.homeY = safeFiniteNumber(monster.homeY, monster.y, 0);
  monster.stateTimer = safeFiniteNumber(monster.stateTimer, 0, 0);
  if (!monster.target || !Number.isFinite(Number(monster.target?.x)) || !Number.isFinite(Number(monster.target?.y))) monster.target = null;
}

function findNearestThreateningSeal(monster) {
  const radius = safeFiniteNumber(CONFIG.monster.territory?.reactionRadius, 0, 0);
  if (radius <= 0) return null;
  return (gameState.seals ?? []).filter(seal => seal && !['fallen', 'expeditionRunning', 'returningFromDungeon'].includes(seal.state) && distance(seal.x, seal.y, monster.x, monster.y) <= radius)
    .reduce((best, seal) => !best || distance(seal.x, seal.y, monster.x, monster.y) < distance(best.x, best.y, monster.x, monster.y) ? seal : best, null);
}

function chooseMonsterIdleState(monster) {
  const cfg = CONFIG.monster.movement ?? {};
  const states = CONFIG.monster.states ?? {};
  if (Math.random() < 0.45) {
    monster.state = states.idle;
    monster.target = null;
    monster.stateTimer = randomRange(safeFiniteNumber(cfg.idleSecondsMin, 0.8, 0), safeFiniteNumber(cfg.idleSecondsMax, 1.8, 0));
    return;
  }
  monster.state = states.patrol;
  monster.target = clampMonsterPoint(monster, randomMonsterPatrolPoint(monster));
  monster.stateTimer = randomRange(safeFiniteNumber(cfg.patrolSecondsMin, 1.2, 0), safeFiniteNumber(cfg.patrolSecondsMax, 2.8, 0));
}

function randomMonsterPatrolPoint(monster) {
  const radius = safeFiniteNumber(CONFIG.monster.movement?.wanderRadius, 85, 0);
  const angle = Math.random() * Math.PI * 2;
  const range = randomRange(radius * 0.25, radius);
  return { x: safeFiniteNumber(monster.homeX, monster.x, 0) + Math.cos(angle) * range, y: safeFiniteNumber(monster.homeY, monster.y, 0) + Math.sin(angle) * range };
}

function clampMonsterPoint(monster, point) {
  const area = CONFIG.DUNGEONS?.spawnAreas?.[monster?.areaId ?? 'coast']?.bounds ?? CONFIG.DUNGEONS?.spawnAreas?.coast?.bounds;
  const pad = safeFiniteNumber(CONFIG.monster.movement?.edgePadding, 12, 0);
  if (!area) return { x: safeFiniteNumber(point?.x, monster?.x, 0), y: safeFiniteNumber(point?.y, monster?.y, 0) };
  return { x: clampNumber(safeFiniteNumber(point?.x, monster?.x, 0), gridToWorld(area.x, area.y).x - CONFIG.world.tile / 2 + pad, gridToWorld(area.x + area.w - 1, area.y).x + CONFIG.world.tile / 2 - pad, monster?.x ?? 0), y: clampNumber(safeFiniteNumber(point?.y, monster?.y, 0), gridToWorld(area.x, area.y).y - CONFIG.world.tile / 2 + pad, gridToWorld(area.x, area.y + area.h - 1).y + CONFIG.world.tile / 2 - pad, monster?.y ?? 0) };
}

function moveMonsterTowardTarget(monster, dt, speed) {
  if (!monster?.target) return;
  const d = distance(monster.x, monster.y, monster.target.x, monster.target.y);
  if (d <= safeFiniteNumber(CONFIG.monster.movement?.retargetDistance, 10, 0)) { monster.target = null; monster.stateTimer = 0; return; }
  const step = Math.min(d, safeFiniteNumber(speed, 0, 0) * dt);
  if (step <= 0) return;
  const dx = ((monster.target.x - monster.x) / d) * step;
  const dy = ((monster.target.y - monster.y) / d) * step;
  monster.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : monster.facing;
  const next = clampMonsterPoint(monster, { x: monster.x + dx, y: monster.y + dy });
  monster.x = next.x; monster.y = next.y;
}

function nudgeMonsterWithinTerritory(monster, seal, dt, speed) {
  const leash = safeFiniteNumber(CONFIG.monster.territory?.leashRadius, 170, 0);
  const awayFromHome = distance(monster.x, monster.y, monster.homeX, monster.homeY);
  const tooFar = leash > 0 && awayFromHome > leash;
  const target = tooFar ? { x: monster.homeX, y: monster.homeY } : { x: seal.x, y: seal.y };
  if (distance(monster.x, monster.y, target.x, target.y) <= CONFIG.monster.contactDistance * 0.85) return;
  monster.target = target;
  moveMonsterTowardTarget(monster, dt, speed);
}

function updateSeals(dt) {
  ensureResidentSeal();
  for (const seal of [...(gameState.seals ?? [])]) {
    if (!seal) continue;
    if (seal.type === 'visitor') seal.visitTimerMs = safeFiniteNumber(seal.visitTimerMs, 0, 0) + dt * 1000;
    updateToiletNeed(seal, dt * 1000);
    if (seal.expeditionId && ['movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon', 'questing'].includes(seal.state)) { updateExpeditionSeal(seal, dt); continue; }
    if (seal.state === 'questing') continue;
    if (seal.state === 'fallen') seal.state = 'downed';
    if (seal.state === 'downed') { updateDowned(seal, dt); continue; }
    if (seal.state === 'beingCarried') { updateDowned(seal, dt); continue; }
    const fallen = findFallenForRescue(seal);
    if (fallen && !seal.rescueTargetId && seal.hp > getSealEffectiveStats(seal).maxHp * safeFiniteNumber(CONFIG.SEAL_RECOVERY?.seekRestHpRatio, 0.6, 0)) {
      seal.state = 'rescuing'; seal.rescueTargetId = fallen.id; seal.target = { x: fallen.x, y: fallen.y }; logMessage(`${seal.name}が${fallen.name}を救助に向かいました。`);
    }
    switch (seal.state) {
      case 'arriving': seal.state = 'arrivingFromSea'; updateArrivingFromSea(seal, dt); break;
      case 'arrivingFromSea': updateArrivingFromSea(seal, dt); break;
      case 'choosingArrivalAction': updateChoosingArrivalAction(seal); break;
      case 'choosingHuntArea': updateChoosingHuntArea(seal); break;
      case 'movingToHuntExit': seal.state = 'movingToHuntArea'; updateMovingToHuntArea(seal, dt); break;
      case 'movingToHuntArea': updateMovingToHuntArea(seal, dt); break;
      case 'hunting': updateHunting(seal, dt); break;
      case 'movingToMonster': updateMovingToMonster(seal, dt); break;
      case 'fighting': updateFighting(seal, dt); break;
      case 'returningFromHunt': updateReturningFromHunt(seal, dt); break;
      case 'choosingFacility': seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; updateChoosingFacility(seal, dt); break;
      case 'choosingPostHuntFacility': updateChoosingPostHuntFacility(seal, dt); break;
      case 'movingToFacility': updateMovingToFacility(seal, dt); break;
      case 'usingFacility': updateUsingFacility(seal, dt); break;
      case 'leaving': seal.state = 'leavingToSea'; updateLeavingToSea(seal, dt); break;
      case 'leavingToSea': updateLeavingToSea(seal, dt); break;
      case 'idle': updateIdle(seal, dt); break;
      case 'resting': updateFallbackResting(seal, dt); break;
      case 'movingToDungeon': updateExpeditionSeal(seal, dt); break;
      case 'waitingAtDungeon': break;
      case 'expeditionRunning': break;
      case 'returningFromDungeon': updateExpeditionSeal(seal, dt); break;
      case 'questing': break;
      case 'rescuing': updateRescuing(seal, dt); break;
      case 'carryingFallenSeal': updateCarrying(seal, dt); break;
      default: seal.state = seal.type === 'visitor' ? 'choosingArrivalAction' : 'choosingHuntArea'; seal.target = null; break;
    }
    rebuildPathIfStuck(seal);
  }
}


function updateExpeditionSeal(seal, dt) {
  const dungeon = getDungeonById(seal?.expeditionId ?? seal?.questingDungeonId);
  if (!seal || !dungeon || ['expired'].includes(dungeon.state)) { clearSealExpeditionState(seal); return; }
  if (seal.state === 'movingToDungeon') {
    const entrance = getDungeonEntrancePoint(dungeon);
    if (!seal.target || distance(seal.x, seal.y, entrance.x, entrance.y) > CONFIG.seal.contactDistance) setSealDestination(seal, entrance, 'dungeon-entrance');
    updateSealMovement(seal, dt * 1000);
    if (distance(seal.x, seal.y, entrance.x, entrance.y) <= CONFIG.seal.contactDistance) {
      seal.state = 'waitingAtDungeon';
      seal.path = [];
      seal.currentAction = `${dungeon.name}入口で待機中`;
    }
    return;
  }
  if (seal.state === 'returningFromDungeon') {
    const target = seal.target ?? getDungeonReturnPoint(seal);
    if (!seal.target) setSealDestination(seal, target, 'dungeon-return');
    updateSealMovement(seal, dt * 1000);
    if (distance(seal.x, seal.y, seal.target?.x ?? seal.x, seal.target?.y ?? seal.y) <= CONFIG.seal.contactDistance && (!seal.path || seal.path.length <= 0)) finishSealDungeonReturn(seal, dungeon);
  }
}

function clearSealExpeditionState(seal) {
  if (!seal) return;
  seal.expeditionId = null;
  seal.questingDungeonId = null;
  seal.questingReturnState = null;
  seal.path = [];
  seal.target = null;
  seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingHuntArea';
  seal.currentAction = '遠征状態を整理しました';
}

function updateDowned(seal, dt) {
  if (!seal) return;
  if (seal.state === 'beingCarried') return;
  seal.recoverySource = 'downed';
  seal.hp = Math.min(getSealEffectiveStats(seal).maxHp, safeFiniteNumber(seal.hp, 0, 0) + safeFiniteNumber(CONFIG.SEAL_RECOVERY?.downedRecoveryPerSecond, 1, 0) * dt);
  if (seal.hp >= getSealEffectiveStats(seal).maxHp * safeFiniteNumber(CONFIG.SEAL_RECOVERY?.downedRecoveryThresholdRatio, 0.35, 0) && !isBeingCarried(seal.id)) {
    seal.currentAction = 'ゆっくり起き上がりました'; seal.state = 'choosingFacility'; seal.recoverySource = '';
    logMessage(`${seal.name}が自力で起き上がりました。`);
  }
}
function updateFallen(seal, dt) { if (seal) seal.state = 'downed'; updateDowned(seal, dt); }

function logVisitorIssue(seal, key, message) {
  gameState.warnings = gameState.warnings ?? {};
  const scopedKey = `${seal?.id ?? 'global'}:${key}`;
  if (gameState.warnings[scopedKey] || seal?.lastTransitionLogKey === key) return;
  gameState.warnings[scopedKey] = true;
  if (seal) seal.lastTransitionLogKey = key;
  logMessage(message);
}

function setVisitorIdleWithReason(seal, key, message) {
  if (!seal) return;
  seal.state = 'idle';
  seal.target = null;
  seal.path = [];
  seal.currentAction = message;
  logVisitorIssue(seal, key, message);
}

function updateArrivingFromSea(seal, dt) {
  seal.leaveAfterFacilityUse = false;
  seal.currentAction = '海から島へ向かっています';
  if (!seal?.target || !Array.isArray(seal.path) || seal.path.length <= 0) {
    const landing = getVisitorShoreLandingPoint();
    if (!landing) { setVisitorIdleWithReason(seal, 'no-landing-point', `${seal.name}は上陸地点が見つからず待機します。`); return; }
    if (!setSealDestination(seal, landing, 'sea-arrival')) { setVisitorIdleWithReason(seal, 'no-path-to-landing', `${seal.name}は上陸地点までの経路が見つからず待機します。`); return; }
  }
  updateSealMovement(seal, dt * 1000);
}

function updateArriving(seal, dt) { updateArrivingFromSea(seal, dt); }

function chooseArrivalActionForVisitor(seal) {
  if (!seal || seal.type !== 'visitor') return { type: 'hunt' };
  const arrival = CONFIG.VISITORS?.ARRIVAL ?? {};
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? safeFiniteNumber(seal.hp, 0, 0) / effectiveMaxHp : 0;
  const typeConfig = arrival.facilityTypes ?? {};
  if (hpRatio <= safeFiniteNumber(arrival.lowHpFacilityHpRatio, 0.58, 0)) {
    const restFacility = chooseFoodFacilityForSeal(seal) ?? chooseRelaxFacilityForSeal(seal);
    if (restFacility) return { type: 'facility', facility: restFacility, action: '回復できる施設へ向かいます' };
  }
  const arrivalToilet = choosePublicToilet(seal);
  if (arrivalToilet && Math.random() < getToiletSelectionChance(seal)) return { type: 'facility', facility: arrivalToilet, action: '公衆トイレへ立ち寄ります' };
  const equipmentShop = getBestFacilityForSeal(seal, typeConfig.gear ?? Object.keys(CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES ?? {}));
  if (equipmentShop && chooseCheapestAffordableUpgrade(seal, equipmentShop)) return { type: 'facility', facility: equipmentShop, action: `${CONFIG.facilities?.[equipmentShop.type]?.label ?? '店'}で装備を見ます` };
  if (hpRatio < safeFiniteNumber(arrival.restaurantHpRatio, 0.82, 0) || Math.random() < safeFiniteNumber(arrival.preHuntFacilityChance, 0, 0)) {
    const facility = getBestFacilityForSeal(seal, hpRatio < safeFiniteNumber(arrival.restaurantHpRatio, 0.82, 0) ? (typeConfig.reducedHp ?? ['restaurant', 'inn']) : (typeConfig.optional ?? ['restaurant', 'blacksmith', 'inn']));
    if (facility) return { type: 'facility', facility, action: `${CONFIG.facilities[facility.type]?.label ?? '施設'}へ向かいます` };
  }
  return { type: 'hunt' };
}

function updateChoosingArrivalAction(seal) {
  seal.choosingTicks = clampInteger(seal?.choosingTicks, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  const choice = chooseArrivalActionForVisitor(seal);
  if (choice?.type === 'facility' && choice.facility) {
    const facility = (gameState.world.objects ?? []).find(o => o?.id === choice.facility.id);
    const purpose = getFacilityPurposeForSeal(seal, facility);
    if (facility && routeSealDirectlyToFacility(seal, facility.id, purpose)) {
      seal.currentAction = choice.action ?? seal.currentAction;
      seal.choosingTicks = 0;
      return;
    }
    logVisitorIssue(seal, 'no-usable-facility', `${seal.name}は使える施設への経路がなく狩りへ向かいます。`);
  }
  seal.choosingTicks = 0;
  updateChoosingHuntArea(seal);
}


function updateChoosingHuntArea(seal) {
  clearSealFacilityReservation(seal);
  const areaId = seal?.selectedHuntAreaId ?? 'coast';
  seal.selectedHuntAreaId = areaId;
  seal.targetId = null;
  seal.huntTimer = 0;
  seal.noMonsterTimer = 0;
  seal.huntCountThisTrip = 0;
  const monster = chooseNextHuntTarget(seal);
  const target = monster ? { x: monster.x, y: monster.y } : randomHuntAreaPoint(areaId);
  if (monster) seal.targetId = monster.id;
  if (!setSealDestination(seal, target, monster ? 'monster' : 'hunt-wander')) {
    if (monster) monster.assignedSealId = null;
    seal.targetId = null;
    warnNoHuntCorridor(seal);
    return;
  }
  seal.currentAction = monster ? '獲物へ向かっています' : '狩場へ向かっています';
  seal.state = monster ? 'movingToMonster' : 'movingToHuntArea';
}

function updateMovingToHuntArea(seal, dt) {
  if (!seal?.target || !Array.isArray(seal.path) || seal.path.length <= 0) {
    const target = randomHuntAreaPoint(seal?.selectedHuntAreaId ?? 'coast');
    if (!setSealDestination(seal, target, 'hunt-wander')) { warnNoHuntCorridor(seal); return; }
  }
  updateSealMovement(seal, dt * 1000);
}

function updateMovingToHuntExit(seal, dt) { updateMovingToHuntArea(seal, dt); }

function updateHunting(seal, dt) {
  seal.huntTimer = safeFiniteNumber(seal.huntTimer, 0, 0) + dt;
  if (shouldReturnFromHunt(seal)) { sendSealBackThroughHuntCorridor(seal); return; }
  const areaId = seal?.selectedHuntAreaId ?? 'coast';
  const monster = chooseNextHuntTarget(seal);
  if (monster) {
    seal.noMonsterTimer = 0;
    seal.targetId = monster.id;
    if (setSealDestination(seal, { x: monster.x, y: monster.y }, 'monster')) { seal.state = 'movingToMonster'; return; }
    monster.assignedSealId = null;
    seal.targetId = null;
  }
  seal.noMonsterTimer = safeFiniteNumber(seal.noMonsterTimer, 0, 0) + dt;
  seal.wanderTimer = Math.max(0, safeFiniteNumber(seal.wanderTimer, 0, 0) - dt);
  if (!seal.target || seal.wanderTimer <= 0 || distance(seal.x, seal.y, seal.target.x, seal.target.y) < CONFIG.seal.contactDistance) {
    setSealDestination(seal, randomHuntAreaPoint(areaId), 'hunt-wander');
    seal.wanderTimer = CONFIG.seal.wanderSeconds;
  }
  updateSealMovement(seal, dt * 1000);
}

function sendSealBackThroughHuntCorridor(seal) {
  seal.currentAction = '帰還後の行き先を選んでいます';
  seal.state = 'returningFromHunt';
  choosePostHuntAction(seal);
}

function claimNearestMonster(seal, areaId = null) {
  const available = (gameState.monsters ?? []).filter(m => m?.hp > 0 && (!areaId || (m?.areaId ?? 'coast') === areaId) && (!m.assignedSealId || m.assignedSealId === seal.id));
  const monster = available.reduce((best, m) => !best || distance(seal.x, seal.y, m.x, m.y) < distance(seal.x, seal.y, best.x, best.y) ? m : best, null);
  if (monster) monster.assignedSealId = seal.id;
  return monster;
}

function updateMovingToMonster(seal, dt) {
  const monster = (gameState.monsters ?? []).find(m => m?.id === seal.targetId);
  if (!monster || monster.hp <= 0) { seal.targetId = null; seal.currentAction = '探索中'; seal.state = 'hunting'; return; }
  if (shouldReturnFromHunt(seal)) { monster.assignedSealId = null; seal.targetId = null; sendSealBackThroughHuntCorridor(seal); return; }
  if (!seal.target || seal.pathTargetKey !== `${worldToGrid(monster.x, monster.y).x},${worldToGrid(monster.x, monster.y).y}:monster`) {
    if (!setSealDestination(seal, { x: monster.x, y: monster.y }, 'monster')) { monster.assignedSealId = null; seal.targetId = null; seal.currentAction = '探索中'; seal.state = 'hunting'; return; }
  }
  updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, monster.x, monster.y) <= safeFiniteNumber(CONFIG.SKIRMISH?.triggerRadius, CONFIG.monster.territory?.reactionRadius, 0)) createSkirmish(seal, monster);
}

function updateFighting(seal, dt) {
  if (seal?.skirmishId) return;
  const monster = (gameState.monsters ?? []).find(m => m?.id === seal.targetId);
  if (!monster || monster.hp <= 0) {
    seal.targetId = null;
    if (seal.carriedG > 0) sendSealBackThroughHuntCorridor(seal);
    else { seal.currentAction = '探索中'; seal.state = 'hunting'; }
    return;
  }
  seal.combatTimer += dt; seal.monsterTimer += dt;
  if (seal.combatTimer >= CONFIG.combat.sealAttackSeconds) {
    seal.combatTimer = 0;
    monster.hp -= Math.max(CONFIG.combat.minDamage, getSealEffectiveStats(seal).attack - monster.defense);
    if (monster.hp <= 0) {
      clearCombatContactState(monster);
      seal.exp += CONFIG.monster.rewardExp;
      const gearShare = Math.floor(CONFIG.monster.rewardG * CONFIG.EQUIPMENT.GEAR_BUDGET_RATE);
      seal.gearBudget = safeFiniteNumber(seal.gearBudget, 0, 0) + gearShare;
      seal.carriedG += CONFIG.monster.rewardG - gearShare;
      addFavor(seal, CONFIG.seal.favorDefeat);
      seal.huntCountThisTrip = clampInteger(seal.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      if (seal.type === 'visitor') seal.huntsThisVisit = clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      gameState.stats.monthlyHunts = clampInteger(gameState.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      applyLevelUps(seal);
      gameState.frameTemps.toRemoveMonsters.push(monster.id);
      logMessage(`${seal.name}がカニを倒して${CONFIG.monster.rewardG}Gを獲得！`);
      seal.targetId = null;
      if (shouldContinueHunting(seal)) { seal.currentAction = '探索中'; seal.state = 'hunting'; } else sendSealBackThroughHuntCorridor(seal);
      return;
    }
  }
  if (seal.monsterTimer >= CONFIG.combat.monsterAttackSeconds) {
    seal.monsterTimer = 0;
    seal.hp -= Math.max(CONFIG.combat.minDamage, monster.attack - getSealEffectiveStats(seal).defense);
    if (seal.hp <= 0) { seal.hp = 0; monster.assignedSealId = null; seal.state = 'downed'; seal.recoverySource = 'downed'; seal.targetId = null; seal.rescueTargetId = null; seal.stuckFrames = 0; logMessage(`${seal.name}が倒れました。`); }
  }
}

function updateReturningFromHunt(seal, dt) {
  clearLegacyReturnTarget(seal);
  if (!seal?.target || !Array.isArray(seal.path) || seal.path.length <= 0) { choosePostHuntAction(seal); return; }
  updateSealMovement(seal, dt * 1000);
}

function updateChoosingFacility(seal, dt) {
  if (seal.wanderTimer > 0) {
    seal.wanderTimer -= dt;
    if (!seal.target || distance(seal.x, seal.y, seal.target.x, seal.target.y) < CONFIG.seal.contactDistance) setSealDestination(seal, villageWanderPoint(), 'village-wander');
    updateSealMovement(seal, dt * 1000);
    if (seal.wanderTimer > 0) return;
  }
  const facility = chooseFacilityAfterHunt(seal);
  if (!facility) { handleNoUsableFacility(seal); return; }
  if (!routeSealDirectlyToFacility(seal, facility.id, getFacilityPurposeForSeal(seal, facility))) { handleNoUsableFacility(seal); return; }
}

function updateChoosingPostHuntFacility(seal, dt) {
  if (seal?.type === 'visitor') seal.wanderTimer = 0;
  updateChoosingFacility(seal, dt);
}

function updateMovingToFacility(seal, dt) {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (!facility || !isFacilityUsable(facility)) { clearSealFacilityReservation(seal); seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  const validPurpose = getFacilityPurposeForSeal(seal, facility);
  if (!isFacilityStillValidTarget(seal, seal.targetId, validPurpose)) { clearSealFacilityReservation(seal); seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  const slot = validPurpose === 'lifeVisit' ? getReservedFacilitySlot(facility, seal) : null;
  if (validPurpose === 'lifeVisit' && !slot) { clearSealFacilityReservation(seal); seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  const target = validPurpose === 'lifeVisit' ? facilitySlotWorldPoint(facility, slot) : facilityInteractionPoint(facility);
  if (!setSealDestination(seal, target, validPurpose === 'lifeVisit' ? 'lifeVisit' : 'facility')) { clearSealFacilityReservation(seal); seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, target.x, target.y) <= CONFIG.seal.contactDistance) {
    seal.actionTimer = isLifeFacility(facility) ? getLifeFacilityUseDurationMs(facility) / 1000 : (isPublicToiletFacility(facility) ? getPublicToiletUseDurationMs(facility) / 1000 : (facility.type === 'inn' ? CONFIG.seal.restSeconds : CONFIG.seal.spendSeconds));
    seal.currentAction = `${CONFIG.facilities[facility.type]?.label ?? '施設'}を利用中`;
    if (isLifeFacility(facility)) { seal.x = target.x; seal.y = target.y; }
    seal.state = 'usingFacility';
  }
}

function updateUsingFacility(seal, dt) {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (isLifeFacility(facility)) { updateUsingLifeFacility(seal, facility, dt); return; }
  if (isPublicToiletFacility(facility)) { updateUsingPublicToilet(seal, facility, dt); return; }
  if (facility?.type === 'inn') { updateInnUse(seal, facility, dt); return; }
  const purpose = getFacilityPurposeForSeal(seal, facility);
  if (!facility || !isFacilityStillValidTarget(seal, seal.targetId, purpose)) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  seal.actionTimer -= dt;
  if (seal.actionTimer > 0) return;
  const upgrade = chooseCheapestAffordableUpgrade(seal, facility);
  if (upgrade && buyEquipmentUpgrade(seal, upgrade, facility)) {
    const paid = safeFiniteNumber(upgrade.price, 0, 0);
    const income = registerFacilityUse(facility, seal, paid);
    addPlayerIncome(Math.max(0, income - paid));
    afterVillageActivity(seal);
    return;
  }
  const price = getFacilityPrice(facility);
  const spent = Math.min(safeFiniteNumber(seal.carriedG, 0, 0), price);
  if (spent <= 0) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  seal.carriedG -= spent;
  const income = isLevelableFacility(facility) ? registerFacilityUse(facility, seal, spent) : spent;
  addPlayerIncome(income);
  if (['restaurant', 'manjuShop'].includes(facility.type)) {
    addToiletNeed(seal, facility.type === 'restaurant' ? CONFIG.TOILET?.foodNeedIncrease : CONFIG.TOILET?.manjuNeedIncrease);
    seal.hp = Math.min(getSealEffectiveStats(seal).maxHp, safeFiniteNumber(seal.hp, 0, 0) + getFacilityHealAmount(facility) * safeFiniteNumber(CONFIG.SEAL_RECOVERY?.foodRecoveryMultiplier, 1, 0));
    seal.recoverySource = facility.type;
    seal.mealCountSinceInn = clampInteger(seal.mealCountSinceInn, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  }
  if (facility.type === 'blacksmith') {
    seal.facilityUseCounts = normalizeFacilityUseCounts(seal.facilityUseCounts);
    seal.facilityUseCounts[facility.type] = (seal.facilityUseCounts?.[facility.type] ?? 0) + 1;
    seal.lastFacilityId = facility.id;
    if (seal.type === 'visitor') seal.facilitiesUsedThisVisit = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
    if (Math.random() < CONFIG.seal.blacksmithAttackChance) seal.attack += CONFIG.seal.blacksmithAttackGain;
  }
  addFavor(seal, CONFIG.facilities?.[facility.type]?.favorGain ?? CONFIG.seal.favorFacilityUse);
  logMessage(`${seal.name}が${CONFIG.facilities[facility.type]?.label}で${spent}G使いました。`);
  afterVillageActivity(seal);
}

function updateInnUse(seal, inn, dt) {
  if (!seal || !inn || !isFacilityUsable(inn)) { if (seal) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; } return; }
  seal.recoverySource = 'inn-prep';
  seal.actionTimer -= dt;
  if (seal.actionTimer > 0) return;
  const fee = Math.min(safeFiniteNumber(seal.carriedG, 0, 0), getFacilityPrice(inn));
  seal.carriedG -= fee;
  addPlayerIncome(registerFacilityUse(inn, seal, fee));
  seal.mealCountSinceInn = 0;
  seal.gearBudget = safeFiniteNumber(seal.gearBudget, 0, 0) + safeFiniteNumber(CONFIG.facilities?.inn?.gearBudgetBonus, 0, 0);
  if (seal.type === 'visitor') seal.maxStayMs = safeFiniteNumber(seal.maxStayMs, CONFIG.visitor.maxStayMs, 0) + safeFiniteNumber(CONFIG.facilities?.inn?.stayBonusMs, 0, 0);
  addFavor(seal, CONFIG.facilities?.inn?.favorGain ?? CONFIG.seal.favorFacilityUse);
  logMessage(`${seal.name}が宿屋で旅支度を整え、${fee}G支払いました。`);
  afterVillageActivity(seal);
}

function updateResting(seal, dt) {
  const inn = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (!inn || !isFacilityUsable(inn)) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  seal.recoverySource = 'inn-prep';
  seal.actionTimer -= dt;
  if (seal.actionTimer <= 0) {
    const fee = Math.min(safeFiniteNumber(seal.carriedG, 0, 0), getFacilityPrice(inn));
    seal.carriedG -= fee;
    const income = registerFacilityUse(inn, seal, fee);
    addPlayerIncome(income);
    seal.mealCountSinceInn = 0;
    addFavor(seal, CONFIG.seal.favorFacilityUse);
    logMessage(`${seal.name}が宿屋で旅支度を整え、${fee}G支払いました。`);
    afterVillageActivity(seal);
  }
}

function handleNoUsableFacility(seal) {
  if (seal?.type === 'visitor') {
    const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
    const hpRatio = effectiveMaxHp > 0 ? safeFiniteNumber(seal.hp, 0, 0) / effectiveMaxHp : 0;
    if (hpRatio <= safeFiniteNumber(CONFIG.SEAL_RECOVERY?.seekRestHpRatio, 0.6, 0)) { startFallbackRest(seal); return; }
    logVisitorIssue(seal, 'no-usable-facility', `${seal.name}は使える施設がないため狩りへ向かいます。`);
    if (visitorShouldLeave(seal)) { seal.currentAction = '海へ帰っています'; seal.state = 'leavingToSea'; buildRouteToVillage(seal); return; }
    updateChoosingHuntArea(seal);
    return;
  }
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? seal.hp / effectiveMaxHp : 0;
  if (hpRatio <= safeFiniteNumber(CONFIG.SEAL_RECOVERY?.seekRestHpRatio, 0.6, 0)) { startFallbackRest(seal); return; }
  seal.state = 'choosingHuntArea';
}


function findFallbackRestPoint(seal) {
  const start = worldToGrid(seal?.x ?? gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY).x, seal?.y ?? gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY).y);
  const candidates = [];
  const maxRadius = 8;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let y = start.y - radius; y <= start.y + radius; y += 1) {
      for (let x = start.x - radius; x <= start.x + radius; x += 1) {
        if (Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) !== radius || !isPassableTile(x, y)) continue;
        const tile = gameState.world?.tiles?.[y]?.[x];
        const priority = roadAt(x, y) ? CONFIG.REST_PRIORITY?.road : (tile?.terrain === CONFIG.tileState.terrainLand && tile?.buildState === CONFIG.tileState.buildable && tile?.obstacle === null ? CONFIG.REST_PRIORITY?.emptyLand : Infinity);
        if (!Number.isFinite(priority)) continue;
        candidates.push({ x, y, priority, d: distance(start.x, start.y, x, y) });
      }
    }
    if (candidates.length > 0) break;
  }
  candidates.sort((a, b) => (a.priority - b.priority) || (a.d - b.d));
  return candidates[0] ? gridToWorld(candidates[0].x, candidates[0].y) : villageWanderPoint();
}

function startFallbackRest(seal) {
  if (!seal) return false;
  const point = findFallbackRestPoint(seal);
  seal.recoverySource = 'fallback-rest';
  seal.currentAction = '空き地で休んでいます';
  if (setSealDestination(seal, point, 'rest')) { seal.state = 'resting'; return true; }
  seal.target = { x: safeFiniteNumber(seal.x, point.x, 0), y: safeFiniteNumber(seal.y, point.y, 0), reason: 'rest' }; seal.path = []; seal.state = 'resting'; return true;
}

function updateFallbackResting(seal, dt) {
  if (!seal) return;
  if (seal.target && distance(seal.x, seal.y, seal.target.x, seal.target.y) > CONFIG.seal.contactDistance) { updateSealMovement(seal, dt * 1000); return; }
  seal.recoverySource = 'fallback-rest';
  seal.hp = Math.min(getSealEffectiveStats(seal).maxHp, safeFiniteNumber(seal.hp, 0, 0) + safeFiniteNumber(CONFIG.SEAL_RECOVERY?.fallbackRecoveryPerSecond, 1.5, 0) * dt);
  if (seal.hp >= getSealEffectiveStats(seal).maxHp * CONFIG.seal.restTargetRatio) { seal.recoverySource = ''; afterVillageActivity(seal); }
}

function visitorShouldLeave(seal) {
  if (seal?.type !== 'visitor') return false;
  const personality = getPersonalityConfig(seal);
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? seal.hp / effectiveMaxHp : 0;
  if (hpRatio <= personality.emergencyHpRatio) return true;
  const stayedMin = safeFiniteNumber(seal.visitTimerMs, 0, 0) >= safeFiniteNumber(seal.minStayMs, CONFIG.visitor.minStayMs, 0);
  const reachedMax = safeFiniteNumber(seal.visitTimerMs, 0, 0) >= safeFiniteNumber(seal.maxStayMs, CONFIG.visitor.maxStayMs, 0);
  const satisfied = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinFacilities
    || clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.enoughHuntsForLeave;
  return reachedMax || (stayedMin && (satisfied || seal.wantsToLeave));
}

function afterVillageActivity(seal) {
  clearSealFacilityReservation(seal);
  seal.targetId = null;
  seal.recoverySource = '';
  seal.target = null;
  seal.path = [];
  if (seal?.type === 'visitor') {
    seal.wantsToLeave = visitorShouldLeave(seal);
    if (seal.wantsToLeave) {
      seal.currentAction = '海へ帰っています';
      seal.state = 'leavingToSea';
      buildRouteToVillage(seal);
      return;
    }
    seal.wanderTimer = 0;
    seal.state = 'choosingPostHuntFacility';
    updateChoosingPostHuntFacility(seal, 0);
    return;
  }
  seal.state = 'choosingHuntArea';
}

function updateLeavingToSea(seal, dt) {
  if (!seal?.target || !Array.isArray(seal.path) || seal.path.length <= 0) {
    if (!buildRouteToVillage(seal)) { setVisitorIdleWithReason(seal, 'no-passable-route', `${seal.name}は海へ帰る経路が見つからず待機します。`); return; }
  }
  updateSealMovement(seal, dt * 1000);
}

function updateLeaving(seal, dt) { updateLeavingToSea(seal, dt); }

function persistAndRemoveVisitor(seal) {
  clearSealFacilityReservation(seal);
  if (seal?.type !== 'visitor') return;
  writeBackVisitorProfile(seal);
  logMessage(`${seal.name} が帰っていきました。`);
  gameState.seals = (gameState.seals ?? []).filter(item => item?.id !== seal.id);
  if (gameState.ui?.selectedSealId === seal.id) gameState.ui.selectedSealId = null;
}

function updateIdle(seal, dt) {
  if (seal?.type === 'resident') { seal.state = 'choosingHuntArea'; return; }
  seal.wanderTimer = Math.max(0, safeFiniteNumber(seal.wanderTimer, 0, 0) - dt);
  if (!seal.target || seal.wanderTimer <= 0 || distance(seal.x, seal.y, seal.target.x, seal.target.y) < CONFIG.seal.contactDistance) {
    setSealDestination(seal, villageWanderPoint(), 'idle');
    seal.wanderTimer = CONFIG.seal.wanderSeconds;
  }
  updateSealMovement(seal, dt * 1000);
}


function getToiletSelectionChance(seal) {
  if (!shouldUseToilet(seal)) return 0;
  const base = safeFiniteNumber(CONFIG.TOILET?.selectionWeight, 0.12, 0);
  const need = safeFiniteNumber(seal?.toiletNeed, 0, 0);
  const urgent = safeFiniteNumber(CONFIG.TOILET?.urgentThreshold, 85, 0);
  return need >= urgent ? Math.min(safeFiniteNumber(CONFIG.TOILET?.maxSelectionChance, 0.55, 0), base * safeFiniteNumber(CONFIG.TOILET?.urgentSelectionMultiplier, 3, 0)) : base;
}

function finishLifeFacilityUse(seal, facility) {
  const type = String(facility?.type ?? '');
  if (type === 'bench') useBench(seal, facility);
  else if (type === 'observationDeck') useObservationDeck(seal, facility);
  else if (type === 'sealPlaza') useSealPlaza(seal, facility);
}

function useBench(seal, facility) {
  if (!seal || !isLifeFacility(facility)) return;
  seal.recoverySource = facility.type;
  addFavor(seal, getLifeFacilityFavorGain(facility));
  registerFacilityUse(facility, seal, 0);
  logMessage(`${seal.name} がベンチで休憩しました。`);
}

function useObservationDeck(seal, facility) {
  if (!seal || !isLifeFacility(facility)) return;
  addFavor(seal, getLifeFacilityFavorGain(facility));
  registerFacilityUse(facility, seal, 0);
  logMessage(`${seal.name} が海を眺めています。`);
}

function useSealPlaza(seal, facility) {
  if (!seal || !isLifeFacility(facility)) return;
  addFavor(seal, getLifeFacilityFavorGain(facility));
  registerFacilityUse(facility, seal, 0);
  logMessage(`${seal.name} があざらし広場でのんびりしています。`);
}

function updateUsingLifeFacility(seal, facility, dt) {
  if (!seal || !isLifeFacility(facility) || !isFacilityUsable(facility)) {
    clearSealFacilityReservation(seal);
    if (seal) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; }
    return;
  }
  const slot = getReservedFacilitySlot(facility, seal);
  if (!slot) { clearSealFacilityReservation(seal); seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; return; }
  const target = facilitySlotWorldPoint(facility, slot);
  seal.x = target.x;
  seal.y = target.y;
  seal.recoverySource = facility.type;
  seal.hp = Math.min(getSealEffectiveStats(seal).maxHp, safeFiniteNumber(seal.hp, 0, 0) + getFacilityRecoveryPerSecond(facility) * dt);
  seal.actionTimer -= dt;
  if (seal.actionTimer > 0) return;
  finishLifeFacilityUse(seal, facility);
  releaseFacilitySlot(facility, seal);
  afterVillageActivity(seal);
}

function updateUsingPublicToilet(seal, facility, dt) {

  if (!seal || !isPublicToiletFacility(facility) || !isFacilityUsable(facility)) {
    if (seal) { seal.targetId = null; seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility'; }
    return;
  }
  seal.actionTimer -= dt;
  if (seal.actionTimer > 0) return;
  usePublicToilet(seal, facility);
  afterVillageActivity(seal);
}

function addFavor(seal, amount) {
  if (!seal || !Number.isFinite(Number(amount))) return;
  seal.favor = safeFiniteNumber(seal.favor, 0, 0) + amount;
}

function applyLevelUps(seal) {
  while (seal.exp >= seal.level * CONFIG.seal.levelExp) {
    seal.level += 1;
    seal.maxHp += CONFIG.seal.levelHpGain;
    seal.attack += CONFIG.seal.levelAttackGain;
    seal.hp = seal.maxHp;
    addFavor(seal, CONFIG.seal.favorLevelUp);
    logMessage(`${seal.name}がLv.${seal.level}になりました！`);
  }
}

function findFallenForRescue(seal) {
  const radius = safeFiniteNumber(CONFIG.SEAL_RECOVERY?.carrySearchRadius, 5, 0) * CONFIG.world.tile;
  return (gameState.seals ?? []).find(other => other?.id !== seal.id && other?.state === 'downed' && !isBeingCarried(other.id) && distance(seal.x, seal.y, other.x, other.y) <= radius);
}

function isBeingCarried(sealId) { return (gameState.seals ?? []).some(s => s?.rescueTargetId === sealId && s?.state === 'carryingFallenSeal'); }

function updateRescuing(seal, dt) {
  const fallen = (gameState.seals ?? []).find(s => s?.id === seal.rescueTargetId);
  if (!fallen || fallen.state !== 'downed') { seal.rescueTargetId = null; seal.state = 'choosingHuntArea'; return; }
  if (!setSealDestination(seal, { x: fallen.x, y: fallen.y }, 'rescue')) { seal.rescueTargetId = null; seal.state = 'choosingFacility'; return; } updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, fallen.x, fallen.y) <= CONFIG.seal.contactDistance) {
    seal.state = 'carryingFallenSeal';
    fallen.state = 'beingCarried'; fallen.carriedBySealId = seal.id; fallen.recoverySource = 'carried';
    seal.targetId = null;
    if (!setSealDestination(seal, getVillageEntryPoint(), 'carry')) { fallen.state = 'downed'; fallen.carriedBySealId = null; seal.rescueTargetId = null; seal.state = 'choosingFacility'; }
  }
}

function updateCarrying(seal, dt) {
  const fallen = (gameState.seals ?? []).find(s => s?.id === seal.rescueTargetId);
  if (!fallen) { seal.rescueTargetId = null; seal.state = 'choosingHuntArea'; return; }
  updateSealMovement(seal, dt * 1000 * safeFiniteNumber(CONFIG.SEAL_RECOVERY?.carryMoveSpeedMultiplier, 0.75, 0));
  fallen.x = seal.x - CONFIG.seal.spread * 0.5; fallen.y = seal.y; fallen.recoverySource = 'carried';
  if (distance(seal.x, seal.y, seal.target?.x, seal.target?.y) > CONFIG.seal.contactDistance) return;
  fallen.hp = Math.max(safeFiniteNumber(fallen.hp, 0, 0), getSealEffectiveStats(fallen).maxHp * safeFiniteNumber(CONFIG.SEAL_RECOVERY?.downedRecoveryThresholdRatio, 0.35, 0));
  fallen.carriedBySealId = null;
  fallen.recoverySource = 'carried';
  addFavor(fallen, CONFIG.seal.favorRescued);
  logMessage(`${fallen.name}を安全地点へ運びました。`);
  fallen.state = 'choosingFacility';
  fallen.target = null;
  seal.rescueTargetId = null;
  seal.state = 'choosingFacility';
  seal.target = null;
}

function buildRouteToArea(seal, areaId) {
  if (!seal) return false;
  seal.selectedHuntAreaId = String(areaId ?? 'coast');
  return setSealDestination(seal, randomHuntAreaPoint(seal.selectedHuntAreaId), 'hunt-wander');
}

function buildRouteToVillage(seal) {
  if (!seal) return false;
  const isLeavingVisitor = seal.type === 'visitor' && (seal.state === 'leaving' || seal.state === 'leavingToSea');
  const target = isLeavingVisitor ? getVisitorSeaExitPoint() : getVillageEntryPoint();
  return setSealDestination(seal, target, isLeavingVisitor ? 'leaving-sea' : 'village-route');
}

function setSealDestination(seal, worldPosition, reason) {
  if (!seal) return false;
  if (!worldPosition || !Number.isFinite(Number(worldPosition.x)) || !Number.isFinite(Number(worldPosition.y))) { seal.target = null; seal.path = []; seal.pathTargetKey = null; return false; }
  const next = { x: safeFiniteNumber(worldPosition.x, seal.x), y: safeFiniteNumber(worldPosition.y, seal.y), reason: String(reason ?? '') };
  const goal = worldToGrid(next.x, next.y);
  const key = `${goal.x},${goal.y}:${next.reason}`;
  seal.target = next;
  if (seal.pathTargetKey === key && Array.isArray(seal.path)) return true;
  const path = findPath(worldToGrid(seal.x, seal.y), goal, { seal, reason: next.reason, allowWater: ['sea-arrival', 'leaving-sea'].includes(next.reason) });
  if (Array.isArray(path)) return setSealPath(seal, path, next.reason);
  if ((CONFIG.movement.directFallbackReasons ?? []).includes(next.reason)) return setSealPath(seal, [next], `${next.reason}-direct`);
  seal.path = [];
  seal.pathTargetKey = key;
  if (!seal.warnedPathFallback) {
    seal.warnedPathFallback = true;
    logMessage(`${seal.name}は道順が見つからず待機します。`);
  }
  return false;
}

function setSealPath(seal, path, reason) {
  if (!seal) return false;
  const waypoints = (Array.isArray(path) ? path : []).filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))).map(point => ({ x: Number(point.x), y: Number(point.y) }));
  if (waypoints.length <= 0) { seal.path = []; seal.target = null; seal.pathTargetKey = null; return false; }
  seal.path = waypoints;
  seal.target = { ...waypoints[waypoints.length - 1], reason: String(reason ?? '') };
  const goal = worldToGrid(seal.target.x, seal.target.y);
  seal.pathTargetKey = `${goal.x},${goal.y}:${String(reason ?? '')}`;
  return true;
}

function updateSealMovement(seal, deltaMs) {
  if (!seal) return false;
  let remaining = CONFIG.seal.baseSpeed * (safeFiniteNumber(deltaMs, 0, 0) / 1000);
  let moved = false;
  let steps = 0;
  while (remaining > 0 && steps < CONFIG.movement.maxWaypointStepsPerFrame) {
    steps += 1;
    const waypoint = Array.isArray(seal.path) && seal.path.length > 0 ? seal.path[0] : seal.target;
    if (!waypoint) break;
    const d = distance(seal.x, seal.y, waypoint.x, waypoint.y);
    if (d <= CONFIG.movement.pathReachDistance) {
      if (Array.isArray(seal.path) && seal.path.length > 0) seal.path.shift();
      if ((!seal.path || seal.path.length <= 0) && (!seal.target || distance(seal.x, seal.y, seal.target.x, seal.target.y) <= CONFIG.seal.contactDistance)) {
        advanceSealStateAfterArrival(seal);
        return true;
      }
      continue;
    }
    const tile = worldToGrid(seal.x, seal.y);
    const speedMultiplier = roadAt(tile.x, tile.y) ? CONFIG.seal.roadSpeedMultiplier : 1;
    const stepDistance = Math.min(remaining * speedMultiplier, d);
    const dx = ((waypoint.x - seal.x) / d) * stepDistance;
    const dy = ((waypoint.y - seal.y) / d) * stepDistance;
    if (dx > 0) seal.facing = 'right';
    else if (dx < 0) seal.facing = 'left';
    seal.x += dx;
    seal.y += dy;
    remaining -= stepDistance / speedMultiplier;
    moved = true;
  }
  return moved;
}

function advanceSealStateAfterArrival(seal) {
  if (!seal) return;
  seal.path = [];
  if (seal.state === 'arriving' || seal.state === 'arrivingFromSea') {
    seal.target = null;
    seal.state = seal.type === 'visitor' ? 'choosingArrivalAction' : 'choosingFacility';
    if (seal.type === 'visitor') updateChoosingArrivalAction(seal);
    return;
  }
  if (seal.state === 'movingToHuntExit' || seal.state === 'movingToHuntArea') { seal.target = null; seal.currentAction = '探索中'; seal.state = 'hunting'; return; }
  if (seal.state === 'returningFromHunt') {
    seal.target = null;
    seal.targetId = null;
    seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingFacility';
    if (seal.type === 'visitor') updateChoosingPostHuntFacility(seal, 0);
    return;
  }
  if (seal.state === 'leaving' || seal.state === 'leavingToSea') {
    addFavor(seal, CONFIG.visitor.safeLeaveFavor);
    if (clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinFacilities || clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinHunts) {
      addFavor(seal, CONFIG.knownness.satisfyingVisitReward);
      gameState.village.knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0) + CONFIG.knownness.satisfyingVisitReward;
      unlockKnownVisitors();
    }
    persistAndRemoveVisitor(seal);
  }
}

function findPath(startTile, goalTile, options = {}) {
  return findPathWithFallback(startTile, goalTile, options);
}

function findPathWithFallback(startTile, goalTile, options = {}) {
  const maxTier = clampInteger(options?.maxFallbackTier, 0, 3, 3);
  for (let tier = 0; tier <= Math.min(2, maxTier); tier += 1) {
    const path = findPathAtFallbackTier(startTile, goalTile, { ...options, fallbackTier: tier });
    if (Array.isArray(path)) {
      if (tier > 0 && options?.seal) options.seal.lastPathFallbackTier = tier;
      return path;
    }
  }
  if (maxTier >= 3 && options?.seal) {
    const start = worldToGrid(options?.seal?.x ?? 0, options?.seal?.y ?? 0);
    const goal = { x: clampInteger(goalTile?.x, 0, CONFIG.world.cols - 1, 0), y: clampInteger(goalTile?.y, 0, CONFIG.world.rows - 1, 0) };
    const target = gridToWorld(goal.x, goal.y);
    if (options?.seal && !options.seal.warnedEmergencyFallback) {
      options.seal.warnedEmergencyFallback = true;
      logMessage(`${options.seal.name}は通常経路が見つからないため、ゆっくり移動して復帰を試みます。`);
    }
    return start.x === goal.x && start.y === goal.y ? [target] : [target];
  }
  return null;
}

function findPathAtFallbackTier(startTile, goalTile, options = {}) {
  const start = { x: clampInteger(startTile?.x, 0, CONFIG.world.cols - 1, 0), y: clampInteger(startTile?.y, 0, CONFIG.world.rows - 1, 0) };
  const goal = { x: clampInteger(goalTile?.x, 0, CONFIG.world.cols - 1, 0), y: clampInteger(goalTile?.y, 0, CONFIG.world.rows - 1, 0) };
  if (start.x === goal.x && start.y === goal.y) return [gridToWorld(goal.x, goal.y)];
  const open = [{ ...start, g: 0, f: distance(start.x, start.y, goal.x, goal.y) }];
  const came = new Map();
  const cost = new Map([[`${start.x},${start.y}`, 0]]);
  const closed = new Set();
  let visited = 0;
  while (open.length > 0 && visited < CONFIG.movement.maxPathNodes) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = `${current.x},${current.y}`;
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited += 1;
    if (current.x === goal.x && current.y === goal.y) return rebuildPath(came, start, goal).map(tile => gridToWorld(tile.x, tile.y));
    for (const dir of CONFIG.directions) {
      const next = { x: current.x + dir.dx, y: current.y + dir.dy };
      const moveCost = getTileMovementCost(next, options?.entity ?? options?.seal, options?.fallbackTier ?? 0, options);
      if (!Number.isFinite(moveCost)) continue;
      const nextKey = `${next.x},${next.y}`;
      const nextCost = (cost.get(currentKey) ?? 0) + moveCost;
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      came.set(nextKey, currentKey);
      cost.set(nextKey, nextCost);
      open.push({ ...next, g: nextCost, f: nextCost + distance(next.x, next.y, goal.x, goal.y) });
    }
  }
  return null;
}

function rebuildPath(came, start, goal) {
  const path = [];
  let key = `${goal.x},${goal.y}`;
  const startKey = `${start.x},${start.y}`;
  while (key !== startKey && came.has(key)) {
    const [x, y] = key.split(',').map(Number);
    path.unshift({ x, y });
    key = came.get(key);
  }
  return path;
}

function getTileMoveCost(tile, options = {}) {
  return getTileMovementCost(tile, options?.entity ?? options?.seal, options?.fallbackTier ?? 0, options);
}

function getTileMovementCost(tile, entity, fallbackTier = 0, options = {}) {
  const x = clampInteger(tile?.x, 0, CONFIG.world.cols - 1, -1);
  const y = clampInteger(tile?.y, 0, CONFIG.world.rows - 1, -1);
  const cell = getTile(x, y);
  if (!cell) return Infinity;
  if (cell.terrain === CONFIG.tileState.terrainWater) return options.allowWater === true ? CONFIG.movement.waterCost : Infinity;
  if (roadAt(x, y) && !isFacilityObstacle({ x, y })) return CONFIG.movement.roadCost;
  if (isFacilityObstacle({ x, y })) {
    const facility = objectAt(x, y);
    const isLifeVisitSlot = String(options?.reason ?? '') === 'lifeVisit' && isLifeFacility(facility);
    if (isLifeVisitSlot) return CONFIG.movement.buildableCost;
    const isSeal = entity && (entity.type === 'resident' || entity.type === 'visitor');
    return isSeal && fallbackTier >= 2 ? CONFIG.movement.buildableCost * 80 : Infinity;
  }
  if (cell.terrain === CONFIG.tileState.terrainOutside) return CONFIG.movement.outsideCost;
  if (cell.terrain === CONFIG.tileState.terrainLand && cell.buildState === CONFIG.tileState.buildable && cell.obstacle === null) return CONFIG.movement.buildableCost;
  if (isSoftObstacle({ x, y, tile: cell }) && fallbackTier >= 1) return CONFIG.movement.buildableCost * 16;
  return Infinity;
}

function isSoftObstacle(tile) {
  const cell = tile?.tile ?? getTile(tile?.x, tile?.y);
  if (!cell) return false;
  if (objectAt(tile?.x, tile?.y)?.kind === 'decoration') return true;
  return cell.terrain === CONFIG.tileState.terrainLand && [CONFIG.tileState.obstacleGrass, CONFIG.tileState.obstacleTree, CONFIG.tileState.obstacleRock].includes(cell.obstacle);
}

function isFacilityObstacle(tile) {
  return objectAt(tile?.x, tile?.y)?.kind === 'facility';
}

function detectSealStuck(seal) {
  if (!seal?.target || !Array.isArray(seal.path) || seal.path.length <= 0) { seal.stuckFrames = 0; seal.lastStuckX = seal?.x; seal.lastStuckY = seal?.y; return false; }
  const moved = distance(seal.x, seal.y, seal.lastStuckX ?? seal.x, seal.lastStuckY ?? seal.y);
  if (moved < 0.5) seal.stuckFrames = clampInteger(seal.stuckFrames, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  else seal.stuckFrames = 0;
  seal.lastStuckX = seal.x;
  seal.lastStuckY = seal.y;
  return clampInteger(seal.stuckFrames, 0, Number.MAX_SAFE_INTEGER, 0) > 90;
}

function rebuildPathIfStuck(seal) {
  if (!detectSealStuck(seal) || !seal?.target) return false;
  const reason = String(seal.target?.reason ?? 'unstuck');
  const previousKey = seal.pathTargetKey;
  seal.pathTargetKey = null;
  const rebuilt = setSealDestination(seal, seal.target, reason);
  seal.stuckFrames = 0;
  if (!rebuilt) seal.pathTargetKey = previousKey;
  return rebuilt;
}

function moveSealToward(seal, target, dt) {
  setSealDestination(seal, target, 'legacy');
  updateSealMovement(seal, dt * 1000);
}

function removeDefeatedMonsters() {
  if (gameState.frameTemps.toRemoveMonsters.length === 0) return;
  const ids = new Set(gameState.frameTemps.toRemoveMonsters);
  gameState.monsters = gameState.monsters.filter(m => !ids.has(m?.id));
}


function getUnlockedDungeonLevelDefs() {
  updatePermanentDungeonUnlocks(false);
  return getUnlockedDungeonDefs();
}

function updatePermanentDungeonUnlocks(announce = true) {
  gameState.dungeonProgress = normalizeDungeonProgress(gameState.dungeonProgress);
  for (const def of CONFIG.DUNGEONS?.definitions ?? []) {
    if (!gameState.dungeonProgress.unlockedDungeonIds.includes(def.id) && isDungeonUnlocked(def)) {
      gameState.dungeonProgress.unlockedDungeonIds.push(def.id);
      if (announce) logMessage(`${def.name} Lv${def.level} が攻略可能になりました！`);
    }
  }
  ensurePermanentDungeonInstances();
}

function updateDungeonUnlocks(announce = true) { updatePermanentDungeonUnlocks(announce); }

function ensurePermanentDungeonInstances() {
  gameState.dungeons = normalizeDungeons(gameState.dungeons);
  const activeByDef = new Set((gameState.dungeons ?? []).filter(dungeon => ['available', 'assembling', 'running', 'returning', 'completed'].includes(dungeon?.state)).map(dungeon => dungeon?.dungeonDefId).filter(Boolean));
  for (const def of getUnlockedDungeonDefs()) {
    if (!activeByDef.has(def.id)) gameState.dungeons.push(createDungeonInstanceFromDef(def));
  }
}

function claimFirstClearUnlocks(dungeonDef) {
  const def = typeof dungeonDef === 'string' ? getDungeonDefById(dungeonDef) : dungeonDef;
  if (!def) return false;
  gameState.dungeonProgress = normalizeDungeonProgress(gameState.dungeonProgress);
  if (gameState.dungeonProgress.firstClearRewardsClaimed?.[def.id] === true) return false;
  for (const itemId of def.firstClearUnlockItems ?? []) unlockShopItem(itemId, def.id);
  gameState.dungeonProgress.firstClearRewardsClaimed[def.id] = true;
  return true;
}

function spawnDungeon() {
  updatePermanentDungeonUnlocks(true);
  return null;
}

function updateDungeons(deltaMs) {
  gameState.dungeonProgress = normalizeDungeonProgress(gameState.dungeonProgress);
  updatePermanentDungeonUnlocks(false);
  gameState.dungeons = normalizeDungeons(gameState.dungeons);
  for (const dungeon of [...(gameState.dungeons ?? [])]) {
    if (dungeon?.state === 'assembling') updateAssemblingDungeon(dungeon, deltaMs);
    else if (dungeon?.state === 'running') updateRunningDungeon(dungeon, deltaMs);
    else if (dungeon?.state === 'returning') updateReturningDungeon(dungeon, deltaMs);
    else if (dungeon?.state === 'completed') dungeon.completedDisplayMs = safeFiniteNumber(dungeon.completedDisplayMs, CONFIG.dungeon?.completedDisplayMs ?? 0, 0) - safeFiniteNumber(deltaMs, 0, 0);
  }
  for (const dungeon of gameState.dungeons ?? []) {
    if (dungeon?.state === 'completed' && safeFiniteNumber(dungeon?.completedDisplayMs, 0, 0) <= 0) {
      const def = getDungeonDefById(dungeon?.dungeonDefId) ?? getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level);
      const fresh = createDungeonInstanceFromDef(def, dungeon);
      if (fresh) Object.assign(dungeon, fresh, { state: 'available', participantIds: [], expeditionLog: [], reward: normalizeDungeonReward(null), runId: '' });
    }
  }
  cleanupOrphanedExpeditions();
  ensurePermanentDungeonInstances();
  clearSelectedDungeonIfInvalid();
}

function getDungeonById(id) { return (gameState.dungeons ?? []).find(dungeon => dungeon?.id === id) ?? null; }

function selectDungeonAtWorldPosition(worldX, worldY) {
  const radius = safeFiniteNumber(CONFIG.dungeon?.clickRadius, 24, 1);
  const candidates = (gameState.dungeons ?? []).filter(dungeon => dungeon && ['available', 'assembling', 'running', 'returning', 'completed'].includes(dungeon.state)).map(dungeon => ({ dungeon, d: distance(worldX, worldY, dungeon.x, dungeon.y) })).filter(entry => entry.d <= radius).sort((a, b) => a.d - b.d);
  const selected = candidates[0]?.dungeon ?? null;
  gameState.ui.selectedDungeonId = selected?.id ?? null;
  if (selected) gameState.ui.selectedSealId = null;
  return selected;
}

function getSealPowerScore(seal) {
  const stats = getSealEffectiveStats(seal);
  return safeFiniteNumber(stats.attack, 0, 0) + safeFiniteNumber(stats.defense, 0, 0) + safeFiniteNumber(stats.maxHp, 0, 0) * 0.12 + Math.max(0, clampInteger(seal?.level, 1, Number.MAX_SAFE_INTEGER, 1) - 1) * 4;
}

function getPartyPower(participantIds) {
  return normalizeDungeonParticipantIds(participantIds).map(p => getSealById(p.sealId)).filter(Boolean).reduce((sum, seal) => sum + getSealPowerScore(seal), 0);
}

function getDungeonRecommendedPower(dungeon) {
  return safeFiniteNumber(getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level)?.recommendedPower, 0, 0);
}

function canStartDungeon(dungeon) {
  const error = getDungeonStartError(dungeon);
  return { ok: !error, reason: error || '' };
}

function getDungeonStartError(dungeon) {
  if (!dungeon || dungeon.state !== 'available') return 'このダンジョンは開始できません。';
  if (safeFiniteNumber(gameState.player?.g, 0, 0) < safeFiniteNumber(dungeon.recruitCost, 0, 0)) return 'G不足';
  if (chooseDungeonParticipants(dungeon).length < (CONFIG.dungeon?.participant?.min ?? 1)) return '参加できるあざらしがいません。';
  return '';
}

function startDungeon(dungeonId) {
  const dungeon = getDungeonById(dungeonId);
  const result = canStartDungeon(dungeon);
  if (!result.ok) {
    if (result.reason === '参加できるあざらしがいません。') logDungeonCandidateRejections(dungeon);
    logMessage(result.reason);
    markUIDirty('dungeon');
    return false;
  }
  const participants = chooseDungeonParticipants(dungeon);
  const entrance = getDungeonEntrancePoint(dungeon);
  gameState.player.g = safeFiniteNumber(gameState.player?.g, 0, 0) - safeFiniteNumber(dungeon.recruitCost, 0, 0);
  dungeon.runId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  dungeon.participantIds = participants;
  dungeon.state = 'assembling';
  dungeon.progressMs = 0;
  dungeon.currentNodeIndex = 0;
  dungeon.nodeTimerMs = 0;
  dungeon.nodes = createDungeonNodes(dungeon.typeId, dungeon.level);
  dungeon.expeditionLog = [];
  dungeon.reward = normalizeDungeonReward(null);
  dungeon.startedAt = Date.now();
  dungeon.completedAt = null;
  addDungeonLog(dungeon, `${participants.map(p => p.name).join('、')}が${dungeon.name}へ向かいます。`);
  for (const participant of participants) {
    const seal = getSealById(participant.sealId);
    assignSealToDungeon(seal, dungeon, entrance);
    incrementDungeonStat(seal, 'dungeonRuns', 1);
    const profile = seal?.profileId ? getVisitorProfileById(seal.profileId) : null;
    incrementDungeonStat(profile, 'dungeonRuns', 1);
  }
  logMessage(`${dungeon.name}の遠征を編成しました（${participants.map(p => p.name).join('、')}）。`);
  markUIDirty('dungeon');
  return true;
}

function getDungeonParticipantCandidates(dungeon) {
  const cfg = CONFIG.dungeon?.participant ?? {};
  const candidates = [];
  for (const seal of gameState.seals ?? []) {
    const eligibility = isSealEligibleForDungeon(seal, dungeon);
    if (!eligibility.ok) continue;
    const stateBonus = seal.state === 'idle' ? 14 : (['choosingHuntArea', 'choosingFacility', 'choosingArrivalAction', 'choosingPostHuntFacility'].includes(seal.state) ? 8 : 2);
    candidates.push({
      kind: 'seal',
      id: seal.id,
      sealId: seal.id,
      profileId: seal.profileId,
      name: seal.name,
      score: getSealPowerScore(seal) + safeFiniteNumber(seal.favor, 0, 0) * 3 + stateBonus + (cfg.personalityBonus?.[seal.personality] ?? 0) + (seal.type === 'resident' ? cfg.residentBonus : cfg.activeSealBonus)
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function chooseDungeonParticipants(dungeon) {
  const max = clampInteger(CONFIG.dungeon?.participant?.max, 1, Number.MAX_SAFE_INTEGER, 3);
  return getDungeonParticipantCandidates(dungeon).slice(0, max).map(({ score, ...participant }) => participant);
}

function isSealEligibleForDungeon(seal, dungeon) {
  if (!seal) return { ok: false, reason: 'missing' };
  if (!dungeon) return { ok: false, reason: 'noDungeon' };
  if (!['resident', 'visitor'].includes(seal.type)) return { ok: false, reason: 'notRecruitable' };
  if (safeFiniteNumber(seal.hp, 0, 0) <= 0 || ['fallen', 'downed', 'beingCarried'].includes(seal.state)) return { ok: false, reason: 'fallen' };
  const maxHp = Math.max(1, safeFiniteNumber(getSealEffectiveStats(seal)?.maxHp, seal.maxHp, 1));
  const minHpRatio = safeFiniteNumber(CONFIG.dungeon?.participant?.minHpRatio, CONFIG.seal?.lowHpRatio ?? 0.4, 0);
  if (safeFiniteNumber(seal.hp, 0, 0) / maxHp < minHpRatio) return { ok: false, reason: 'hpLow' };
  const activeDungeonIds = new Set((gameState.dungeons ?? []).filter(d => d?.id !== dungeon?.id && ['assembling', 'running', 'returning'].includes(d?.state)).flatMap(d => normalizeDungeonParticipantIds(d?.participantIds)).map(p => p.sealId).filter(Boolean));
  if (seal.expeditionId || seal.questingDungeonId || activeDungeonIds.has(seal.id) || ['movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon', 'questing'].includes(seal.state)) return { ok: false, reason: 'alreadyExpedition' };
  if (seal.state === 'fighting') return { ok: false, reason: 'fighting' };
  if (seal.state === 'carryingFallenSeal') return { ok: false, reason: 'carryingFallen' };
  if (isBeingCarried(seal.id)) return { ok: false, reason: 'beingCarried' };
  if (seal.state === 'leaving' || seal.state === 'leavingToSea' || seal.wantsToLeave === true) return { ok: false, reason: 'leaving' };
  if (seal.state === 'rescuing') return { ok: false, reason: 'rescuing' };
  return { ok: true, reason: 'valid' };
}

function clearSealCurrentTaskForExpedition(seal) {
  if (!seal) return;
  clearSealFacilityReservation(seal);
  const targetId = seal.targetId ? String(seal.targetId) : null;
  if (targetId) {
    const monster = (gameState.monsters ?? []).find(item => item?.id === targetId);
    if (monster?.assignedSealId === seal.id) monster.assignedSealId = null;
  }
  seal.targetId = null;
  seal.target = null;
  seal.path = [];
  seal.pathTargetKey = null;
  seal.selectedHuntAreaId = null;
  seal.rescueTargetId = null;
  seal.actionTimer = 0;
  seal.combatTimer = 0;
  seal.monsterTimer = 0;
  seal.huntTimer = 0;
  seal.noMonsterTimer = 0;
  seal.wanderTimer = 0;
}

function assignSealToDungeon(seal, dungeon, entrance = getDungeonEntrancePoint(dungeon)) {
  if (!seal || !dungeon) return false;
  seal.questingReturnState = seal.state;
  clearSealCurrentTaskForExpedition(seal);
  seal.questingDungeonId = dungeon.id;
  seal.expeditionId = dungeon.id;
  seal.state = 'movingToDungeon';
  seal.currentAction = `${dungeon.name}へ集合中`;
  setSealDestination(seal, entrance, 'dungeon-entrance');
  return true;
}

function logDungeonCandidateRejections(dungeon) {
  const activeSeals = (gameState.seals ?? []).filter(seal => seal?.type === 'resident' || seal?.type === 'visitor');
  const details = activeSeals.map(seal => `${seal?.name ?? 'unknown'}=${isSealEligibleForDungeon(seal, dungeon).reason}`).join(', ') || 'none';
  console.debug(`Dungeon candidates rejected: total=${activeSeals.length}; ${details}`);
}

function updateAssemblingDungeon(dungeon) {
  if (!dungeon || dungeon.state !== 'assembling') return;
  const participants = normalizeDungeonParticipantIds(dungeon.participantIds).map(p => getSealById(p.sealId)).filter(Boolean);
  if (participants.length <= 0) { abortDungeon(dungeon, '参加者が見つからないため遠征を中止しました。'); return; }
  const entrance = getDungeonEntrancePoint(dungeon);
  for (const seal of participants) {
    if (seal.expeditionId !== dungeon.id) seal.expeditionId = dungeon.id;
    if (seal.state === 'movingToDungeon') {
      if (!seal.target || distance(seal.x, seal.y, entrance.x, entrance.y) > CONFIG.seal.contactDistance) setSealDestination(seal, entrance, 'dungeon-entrance');
      if (distance(seal.x, seal.y, entrance.x, entrance.y) <= CONFIG.seal.contactDistance) {
        seal.state = 'waitingAtDungeon';
        seal.path = [];
        seal.currentAction = `${dungeon.name}入口で待機中`;
        addDungeonLog(dungeon, `${seal.name}が入口に到着した。`);
      }
    }
  }
  if (participants.every(seal => seal.state === 'waitingAtDungeon' || seal.state === 'expeditionRunning')) beginDungeonRun(dungeon, participants);
}

function beginDungeonRun(dungeon, participants) {
  dungeon.state = 'running';
  dungeon.nodeTimerMs = 0;
  dungeon.currentNodeIndex = clampInteger(dungeon.currentNodeIndex, 0, Math.max(0, (dungeon.nodes ?? []).length - 1), 0);
  dungeon.startedAt = dungeon.startedAt || Date.now();
  for (const seal of participants ?? []) {
    seal.state = 'expeditionRunning';
    seal.currentAction = `${dungeon.name}を探索中`;
    seal.path = [];
    seal.target = null;
  }
  addDungeonLog(dungeon, `${dungeon.name}の内部探索を開始しました。`);
}

function updateRunningDungeon(dungeon, deltaMs) {
  if (!dungeon || dungeon.state !== 'running') return;
  const participants = normalizeDungeonParticipantIds(dungeon.participantIds).map(p => getSealById(p.sealId)).filter(Boolean);
  if (participants.length <= 0) { abortDungeon(dungeon, '参加者がいなくなったため遠征を中止しました。'); return; }
  for (const seal of participants) {
    seal.expeditionId = dungeon.id;
    seal.questingDungeonId = dungeon.id;
    seal.state = 'expeditionRunning';
    seal.currentAction = `${dungeon.name}を探索中`;
  }
  const nodes = Array.isArray(dungeon.nodes) && dungeon.nodes.length > 0 ? dungeon.nodes : createDungeonNodes(dungeon.typeId, dungeon.level);
  dungeon.nodes = nodes;
  const node = nodes[clampInteger(dungeon.currentNodeIndex, 0, Math.max(0, nodes.length - 1), 0)];
  if (!node) { completeDungeon(dungeon); return; }
  const speed = getDungeonPartySpeed(participants);
  dungeon.nodeTimerMs = safeFiniteNumber(dungeon.nodeTimerMs, 0, 0) + safeFiniteNumber(deltaMs, 0, 0) * speed;
  dungeon.progressMs = nodes.slice(0, dungeon.currentNodeIndex).reduce((sum, item) => sum + safeFiniteNumber(item?.durationMs, 0, 0), 0) + Math.min(safeFiniteNumber(node.durationMs, 1, 1), dungeon.nodeTimerMs);
  if (dungeon.nodeTimerMs >= safeFiniteNumber(node.durationMs, 1, 1)) resolveDungeonNode(dungeon, node, participants);
}

function resolveDungeonNode(dungeon, node, participants) {
  if (!dungeon || !node) return;
  const lead = chooseNodeLeadParticipant(participants, node.type);
  const rewardPart = calculateNodeRewardPart(dungeon, node, participants);
  node.rewardPart = rewardPart;
  dungeon.reward = mergeDungeonReward(dungeon.reward, rewardPart);
  const logText = buildDungeonNodeLog(dungeon, node, lead, rewardPart);
  node.logText = logText;
  node.resolved = true;
  addDungeonLog(dungeon, logText);
  applyDungeonNodeEffects(node, participants);
  dungeon.currentNodeIndex = clampInteger(dungeon.currentNodeIndex, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  dungeon.nodeTimerMs = 0;
  if (dungeon.currentNodeIndex >= (dungeon.nodes ?? []).length) completeDungeon(dungeon);
}

function completeDungeon(dungeon) {
  if (!dungeon || dungeon.state !== 'running') return;
  const levelDef = getDungeonDefById(dungeon.dungeonDefId) ?? getDungeonLevelDef(dungeon.typeId ?? dungeon.type, dungeon.level);
  const baseReward = { g: safeFiniteNumber(levelDef?.rewardG, 0, 0), exp: safeFiniteNumber(levelDef?.rewardExp, 0, 0), knownness: safeFiniteNumber(levelDef?.rewardKnownness, 0, 0), items: [] };
  dungeon.reward = mergeDungeonReward(baseReward, dungeon.reward);
  const power = getPartyPower(dungeon.participantIds);
  const recommended = getDungeonRecommendedPower(dungeon);
  if (recommended > 0 && power < recommended) {
    const multiplier = safeFiniteNumber(CONFIG.dungeon?.outcome?.lowPowerRewardMultiplier, 0.65, 0.1);
    dungeon.reward.g = Math.floor(dungeon.reward.g * multiplier);
    dungeon.reward.exp = Math.floor(dungeon.reward.exp * multiplier);
    dungeon.reward.knownness = Math.floor(dungeon.reward.knownness * multiplier);
    addDungeonLog(dungeon, `推奨戦力不足のため報酬が少し減りました（戦力${Math.floor(power)}/${Math.floor(recommended)}）。`);
  }
  dungeon.completedAt = Date.now();
  claimFirstClearUnlocks(levelDef);
  gameState.player.g = safeFiniteNumber(gameState.player?.g, 0, 0) + safeFiniteNumber(dungeon.reward.g, 0, 0);
  gameState.stats.monthlyPlayerIncome = safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0) + safeFiniteNumber(dungeon.reward.g, 0, 0);
  gameState.village.knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0) + safeFiniteNumber(dungeon.reward.knownness, 0, 0);
  gameState.dungeonProgress = normalizeDungeonProgress(gameState.dungeonProgress);
  incrementDungeonClearCount(levelDef?.id ?? dungeon.dungeonDefId);
  const participants = normalizeDungeonParticipantIds(dungeon.participantIds).map(p => getSealById(p.sealId)).filter(Boolean);
  for (const seal of participants) {
    seal.exp = safeFiniteNumber(seal.exp, 0, 0) + safeFiniteNumber(dungeon.reward.exp, 0, 0);
    addFavor(seal, CONFIG.dungeon?.participant?.clearFavor ?? 2);
    incrementDungeonStat(seal, 'dungeonClears', 1);
    applyLevelUps(seal);
    if (seal.type === 'visitor') writeBackVisitorProfile(seal);
    const profile = seal.profileId ? getVisitorProfileById(seal.profileId) : null;
    if (profile) addDungeonRewardToProfile(profile, dungeon.reward.exp, CONFIG.dungeon?.participant?.clearFavor ?? 2);
    seal.state = 'returningFromDungeon';
    seal.currentAction = `${dungeon.name}から帰還中`;
    setSealDestination(seal, getDungeonReturnPoint(seal), 'dungeon-return');
  }
  dungeon.state = 'returning';
  dungeon.completedDisplayMs = CONFIG.dungeon?.returnDisplayMs ?? CONFIG.dungeon?.completedDisplayMs ?? 0;
  addDungeonLog(dungeon, `攻略完了！ ${Math.floor(dungeon.reward.g)}G / EXP${Math.floor(dungeon.reward.exp)} / 知名度+${Math.floor(dungeon.reward.knownness)}を獲得。`);
  unlockKnownVisitors();
  updateDungeonUnlocks(true);
  logMessage(`${dungeon.name}を攻略完了！ ${Math.floor(dungeon.reward.g)}G / EXP${Math.floor(dungeon.reward.exp)} / 知名度+${Math.floor(dungeon.reward.knownness)}`);
  updateHud();
}

function updateReturningDungeon(dungeon, deltaMs) {
  if (!dungeon || dungeon.state !== 'returning') return;
  dungeon.completedDisplayMs = safeFiniteNumber(dungeon.completedDisplayMs, CONFIG.dungeon?.returnDisplayMs ?? 0, 0) - safeFiniteNumber(deltaMs, 0, 0);
  const returningSeals = getDungeonParticipantSeals(dungeon).filter(seal => isSealStillOnDungeonExpedition(seal, dungeon));
  if (returningSeals.length <= 0) { markDungeonReturned(dungeon); return; }
  for (const seal of returningSeals) {
    if (seal.state !== 'returningFromDungeon') seal.state = 'returningFromDungeon';
    seal.expeditionId = dungeon.id;
    seal.questingDungeonId = dungeon.id;
    if (!seal.target) setSealDestination(seal, getDungeonReturnPoint(seal), 'dungeon-return');
    if (distance(seal.x, seal.y, seal.target?.x ?? seal.x, seal.target?.y ?? seal.y) <= CONFIG.seal.contactDistance && (!seal.path || seal.path.length <= 0)) finishSealDungeonReturn(seal, dungeon);
  }
  if (getDungeonParticipantSeals(dungeon).every(seal => !isSealStillOnDungeonExpedition(seal, dungeon))) markDungeonReturned(dungeon);
}

function getDungeonParticipantSeals(dungeon) {
  return normalizeDungeonParticipantIds(dungeon?.participantIds).map(participant => getSealById(participant.sealId)).filter(Boolean);
}

function isSealStillOnDungeonExpedition(seal, dungeon) {
  if (!seal || !dungeon) return false;
  if (seal.expeditionId === dungeon.id || seal.questingDungeonId === dungeon.id) return true;
  return ['movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon', 'questing'].includes(seal.state) && normalizeDungeonParticipantIds(dungeon.participantIds).some(participant => participant.sealId === seal.id);
}

function markDungeonReturned(dungeon) {
  if (!dungeon || dungeon.state === 'completed') return;
  dungeon.state = 'completed';
  dungeon.currentNodeIndex = Array.isArray(dungeon.nodes) ? dungeon.nodes.length : safeFiniteNumber(dungeon.currentNodeIndex, 0, 0);
  dungeon.completedDisplayMs = CONFIG.dungeon?.completedDisplayMs ?? 0;
  addDungeonLog(dungeon, '参加したあざらしが村や岸辺へ戻りました。');
}

function finishSealDungeonReturn(seal, dungeon) {
  if (!seal) return;
  seal.expeditionId = null;
  seal.questingDungeonId = null;
  seal.questingReturnState = null;
  seal.path = [];
  seal.target = null;
  seal.currentAction = `${dungeon?.name ?? '遠征'}から帰還しました`;
  seal.state = seal.type === 'visitor' ? 'choosingPostHuntFacility' : 'choosingHuntArea';
}

function addDungeonRewardToProfile(profile, rewardExp, rewardFavor) {
  if (!profile) return;
  profile.exp = safeFiniteNumber(profile.exp, 0, 0) + safeFiniteNumber(rewardExp, 0, 0);
  profile.favor = safeFiniteNumber(profile.favor, 0, 0) + safeFiniteNumber(rewardFavor, 0, 0);
  while (safeFiniteNumber(profile.exp, 0, 0) >= clampInteger(profile.level, 1, Number.MAX_SAFE_INTEGER, 1) * CONFIG.seal.levelExp) {
    profile.level = clampInteger(profile.level, 1, Number.MAX_SAFE_INTEGER, 1) + 1;
    profile.favor = safeFiniteNumber(profile.favor, 0, 0) + CONFIG.seal.favorLevelUp;
    logMessage(`${profile.name}がLv.${profile.level}になりました！`);
  }
}

function createDungeonNodes(typeId, level) {
  const def = (CONFIG.DUNGEONS?.definitions ?? []).find(item => item?.typeId === String(typeId ?? '') && clampInteger(item?.level, 1, Number.MAX_SAFE_INTEGER, 1) === clampInteger(level, 1, Number.MAX_SAFE_INTEGER, 1));
  return normalizeDungeonNodes(null, def ?? getDungeonLevelDef(typeId, level));
}

function rollDungeonDrop(dungeon) {
  const table = getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level)?.dropTable ?? [];
  if (table.length <= 0) return [];
  const total = table.reduce((sum, entry) => sum + Math.max(0, safeFiniteNumber(entry?.weight, 0, 0)), 0);
  let roll = Math.random() * Math.max(total, 1);
  for (const entry of table) {
    roll -= Math.max(0, safeFiniteNumber(entry?.weight, 0, 0));
    if (roll <= 0) return [{ itemId: String(entry.itemId), count: clampInteger(entry.count, 1, Number.MAX_SAFE_INTEGER, 1) }].filter(item => getItemDef(item.itemId));
  }
  const fallback = table[0];
  return fallback ? [{ itemId: String(fallback.itemId), count: clampInteger(fallback.count, 1, Number.MAX_SAFE_INTEGER, 1) }].filter(item => getItemDef(item.itemId)) : [];
}

function getDungeonEntrancePoint(dungeon) {
  return { x: safeFiniteNumber(dungeon?.x, gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY).x), y: safeFiniteNumber(dungeon?.y, gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY).y) + 18 };
}

function getDungeonReturnPoint(seal) {
  return seal?.type === 'visitor' ? getVisitorShoreLandingPoint() : getVillageEntryPoint();
}

function addDungeonLog(dungeon, text) {
  if (!dungeon) return;
  const max = clampInteger(CONFIG.dungeon?.logMax, 1, Number.MAX_SAFE_INTEGER, 8);
  dungeon.expeditionLog = normalizeDungeonLog([String(text), ...(dungeon.expeditionLog ?? [])]).slice(0, max);
}

function getDungeonPartySpeed(participants) {
  const list = (participants ?? []).filter(Boolean);
  if (list.length <= 0) return 1;
  const speeds = list.map(seal => safeFiniteNumber(CONFIG.dungeon?.progressSpeedByPersonality?.[seal?.personality], 1, 0.1));
  return speeds.reduce((sum, value) => sum + value, 0) / Math.max(1, speeds.length);
}

function chooseNodeLeadParticipant(participants, nodeType) {
  const list = (participants ?? []).filter(Boolean);
  if (list.length <= 0) return null;
  const sorted = [...list].sort((a, b) => getNodeContributionScore(b, nodeType) - getNodeContributionScore(a, nodeType));
  return sorted[0] ?? list[0];
}

function getNodeContributionScore(seal, nodeType) {
  const stats = getSealEffectiveStats(seal);
  const personality = seal?.personality ?? 'balanced';
  const cautious = personality === 'cautious' ? 8 : 0;
  const brave = personality === 'brave' ? 8 : 0;
  if (nodeType === 'trap') return safeFiniteNumber(stats.defense, 0, 0) + cautious;
  if (nodeType === 'battle' || nodeType === 'boss') return safeFiniteNumber(stats.attack, 0, 0) + brave;
  return safeFiniteNumber(seal?.favor, 0, 0) + (personality === 'balanced' ? 4 : 0);
}

function calculateNodeRewardPart(dungeon, node) {
  const levelDef = getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level);
  const outcome = CONFIG.dungeon?.outcome ?? {};
  const multiplier = node?.type === 'chest' ? outcome.rewardChestMultiplier : node?.type === 'boss' ? outcome.rewardBossMultiplier : node?.type === 'battle' ? outcome.rewardBattleMultiplier : node?.type === 'trap' ? -outcome.rewardTrapPenaltyMultiplier : 0;
  return normalizeDungeonReward({
    g: Math.max(0, Math.round(safeFiniteNumber(levelDef?.rewardG, 0, 0) * safeFiniteNumber(multiplier, 0, -1))),
    exp: Math.max(0, Math.round((node?.type === 'battle' || node?.type === 'boss') ? safeFiniteNumber(outcome.expBattleBonus, 0, 0) : 0)),
    knownness: 0,
    items: []
  });
}

function mergeDungeonReward(a, b) {
  const left = normalizeDungeonReward(a);
  const right = normalizeDungeonReward(b);
  const counts = new Map();
  for (const item of [...(left.items ?? []), ...(right.items ?? [])]) counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + clampInteger(item.count, 1, Number.MAX_SAFE_INTEGER, 1));
  return { g: left.g + right.g, exp: left.exp + right.exp, knownness: left.knownness + right.knownness, items: [...counts.entries()].map(([itemId, count]) => ({ itemId, count })).filter(item => getItemDef(item.itemId)) };
}

function buildDungeonNodeLog(dungeon, node, lead, rewardPart) {
  const name = lead?.name ?? CONFIG.dungeon?.labels?.noParticipants ?? 'あざらし';
  const itemText = (rewardPart?.items ?? []).map(item => getItemDef(item.itemId)?.name ?? item.itemId).join('、');
  const templates = {
    entrance: `${name}が入口を調べて進路を確認した`,
    battle: `${name}がカニの群れを追い払った`,
    chest: itemText ? `${itemText}を発見した` : '宝箱を発見した',
    trap: `${name}が罠を慎重に避けた`,
    boss: `${name}たちが最奥の強敵を撃退した`,
    exit: `${name}が出口の光を見つけた`
  };
  return templates[node?.type] ?? `${name}が探索を進めた`;
}

function applyDungeonNodeEffects(node, participants) {
  const outcome = CONFIG.dungeon?.outcome ?? {};
  for (const seal of participants ?? []) {
    if (!seal) continue;
    if (node?.type === 'battle' || node?.type === 'boss') {
      const damage = safeFiniteNumber(outcome.battleDamage, 0, 0) + (seal.personality === 'brave' ? safeFiniteNumber(outcome.braveDamageBonus, 0, 0) : 0);
      seal.hp = Math.max(1, safeFiniteNumber(seal.hp, CONFIG.seal.maxHp, 0) - damage);
      incrementDungeonStat(seal, 'dungeonBattles', 1);
      const profile = seal.profileId ? getVisitorProfileById(seal.profileId) : null;
      incrementDungeonStat(profile, 'dungeonBattles', 1);
    }
    if (node?.type === 'trap') {
      const reduction = seal.personality === 'cautious' ? safeFiniteNumber(outcome.cautiousTrapDamageReduction, 0, 0) : 0;
      seal.hp = Math.max(1, safeFiniteNumber(seal.hp, CONFIG.seal.maxHp, 0) - Math.max(0, safeFiniteNumber(outcome.trapDamage, 0, 0) - reduction));
    }
    if (node?.type === 'chest') {
      incrementDungeonStat(seal, 'chestsOpened', 1);
      const profile = seal.profileId ? getVisitorProfileById(seal.profileId) : null;
      incrementDungeonStat(profile, 'chestsOpened', 1);
    }
  }
}

function incrementDungeonStat(target, key, amount) {
  if (!target || !['dungeonRuns', 'dungeonClears', 'dungeonBattles', 'chestsOpened'].includes(key)) return;
  target[key] = clampInteger(target[key], 0, Number.MAX_SAFE_INTEGER, 0) + clampInteger(amount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function abortDungeon(dungeon, reason) {
  if (!dungeon) return;
  addDungeonLog(dungeon, reason);
  for (const participant of normalizeDungeonParticipantIds(dungeon.participantIds)) {
    const seal = getSealById(participant.sealId);
    if (seal) clearSealExpeditionState(seal);
  }
  dungeon.state = 'expired';
  dungeon.completedDisplayMs = CONFIG.dungeon?.completedDisplayMs ?? 0;
  logMessage(`${dungeon.name}: ${reason}`);
}

function cleanupOrphanedExpeditions() {
  const activeIds = new Set((gameState.dungeons ?? []).filter(d => ['assembling', 'running', 'returning'].includes(d?.state)).map(d => d.id));
  for (const seal of gameState.seals ?? []) if (seal?.expeditionId && !activeIds.has(seal.expeditionId)) clearSealExpeditionState(seal);
}

function expireDungeon(dungeon) {
  if (!dungeon || dungeon.state !== 'available') return;
  dungeon.state = 'expired';
  dungeon.completedDisplayMs = CONFIG.dungeon?.completedDisplayMs ?? 0;
  logMessage(`${dungeon.name}は潮に隠れて消えました。`);
}

function getDungeonRewardPreview(dungeon) {
  const levelDef = getDungeonDefById(dungeon?.dungeonDefId) ?? getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level);
  return { g: safeFiniteNumber(levelDef?.rewardG, 0, 0), exp: safeFiniteNumber(levelDef?.rewardExp, 0, 0), knownness: safeFiniteNumber(levelDef?.rewardKnownness, 0, 0), itemIds: (levelDef?.firstClearUnlockItems ?? []).map(String).filter(id => getItemDef(id)) };
}

function clearSelectedDungeonIfInvalid() {
  const selected = getDungeonById(gameState.ui?.selectedDungeonId);
  if (!selected || ['expired'].includes(selected.state)) gameState.ui.selectedDungeonId = null;
}
