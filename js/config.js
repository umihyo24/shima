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
  SAVE_VERSION: 14,
  AUTO_SAVE_INTERVAL_MS: 30000,
  MAX_LOGS: 7,
  resident: { defaultName: '島のあざらし' },
  dungeon: {
    clickRadius: 26,
    completedDisplayMs: 10000,
    returnDisplayMs: 6000,
    logMax: 8,
    states: { available: 'available', assembling: 'assembling', running: 'running', returning: 'returning', completed: 'completed', expired: 'expired' },
    stateLabels: { available: '探索可', assembling: '集合中', running: '攻略中', returning: '帰還中', completed: '攻略完了', expired: '消滅' },
    nodeLabels: { entrance: '入口', battle: '戦闘', chest: '宝箱', trap: '罠', boss: 'ボス', exit: '出口' },
    progressSpeedByPersonality: { cautious: 0.9, brave: 1.08, balanced: 1 },
    outcome: { battleDamage: 3, braveDamageBonus: 2, cautiousTrapDamageReduction: 2, trapDamage: 4, lowPowerRewardMultiplier: 0.65, rewardBattleMultiplier: 0.08, rewardChestMultiplier: 0.12, rewardBossMultiplier: 0.18, rewardTrapPenaltyMultiplier: 0.05, expBattleBonus: 3 },
    labels: { movingToDungeon: '遠征集合中', waitingAtDungeon: '入口で待機中', runningText: '探索中', returningText: '帰還中', peopleExpedition: '遠征中', participantCount: '探索中 {count}匹', assemblingCount: '集合中 {count}匹', returningCount: '帰還中 {count}匹', noParticipants: '参加者なし', routeTitle: '遠征ルート', logTitle: '遠征ログ', completedReward: '獲得報酬' },
    spawnAttempts: 40,
    minDistanceFromVillageTiles: 4,
    participant: { min: 1, max: 3, clearFavor: 2, allowUnlockedProfileRecruit: true, personalityBonus: { brave: 16, balanced: 8, cautious: 2 }, activeSealBonus: 12, residentBonus: 6 }
  },
  DUNGEONS: {
    definitions: [
      { id: 'crabNest_1', typeId: 'crabNest', name: 'カニの巣', level: 1, knownnessRequired: 0, previousDungeonId: null, previousClearCountRequired: 0, recommendedPower: 40, recruitCost: 35, rewardG: 85, rewardExp: 26, rewardKnownness: 8, firstClearUnlockItems: ['driftwood_spear'], nodePattern: ['entrance', 'battle', 'chest', 'boss', 'exit'], mapPosition: { x: 39, y: 12 } },
      { id: 'crabNest_2', typeId: 'crabNest', name: 'カニの巣', level: 2, knownnessRequired: 0, previousDungeonId: 'crabNest_1', previousClearCountRequired: 3, recommendedPower: 70, recruitCost: 70, rewardG: 150, rewardExp: 45, rewardKnownness: 14, firstClearUnlockItems: ['crab_claw_spear'], nodePattern: ['entrance', 'battle', 'chest', 'battle', 'boss', 'exit'], mapPosition: { x: 43, y: 17 } },
      { id: 'wreck_1', typeId: 'wreck', name: '沈没船', level: 1, knownnessRequired: 300, previousDungeonId: null, previousClearCountRequired: 0, recommendedPower: 80, recruitCost: 80, rewardG: 170, rewardExp: 48, rewardKnownness: 16, firstClearUnlockItems: ['shell_armor'], nodePattern: ['entrance', 'trap', 'battle', 'chest', 'boss', 'exit'], mapPosition: { x: 46, y: 23 } }
    ],
    spawnIntervalMs: 90000,
    initialSpawnDelayMs: 18000,
    maxActiveDungeons: 2,
    expiresInMs: 180000,
    clearCountToUnlockNextLevel: 3,
    nodeTypes: { entrance: 'entrance', battle: 'battle', chest: 'chest', trap: 'trap', boss: 'boss', exit: 'exit' },
    spawnAreas: { coast: { id: 'coast', label: '外の冒険エリア coast', bounds: { x: 34, y: 5, w: 16, h: 24 } } },
    nodeDurationsMs: { entrance: 3000, battle: 4600, chest: 3200, trap: 3600, boss: 5600, exit: 2800 },
    types: {
      crabNest: {
        id: 'crabNest', name: 'カニの巣', areaId: 'coast', focus: 'weapon', levels: [
          { id: 'crabNest-1', name: 'カニの巣', level: 1, knownnessRequired: 0, recommendedPower: 42, recruitCost: 35, durationMultiplier: 0.85, rewardG: 85, rewardExp: 26, rewardKnownness: 8, dropTable: [{ itemId: 'driftwood_spear', count: 1, weight: 7 }, { itemId: 'crab_claw_spear', count: 1, weight: 2 }], nodePattern: ['entrance', 'battle', 'chest', 'boss', 'exit'] },
          { id: 'crabNest-2', name: 'カニの巣', level: 2, knownnessRequired: 0, recommendedPower: 58, recruitCost: 55, durationMultiplier: 1.0, rewardG: 120, rewardExp: 38, rewardKnownness: 12, dropTable: [{ itemId: 'driftwood_spear', count: 1, weight: 4 }, { itemId: 'crab_claw_spear', count: 1, weight: 6 }], nodePattern: ['entrance', 'battle', 'trap', 'chest', 'boss', 'exit'] },
          { id: 'crabNest-3', name: 'カニの巣', level: 3, knownnessRequired: 0, recommendedPower: 78, recruitCost: 80, durationMultiplier: 1.2, rewardG: 165, rewardExp: 54, rewardKnownness: 18, dropTable: [{ itemId: 'crab_claw_spear', count: 1, weight: 8 }, { itemId: 'shell_armor', count: 1, weight: 2 }], nodePattern: ['entrance', 'battle', 'battle', 'chest', 'trap', 'boss', 'exit'] },
          { id: 'crabNest-4', name: 'カニの巣', level: 4, knownnessRequired: 0, recommendedPower: 102, recruitCost: 110, durationMultiplier: 1.4, rewardG: 220, rewardExp: 72, rewardKnownness: 25, dropTable: [{ itemId: 'crab_claw_spear', count: 1, weight: 9 }, { itemId: 'sailor_coat', count: 1, weight: 1 }], nodePattern: ['entrance', 'battle', 'trap', 'battle', 'chest', 'boss', 'exit'] },
          { id: 'crabNest-5', name: 'カニの巣', level: 5, knownnessRequired: 0, recommendedPower: 132, recruitCost: 145, durationMultiplier: 1.65, rewardG: 295, rewardExp: 96, rewardKnownness: 34, dropTable: [{ itemId: 'crab_claw_spear', count: 1, weight: 10 }, { itemId: 'sailor_coat', count: 1, weight: 2 }], nodePattern: ['entrance', 'battle', 'battle', 'trap', 'chest', 'battle', 'boss', 'exit'] }
        ]
      },
      wreck: {
        id: 'wreck', name: '沈没船', areaId: 'coast', focus: 'armor', levels: [
          { id: 'wreck-1', name: '沈没船', level: 1, knownnessRequired: 300, recommendedPower: 88, recruitCost: 90, durationMultiplier: 1.15, rewardG: 155, rewardExp: 48, rewardKnownness: 18, dropTable: [{ itemId: 'shell_armor', count: 1, weight: 7 }, { itemId: 'sailor_coat', count: 1, weight: 2 }], nodePattern: ['entrance', 'trap', 'chest', 'battle', 'boss', 'exit'] },
          { id: 'wreck-2', name: '沈没船', level: 2, knownnessRequired: 300, recommendedPower: 112, recruitCost: 120, durationMultiplier: 1.3, rewardG: 210, rewardExp: 66, rewardKnownness: 25, dropTable: [{ itemId: 'shell_armor', count: 1, weight: 4 }, { itemId: 'sailor_coat', count: 1, weight: 6 }], nodePattern: ['entrance', 'trap', 'battle', 'chest', 'boss', 'exit'] },
          { id: 'wreck-3', name: '沈没船', level: 3, knownnessRequired: 300, recommendedPower: 140, recruitCost: 155, durationMultiplier: 1.5, rewardG: 280, rewardExp: 88, rewardKnownness: 34, dropTable: [{ itemId: 'sailor_coat', count: 1, weight: 8 }, { itemId: 'crab_claw_spear', count: 1, weight: 2 }], nodePattern: ['entrance', 'trap', 'battle', 'chest', 'trap', 'boss', 'exit'] },
          { id: 'wreck-4', name: '沈没船', level: 4, knownnessRequired: 300, recommendedPower: 172, recruitCost: 195, durationMultiplier: 1.75, rewardG: 365, rewardExp: 112, rewardKnownness: 45, dropTable: [{ itemId: 'sailor_coat', count: 1, weight: 9 }, { itemId: 'crab_claw_spear', count: 1, weight: 2 }], nodePattern: ['entrance', 'trap', 'battle', 'battle', 'chest', 'boss', 'exit'] },
          { id: 'wreck-5', name: '沈没船', level: 5, knownnessRequired: 300, recommendedPower: 210, recruitCost: 240, durationMultiplier: 2.0, rewardG: 470, rewardExp: 145, rewardKnownness: 58, dropTable: [{ itemId: 'sailor_coat', count: 1, weight: 10 }, { itemId: 'crab_claw_spear', count: 1, weight: 3 }], nodePattern: ['entrance', 'trap', 'battle', 'trap', 'chest', 'battle', 'boss', 'exit'] }
        ]
      }
    }
  },
  sealStates: { movingToDungeon: 'movingToDungeon', waitingAtDungeon: 'waitingAtDungeon', expeditionRunning: 'expeditionRunning', returningFromDungeon: 'returningFromDungeon', questing: 'questing', arrivingFromSea: 'arrivingFromSea', choosingArrivalAction: 'choosingArrivalAction', movingToFacility: 'movingToFacility', usingFacility: 'usingFacility', choosingHuntArea: 'choosingHuntArea', movingToHuntArea: 'movingToHuntArea', hunting: 'hunting', movingToMonster: 'movingToMonster', fighting: 'fighting', returningFromHunt: 'returningFromHunt', choosingPostHuntFacility: 'choosingPostHuntFacility', leavingToSea: 'leavingToSea', idle: 'idle', fallen: 'fallen', downed: 'downed', rescuing: 'rescuing', carryingFallenSeal: 'carryingFallenSeal', beingCarried: 'beingCarried', resting: 'resting', arriving: 'arriving', movingToHuntExit: 'movingToHuntExit', choosingFacility: 'choosingFacility', leaving: 'leaving' },
  CALENDAR: { WEEK_DURATION_MS: 12000, WEEKS_PER_MONTH: 4, MONTHS_PER_YEAR: 12 },
  TIME: { SPEED_OPTIONS: [0, 1, 2, 4], DEFAULT_SCALE: 1 },
  ASSETS: { paths: {
    'seals.goma': 'assets/seals/seal_white_goma_idle.png',
    'seals.kurakake': 'assets/seals/seal_spotted_kurakake_idle.png',
    'seals.tategoto': 'assets/seals/seal_harp_tategoto_idle.png',
    'seals.jumbo': 'assets/seals/seal_giant_jumbo_idle.png',
    'seals.resident': 'assets/seals/seal_white_resident_idle.png',
    'monsters.crab': 'assets/monsters/monster_water_coast_crab.png',
    'monsters.giant_crab': 'assets/monsters/monster_water_coast_giant_crab.png',
    'cards.facility_neutral_inn_idle': 'assets/cards/facility_neutral_inn_idle.png',
    'cards.facility_neutral_restaurant_idle': 'assets/cards/facility_neutral_restaurant_idle.png',
    'cards.facility_neutral_blacksmith_idle': 'assets/cards/facility_neutral_blacksmith_idle.png',
    'cards.facility_neutral_manjuShop_idle': 'assets/cards/facility_neutral_manjuShop_idle.png',
    'cards.manjuShop': 'assets/cards/facility_neutral_manjuShop_idle.png',
    'facilities.manjuShop': 'assets/cards/facility_neutral_manjuShop_idle.png',
    'cards.facility_neutral_publicToilet_idle': 'assets/cards/facility_neutral_publicToilet_idle.png',
    'facilities.publicToilet': 'assets/cards/facility_neutral_publicToilet_idle.png',
    'facilities.bench': 'assets/cards/facility_life_bench_idle.png',
    'facilities.observationDeck': 'assets/cards/facility_life_observationDeck_idle.png',
    'facilities.sealPlaza': 'assets/cards/facility_life_sealPlaza_idle.png'
  } },
  SPRITES: { seal: { w: 42, h: 30 }, monster: { w: 34, h: 24 }, defaultFacing: 'left' },
  KNOWNNESS: { UNLOCK_THRESHOLDS: [100, 200, 300, 400, 500], PANEL_WIDTH: 210, PANEL_HEIGHT: 74, PANEL_MARGIN: 18 },
  NEXT_GOAL_PANEL: {
    x: 16, y: 80, width: 260, height: 88, padding: 10, radius: 12, shadowOffsetX: 3, shadowOffsetY: 4, borderWidth: 1,
    titleFont: '700 15px system-ui', bodyFont: '13px system-ui', lineHeight: 20,
    background: 'rgba(12, 43, 56, .82)', border: 'rgba(180, 240, 255, .72)', titleColor: '#fff8ba', textColor: '#f5fbff', accentColor: '#aef3ff', shadowColor: 'rgba(0, 0, 0, .22)'
  },
  knownness: { initial: 0, huntRewardPerMonthlyHunt: 4, monthlyBaseReward: 2, satisfyingVisitReward: 3, duplicateRelicReward: 1 },
  movement: { roadCost: 1, buildableCost: 4, outsideCost: 5, waterCost: 3, maxPathNodes: 2500, pathReachDistance: 8, maxWaypointStepsPerFrame: 24, fallbackWarnCooldownMs: 60000, directFallbackReasons: ['rescue', 'carry', 'dungeon-entrance', 'dungeon-return'] },
  timing: { targetFps: 60, maxDt: 0.05, uiMs: 120 },
  BUILD_CATEGORIES: [
    { id: 'roads', label: '道路', icon: '🛣', toolIds: ['road'] },
    { id: 'adventure', label: '冒険', icon: '⚔', toolIds: ['blacksmith', 'weaponShop', 'armorShop'] },
    { id: 'food', label: '飲食', icon: '🍡', toolIds: ['restaurant', 'manjuShop'] },
    { id: 'relax', label: 'くつろぎ', icon: '🦭', toolIds: ['inn', 'publicToilet', 'bench', 'observationDeck', 'sealPlaza'] },
    { id: 'decor', label: '装飾', icon: '🌲', toolIds: ['flower', 'tree', 'rock'] },
    { id: 'manage', label: '管理', icon: '🛠', toolIds: ['clear', 'move', 'delete', 'rotate'] }
  ],
  inspector: { buttonLabels: { move: '移動', rotate: '回転', delete: '削除' }, rotationFeedbackSeconds: 0.75 },
  UI: { entranceConnectedColor: '#34e86b', entranceDisconnectedColor: '#ff4d4d', entrancePreviewColor: '#ffe66b', entranceAccessConnected: 'rgba(52,232,107,.42)', entranceAccessDisconnected: 'rgba(255,77,77,.42)' },
  placement: { roadSize: 1, decorationSize: 1, facilitySize: 2, feedbackSeconds: 0.75, roadRoute: { maxTiles: 32, allowExistingRoads: true, blockObjects: true, requireBuildableLand: true, scoreInvalidWeight: 1000, scoreBlockedWeight: 100, scoreTurnWeight: 10, scoreExistingRoadBonus: 2 } },
  directions: [ { name: 'N', dx: 0, dy: -1 }, { name: 'E', dx: 1, dy: 0 }, { name: 'S', dx: 0, dy: 1 }, { name: 'W', dx: -1, dy: 0 } ],
  tools: [
    { id: 'road', label: '🟫 道路', name: '道路', category: 'roads', kind: 'road', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: 'あざらしの移動速度が上がり、施設入口への接続に使います。', requiresRoadEntrance: false, levelText: '', notes: 'ドラッグで連続配置できます。既存施設や未開拓地には配置できません。' },
    { id: 'inn', label: '🏨 宿屋', name: '宿屋', category: 'relax', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: '準備と休息のために滞在し、好感度や滞在時間に少し良い影響があります（HPは回復しません）。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、収益と滞在効果が伸びます。', notes: '入口が道路に接続している必要があります。木の近くで装飾ボーナスを得ます。' },
    { id: 'restaurant', label: '🍲 食堂', name: '食堂', category: 'food', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: '食事でHPを回復し、好感度を少し上げます。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、回復量と収益が伸びます。', notes: '入口が道路に接続している必要があります。花の近くで装飾ボーナスを得ます。' },
    { id: 'manjuShop', label: '🍡 まんじゅう屋', name: 'まんじゅう屋', category: 'food', kind: 'facility', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '軽食で少量回復し、短時間でGを消費します。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、回復量と収益が伸びます。', notes: '小型施設です。入口を道路に向けて配置してください。' },
    { id: 'blacksmith', label: '⚒️ 鍛冶屋', name: '鍛冶屋', category: 'adventure', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: 'レガシー武器屋互換施設です。解放済み武器を販売します。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、収益が伸びます。', notes: '入口が道路に接続している必要があります。岩の近くで装飾ボーナスを得ます。' },
    { id: 'weaponShop', label: '🗡️ 武器屋', name: '武器屋', category: 'adventure', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: '解放済み武器を販売します。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、収益が伸びます。', notes: '入口が道路に接続している必要があります。岩の近くで装飾ボーナスを得ます。' },
    { id: 'armorShop', label: '🛡️ 防具屋', name: '防具屋', category: 'adventure', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: '解放済み防具を販売します。', requiresRoadEntrance: true, levelText: '利用回数で施設レベルが上がり、収益が伸びます。', notes: '入口が道路に接続している必要があります。岩の近くで装飾ボーナスを得ます。' },
    { id: 'publicToilet', label: '🚻 公衆トイレ', name: '公衆トイレ', category: 'relax', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: 'アザラシがたまに立ち寄り、好感度が少し上がります。', requiresRoadEntrance: false, hasDirection: false, levelText: '利用回数で成長します。収入はありません。', notes: '道路接続は不要で、入口方向やR回転の影響を受けません。' },
    { id: 'bench', label: '🪑 ベンチ', name: 'ベンチ', category: 'relax', kind: 'facility', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '休憩施設。HPを少し回復し、好感度が上がります。', requiresRoadEntrance: false, hasDirection: false, levelText: '利用回数で施設レベルが上がり、HP回復量が少し伸びます。', notes: '道路接続は不要です。1匹だけ利用できます。' },
    { id: 'observationDeck', label: '🔭 展望台', name: '展望台', category: 'relax', kind: 'facility', w: 2, h: 2, width: 2, height: 2, cost: 0, effectText: '海を眺める施設。好感度が上がります。', requiresRoadEntrance: false, hasDirection: false, levelText: '利用回数で施設レベルが上がり、好感度上昇量が少し伸びます。', notes: '道路接続は不要です。最大2匹がゆっくり海を眺めます。' },
    { id: 'sealPlaza', label: '🦭 あざらし広場', name: 'あざらし広場', category: 'relax', kind: 'facility', w: 3, h: 3, width: 3, height: 3, cost: 0, effectText: 'アザラシたちが集まる広場です。', requiresRoadEntrance: false, hasDirection: false, levelText: '利用回数で施設レベルが上がり、好感度上昇量が少し伸びます。', notes: '道路接続は不要です。最大6匹が別々の広場スロットを使います。' },
    { id: 'flower', label: '🌼 花', name: '花', category: 'decor', kind: 'decoration', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '近くの食堂やまんじゅう屋に装飾ボーナスを与えます。', requiresRoadEntrance: false, levelText: '', notes: '1マス装飾です。施設の近くに置くと効果的です。' },
    { id: 'tree', label: '🌲 木', name: '木', category: 'decor', kind: 'decoration', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '近くの宿屋に装飾ボーナスを与えます。', requiresRoadEntrance: false, levelText: '', notes: '1マス装飾です。施設の近くに置くと効果的です。' },
    { id: 'rock', label: '🪨 岩', name: '岩', category: 'decor', kind: 'decoration', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '近くの鍛冶屋・武器屋・防具屋に装飾ボーナスを与えます。', requiresRoadEntrance: false, levelText: '', notes: '1マス装飾です。施設の近くに置くと効果的です。' },
    { id: 'clear', label: '⛏️ 開拓', name: '開拓', category: 'manage', kind: 'clear', w: 1, h: 1, width: 1, height: 1, cost: null, effectText: '未開拓の草木岩を取り除き、周辺の土地を建設可能にします。', requiresRoadEntrance: false, levelText: '', notes: '費用は開拓回数に応じて増えます。' },
    { id: 'move', label: '↔️ 移動', name: '移動', category: 'manage', kind: 'move', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '既存施設を選択して移動します。Rで向きを変更できます。右クリック/Escapeでキャンセル。', requiresRoadEntrance: false, levelText: '', notes: '移動は無料です。施設レベル・利用回数・収益を保持します。' },
    { id: 'delete', label: '❌ 削除', name: '削除', category: 'manage', kind: 'delete', w: 1, h: 1, width: 1, height: 1, cost: 0, effectText: '配置済みの道路・施設・装飾を撤去します。', requiresRoadEntrance: false, levelText: '', notes: '道路はドラッグでまとめて削除できます。' }
  ],
  FACILITY_LEVELS: { maxLevel: 10, defaultMaxLevel: 10, thresholds: [0, 5, 12, 25, 45, 70, 100, 140, 190, 250], xpRequiredByLevel: [0, 5, 12, 25, 45, 70, 100, 140, 190, 250], qualityPerLevel: 1, priceMultiplierPerLevel: 0.08, healingMultiplierPerLevel: 0.08, incomeMultiplierPerLevel: 0.05, effectMultiplierPerLevel: 1.2 },
  FACILITY_INSPECTOR: { width: 300, padding: 12, buttonHeight: 32, clickPriority: 30, fallbackName: '不明な施設', noGoodsText: '解放済み商品なし', fixedEffectText: '固定効果' },
  FACILITIES: {
    inn: { name: '宿屋', label: '宿屋', w: 2, h: 2, basePrice: 36, fee: 36, baseHeal: 0, healPerSecond: 0, favorGain: 2, stayBonusMs: 6000, gearBudgetBonus: 8, color: '#2f7eb5', bonusDecoration: 'tree', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'relax', tags: ['heal', 'lodging'] },
    restaurant: { name: '食堂', label: '食堂', w: 2, h: 2, basePrice: 45, baseHeal: 24, favorGain: 1, spendPerVisit: 45, color: '#d66b2b', bonusDecoration: 'flower', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'food', tags: ['food', 'meal'] },
    manjuShop: { name: 'まんじゅう屋', label: 'まんじゅう屋', w: 1, h: 1, basePrice: 20, baseHeal: 12, favorGain: 1, color: '#d895b8', bonusDecoration: 'flower', bonusRate: 0.03, entranceRequired: true, entranceSide: 'north', category: 'food', tags: ['food', 'snack'] },
    blacksmith: { name: '鍛冶屋', label: '鍛冶屋', w: 2, h: 2, spendPerVisit: 65, color: '#7d6043', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment'] },
    weaponShop: { name: '武器屋', label: '武器屋', w: 2, h: 2, spendPerVisit: 65, color: '#87613f', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment', 'weapon'] },
    armorShop: { name: '防具屋', label: '防具屋', w: 2, h: 2, spendPerVisit: 65, color: '#5f6f82', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment', 'armor'] },
    publicToilet: { name: '公衆トイレ', label: '公衆トイレ', w: 2, h: 2, basePrice: 0, baseFavorGain: 1, useDurationMs: 5000, color: '#6fb7c8', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'toilet', 'rest'] },
    bench: { name: 'ベンチ', label: 'ベンチ', w: 1, h: 1, basePrice: 0, spendPerVisit: 0, baseFavorGain: 1, baseHeal: 8, useDurationMs: 5000, capacity: 1, lifeWeight: 0.15, color: '#9b6a3d', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'rest'], useSlots: [{ x: 0.5, y: 0.5 }] },
    observationDeck: { name: '展望台', label: '展望台', w: 2, h: 2, basePrice: 0, spendPerVisit: 0, baseFavorGain: 2, useDurationMs: 8000, capacity: 2, lifeWeight: 0.10, color: '#7da0b5', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'view'], useSlots: [{ x: 0.7, y: 0.8 }, { x: 1.3, y: 1.2 }] },
    sealPlaza: { name: 'あざらし広場', label: 'あざらし広場', w: 3, h: 3, basePrice: 0, spendPerVisit: 0, baseFavorGain: 1, useDurationMs: 10000, capacity: 6, lifeWeight: 0.20, color: '#c7b98f', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'social'], useSlots: [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 2.5, y: 0.5 }, { x: 0.5, y: 1.5 }, { x: 2.5, y: 1.5 }, { x: 1.5, y: 2.5 }] }
  },
  facilities: {
    inn: { name: '宿屋', label: '宿屋', w: 2, h: 2, basePrice: 36, fee: 36, baseHeal: 0, healPerSecond: 0, favorGain: 2, stayBonusMs: 6000, gearBudgetBonus: 8, color: '#2f7eb5', bonusDecoration: 'tree', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'relax', tags: ['heal', 'lodging'] },
    restaurant: { name: '食堂', label: '食堂', w: 2, h: 2, basePrice: 45, baseHeal: 24, favorGain: 1, spendPerVisit: 45, color: '#d66b2b', bonusDecoration: 'flower', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'food', tags: ['food', 'meal'] },
    manjuShop: { name: 'まんじゅう屋', label: 'まんじゅう屋', w: 1, h: 1, basePrice: 20, baseHeal: 12, favorGain: 1, color: '#d895b8', bonusDecoration: 'flower', bonusRate: 0.03, entranceRequired: true, entranceSide: 'north', category: 'food', tags: ['food', 'snack'] },
    blacksmith: { name: '鍛冶屋', label: '鍛冶屋', w: 2, h: 2, spendPerVisit: 65, color: '#7d6043', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment'] },
    weaponShop: { name: '武器屋', label: '武器屋', w: 2, h: 2, spendPerVisit: 65, color: '#87613f', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment', 'weapon'] },
    armorShop: { name: '防具屋', label: '防具屋', w: 2, h: 2, spendPerVisit: 65, color: '#5f6f82', bonusDecoration: 'rock', bonusRate: 0.05, entranceRequired: true, entranceSide: 'north', category: 'adventure', tags: ['equipment', 'armor'] },
    publicToilet: { name: '公衆トイレ', label: '公衆トイレ', w: 2, h: 2, basePrice: 0, baseFavorGain: 1, useDurationMs: 5000, color: '#6fb7c8', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'toilet', 'rest'] },
    bench: { name: 'ベンチ', label: 'ベンチ', w: 1, h: 1, basePrice: 0, spendPerVisit: 0, baseFavorGain: 1, baseHeal: 8, useDurationMs: 5000, capacity: 1, lifeWeight: 0.15, color: '#9b6a3d', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'rest'], useSlots: [{ x: 0.5, y: 0.5 }] },
    observationDeck: { name: '展望台', label: '展望台', w: 2, h: 2, basePrice: 0, spendPerVisit: 0, baseFavorGain: 2, useDurationMs: 8000, capacity: 2, lifeWeight: 0.10, color: '#7da0b5', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'view'], useSlots: [{ x: 0.7, y: 0.8 }, { x: 1.3, y: 1.2 }] },
    sealPlaza: { name: 'あざらし広場', label: 'あざらし広場', w: 3, h: 3, basePrice: 0, spendPerVisit: 0, baseFavorGain: 1, useDurationMs: 10000, capacity: 6, lifeWeight: 0.20, color: '#c7b98f', entranceRequired: false, requiresRoadConnection: false, hasDirection: false, category: 'relax', tags: ['life', 'social'], useSlots: [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 2.5, y: 0.5 }, { x: 0.5, y: 1.5 }, { x: 2.5, y: 1.5 }, { x: 1.5, y: 2.5 }] }
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
    facilityTypes: { lowHp: ['manjuShop', 'restaurant'], reducedHp: ['manjuShop', 'restaurant'], gear: ['blacksmith', 'weaponShop', 'armorShop'], optional: ['manjuShop', 'restaurant', 'blacksmith', 'inn'] }
  } },
  visitor: { safetyMaxActive: 30, spawnInterval: 16, spawnIntervalFavorReduction: 0.04, minSpawnIntervalMultiplier: 0.55, returnBaseWeight: 1, returnFavorWeight: 0.18, inactiveWeightBonus: 3, fewerVisitsWeight: 0.18, safeLeaveFavor: 2, debugSpawnCandidates: false, entrySpawn: { x: 14, y: 24 }, spawnSearchRadius: 8, minStayMs: 45000, maxStayMs: 110000, maxStayFavorBonusMs: 25000, maxStayFavorMsPerFavor: 1000, satisfyingMinFacilities: 1, satisfyingMinHunts: 1, enoughHuntsForLeave: 2, profiles: [
    { id: 'visitor-goma', name: 'ゴマ', personality: 'balanced', unlockedAtKnownness: 0, baseStats: { maxHp: 130, attack: 18, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kurakake', name: 'クラカケ', personality: 'cautious', unlockedAtKnownness: 0, baseStats: { maxHp: 120, attack: 17, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-tategoto', name: 'タテゴト', personality: 'brave', unlockedAtKnownness: 100, baseStats: { maxHp: 145, attack: 20, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-jumbo', name: 'ジャンボ', personality: 'balanced', sizeClass: 'giant', unlockedAtKnownness: 200, baseStats: { maxHp: 170, attack: 21, defense: 8 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-dango', name: 'だんご', personality: 'balanced', unlockedAtKnownness: 300, baseStats: { maxHp: 126, attack: 18, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-manju', name: 'まんじゅう', personality: 'cautious', unlockedAtKnownness: 400, baseStats: { maxHp: 138, attack: 17, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-monaka', name: 'もなか', personality: 'balanced', unlockedAtKnownness: 500, baseStats: { maxHp: 124, attack: 19, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-yokan', name: 'ようかん', personality: 'cautious', unlockedAtKnownness: 500, baseStats: { maxHp: 150, attack: 18, defense: 8 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-dorayaki', name: 'どらやき', personality: 'brave', unlockedAtKnownness: 700, baseStats: { maxHp: 142, attack: 21, defense: 6 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kintsuba', name: 'きんつば', personality: 'balanced', unlockedAtKnownness: 900, baseStats: { maxHp: 136, attack: 20, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-karinto', name: 'かりんとう', personality: 'brave', unlockedAtKnownness: 1200, baseStats: { maxHp: 132, attack: 23, defense: 5 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-anmitsu', name: 'あんみつ', personality: 'balanced', unlockedAtKnownness: 1500, baseStats: { maxHp: 146, attack: 20, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-kuzumochi', name: 'くずもち', personality: 'cautious', unlockedAtKnownness: 2000, baseStats: { maxHp: 156, attack: 19, defense: 9 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 },
    { id: 'visitor-sakuramochi', name: 'さくらもち', personality: 'brave', unlockedAtKnownness: 2500, baseStats: { maxHp: 152, attack: 24, defense: 7 }, favor: 0, visits: 0, level: 1, exp: 0, equipment: { weapon: null, armor: null, accessory: null }, gearBudget: 0 }
  ] },
  personalities: { cautious: { label: '慎重', returnHpRatio: 0.50, emergencyHpRatio: 0.25, preferredMinHunts: 1, maxHuntsPerTrip: 2, returnChance: 0.45 }, balanced: { label: '普通', returnHpRatio: 0.35, emergencyHpRatio: 0.20, preferredMinHunts: 2, maxHuntsPerTrip: 3, returnChance: 0.30 }, brave: { label: '勇敢', returnHpRatio: 0.25, emergencyHpRatio: 0.12, preferredMinHunts: 3, maxHuntsPerTrip: 5, returnChance: 0.18 } },
  LIFE_FACILITIES: { hpRecoveryLevelBonus: 2, favorLevelInterval: 4, plazaDurationLevelBonusMs: 250, selectionChance: 0.45, idleHpEmergencyRatio: 0.25, targetReasons: { lifeVisit: 'lifeVisit' } },
  TOILET: { needIncreasePerMinute: 6, foodNeedIncrease: 25, manjuNeedIncrease: 15, useThreshold: 60, urgentThreshold: 85, maxNeed: 100, useDurationMs: 5000, favorGain: 1, selectionWeight: 0.12, urgentSelectionMultiplier: 3, maxSelectionChance: 0.55, levelDurationReductionPerLevel: 0.04, maxDurationReduction: 0.16, minUseDurationMs: 1500, favorLevelInterval: 3 },
  EQUIPMENT: { GEAR_BUDGET_RATE: 0.35, MONTHLY_DROP_HUNT_THRESHOLD: 3, SCORE_ATTACK_WEIGHT: 4, SCORE_DEFENSE_WEIGHT: 3, SCORE_HP_WEIGHT: 0.4, SCORE_FAVOR_WEIGHT: 1, SLOT_TYPES: ['weapon', 'armor', 'accessory'], SHOP_ITEM_TYPES: { weaponShop: ['weapon'], armorShop: ['armor'], blacksmith: ['weapon'] }, STARTER_MAX_TIER: 0, PURCHASE_FAVOR_GAIN: 1, FACILITY_DISTANCE_WEIGHT: 1, FACILITY_BONUS_WEIGHT: 36, RECENT_USAGE_PENALTY: 18, RANDOM_TIEBREAKER: 4, FACILITY_BASE_SCORE: 1000, FACILITY_HEAL_WEIGHT: 140, FACILITY_FOOD_HP_WEIGHT: 20, FACILITY_SPEND_G_WEIGHT: 0.15, FACILITY_FOOD_G_WEIGHT: 0.2, FACILITY_EQUIPMENT_GEAR_WEIGHT: 0.12, MONTHLY_DROP_TABLE: ['driftwood_spear', 'shell_armor', 'lucky_pearl'], monthlyDropTable: ['driftwood_spear', 'shell_armor', 'lucky_pearl'] },
  ITEMS: {
    driftwood_spear: { id: 'driftwood_spear', name: '流木の槍', type: 'weapon', price: 30, attackBonus: 2, defenseBonus: 0, hpBonus: 0, favorBonus: 0, shopType: 'weaponShop', tier: 1 },
    shell_armor: { id: 'shell_armor', name: '貝殻のよろい', type: 'armor', price: 60, attackBonus: 0, defenseBonus: 2, hpBonus: 8, favorBonus: 0, shopType: 'armorShop', tier: 1 },
    crab_claw_spear: { id: 'crab_claw_spear', name: 'カニ爪の槍', type: 'weapon', price: 80, attackBonus: 5, defenseBonus: 0, hpBonus: 0, favorBonus: 0, shopType: 'weaponShop', tier: 2 },
    sailor_coat: { id: 'sailor_coat', name: '船乗りのコート', type: 'armor', price: 120, attackBonus: 0, defenseBonus: 4, hpBonus: 15, favorBonus: 0, shopType: 'armorShop', tier: 2 },
    lucky_pearl: { id: 'lucky_pearl', name: '幸運の真珠', type: 'accessory', price: 150, attackBonus: 1, defenseBonus: 1, hpBonus: 8, favorBonus: 2, shopType: 'restaurant', tier: 1 },
    crab_king_spear: { id: 'crab_king_spear', name: 'カニ王の槍', type: 'weapon', price: 260, attackBonus: 12, defenseBonus: 1, hpBonus: 0, favorBonus: 1, shopType: 'weaponShop', tier: 3 }
  },
  SEAL_RECOVERY: { downedRecoveryPerSecond: 1, downedRecoveryThresholdRatio: 0.35, facilityRecoveryPerSecond: 3, foodRecoveryMultiplier: 1, carrySearchRadius: 5, carryMoveSpeedMultiplier: 0.75, seekRestHpRatio: 0.6, fallbackRecoveryPerSecond: 1.5 },
  REST_PRIORITY: { emptyLand: 1, road: 2 },
  seal: { maxHp: 130, attack: 18, defense: 5, baseSpeed: 50, roadSpeedMultiplier: 1.55, lowHpRatio: 0.4, innHpThreshold: 0.45, mediumHpRatio: 0.72, mediumInnChance: 0.35, mealsBeforeInnSoftLimit: 2, mealsInnChanceBoost: 0.35, fallenRecoveryPerSecond: 3, standHpRatio: 0.36, restTargetRatio: 0.88, contactDistance: 15, rescueScanDistance: 380, spendSeconds: 1.4, restSeconds: 1, startG: 0, spread: 24, huntDurationLimit: 42, noMonsterExploreSeconds: 8, favorHuntDurationBonus: 0.35, maxFavorHuntDurationBonus: 8, carriedGReturnThreshold: 56, carriedGReturnChance: 0.35, wanderSeconds: 2.5, levelExp: 48, levelHpGain: 10, levelAttackGain: 2, favorDefeat: 2, favorLevelUp: 4, favorFacilityUse: 1, favorRescued: 3, facilityChoiceWeights: { inn: 1.2, restaurant: 1.0, manjuShop: 1.05, blacksmith: 0.8 }, blacksmithAttackChance: 0.45, blacksmithAttackGain: 1 },
  LEVEL_UP: { healToFull: false, addMaxHpIncreaseToCurrentHp: false },
  GIANT_ENEMY_SAFETY: { passiveToSeals: true, aggroRadius: 5, chaseRadius: 7, leashRadius: 10, entranceSafeRadius: 8, avoidEntranceRadius: 10, minSpawnDistanceFromEntrance: 12, noAutoEngageBySeals: true, returnStepRatio: 0.08 },
  GIANT_ENEMY: { spawnCheckFrames: 3600, maxActive: 1, clickRadius: 64, scale: 2.2, recommendedPartySize: 5, maxParticipants: 5, minHpRatioToJoin: 0.5, eventDurationFrames: 18000, huntStartDelayFrames: 30, rewardFame: 80, fallbackSpawnMarginTiles: 3, defeatFadeFrames: 180, definitions: [{ id: 'giant_crab', name: '巨大カニ', level: 20, hp: 500, power: 300, defense: 8, rewardGold: 500, rewardFame: 80, firstClearUnlocks: ['crab_king_spear'], imageKey: 'monsters.giant_crab' }] },
  monster: { cap: 7, spawnInterval: 2.4, hp: 64, attack: 13, defense: 3, rewardG: 28, rewardExp: 16, contactDistance: 18, states: { idle: 'idle', patrol: 'patrol', engaged: 'engaged' }, territory: { reactionRadius: 145, leashRadius: 170, groupRadius: 120 }, movement: { idleSecondsMin: 0.8, idleSecondsMax: 1.8, patrolSecondsMin: 1.2, patrolSecondsMax: 2.8, patrolSpeed: 18, engagedSpeed: 10, wanderRadius: 85, edgePadding: 12, retargetDistance: 10 }, visuals: { territoryAlpha: 0.1, engagedLineAlpha: 0.36, groupRingAlpha: 0.18, stateDotRadius: 3 } },
  combat: { sealAttackSeconds: 0.75, monsterAttackSeconds: 1.0, minDamage: 1 },
  SKIRMISH: { triggerRadius: 145, joinRadius: 160, leashRadius: 240, maxSealParticipants: 3, maxEnemyParticipants: 3, battleTickFrames: 30, slotRadius: 34, giantSlotRadius: 52, joinCheckIntervalFrames: 20, staleCombatTimeoutFrames: 600, slotMoveStepRatio: 0.5, localSnapRadius: 72 },
  SKIRMISH_MOVEMENT: { approachSpeedMultiplier: 0.65, maxApproachStep: 1.2, snapDistance: 3, smoothing: 0.12, emergencySnapDistance: 120, emergencySnapFrames: 180 },
  COMBAT_STUCK: { contactRadius: 24, forcedEngageFrames: 20, stuckMoveEpsilon: 0.2, stuckFramesLimit: 45, separateDistance: 28, maxResolveAttempts: 6 },
  render: { corridor: 'rgba(236,220,149,.28)', blockedPatchOverlay: 'rgba(20,70,30,.18)', gridLine: 'rgba(255,255,255,.13)', island: '#79b85c', buildableLand: '#8dcc68', blockedLand: '#4e7f3d', outside: '#1b90a9', water: '#126d8b', beach: '#d9c887', boundary: 'rgba(255,255,255,.46)', road: '#b28a56', invalid: 'rgba(255,50,50,.45)', valid: 'rgba(80,255,140,.35)', roadPreviewValid: 'rgba(204,255,88,.44)', roadPreviewInvalid: 'rgba(255,72,72,.52)', roadPreviewDelete: 'rgba(255,132,48,.52)', roadPreviewDeleteInvalid: 'rgba(255,95,95,.24)', roadPreviewStart: 'rgba(255,255,255,.9)', shadow: 'rgba(0,0,0,.24)', font: '13px system-ui', bigFont: '18px system-ui', minimapW: 220, minimapH: 128, boundaryDash: 0.35, boundaryGap: 0.18, boundaryLine: 3, obstacle: { center: 0.5, shadowX: 2, shadowY: 10, shadowW: 14, shadowH: 6, grassLine: 3, grassBaseY: 10, grassReachX: 13, grassTipY: -2, grassReachY: 8, trunkX: 4, trunkY: 0, trunkW: 8, trunkH: 15, treeRadius: 15, treeY: -5, rockY: 4, rockW: 15, rockH: 11, rockTilt: -0.35 } },
  RENDER: { ENTITIES: { sealSpriteScale: 1.5, sealSizeClassScale: { normal: 1, giant: 2 }, monsterSpriteScale: 1.3, sealShadowScale: 0.9, monsterShadowScale: 0.75, nameFontSize: 11, hpBarWidthScale: 0.9, hpBarHeight: 5, labelOffsetY: -8, hpOffsetY: 6, selectedRingScale: 1.25, shadowOffsetYScale: 0.32, shadowWidthScale: 0.34, shadowHeightScale: 0.14, selectedRingOffsetYScale: 0.3, selectedRingWidthScale: 0.36, selectedRingHeightScale: 0.18, outlineWidth: 3, selectedRingLineWidth: 4 } }
});
