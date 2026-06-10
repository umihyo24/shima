function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: gameState.camera.x + (clientX - rect.left - canvas.clientWidth / 2) / gameState.camera.zoom, y: gameState.camera.y + (clientY - rect.top - canvas.clientHeight / 2) / gameState.camera.zoom };
}
function updateMouse(clientX, clientY) { const p = screenToWorld(clientX, clientY); gameState.input.mouseWorld = p; gameState.input.mouseTile = worldToGrid(p.x, p.y); }
function setZoom(next, clientX, clientY) { const before = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.zoom = Math.max(CONFIG.camera.minZoom, Math.min(CONFIG.camera.maxZoom, next)); const after = screenToWorld(clientX ?? canvas.clientWidth / 2, clientY ?? canvas.clientHeight / 2); gameState.camera.x += before.x - after.x; gameState.camera.y += before.y - after.y; updateHud(); }

function resizeCanvas() { const dpr = devicePixelRatioClamped(); const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
function devicePixelRatioClamped() { return Math.max(CONFIG.canvas.minDevicePixelRatio, Math.min(CONFIG.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1)); }

function buildTools() {
  const speedButtons = CONFIG.TIME.SPEED_OPTIONS.map(speed => `<button data-speed="${speed}">${speed === 0 ? '⏸ pause' : `x${speed}`}</button>`).join('');
  toolsEl.innerHTML = `<div class="speedControls"><b>速度</b><div class="speedButtons">${speedButtons}</div><div id="speedStatus" class="speedStatus"></div></div><b>ツール</b>` + CONFIG.tools.map(t => `<button data-tool="${t.id}">${t.label}</button>`).join('') + '<button data-action="rotate">R 回転</button><div class="savePanel"><b>セーブ</b><br><span id="toolSaveStatus">未保存</span><br><span id="toolSaveTime">最終保存: なし</span><button data-action="manualSave">手動保存</button></div>';
  toolsEl.addEventListener('click', e => { const tool = e.target?.dataset?.tool; const speed = e.target?.dataset?.speed; if (tool) { gameState.ui.selectedTool = tool; updateToolButtons(); updateHud(); } if (speed !== undefined) setGameSpeed(Number(speed)); if (e.target?.dataset?.action === 'rotate') rotateTool(); if (e.target?.dataset?.action === 'manualSave') saveGame('manual'); });
  updateToolButtons();
}
function updateToolButtons() {
  for (const b of toolsEl.querySelectorAll('button[data-tool]')) b.classList.toggle('active', b.dataset.tool === gameState.ui.selectedTool);
  for (const b of toolsEl.querySelectorAll('button[data-speed]')) b.classList.toggle('active', Number(b.dataset.speed) === clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE));
  const speedStatus = document.getElementById('speedStatus');
  if (speedStatus) speedStatus.textContent = `現在: ${formatSpeedLabel(gameState.time?.timeScale)}`;
  const status = document.getElementById('toolSaveStatus');
  const time = document.getElementById('toolSaveTime');
  if (status) status.textContent = gameState.save?.statusText || '未保存';
  if (time) time.textContent = `最終保存: ${formatSaveTime(gameState.save?.lastSavedAt)}`;
}
function rotateTool() { gameState.ui.directionIndex = (gameState.ui.directionIndex + 1) % CONFIG.directions.length; updateHud(); }
function formatSpeedLabel(speed) { return Number(speed) === 0 ? 'pause' : `x${speed}`; }
function setGameSpeed(speed) { gameState.time.timeScale = CONFIG.TIME.SPEED_OPTIONS.includes(speed) ? speed : CONFIG.TIME.DEFAULT_SCALE; updateToolButtons(); updateHud(); }

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
  const kind = getTool(gameState.ui?.selectedTool)?.kind;
  return ['road', 'facility', 'decoration', 'clear', 'delete'].includes(kind);
}

function bindInputEvents() {
canvas.addEventListener('mousemove', e => {
  updateMouse(e.clientX, e.clientY);
  if (gameState.camera.dragging) {
    gameState.camera.x -= e.movementX / gameState.camera.zoom;
    gameState.camera.y -= e.movementY / gameState.camera.zoom;
    if (distance(e.clientX, e.clientY, gameState.camera.dragStartX, gameState.camera.dragStartY) > CONFIG.seal.contactDistance) gameState.camera.dragMoved = true;
  }
});
canvas.addEventListener('mousedown', e => {
  if (e.button !== CONFIG.camera.dragButton) return;
  updateMouse(e.clientX, e.clientY);
  gameState.camera.dragging = true;
  gameState.camera.dragMoved = false;
  gameState.camera.dragStartX = e.clientX;
  gameState.camera.dragStartY = e.clientY;
});
window.addEventListener('mouseup', e => {
  if (!gameState.camera.dragging) return;
  gameState.camera.dragging = false;
  if (gameState.camera.dragMoved || gameState.phase !== CONFIG.phase.playing) return;
  updateMouse(e.clientX, e.clientY);
  const t = getTool(gameState.ui.selectedTool);
  if (placementClickHasPriority(t, gameState.input.mouseTile)) {
    gameState.ui.selectedDungeonId = null;
    if (t?.kind === 'delete') deleteAt(gameState.input.mouseTile.x, gameState.input.mouseTile.y);
    else if (t?.kind === 'clear') clearLandAt(gameState.input.mouseTile.x, gameState.input.mouseTile.y);
    else placeObject(t.id, gameState.input.mouseTile.x, gameState.input.mouseTile.y, gameState.ui.directionIndex, false);
    updateHud();
    return;
  }
  const dungeon = selectDungeonAtWorldPosition(gameState.input.mouseWorld?.x, gameState.input.mouseWorld?.y);
  const clickedSeal = sealAtWorldPoint(gameState.input.mouseWorld);
  if (dungeon?.id && (!clickedSeal || distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, dungeon.x, dungeon.y) <= distance(gameState.input.mouseWorld.x, gameState.input.mouseWorld.y, clickedSeal.x, clickedSeal.y))) {
    updateHud();
    return;
  }
  if (clickedSeal?.id) {
    gameState.ui.selectedSealId = clickedSeal.id;
    gameState.ui.selectedDungeonId = null;
    updateHud();
    return;
  }
  if (!isPlacementModeActive()) gameState.ui.selectedSealId = null;
  gameState.ui.selectedDungeonId = null;
  updateHud();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(gameState.camera.zoom + (e.deltaY < 0 ? CONFIG.camera.wheelStep : -CONFIG.camera.wheelStep), e.clientX, e.clientY); }, { passive: false });
window.addEventListener('keydown', e => { gameState.input.keys[e.code] = true; if (e.code === 'KeyR') rotateTool(); });
window.addEventListener('keyup', e => { gameState.input.keys[e.code] = false; });
startBtn.addEventListener('click', startNewGame);
loadBtn.addEventListener('click', loadGame);
zoomInBtn.addEventListener('click', () => setZoom(gameState.camera.zoom + CONFIG.camera.buttonStep));
zoomOutBtn.addEventListener('click', () => setZoom(gameState.camera.zoom - CONFIG.camera.buttonStep));
sealCardsEl.addEventListener('click', e => {
  const action = e.target?.dataset?.dungeonAction;
  if (action === 'start') startDungeon(e.target?.dataset?.dungeonId);
  if (action === 'close') { gameState.ui.selectedDungeonId = null; updateHud(); }
});

}
