function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: gameState.camera.x + (clientX - rect.left - canvas.clientWidth / 2) / gameState.camera.zoom, y: gameState.camera.y + (clientY - rect.top - canvas.clientHeight / 2) / gameState.camera.zoom };
}
function updateMouse(clientX, clientY) { const p = screenToWorld(clientX, clientY); gameState.input.mouseWorld = p; gameState.input.mouseTile = worldToGrid(p.x, p.y); }
function setZoom(next, clientX, clientY) { const before = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.zoom = Math.max(CONFIG.camera.minZoom, Math.min(CONFIG.camera.maxZoom, next)); const after = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.x += before.x - after.x; gameState.camera.y += before.y - after.y; renderUI(); }

function resizeCanvas() { const dpr = devicePixelRatioClamped(); const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
function devicePixelRatioClamped() { return Math.max(CONFIG.canvas.minDevicePixelRatio, Math.min(CONFIG.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1)); }

const BOTTOM_TABS = Object.freeze([
  { id: 'build', label: '建設' },
  { id: 'seals', label: '人物' },
  { id: 'dungeons', label: 'ダンジョン' },
  { id: 'progress', label: '発展' }
]);
const BUILD_CATEGORIES = Object.freeze([
  { id: 'road', label: '道路', toolIds: ['road'] },
  { id: 'facility', label: '施設', toolIds: ['inn', 'restaurant', 'blacksmith'] },
  { id: 'decoration', label: '装飾', toolIds: ['flower', 'tree', 'rock'] },
  { id: 'utility', label: '管理', toolIds: ['clear', 'delete'] }
]);

function buildTools() {
  if (bottomTabBarEl) bottomTabBarEl.innerHTML = BOTTOM_TABS.map(tab => `<button data-bottom-tab="${tab.id}">${tab.label}</button>`).join('');
  if (speedHudEl) {
    const speedButtons = CONFIG.TIME.SPEED_OPTIONS.map(speed => `<button data-speed="${speed}">${speed === 0 ? '⏸' : `x${speed}`}</button>`).join('');
    speedHudEl.innerHTML = `<div class="speedTitle"><b>速度</b><span id="speedStatus"></span></div><div class="speedButtons">${speedButtons}</div>`;
  }
  updateToolButtons();
}

function setActiveBottomTab(tabId) {
  const next = BOTTOM_TABS.some(tab => tab.id === tabId) ? tabId : null;
  gameState.ui.activeBottomTab = next;
  gameState.ui.panelCollapsed = next === null;
  gameState.ui.needsHudUpdate = true;
  renderUI();
}
function toggleBottomTab(tabId) { setActiveBottomTab(gameState.ui?.activeBottomTab === tabId ? null : tabId); }
function closeBottomPanel() { setActiveBottomTab(null); }
function setSelectedTool(toolId) {
  const tool = CONFIG.tools.find(t => t?.id === toolId) ?? null;
  gameState.ui.selectedTool = tool?.id ?? null;
  gameState.ui.placementCategory = categoryForTool(tool) ?? gameState.ui.placementCategory ?? 'facility';
  if (tool?.id && gameState.ui.activeBottomTab !== 'build') setActiveBottomTab('build');
  gameState.ui.needsHudUpdate = true;
  renderUI();
}
function clearSelectedTool() {
  gameState.ui.selectedTool = null;
  gameState.ui.needsHudUpdate = true;
  renderUI();
}
function categoryForTool(tool) {
  if (!tool) return null;
  if (tool.kind === 'road') return 'road';
  if (tool.kind === 'facility') return 'facility';
  if (tool.kind === 'decoration') return 'decoration';
  if (['clear', 'delete'].includes(tool.kind)) return 'utility';
  return null;
}
function updateToolButtons() {
  for (const b of bottomTabBarEl?.querySelectorAll('button[data-bottom-tab]') ?? []) b.classList.toggle('active', b.dataset.bottomTab === gameState.ui?.activeBottomTab);
  for (const b of bottomPanelEl?.querySelectorAll('button[data-tool]') ?? []) b.classList.toggle('active', b.dataset.tool === gameState.ui?.selectedTool);
  for (const b of speedHudEl?.querySelectorAll('button[data-speed]') ?? []) b.classList.toggle('active', Number(b.dataset.speed) === clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE));
  const speedStatus = document.getElementById('speedStatus');
  if (speedStatus) speedStatus.textContent = formatSpeedLabel(gameState.time?.timeScale);
}
function rotateTool() { gameState.ui.directionIndex = (gameState.ui.directionIndex + 1) % CONFIG.directions.length; gameState.ui.needsHudUpdate = true; renderUI(); }
function formatSpeedLabel(speed) { return Number(speed) === 0 ? 'pause' : `x${speed}`; }
function setGameSpeed(speed) { if (!gameState.time) return; gameState.time.timeScale = CONFIG.TIME.SPEED_OPTIONS.includes(speed) ? speed : CONFIG.TIME.DEFAULT_SCALE; updateToolButtons(); renderUI(); }

function handleUiAction(event, options = {}) {
  const target = event?.target?.closest?.('button');
  if (!target || (event?.currentTarget && !event.currentTarget.contains(target))) return false;

  const tab = target.dataset?.bottomTab;
  const tool = target.dataset?.tool;
  const speed = target.dataset?.speed;
  const action = target.dataset?.action;
  const dungeonAction = target.dataset?.dungeonAction;
  const hasUiAction = Boolean(tab || tool || speed !== undefined || action || dungeonAction);
  if (!hasUiAction) return false;

  event.preventDefault();
  event.stopPropagation();

  if (!options.fromPointer && event.detail !== 0 && Date.now() < safeFiniteNumber(gameState.ui?.suppressUiClickUntil, 0, 0)) return true;

  if (tab) toggleBottomTab(tab);
  else if (tool) setSelectedTool(tool);
  else if (speed !== undefined) setGameSpeed(Number(speed));
  else if (action === 'rotate') rotateTool();
  else if (action === 'manualSave') saveGame('manual');
  else if (action === 'clearTool') clearSelectedTool();
  else if (action === 'zoomIn') setZoom(gameState.camera.zoom + CONFIG.camera.buttonStep);
  else if (action === 'zoomOut') setZoom(gameState.camera.zoom - CONFIG.camera.buttonStep);
  else if (action === 'closeBottom') closeBottomPanel();
  else if (action === 'closeSeal') { gameState.ui.selectedSealId = null; renderUI(); }
  else if (dungeonAction === 'start') startDungeon(target.dataset?.dungeonId);
  else if (dungeonAction === 'close') { gameState.ui.selectedDungeonId = null; renderUI(); }
  else return false;

  if (options.fromPointer && gameState.ui) gameState.ui.suppressUiClickUntil = Date.now() + 350;
  return true;
}

function handleUiPointerUp(event) {
  if (event?.button !== undefined && event.button !== 0) return;
  handleUiAction(event, { fromPointer: true });
}


function isPointerOverUI(event) {
  const target = event?.target;
  if (!target?.closest) return false;
  return Boolean(target.closest('.hud, .topHud, .speed-panel, .speedHud, .bottom-tabs, .bottomTabBar, .bottom-panel, .bottomPanel, .start'));
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

  const uiContainers = [statsEl, speedHudEl, bottomTabBarEl, bottomPanelEl, startScreen].filter(Boolean);
  for (const element of uiContainers) {
    element.addEventListener('pointerup', handleUiPointerUp);
    element.addEventListener('click', handleUiAction);
    element.addEventListener('pointerdown', consumeUiPointerEvent);
    element.addEventListener('mousedown', consumeUiPointerEvent);
    element.addEventListener('mouseup', consumeUiPointerEvent);
    element.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  }
}

function sealAtWorldPoint(point) {
  if (!point) return null;
  return [...(gameState.seals ?? [])].reverse().find(seal => seal && distance(point.x, point.y, seal.x, seal.y) <= CONFIG.seal.contactDistance * 1.4) ?? null;
}

function placementClickHasPriority(tool, tile) {
  if (!tool || !tile) return false;
  const terrain = getTile(tile.x, tile.y)?.terrain;
  if (terrain === CONFIG.tileState.terrainOutside) return false;
  return isPlacementModeActive();
}

function isPlacementModeActive() {
  const kind = CONFIG.tools.find(t => t?.id === gameState.ui?.selectedTool)?.kind;
  return ['road', 'facility', 'decoration', 'clear', 'delete'].includes(kind);
}

function bindInputEvents() {
  if (gameState.ui?.inputEventsBound) return;
  if (gameState.ui) gameState.ui.inputEventsBound = true;
  bindUIEvents();

  canvas.addEventListener('mousemove', e => {
    if (isPointerOverUI(e)) return;
    updateMouse(e.clientX, e.clientY);
    if (gameState.camera.dragging) {
      gameState.camera.x -= e.movementX / gameState.camera.zoom;
      gameState.camera.y -= e.movementY / gameState.camera.zoom;
      if (distance(e.clientX, e.clientY, gameState.camera.dragStartX, gameState.camera.dragStartY) > CONFIG.seal.contactDistance) gameState.camera.dragMoved = true;
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (isPointerOverUI(e)) return;
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
      gameState.ui.selectedDungeonId = null;
      if (t?.kind === 'delete') deleteAt(gameState.input.mouseTile.x, gameState.input.mouseTile.y);
      else if (t?.kind === 'clear') clearLandAt(gameState.input.mouseTile.x, gameState.input.mouseTile.y);
      else placeObject(t.id, gameState.input.mouseTile.x, gameState.input.mouseTile.y, gameState.ui.directionIndex, false);
      renderUI();
      return;
    }
    const clickedDungeon = selectDungeonAtWorldPosition(gameState.input.mouseWorld?.x, gameState.input.mouseWorld?.y);
    const clickedSeal = sealAtWorldPoint(gameState.input.mouseWorld);
    if (clickedDungeon?.id && (!clickedSeal || distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, clickedDungeon.x, clickedDungeon.y) <= distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, clickedSeal.x, clickedSeal.y))) {
      setActiveBottomTab('dungeons');
      return;
    }
    if (clickedSeal?.id) {
      gameState.ui.selectedSealId = clickedSeal.id;
      gameState.ui.selectedDungeonId = null;
      setActiveBottomTab('seals');
      return;
    }
    if (!isPlacementModeActive()) {
      gameState.ui.selectedSealId = null;
      gameState.ui.selectedDungeonId = null;
    }
    renderUI();
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if (isPointerOverUI(e)) return;
    e.preventDefault();
    setZoom(gameState.camera.zoom + (e.deltaY < 0 ? CONFIG.camera.wheelStep : -CONFIG.camera.wheelStep), e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    gameState.input.keys[e.code] = true;
    if (e.code === 'KeyR') rotateTool();
    if (e.code === 'Escape') {
      clearSelectedTool();
      if (gameState.ui?.activeBottomTab) closeBottomPanel();
    }
  });
  window.addEventListener('keyup', e => { gameState.input.keys[e.code] = false; });
}
