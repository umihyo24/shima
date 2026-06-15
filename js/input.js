function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: gameState.camera.x + (clientX - rect.left - canvas.clientWidth / 2) / gameState.camera.zoom, y: gameState.camera.y + (clientY - rect.top - canvas.clientHeight / 2) / gameState.camera.zoom };
}
function updateMouse(clientX, clientY) { const p = screenToWorld(clientX, clientY); gameState.input.mouseWorld = p; gameState.input.mouseTile = worldToGrid(p.x, p.y); }
function setZoom(next, clientX, clientY) { const before = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.zoom = Math.max(CONFIG.camera.minZoom, Math.min(CONFIG.camera.maxZoom, next)); const after = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.x += before.x - after.x; gameState.camera.y += before.y - after.y; renderUI(); }

function resizeCanvas() { const dpr = devicePixelRatioClamped(); const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
function devicePixelRatioClamped() { return Math.max(CONFIG.canvas.minDevicePixelRatio, Math.min(CONFIG.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1)); }

function markUIDirty(reason = 'all') {
  if (!gameState.ui) return;
  const panelReasons = new Set(['all', 'panel', 'tab', 'tool', 'selection', 'dungeon']);
  const hudReasons = new Set(['all', 'hud', 'tab', 'tool', 'selection', 'speed', 'save', 'message', 'tick']);
  if (hudReasons.has(reason)) gameState.ui.needsHudUpdate = true;
  if (panelReasons.has(reason)) markPanelDirty(reason);
}

function markPanelDirty(reason = 'panel') {
  if (!gameState.ui) return;
  gameState.ui.needsPanelUpdate = true;
  gameState.ui.lastPanelDirtyReason = reason;
}

const MANAGEMENT_PANELS = Object.freeze([
  { id: 'people', label: '人物' },
  { id: 'dungeons', label: 'ダンジョン' },
  { id: 'progress', label: '発展' }
]);
const BOTTOM_TABS = MANAGEMENT_PANELS;
const BUILD_CATEGORIES = Object.freeze((CONFIG.BUILD_CATEGORIES ?? []).map(category => Object.freeze({ ...category, toolIds: [...(category?.toolIds ?? [])] })));
const BUILD_CATEGORY_IDS = Object.freeze(BUILD_CATEGORIES.map(category => category.id));
const DEFAULT_BUILD_CATEGORY = BUILD_CATEGORIES[0]?.id ?? 'roads';
const LEGACY_BUILD_CATEGORY_MAP = Object.freeze({ road: 'roads', facility: 'relax', decoration: 'decor', management: 'manage' });

function normalizeBuildCategory(category, fallback = DEFAULT_BUILD_CATEGORY) {
  const id = String(category ?? '');
  const migrated = LEGACY_BUILD_CATEGORY_MAP[id] ?? id;
  return BUILD_CATEGORY_IDS.includes(migrated) ? migrated : fallback;
}

const SEAL_LIST_FILTERS = Object.freeze(['all', 'resident', 'activeVisitors', 'unlockedVisitors', 'lockedVisitors', 'hunting', 'questing', 'resting']);
const INSPECTOR_TYPES = Object.freeze(['seal', 'facility', 'dungeon']);

const SEAL_LIST_SORT_KEYS = Object.freeze(['name', 'type', 'hpRate', 'level', 'favor', 'state', 'stayTime', 'hunts', 'weapon', 'armor', 'accessory']);

function getSealListState() {
  if (!gameState.ui) return { filter: 'all', sortKey: 'name', sortDir: 'asc' };
  gameState.ui.sealList = gameState.ui.sealList ?? { filter: 'all', sortKey: 'name', sortDir: 'asc' };
  if (!SEAL_LIST_FILTERS.includes(gameState.ui.sealList.filter)) gameState.ui.sealList.filter = 'all';
  if (!SEAL_LIST_SORT_KEYS.includes(gameState.ui.sealList.sortKey)) gameState.ui.sealList.sortKey = 'name';
  if (!['asc', 'desc'].includes(gameState.ui.sealList.sortDir)) gameState.ui.sealList.sortDir = 'asc';
  return gameState.ui.sealList;
}

function getSelectedSeal() { return getSealById(gameState.ui?.selectedSealId) ?? null; }

function openInspector(type, id) {
  if (!gameState.ui) return false;
  const normalizedType = INSPECTOR_TYPES.includes(type) ? type : null;
  const normalizedId = id == null ? null : String(id);
  if (!normalizedType || !normalizedId) return closeInspector();
  gameState.ui.inspector = { type: normalizedType, id: normalizedId, open: true };
  markUIDirty('selection');
  return true;
}

function closeInspector() {
  if (!gameState.ui) return false;
  const wasOpen = gameState.ui.inspector?.open === true || gameState.ui.inspector?.type || gameState.ui.inspector?.id;
  gameState.ui.inspector = { type: null, id: null, open: false };
  if (wasOpen) markUIDirty('selection');
  return wasOpen;
}

function selectSeal(sealId, source = 'unknown') {
  const seal = getSealById(sealId);
  if (!gameState.ui || !seal?.id) return false;
  gameState.ui.selectedSealId = seal.id;
  gameState.ui.selectedPersonRosterId = `seal:${seal.id}`;
  gameState.ui.selectedDungeonId = null;
  gameState.ui.selectedFacilityId = null;
  gameState.ui.facilityInspectorOpen = false;
  if (gameState.ui.selectedTool) gameState.ui.selectedTool = null;
  openInspector('seal', seal.id);
  markUIDirty('selection');
  renderUI();
  return true;
}

function selectPersonByRosterId(rosterId) {
  const id = String(rosterId ?? '');
  if (!gameState.ui || !id) return;
  const sealId = id.startsWith('seal:') ? id.slice('seal:'.length) : null;
  gameState.ui.selectedPersonRosterId = id;
  if (sealId && selectSeal(sealId, 'people')) return;
  gameState.ui.selectedSealId = null;
  gameState.ui.selectedDungeonId = null;
  gameState.ui.selectedFacilityId = null;
  gameState.ui.facilityInspectorOpen = false;
  closeInspector();
  markUIDirty('selection');
  renderUI();
}

function setSealListFilter(filter) {
  const next = SEAL_LIST_FILTERS.includes(filter) ? filter : 'all';
  getSealListState().filter = next;
  markPanelDirty('people-filter');
  renderUI();
}

function setSealListSort(sortKey) {
  if (!SEAL_LIST_SORT_KEYS.includes(sortKey)) return;
  const state = getSealListState();
  if (state.sortKey === sortKey) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else {
    state.sortKey = sortKey;
    state.sortDir = ['hpRate', 'level', 'favor', 'stayTime', 'hunts'].includes(sortKey) ? 'desc' : 'asc';
  }
  markPanelDirty('people-sort');
  renderUI();
}

function buildTools() {
  if (bottomTabBarEl) bottomTabBarEl.innerHTML = BUILD_CATEGORIES.map(category => `<button data-build-toggle="${escapeHtml(category.id)}">${escapeHtml(`${category.icon ? `${category.icon} ` : ''}${category.label}`)}</button>`).join('');
  if (managementButtonsEl) managementButtonsEl.innerHTML = MANAGEMENT_PANELS.map(panel => `<button data-management-panel="${panel.id}">${panel.label}</button>`).join('');
  if (speedHudEl) {
    const speedButtons = CONFIG.TIME.SPEED_OPTIONS.map(speed => `<button data-speed="${speed}">${speed === 0 ? '⏸' : `x${speed}`}</button>`).join('');
    speedHudEl.innerHTML = `<div class="speedTitle"><b>速度</b><span id="speedStatus"></span></div><div class="speedButtons">${speedButtons}</div>`;
  }
  updateToolButtons();
}

function getBuildToolDef(toolId) { return CONFIG.tools.find(tool => tool?.id === toolId) ?? null; }

function getBuildToolEffectText(toolId) { return getBuildToolDef(toolId)?.effectText ?? ''; }

function setBuildCategory(category) {
  if (!gameState.ui) return;
  gameState.ui.buildCategory = normalizeBuildCategory(category);
  markPanelDirty('build-category');
  renderUI();
}

function toggleBuildCategory(categoryId) {
  if (!gameState.ui) return;
  const next = normalizeBuildCategory(categoryId, null);
  if (gameState.ui?.roadEdit?.active && next !== gameState.ui.activeBuildCategory) clearRoadEdit();
  if (gameState.ui?.moveEdit?.active && next !== gameState.ui.activeBuildCategory) cancelMoveFacility();
  gameState.ui.activeBuildCategory = gameState.ui.activeBuildCategory === next ? null : next;
  if (gameState.ui.activeBuildCategory) gameState.ui.buildCategory = gameState.ui.activeBuildCategory;
  markUIDirty('tab');
  renderUI();
}

function closeBuildDrawer() {
  if (!gameState.ui) return;
  if (gameState.ui?.roadEdit?.active) clearRoadEdit();
  if (gameState.ui?.moveEdit?.active) cancelMoveFacility();
  gameState.ui.activeBuildCategory = null;
  markUIDirty('tab');
  renderUI();
}

function openManagementPanel(panelId) {
  if (!gameState.ui) return;
  const normalized = panelId === 'seals' ? 'people' : panelId;
  gameState.ui.activeManagementPanel = MANAGEMENT_PANELS.some(panel => panel.id === normalized) ? normalized : null;
  markUIDirty('tab');
  renderUI();
}

function closeManagementPanel() {
  if (!gameState.ui) return;
  gameState.ui.activeManagementPanel = null;
  markUIDirty('tab');
  renderUI();
}

function toggleManagementPanel(panelId) {
  const normalized = panelId === 'seals' ? 'people' : panelId;
  if (gameState.ui?.activeManagementPanel === normalized) closeManagementPanel();
  else openManagementPanel(normalized);
}

function getBuildCategoryForTool(tool) {
  const category = tool?.category ?? categoryForTool(tool);
  return normalizeBuildCategory(category);
}

function setActiveBottomTab(tabId) {
  if (tabId === 'build') {
    toggleBuildCategory(gameState.ui?.activeBuildCategory ?? gameState.ui?.buildCategory ?? DEFAULT_BUILD_CATEGORY);
    return;
  }
  openManagementPanel(tabId);
}
function toggleBottomTab(tabId) { toggleManagementPanel(tabId); }
function closeBottomPanel() { closeManagementPanel(); closeBuildDrawer(); }
function setSelectedTool(toolId) {
  const tool = getBuildToolDef(toolId);
  if (!gameState.ui) return;
  if (gameState.ui?.roadEdit?.active && gameState.ui.selectedTool !== (tool?.id ?? null)) clearRoadEdit();
  if (gameState.ui?.moveEdit?.active && tool?.id !== 'move') cancelMoveFacility();
  gameState.ui.selectedTool = tool?.id ?? null;
  gameState.ui.selectedFacilityId = null;
  gameState.ui.placementCategory = placementCategoryForTool(tool) ?? gameState.ui.placementCategory ?? 'facility';
  if (tool) {
    gameState.ui.buildCategory = getBuildCategoryForTool(tool);
    gameState.ui.activeBuildCategory = gameState.ui.buildCategory;
  }
  markUIDirty('tool');
  renderUI();
}
function clearSelectedTool() {
  if (!gameState.ui) return;
  if (gameState.ui?.roadEdit?.active) clearRoadEdit();
  if (gameState.ui?.moveEdit?.active) cancelMoveFacility();
  gameState.ui.selectedTool = null;
  markUIDirty('tool');
  renderUI();
}
function categoryForTool(tool) {
  if (!tool) return null;
  if (tool.category) return normalizeBuildCategory(tool.category);
  if (tool.kind === 'road') return 'roads';
  if (tool.kind === 'facility') return 'relax';
  if (tool.kind === 'decoration') return 'decor';
  if (['clear', 'delete', 'move'].includes(tool.kind)) return 'manage';
  return null;
}
function placementCategoryForTool(tool) {
  if (!tool) return null;
  if (tool.kind === 'facility') return 'facility';
  if (tool.kind === 'decoration') return 'decoration';
  if (tool.kind === 'road') return 'road';
  if (['clear', 'delete', 'move'].includes(tool.kind)) return 'management';
  return null;
}
function updateToolButtons() {
  for (const b of bottomTabBarEl?.querySelectorAll('button[data-build-toggle]') ?? []) b.classList.toggle('active', b.dataset.buildToggle === gameState.ui?.activeBuildCategory);
  for (const b of bottomPanelEl?.querySelectorAll('button[data-tool]') ?? []) b.classList.toggle('active', b.dataset.tool === gameState.ui?.selectedTool);
  for (const b of bottomPanelEl?.querySelectorAll('button[data-build-category]') ?? []) b.classList.toggle('active', b.dataset.buildCategory === (normalizeBuildCategory(gameState.ui?.buildCategory)));
  for (const b of managementButtonsEl?.querySelectorAll('button[data-management-panel]') ?? []) b.classList.toggle('active', b.dataset.managementPanel === gameState.ui?.activeManagementPanel);
  for (const b of speedHudEl?.querySelectorAll('button[data-speed]') ?? []) b.classList.toggle('active', Number(b.dataset.speed) === clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE));
  const speedStatus = document.getElementById('speedStatus');
  if (speedStatus) speedStatus.textContent = formatSpeedLabel(gameState.time?.timeScale);
}
function rotateTool() {
  if (!gameState.ui) return false;
  const rotated = rotateSelectedPlacement() || rotateSelectedFacilityIfAny();
  if (!rotated) {
    gameState.ui.placementFeedback = { x: gameState.input?.mouseTile?.x ?? 0, y: gameState.input?.mouseTile?.y ?? 0, ok: false, text: '回転できる対象がありません。', timer: CONFIG.placement.feedbackSeconds };
    logMessage('回転できる対象がありません。');
  }
  markUIDirty('tool');
  renderUI();
  return rotated;
}
function formatSpeedLabel(speed) { return Number(speed) === 0 ? 'pause' : `x${speed}`; }
function setGameSpeed(speed) { if (!gameState.time) return; gameState.time.timeScale = CONFIG.TIME.SPEED_OPTIONS.includes(speed) ? speed : CONFIG.TIME.DEFAULT_SCALE; markUIDirty('speed'); renderUI(); }

function handleUiAction(event, options = {}) {
  const actionTarget = event?.target?.closest?.('button, [data-roster-id]');
  if (!actionTarget || (event?.currentTarget && !event.currentTarget.contains(actionTarget))) return false;

  const tab = actionTarget.dataset?.tab ?? actionTarget.dataset?.bottomTab;
  const tool = actionTarget.dataset?.tool;
  const speed = actionTarget.dataset?.speed;
  const buildCategory = actionTarget.dataset?.buildCategory;
  const buildToggle = actionTarget.dataset?.buildToggle;
  const managementPanel = actionTarget.dataset?.managementPanel;
  const action = actionTarget.dataset?.action;
  const dungeonAction = actionTarget.dataset?.dungeonAction;
  const sealFilter = actionTarget.dataset?.sealFilter;
  const sealSort = actionTarget.dataset?.sealSort;
  const rosterId = actionTarget.dataset?.rosterId;
  const hasUiAction = Boolean(tab || tool || buildCategory || buildToggle || managementPanel || speed !== undefined || action || dungeonAction || sealFilter || sealSort || rosterId);
  if (!hasUiAction) return false;

  event.preventDefault();
  event.stopPropagation();

  if (!options.fromPointer && event.detail !== 0 && Date.now() < safeFiniteNumber(gameState.ui?.suppressUiClickUntil, 0, 0)) return true;

  if (tab) toggleBottomTab(tab);
  else if (buildToggle) toggleBuildCategory(buildToggle);
  else if (managementPanel) toggleManagementPanel(managementPanel);
  else if (buildCategory) setBuildCategory(buildCategory);
  else if (tool) setSelectedTool(tool);
  else if (speed !== undefined) setGameSpeed(Number(speed));
  else if (action === 'rotate') rotateTool();
  else if (action === 'manualSave') saveGame('manual');
  else if (action === 'clearTool') clearSelectedTool();
  else if (action === 'moveFacility') startMoveSelectedFacility();
  else if (action === 'rotateFacility') rotateSelectedFacility();
  else if (action === 'deleteFacility') deleteSelectedFacility();
  else if (action === 'zoomIn') setZoom(gameState.camera.zoom + CONFIG.camera.buttonStep);
  else if (action === 'zoomOut') setZoom(gameState.camera.zoom - CONFIG.camera.buttonStep);
  else if (action === 'close-panel' || action === 'closeManagement') closeManagementPanel();
  else if (action === 'closeBuild' || action === 'closeBottom') closeBuildDrawer();
  else if (action === 'closeInspector' || action === 'closeSeal') { closeInspector(); clearContextSelection(); renderUI(); }
  else if (dungeonAction === 'start') startDungeon(actionTarget.dataset?.dungeonId);
  else if (dungeonAction === 'select') { gameState.ui.selectedDungeonId = actionTarget.dataset?.dungeonId ?? null; markUIDirty('dungeon'); renderUI(); }
  else if (dungeonAction === 'close') { gameState.ui.selectedDungeonId = null; markUIDirty('selection'); renderUI(); }
  else if (sealFilter) setSealListFilter(sealFilter);
  else if (sealSort) setSealListSort(sealSort);
  else if (rosterId) selectPersonByRosterId(rosterId);
  else return false;

  if (options.fromPointer && gameState.ui) gameState.ui.suppressUiClickUntil = Date.now() + 350;
  return true;
}

function handleUiPointerUp(event) {
  if (event?.button !== undefined && event.button !== 0) return;
  handleUiAction(event, { fromPointer: true });
}

function handleUIRootClick(event) { return handleUiAction(event); }
function setupBottomPanelDelegation() { return bottomPanelEl ?? null; }


function isPointerOverUI(event) {
  const target = event?.target;
  if (!target?.closest) return false;
  return Boolean(target.closest('.hud, .topHud, .speed-panel, .speedHud, .managementButtons, .managementPanel, .bottom-tabs, .bottomTabBar, .bottom-panel, .bottomPanel, .inspectorPanel, .start'));
}

function clearContextSelection() {
  if (!gameState.ui) return false;
  const hadSelection = Boolean(gameState.ui.selectedSealId || gameState.ui.selectedPersonRosterId || gameState.ui.selectedDungeonId || gameState.ui.selectedFacilityId || gameState.ui.inspector?.open);
  gameState.ui.selectedSealId = null;
  gameState.ui.selectedPersonRosterId = null;
  gameState.ui.selectedDungeonId = null;
  gameState.ui.selectedFacilityId = null;
  gameState.ui.facilityInspectorOpen = false;
  closeInspector();
  if (hadSelection) markUIDirty('selection');
  return hadSelection;
}

function cancelCurrentAction(reason = 'cancel') {
  if (!gameState.ui) return false;
  if (gameState.ui.roadEdit?.active) { clearRoadEdit(); markUIDirty('tool'); renderUI(); return true; }
  if (gameState.ui.moveEdit?.active) { cancelMoveFacility(); markUIDirty('tool'); renderUI(); return true; }
  if (gameState.ui.selectedTool) { clearSelectedTool(); return true; }
  if (gameState.ui.inspector?.open && gameState.ui.inspector?.type === 'facility') { clearFacilitySelection(); renderUI(); return true; }
  if (gameState.ui.inspector?.open) { closeInspector(); clearContextSelection(); renderUI(); return true; }
  if (gameState.ui.activeManagementPanel) { closeManagementPanel(); return true; }
  if (gameState.ui.activeBuildCategory) { closeBuildDrawer(); return true; }
  if (clearContextSelection()) { renderUI(); return true; }
  return false;
}

function consumeUiPointerEvent(event) {
  if (!isPointerOverUI(event)) return;
  event.stopPropagation();
}

function bindUIEvents() {
  if (gameState.ui?.eventsBound) return;
  if (gameState.ui) gameState.ui.eventsBound = true;
  startBtn?.addEventListener('click', event => { event.stopPropagation(); startNewGame(); });
  loadBtn?.addEventListener('click', event => { event.stopPropagation(); loadGame(); });

  const uiContainers = [statsEl, speedHudEl, managementButtonsEl, managementPanelEl, document.getElementById('inspectorPanel'), bottomTabBarEl, bottomPanelEl, startScreen].filter(Boolean);
  for (const element of uiContainers) {
    element.addEventListener('pointerup', handleUiPointerUp);
    element.addEventListener('click', handleUIRootClick);
    element.addEventListener('pointerdown', consumeUiPointerEvent);
    element.addEventListener('mousedown', consumeUiPointerEvent);
    element.addEventListener('mouseup', consumeUiPointerEvent);
    element.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  }
  bottomPanelEl?.addEventListener('scroll', () => saveBottomPanelScrollPosition(), true);
}

function getSealSelectionRadius() {
  const settings = CONFIG.RENDER?.ENTITIES ?? {};
  const visualRadius = CONFIG.world.tile * safeFiniteNumber(settings.sealSpriteScale, 1.5, 0.1) / 2;
  return Math.max(CONFIG.seal.contactDistance, visualRadius);
}

function sealAtWorldPoint(point) {
  if (!point) return null;
  return [...(gameState.seals ?? [])].reverse().find(seal => seal && distance(point.x, point.y, seal.x, seal.y) <= getSealSelectionRadius()) ?? null;
}

function placementClickHasPriority(tool, tile) {
  if (!tile) return false;
  const terrain = getTile(tile.x, tile.y)?.terrain;
  if (terrain === CONFIG.tileState.terrainOutside) return false;
  return isFacilityMoveActive() || Boolean(tool && isPlacementModeActive());
}

function isPlacementModeActive() {
  const kind = CONFIG.tools.find(t => t?.id === gameState.ui?.selectedTool)?.kind;
  return ['road', 'facility', 'decoration', 'clear', 'delete', 'move'].includes(kind) || isFacilityMoveActive();
}


function handlePlacementClick(tool, tile) {
  const normalized = normalizeRoadTile(tile);
  if (!normalized || !getTile(normalized.x, normalized.y)) return false;
  if (isFacilityMoveActive()) {
    updateMovePreview(normalized.x, normalized.y);
    confirmMoveFacility();
    markUIDirty('all');
    renderUI();
    return true;
  }
  if (!tool) return false;
  if (gameState.ui?.roadEdit?.active) {
    confirmRoadEdit();
    markUIDirty('all');
    renderUI();
    return true;
  }
  gameState.ui.selectedDungeonId = null;
  if (tool?.kind === 'road') {
    if (!startRoadEdit('place', normalized)) {
      const result = canPlaceAt(normalized.x, normalized.y, tool);
      logMessage(`道路の始点にできません：${result.reason || '配置できないマスです。'}`);
      gameState.ui.placementFeedback = { x: normalized.x, y: normalized.y, ok: false, text: result.reason || '始点にできません。', timer: CONFIG.placement.feedbackSeconds };
    }
  } else if (tool?.kind === 'move') {
    const facility = getMovableFacilityAt(normalized.x, normalized.y);
    if (facility?.id) startMoveFacility(facility.id);
    else gameState.ui.placementFeedback = { x: normalized.x, y: normalized.y, ok: false, text: '移動できる施設がありません。', timer: CONFIG.placement.feedbackSeconds };
  } else if (tool?.kind === 'delete') {
    if (hasRoadAt(normalized.x, normalized.y)) startRoadEdit('delete', normalized);
    else deleteAt(normalized.x, normalized.y);
  } else if (tool?.kind === 'clear') clearLandAt(normalized.x, normalized.y);
  else placeObject(tool.id, normalized.x, normalized.y, gameState.ui?.directionIndex ?? 0, false);
  markUIDirty('all');
  renderUI();
  return true;
}

function bindInputEvents() {
  if (gameState.ui?.inputEventsBound) return;
  if (gameState.ui) gameState.ui.inputEventsBound = true;
  bindUIEvents();

  canvas.addEventListener('mousemove', e => {
    if (isPointerOverUI(e)) return;
    updateMouse(e.clientX, e.clientY);
    if (gameState.ui?.roadEdit?.active && !gameState.camera.dragging) updateRoadEditPreview(gameState.input?.mouseTile);
    if (gameState.ui?.moveEdit?.active && !gameState.camera.dragging) updateMovePreview(gameState.input?.mouseTile?.x, gameState.input?.mouseTile?.y);
    if (gameState.camera.dragging) {
      gameState.camera.x -= e.movementX / gameState.camera.zoom;
      gameState.camera.y -= e.movementY / gameState.camera.zoom;
      if (distance(e.clientX, e.clientY, gameState.camera.dragStartX, gameState.camera.dragStartY) > CONFIG.seal.contactDistance) gameState.camera.dragMoved = true;
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (isPointerOverUI(e)) return;
    if (e.button === 2) { cancelCurrentAction('right-click'); e.preventDefault(); return; }
    if (e.button !== CONFIG.camera.dragButton) return;
    updateMouse(e.clientX, e.clientY);
    gameState.camera.dragging = true;
    gameState.camera.dragMoved = false;
    gameState.camera.dragStartX = e.clientX;
    gameState.camera.dragStartY = e.clientY;
  });

  window.addEventListener('mouseup', e => {
    if (isPointerOverUI(e)) {
      gameState.camera.dragging = false;
      gameState.camera.dragMoved = false;
      return;
    }
    if (!gameState.camera.dragging) return;
    gameState.camera.dragging = false;
    if (gameState.camera.dragMoved || gameState.phase !== CONFIG.phase.playing) return;
    updateMouse(e.clientX, e.clientY);
    const t = CONFIG.tools.find(tool => tool?.id === gameState.ui?.selectedTool) ?? null;
    if (placementClickHasPriority(t, gameState.input.mouseTile)) {
      handlePlacementClick(t, gameState.input.mouseTile);
      return;
    }
    const clickedDungeon = selectDungeonAtWorldPosition(gameState.input.mouseWorld?.x, gameState.input.mouseWorld?.y);
    const clickedSeal = sealAtWorldPoint(gameState.input.mouseWorld);
    if (clickedDungeon?.id && (!clickedSeal || distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, clickedDungeon.x, clickedDungeon.y) <= distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, clickedSeal.x, clickedSeal.y))) {
      openManagementPanel('dungeons');
      return;
    }
    if (clickedSeal?.id) {
      selectSeal(clickedSeal.id, 'canvas');
      return;
    }
    if (!isPlacementModeActive()) {
      const clickedObject = objectAt(gameState.input.mouseTile?.x, gameState.input.mouseTile?.y);
      if (clickedObject?.kind === 'facility' && clickedObject?.id) {
        selectFacilityById(clickedObject.id);
        return;
      }
      const hadSelection = Boolean(gameState.ui.selectedSealId || gameState.ui.selectedPersonRosterId || gameState.ui.selectedDungeonId || gameState.ui.selectedFacilityId || gameState.ui.inspector?.open);
      gameState.ui.selectedSealId = null;
      gameState.ui.selectedPersonRosterId = null;
      gameState.ui.selectedDungeonId = null;
      gameState.ui.selectedFacilityId = null;
      gameState.ui.facilityInspectorOpen = false;
      closeInspector();
      if (hadSelection) markUIDirty('selection');
    }
    renderUI();
  });

  window.addEventListener('contextmenu', e => { if (e.target === canvas || isPointerOverUI(e)) { e.preventDefault(); e.stopPropagation(); cancelCurrentAction('rightClick'); } });
  canvas.addEventListener('wheel', e => {
    if (isPointerOverUI(e)) return;
    e.preventDefault();
    setZoom(gameState.camera.zoom + (e.deltaY < 0 ? CONFIG.camera.wheelStep : -CONFIG.camera.wheelStep), e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    gameState.input.keys[e.code] = true;
    if (e.code === 'KeyR') rotateTool();
    if (e.code === 'Escape') {
      cancelCurrentAction('escape');
    }
  });
  window.addEventListener('keyup', e => { gameState.input.keys[e.code] = false; });
}
