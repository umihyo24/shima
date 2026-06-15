function getSerializableGameState() {
  const objects = Array.isArray(gameState.world?.objects) ? gameState.world.objects : [];
  return {
    phase: CONFIG.phase.playing,
    player: { g: safeFiniteNumber(gameState.player?.g, 0, 0) },
    residentName: String(gameState.residentName || getResidentSeal()?.name || CONFIG.resident.defaultName),
    camera: {
      x: safeFiniteNumber(gameState.camera?.x, CONFIG.camera.x),
      y: safeFiniteNumber(gameState.camera?.y, CONFIG.camera.y),
      zoom: clampNumber(gameState.camera?.zoom, CONFIG.camera.minZoom, CONFIG.camera.maxZoom, CONFIG.camera.zoom)
    },
    ui: {
      directionIndex: clampInteger(gameState.ui?.directionIndex, 0, CONFIG.directions.length - 1, 2)
    },
    world: {
      tiles: cloneSerializable(gameState.world?.tiles, []),
      roads: cloneSerializable(gameState.world?.roads, []),
      facilities: cloneSerializable(objects.filter(o => o?.kind === 'facility').map(o => isLifeFacility(o) ? { ...o, slotReservations: normalizeFacilitySlotReservations(o) } : o), []),
      decorations: cloneSerializable(objects.filter(o => o?.kind === 'decoration'), []),
      nextObjectId: clampInteger(gameState.world?.nextObjectId, 1, Number.MAX_SAFE_INTEGER, 1)
    },
    seals: cloneSerializable((gameState.seals ?? []).map(seal => { const copy = { ...seal }; delete copy.path; delete copy.pathTargetKey; delete copy.targetFacility; return copy; }), []),
    visitorProfiles: cloneSerializable(gameState.visitorProfiles, []),
    dungeons: cloneSerializable(normalizeDungeons(gameState.dungeons), []),
    dungeonProgress: cloneSerializable(normalizeDungeonProgress(gameState.dungeonProgress), { unlockedDungeonIds: [], clearCounts: {}, firstClearRewardsClaimed: {} }),
    relicInventory: cloneSerializable(normalizeRelicInventory(gameState.relicInventory), []),
    shopCatalog: cloneSerializable(normalizeShopCatalog(gameState.shopCatalog, gameState.relicInventory), { unlockedItemIds: [], discoveredAt: {} }),
    facilityProgress: cloneSerializable(normalizeFacilityProgress(gameState.facilityProgress), {}),
    village: { knownness: safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0), clearCount: clampInteger(gameState.village?.clearCount, 0, Number.MAX_SAFE_INTEGER, 0) },
    time: { timeScale: clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE) },
    calendar: {
      year: clampInteger(gameState.calendar?.year, 1, Number.MAX_SAFE_INTEGER, 1),
      month: clampInteger(gameState.calendar?.month, 1, CONFIG.CALENDAR.MONTHS_PER_YEAR, 1),
      week: clampInteger(gameState.calendar?.week, 1, CONFIG.CALENDAR.WEEKS_PER_MONTH, 1),
      weekTimerMs: safeFiniteNumber(gameState.calendar?.weekTimerMs, 0, 0)
    },
    stats: {
      monthlyHunts: clampInteger(gameState.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0),
      monthlyKnownnessGained: safeFiniteNumber(gameState.stats?.monthlyKnownnessGained, 0, 0),
      monthlyPlayerIncome: safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0)
    },
    monsters: cloneSerializable(gameState.monsters, []),
    logs: cloneSerializable(gameState.logs, []).slice(0, CONFIG.MAX_LOGS),
    timers: {
      spawn: safeFiniteNumber(gameState.timers?.spawn, 0, 0),
      monsterSpawn: safeFiniteNumber(gameState.timers?.monsterSpawn, gameState.timers?.spawn ?? 0, 0),
      visitorSpawn: safeFiniteNumber(gameState.timers?.visitorSpawn, 0, 0),
      dungeonSpawnMs: safeFiniteNumber(gameState.timers?.dungeonSpawnMs, 0, 0)
    },
    save: {
      autoSaveTimerMs: safeFiniteNumber(gameState.save?.autoSaveTimerMs, 0, 0),
      lastSavedAt: safeFiniteNumber(gameState.save?.lastSavedAt, null, 0) || null,
      statusText: String(gameState.save?.statusText ?? '')
    }
  };
}

function saveGame(reason) {
  if (gameState.phase !== CONFIG.phase.playing) return false;
  const saveReason = reason === 'auto' ? 'auto' : 'manual';
  const payload = {
    version: CONFIG.SAVE_VERSION,
    savedAt: Date.now(),
    reason: saveReason,
    gameState: getSerializableGameState()
  };
  try {
    window.localStorage?.setItem(CONFIG.SAVE_KEY, JSON.stringify(payload));
    gameState.save.lastSavedAt = payload.savedAt;
    gameState.save.statusText = saveReason === 'auto' ? '自動保存しました' : '手動保存しました';
    logMessage(gameState.save.statusText);
    updateStartSaveInfo();
    updateHud();
    return true;
  } catch (error) {
    gameState.save.statusText = '保存できませんでした（ブラウザの保存領域を確認してください）';
    logMessage(gameState.save.statusText);
    updateHud();
    return false;
  }
}

function loadGame() {
  const payload = readSavePayload();
  if (!validateLoadedGameState(payload)) {
    gameState.save.statusText = 'セーブデータを読み込めませんでした';
    logMessage(gameState.save.statusText);
    updateStartSaveInfo();
    updateHud();
    return false;
  }
  applyLoadedGameState(payload);
  logMessage('セーブデータを読み込みました');
  startScreen.style.display = 'none';
  updateToolButtons();
  updateHud();
  updateStartSaveInfo();
  return true;
}

function hasSaveData() {
  return validateLoadedGameState(readSavePayload());
}

function deleteSaveData() {
  try {
    window.localStorage?.removeItem(CONFIG.SAVE_KEY);
    updateStartSaveInfo();
    return true;
  } catch (error) {
    return false;
  }
}

function validateLoadedGameState(data) {
  const state = data?.gameState;
  if (!Number.isFinite(data?.version) || data.version < 1 || data.version > CONFIG.SAVE_VERSION) return false;
  if (!Number.isFinite(data?.savedAt) || !['manual', 'auto'].includes(data?.reason)) return false;
  if (!state || typeof state !== 'object') return false;
  if (!state.player || !Number.isFinite(state.player?.g)) return false;
  if (!state.world || !Array.isArray(state.world?.tiles) || state.world.tiles.length <= 0) return false;
  if (!Array.isArray(state.world?.roads)) return false;
  if (!Array.isArray(state.world?.facilities) && !Array.isArray(state.world?.objects)) return false;
  if (state.world?.decorations !== undefined && !Array.isArray(state.world.decorations)) return false;
  if (!Array.isArray(state.seals) || !Array.isArray(state.monsters)) return false;
  return true;
}

function applyLoadedGameState(data) {
  const fresh = createNewGameState();
  const loaded = data?.gameState ?? {};
  Object.assign(gameState, fresh);
  gameState.phase = CONFIG.phase.playing;
  gameState.player.g = safeFiniteNumber(loaded.player?.g, 0, 0);
  gameState.residentName = String(loaded.residentName || CONFIG.resident.defaultName);
  gameState.camera.x = safeFiniteNumber(loaded.camera?.x, CONFIG.camera.x);
  gameState.camera.y = safeFiniteNumber(loaded.camera?.y, CONFIG.camera.y);
  gameState.camera.zoom = clampNumber(loaded.camera?.zoom, CONFIG.camera.minZoom, CONFIG.camera.maxZoom, CONFIG.camera.zoom);
  gameState.ui.activeBuildCategory = null;
  gameState.ui.activeManagementPanel = null;
  gameState.ui.selectedTool = null;
  gameState.ui.directionIndex = clampInteger(loaded.ui?.directionIndex, 0, CONFIG.directions.length - 1, 2);
  gameState.ui.selectedSealId = null;
  gameState.ui.selectedPersonRosterId = null;
  gameState.ui.selectedDungeonId = null;
  gameState.ui.selectedFacilityId = null;
  gameState.ui.facilityInspectorOpen = false;
  gameState.ui.inspector = { type: null, id: null, open: false };
  gameState.world.tiles = data?.version < 4 ? generateInitialMap() : normalizeTiles(loaded.world?.tiles);
  protectOpenCorridors(gameState.world);
  gameState.world.roads = normalizeRoads(loaded.world?.roads);
  gameState.world.objects = normalizeObjects([...(loaded.world?.facilities ?? []), ...(loaded.world?.decorations ?? []), ...(loaded.world?.objects ?? [])]);
  gameState.world.nextObjectId = Math.max(nextObjectNumber(gameState.world.objects), clampInteger(loaded.world?.nextObjectId, 1, Number.MAX_SAFE_INTEGER, 1));
  gameState.facilityProgress = normalizeFacilityProgress(loaded.facilityProgress);
  if (!loaded.facilityProgress || typeof loaded.facilityProgress !== 'object') migratePlacedFacilityProgress();
  for (const object of gameState.world.objects ?? []) normalizeFacilityFields(object);
  gameState.seals = normalizeSeals(loaded.seals);
  for (const seal of gameState.seals ?? []) clearLegacyReturnTarget(seal);
  enforceSingleResidentSeal();
  gameState.visitorProfiles = normalizeVisitorProfiles(loaded.visitorProfiles);
  sanitizeActiveVisitorSeals();
  const legacyInventory = Array.isArray(loaded.townInventory) ? loaded.townInventory : [];
  gameState.relicInventory = normalizeRelicInventory([...(loaded.relicInventory ?? []), ...legacyInventory]);
  gameState.shopCatalog = normalizeShopCatalog(loaded.shopCatalog, gameState.relicInventory);
  gameState.village.knownness = safeFiniteNumber(loaded.village?.knownness, CONFIG.knownness.initial, 0);
  unlockKnownVisitors();
  gameState.village.clearCount = clampInteger(loaded.village?.clearCount, 0, Number.MAX_SAFE_INTEGER, 0);
  gameState.time.timeScale = CONFIG.TIME.SPEED_OPTIONS.includes(Number(loaded.time?.timeScale)) ? Number(loaded.time.timeScale) : CONFIG.TIME.DEFAULT_SCALE;
  gameState.calendar.year = clampInteger(loaded.calendar?.year, 1, Number.MAX_SAFE_INTEGER, Math.max(1, Math.ceil(clampInteger(loaded.calendar?.month, 1, Number.MAX_SAFE_INTEGER, 1) / CONFIG.CALENDAR.MONTHS_PER_YEAR)));
  gameState.calendar.month = clampInteger(loaded.calendar?.year ? loaded.calendar?.month : (((clampInteger(loaded.calendar?.month, 1, Number.MAX_SAFE_INTEGER, 1) - 1) % CONFIG.CALENDAR.MONTHS_PER_YEAR) + 1), 1, CONFIG.CALENDAR.MONTHS_PER_YEAR, 1);
  gameState.calendar.week = clampInteger(loaded.calendar?.week ?? loaded.calendar?.day, 1, CONFIG.CALENDAR.WEEKS_PER_MONTH, 1);
  gameState.calendar.weekTimerMs = safeFiniteNumber(loaded.calendar?.weekTimerMs, 0, 0);
  gameState.stats.monthlyHunts = clampInteger(loaded.stats?.monthlyHunts, 0, Number.MAX_SAFE_INTEGER, 0);
  gameState.stats.monthlyKnownnessGained = safeFiniteNumber(loaded.stats?.monthlyKnownnessGained, 0, 0);
  gameState.stats.monthlyPlayerIncome = safeFiniteNumber(loaded.stats?.monthlyPlayerIncome, 0, 0);
  gameState.monsters = normalizeMonsters(loaded.monsters);
  gameState.dungeonProgress = normalizeDungeonProgress(loaded.dungeonProgress);
  updateDungeonUnlocks();
  gameState.dungeons = normalizeDungeons(loaded.dungeons);
  rebuildLoadedSealRoutes();
  if (!(gameState.seals ?? []).some(seal => seal?.id === gameState.ui.selectedSealId)) gameState.ui.selectedSealId = null;
  if (!getDungeonById(gameState.ui.selectedDungeonId)) gameState.ui.selectedDungeonId = null;
  gameState.logs = Array.isArray(loaded.logs) ? loaded.logs.map(text => String(text)).slice(0, CONFIG.MAX_LOGS) : [];
  gameState.timers.spawn = safeFiniteNumber(loaded.timers?.spawn, 0, 0);
  gameState.timers.monsterSpawn = safeFiniteNumber(loaded.timers?.monsterSpawn, loaded.timers?.spawn ?? 0, 0);
  gameState.timers.visitorSpawn = safeFiniteNumber(loaded.timers?.visitorSpawn, 0, 0);
  gameState.timers.dungeonSpawnMs = safeFiniteNumber(loaded.timers?.dungeonSpawnMs, 0, 0);
  initializeAssetRegistry();
  gameState.save.autoSaveTimerMs = safeFiniteNumber(loaded.save?.autoSaveTimerMs, 0, 0);
  gameState.save.lastSavedAt = safeFiniteNumber(data?.savedAt, null, 0) || null;
  gameState.save.statusText = `最終保存: ${formatSaveTime(gameState.save.lastSavedAt)}`;
}

function updateAutoSave(deltaMs) {
  if (gameState.phase !== CONFIG.phase.playing || safeFiniteNumber(deltaMs, 0, 0) <= 0) return;
  gameState.save.autoSaveTimerMs += safeFiniteNumber(deltaMs, 0, 0);
  if (gameState.save.autoSaveTimerMs < CONFIG.AUTO_SAVE_INTERVAL_MS) return;
  gameState.save.autoSaveTimerMs = 0;
  saveGame('auto');
}

function readSavePayload() {
  try {
    const raw = window.localStorage?.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function startNewGame() {
  if (hasSaveData() && !window.confirm('既存のセーブデータを削除して新しく始めますか？')) return;
  deleteSaveData();
  Object.assign(gameState, createNewGameState());
  initializeAssetRegistry();
  const residentName = String(window.prompt('住民あざらしの名前を入力してください', CONFIG.resident.defaultName) ?? '').trim() || CONFIG.resident.defaultName;
  initGame(residentName);
  gameState.save.statusText = '新しいゲームを開始しました';
  updateStartSaveInfo();
  updateHud();
}

function updateStartSaveInfo() {
  const payload = readSavePayload();
  const valid = validateLoadedGameState(payload);
  if (loadBtn) loadBtn.hidden = !valid;
  if (!startSaveInfoEl) return;
  if (valid) {
    startSaveInfoEl.textContent = `保存済みデータ: ${formatSaveTime(payload.savedAt)} / ${payload.reason === 'auto' ? '自動保存' : '手動保存'}`;
  } else if (payload) {
    startSaveInfoEl.textContent = 'セーブデータが壊れているか、バージョンが違うため読み込めません。';
  } else {
    startSaveInfoEl.textContent = '保存済みデータはありません。';
  }
}

function formatSaveTime(value) {
  if (!Number.isFinite(value)) return 'なし';
  return new Date(value).toLocaleString('ja-JP');
}


function rebuildLoadedSealRoutes() {
  for (const seal of gameState.seals ?? []) {
    if (!seal) continue;
    if (seal.expeditionId && ['movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon', 'questing'].includes(seal.state)) {
      const dungeon = getDungeonById(seal.expeditionId);
      if (!dungeon) { clearSealExpeditionState(seal); continue; }
      if (seal.state === 'movingToDungeon') setSealDestination(seal, getDungeonEntrancePoint(dungeon), 'dungeon-entrance');
      else if (seal.state === 'returningFromDungeon') setSealDestination(seal, getDungeonReturnPoint(seal), 'dungeon-return');
      else { seal.path = []; seal.target = null; }
      continue;
    }
    if (seal.state === 'arriving') { seal.path = []; seal.target = null; continue; }
    if (seal.state === 'movingToHuntExit') { if (!buildRouteToArea(seal, seal.selectedHuntAreaId ?? 'coast')) seal.state = 'idle'; continue; }
    if (seal.state === 'returningFromHunt') { clearLegacyReturnTarget(seal); choosePostHuntAction(seal); continue; }
    if (seal.state === 'leaving' || seal.state === 'leavingToSea') { if (!buildRouteToVillage(seal)) seal.state = seal.type === 'visitor' ? 'leavingToSea' : 'idle'; continue; }
    if (seal.state === 'movingToMonster') { const monster = (gameState.monsters ?? []).find(item => item?.id === seal.targetId); if (monster) setSealDestination(seal, { x: monster.x, y: monster.y }, 'monster'); else seal.state = 'hunting'; continue; }
    if (seal.state === 'movingToFacility') { const facility = (gameState.world.objects ?? []).find(item => item?.id === seal.targetId); if (facility && isFacilityUsable(facility)) setSealDestination(seal, facilityInteractionPoint(facility), 'facility'); else { seal.targetId = null; seal.state = 'choosingFacility'; } }
  }
}
