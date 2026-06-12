function createNewGameState() {
  return {
    phase: CONFIG.phase.start,
    player: { g: 0 },
    residentName: CONFIG.resident.defaultName,
    camera: { x: CONFIG.camera.x, y: CONFIG.camera.y, zoom: CONFIG.camera.zoom, dragging: false, dragMoved: false, dragStartX: 0, dragStartY: 0, lastMouseX: 0, lastMouseY: 0 },
    input: { keys: {}, mouseWorld: { x: 0, y: 0 }, mouseTile: { x: -1, y: -1 } },
    ui: { activeBottomTab: null, selectedTool: null, selectedSealId: null, selectedPersonRosterId: null, selectedDungeonId: null, selectedFacilityId: null, buildCategory: 'road', placementCategory: 'facility', panelCollapsed: true, message: '', directionIndex: 2, placementFeedback: null, roadEdit: createRoadEditState(), lastUiUpdate: 0, needsHudUpdate: true, needsPanelUpdate: true, suppressUiClickUntil: 0, panelScrollTopByTab: {}, renderedBottomPanelTab: null, sealList: { filter: 'all', sortKey: 'name', sortDir: 'asc' } },
    world: { tiles: [], roads: [], objects: [], nextObjectId: 1 },
    seals: [],
    visitorProfiles: createDefaultVisitorProfiles(),
    relicInventory: [],
    shopCatalog: { unlockedItemIds: [], discoveredAt: {} },
    monsters: [],
    dungeons: [],
    dungeonProgress: { unlocked: {}, clearCounts: {}, totalClears: 0 },
    images: {},
    logs: [],
    timers: { spawn: 0, monsterSpawn: 0, visitorSpawn: 0, dungeonSpawnMs: 0, ui: 0 },
    time: { timeScale: CONFIG.TIME.DEFAULT_SCALE },
    save: { autoSaveTimerMs: 0, lastSavedAt: null, statusText: '' },
    village: { knownness: CONFIG.knownness.initial, clearCount: 0 },
    calendar: { year: 1, month: 1, week: 1, weekTimerMs: 0 },
    stats: { monthlyHunts: 0, monthlyKnownnessGained: 0, monthlyPlayerIncome: 0 },
    frameTemps: { occupied: new Set(), usableFacilities: [], toRemoveMonsters: [] },
    warnings: { visitorSpawnBlocked: false },
    lastTime: performance.now()
  };
}

function createRoadEditState() {
  return {
    active: false,
    mode: null,
    startTile: null,
    currentTile: null,
    previewTiles: [],
    validTiles: [],
    invalidTiles: [],
    routeStyle: 'auto'
  };
}

function normalizeVisitorBaseStats(baseStats) {
  return {
    maxHp: safeFiniteNumber(baseStats?.maxHp, CONFIG.seal.maxHp, 1),
    attack: safeFiniteNumber(baseStats?.attack, CONFIG.seal.attack, 0),
    defense: safeFiniteNumber(baseStats?.defense, CONFIG.seal.defense, 0)
  };
}

function createDefaultVisitorProfiles() {
  return (CONFIG.visitor?.profiles ?? []).map(profile => {
    const threshold = safeFiniteNumber(profile?.unlockedAtKnownness, 0, 0);
    return {
      id: String(profile?.id ?? ''),
      name: String(profile?.name ?? CONFIG.resident.defaultName),
      personality: String(profile?.personality ?? 'balanced'),
      unlockedAtKnownness: threshold,
      baseStats: normalizeVisitorBaseStats(profile?.baseStats),
      level: clampInteger(profile?.level, 1, Number.MAX_SAFE_INTEGER, 1),
      exp: safeFiniteNumber(profile?.exp, 0, 0),
      favor: safeFiniteNumber(profile?.favor, 0, 0),
      visits: clampInteger(profile?.visits, 0, Number.MAX_SAFE_INTEGER, 0),
      unlocked: threshold <= CONFIG.knownness.initial,
      equipment: normalizeEquipment(profile?.equipment),
      gearBudget: safeFiniteNumber(profile?.gearBudget, 0, 0),
      dungeonRuns: clampInteger(profile?.dungeonRuns, 0, Number.MAX_SAFE_INTEGER, 0),
      dungeonClears: clampInteger(profile?.dungeonClears, 0, Number.MAX_SAFE_INTEGER, 0),
      dungeonBattles: clampInteger(profile?.dungeonBattles, 0, Number.MAX_SAFE_INTEGER, 0),
      chestsOpened: clampInteger(profile?.chestsOpened, 0, Number.MAX_SAFE_INTEGER, 0)
    };
  });
}

function normalizeEquipment(equipment) {
  return {
    weapon: getItemDef(equipment?.weapon)?.id ?? null,
    armor: getItemDef(equipment?.armor)?.id ?? null,
    accessory: getItemDef(equipment?.accessory)?.id ?? null
  };
}

function normalizeRelicInventory(inventory) {
  if (!Array.isArray(inventory)) return [];
  const counts = new Map();
  for (const entry of inventory) {
    const itemId = String(entry?.itemId ?? entry?.id ?? '');
    if (!getItemDef(itemId)) continue;
    const count = clampInteger(entry?.count, 1, Number.MAX_SAFE_INTEGER, 1);
    counts.set(itemId, (counts.get(itemId) ?? 0) + count);
  }
  return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
}

function normalizeShopCatalog(catalog, relicInventory = []) {
  const ids = new Set(Array.isArray(catalog?.unlockedItemIds) ? catalog.unlockedItemIds.filter(id => getItemDef(id)).map(String) : []);
  for (const relic of relicInventory ?? []) if (getItemDef(relic?.itemId)) ids.add(String(relic.itemId));
  const discoveredAt = {};
  for (const id of ids) discoveredAt[id] = safeFiniteNumber(catalog?.discoveredAt?.[id], Date.now(), 0);
  return { unlockedItemIds: [...ids], discoveredAt };
}

function getItemDef(itemId) {
  const id = String(itemId ?? '');
  return CONFIG.ITEMS?.[id] ?? null;
}

function getEquipmentSlotForItem(itemDef) {
  const type = String(itemDef?.type ?? '');
  return (CONFIG.EQUIPMENT?.SLOT_TYPES ?? []).includes(type) ? type : null;
}

function getEquippedItem(seal, slot) {
  const normalizedSlot = (CONFIG.EQUIPMENT?.SLOT_TYPES ?? []).includes(String(slot ?? '')) ? String(slot) : null;
  return normalizedSlot ? getItemDef(seal?.equipment?.[normalizedSlot]) : null;
}

function getEquipmentScore(itemDef) {
  if (!itemDef) return 0;
  const type = String(itemDef?.type ?? '');
  const attack = safeFiniteNumber(itemDef?.attackBonus, 0, 0);
  const defense = safeFiniteNumber(itemDef?.defenseBonus, 0, 0);
  const hp = safeFiniteNumber(itemDef?.hpBonus, 0, 0);
  const favor = safeFiniteNumber(itemDef?.favorBonus, 0, 0);
  if (type === 'weapon') return attack * CONFIG.EQUIPMENT.SCORE_ATTACK_WEIGHT + defense + hp * 0.1 + favor * CONFIG.EQUIPMENT.SCORE_FAVOR_WEIGHT;
  if (type === 'armor') return defense * CONFIG.EQUIPMENT.SCORE_DEFENSE_WEIGHT + hp * CONFIG.EQUIPMENT.SCORE_HP_WEIGHT + attack + favor * CONFIG.EQUIPMENT.SCORE_FAVOR_WEIGHT;
  if (type === 'accessory') return attack * CONFIG.EQUIPMENT.SCORE_ATTACK_WEIGHT + defense * CONFIG.EQUIPMENT.SCORE_DEFENSE_WEIGHT + hp * CONFIG.EQUIPMENT.SCORE_HP_WEIGHT + favor * CONFIG.EQUIPMENT.SCORE_FAVOR_WEIGHT;
  return 0;
}

function getCurrentEquipmentScore(seal, slot) {
  return getEquipmentScore(getEquippedItem(seal, slot));
}

function getSealEffectiveStats(seal) {
  const baseAttack = safeFiniteNumber(seal?.attack, CONFIG.seal.attack, 0);
  const baseDefense = safeFiniteNumber(seal?.defense, CONFIG.seal.defense, 0);
  const baseMaxHp = safeFiniteNumber(seal?.maxHp, CONFIG.seal.maxHp, 1);
  const items = (CONFIG.EQUIPMENT?.SLOT_TYPES ?? []).map(slot => getEquippedItem(seal, slot)).filter(Boolean);
  return items.reduce((stats, item) => ({
    attack: stats.attack + safeFiniteNumber(item?.attackBonus, 0, 0),
    defense: stats.defense + safeFiniteNumber(item?.defenseBonus, 0, 0),
    maxHp: stats.maxHp + safeFiniteNumber(item?.hpBonus, 0, 0)
  }), { attack: baseAttack, defense: baseDefense, maxHp: baseMaxHp });
}

function getEquipmentScoreForSeal(seal, itemDef) {
  return seal && itemDef ? getEquipmentScore(itemDef) : 0;
}

function getEquipmentUpgradeValueForSeal(seal, itemDef) {
  const slot = getEquipmentSlotForItem(itemDef);
  if (!seal || !slot) return 0;
  return getEquipmentScore(itemDef) - getCurrentEquipmentScore(seal, slot);
}

function isEquipmentUpgradeForSeal(seal, itemDef) {
  return getEquipmentUpgradeValueForSeal(seal, itemDef) > 0;
}

function facilitySellsItem(facility, itemDef) {
  if (!facility || !isFacilityUsable(facility) || !itemDef) return false;
  const slot = getEquipmentSlotForItem(itemDef);
  const soldTypes = CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES?.[facility?.type] ?? [];
  return !!slot && soldTypes.includes(slot);
}

function getShopItemCandidatesForFacility(facility) {
  if (!facility || !isFacilityUsable(facility)) return [];
  const unlockedIds = new Set((gameState.shopCatalog?.unlockedItemIds ?? []).filter(id => getItemDef(id)).map(String));
  const starterMaxTier = safeFiniteNumber(CONFIG.EQUIPMENT?.STARTER_MAX_TIER, 0, 0);
  const items = Object.values(CONFIG.ITEMS ?? {}).filter(item => {
    if (!facilitySellsItem(facility, item)) return false;
    if (unlockedIds.has(String(item?.id ?? ''))) return true;
    return safeFiniteNumber(item?.tier, Number.POSITIVE_INFINITY, 0) <= starterMaxTier;
  });
  items.sort((a, b) => safeFiniteNumber(a?.price, 0, 0) - safeFiniteNumber(b?.price, 0, 0));
  return items;
}

function getUnlockedShopItemsForFacility(facility) {
  return getShopItemCandidatesForFacility(facility);
}

function chooseCheapestAffordableUpgrade(seal, facility) {
  const budget = safeFiniteNumber(seal?.gearBudget, 0, 0);
  const candidates = getShopItemCandidatesForFacility(facility)
    .filter(item => safeFiniteNumber(item?.price, 0, 0) <= budget)
    .filter(item => isEquipmentUpgradeForSeal(seal, item));
  candidates.sort((a, b) => (safeFiniteNumber(a?.price, 0, 0) - safeFiniteNumber(b?.price, 0, 0)) || (getEquipmentUpgradeValueForSeal(seal, b) - getEquipmentUpgradeValueForSeal(seal, a)));
  return candidates[0] ?? null;
}

function chooseBestAffordableEquipmentUpgrade(seal, facility) {
  return chooseCheapestAffordableUpgrade(seal, facility);
}

function buyEquipmentUpgrade(seal, itemDef, facility) {
  const item = typeof itemDef === 'string' ? getItemDef(itemDef) : getItemDef(itemDef?.id);
  const slot = getEquipmentSlotForItem(item);
  if (!seal || !item || !slot || !facilitySellsItem(facility, item) || !isEquipmentUpgradeForSeal(seal, item)) return false;
  const price = safeFiniteNumber(item?.price, 0, 0);
  if (safeFiniteNumber(seal?.gearBudget, 0, 0) < price) return false;
  const oldItem = getEquippedItem(seal, slot);
  seal.gearBudget = safeFiniteNumber(seal?.gearBudget, 0, 0) - price;
  seal.equipment = normalizeEquipment({ ...seal.equipment, [slot]: item.id });
  addPlayerIncome(price);
  addFavor(seal, safeFiniteNumber(CONFIG.EQUIPMENT?.PURCHASE_FAVOR_GAIN, 0, 0) + safeFiniteNumber(item?.favorBonus, 0, 0));
  logMessage(`${seal.name} が ${item.name} を購入して装備しました`);
  if (oldItem) logMessage('古い装備は破棄されました');
  return true;
}

function buyAndEquipItem(seal, itemId, facility) {
  return buyEquipmentUpgrade(seal, itemId, facility);
}

function unlockCatalogItem(itemId, source = '') {
  const item = getItemDef(itemId);
  if (!item) return false;
  gameState.shopCatalog = normalizeShopCatalog(gameState.shopCatalog, gameState.relicInventory);
  const ids = gameState.shopCatalog.unlockedItemIds;
  if (ids.includes(item.id)) return false;
  ids.push(item.id);
  gameState.shopCatalog.discoveredAt[item.id] = Date.now();
  if (source) logMessage(`${item.name} を発見！商品に追加されました`);
  return true;
}

function addRelicItem(itemId, count = 1, source = '') {
  const item = getItemDef(itemId);
  if (!item) return false;
  gameState.relicInventory = normalizeRelicInventory(gameState.relicInventory);
  const existing = gameState.relicInventory.find(entry => entry?.itemId === item.id);
  if (existing) existing.count = clampInteger(existing.count, 0, Number.MAX_SAFE_INTEGER, 0) + clampInteger(count, 1, Number.MAX_SAFE_INTEGER, 1);
  else gameState.relicInventory.push({ itemId: item.id, count: clampInteger(count, 1, Number.MAX_SAFE_INTEGER, 1) });
  unlockCatalogItem(item.id, source);
  gameState.shopCatalog = normalizeShopCatalog(gameState.shopCatalog, gameState.relicInventory);
  return true;
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
    return normalizeFacilityFields({
      id: String(o?.id || `obj-${index + 1}`),
      type: tool.id,
      kind: tool.kind,
      x: clampInteger(o?.x, 0, CONFIG.world.cols - 1, 0),
      y: clampInteger(o?.y, 0, CONFIG.world.rows - 1, 0),
      w: Math.max(1, clampInteger(o?.w, 1, CONFIG.world.cols, tool.w)),
      h: Math.max(1, clampInteger(o?.h, 1, CONFIG.world.rows, tool.h)),
      directionIndex: clampInteger(o?.directionIndex, 0, CONFIG.directions.length - 1, 0),
      level: o?.level,
      useCount: o?.useCount,
      facilityExp: o?.facilityExp ?? o?.useProgress,
      useProgress: o?.useProgress ?? o?.facilityExp,
      totalIncome: o?.totalIncome
    });
  }).filter(Boolean);
}


const LEVELABLE_FACILITY_TYPES = Object.freeze(['inn', 'restaurant', 'manjuShop']);

function isLevelableFacility(facility) {
  return facility?.kind === 'facility' && LEVELABLE_FACILITY_TYPES.includes(String(facility?.type ?? ''));
}

function getFacilityLevelConfig() {
  return CONFIG.FACILITY_LEVELS ?? { maxLevel: 1, thresholds: [0], priceMultiplierPerLevel: 0, healingMultiplierPerLevel: 0, incomeMultiplierPerLevel: 0 };
}

function normalizeFacilityFields(facility) {
  if (!facility || typeof facility !== 'object') return facility;
  if (!isLevelableFacility(facility)) return facility;
  const cfg = getFacilityLevelConfig();
  facility.level = clampInteger(facility.level, 1, safeFiniteNumber(cfg.maxLevel, 1, 1), 1);
  facility.useCount = clampInteger(facility.useCount, 0, Number.MAX_SAFE_INTEGER, 0);
  facility.facilityExp = clampInteger(facility.facilityExp ?? facility.useProgress, 0, Number.MAX_SAFE_INTEGER, facility.useCount);
  facility.useProgress = facility.facilityExp;
  facility.totalIncome = safeFiniteNumber(facility.totalIncome, 0, 0);
  return facility;
}

function getFacilityLevel(facility) {
  const maxLevel = safeFiniteNumber(getFacilityLevelConfig().maxLevel, 1, 1);
  return clampInteger(facility?.level, 1, maxLevel, 1);
}

function getFacilityUseCount(facility) {
  return clampInteger(facility?.useCount, 0, Number.MAX_SAFE_INTEGER, 0);
}

function getNextFacilityLevelThreshold(facility) {
  if (!isLevelableFacility(facility)) return null;
  const cfg = getFacilityLevelConfig();
  const nextLevel = getFacilityLevel(facility) + 1;
  if (nextLevel > safeFiniteNumber(cfg.maxLevel, 1, 1)) return null;
  const thresholds = Array.isArray(cfg.thresholds) ? cfg.thresholds : [0];
  const threshold = thresholds[nextLevel - 1];
  return Number.isFinite(Number(threshold)) ? Number(threshold) : null;
}

function getFacilityPrice(facility) {
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility?.type] ?? {};
  const base = safeFiniteNumber(cfg.basePrice ?? cfg.fee ?? cfg.spendPerVisit, 0, 0);
  const levelBonus = Math.max(0, getFacilityLevel(facility) - 1) * safeFiniteNumber(getFacilityLevelConfig().priceMultiplierPerLevel, 0, 0);
  return Math.max(0, Math.round(base * (1 + levelBonus) * (1 + facilityBonus(facility))));
}

function getFacilityHealAmount(facility) {
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility?.type] ?? {};
  const base = safeFiniteNumber(cfg.baseHeal ?? cfg.healPerSecond, 0, 0);
  const levelBonus = Math.max(0, getFacilityLevel(facility) - 1) * safeFiniteNumber(getFacilityLevelConfig().healingMultiplierPerLevel, 0, 0);
  return Math.max(0, base * (1 + levelBonus) * (1 + facilityBonus(facility)));
}

function getFacilityIncomeMultiplier(facility) {
  if (!isLevelableFacility(facility)) return 1;
  const levelBonus = Math.max(0, getFacilityLevel(facility) - 1) * safeFiniteNumber(getFacilityLevelConfig().incomeMultiplierPerLevel, 0, 0);
  return Math.max(1, 1 + levelBonus);
}

function getFacilityIncomeAmount(facility, paidAmount) {
  return Math.max(0, Math.round(safeFiniteNumber(paidAmount, 0, 0) * getFacilityIncomeMultiplier(facility)));
}

function levelUpFacilityIfNeeded(facility) {
  if (!isLevelableFacility(facility) || !(gameState.world?.objects ?? []).includes(facility)) return;
  normalizeFacilityFields(facility);
  const cfg = getFacilityLevelConfig();
  while (facility.level < safeFiniteNumber(cfg.maxLevel, 1, 1)) {
    const threshold = getNextFacilityLevelThreshold(facility);
    if (!Number.isFinite(threshold) || facility.useCount < threshold) break;
    facility.level += 1;
    const facilityName = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility.type]?.name ?? (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility.type]?.label ?? '施設';
    logMessage(`${facilityName} がLv${facility.level}になりました！`);
  }
}

function registerFacilityUse(facility, seal, paidAmount) {
  if (!isLevelableFacility(facility) || !(gameState.world?.objects ?? []).includes(facility)) return 0;
  normalizeFacilityFields(facility);
  const income = getFacilityIncomeAmount(facility, paidAmount);
  facility.useCount += 1;
  facility.facilityExp = facility.useCount;
  facility.useProgress = facility.facilityExp;
  facility.totalIncome = safeFiniteNumber(facility.totalIncome, 0, 0) + income;
  if (seal) {
    seal.facilityUseCounts = normalizeFacilityUseCounts(seal.facilityUseCounts);
    seal.facilityUseCounts[facility.type] = (seal.facilityUseCounts?.[facility.type] ?? 0) + 1;
    seal.lastFacilityId = facility.id;
    if (seal.type === 'visitor') seal.facilitiesUsedThisVisit = clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0) + 1;
  }
  levelUpFacilityIfNeeded(facility);
  return income;
}

function getFacilityLevelProgressText(facility) {
  if (!isLevelableFacility(facility)) return '';
  const threshold = getNextFacilityLevelThreshold(facility);
  if (!Number.isFinite(threshold)) return 'MAX';
  return `${getFacilityUseCount(facility)}/${threshold}`;
}

function normalizeSeals(seals) {
  if (!Array.isArray(seals)) return [];
  const states = Object.values(CONFIG.sealStates ?? {});
  return seals.map((s, index) => normalizeSeal(s, index)).filter(Boolean).map(seal => {
    if (seal.state === 'resting') seal.state = 'usingFacility';
    if (!states.includes(seal.state)) seal.state = seal.type === 'visitor' ? 'arrivingFromSea' : 'choosingHuntArea';
    return seal;
  });
}


function normalizeSealState(state, isVisitor) {
  const legacyVisitorStates = { arriving: 'arrivingFromSea', arrived: 'choosingArrivalAction', staying: 'choosingArrivalAction', choosing: 'choosingArrivalAction', choosingFacility: 'choosingPostHuntFacility', leaving: 'leavingToSea', movingToHuntExit: 'movingToHuntArea' };
  const next = isVisitor ? (legacyVisitorStates[state] ?? state) : (state === 'movingToHuntArea' ? 'movingToHuntExit' : state);
  const valid = Object.values(CONFIG.sealStates ?? {});
  return valid.includes(next) ? next : (isVisitor ? 'arrivingFromSea' : 'choosingHuntArea');
}

function normalizeSeal(s, index) {
  if (!s || typeof s !== 'object') return null;
  const entry = findNearestPassableSpawnPoint(getVisitorPreferredSpawnPoint()) ?? gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY);
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
    gearBudget: safeFiniteNumber(s?.gearBudget, 0, 0),
    equipment: normalizeEquipment(s?.equipment),
    exp: safeFiniteNumber(s?.exp, 0, 0),
    level: clampInteger(s?.level, 1, Number.MAX_SAFE_INTEGER, 1),
    favor: safeFiniteNumber(s?.favor, 0, 0),
    state: normalizeSealState(String(s?.state || (isVisitor ? 'arrivingFromSea' : 'choosingHuntArea')), isVisitor),
    targetId: s?.targetId ? String(s.targetId) : null,
    target: s?.target ? { x: safeFiniteNumber(s.target?.x, entry.x), y: safeFiniteNumber(s.target?.y, entry.y), reason: String(s.target?.reason ?? '') } : null,
    selectedHuntAreaId: s?.selectedHuntAreaId ? String(s.selectedHuntAreaId) : null,
    visits: clampInteger(s?.visits, 0, Number.MAX_SAFE_INTEGER, isVisitor ? 1 : 0),
    facilityUseCounts: normalizeFacilityUseCounts(s?.facilityUseCounts),
    lastFacilityId: s?.lastFacilityId ? String(s.lastFacilityId) : null,
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
    currentAction: s?.currentAction ? String(s.currentAction) : '',
    choosingTicks: clampInteger(s?.choosingTicks, 0, Number.MAX_SAFE_INTEGER, 0),
    lastTransitionLogKey: s?.lastTransitionLogKey ? String(s.lastTransitionLogKey) : '',
    path: [],
    pathTargetKey: null,
    warnedPathFallback: s?.warnedPathFallback === true,
    questingReturnState: s?.questingReturnState ? String(s.questingReturnState) : null,
    questingDungeonId: s?.questingDungeonId ? String(s.questingDungeonId) : null,
    expeditionId: s?.expeditionId ? String(s.expeditionId) : (s?.questingDungeonId ? String(s.questingDungeonId) : null),
    dungeonRuns: clampInteger(s?.dungeonRuns, 0, Number.MAX_SAFE_INTEGER, 0),
    dungeonClears: clampInteger(s?.dungeonClears, 0, Number.MAX_SAFE_INTEGER, 0),
    dungeonBattles: clampInteger(s?.dungeonBattles, 0, Number.MAX_SAFE_INTEGER, 0),
    chestsOpened: clampInteger(s?.chestsOpened, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function normalizeFacilityUseCounts(counts) {
  return {
    inn: clampInteger(counts?.inn, 0, Number.MAX_SAFE_INTEGER, 0),
    restaurant: clampInteger(counts?.restaurant, 0, Number.MAX_SAFE_INTEGER, 0),
    manjuShop: clampInteger(counts?.manjuShop, 0, Number.MAX_SAFE_INTEGER, 0),
    blacksmith: clampInteger(counts?.blacksmith, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function normalizeVisitorProfiles(profiles) {
  const saved = Array.isArray(profiles) ? profiles : [];
  return createDefaultVisitorProfiles().map(defaultProfile => {
    const loaded = saved.find(p => p?.id === defaultProfile.id) ?? {};
    return {
      ...defaultProfile,
      baseStats: normalizeVisitorBaseStats(defaultProfile.baseStats),
      level: clampInteger(loaded?.level, 1, Number.MAX_SAFE_INTEGER, defaultProfile.level),
      exp: safeFiniteNumber(loaded?.exp, defaultProfile.exp, 0),
      favor: safeFiniteNumber(loaded?.favor, defaultProfile.favor, 0),
      visits: clampInteger(loaded?.visits, 0, Number.MAX_SAFE_INTEGER, defaultProfile.visits),
      unlocked: loaded?.unlocked === true || defaultProfile.unlocked,
      equipment: normalizeEquipment(loaded?.equipment ?? defaultProfile.equipment),
      gearBudget: safeFiniteNumber(loaded?.gearBudget, defaultProfile.gearBudget, 0),
      dungeonRuns: clampInteger(loaded?.dungeonRuns, 0, Number.MAX_SAFE_INTEGER, defaultProfile.dungeonRuns ?? 0),
      dungeonClears: clampInteger(loaded?.dungeonClears, 0, Number.MAX_SAFE_INTEGER, defaultProfile.dungeonClears ?? 0),
      dungeonBattles: clampInteger(loaded?.dungeonBattles, 0, Number.MAX_SAFE_INTEGER, defaultProfile.dungeonBattles ?? 0),
      chestsOpened: clampInteger(loaded?.chestsOpened, 0, Number.MAX_SAFE_INTEGER, defaultProfile.chestsOpened ?? 0)
    };
  });
}

function getVisitorProfileById(id) {
  return (gameState.visitorProfiles ?? []).find(profile => profile?.id === id) ?? (CONFIG.visitor?.profiles ?? []).find(profile => profile?.id === id) ?? null;
}

function getSealById(id) {
  return (gameState.seals ?? []).find(seal => seal?.id === id) ?? null;
}

function assetKeyForVisitorProfile(profileId) {
  const id = String(profileId || '');
  if (id.includes('kurakake')) return 'seals.kurakake';
  if (id.includes('tategoto')) return 'seals.tategoto';
  if (id.includes('goma')) return 'seals.goma';
  return 'seals.resident';
}


function normalizeDungeonProgress(progress) {
  const clearCounts = {};
  for (const [key, value] of Object.entries(progress?.clearCounts ?? {})) clearCounts[String(key)] = clampInteger(value, 0, Number.MAX_SAFE_INTEGER, 0);
  const unlocked = {};
  for (const type of Object.values(CONFIG.DUNGEONS?.types ?? {})) {
    for (const levelDef of type?.levels ?? []) {
      const key = getDungeonLevelKey(type.id, levelDef.level);
      unlocked[key] = progress?.unlocked?.[key] === true;
    }
  }
  return { unlocked, clearCounts, totalClears: clampInteger(progress?.totalClears, 0, Number.MAX_SAFE_INTEGER, 0) };
}

function getDungeonLevelKey(typeId, level) { return `${String(typeId ?? '')}:${clampInteger(level, 1, Number.MAX_SAFE_INTEGER, 1)}`; }

function getDungeonTypeDef(typeId) { return CONFIG.DUNGEONS?.types?.[String(typeId ?? '')] ?? null; }
function getDungeonAreaDef(areaId) { return CONFIG.DUNGEONS?.spawnAreas?.[String(areaId ?? '')] ?? null; }

function getDungeonLevelDef(typeId, level) {
  const type = getDungeonTypeDef(typeId);
  const targetLevel = clampInteger(level, 1, Number.MAX_SAFE_INTEGER, 1);
  const levelDef = (type?.levels ?? []).find(item => clampInteger(item?.level, 1, Number.MAX_SAFE_INTEGER, 1) === targetLevel) ?? null;
  return levelDef ? { ...levelDef, typeId: type.id, typeName: type.name, areaId: type.areaId } : null;
}

function isDungeonLevelUnlocked(typeId, level) {
  gameState.dungeonProgress = normalizeDungeonProgress(gameState.dungeonProgress);
  return gameState.dungeonProgress.unlocked?.[getDungeonLevelKey(typeId, level)] === true;
}

function normalizeDungeons(dungeons) {
  if (!Array.isArray(dungeons)) return [];
  const states = Object.values(CONFIG.dungeon?.states ?? { available: 'available', assembling: 'assembling', running: 'running', returning: 'returning', completed: 'completed', expired: 'expired' });
  return dungeons.map((dungeon, index) => {
    const typeId = String(dungeon?.typeId ?? dungeon?.type ?? '');
    const level = clampInteger(dungeon?.level, 1, Number.MAX_SAFE_INTEGER, 1);
    const levelDef = getDungeonLevelDef(typeId, level);
    const type = getDungeonTypeDef(typeId);
    const area = getDungeonAreaDef(dungeon?.areaId ?? levelDef?.areaId ?? type?.areaId ?? 'coast');
    if (!type || !levelDef || !area) return null;
    const point = isValidDungeonWorldPoint(dungeon?.x, dungeon?.y, area.id) ? { x: safeFiniteNumber(dungeon.x, 0), y: safeFiniteNumber(dungeon.y, 0) } : findDungeonSpawnPoint(area.id);
    if (!point) return null;
    const state = states.includes(dungeon?.state) ? dungeon.state : 'available';
    const nodes = normalizeDungeonNodes(dungeon?.nodes, levelDef);
    return {
      id: String(dungeon?.id || `dungeon-${Date.now()}-${index}`),
      typeId: type.id,
      type: type.id,
      level: levelDef.level,
      name: String(dungeon?.name || `${levelDef.name || type.name} Lv${levelDef.level}`),
      areaId: area.id,
      x: safeFiniteNumber(point.x, 0),
      y: safeFiniteNumber(point.y, 0),
      state,
      expiresInMs: safeFiniteNumber(dungeon?.expiresInMs, CONFIG.DUNGEONS?.expiresInMs, 0),
      progressMs: safeFiniteNumber(dungeon?.progressMs, 0, 0),
      durationMs: getDungeonDurationMs(levelDef),
      recruitCost: safeFiniteNumber(dungeon?.recruitCost, levelDef.recruitCost, 0),
      participantIds: normalizeDungeonParticipantIds(dungeon?.participantIds),
      nodes,
      currentNodeIndex: clampInteger(dungeon?.currentNodeIndex, 0, ['returning', 'completed'].includes(state) ? nodes.length : Math.max(0, nodes.length - 1), 0),
      nodeTimerMs: safeFiniteNumber(dungeon?.nodeTimerMs, 0, 0),
      expeditionLog: normalizeDungeonLog(dungeon?.expeditionLog),
      reward: normalizeDungeonReward(dungeon?.reward),
      startedAt: safeFiniteNumber(dungeon?.startedAt, null, 0) || null,
      completedAt: safeFiniteNumber(dungeon?.completedAt, null, 0) || null,
      rewardPreview: getDungeonRewardPreview({ typeId: type.id, level: levelDef.level }),
      enemyRefs: Array.isArray(dungeon?.enemyRefs) ? dungeon.enemyRefs.map(String) : [],
      enemyTypes: ['crab'],
      dropTableId: '',
      completedDisplayMs: safeFiniteNumber(dungeon?.completedDisplayMs, CONFIG.dungeon?.completedDisplayMs ?? 0, 0)
    };
  }).filter(Boolean);
}

function normalizeDungeonNodes(nodes, levelDef) {
  const valid = Object.values(CONFIG.DUNGEONS?.nodeTypes ?? {});
  const pattern = Array.isArray(levelDef?.nodePattern) && levelDef.nodePattern.length > 0 ? levelDef.nodePattern : ['entrance', 'battle', 'chest', 'boss', 'exit'];
  const source = Array.isArray(nodes) && nodes.length > 0 ? nodes : pattern.map(nodeType => ({ type: nodeType }));
  const multiplier = safeFiniteNumber(levelDef?.durationMultiplier, 1, 0.1);
  return source.map((node, index) => {
    const fallbackType = pattern[index] ?? 'battle';
    const nodeType = valid.includes(node?.type) ? node.type : fallbackType;
    return {
      id: String(node?.id || `node-${index}-${nodeType}`),
      type: nodeType,
      durationMs: safeFiniteNumber(node?.durationMs, (CONFIG.DUNGEONS?.nodeDurationsMs?.[nodeType] ?? 3500) * multiplier, 1),
      resolved: node?.resolved === true,
      logText: String(node?.logText ?? ''),
      rewardPart: normalizeDungeonReward(node?.rewardPart)
    };
  });
}

function getDungeonDurationMs(levelDef) {
  const nodes = normalizeDungeonNodes(null, levelDef);
  return nodes.reduce((sum, node) => sum + safeFiniteNumber(node?.durationMs, 0, 0), 0);
}

function normalizeDungeonReward(reward) {
  return {
    g: safeFiniteNumber(reward?.g, 0, 0),
    exp: safeFiniteNumber(reward?.exp, 0, 0),
    knownness: safeFiniteNumber(reward?.knownness, 0, 0),
    items: Array.isArray(reward?.items) ? reward.items.map(item => ({ itemId: String(item?.itemId ?? ''), count: clampInteger(item?.count, 1, Number.MAX_SAFE_INTEGER, 1) })).filter(item => getItemDef(item.itemId)) : []
  };
}

function normalizeDungeonLog(log) {
  const max = clampInteger(CONFIG.dungeon?.logMax, 1, Number.MAX_SAFE_INTEGER, 8);
  return Array.isArray(log) ? log.map(String).filter(Boolean).slice(0, max) : [];
}

function normalizeDungeonParticipantIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map(participant => typeof participant === 'object' ? {
    kind: String(participant?.kind ?? 'seal'),
    id: String(participant?.id ?? participant?.sealId ?? ''),
    sealId: participant?.sealId ? String(participant.sealId) : null,
    profileId: participant?.profileId ? String(participant.profileId) : null,
    name: String(participant?.name ?? '')
  } : { kind: 'seal', id: String(participant), sealId: String(participant), profileId: null, name: '' }).filter(participant => participant.id);
}

function isValidDungeonWorldPoint(x, y, areaId) {
  const gx = Math.floor(safeFiniteNumber(x, -1) / CONFIG.world.tile);
  const gy = Math.floor(safeFiniteNumber(y, -1) / CONFIG.world.tile);
  const area = getDungeonAreaDef(areaId);
  return !!area && inRect(gx, gy, area.bounds?.x ?? 0, area.bounds?.y ?? 0, area.bounds?.w ?? 0, area.bounds?.h ?? 0) && !isNearVillageTile(gx, gy) && isPassableTile(gx, gy);
}

function isNearVillageTile(gx, gy) {
  const minDistance = safeFiniteNumber(CONFIG.dungeon?.minDistanceFromVillageTiles, 0, 0);
  const cx = CONFIG.expansion.startX + CONFIG.expansion.startW / 2;
  const cy = CONFIG.expansion.startY + CONFIG.expansion.startH / 2;
  return distance(gx, gy, cx, cy) < minDistance;
}

function findDungeonSpawnPoint(areaId) {
  const area = getDungeonAreaDef(areaId);
  const attempts = clampInteger(CONFIG.dungeon?.spawnAttempts, 1, Number.MAX_SAFE_INTEGER, 20);
  if (!area) return null;
  for (let i = 0; i < attempts; i += 1) {
    const gx = Math.floor(randomRange(area.bounds.x, area.bounds.x + area.bounds.w));
    const gy = Math.floor(randomRange(area.bounds.y, area.bounds.y + area.bounds.h));
    const point = gridToWorld(gx, gy);
    if (isValidDungeonWorldPoint(point.x, point.y, area.id)) return point;
  }
  return null;
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
  gameState.relicInventory = [];
  gameState.dungeons = [];
  gameState.dungeonProgress = normalizeDungeonProgress(null);
  updateDungeonUnlocks();
  gameState.shopCatalog = { unlockedItemIds: [], discoveredAt: {} };
  gameState.ui.selectedSealId = null;
  gameState.ui.selectedPersonRosterId = null;
  gameState.ui.selectedDungeonId = null;
  clearRoadEdit();
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
  gameState.timers.dungeonSpawnMs = 0;
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
  for (let x = CONFIG.village.roadStartX; x <= CONFIG.village.roadEndX; x += 1) if (!hasRoadAt(x, CONFIG.village.roadY)) gameState.world.roads.push({ x, y: CONFIG.village.roadY });
  for (let y = CONFIG.village.roadStartY; y <= CONFIG.village.roadEndY; y += 1) if (!hasRoadAt(CONFIG.village.roadX, y)) gameState.world.roads.push({ x: CONFIG.village.roadX, y });
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

function canPlaceAt(tileX, tileY, objectDef, directionIndex = gameState.ui?.directionIndex ?? 0) {
  const tool = objectDef ?? getTool(gameState.ui?.selectedTool);
  if (tool?.kind === 'delete') return { ok: true, reason: '' };
  if (tool?.kind === 'clear') return { ok: false, reason: '開拓ツールでは配置できません。' };
  const footprint = getRotatedFootprintSize(tool, directionIndex);
  const w = footprint.w;
  const h = footprint.h;
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
function hasRoadAt(x, y) { return roadAt(x, y); }

function normalizeRoadTile(tile) {
  if (!tile || !Number.isFinite(tile?.x) || !Number.isFinite(tile?.y)) return null;
  return { x: Math.trunc(tile.x), y: Math.trunc(tile.y) };
}

function sameRoadTile(a, b) {
  return a?.x === b?.x && a?.y === b?.y;
}

function isRoadPlaceableTile(x, y) {
  const roadTool = getTool('road');
  const routeRules = CONFIG.placement?.roadRoute ?? {};
  const tile = getTile(x, y);
  if (!tile) return false;
  if (hasRoadAt(x, y)) return routeRules.allowExistingRoads !== false;
  if (routeRules.requireBuildableLand !== false && !isBuildableTile(x, y)) return false;
  if (routeRules.blockObjects !== false && objectAt(x, y)) return false;
  return canPlaceAt(x, y, roadTool).ok === true;
}

function placeRoadAt(x, y) {
  if (!isRoadPlaceableTile(x, y) || hasRoadAt(x, y)) return false;
  gameState.world.roads.push({ x, y });
  return true;
}

function deleteRoadAt(x, y) {
  const before = gameState.world.roads.length;
  gameState.world.roads = gameState.world.roads.filter(r => !(r?.x === x && r?.y === y));
  return gameState.world.roads.length !== before;
}

function clearRoadEdit() {
  if (!gameState.ui) return;
  gameState.ui.roadEdit = createRoadEditState();
}

function getOrthogonalLineTiles(a, b) {
  const start = normalizeRoadTile(a);
  const end = normalizeRoadTile(b);
  if (!start || !end) return [];
  const tiles = [];
  const dx = Math.sign(end.x - start.x);
  const dy = Math.sign(end.y - start.y);
  if (start.y === end.y) {
    for (let x = start.x; dx >= 0 ? x <= end.x : x >= end.x; x += dx || 1) tiles.push({ x, y: start.y });
    return tiles;
  }
  if (start.x === end.x) {
    for (let y = start.y; dy >= 0 ? y <= end.y : y >= end.y; y += dy || 1) tiles.push({ x: start.x, y });
  }
  return tiles;
}

function appendUniqueRoadTile(tiles, tile) {
  const normalized = normalizeRoadTile(tile);
  if (!normalized) return;
  if (!sameRoadTile(tiles[tiles.length - 1], normalized)) tiles.push(normalized);
}

function getLShapedRouteTiles(start, end, order) {
  const a = normalizeRoadTile(start);
  const b = normalizeRoadTile(end);
  if (!a || !b) return [];
  if (a.x === b.x || a.y === b.y) return getOrthogonalLineTiles(a, b);
  const corner = order === 'vertical-first' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  const tiles = [];
  for (const tile of getOrthogonalLineTiles(a, corner)) appendUniqueRoadTile(tiles, tile);
  for (const tile of getOrthogonalLineTiles(corner, b)) appendUniqueRoadTile(tiles, tile);
  return tiles;
}

function roadRouteTileIsValid(tile, mode, index = 0) {
  const normalized = normalizeRoadTile(tile);
  const maxTiles = clampInteger(CONFIG.placement?.roadRoute?.maxTiles, 1, Number.MAX_SAFE_INTEGER, 32);
  if (!normalized || index >= maxTiles) return false;
  if (mode === 'delete') return hasRoadAt(normalized.x, normalized.y);
  return isRoadPlaceableTile(normalized.x, normalized.y);
}

function splitRoadRouteValidity(tiles, mode) {
  const previewTiles = Array.isArray(tiles) ? tiles.map(normalizeRoadTile).filter(Boolean) : [];
  const validTiles = [];
  const invalidTiles = [];
  previewTiles.forEach((tile, index) => {
    if (roadRouteTileIsValid(tile, mode, index)) validTiles.push(tile);
    else invalidTiles.push(tile);
  });
  return { previewTiles, validTiles, invalidTiles };
}

function countRoadRouteTurns(tiles) {
  let turns = 0;
  let previousDirection = null;
  for (let i = 1; i < (tiles?.length ?? 0); i += 1) {
    const a = tiles[i - 1];
    const b = tiles[i];
    const direction = Math.abs((b?.x ?? 0) - (a?.x ?? 0)) > 0 ? 'h' : 'v';
    if (previousDirection && direction !== previousDirection) turns += 1;
    previousDirection = direction;
  }
  return turns;
}

function isRoadRouteBlockedTile(tile, mode, index) {
  const normalized = normalizeRoadTile(tile);
  if (!normalized) return true;
  if (mode === 'delete') return !hasRoadAt(normalized.x, normalized.y);
  if (index >= clampInteger(CONFIG.placement?.roadRoute?.maxTiles, 1, Number.MAX_SAFE_INTEGER, 32)) return true;
  const worldTile = getTile(normalized.x, normalized.y);
  return !worldTile || objectAt(normalized.x, normalized.y) || worldTile?.terrain !== CONFIG.tileState.terrainLand || worldTile?.buildState !== CONFIG.tileState.buildable || worldTile?.obstacle !== null || worldTile?.unlocked !== true;
}

function scoreRoadRouteTiles(tiles, mode) {
  const routeRules = CONFIG.placement?.roadRoute ?? {};
  const invalidCount = splitRoadRouteValidity(tiles, mode).invalidTiles.length;
  const blockedCount = (tiles ?? []).reduce((count, tile, index) => count + (isRoadRouteBlockedTile(tile, mode, index) ? 1 : 0), 0);
  const turnCount = countRoadRouteTurns(tiles);
  const existingRoadCount = (tiles ?? []).reduce((count, tile) => count + (hasRoadAt(tile?.x, tile?.y) ? 1 : 0), 0);
  return invalidCount * safeFiniteNumber(routeRules.scoreInvalidWeight, 1000, 0)
    + blockedCount * safeFiniteNumber(routeRules.scoreBlockedWeight, 100, 0)
    + turnCount * safeFiniteNumber(routeRules.scoreTurnWeight, 10, 0)
    - existingRoadCount * safeFiniteNumber(routeRules.scoreExistingRoadBonus, 2, 0);
}

function buildRoadRoute(startTile, endTile, mode) {
  const start = normalizeRoadTile(startTile);
  const end = normalizeRoadTile(endTile);
  if (!start || !end || !getTile(start.x, start.y) || !getTile(end.x, end.y)) return [];
  const candidates = start.x === end.x || start.y === end.y
    ? [getOrthogonalLineTiles(start, end)]
    : [getLShapedRouteTiles(start, end, 'horizontal-first'), getLShapedRouteTiles(start, end, 'vertical-first')];
  return candidates.reduce((best, route) => {
    if (!best) return route;
    const diff = scoreRoadRouteTiles(route, mode) - scoreRoadRouteTiles(best, mode);
    if (diff < 0) return route;
    if (diff === 0 && route.length < best.length) return route;
    return best;
  }, null) ?? [];
}

function updateRoadEditPreview(tile) {
  const edit = gameState.ui?.roadEdit;
  const current = normalizeRoadTile(tile);
  if (!edit?.active || !current || !getTile(current.x, current.y)) return false;
  edit.currentTile = current;
  const route = buildRoadRoute(edit.startTile, current, edit.mode);
  const split = splitRoadRouteValidity(route, edit.mode);
  edit.previewTiles = split.previewTiles;
  edit.validTiles = split.validTiles;
  edit.invalidTiles = split.invalidTiles;
  return true;
}

function startRoadEdit(mode, tile) {
  const start = normalizeRoadTile(tile);
  if (!gameState.ui || !start || !getTile(start.x, start.y)) return false;
  if (mode === 'place' && !isRoadPlaceableTile(start.x, start.y)) return false;
  if (mode === 'delete' && !hasRoadAt(start.x, start.y)) return false;
  gameState.ui.roadEdit = createRoadEditState();
  gameState.ui.roadEdit.active = true;
  gameState.ui.roadEdit.mode = mode;
  gameState.ui.roadEdit.startTile = start;
  gameState.ui.roadEdit.currentTile = start;
  updateRoadEditPreview(start);
  return true;
}

function confirmRoadEdit() {
  const edit = gameState.ui?.roadEdit;
  if (!edit?.active) return false;
  const mode = edit.mode === 'delete' ? 'delete' : 'place';
  const route = buildRoadRoute(edit.startTile, edit.currentTile ?? edit.startTile, mode);
  const { validTiles, invalidTiles } = splitRoadRouteValidity(route, mode);
  let changed = 0;
  for (const tile of validTiles) {
    changed += mode === 'delete' ? (deleteRoadAt(tile.x, tile.y) ? 1 : 0) : (placeRoadAt(tile.x, tile.y) ? 1 : 0);
  }
  const feedbackTile = validTiles[0] ?? edit.startTile ?? { x: 0, y: 0 };
  if (validTiles.length <= 0) {
    logMessage(mode === 'delete' ? '道路削除できるマスがありません。' : '道路を配置できるマスがありません。');
    gameState.ui.placementFeedback = { x: feedbackTile.x, y: feedbackTile.y, ok: false, text: '有効な道路マスがありません。', timer: CONFIG.placement.feedbackSeconds };
    clearRoadEdit();
    return false;
  }
  logMessage(mode === 'delete' ? `${changed}マスの道路を削除しました。` : `${changed}マスの道路を配置しました。`);
  gameState.ui.placementFeedback = { x: feedbackTile.x, y: feedbackTile.y, ok: true, text: mode === 'delete' ? '道路を削除しました。' : '道路を配置しました。', timer: CONFIG.placement.feedbackSeconds };
  clearRoadEdit();
  return invalidTiles.length <= 0 || changed > 0;
}

function objectAt(gx, gy) { return gameState.world.objects.find(o => gx >= o?.x && gy >= o?.y && gx < (o?.x ?? 0) + (o?.w ?? 1) && gy < (o?.y ?? 0) + (o?.h ?? 1)); }

function getTool(id) { return CONFIG.tools.find(t => t.id === id) ?? CONFIG.tools[0]; }

function canPlace(type, gx, gy, directionIndex = gameState.ui?.directionIndex ?? 0) {
  return canPlaceAt(gx, gy, getTool(type), directionIndex);
}

function placeObject(type, gx, gy, directionIndex, silent) {
  const result = canPlace(type, gx, gy, directionIndex);
  if (!result.ok) {
    gameState.ui.placementFeedback = { x: gx, y: gy, ok: false, text: result.reason, timer: CONFIG.placement.feedbackSeconds };
    return false;
  }
  const tool = getTool(type);
  if (tool?.kind === 'road') {
    if (!roadAt(gx, gy)) gameState.world.roads.push({ x: gx, y: gy });
  } else if (tool?.kind !== 'delete') {
    const footprint = getRotatedFootprintSize(tool, directionIndex);
    gameState.world.objects.push(normalizeFacilityFields({ id: `obj-${gameState.world.nextObjectId++}`, type, kind: tool?.kind, x: gx, y: gy, w: footprint.w, h: footprint.h, directionIndex }));
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

function getDirectionIndexFromSide(side, fallbackIndex = 2) {
  const normalized = String(side ?? '').toLowerCase();
  const index = CONFIG.directions.findIndex(direction => direction?.name?.toLowerCase?.() === normalized[0]);
  return index >= 0 ? index : clampInteger(fallbackIndex, 0, CONFIG.directions.length - 1, 2);
}

function getDirectionSideName(directionIndex) {
  const direction = CONFIG.directions[clampInteger(directionIndex, 0, CONFIG.directions.length - 1, 2)]?.name ?? 'S';
  return { N: 'North', E: 'East', S: 'South', W: 'West' }[direction] ?? 'South';
}

function getFacilityConfig(type) {
  return (CONFIG.facilities ?? CONFIG.FACILITIES)?.[type] ?? null;
}

function getRotatedDirectionIndex(baseIndex, rotationIndex) {
  return (clampInteger(baseIndex, 0, CONFIG.directions.length - 1, 2) + clampInteger(rotationIndex, 0, CONFIG.directions.length - 1, 0)) % CONFIG.directions.length;
}

function getFacilityEntranceDirectionIndex(facility) {
  const cfg = getFacilityConfig(facility?.type) ?? {};
  const baseIndex = getDirectionIndexFromSide(cfg.entranceSide, 0);
  return getRotatedDirectionIndex(baseIndex, facility?.directionIndex ?? 0);
}

function getEntranceDirectionVector(facility) {
  const direction = CONFIG.directions[getFacilityEntranceDirectionIndex(facility)] ?? CONFIG.directions[2] ?? { name: 'S', dx: 0, dy: 1 };
  return { name: direction.name, dx: direction.dx, dy: direction.dy };
}

function getRotatedFootprintSize(definition, directionIndex = 0) {
  const w = Math.max(1, clampInteger(definition?.w, 1, CONFIG.world.cols, CONFIG.placement.decorationSize));
  const h = Math.max(1, clampInteger(definition?.h, 1, CONFIG.world.rows, CONFIG.placement.decorationSize));
  const rotation = clampInteger(directionIndex, 0, CONFIG.directions.length - 1, 0) % 2;
  return rotation === 1 ? { w: h, h: w } : { w, h };
}

function getFacilityEntranceTile(facility) {
  if (!facility) return null;
  const dir = getEntranceDirectionVector(facility);
  const x = clampInteger(facility?.x, 0, CONFIG.world.cols - 1, 0);
  const y = clampInteger(facility?.y, 0, CONFIG.world.rows - 1, 0);
  const w = Math.max(1, clampInteger(facility?.w, 1, CONFIG.world.cols, CONFIG.placement.facilitySize));
  const h = Math.max(1, clampInteger(facility?.h, 1, CONFIG.world.rows, CONFIG.placement.facilitySize));
  if (dir.name === 'N') return { x: x + Math.floor((w - 1) / 2), y: y - 1 };
  if (dir.name === 'E') return { x: x + w, y: y + Math.floor((h - 1) / 2) };
  if (dir.name === 'S') return { x: x + Math.floor((w - 1) / 2), y: y + h };
  return { x: x - 1, y: y + Math.floor((h - 1) / 2) };
}

function getPlacementPreviewEntranceTile() {
  const tool = getTool(gameState.ui?.selectedTool);
  if (tool?.kind !== 'facility') return null;
  const tile = gameState.input?.mouseTile;
  if (!tile || tile.x < 0 || tile.y < 0) return null;
  const directionIndex = gameState.ui?.directionIndex ?? 0;
  const footprint = getRotatedFootprintSize(tool, directionIndex);
  return getFacilityEntranceTile({ type: tool.id, kind: tool.kind, x: tile.x, y: tile.y, w: footprint.w, h: footprint.h, directionIndex });
}

function isEntranceConnectedToRoad(facility) {
  const entrance = getFacilityEntranceTile(facility);
  return Number.isFinite(entrance?.x) && Number.isFinite(entrance?.y) && roadAt(entrance.x, entrance.y);
}

function entranceTile(facility) { return getFacilityEntranceTile(facility); }

function isPassableTile(gx, gy, options = {}) {
  const tile = getTile(gx, gy);
  if (!tile) return false;
  if (objectAt(gx, gy)) return false;
  if (tile.terrain === CONFIG.tileState.terrainWater) return options.allowWater === true;
  if (tile.terrain === CONFIG.tileState.terrainOutside) return true;
  return tile.terrain === CONFIG.tileState.terrainLand
    && tile.buildState === CONFIG.tileState.buildable
    && tile.obstacle === null;
}

function isFacilityUsable(facility) {
  if (facility?.kind !== 'facility' || !facility?.id) return false;
  const current = (gameState.world.objects ?? []).find(o => o?.id === facility.id);
  if (current !== facility) return false;
  const e = getFacilityEntranceTile(facility);
  return Number.isFinite(e?.x) && Number.isFinite(e?.y) && isEntranceConnectedToRoad(facility) && isPassableTile(e.x, e.y);
}

function facilityBonus(facility) {
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)[facility?.type];
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

function getUsableFacilities() {
  return (gameState.world.objects ?? []).filter(o => o?.kind === 'facility' && isFacilityUsable(o));
}

function getAllFacilitiesByType(type) {
  const typeId = String(type ?? '');
  return (gameState.world.objects ?? []).filter(o => o?.kind === 'facility' && o?.type === typeId);
}

function getUsableFacilitiesByType(type) {
  return getUsableFacilities().filter(o => o?.type === String(type ?? ''));
}

function usableFacilities(type) { return getUsableFacilitiesByType(type); }

function getFacilityInteractionTile(facility) {
  const entrance = getFacilityEntranceTile(facility);
  if (Number.isFinite(entrance?.x) && Number.isFinite(entrance?.y) && isPassableTile(entrance.x, entrance.y)) return entrance;
  const candidates = [];
  for (let radius = 1; radius <= 2; radius += 1) {
    for (let y = (facility?.y ?? 0) - radius; y < (facility?.y ?? 0) + (facility?.h ?? 1) + radius; y += 1) {
      for (let x = (facility?.x ?? 0) - radius; x < (facility?.x ?? 0) + (facility?.w ?? 1) + radius; x += 1) {
        if (!isPassableTile(x, y)) continue;
        candidates.push({ x, y, road: roadAt(x, y) ? 0 : 1, d: distance(x, y, entrance?.x ?? x, entrance?.y ?? y) });
      }
    }
    if (candidates.length > 0) break;
  }
  candidates.sort((a, b) => (a.road - b.road) || (a.d - b.d));
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : entrance;
}

function facilityInteractionPoint(facility) {
  const tile = getFacilityInteractionTile(facility);
  return Number.isFinite(tile?.x) && Number.isFinite(tile?.y) ? gridToWorld(tile.x, tile.y) : centerOfObject(facility);
}

function estimatePathCostBetweenPoints(from, to, reason = 'facility') {
  if (!from || !to) return Infinity;
  const path = findPath(worldToGrid(from.x, from.y), worldToGrid(to.x, to.y), { reason });
  if (!Array.isArray(path) || path.length <= 0) return Infinity;
  return path.reduce((sum, point) => {
    const tile = worldToGrid(point.x, point.y);
    const moveCost = getTileMoveCost(tile, { reason });
    return sum + (Number.isFinite(moveCost) ? moveCost : CONFIG.movement.buildableCost);
  }, 0);
}

function scoreFacilityForSeal(seal, facility, purpose = 'spend') {
  if (!seal || !facility || !isFacilityUsable(facility)) return -Infinity;
  const allowed = {
    heal: ['inn'], food: ['restaurant', 'manjuShop'], spend: ['restaurant', 'manjuShop', 'blacksmith'], equipment: Object.keys(CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES ?? {})
  }[purpose] ?? Object.keys(CONFIG.facilities ?? {});
  if (!allowed.includes(facility.type)) return -Infinity;
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? safeFiniteNumber(seal.hp, 0, 0) / effectiveMaxHp : 0;
  const carriedG = safeFiniteNumber(seal.carriedG, 0, 0);
  const gearBudget = safeFiniteNumber(seal.gearBudget, 0, 0);
  if (purpose === 'heal' && facility.type === 'inn' && carriedG < getFacilityPrice(facility) && hpRatio > CONFIG.seal.innHpThreshold) return -Infinity;
  if (purpose === 'food' && ['restaurant', 'manjuShop'].includes(facility.type) && carriedG < Math.min(getFacilityPrice(facility), 1)) return -Infinity;
  if (purpose === 'spend' && carriedG <= 0 && !chooseCheapestAffordableUpgrade(seal, facility)) return -Infinity;
  if (purpose === 'equipment' && (gearBudget <= 0 || !chooseCheapestAffordableUpgrade(seal, facility))) return -Infinity;
  const target = facilityInteractionPoint(facility);
  const pathCost = estimatePathCostBetweenPoints({ x: seal.x, y: seal.y }, target, 'facility');
  if (!Number.isFinite(pathCost)) return -Infinity;
  let score = (CONFIG.EQUIPMENT?.FACILITY_BASE_SCORE ?? 1000) - pathCost * (CONFIG.EQUIPMENT?.FACILITY_DISTANCE_WEIGHT ?? 1);
  score += facilityBonus(facility) * (CONFIG.EQUIPMENT?.FACILITY_BONUS_WEIGHT ?? 36);
  score -= (seal.facilityUseCounts?.[facility.type] ?? 0) * (CONFIG.EQUIPMENT?.RECENT_USAGE_PENALTY ?? 18);
  if (facility.id && seal.lastFacilityId === facility.id) score -= (CONFIG.EQUIPMENT?.RECENT_USAGE_PENALTY ?? 18);
  if (purpose === 'heal') score += (1 - hpRatio) * (CONFIG.EQUIPMENT?.FACILITY_HEAL_WEIGHT ?? 140);
  if (purpose === 'food') {
    const price = getFacilityPrice(facility);
    const heal = getFacilityHealAmount(facility);
    score += Math.min(carriedG, price || carriedG) * (CONFIG.EQUIPMENT?.FACILITY_FOOD_G_WEIGHT ?? 0.2) + Math.max(0, CONFIG.seal.mediumHpRatio - hpRatio) * (CONFIG.EQUIPMENT?.FACILITY_FOOD_HP_WEIGHT ?? 20) + heal * 0.35;
    if (facility.type === 'manjuShop') {
      if (carriedG < (CONFIG.facilities.restaurant?.basePrice ?? CONFIG.facilities.restaurant?.spendPerVisit ?? 45)) score += 34;
      if (hpRatio > CONFIG.seal.innHpThreshold && hpRatio < (CONFIG.VISITORS?.ARRIVAL?.restaurantHpRatio ?? 0.82)) score += 18;
    }
    if (facility.type === 'restaurant' && carriedG >= price) score += 22;
    if (carriedG < price) score -= 80;
  }
  if (purpose === 'spend') score += Math.min(carriedG, getFacilityPrice(facility) || CONFIG.facilities.blacksmith?.spendPerVisit || carriedG) * (CONFIG.EQUIPMENT?.FACILITY_SPEND_G_WEIGHT ?? 0.15);
  if (purpose === 'equipment') score += Math.min(gearBudget, Math.max(...Object.values(CONFIG.ITEMS ?? {}).map(item => safeFiniteNumber(item?.price, 0, 0)), 1)) * (CONFIG.EQUIPMENT?.FACILITY_EQUIPMENT_GEAR_WEIGHT ?? 0.12) + getEquipmentScore(chooseCheapestAffordableUpgrade(seal, facility));
  score += Math.random() * (CONFIG.EQUIPMENT?.RANDOM_TIEBREAKER ?? 4);
  return score;
}

function chooseBestFacility(seal, purpose = 'spend', allowedTypes = null) {
  const types = Array.isArray(allowedTypes) && allowedTypes.length > 0 ? allowedTypes.map(String) : Object.keys(CONFIG.facilities ?? {});
  const scored = getUsableFacilities()
    .filter(facility => types.includes(String(facility?.type ?? '')))
    .map(facility => ({ facility, score: scoreFacilityForSeal(seal, facility, purpose) }))
    .filter(entry => Number.isFinite(entry.score));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.facility ?? null;
}

function isFacilityStillValidTarget(seal, facilityId, purpose = 'spend') {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === facilityId && o?.kind === 'facility');
  return Number.isFinite(scoreFacilityForSeal(seal, facility, purpose));
}

function getBestFacilityForSeal(seal, preferredTypes) {
  const types = Array.isArray(preferredTypes) && preferredTypes.length > 0 ? preferredTypes : Object.keys(CONFIG.facilities ?? {});
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? safeFiniteNumber(seal?.hp, 0, 0) / effectiveMaxHp : 0;
  const purpose = types.length === 1 && types[0] === 'inn' ? 'heal'
    : (types.length === 1 && ['restaurant', 'manjuShop'].includes(types[0]) ? 'food'
      : (types.some(type => Object.keys(CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES ?? {}).includes(type)) && safeFiniteNumber(seal?.gearBudget, 0, 0) > 0 && hpRatio > CONFIG.seal.innHpThreshold ? 'equipment' : 'spend'));
  return chooseBestFacility(seal, purpose, types) ?? chooseBestFacility(seal, 'spend', types);
}

function chooseInnForSeal(seal) { return chooseBestFacility(seal, 'heal', ['inn']); }
function chooseFoodFacilityForSeal(seal) { return chooseBestFacility(seal, 'food', ['manjuShop', 'restaurant']); }
function chooseSpendingFacilityForSeal(seal) { return chooseBestFacility(seal, 'spend', ['manjuShop', 'restaurant', 'blacksmith']); }
function chooseFacilityAfterHunt(seal) {
  const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
  const hpRatio = effectiveMaxHp > 0 ? safeFiniteNumber(seal?.hp, 0, 0) / effectiveMaxHp : 0;
  if (hpRatio <= CONFIG.seal.innHpThreshold) return chooseBestFacility(seal, 'heal', ['inn']) ?? chooseFoodFacilityForSeal(seal) ?? chooseBestFacility(seal, 'spend', ['blacksmith']);
  const equipmentShop = chooseBestFacility(seal, 'equipment', Object.keys(CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES ?? {}));
  if (equipmentShop) return equipmentShop;
  if (hpRatio <= CONFIG.seal.mediumHpRatio && Math.random() < CONFIG.seal.mediumInnChance) return chooseBestFacility(seal, 'heal', ['inn']) ?? chooseFoodFacilityForSeal(seal) ?? chooseBestFacility(seal, 'spend', ['blacksmith']);
  if (seal?.carriedG >= (CONFIG.facilities.inn?.basePrice ?? CONFIG.facilities.inn?.fee ?? 0) && (seal?.mealCountSinceInn ?? 0) >= CONFIG.seal.mealsBeforeInnSoftLimit) return chooseBestFacility(seal, 'heal', ['inn']) ?? chooseFoodFacilityForSeal(seal);
  const personality = getPersonalityConfig(seal);
  const preferred = personality?.maxHuntsPerTrip > CONFIG.personalities.balanced.maxHuntsPerTrip
    ? ['blacksmith', 'restaurant', 'manjuShop', 'inn']
    : (personality?.maxHuntsPerTrip < CONFIG.personalities.balanced.maxHuntsPerTrip ? ['inn', 'manjuShop', 'restaurant', 'blacksmith'] : ['manjuShop', 'restaurant', 'blacksmith', 'inn']);
  return chooseBestFacility(seal, 'spend', preferred) ?? chooseBestFacility(seal, 'heal', preferred) ?? chooseBestFacility(seal, 'food', preferred);
}


function getFacilityPurposeForSeal(seal, facility) {
  if (facility?.type === 'inn') return 'heal';
  if (['restaurant', 'manjuShop'].includes(String(facility?.type ?? ''))) return 'food';
  return chooseCheapestAffordableUpgrade(seal, facility) ? 'equipment' : 'spend';
}

function clearLegacyReturnTarget(seal) {
  if (!seal) return;
  const reason = String(seal.target?.reason ?? '');
  const tile = seal.target ? worldToGrid(seal.target.x, seal.target.y) : null;
  const isLegacyHub = ['village-route', 'safe-marker', 'return-flag', 'village-center'].includes(reason)
    || (tile && ((tile.x === CONFIG.world.safeX && tile.y === CONFIG.world.safeY) || (tile.x === CONFIG.world.villageEntryX && tile.y === CONFIG.world.villageEntryY)) && seal.state === 'returningFromHunt');
  if (isLegacyHub) { seal.target = null; seal.path = []; seal.pathTargetKey = null; seal.targetId = null; }
}

function routeSealDirectlyToFacility(seal, facilityId, reason = 'facility') {
  const facility = (gameState.world.objects ?? []).find(o => o?.id === facilityId && o?.kind === 'facility');
  if (!seal || !facility || !isFacilityStillValidTarget(seal, facilityId, reason === 'heal' ? 'heal' : reason === 'food' ? 'food' : reason === 'equipment' ? 'equipment' : 'spend')) return false;
  seal.targetId = facility.id;
  seal.currentAction = `${(CONFIG.facilities ?? CONFIG.FACILITIES)[facility.type]?.label ?? '施設'}へ向かっています`;
  if (!setSealDestination(seal, facilityInteractionPoint(facility), 'facility')) { seal.targetId = null; return false; }
  seal.state = 'movingToFacility';
  return true;
}

function choosePostHuntAction(seal) {
  if (!seal) return false;
  clearLegacyReturnTarget(seal);
  const facility = chooseFacilityAfterHunt(seal);
  if (facility && routeSealDirectlyToFacility(seal, facility.id, getFacilityPurposeForSeal(seal, facility))) return true;
  if (seal.type === 'visitor' && visitorShouldLeave(seal)) { seal.currentAction = '海へ帰っています'; seal.state = 'leavingToSea'; return buildRouteToVillage(seal); }
  if (seal.type === 'visitor' && shouldContinueHunting(seal)) { updateChoosingHuntArea(seal); return true; }
  if (seal.type === 'resident' && shouldContinueHunting(seal)) { updateChoosingHuntArea(seal); return true; }
  seal.wanderTimer = CONFIG.seal.wanderSeconds;
  setSealDestination(seal, villageWanderPoint(), 'village-wander');
  seal.currentAction = '村で過ごしています';
  seal.state = seal.type === 'visitor' ? 'idle' : 'choosingFacility';
  return true;
}

function nearestFacility(type, x, y) {
  const list = getUsableFacilitiesByType(type);
  return list.reduce((best, item) => !best || distance(x, y, facilityInteractionPoint(item).x, facilityInteractionPoint(item).y) < distance(x, y, facilityInteractionPoint(best).x, facilityInteractionPoint(best).y) ? item : best, null);
}

function centerOfObject(obj) { return { x: ((obj?.x ?? 0) + (obj?.w ?? 1) / 2) * CONFIG.world.tile, y: ((obj?.y ?? 0) + (obj?.h ?? 1) / 2) * CONFIG.world.tile }; }
function distance(ax, ay, bx, by) { return Math.hypot((bx ?? 0) - (ax ?? 0), (by ?? 0) - (ay ?? 0)); }
function randomRange(min, max) { return min + Math.random() * (max - min); }
function randomCoastPoint() { return gridToWorld(Math.floor(randomRange(CONFIG.world.coastX, CONFIG.world.coastX + CONFIG.world.coastW)), Math.floor(randomRange(CONFIG.world.coastY, CONFIG.world.coastY + CONFIG.world.coastH))); }

function getNextUnlockProfile() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  return (gameState.visitorProfiles ?? [])
    .filter(profile => profile && !isVisitorProfileUnlocked(profile) && safeFiniteNumber(profile.unlockedAtKnownness, 0, 0) > knownness)
    .sort((a, b) => safeFiniteNumber(a.unlockedAtKnownness, 0, 0) - safeFiniteNumber(b.unlockedAtKnownness, 0, 0))[0] ?? null;
}

function getNextKnownnessGoal() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  const profileGoal = getNextUnlockProfile()?.unlockedAtKnownness;
  const thresholdGoal = (CONFIG.KNOWNNESS?.UNLOCK_THRESHOLDS ?? []).map(Number).filter(value => Number.isFinite(value) && value > knownness).sort((a, b) => a - b)[0];
  const goals = [profileGoal, thresholdGoal].map(Number).filter(Number.isFinite);
  return goals.length > 0 ? Math.min(...goals) : Math.max(knownness, 0);
}

function isVisitorProfileUnlocked(profile) {
  if (!profile) return false;
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  return profile.unlocked === true || knownness >= safeFiniteNumber(profile.unlockedAtKnownness, 0, 0);
}

function getUnlockedVisitorProfiles() {
  return (gameState.visitorProfiles ?? []).filter(profile => profile && isVisitorProfileUnlocked(profile));
}

function getActiveVisitorProfileIds() {
  return new Set((gameState.seals ?? []).filter(seal => seal?.type === 'visitor' && seal?.profileId && getVisitorProfileById(seal.profileId)).map(seal => seal.profileId));
}

function isVisitorProfileActive(profileId) {
  return getActiveVisitorProfileIds().has(String(profileId ?? ''));
}

function getVisitorSpawnCandidates() {
  const activeIds = getActiveVisitorProfileIds();
  return getUnlockedVisitorProfiles().filter(profile => profile?.id && !activeIds.has(profile.id));
}

function sanitizeActiveVisitorSeals() {
  const seenProfileIds = new Set();
  const validSeals = [];
  for (const seal of gameState.seals ?? []) {
    if (!seal || seal.type !== 'visitor') { if (seal) validSeals.push(seal); continue; }
    const profile = seal.profileId ? getVisitorProfileById(seal.profileId) : null;
    if (!profile) continue;
    seal.name = String(seal.name || profile.name || CONFIG.resident.defaultName);
    seal.personality = String(seal.personality || profile.personality || 'balanced');
    seal.assetKey = String(seal.assetKey || assetKeyForVisitorProfile(profile.id));
    if (seenProfileIds.has(profile.id)) {
      writeBackVisitorProfile(seal);
      continue;
    }
    seenProfileIds.add(profile.id);
    validSeals.push(seal);
  }
  gameState.seals = validSeals;
}

function updateVisitorUnlocks() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  for (const profile of gameState.visitorProfiles ?? []) {
    if (!profile || profile.unlocked || knownness < safeFiniteNumber(profile.unlockedAtKnownness, 0, 0)) continue;
    profile.unlocked = true;
    logMessage(`${profile.name} が来訪候補に加わりました！`);
  }
}

function unlockKnownVisitors() { updateVisitorUnlocks(); }

function createResidentSeal(name) {
  const safe = gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY);
  return normalizeSeal({
    id: 'resident-seal', name: String(name || gameState.residentName || CONFIG.resident.defaultName), type: 'resident', personality: 'balanced', assetKey: 'seals.resident', facing: 'left', x: safe.x, y: safe.y,
    hp: CONFIG.seal.maxHp, maxHp: CONFIG.seal.maxHp, attack: CONFIG.seal.attack, defense: CONFIG.seal.defense,
    carriedG: CONFIG.seal.startG, gearBudget: 0, equipment: { weapon: null, armor: null, accessory: null }, exp: 0, level: 1, favor: 0, state: 'choosingHuntArea', visits: 0
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

function getVillageEntryPoint() {
  return gridToWorld(CONFIG.world.villageEntryX, CONFIG.world.villageEntryY);
}

function pointFromConfigTile(point, fallback) {
  const source = point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? point : fallback;
  return gridToWorld(clampInteger(source?.x, 0, CONFIG.world.cols - 1, CONFIG.world.safeX), clampInteger(source?.y, 0, CONFIG.world.rows - 1, CONFIG.world.safeY));
}

function pickConfigPoint(points, fallback) {
  const list = (Array.isArray(points) ? points : []).filter(point => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));
  return pointFromConfigTile(list.length > 0 ? list[Math.floor(Math.random() * list.length)] : fallback, fallback);
}

function getVisitorPreferredSpawnPoint() {
  return pickConfigPoint(CONFIG.VISITORS?.ARRIVAL?.seaSpawnPoints, CONFIG.visitor?.entrySpawn ?? { x: CONFIG.world.safeX, y: CONFIG.world.safeY });
}

function getVisitorShoreLandingPoint() {
  return pickConfigPoint(CONFIG.VISITORS?.ARRIVAL?.shoreLandingPoints, { x: CONFIG.world.villageEntryX, y: CONFIG.world.villageEntryY });
}

function getVisitorSeaExitPoint() {
  return pickConfigPoint(CONFIG.VISITORS?.ARRIVAL?.seaExitPoints ?? CONFIG.VISITORS?.ARRIVAL?.seaSpawnPoints, CONFIG.visitor?.entrySpawn ?? { x: CONFIG.world.safeX, y: CONFIG.world.safeY });
}

function isWaterWorldPoint(point) {
  const tile = worldToGrid(point?.x, point?.y);
  return getTile(tile.x, tile.y)?.terrain === CONFIG.tileState.terrainWater;
}

function findNearestPassableSpawnPoint(preferredPoint) {
  const start = worldToGrid(preferredPoint?.x ?? getVisitorPreferredSpawnPoint().x, preferredPoint?.y ?? getVisitorPreferredSpawnPoint().y);
  const maxRadius = clampInteger(CONFIG.visitor?.spawnSearchRadius, 1, Math.max(CONFIG.world.cols, CONFIG.world.rows), 8);
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    const candidates = [];
    for (let y = start.y - radius; y <= start.y + radius; y += 1) {
      for (let x = start.x - radius; x <= start.x + radius; x += 1) {
        if (x < 0 || y < 0 || x >= CONFIG.world.cols || y >= CONFIG.world.rows) continue;
        if (radius > 0 && Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) !== radius) continue;
        if (!isPassableTile(x, y)) continue;
        candidates.push({ x, y, road: roadAt(x, y) ? 0 : 1, d: distance(x, y, start.x, start.y) });
      }
    }
    candidates.sort((a, b) => (a.road - b.road) || (a.d - b.d));
    if (candidates[0]) return gridToWorld(candidates[0].x, candidates[0].y);
  }
  return null;
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

