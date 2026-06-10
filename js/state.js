function createNewGameState() {
  return {
    phase: CONFIG.phase.start,
    player: { g: 0 },
    residentName: CONFIG.resident.defaultName,
    camera: { x: CONFIG.camera.x, y: CONFIG.camera.y, zoom: CONFIG.camera.zoom, dragging: false, dragMoved: false, dragStartX: 0, dragStartY: 0, lastMouseX: 0, lastMouseY: 0 },
    input: { keys: {}, mouseWorld: { x: 0, y: 0 }, mouseTile: { x: -1, y: -1 } },
    ui: { selectedTool: 'road', directionIndex: 2, placementFeedback: null, lastUiUpdate: 0, needsHudUpdate: true },
    world: { tiles: [], roads: [], objects: [], nextObjectId: 1 },
    seals: [],
    visitorProfiles: createDefaultVisitorProfiles(),
    monsters: [],
    images: {},
    logs: [],
    timers: { spawn: 0, monsterSpawn: 0, visitorSpawn: 0, ui: 0 },
    time: { timeScale: CONFIG.TIME.DEFAULT_SCALE },
    save: { autoSaveTimerMs: 0, lastSavedAt: null, statusText: '' },
    village: { knownness: CONFIG.knownness.initial, clearCount: 0 },
    calendar: { year: 1, month: 1, week: 1, weekTimerMs: 0 },
    stats: { monthlyHunts: 0, monthlyKnownnessGained: 0, monthlyPlayerIncome: 0 },
    frameTemps: { occupied: new Set(), usableFacilities: [], toRemoveMonsters: [] },
    lastTime: performance.now()
  };
}


function createDefaultVisitorProfiles() {
  return (CONFIG.visitor?.profiles ?? []).map(profile => ({
    id: String(profile?.id ?? ''),
    name: String(profile?.name ?? CONFIG.resident.defaultName),
    personality: String(profile?.personality ?? 'balanced'),
    unlockedAtKnownness: safeFiniteNumber(profile?.unlockedAtKnownness, 0, 0),
    baseStats: cloneSerializable(profile?.baseStats, { maxHp: CONFIG.seal.maxHp, attack: CONFIG.seal.attack, defense: CONFIG.seal.defense }),
    level: clampInteger(profile?.level, 1, Number.MAX_SAFE_INTEGER, 1),
    exp: safeFiniteNumber(profile?.exp, 0, 0),
    favor: safeFiniteNumber(profile?.favor, 0, 0),
    visits: clampInteger(profile?.visits, 0, Number.MAX_SAFE_INTEGER, 0),
    unlocked: safeFiniteNumber(profile?.unlockedAtKnownness, 0, 0) <= CONFIG.knownness.initial
  }));
}

function cloneSerializable(value, fallback) {
  try {
    const copy = JSON.parse(JSON.stringify(value));
    return copy ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function safeFiniteNumber(value, fallback, min = -Infinity) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, number);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clampInteger(value, min, max, fallback) {
  return Math.trunc(clampNumber(value, min, max, fallback));
}

function normalizeTiles(tiles) {
  if (!Array.isArray(tiles) || tiles.length <= 0) return generateInitialMap();
  const fallback = generateInitialMap();
  return Array.from({ length: CONFIG.world.rows }, (_, y) => Array.from({ length: CONFIG.world.cols }, (_, x) => {
    const source = tiles?.[y]?.[x] ?? fallback[y][x];
    const terrainValues = [CONFIG.tileState.terrainWater, CONFIG.tileState.terrainLand, CONFIG.tileState.terrainOutside];
    const buildValues = [CONFIG.tileState.buildBlocked, CONFIG.tileState.buildable];
    const obstacleValues = [null, CONFIG.tileState.obstacleGrass, CONFIG.tileState.obstacleTree, CONFIG.tileState.obstacleRock];
    return {
      terrain: terrainValues.includes(source?.terrain) ? source.terrain : fallback[y][x].terrain,
      buildState: buildValues.includes(source?.buildState) ? source.buildState : fallback[y][x].buildState,
      obstacle: obstacleValues.includes(source?.obstacle ?? null) ? (source?.obstacle ?? null) : fallback[y][x].obstacle,
      unlocked: source?.unlocked === true
    };
  }));
}

function normalizeRoads(roads) {
  if (!Array.isArray(roads)) return [];
  return roads.map(r => ({ x: clampInteger(r?.x, 0, CONFIG.world.cols - 1, 0), y: clampInteger(r?.y, 0, CONFIG.world.rows - 1, 0) }));
}

function normalizeObjects(objects) {
  if (!Array.isArray(objects)) return [];
  return objects.map((o, index) => {
    const tool = getTool(o?.type);
    if (!tool || !['facility', 'decoration'].includes(tool.kind)) return null;
    return {
      id: String(o?.id || `obj-${index + 1}`),
      type: tool.id,
      kind: tool.kind,
      x: clampInteger(o?.x, 0, CONFIG.world.cols - 1, 0),
      y: clampInteger(o?.y, 0, CONFIG.world.rows - 1, 0),
      w: tool.w,
      h: tool.h,
      directionIndex: clampInteger(o?.directionIndex, 0, CONFIG.directions.length - 1, 0)
    };
  }).filter(Boolean);
}

function normalizeSeals(seals) {
  if (!Array.isArray(seals)) return [];
  const states = Object.values(CONFIG.sealStates ?? {});
  return seals.map((s, index) => normalizeSeal(s, index)).filter(Boolean).map(seal => {
    if (seal.state === 'choosingHuntGate') seal.state = 'choosingHuntArea';
    if (seal.state === 'movingToHuntGate') seal.state = 'movingToHuntExit';
    if (seal.state === 'resting') seal.state = 'usingFacility';
    if (!states.includes(seal.state)) seal.state = seal.type === 'visitor' ? 'arriving' : 'choosingHuntArea';
    return seal;
  });
}

function normalizeSeal(s, index) {
  if (!s || typeof s !== 'object') return null;
  const entry = routeWaypointToWorld(getEntryCorridor()?.waypoints?.[1]) ?? gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY);
  const isVisitor = s?.type === 'visitor';
  return {
    id: String(s?.id || (isVisitor ? `visitor-${Date.now()}-${index}` : 'resident-seal')),
    profileId: s?.profileId ? String(s.profileId) : null,
    name: String(s?.name || (isVisitor ? (getVisitorProfileById(s?.profileId)?.name ?? CONFIG.resident.defaultName) : CONFIG.resident.defaultName)),
    personality: String(s?.personality || (isVisitor ? (getVisitorProfileById(s?.profileId)?.personality ?? 'balanced') : 'balanced')),
    type: isVisitor ? 'visitor' : 'resident',
    assetKey: String(s?.assetKey || (isVisitor ? assetKeyForVisitorProfile(s?.profileId) : 'seals.resident')),
    facing: s?.facing === 'right' ? 'right' : 'left',
    x: safeFiniteNumber(s?.x, entry.x),
    y: safeFiniteNumber(s?.y, entry.y),
    hp: safeFiniteNumber(s?.hp, CONFIG.seal.maxHp, 0),
    maxHp: safeFiniteNumber(s?.maxHp, CONFIG.seal.maxHp, 1),
    attack: safeFiniteNumber(s?.attack, CONFIG.seal.attack, 0),
    defense: safeFiniteNumber(s?.defense, CONFIG.seal.defense, 0),
    carriedG: safeFiniteNumber(s?.carriedG, 0, 0),
    exp: safeFiniteNumber(s?.exp, 0, 0),
    level: clampInteger(s?.level, 1, Number.MAX_SAFE_INTEGER, 1),
    favor: safeFiniteNumber(s?.favor, 0, 0),
    state: String(s?.state || (isVisitor ? 'arriving' : 'choosingHuntArea')),
    targetId: s?.targetId ? String(s.targetId) : null,
    target: s?.target ? { x: safeFiniteNumber(s.target?.x, entry.x), y: safeFiniteNumber(s.target?.y, entry.y) } : null,
    selectedHuntAreaId: s?.selectedHuntAreaId ? String(s.selectedHuntAreaId) : (s?.selectedHuntGateId ? 'coast' : null),
    selectedRouteId: s?.selectedRouteId ? String(s.selectedRouteId) : null,
    routeDirection: s?.routeDirection ? String(s.routeDirection) : null,
    visits: clampInteger(s?.visits, 0, Number.MAX_SAFE_INTEGER, isVisitor ? 1 : 0),
    facilityUseCounts: normalizeFacilityUseCounts(s?.facilityUseCounts),
    mealCountSinceInn: clampInteger(s?.mealCountSinceInn, 0, Number.MAX_SAFE_INTEGER, 0),
    leaveAfterFacilityUse: s?.leaveAfterFacilityUse === true,
    rescueTargetId: s?.rescueTargetId ? String(s.rescueTargetId) : null,
    combatTimer: safeFiniteNumber(s?.combatTimer, 0, 0),
    monsterTimer: safeFiniteNumber(s?.monsterTimer, 0, 0),
    actionTimer: safeFiniteNumber(s?.actionTimer, 0, 0),
    huntTimer: safeFiniteNumber(s?.huntTimer, 0, 0),
    wanderTimer: safeFiniteNumber(s?.wanderTimer, 0, 0),
    noMonsterTimer: safeFiniteNumber(s?.noMonsterTimer, 0, 0),
    huntCountThisTrip: clampInteger(s?.huntCountThisTrip, 0, Number.MAX_SAFE_INTEGER, 0),
    visitTimerMs: safeFiniteNumber(s?.visitTimerMs, 0, 0),
    minStayMs: safeFiniteNumber(s?.minStayMs, CONFIG.visitor.minStayMs, 0),
    maxStayMs: safeFiniteNumber(s?.maxStayMs, CONFIG.visitor.maxStayMs, 0),
    huntsThisVisit: clampInteger(s?.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0),
    facilitiesUsedThisVisit: clampInteger(s?.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0),
    wantsToLeave: s?.wantsToLeave === true,
    path: [],
    pathTargetKey: null,
    warnedPathFallback: s?.warnedPathFallback === true
  };
}

function normalizeFacilityUseCounts(counts) {
  return {
    inn: clampInteger(counts?.inn, 0, Number.MAX_SAFE_INTEGER, 0),
    restaurant: clampInteger(counts?.restaurant, 0, Number.MAX_SAFE_INTEGER, 0),
    blacksmith: clampInteger(counts?.blacksmith, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function normalizeVisitorProfiles(profiles) {
  const saved = Array.isArray(profiles) ? profiles : [];
  return createDefaultVisitorProfiles().map(defaultProfile => {
    const loaded = saved.find(p => p?.id === defaultProfile.id) ?? {};
    return {
      ...defaultProfile,
      level: clampInteger(loaded?.level, 1, Number.MAX_SAFE_INTEGER, defaultProfile.level),
      exp: safeFiniteNumber(loaded?.exp, defaultProfile.exp, 0),
      favor: safeFiniteNumber(loaded?.favor, defaultProfile.favor, 0),
      visits: clampInteger(loaded?.visits, 0, Number.MAX_SAFE_INTEGER, defaultProfile.visits),
      unlocked: loaded?.unlocked === true || defaultProfile.unlocked
    };
  });
}

function getVisitorProfileById(id) {
  return (gameState.visitorProfiles ?? []).find(profile => profile?.id === id) ?? (CONFIG.visitor?.profiles ?? []).find(profile => profile?.id === id) ?? null;
}

function assetKeyForVisitorProfile(profileId) {
  const id = String(profileId || '');
  if (id.includes('kurakake')) return 'seals.kurakake';
  if (id.includes('tategoto')) return 'seals.tategoto';
  if (id.includes('goma')) return 'seals.goma';
  return 'seals.resident';
}

function normalizeMonsters(monsters) {
  if (!Array.isArray(monsters)) return [];
  return monsters.map((m, index) => ({
    id: String(m?.id || `crab-${Date.now()}-${index}`),
    type: 'crab',
    assetKey: String(m?.assetKey || 'monsters.crab'),
    facing: m?.facing === 'right' ? 'right' : 'left',
    areaId: String(m?.areaId || 'coast'),
    x: safeFiniteNumber(m?.x, randomCoastPoint().x),
    y: safeFiniteNumber(m?.y, randomCoastPoint().y),
    hp: safeFiniteNumber(m?.hp, CONFIG.monster.hp, 0),
    maxHp: safeFiniteNumber(m?.maxHp, CONFIG.monster.hp, 1),
    attack: safeFiniteNumber(m?.attack, CONFIG.monster.attack, 0),
    defense: safeFiniteNumber(m?.defense, CONFIG.monster.defense, 0),
    assignedSealId: m?.assignedSealId ? String(m.assignedSealId) : null
  }));
}

function nextObjectNumber(objects) {
  return objects.reduce((max, object) => {
    const match = String(object?.id ?? '').match(/^obj-(\d+)$/);
    return Math.max(max, match ? Number(match[1]) + 1 : 1);
  }, 1);
}

function logMessage(text) {
  gameState.logs.unshift(text);
  gameState.logs.length = Math.min(gameState.logs.length, CONFIG.MAX_LOGS);
}

function initGame(residentName) {
  gameState.phase = CONFIG.phase.playing;
  gameState.player.g = 0;
  gameState.residentName = String(residentName || gameState.residentName || CONFIG.resident.defaultName).trim() || CONFIG.resident.defaultName;
  gameState.world.tiles = generateInitialMap();
  gameState.world.roads = [];
  gameState.world.objects = [];
  gameState.world.nextObjectId = 1;
  gameState.monsters = [];
  gameState.visitorProfiles = createDefaultVisitorProfiles();
  gameState.logs = [];
  gameState.village.knownness = CONFIG.knownness.initial;
  gameState.village.clearCount = 0;
  gameState.time.timeScale = CONFIG.TIME.DEFAULT_SCALE;
  gameState.calendar.year = 1;
  gameState.calendar.month = 1;
  gameState.calendar.week = 1;
  gameState.calendar.weekTimerMs = 0;
  gameState.stats.monthlyHunts = 0;
  gameState.stats.monthlyKnownnessGained = 0;
  gameState.stats.monthlyPlayerIncome = 0;
  gameState.timers.spawn = 0;
  gameState.timers.monsterSpawn = 0;
  gameState.timers.visitorSpawn = 0;
  gameState.timers.ui = 0;
  gameState.save.autoSaveTimerMs = 0;
  gameState.save.lastSavedAt = null;
  initializeAssetRegistry();
  gameState.seals = [createResidentSeal(gameState.residentName)];
  addDefaultVillage();
  startScreen.style.display = 'none';
  logMessage('ゲーム開始。住民あざらしが海辺の通り道から冒険へ向かいます。');
}

function addDefaultVillage() {
  for (const item of CONFIG.village.defaults) unlockFootprint(item.x, item.y, getTool(item.type)?.w ?? CONFIG.placement.decorationSize, getTool(item.type)?.h ?? CONFIG.placement.decorationSize);
  for (let x = CONFIG.village.roadStartX; x <= CONFIG.village.roadEndX; x += 1) gameState.world.roads.push({ x, y: CONFIG.village.roadY });
  for (let y = CONFIG.village.roadStartY; y <= CONFIG.village.roadEndY; y += 1) gameState.world.roads.push({ x: CONFIG.village.roadX, y });
  for (const item of CONFIG.village.defaults) placeObject(item.type, item.x, item.y, item.directionIndex ?? 0, true);
}

function gridToWorld(gx, gy) {
  return { x: (gx + 0.5) * CONFIG.world.tile, y: (gy + 0.5) * CONFIG.world.tile };
}

function worldToGrid(x, y) {
  return { x: Math.floor(x / CONFIG.world.tile), y: Math.floor(y / CONFIG.world.tile) };
}

function inRect(gx, gy, x, y, w, h) { return gx >= x && gy >= y && gx < x + w && gy < y + h; }
function isInExpansionRegion(gx, gy) { return inRect(gx, gy, CONFIG.expansion.regionX, CONFIG.expansion.regionY, CONFIG.expansion.regionW, CONFIG.expansion.regionH); }
function isInStartingVillage(gx, gy) { return inRect(gx, gy, CONFIG.expansion.startX, CONFIG.expansion.startY, CONFIG.expansion.startW, CONFIG.expansion.startH); }

function generateInitialMap() {
  const tiles = Array.from({ length: CONFIG.world.rows }, (_, y) => Array.from({ length: CONFIG.world.cols }, (_, x) => createTile(x, y)));
  protectOpenCorridors({ tiles });
  return tiles;
}

function createWorldTiles() {
  return generateInitialMap();
}

function createTile(x, y) {
  const state = CONFIG.tileState;
  if (isCoastTile(x, y)) return { terrain: state.terrainOutside, buildState: state.buildBlocked, obstacle: null, unlocked: false };
  if (!isIslandTile(x, y)) return { terrain: state.terrainWater, buildState: state.buildBlocked, obstacle: null, unlocked: false };
  const startsBuildable = isInStartingVillage(x, y) || !isInExpansionRegion(x, y) || !isUndevelopedPatchTile(x, y);
  return {
    terrain: state.terrainLand,
    buildState: startsBuildable ? state.buildable : state.buildBlocked,
    obstacle: startsBuildable ? null : obstacleForTile(x, y),
    unlocked: startsBuildable
  };
}

function protectOpenCorridors(world) {
  const tiles = world?.tiles;
  if (!Array.isArray(tiles)) return;
  for (let y = 0; y < CONFIG.world.rows; y += 1) {
    for (let x = 0; x < CONFIG.world.cols; x += 1) {
      if (!isProtectedCorridorTile(x, y)) continue;
      const tile = tiles?.[y]?.[x];
      if (tile?.terrain === CONFIG.tileState.terrainWater) tile.terrain = CONFIG.tileState.terrainOutside;
      if (tile?.terrain !== CONFIG.tileState.terrainLand && tile?.terrain !== CONFIG.tileState.terrainOutside) continue;
      if (tile.terrain === CONFIG.tileState.terrainLand) {
        tile.buildState = CONFIG.tileState.buildable;
        tile.unlocked = true;
      }
      tile.obstacle = null;
    }
  }
}

function isProtectedCorridorTile(x, y) {
  const width = CONFIG.map.corridorWidth;
  for (const line of CONFIG.map.protectedCorridors ?? []) {
    if (distanceToSegment(x, y, line.from?.x, line.from?.y, line.to?.x, line.to?.y) <= width) return true;
  }
  const routePoints = getAllRouteWaypoints();
  return routePoints.some(point => point && distance(x, y, point.x, point.y) <= CONFIG.map.routeBreathingRadius);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const startX = safeFiniteNumber(ax, px);
  const startY = safeFiniteNumber(ay, py);
  const endX = safeFiniteNumber(bx, startX);
  const endY = safeFiniteNumber(by, startY);
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0) return distance(px, py, startX, startY);
  const t = Math.max(0, Math.min(1, ((px - startX) * dx + (py - startY) * dy) / lengthSq));
  return distance(px, py, startX + t * dx, startY + t * dy);
}

function isUndevelopedPatchTile(x, y) {
  if (!isInExpansionRegion(x, y) || isProtectedCorridorTile(x, y)) return false;
  return (CONFIG.map.undevelopedPatches ?? []).some(patch => {
    const nx = (x - patch.cx) / Math.max(1, patch.radiusX);
    const ny = (y - patch.cy) / Math.max(1, patch.radiusY);
    const organicEdge = ((x * CONFIG.map.obstacleSeedA + y * CONFIG.map.obstacleSeedB) % Math.max(1, patch.softness)) / Math.max(1, patch.softness) * 0.22;
    return nx * nx + ny * ny <= 1 + organicEdge;
  });
}

function obstacleForTile(x, y) {
  const roll = Math.abs((x * CONFIG.map.obstacleSeedA + y * CONFIG.map.obstacleSeedB) % CONFIG.map.obstacleModulo);
  if (roll < CONFIG.map.grassLimit) return CONFIG.tileState.obstacleGrass;
  if (roll < CONFIG.map.treeLimit) return CONFIG.tileState.obstacleTree;
  return CONFIG.tileState.obstacleRock;
}

function getTile(x, y) {
  return gameState.world.tiles?.[y]?.[x] ?? null;
}

function isBuildableTile(x, y) {
  const tile = getTile(x, y);
  return tile?.terrain === CONFIG.tileState.terrainLand
    && tile?.buildState === CONFIG.tileState.buildable
    && tile?.obstacle === null
    && tile?.unlocked === true;
}

function isBlockedLandTile(x, y) {
  const tile = getTile(x, y);
  return tile?.terrain === CONFIG.tileState.terrainLand
    && tile?.buildState === CONFIG.tileState.buildBlocked
    && tile?.unlocked !== true;
}

function unlockFootprint(gx, gy, w, h) {
  for (let y = gy; y < gy + h; y += 1) {
    for (let x = gx; x < gx + w; x += 1) {
      const tile = getTile(x, y);
      if (tile?.terrain !== CONFIG.tileState.terrainLand) continue;
      tile.buildState = CONFIG.tileState.buildable;
      tile.obstacle = null;
      tile.unlocked = true;
    }
  }
}

function getTilesInRadius(tileX, tileY, radius) {
  const tiles = [];
  for (let y = tileY - radius; y <= tileY + radius; y += 1) {
    for (let x = tileX - radius; x <= tileX + radius; x += 1) {
      if (distance(tileX, tileY, x, y) <= radius) tiles.push({ x, y, tile: getTile(x, y) });
    }
  }
  return tiles;
}

function canPlaceAt(tileX, tileY, objectDef) {
  const tool = objectDef ?? getTool(gameState.ui.selectedTool);
  if (tool?.kind === 'delete') return { ok: true, reason: '' };
  if (tool?.kind === 'clear') return { ok: false, reason: '開拓ツールでは配置できません。' };
  const w = tool?.w ?? CONFIG.placement.decorationSize;
  const h = tool?.h ?? CONFIG.placement.decorationSize;
  for (let y = tileY; y < tileY + h; y += 1) {
    for (let x = tileX; x < tileX + w; x += 1) {
      const tile = getTile(x, y);
      if (!tile) return { ok: false, reason: 'マップ外です。' };
      if (tile?.terrain === CONFIG.tileState.terrainWater) return { ok: false, reason: '水上には配置できません。' };
      if (tile?.terrain === CONFIG.tileState.terrainOutside) return { ok: false, reason: '外の冒険エリアには配置できません。' };
      if (!isInExpansionRegion(x, y)) return { ok: false, reason: '村の開拓範囲外です。' };
      if (!isBuildableTile(x, y)) return { ok: false, reason: '未開拓または障害物がある土地です。' };
      if (objectAt(x, y)) return { ok: false, reason: '他の物があります。' };
      if (tool?.kind !== 'road' && roadAt(x, y)) return { ok: false, reason: '道路の上には置けません。' };
    }
  }
  return { ok: true, reason: '' };
}

function canClearAt(tileX, tileY) {
  const tile = getTile(tileX, tileY);
  const cost = getClearingCost();
  if (!tile) return { ok: false, reason: 'マップ外です。' };
  if (tile?.terrain !== CONFIG.tileState.terrainLand) return { ok: false, reason: '水辺や外の冒険エリアは開拓できません。' };
  if (!isInExpansionRegion(tileX, tileY)) return { ok: false, reason: '村の開拓範囲外です。' };
  if (!isBlockedLandTile(tileX, tileY)) return { ok: false, reason: 'ここはすでに建設可能、または開拓対象外です。' };
  if (gameState.player.g < cost) return { ok: false, reason: `${cost}G必要です。` };
  return { ok: true, reason: '' };
}

function getClearingCost() {
  return CONFIG.CLEARING.BASE_COST + clampInteger(gameState.village?.clearCount, 0, Number.MAX_SAFE_INTEGER, 0) * CONFIG.CLEARING.COST_STEP;
}

function clearLandAt(tileX, tileY) {
  const result = canClearAt(tileX, tileY);
  if (!result.ok) {
    logMessage(`開拓できません：${result.reason}`);
    gameState.ui.placementFeedback = { x: tileX, y: tileY, ok: false, text: result.reason, timer: CONFIG.placement.feedbackSeconds };
    return false;
  }
  const cost = getClearingCost();
  gameState.player.g -= cost;
  let cleared = 0;
  for (const entry of getTilesInRadius(tileX, tileY, CONFIG.CLEARING.RADIUS)) {
    const x = entry?.x ?? 0;
    const y = entry?.y ?? 0;
    const tile = entry?.tile;
    if (tile?.terrain !== CONFIG.tileState.terrainLand || !isInExpansionRegion(x, y) || objectAt(x, y) || roadAt(x, y) || isProtectedCorridorTile(x, y)) continue;
    tile.buildState = CONFIG.tileState.buildable;
    tile.obstacle = null;
    tile.unlocked = true;
    cleared += 1;
  }
  gameState.village.clearCount = clampInteger(gameState.village?.clearCount, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  logMessage(`${cost}Gで${cleared}マスを開拓しました。`);
  gameState.ui.placementFeedback = { x: tileX, y: tileY, ok: true, text: '開拓しました。', timer: CONFIG.placement.feedbackSeconds };
  return true;
}

function isIslandTile(gx, gy) { return inRect(gx, gy, CONFIG.world.islandX, CONFIG.world.islandY, CONFIG.world.islandW, CONFIG.world.islandH); }
function isCoastTile(gx, gy) { return inRect(gx, gy, CONFIG.world.coastX, CONFIG.world.coastY, CONFIG.world.coastW, CONFIG.world.coastH); }
function roadAt(gx, gy) { return gameState.world.roads.some(r => r?.x === gx && r?.y === gy); }
function objectAt(gx, gy) { return gameState.world.objects.find(o => gx >= o?.x && gy >= o?.y && gx < (o?.x ?? 0) + (o?.w ?? 1) && gy < (o?.y ?? 0) + (o?.h ?? 1)); }

function getTool(id) { return CONFIG.tools.find(t => t.id === id) ?? CONFIG.tools[0]; }

function canPlace(type, gx, gy) {
  return canPlaceAt(gx, gy, getTool(type));
}

function placeObject(type, gx, gy, directionIndex, silent) {
  const result = canPlace(type, gx, gy);
  if (!result.ok) {
    gameState.ui.placementFeedback = { x: gx, y: gy, ok: false, text: result.reason, timer: CONFIG.placement.feedbackSeconds };
    return false;
  }
  const tool = getTool(type);
  if (tool?.kind === 'road') {
    if (!roadAt(gx, gy)) gameState.world.roads.push({ x: gx, y: gy });
  } else if (tool?.kind !== 'delete') {
    gameState.world.objects.push({ id: `obj-${gameState.world.nextObjectId++}`, type, kind: tool?.kind, x: gx, y: gy, w: tool?.w, h: tool?.h, directionIndex });
  }
  if (!silent) gameState.ui.placementFeedback = { x: gx, y: gy, ok: true, text: '配置しました。', timer: CONFIG.placement.feedbackSeconds };
  return true;
}

function deleteAt(gx, gy) {
  const obj = objectAt(gx, gy);
  if (obj?.id) {
    gameState.world.objects = gameState.world.objects.filter(o => o?.id !== obj.id);
    gameState.ui.placementFeedback = { x: gx, y: gy, ok: true, text: '削除しました。', timer: CONFIG.placement.feedbackSeconds };
    return;
  }
  const before = gameState.world.roads.length;
  gameState.world.roads = gameState.world.roads.filter(r => !(r?.x === gx && r?.y === gy));
  gameState.ui.placementFeedback = { x: gx, y: gy, ok: before !== gameState.world.roads.length, text: before !== gameState.world.roads.length ? '削除しました。' : '削除対象がありません。', timer: CONFIG.placement.feedbackSeconds };
}

function entranceTile(facility) {
  const index = facility?.directionIndex ?? 0;
  const x = facility?.x ?? 0;
  const y = facility?.y ?? 0;
  const w = facility?.w ?? CONFIG.placement.facilitySize;
  const h = facility?.h ?? CONFIG.placement.facilitySize;
  if (CONFIG.directions[index]?.name === 'N') return { x: x + Math.floor(w / 2), y: y - 1 };
  if (CONFIG.directions[index]?.name === 'E') return { x: x + w, y: y + Math.floor(h / 2) };
  if (CONFIG.directions[index]?.name === 'S') return { x: x + Math.floor(w / 2), y: y + h };
  return { x: x - 1, y: y + Math.floor(h / 2) };
}

function isFacilityUsable(facility) {
  if (facility?.kind !== 'facility') return false;
  const e = entranceTile(facility);
  return roadAt(e.x, e.y);
}

function facilityBonus(facility) {
  const cfg = CONFIG.facilities[facility?.type];
  if (!cfg) return 0;
  const adjacentCells = new Set();
  for (let y = facility?.y ?? 0; y < (facility?.y ?? 0) + (facility?.h ?? 1); y += 1) {
    for (let x = facility?.x ?? 0; x < (facility?.x ?? 0) + (facility?.w ?? 1); x += 1) {
      for (const dir of CONFIG.directions) adjacentCells.add(`${x + dir.dx},${y + dir.dy}`);
    }
  }
  const count = gameState.world.objects.filter(o => o?.type === cfg.bonusDecoration && adjacentCells.has(`${o.x},${o.y}`)).length;
  return count * cfg.bonusRate;
}

function usableFacilities(type) {
  return gameState.world.objects.filter(o => o?.type === type && isFacilityUsable(o));
}

function nearestFacility(type, x, y) {
  const list = usableFacilities(type);
  return list.reduce((best, item) => !best || distance(x, y, centerOfObject(item).x, centerOfObject(item).y) < distance(x, y, centerOfObject(best).x, centerOfObject(best).y) ? item : best, null);
}

function centerOfObject(obj) { return { x: ((obj?.x ?? 0) + (obj?.w ?? 1) / 2) * CONFIG.world.tile, y: ((obj?.y ?? 0) + (obj?.h ?? 1) / 2) * CONFIG.world.tile }; }
function distance(ax, ay, bx, by) { return Math.hypot((bx ?? 0) - (ax ?? 0), (by ?? 0) - (ay ?? 0)); }
function randomRange(min, max) { return min + Math.random() * (max - min); }
function randomCoastPoint() { return gridToWorld(Math.floor(randomRange(CONFIG.world.coastX, CONFIG.world.coastX + CONFIG.world.coastW)), Math.floor(randomRange(CONFIG.world.coastY, CONFIG.world.coastY + CONFIG.world.coastH))); }

function createResidentSeal(name) {
  const safe = gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY);
  return normalizeSeal({
    id: 'resident-seal', name: String(name || gameState.residentName || CONFIG.resident.defaultName), type: 'resident', personality: 'balanced', assetKey: 'seals.resident', facing: 'left', x: safe.x, y: safe.y,
    hp: CONFIG.seal.maxHp, maxHp: CONFIG.seal.maxHp, attack: CONFIG.seal.attack, defense: CONFIG.seal.defense,
    carriedG: CONFIG.seal.startG, exp: 0, level: 1, favor: 0, state: 'choosingHuntArea', visits: 0
  }, 0);
}

function ensureResidentSeal() {
  if (gameState.seals?.some(seal => seal?.type === 'resident')) return;
  gameState.seals = [createResidentSeal(gameState.residentName), ...(Array.isArray(gameState.seals) ? gameState.seals : [])];
}

function enforceSingleResidentSeal() {
  let residentSeen = false;
  gameState.seals = (Array.isArray(gameState.seals) ? gameState.seals : []).map((seal, index) => {
    if (seal?.type === 'resident' && !residentSeen) { residentSeen = true; seal.id = 'resident-seal'; return seal; }
    if (seal?.type === 'resident') { seal.type = 'visitor'; seal.profileId = seal.profileId ?? null; seal.state = 'leaving'; buildRouteToVillage(seal); }
    return seal;
  });
  ensureResidentSeal();
}

function routeWaypointToWorld(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return gridToWorld(point.x, point.y);
}

function getEntryCorridor() {
  return CONFIG.ROUTES?.entryCorridor ?? null;
}

function getHuntingCorridorForArea(areaId) {
  const id = areaId ? String(areaId) : 'coast';
  return (CONFIG.ROUTES?.huntingCorridors ?? []).find(corridor => corridor?.areaId === id) ?? null;
}

function getAllRouteWaypoints() {
  return [getEntryCorridor(), ...(CONFIG.ROUTES?.huntingCorridors ?? [])].flatMap(route => route?.waypoints ?? []);
}

function getNearestCorridorWaypoint(position, corridor) {
  if (!position || !Array.isArray(corridor?.waypoints) || corridor.waypoints.length <= 0) return null;
  return corridor.waypoints.reduce((best, point) => {
    const world = routeWaypointToWorld(point);
    if (!world) return best;
    return !best || distance(position.x, position.y, world.x, world.y) < distance(position.x, position.y, best.x, best.y) ? world : best;
  }, null);
}

function corridorWaypointsToWorld(corridor, reverse = false) {
  const points = (corridor?.waypoints ?? []).map(routeWaypointToWorld).filter(Boolean);
  return reverse ? points.reverse() : points;
}

function huntAreaBounds(areaId) {
  if (areaId === 'coast') return { x: CONFIG.world.coastX, y: CONFIG.world.coastY, w: CONFIG.world.coastW, h: CONFIG.world.coastH };
  return { x: CONFIG.world.coastX, y: CONFIG.world.coastY, w: CONFIG.world.coastW, h: CONFIG.world.coastH };
}

function randomHuntAreaPoint(areaId) {
  const area = huntAreaBounds(areaId);
  return gridToWorld(Math.floor(randomRange(area.x, area.x + area.w)), Math.floor(randomRange(area.y, area.y + area.h)));
}

function warnNoHuntCorridor(seal) {
  if (!seal) return;
  seal.wanderTimer = CONFIG.seal.wanderSeconds;
  seal.state = 'idle';
  seal.target = null;
  seal.path = [];
  if (!seal.warnedNoHuntCorridor) {
    seal.warnedNoHuntCorridor = true;
    logMessage('狩猟用の通り道がないため、あざらしは待機しています。');
  }
}

function villageWanderPoint() {
  return gridToWorld(Math.floor(randomRange(CONFIG.expansion.startX, CONFIG.expansion.startX + CONFIG.expansion.startW)), Math.floor(randomRange(CONFIG.expansion.startY, CONFIG.expansion.startY + CONFIG.expansion.startH)));
}

