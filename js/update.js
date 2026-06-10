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
  updateSeals(dt);
  removeDefeatedMonsters();
  updateAutoSave(safeDeltaMs);
  gameState.timers.ui += dt;
  if (gameState.timers.ui >= CONFIG.timing.uiMs / 1000) {
    gameState.ui.needsHudUpdate = true;
    gameState.timers.ui = 0;
  }
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

function addPlayerIncome(amount) {
  const value = safeFiniteNumber(amount, 0, 0);
  gameState.player.g = safeFiniteNumber(gameState.player?.g, 0, 0) + value;
  gameState.stats.monthlyPlayerIncome = safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0) + value;
}

function unlockKnownVisitors() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0);
  for (const profile of gameState.visitorProfiles ?? []) {
    if (!profile || profile.unlocked || knownness < safeFiniteNumber(profile.unlockedAtKnownness, 0, 0)) continue;
    profile.unlocked = true;
    logMessage(`${profile.name}が村を知りました。`);
  }
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
  gameState.monsters.push({ id: `crab-${Date.now()}-${Math.random().toString(16).slice(2)}`, type: 'crab', areaId: 'coast', x: p.x, y: p.y, hp: CONFIG.monster.hp, maxHp: CONFIG.monster.hp, attack: CONFIG.monster.attack, defense: CONFIG.monster.defense, assignedSealId: null, assetKey: 'monsters.crab', facing: 'left' });
}

function updateVisitorSpawner(dt) {
  const activeVisitors = (gameState.seals ?? []).filter(seal => seal?.type === 'visitor').length;
  if (activeVisitors >= CONFIG.visitor.maxActive) return;
  const totalFavor = (gameState.visitorProfiles ?? []).reduce((sum, profile) => sum + safeFiniteNumber(profile?.favor, 0, 0), 0);
  const intervalMultiplier = Math.max(CONFIG.visitor.minSpawnIntervalMultiplier, 1 - totalFavor * CONFIG.visitor.spawnIntervalFavorReduction);
  const interval = CONFIG.visitor.spawnInterval * intervalMultiplier;
  gameState.timers.visitorSpawn = safeFiniteNumber(gameState.timers?.visitorSpawn, 0, 0) + dt;
  if (gameState.timers.visitorSpawn < interval) return;
  gameState.timers.visitorSpawn = 0;
  spawnVisitor();
}

function chooseUnlockedVisitorProfile() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  const activeIds = new Set((gameState.seals ?? []).filter(seal => seal?.type === 'visitor').map(seal => seal.profileId));
  const candidates = (gameState.visitorProfiles ?? []).filter(profile => profile && knownness >= safeFiniteNumber(profile.unlockedAtKnownness, 0, 0));
  const available = candidates.filter(profile => !activeIds.has(profile.id));
  const pool = available.length > 0 ? available : candidates;
  const weighted = pool.map(profile => ({
    profile,
    weight: CONFIG.visitor.returnBaseWeight
      + safeFiniteNumber(profile?.favor, 0, 0) * CONFIG.visitor.returnFavorWeight
      + (activeIds.has(profile?.id) ? 0 : CONFIG.visitor.inactiveWeightBonus)
  }));
  const total = weighted.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let roll = Math.random() * Math.max(total, 1);
  for (const item of weighted) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) return item.profile;
  }
  return weighted[0]?.profile ?? null;
}

function spawnVisitorFromProfile(profile) {
  if (!profile) return null;
  const preferred = getVisitorPreferredSpawnPoint();
  const start = findNearestPassableSpawnPoint(preferred);
  if (!start) {
    if (!gameState.warnings?.visitorSpawnBlocked) {
      gameState.warnings = gameState.warnings ?? {};
      gameState.warnings.visitorSpawnBlocked = true;
      logMessage('訪問者の入口が水上または通行不能なため、今回は来訪を見送りました。');
    }
    return null;
  }
  gameState.warnings = gameState.warnings ?? {};
  gameState.warnings.visitorSpawnBlocked = false;
  profile.visits = clampInteger(profile.visits, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  profile.unlocked = true;
  const base = profile.baseStats ?? {};
  const favorBonus = Math.min(CONFIG.visitor.maxStayFavorBonusMs, safeFiniteNumber(profile.favor, 0, 0) * CONFIG.visitor.maxStayFavorMsPerFavor);
  const visitor = normalizeSeal({
    id: `visitor-${profile.id}-${Date.now()}`,
    profileId: profile.id,
    name: profile.name,
    personality: profile.personality,
    type: 'visitor',
    assetKey: assetKeyForVisitorProfile(profile.id),
    facing: 'left',
    x: start.x,
    y: start.y,
    hp: safeFiniteNumber(base.maxHp, CONFIG.seal.maxHp, 1),
    maxHp: safeFiniteNumber(base.maxHp, CONFIG.seal.maxHp, 1) + Math.max(0, profile.level - 1) * CONFIG.seal.levelHpGain,
    attack: safeFiniteNumber(base.attack, CONFIG.seal.attack, 0) + Math.max(0, profile.level - 1) * CONFIG.seal.levelAttackGain,
    defense: safeFiniteNumber(base.defense, CONFIG.seal.defense, 0),
    carriedG: 0,
    exp: profile.exp,
    level: profile.level,
    favor: profile.favor,
    visits: profile.visits,
    state: 'arriving',
    minStayMs: CONFIG.visitor.minStayMs,
    maxStayMs: CONFIG.visitor.maxStayMs + favorBonus
  }, gameState.seals.length);
  visitor.hp = visitor.maxHp;
  gameState.seals.push(visitor);
  logMessage(`${visitor.name}が南の入口から歩いて訪れました。`);
  return visitor;
}

function spawnVisitor() {
  return spawnVisitorFromProfile(chooseUnlockedVisitorProfile());
}

function writeBackVisitorProfile(seal) {
  if (seal?.type !== 'visitor') return;
  const profile = getVisitorProfileById(seal.profileId);
  if (!profile) return;
  profile.level = clampInteger(seal.level, 1, Number.MAX_SAFE_INTEGER, profile.level);
  profile.exp = safeFiniteNumber(seal.exp, profile.exp, 0);
  profile.favor = safeFiniteNumber(seal.favor, profile.favor, 0);
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
  const hpRatio = seal?.maxHp > 0 ? seal.hp / seal.maxHp : 0;
  if (hpRatio <= personality.emergencyHpRatio) return true;
  const huntCount = clampInteger(seal?.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0);
  if (huntCount >= personality.maxHuntsPerTrip) return true;
  const favorBonus = Math.min(CONFIG.seal.maxFavorHuntDurationBonus, safeFiniteNumber(seal?.favor, 0, 0) * CONFIG.seal.favorHuntDurationBonus);
  const durationLimit = CONFIG.seal.huntDurationLimit + (seal?.type === 'visitor' ? favorBonus : 0);
  if (safeFiniteNumber(seal?.huntTimer, 0, 0) >= durationLimit) return true;
  if (safeFiniteNumber(seal?.noMonsterTimer, 0, 0) >= CONFIG.seal.noMonsterExploreSeconds && huntCount > 0) return true;
  if (huntCount < personality.preferredMinHunts && hpRatio > personality.returnHpRatio) return false;
  if (hpRatio <= personality.returnHpRatio && Math.random() < personality.returnChance) return true;
  if (safeFiniteNumber(seal?.carriedG, 0, 0) >= CONFIG.seal.carriedGReturnThreshold && Math.random() < CONFIG.seal.carriedGReturnChance) return true;
  return false;
}

function chooseNextHuntTarget(seal) {
  return claimNearestMonster(seal, seal?.selectedHuntAreaId ?? 'coast');
}

function updateSeals(dt) {
  ensureResidentSeal();
  for (const seal of [...(gameState.seals ?? [])]) {
    if (!seal) continue;
    if (seal.type === 'visitor') seal.visitTimerMs = safeFiniteNumber(seal.visitTimerMs, 0, 0) + dt * 1000;
    if (seal.state === 'fallen') { updateFallen(seal, dt); continue; }
    const fallen = findFallenForRescue(seal);
    if (fallen && !seal.rescueTargetId && seal.hp > seal.maxHp * CONFIG.seal.lowHpRatio) {
      seal.state = 'rescuing'; seal.rescueTargetId = fallen.id; seal.target = { x: fallen.x, y: fallen.y }; logMessage(`${seal.name}が${fallen.name}を救助に向かいました。`);
    }
    switch (seal.state) {
      case 'arriving': updateArriving(seal); break;
      case 'choosingHuntArea': updateChoosingHuntArea(seal); break;
      case 'movingToHuntExit': updateMovingToHuntExit(seal, dt); break;
      case 'hunting': updateHunting(seal, dt); break;
      case 'movingToMonster': updateMovingToMonster(seal, dt); break;
      case 'fighting': updateFighting(seal, dt); break;
      case 'returningFromHunt': updateReturningFromHunt(seal, dt); break;
      case 'choosingFacility': updateChoosingFacility(seal, dt); break;
      case 'movingToFacility': updateMovingToFacility(seal, dt); break;
      case 'usingFacility': updateUsingFacility(seal, dt); break;
      case 'leaving': updateLeaving(seal, dt); break;
      case 'idle': updateIdle(seal, dt); break;
      case 'rescuing': updateRescuing(seal, dt); break;
      case 'carryingFallenSeal': updateCarrying(seal, dt); break;
      default: seal.state = seal.type === 'visitor' ? 'arriving' : 'choosingHuntArea'; seal.target = null; break;
    }
  }
}

function updateFallen(seal, dt) {
  seal.hp = Math.min(seal.maxHp, seal.hp + CONFIG.seal.fallenRecoveryPerSecond * dt);
  if (seal.hp >= seal.maxHp * CONFIG.seal.standHpRatio && !isBeingCarried(seal.id)) {
    seal.state = 'returningFromHunt';
    buildRouteToVillage(seal);
    logMessage(`${seal.name}が自力で起き上がりました。`);
  }
}

function updateArriving(seal, dt) {
  seal.leaveAfterFacilityUse = false;
  if (!Array.isArray(seal.path) || seal.path.length <= 0) {
    const village = getVillageEntryPoint();
    if (!setSealDestination(seal, village, 'arriving')) { persistAndRemoveVisitor(seal); return; }
    seal.wanderTimer = CONFIG.seal.wanderSeconds;
  }
  updateSealMovement(seal, dt * 1000);
}

function updateChoosingHuntArea(seal) {
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
  seal.state = monster ? 'movingToMonster' : 'movingToHuntExit';
}

function updateMovingToHuntExit(seal, dt) {
  if (!seal?.target || !Array.isArray(seal.path)) {
    const target = randomHuntAreaPoint(seal?.selectedHuntAreaId ?? 'coast');
    if (!setSealDestination(seal, target, 'hunt-wander')) { warnNoHuntCorridor(seal); return; }
  }
  updateSealMovement(seal, dt * 1000);
}

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
  if (!buildRouteToVillage(seal)) { warnNoHuntCorridor(seal); return; }
  seal.state = 'returningFromHunt';
}

function claimNearestMonster(seal, areaId = null) {
  const available = (gameState.monsters ?? []).filter(m => m?.hp > 0 && (!areaId || (m?.areaId ?? 'coast') === areaId) && (!m.assignedSealId || m.assignedSealId === seal.id));
  const monster = available.reduce((best, m) => !best || distance(seal.x, seal.y, m.x, m.y) < distance(seal.x, seal.y, best.x, best.y) ? m : best, null);
  if (monster) monster.assignedSealId = seal.id;
  return monster;
}

function updateMovingToMonster(seal, dt) {
  const monster = (gameState.monsters ?? []).find(m => m?.id === seal.targetId);
  if (!monster || monster.hp <= 0) { seal.targetId = null; seal.state = 'hunting'; return; }
  if (shouldReturnFromHunt(seal)) { monster.assignedSealId = null; seal.targetId = null; sendSealBackThroughHuntCorridor(seal); return; }
  if (!seal.target || seal.pathTargetKey !== `${worldToGrid(monster.x, monster.y).x},${worldToGrid(monster.x, monster.y).y}:monster`) {
    if (!setSealDestination(seal, { x: monster.x, y: monster.y }, 'monster')) { monster.assignedSealId = null; seal.targetId = null; seal.state = 'hunting'; return; }
  }
  updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, monster.x, monster.y) <= CONFIG.monster.contactDistance) { seal.state = 'fighting'; seal.combatTimer = 0; seal.monsterTimer = 0; }
}

function updateFighting(seal, dt) {
  const monster = (gameState.monsters ?? []).find(m => m?.id === seal.targetId);
  if (!monster || monster.hp <= 0) { seal.targetId = null; if (seal.carriedG > 0) sendSealBackThroughHuntCorridor(seal); else seal.state = 'hunting'; return; }
  seal.combatTimer += dt; seal.monsterTimer += dt;
  if (seal.combatTimer >= CONFIG.combat.sealAttackSeconds) {
    seal.combatTimer = 0;
    monster.hp -= Math.max(CONFIG.combat.minDamage, seal.attack - monster.defense);
    if (monster.hp <= 0) {
      seal.exp += CONFIG.monster.rewardExp;
      seal.carriedG += CONFIG.monster.rewardG;
      addFavor(seal, CONFIG.seal.favorDefeat);
      seal.huntCountThisTrip = clampInteger(seal.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      if (seal.type === 'visitor') seal.huntsThisVisit = clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      gameState.stats.monthlyHunts = clampInteger(gameState.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
      applyLevelUps(seal);
      gameState.frameTemps.toRemoveMonsters.push(monster.id);
      logMessage(`${seal.name}がカニを倒して${CONFIG.monster.rewardG}Gを獲得！`);
      seal.targetId = null;
      if (shouldContinueHunting(seal)) seal.state = 'hunting'; else sendSealBackThroughHuntCorridor(seal);
      return;
    }
  }
  if (seal.monsterTimer >= CONFIG.combat.monsterAttackSeconds) {
    seal.monsterTimer = 0;
    seal.hp -= Math.max(CONFIG.combat.minDamage, monster.attack - seal.defense);
    if (seal.hp <= 0) { seal.hp = 0; monster.assignedSealId = null; seal.state = 'fallen'; seal.targetId = null; seal.rescueTargetId = null; logMessage(`${seal.name}が倒れました。`); }
  }
}

function updateReturningFromHunt(seal, dt) {
  if (!seal?.target || !Array.isArray(seal.path)) {
    if (!buildRouteToVillage(seal)) { warnNoHuntCorridor(seal); return; }
  }
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
  seal.targetId = facility.id;
  if (!setSealDestination(seal, facilityInteractionPoint(facility), 'facility')) { seal.targetId = null; handleNoUsableFacility(seal); return; }
  seal.state = 'movingToFacility';
}

function updateMovingToFacility(seal, dt) {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (!facility || !isFacilityUsable(facility)) { seal.targetId = null; seal.state = 'choosingFacility'; return; }
  const target = facilityInteractionPoint(facility);
  if (!setSealDestination(seal, target, 'facility')) { seal.targetId = null; seal.state = 'choosingFacility'; return; }
  updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, target.x, target.y) <= CONFIG.seal.contactDistance) {
    seal.actionTimer = facility.type === 'inn' ? CONFIG.seal.restSeconds : CONFIG.seal.spendSeconds;
    seal.state = 'usingFacility';
  }
}

function updateUsingFacility(seal, dt) {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (facility?.type === 'inn') { updateResting(seal, dt); return; }
  if (!facility || !isFacilityUsable(facility)) { seal.targetId = null; seal.state = 'choosingFacility'; return; }
  seal.actionTimer -= dt;
  if (seal.actionTimer > 0) return;
  const base = CONFIG.facilities[facility.type]?.spendPerVisit ?? 0;
  const spent = Math.min(seal.carriedG, Math.round(base * (1 + facilityBonus(facility))));
  seal.carriedG -= spent;
  addPlayerIncome(spent);
  seal.facilityUseCounts[facility.type] = (seal.facilityUseCounts?.[facility.type] ?? 0) + 1;
  if (facility.type === 'restaurant') seal.mealCountSinceInn += 1;
  if (seal.type === 'visitor') seal.facilitiesUsedThisVisit = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  if (facility.type === 'blacksmith' && Math.random() < CONFIG.seal.blacksmithAttackChance) seal.attack += CONFIG.seal.blacksmithAttackGain;
  addFavor(seal, CONFIG.seal.favorFacilityUse);
  logMessage(`${seal.name}が${CONFIG.facilities[facility.type]?.label}で${spent}G使いました。`);
  afterVillageActivity(seal);
}

function updateResting(seal, dt) {
  const inn = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (!inn || !isFacilityUsable(inn)) { seal.targetId = null; seal.state = 'choosingFacility'; return; }
  const bonus = facilityBonus(inn);
  seal.hp = Math.min(seal.maxHp, seal.hp + CONFIG.facilities.inn.healPerSecond * (1 + bonus) * dt);
  seal.actionTimer -= dt;
  if (seal.hp >= seal.maxHp * CONFIG.seal.restTargetRatio && seal.actionTimer <= 0) {
    const fee = Math.min(seal.carriedG, CONFIG.facilities.inn.fee);
    seal.carriedG -= fee;
    addPlayerIncome(fee);
    seal.facilityUseCounts.inn = (seal.facilityUseCounts?.inn ?? 0) + 1;
    seal.mealCountSinceInn = 0;
    if (seal.type === 'visitor') seal.facilitiesUsedThisVisit = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
    addFavor(seal, CONFIG.seal.favorFacilityUse);
    logMessage(`${seal.name}が宿屋で回復し、${fee}G支払いました。`);
    afterVillageActivity(seal);
  }
}

function handleNoUsableFacility(seal) {
  if (seal?.type === 'visitor') { afterVillageActivity(seal); return; }
  const hpRatio = seal.maxHp > 0 ? seal.hp / seal.maxHp : 0;
  if (hpRatio <= CONFIG.seal.lowHpRatio) {
    seal.wanderTimer = CONFIG.seal.wanderSeconds;
    setSealDestination(seal, villageWanderPoint(), 'village-wander');
    seal.state = 'choosingFacility';
    return;
  }
  seal.state = 'choosingHuntArea';
}

function visitorShouldLeave(seal) {
  if (seal?.type !== 'visitor') return false;
  const personality = getPersonalityConfig(seal);
  const hpRatio = seal.maxHp > 0 ? seal.hp / seal.maxHp : 0;
  if (hpRatio <= personality.emergencyHpRatio) return true;
  const stayedMin = safeFiniteNumber(seal.visitTimerMs, 0, 0) >= safeFiniteNumber(seal.minStayMs, CONFIG.visitor.minStayMs, 0);
  const reachedMax = safeFiniteNumber(seal.visitTimerMs, 0, 0) >= safeFiniteNumber(seal.maxStayMs, CONFIG.visitor.maxStayMs, 0);
  const satisfied = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinFacilities
    || clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.enoughHuntsForLeave;
  return reachedMax || (stayedMin && (satisfied || seal.wantsToLeave));
}

function afterVillageActivity(seal) {
  seal.targetId = null;
  seal.target = null;
  seal.path = [];
  if (seal?.type === 'visitor') {
    seal.wantsToLeave = visitorShouldLeave(seal);
    if (seal.wantsToLeave) {
      seal.state = 'leaving';
      buildRouteToVillage(seal);
      return;
    }
    seal.wanderTimer = CONFIG.seal.wanderSeconds;
    setSealDestination(seal, villageWanderPoint(), 'visitor-stay');
    seal.state = 'choosingFacility';
    return;
  }
  seal.state = 'choosingHuntArea';
}

function updateLeaving(seal, dt) {
  if (!seal?.target || !Array.isArray(seal.path)) {
    if (!buildRouteToVillage(seal)) { persistAndRemoveVisitor(seal); return; }
  }
  updateSealMovement(seal, dt * 1000);
}

function persistAndRemoveVisitor(seal) {
  if (seal?.type !== 'visitor') return;
  writeBackVisitorProfile(seal);
  logMessage(`${seal.name}が南の入口から帰りました。`);
  gameState.seals = (gameState.seals ?? []).filter(item => item?.id !== seal.id);
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
  return (gameState.seals ?? []).find(other => other?.id !== seal.id && other?.state === 'fallen' && !isBeingCarried(other.id) && distance(seal.x, seal.y, other.x, other.y) <= CONFIG.seal.rescueScanDistance);
}

function isBeingCarried(sealId) { return (gameState.seals ?? []).some(s => s?.rescueTargetId === sealId && s?.state === 'carryingFallenSeal'); }

function updateRescuing(seal, dt) {
  const fallen = (gameState.seals ?? []).find(s => s?.id === seal.rescueTargetId);
  if (!fallen || fallen.state !== 'fallen') { seal.rescueTargetId = null; seal.state = 'choosingHuntArea'; return; }
  setSealDestination(seal, { x: fallen.x, y: fallen.y }, 'rescue'); updateSealMovement(seal, dt * 1000);
  if (distance(seal.x, seal.y, fallen.x, fallen.y) <= CONFIG.seal.contactDistance) {
    seal.state = 'carryingFallenSeal';
    const inn = chooseInnForSeal(seal);
    seal.targetId = inn?.id ?? null;
    setSealDestination(seal, inn ? facilityInteractionPoint(inn) : getVillageEntryPoint(), 'carry');
  }
}

function updateCarrying(seal, dt) {
  const fallen = (gameState.seals ?? []).find(s => s?.id === seal.rescueTargetId);
  if (!fallen) { seal.rescueTargetId = null; seal.state = 'choosingHuntArea'; return; }
  updateSealMovement(seal, dt * 1000);
  fallen.x = seal.x - CONFIG.seal.spread * 0.5; fallen.y = seal.y;
  if (distance(seal.x, seal.y, seal.target?.x, seal.target?.y) > CONFIG.seal.contactDistance) return;
  const inn = (gameState.world.objects ?? []).find(o => o?.id === seal.targetId);
  if (inn && isFacilityUsable(inn)) {
    const fee = CONFIG.facilities.inn.fee;
    const paidByFallen = Math.min(fallen.carriedG, fee);
    fallen.carriedG -= paidByFallen;
    const paidByRescuer = Math.min(seal.carriedG, fee - paidByFallen);
    seal.carriedG -= paidByRescuer;
    addPlayerIncome(paidByFallen + paidByRescuer);
    fallen.hp = Math.min(fallen.maxHp, fallen.maxHp * CONFIG.seal.restTargetRatio);
    addFavor(fallen, CONFIG.seal.favorRescued);
    logMessage(`宿代${paidByFallen + paidByRescuer}G支払い、${fallen.name}を救助しました。`);
  } else {
    fallen.hp = Math.max(fallen.hp, fallen.maxHp * CONFIG.seal.standHpRatio);
    addFavor(fallen, CONFIG.seal.favorRescued);
    logMessage(`${fallen.name}を安全地点へ運びました。`);
  }
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
  const target = seal.type === 'visitor' && seal.state === 'leaving'
    ? (findNearestPassableSpawnPoint(getVisitorPreferredSpawnPoint()) ?? getVillageEntryPoint())
    : getVillageEntryPoint();
  return setSealDestination(seal, target, seal.type === 'visitor' && seal.state === 'leaving' ? 'leaving' : 'village-route');
}

function setSealDestination(seal, worldPosition, reason) {
  if (!seal) return false;
  if (!worldPosition || !Number.isFinite(Number(worldPosition.x)) || !Number.isFinite(Number(worldPosition.y))) { seal.target = null; seal.path = []; seal.pathTargetKey = null; return false; }
  const next = { x: safeFiniteNumber(worldPosition.x, seal.x), y: safeFiniteNumber(worldPosition.y, seal.y), reason: String(reason ?? '') };
  const goal = worldToGrid(next.x, next.y);
  const key = `${goal.x},${goal.y}:${next.reason}`;
  seal.target = next;
  if (seal.pathTargetKey === key && Array.isArray(seal.path)) return true;
  const path = findPath(worldToGrid(seal.x, seal.y), goal, { seal, reason: next.reason });
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
  if (seal.state === 'arriving') { seal.state = 'choosingFacility'; return; }
  if (seal.state === 'movingToHuntExit') { seal.target = null; seal.state = 'hunting'; return; }
  if (seal.state === 'returningFromHunt') { seal.target = null; seal.targetId = null; seal.state = 'choosingFacility'; return; }
  if (seal.state === 'leaving') {
    addFavor(seal, CONFIG.visitor.safeLeaveFavor);
    if (clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinFacilities || clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) >= CONFIG.visitor.satisfyingMinHunts) {
      addFavor(seal, CONFIG.knownness.satisfyingVisitReward);
      gameState.village.knownness += CONFIG.knownness.satisfyingVisitReward;
      unlockKnownVisitors();
    }
    persistAndRemoveVisitor(seal);
  }
}

function findPath(startTile, goalTile, options = {}) {
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
      const moveCost = getTileMoveCost(next, options);
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
  const x = clampInteger(tile?.x, 0, CONFIG.world.cols - 1, -1);
  const y = clampInteger(tile?.y, 0, CONFIG.world.rows - 1, -1);
  const cell = getTile(x, y);
  if (!cell || objectAt(x, y)) return Infinity;
  if (cell.terrain === CONFIG.tileState.terrainWater) return Infinity;
  if (roadAt(x, y)) return CONFIG.movement.roadCost;
  if (cell.terrain === CONFIG.tileState.terrainOutside) return CONFIG.movement.outsideCost;
  if (cell.terrain === CONFIG.tileState.terrainLand && cell.buildState === CONFIG.tileState.buildable && cell.obstacle === null) return CONFIG.movement.buildableCost;
  return Infinity;
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

