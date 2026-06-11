'use strict';

const CONFIG = Object.freeze({
  canvas: { minDevicePixelRatio: 1, maxDevicePixelRatio: 2 },
  phase: { start: 'start', playing: 'playing', gameover: 'gameover' },
  world: { cols: 54, rows: 34, tile: 44, islandX: 4, islandY: 10, islandW: 28, islandH: 18, coastX: 34, coastY: 5, coastW: 16, coastH: 24, safeX: 14, safeY: 18, villageEntryX: 14, villageEntryY: 17 },
  expansion: { startX: 6, startY: 12, startW: 20, startH: 13, regionX: 5, regionY: 11, regionW: 26, regionH: 16 },
  CLEARING: { BASE_COST: 260, COST_STEP: 75, RADIUS: 1 },
  map: {
    corridorWidth: 1, routeBreathingRadius: 2, obstacleSeedA: 17, obstacleSeedB: 31, obstacleModulo: 10, grassLimit: 4, treeLimit: 7,
    protectedCorridors: [
      { from: { x: 14, y: 24 }, to: { x: 14, y: 17 } },
      { from: { x: 14, y: 17 }, to: { x: 24, y: 17 } },
      { from: { x: 24, y: 17 }, to: { x: 24, y: 16 } },
      { from: { x: 24, y: 16 }, to: { x: 34, y: 16 } }
    ],
    undevelopedPatches: [
      { cx: 7, cy: 12, radiusX: 2, radiusY: 2, softness: 2 },
      { cx: 6, cy: 20, radiusX: 2, radiusY: 3, softness: 3 },
      { cx: 11, cy: 25, radiusX: 3, radiusY: 1, softness: 2 },
      { cx: 23, cy: 12, radiusX: 3, radiusY: 2, softness: 2 },
      { cx: 27, cy: 20, radiusX: 3, radiusY: 3, softness: 3 },
      { cx: 18, cy: 25, radiusX: 3, radiusY: 2, softness: 2 }
    ]
  },
  tileState: { terrainWater: 'water', terrainLand: 'land', terrainOutside: 'outside', buildBlocked: 'blocked', buildable: 'buildable', obstacleGrass: 'grass', obstacleTree: 'tree', obstacleRock: 'rock' },
  village: { roadY: 17, roadX: 14, roadStartX: 7, roadEndX: 24, roadStartY: 17, roadEndY: 24, defaults: [
    { type: 'inn', x: 8, y: 15, directionIndex: 2 },
    { type: 'restaurant', x: 14, y: 15, directionIndex: 2 },
    { type: 'blacksmith', x: 20, y: 15, directionIndex: 2 },
    { type: 'flower', x: 13, y: 15 }, { type: 'tree', x: 8, y: 14 }, { type: 'rock', x: 19, y: 15 },
    { type: 'tree', x: 6, y: 15 }, { type: 'flower', x: 12, y: 20 }, { type: 'rock', x: 18, y: 20 }
  ] },
  camera: { x: 240, y: 280, zoom: 0.86, minZoom: 0.45, maxZoom: 1.8, panSpeed: 520, wheelStep: 0.1, buttonStep: 0.16, dragButton: 0 },
  SAVE_KEY: 'seal-island-economy-save',
  SAVE_VERSION: 11,
  AUTO_SAVE_INTERVAL_MS: 30000,
  MAX_LOGS: 7,
  resident: { defaultName: '島のあざらし' },
  dungeon: {
    spawnIntervalMs: 90000,
    initialSpawnDelayMs: 18000,
    maxActive: 2,
    clickRadius: 26,
    completedDisplayMs: 10000,
    returnDisplayMs: 6000,
    logMax: 8,
    states: { available: 'available', assembling: 'assembling', running: 'running', returning: 'returning', completed: 'completed', expired: 'expired' },
    stateLabels: { available: '発見済み', assembling: '集合中', running: '探索中', returning: '帰還中', completed: '攻略完了', expired: '消滅' },
    nodeTypes: { entrance: 'entrance', battle: 'battle', chest: 'chest', trap: 'trap', event: 'event', boss: 'boss', exit: 'exit' },
    nodeLabels: { entrance: '入口', battle: '戦闘', chest: '宝箱', trap: '罠', event: '出来事', boss: 'ボス', exit: '出口' },
    routeTemplate: ['entrance', 'battle', 'chest', 'trap', 'battle', 'boss', 'exit'],
    nodeDurationsMs: { entrance: 3500, battle: 5200, chest: 3600, trap: 4200, event: 3800, boss: 6500, exit: 3200 },
    progressSpeedByPersonality: { cautious: 0.9, brave: 1.08, balanced: 1 },
    outcome: { battleDamage: 3, braveDamageBonus: 2, cautiousTrapDamageReduction: 2, trapDamage: 4, rewardBattleMultiplier: 0.12, rewardChestMultiplier: 0.18, rewardBossMultiplier: 0.3, rewardTrapPenaltyMultiplier: 0.08, expBattleBonus: 3 },
    labels: { movingToDungeon: '遠征集合中', waitingAtDungeon: '入口で待機中', runningText: '探索中', returningText: '帰還中', peopleExpedition: '遠征中', participantCount: '探索中 {count}匹', assemblingCount: '集合中 {count}匹', returningCount: '帰還中 {count}匹', noParticipants: '参加者なし', routeTitle: '遠征ルート', logTitle: '遠征ログ', completedReward: '獲得報酬' },
    spawnAttempts: 40,
    minDistanceFromVillageTiles: 4,
    participant: { min: 1, max: 3, clearFavor: 2, allowUnlockedProfileRecruit: true, personalityBonus: { brave: 16, balanced: 8, cautious: 2 }, activeSealBonus: 12, residentBonus: 6 },
    areas: { coast: { id: 'coast', label: '外の冒険エリア coast', bounds: { x: 34, y: 5, w: 16, h: 24 }, types: ['tidal_cave'] } },
    types: {
      tidal_cave: { id: 'tidal_cave', name: '潮騒の洞窟', durationMs: 24000, expiresInMs: 180000, recruitCost: 40, difficulty: 36, enemyTypes: ['crab'], dropTableId: 'coast_relics', rewards: { g: 95, exp: 32, knownness: 8 } }
    },
    dropTables: { coast_relics: [
      { itemId: 'driftwood_spear', count: 1, weight: 4 },
      { itemId: 'shell_armor', count: 1, weight: 3 },
      { itemId: 'lucky_pearl', count: 1, weight: 2 }
    ] }
  },
  sealStates: { movingToDungeon: 'movingToDungeon', waitingAtDungeon: 'waitingAtDungeon', expeditionRunning: 'expeditionRunning', returningFromDungeon: 'returningFromDungeon', questing: 'questing', arrivingFromSea: 'arrivingFromSea', choosingArrivalAction: 'choosingArrivalAction', movingToFacility: 'movingToFacility', usingFacility: 'usingFacility', choosingHuntArea: 'choosingHuntArea', movingToHuntArea: 'movingToHuntArea', hunting: 'hunting', movingToMonster: 'movingToMonster', fighting: 'fighting', returningFromHunt: 'returningFromHunt', choosingPostHuntFacility: 'choosingPostHuntFacility', leavingToSea: 'leavingToSea', idle: 'idle', fallen: 'fallen', rescuing: 'rescuing', carryingFallenSeal: 'carryingFallenSeal', arriving: 'arriving', movingToHuntExit: 'movingToHuntExit', choosingFacility: 'choosingFacility', leaving: 'leaving' },
  CALENDAR: { WEEK_DURATION_MS: 12000, WEEKS_PER_MONTH: 4, MONTHS_PER_YEAR: 12 },
  TIME: { SPEED_OPTIONS: [0, 1, 2, 4], DEFAULT_SCALE: 1 },
  ASSETS: { paths: {
    'seals.goma': 'assets/seals/seal_white_goma_idle.png',
    'seals.kurakake': 'assets/seals/seal_spotted_kurakake_idle.png',
    'seals.tategoto': 'assets/seals/seal_harp_tategoto_idle.png',
    'seals.resident': 'assets/seals/seal_white_resident_idle.png',
    'monsters.crab': 'assets/monsters/monster_water_coast_crab.png',
    'cards.facility_neutral_inn_idle': 'assets/cards/facility_neutral_inn_idle.png',
    'cards.facility_neutral_restaurant_idle': 'assets/cards/facility_neutral_restaurant_idle.png',
    'cards.facility_neutral_blacksmith_idle': 'assets/cards/facility_neutral_blacksmith_idle.png',
    'cards.facility_neutral_manjuShop_idle': 'assets/cards/facility_neutral_manjuShop_idle.png',
    'cards.manjuShop': 'assets/cards/facility_neutral_manjuShop_idle.png',
    'facilities.manjuShop': 'assets/cards/facility_neutral_manjuShop_idle.png'
  } },
  SPRITES: { seal: { w: 42, h: 30 }, monster: { w: 34, h: 24 }, defaultFacing: 'left' },
  KNOWNNESS: { UNLOCK_THRESHOLDS: [100, 200, 300, 400, 500], PANEL_WIDTH: 210, PANEL_HEIGHT: 74, PANEL_MARGIN: 18 },
  knownness: { initial: 0, huntRewardPerMonthlyHunt: 4, monthlyBaseReward: 2, satisfyingVisitReward: 3, duplicateRelicReward: 1 },
  movement: { roadCost: 1, buildableCost: 4, outsideCost: 5, waterCost: 3, maxPathNodes: 2500, pathReachDistance: 8, maxWaypointStepsPerFrame: 24, fallbackWarnCooldownMs: 60000, directFallbackReasons: ['rescue', 'carry', 'dungeon-entrance', 'dungeon-return'] },
  timing: { targetFps: 60, maxDt: 0.05, uiMs: 120 },
  placement: { roadSize: 1, decorationSize: 1, facilitySize: 2, feedbackSeconds: 0.75, roadRoute: { maxTiles: 32, allowExistingRoads: true, blockObjects: true, requireBuildableLand: true, scoreInvalidWeight: 1000, scoreBlockedWeight: 100, scoreTurnWeight: 10, scoreExistingRoadBonus: 2 } },
  directions: [ { name: 'N', dx: 0, dy: -1 }, { name: 'E', dx: 1, dy: 0 }, { name: 'S', dx: 0, dy: 1 }, { name: 'W', dx: -1, dy: 0 } ],
  tools: [
    { id: 'road', label: '🟫 道路', kind: 'road', w: 1, h: 1 },
    { id: 'inn', label: '🏨 宿屋', kind: 'facility', w: 2, h: 2 },
    { id: 'restaurant', label: '🍲 食堂', kind: 'facility', w: 2, h: 2 },
    { id: 'manjuShop', label: '🍡 まんじゅう屋', kind: 'facility', w: 1, h: 1 },
    { id: 'blacksmith', label: '⚒️ 鍛冶屋', kind: 'facility', w: 2, h: 2 },
    { id: 'flower', label: '🌼 花', kind: 'decoration', w: 1, h: 1 },
    { id: 'tree', label: '🌲 木', kind: 'decoration', w: 1, h: 1 },
    { id: 'rock', label: '🪨 岩', kind: 'decoration', w: 1, h: 1 },
    { id: 'clear', label: '⛏️ 開拓', kind: 'clear', w: 1, h: 1 },
    { id: 'delete', label: '❌ 削除', kind: 'delete', w: 1, h: 1 }
  ],
  FACILITY_LEVELS: { maxLevel: 10, thresholds: [0, 5, 12, 25, 45, 70, 100, 140, 190, 250], priceMultiplierPerLevel: 0.08, healingMultiplierPerLevel: 0.08, incomeMultiplierPerLevel: 0.05 },
  FACILITIES: {
    inn: { name: '宿屋', label: '宿屋', w: 2, h: 2, basePrice: 36, fee: 36, baseHeal: 20, healPerSecond: 20, color: '#2f7eb5', bonusDecoration: 'tree', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['heal', 'lodging'] },
    restaurant: { name: '食堂', label: '食堂', w: 2, h: 2, basePrice: 45, baseHeal: 24, favorGain: 1, spendPerVisit: 45, color: '#d66b2b', bonusDecoration: 'flower', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['food', 'meal'] },
    manjuShop: { name: 'まんじゅう屋', label: 'まんじゅう屋', w: 1, h: 1, basePrice: 20, baseHeal: 12, favorGain: 1, color: '#d895b8', bonusDecoration: 'flower', bonusRate: 0.03, entranceRequired: true, category: 'facility', tags: ['food', 'snack'] },
    blacksmith: { name: '鍛冶屋', label: '鍛冶屋', w: 2, h: 2, spendPerVisit: 65, color: '#7d6043', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['equipment'] }
  },
  facilities: {
    inn: { name: '宿屋', label: '宿屋', w: 2, h: 2, basePrice: 36, fee: 36, baseHeal: 20, healPerSecond: 20, color: '#2f7eb5', bonusDecoration: 'tree', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['heal', 'lodging'] },
    restaurant: { name: '食堂', label: '食堂', w: 2, h: 2, basePrice: 45, baseHeal: 24, favorGain: 1, spendPerVisit: 45, color: '#d66b2b', bonusDecoration: 'flower', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['food', 'meal'] },
    manjuShop: { name: 'まんじゅう屋', label: 'まんじゅう屋', w: 1, h: 1, basePrice: 20, baseHeal: 12, favorGain: 1, color: '#d895b8', bonusDecoration: 'flower', bonusRate: 0.03, entranceRequired: true, category: 'facility', tags: ['food', 'snack'] },
    blacksmith: { name: '鍛冶屋', label: '鍛冶屋', w: 2, h: 2, spendPerVisit: 65, color: '#7d6043', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, category: 'facility', tags: ['equipment'] }
  },
  ROUTES: { entryCorridor: { id: 'south_entry', type: 'entry', waypoints: [{ x: 14, y: 30 }, { x: 14, y: 24 }, { x: 14, y: 17 }] }, huntingCorridors: [ { id: 'coast_exit', type: 'hunting', areaId: 'coast', waypoints: [{ x: 14, y: 17 }, { x: 24, y: 17 }, { x: 24, y: 16 }, { x: 34, y: 16 }, { x: 38, y: 16 }] } ] },
  VISITORS: { ARRIVAL: {
    seaSpawnPoints: [{ x: 12, y: 33 }, { x: 14, y: 33 }, { x: 16, y: 33 }],
    shoreLandingPoints: [{ x: 14, y: 27 }, { x: 13, y: 27 }, { x: 15, y: 27 }],
    seaExitPoints: [{ x: 12, y: 33 }, { x: 14, y: 33 }, { x: 16, y: 33 }],
    initialCarriedGMin: 70,
    initialCarriedGMax: 140,
    initialHpRatioMin: 0.62,
    initialHpRatioMax: 0.92,
    preHuntFacilityChance: 0.72,
    lowHpFacilityHpRatio: 0.58,
    restaurantHpRatio: 0.82,
    facilityTypes: { lowHp: ['inn'], reducedHp: ['manjuShop', 'restaurant', 'inn'], gear: ['blacksmith'], optional: ['manjuShop', 'restaurant', 'blacksmith', 'inn'] }
  } },
  visitor: { safetyMaxActive: 30, spawnInterval: 16, spawnIntervalFavorReduction: 0.04, minSpawnIntervalMultiplier: 0.55, returnBaseWeight: 1, returnFavorWeight: 0.18, inactiveWeightBonus: 3, fewerVisitsWeight: 0.18, safeLeaveFavor: 2, debugSpawnCandidates: false, entrySpawn: { x: 14, y: 24 }, spawnSearchRadius: 8, minStayMs: 45000, maxStayMs: 110000, maxStayFavorBonusMs: 25000, maxStayFavorMsPerFavor: 1000, satisfyingMinFacilities: 1, satisfyingMinHunts: 1, enoughHuntsForLeave: 2, profiles: [
    { id: 'visitor-goma', name: 'ゴマ', personality: 'balanced', unlockedAtKnownness: 0, baseStats: { maxHp: 130, attack: 18, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kurakake', name: 'クラカケ', personality: 'cautious', unlockedAtKnownness: 0, baseStats: { maxHp: 120, attack: 17, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-tategoto', name: 'タテゴト', personality: 'brave', unlockedAtKnownness: 100, baseStats: { maxHp: 145, attack: 20, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-dango', name: 'だんご', personality: 'balanced', unlockedAtKnownness: 200, baseStats: { maxHp: 126, attack: 18, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-manju', name: 'まんじゅう', personality: 'cautious', unlockedAtKnownness: 300, baseStats: { maxHp: 138, attack: 17, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-monaka', name: 'もなか', personality: 'balanced', unlockedAtKnownness: 400, baseStats: { maxHp: 124, attack: 19, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-yokan', name: 'ようかん', personality: 'cautious', unlockedAtKnownness: 500, baseStats: { maxHp: 150, attack: 18, defense: 8 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-dorayaki', name: 'どらやき', personality: 'brave', unlockedAtKnownness: 700, baseStats: { maxHp: 142, attack: 21, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kintsuba', name: 'きんつば', personality: 'balanced', unlockedAtKnownness: 900, baseStats: { maxHp: 136, attack: 20, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-karinto', name: 'かりんとう', personality: 'brave', unlockedAtKnownness: 1200, baseStats: { maxHp: 132, attack: 23, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-anmitsu', name: 'あんみつ', personality: 'balanced', unlockedAtKnownness: 1500, baseStats: { maxHp: 146, attack: 20, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kuzumochi', name: 'くずもち', personality: 'cautious', unlockedAtKnownness: 2000, baseStats: { maxHp: 156, attack: 19, defense: 9 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-sakuramochi', name: 'さくらもち', personality: 'brave', unlockedAtKnownness: 2500, baseStats: { maxHp: 152, attack: 24, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 }
  ] },
  personalities: { cautious: { label: '慎重', returnHpRatio: 0.50, emergencyHpRatio: 0.25, preferredMinHunts: 1, maxHuntsPerTrip: 2, returnChance: 0.45 }, balanced: { label: '普通', returnHpRatio: 0.35, emergencyHpRatio: 0.20, preferredMinHunts: 2, maxHuntsPerTrip: 3, returnChance: 0.30 }, brave: { label: '勇敢', returnHpRatio: 0.25, emergencyHpRatio: 0.12, preferredMinHunts: 3, maxHuntsPerTrip: 5, returnChance: 0.18 } },
  EQUIPMENT: { GEAR_BUDGET_RATE: 0.35, MONTHLY_DROP_HUNT_THRESHOLD: 3, SCORE_ATTACK_WEIGHT: 4, SCORE_DEFENSE_WEIGHT: 3, SCORE_HP_WEIGHT: 0.4, SCORE_FAVOR_WEIGHT: 1, FACILITY_DISTANCE_WEIGHT: 1, FACILITY_BONUS_WEIGHT: 36, RECENT_USAGE_PENALTY: 18, RANDOM_TIEBREAKER: 4, FACILITY_BASE_SCORE: 1000, FACILITY_HEAL_WEIGHT: 140, FACILITY_FOOD_HP_WEIGHT: 20, FACILITY_SPEND_G_WEIGHT: 0.15, FACILITY_FOOD_G_WEIGHT: 0.2, FACILITY_EQUIPMENT_GEAR_WEIGHT: 0.12, MONTHLY_DROP_TABLE: ['driftwood_spear', 'shell_armor', 'lucky_pearl'], monthlyDropTable: ['driftwood_spear', 'shell_armor', 'lucky_pearl'] },
  ITEMS: {
    driftwood_spear: { id: 'driftwood_spear', name: '流木の槍', type: 'weapon', price: 90, attackBonus: 6, defenseBonus: 0, hpBonus: 0, favorBonus: 1, shopType: 'blacksmith', tier: 1 },
    shell_armor: { id: 'shell_armor', name: '貝殻のよろい', type: 'armor', price: 120, attackBonus: 0, defenseBonus: 4, hpBonus: 14, favorBonus: 1, shopType: 'blacksmith', tier: 1 },
    lucky_pearl: { id: 'lucky_pearl', name: '幸運の真珠', type: 'accessory', price: 150, attackBonus: 1, defenseBonus: 1, hpBonus: 8, favorBonus: 2, shopType: 'restaurant', tier: 1 }
  },
  seal: { maxHp: 130, attack: 18, defense: 5, baseSpeed: 50, roadSpeedMultiplier: 1.55, lowHpRatio: 0.4, innHpThreshold: 0.45, mediumHpRatio: 0.72, mediumInnChance: 0.35, mealsBeforeInnSoftLimit: 2, mealsInnChanceBoost: 0.35, fallenRecoveryPerSecond: 3, standHpRatio: 0.36, restTargetRatio: 0.88, contactDistance: 15, rescueScanDistance: 380, spendSeconds: 1.4, restSeconds: 1, startG: 0, spread: 24, huntDurationLimit: 42, noMonsterExploreSeconds: 8, favorHuntDurationBonus: 0.35, maxFavorHuntDurationBonus: 8, carriedGReturnThreshold: 56, carriedGReturnChance: 0.35, wanderSeconds: 2.5, levelExp: 48, levelHpGain: 10, levelAttackGain: 2, favorDefeat: 2, favorLevelUp: 4, favorFacilityUse: 1, favorRescued: 3, facilityChoiceWeights: { inn: 1.2, restaurant: 1.0, manjuShop: 1.05, blacksmith: 0.8 }, blacksmithAttackChance: 0.45, blacksmithAttackGain: 1 },
  monster: { cap: 7, spawnInterval: 2.4, hp: 64, attack: 13, defense: 3, rewardG: 28, rewardExp: 16, contactDistance: 18 },
  combat: { sealAttackSeconds: 0.75, monsterAttackSeconds: 1.0, minDamage: 1 },
  render: { corridor: 'rgba(236,220,149,.28)', blockedPatchOverlay: 'rgba(20,70,30,.18)', gridLine: 'rgba(255,255,255,.13)', island: '#79b85c', buildableLand: '#8dcc68', blockedLand: '#4e7f3d', outside: '#1b90a9', water: '#126d8b', beach: '#d9c887', boundary: 'rgba(255,255,255,.46)', road: '#b28a56', invalid: 'rgba(255,50,50,.45)', valid: 'rgba(80,255,140,.35)', roadPreviewValid: 'rgba(204,255,88,.44)', roadPreviewInvalid: 'rgba(255,72,72,.52)', roadPreviewDelete: 'rgba(255,132,48,.52)', roadPreviewDeleteInvalid: 'rgba(255,95,95,.24)', roadPreviewStart: 'rgba(255,255,255,.9)', shadow: 'rgba(0,0,0,.24)', font: '13px system-ui', bigFont: '18px system-ui', minimapW: 220, minimapH: 128, boundaryDash: 0.35, boundaryGap: 0.18, boundaryLine: 3, obstacle: { center: 0.5, shadowX: 2, shadowY: 10, shadowW: 14, shadowH: 6, grassLine: 3, grassBaseY: 10, grassReachX: 13, grassTipY: -2, grassReachY: 8, trunkX: 4, trunkY: 0, trunkW: 8, trunkH: 15, treeRadius: 15, treeY: -5, rockY: 4, rockW: 15, rockH: 11, rockTilt: -0.35 } },
  RENDER: { ENTITIES: { sealSpriteScale: 1.5, monsterSpriteScale: 1.3, sealShadowScale: 0.9, monsterShadowScale: 0.75, nameFontSize: 11, hpBarWidthScale: 0.9, hpBarHeight: 5, labelOffsetY: -8, hpOffsetY: 6, selectedRingScale: 1.25, shadowOffsetYScale: 0.32, shadowWidthScale: 0.34, shadowHeightScale: 0.14, selectedRingOffsetYScale: 0.3, selectedRingWidthScale: 0.36, selectedRingHeightScale: 0.18, outlineWidth: 3, selectedRingLineWidth: 4 } }
});
