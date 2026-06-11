function render() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(devicePixelRatioClamped(), devicePixelRatioClamped());
  ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2);
  ctx.scale(gameState.camera.zoom, gameState.camera.zoom);
  ctx.translate(-gameState.camera.x, -gameState.camera.y);
  drawWorld();
  drawRoads();
  drawObjects();
  drawMonsters();
  drawDungeons();
  drawSeals();
  drawPlacementPreview();
  ctx.restore();
  ctx.save();
  ctx.scale(devicePixelRatioClamped(), devicePixelRatioClamped());
  drawMinimap();
  ctx.restore();
}

function drawWorld() {
  for (let y = 0; y < CONFIG.world.rows; y += 1) {
    for (let x = 0; x < CONFIG.world.cols; x += 1) {
      const wx = x * CONFIG.world.tile, wy = y * CONFIG.world.tile;
      const tile = getTile(x, y);
      ctx.fillStyle = tile?.terrain === CONFIG.tileState.terrainLand
        ? (isBuildableTile(x, y) ? CONFIG.render.buildableLand : CONFIG.render.blockedLand)
        : tile?.terrain === CONFIG.tileState.terrainOutside ? CONFIG.render.outside : CONFIG.render.water;
      if (tile?.terrain === CONFIG.tileState.terrainLand && (x === CONFIG.world.islandX || y === CONFIG.world.islandY || x === CONFIG.world.islandX + CONFIG.world.islandW - 1 || y === CONFIG.world.islandY + CONFIG.world.islandH - 1)) ctx.fillStyle = CONFIG.render.beach;
      ctx.fillRect(wx, wy, CONFIG.world.tile, CONFIG.world.tile);
      if (tile?.terrain === CONFIG.tileState.terrainLand && tile?.buildState === CONFIG.tileState.buildBlocked) {
        ctx.fillStyle = CONFIG.render.blockedPatchOverlay;
        ctx.beginPath();
        ctx.arc(wx + CONFIG.world.tile * 0.5, wy + CONFIG.world.tile * 0.5, CONFIG.world.tile * 0.46, 0, Math.PI * 2);
        ctx.fill();
        drawObstacle(tile.obstacle, wx, wy);
      }
      ctx.strokeStyle = CONFIG.render.gridLine; ctx.strokeRect(wx, wy, CONFIG.world.tile, CONFIG.world.tile);
    }
  }
  if (gameState.ui?.debugRouteHints === true) drawOpenCorridors();
  drawExpansionBoundary();
  drawLabel('島エリア（緑=建設可 / 濃緑=未開拓）', CONFIG.world.islandX * CONFIG.world.tile + 10, CONFIG.world.islandY * CONFIG.world.tile + 24, '#123');
  drawLabel('外の冒険エリア：coast（カニ出現）', CONFIG.world.coastX * CONFIG.world.tile + 10, CONFIG.world.coastY * CONFIG.world.tile + 24, '#e8fbff');
}

function drawOpenCorridors() {
  ctx.save();
  ctx.strokeStyle = CONFIG.render.debugRouteHint ?? CONFIG.render.corridor;
  ctx.lineWidth = Math.max(1, CONFIG.world.tile * 0.08 / Math.max(gameState.camera.zoom, 0.1));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const route of [getEntryCorridor(), ...(CONFIG.ROUTES?.huntingCorridors ?? [])]) {
    const points = (route?.waypoints ?? []).map(routeWaypointToWorld).filter(Boolean);
    if (points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawExpansionBoundary() {
  ctx.save();
  ctx.strokeStyle = CONFIG.render.boundary;
  ctx.setLineDash([CONFIG.world.tile * CONFIG.render.boundaryDash, CONFIG.world.tile * CONFIG.render.boundaryGap]);
  ctx.lineWidth = CONFIG.render.boundaryLine / gameState.camera.zoom;
  ctx.strokeRect(CONFIG.expansion.regionX * CONFIG.world.tile, CONFIG.expansion.regionY * CONFIG.world.tile, CONFIG.expansion.regionW * CONFIG.world.tile, CONFIG.expansion.regionH * CONFIG.world.tile);
  ctx.restore();
}

function drawObstacle(type, wx, wy) {
  const style = CONFIG.render.obstacle;
  const cx = wx + CONFIG.world.tile * style.center;
  const cy = wy + CONFIG.world.tile * style.center;
  ctx.fillStyle = CONFIG.render.shadow; ctx.beginPath(); ctx.ellipse(cx + style.shadowX, cy + style.shadowY, style.shadowW, style.shadowH, 0, 0, Math.PI * 2); ctx.fill();
  if (type === CONFIG.tileState.obstacleGrass) {
    ctx.strokeStyle = '#b8e279'; ctx.lineWidth = style.grassLine / gameState.camera.zoom;
    for (const dir of CONFIG.directions) { ctx.beginPath(); ctx.moveTo(cx, cy + style.grassBaseY); ctx.lineTo(cx + dir.dx * style.grassReachX, cy + style.grassTipY + dir.dy * style.grassReachY); ctx.stroke(); }
    return;
  }
  if (type === CONFIG.tileState.obstacleTree) {
    ctx.fillStyle = '#6b401f'; ctx.fillRect(cx - style.trunkX, cy + style.trunkY, style.trunkW, style.trunkH);
    ctx.fillStyle = '#165f31'; ctx.beginPath(); ctx.arc(cx, cy + style.treeY, style.treeRadius, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = '#8d9089'; ctx.beginPath(); ctx.ellipse(cx, cy + style.rockY, style.rockW, style.rockH, style.rockTilt, 0, Math.PI * 2); ctx.fill();
}

function drawRoads() {
  for (const r of gameState.world.roads) {
    ctx.fillStyle = CONFIG.render.road; ctx.fillRect(r.x * CONFIG.world.tile + 5, r.y * CONFIG.world.tile + 14, CONFIG.world.tile - 10, CONFIG.world.tile - 28);
    ctx.fillRect(r.x * CONFIG.world.tile + 14, r.y * CONFIG.world.tile + 5, CONFIG.world.tile - 28, CONFIG.world.tile - 10);
  }
}


function drawObjects() {
  for (const o of gameState.world.objects) {
    if (o?.kind === 'facility') drawFacility(o); else drawDecoration(o);
  }
}

function drawFacility(o) {
  const x = o.x * CONFIG.world.tile, y = o.y * CONFIG.world.tile, w = o.w * CONFIG.world.tile, h = o.h * CONFIG.world.tile;
  ctx.fillStyle = CONFIG.render.shadow; ctx.fillRect(x + 5, y + 7, w, h);
  drawImageOrFallback(ctx, `cards.facility_neutral_${o.type}_idle`, x, y, w, h, () => {
    ctx.fillStyle = CONFIG.facilities[o.type]?.color ?? '#777'; ctx.fillRect(x + 5, y + 12, w - 10, h - 17);
    ctx.fillStyle = '#3a2115'; ctx.fillRect(x + 16, y + h - 30, w - 32, 26);
    ctx.fillStyle = '#fff4c0'; ctx.fillText(CONFIG.facilities[o.type]?.label ?? o.type, x + 12, y + 30);
  });
  ctx.strokeStyle = isFacilityUsable(o) ? '#5cff7d' : '#ff5a50'; ctx.lineWidth = 3 / gameState.camera.zoom; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  const e = entranceTile(o); ctx.fillStyle = isFacilityUsable(o) ? '#64ff95' : '#ff5757'; ctx.beginPath(); ctx.arc((e.x + 0.5) * CONFIG.world.tile, (e.y + 0.5) * CONFIG.world.tile, 7, 0, Math.PI * 2); ctx.fill();
}

function drawDecoration(o) {
  const x = o.x * CONFIG.world.tile + CONFIG.world.tile / 2, y = o.y * CONFIG.world.tile + CONFIG.world.tile / 2;
  ctx.fillStyle = CONFIG.render.shadow; ctx.beginPath(); ctx.ellipse(x + 3, y + 9, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (o.type === 'tree') { ctx.fillStyle = '#7a4b25'; ctx.fillRect(x - 4, y, 8, 16); ctx.fillStyle = '#1f7f3b'; ctx.beginPath(); ctx.arc(x, y - 5, 17, 0, Math.PI * 2); ctx.fill(); }
  if (o.type === 'flower') { ctx.fillStyle = '#ffd34f'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ff7bbd'; ctx.lineWidth = 5; for (const d of CONFIG.directions) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d.dx * 12, y + d.dy * 12); ctx.stroke(); } }
  if (o.type === 'rock') { ctx.fillStyle = '#9b9b91'; ctx.beginPath(); ctx.ellipse(x, y, 16, 12, -0.4, 0, Math.PI * 2); ctx.fill(); }
}

function getEntityRenderConfig() {
  return CONFIG.RENDER?.ENTITIES ?? {};
}

function getEntityScreenPosition(entity) {
  return { x: safeFiniteNumber(entity?.x, 0, 0), y: safeFiniteNumber(entity?.y, 0, 0) };
}

function getSealRenderSize() {
  const settings = getEntityRenderConfig();
  return CONFIG.world.tile * safeFiniteNumber(settings.sealSpriteScale, 1.5, 0.1);
}

function getMonsterRenderSize() {
  const settings = getEntityRenderConfig();
  return CONFIG.world.tile * safeFiniteNumber(settings.monsterSpriteScale, 1.3, 0.1);
}

function drawEntityShadow(context, x, y, w, h, type) {
  const settings = getEntityRenderConfig();
  const scale = type === 'monster'
    ? safeFiniteNumber(settings.monsterShadowScale, 0.75, 0)
    : safeFiniteNumber(settings.sealShadowScale, 0.9, 0);
  context.save();
  context.fillStyle = CONFIG.render.shadow;
  context.beginPath();
  context.ellipse(x, y + h * safeFiniteNumber(settings.shadowOffsetYScale, 0.32, 0), w * safeFiniteNumber(settings.shadowWidthScale, 0.34, 0) * scale, h * safeFiniteNumber(settings.shadowHeightScale, 0.14, 0) * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCompactHpBar(context, x, y, w, ratio, color) {
  const settings = getEntityRenderConfig();
  const h = safeFiniteNumber(settings.hpBarHeight, 5, 1);
  const value = Math.max(0, Math.min(1, safeFiniteNumber(ratio, 0, 0)));
  context.save();
  context.fillStyle = 'rgba(0,0,0,.5)';
  context.fillRect(x, y, w, h);
  context.fillStyle = color;
  context.fillRect(x, y, w * value, h);
  context.strokeStyle = 'rgba(255,255,255,.72)';
  context.lineWidth = Math.max(1, 1 / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  context.strokeRect(x, y, w, h);
  context.restore();
}

function drawOutlinedText(context, text, x, y, color, align = 'center') {
  const settings = getEntityRenderConfig();
  const fontSize = safeFiniteNumber(settings.nameFontSize, 11, 1);
  context.save();
  context.font = `${fontSize}px system-ui`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.lineWidth = Math.max(2, safeFiniteNumber(settings.outlineWidth, 3, 1) / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  context.strokeStyle = 'rgba(0,0,0,.72)';
  context.strokeText(text, x, y);
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

function getSealDisplayName(seal) {
  const name = String(seal?.name || (seal?.type === 'visitor' ? '訪問者' : 'あざらし')).trim();
  return name.length > 7 ? `${name.slice(0, 6)}…` : name;
}

function drawSealNameAndHp(context, seal, x, y, spriteSize) {
  const settings = getEntityRenderConfig();
  const hpWidth = spriteSize * safeFiniteNumber(settings.hpBarWidthScale, 0.9, 0.1);
  const nameY = y - spriteSize / 2 + safeFiniteNumber(settings.labelOffsetY, -8, -spriteSize);
  const hpY = nameY + safeFiniteNumber(settings.hpOffsetY, 6, 0);
  const effectiveMaxHp = Math.max(1, safeFiniteNumber(getSealEffectiveStats(seal).maxHp, CONFIG.seal.maxHp, 1));
  const nameColor = seal?.type === 'visitor' ? '#aef3ff' : '#fff1a8';
  drawOutlinedText(context, getSealDisplayName(seal), x, nameY, nameColor);
  drawCompactHpBar(context, x - hpWidth / 2, hpY, hpWidth, safeFiniteNumber(seal?.hp, 0, 0) / effectiveMaxHp, '#5fe45e');
}

function drawMonsterHp(context, monster, x, y, spriteSize) {
  const settings = getEntityRenderConfig();
  const hpWidth = spriteSize * safeFiniteNumber(settings.hpBarWidthScale, 0.9, 0.1);
  const hpY = y - spriteSize / 2 + safeFiniteNumber(settings.labelOffsetY, -8, -spriteSize);
  const maxHp = Math.max(1, safeFiniteNumber(monster?.maxHp, CONFIG.monster.hp, 1));
  drawCompactHpBar(context, x - hpWidth / 2, hpY, hpWidth, safeFiniteNumber(monster?.hp, 0, 0) / maxHp, '#e14635');
}

function drawSeal(context, seal) {
  const { x, y } = getEntityScreenPosition(seal);
  const spriteSize = getSealRenderSize();
  const drawX = x - spriteSize / 2;
  const drawY = y - spriteSize / 2;
  drawEntityShadow(context, x, y, spriteSize, spriteSize, 'seal');
  if (gameState.ui?.selectedSealId === seal.id) {
    const settings = getEntityRenderConfig();
    const ringScale = safeFiniteNumber(settings.selectedRingScale, 1.25, 0.1);
    context.save();
    context.strokeStyle = '#ffe66b';
    context.lineWidth = safeFiniteNumber(settings.selectedRingLineWidth, 4, 1) / Math.max(gameState.camera?.zoom ?? 1, 0.1);
    context.beginPath();
    context.ellipse(x, y + spriteSize * safeFiniteNumber(settings.selectedRingOffsetYScale, 0.3, 0), spriteSize * safeFiniteNumber(settings.selectedRingWidthScale, 0.36, 0) * ringScale, spriteSize * safeFiniteNumber(settings.selectedRingHeightScale, 0.18, 0) * ringScale, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
  drawSpriteFacing(context, seal.assetKey || (seal.type === 'visitor' ? assetKeyForVisitorProfile(seal.profileId) : 'seals.resident'), drawX, drawY, spriteSize, spriteSize, seal.facing, (fallbackContext, fx, fy, width, height, options) => drawFallbackSeal(fallbackContext, seal, fx, fy, width, height, options));
  drawSealNameAndHp(context, seal, x, y, spriteSize);
}

function drawMonster(context, monster) {
  const { x, y } = getEntityScreenPosition(monster);
  const spriteSize = getMonsterRenderSize();
  const drawX = x - spriteSize / 2;
  const drawY = y - spriteSize / 2;
  drawEntityShadow(context, x, y, spriteSize, spriteSize, 'monster');
  drawSpriteFacing(context, monster.assetKey || 'monsters.crab', drawX, drawY, spriteSize, spriteSize, monster.facing, (fallbackContext, fx, fy, width, height, options) => drawFallbackMonster(fallbackContext, monster, fx, fy, width, height, options));
  drawMonsterHp(context, monster, x, y, spriteSize);
}

function drawMonsters() {
  for (const monster of gameState.monsters ?? []) {
    if (!monster || monster.hp <= 0) continue;
    drawMonster(ctx, monster);
  }
}

function drawSeals() {
  for (const seal of gameState.seals ?? []) {
    if (!seal || seal.state === 'expeditionRunning') continue;
    drawSeal(ctx, seal);
  }
}

function drawPlacementPreview() {
  const gx = gameState.input.mouseTile.x, gy = gameState.input.mouseTile.y;
  const tool = CONFIG.tools.find(t => t?.id === gameState.ui?.selectedTool) ?? null;
  if (gx < 0 || gy < 0 || !tool) return;
  if (tool?.kind === 'clear') drawClearPreview(gx, gy);
  else {
    const result = canPlaceAt(gx, gy, tool);
    ctx.fillStyle = result.ok ? CONFIG.render.valid : CONFIG.render.invalid;
    ctx.fillRect(gx * CONFIG.world.tile, gy * CONFIG.world.tile, (tool?.w ?? 1) * CONFIG.world.tile, (tool?.h ?? 1) * CONFIG.world.tile);
  }
  const fb = gameState.ui.placementFeedback;
  if (fb) drawLabel(fb.text, fb.x * CONFIG.world.tile, fb.y * CONFIG.world.tile - 8, fb.ok ? '#d8ffe0' : '#ffd6d6');
}

function drawClearPreview(gx, gy) {
  const result = canClearAt(gx, gy);
  ctx.fillStyle = result.ok ? CONFIG.render.valid : CONFIG.render.invalid;
  for (const entry of getTilesInRadius(gx, gy, CONFIG.CLEARING.RADIUS)) {
    if (entry?.tile?.terrain !== CONFIG.tileState.terrainLand || !isInExpansionRegion(entry.x, entry.y)) continue;
    ctx.fillRect(entry.x * CONFIG.world.tile, entry.y * CONFIG.world.tile, CONFIG.world.tile, CONFIG.world.tile);
  }
  drawLabel(result.ok ? `${getClearingCost()}Gで開拓` : result.reason, gx * CONFIG.world.tile, gy * CONFIG.world.tile - 8, result.ok ? '#d8ffe0' : '#ffd6d6');
}

function drawFallbackSeal(context, seal, x, y, w, h, options = {}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const bodyColor = seal?.state === 'fallen' ? '#cbd2d8' : (seal?.type === 'resident' ? '#fff7ec' : '#d8f4ff');
  const face = options?.facing === 'right' ? 1 : -1;
  context.save();
  context.fillStyle = bodyColor;
  context.beginPath();
  context.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = seal?.type === 'resident' ? '#f2a93b' : '#35aee2';
  context.lineWidth = 3 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
  context.stroke();
  context.fillStyle = '#20242a';
  context.beginPath();
  context.arc(cx + face * 5, cy - 3, 2.2, 0, Math.PI * 2);
  context.arc(cx + face * 13, cy - 3, 2.2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#20242a';
  context.beginPath();
  context.arc(cx + face * 9, cy + 3, 5, 0, Math.PI);
  context.stroke();
  context.restore();
}

function drawFallbackMonster(context, monster, x, y, w, h, options = {}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const face = options?.facing === 'right' ? 1 : -1;
  context.save();
  context.fillStyle = '#d6502b';
  context.beginPath();
  context.ellipse(cx, cy, w * 0.47, h * 0.5, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#d6502b';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(cx - 14, cy);
  context.lineTo(cx - 27, cy - 10);
  context.moveTo(cx + 14, cy);
  context.lineTo(cx + 27, cy - 10);
  context.stroke();
  context.fillStyle = '#111';
  context.beginPath();
  context.arc(cx + face * 3, cy - 5, 2, 0, Math.PI * 2);
  context.arc(cx + face * 11, cy - 5, 2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHpBar(x, y, w, ratio, color) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio ?? 0)) * w, 6); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeRect(x, y, w, 6); }
function drawLabel(text, x, y, color) { ctx.font = CONFIG.render.bigFont; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = color; ctx.fillText(text, x, y); }

function drawMinimap() {
  const w = CONFIG.render.minimapW, h = CONFIG.render.minimapH, x = 14, bottomOffset = gameState.ui?.activeBottomTab ? 360 : 82, y = Math.max(88, canvas.clientHeight - h - bottomOffset);
  ctx.fillStyle = 'rgba(5,18,28,.82)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(x, y, w, h);
  const sx = w / (CONFIG.world.cols * CONFIG.world.tile), sy = h / (CONFIG.world.rows * CONFIG.world.tile);
  ctx.fillStyle = CONFIG.render.blockedLand; ctx.fillRect(x + CONFIG.world.islandX * CONFIG.world.tile * sx, y + CONFIG.world.islandY * CONFIG.world.tile * sy, CONFIG.world.islandW * CONFIG.world.tile * sx, CONFIG.world.islandH * CONFIG.world.tile * sy);
  ctx.fillStyle = CONFIG.render.buildableLand;
  for (let ty = 0; ty < CONFIG.world.rows; ty += 1) for (let tx = 0; tx < CONFIG.world.cols; tx += 1) if (isBuildableTile(tx, ty)) ctx.fillRect(x + tx * CONFIG.world.tile * sx, y + ty * CONFIG.world.tile * sy, CONFIG.world.tile * sx, CONFIG.world.tile * sy);
  ctx.fillStyle = CONFIG.render.outside; ctx.fillRect(x + CONFIG.world.coastX * CONFIG.world.tile * sx, y + CONFIG.world.coastY * CONFIG.world.tile * sy, CONFIG.world.coastW * CONFIG.world.tile * sx, CONFIG.world.coastH * CONFIG.world.tile * sy);
  ctx.fillStyle = '#ff3b30'; for (const m of gameState.monsters) ctx.fillRect(x + m.x * sx - 2, y + m.y * sy - 2, 4, 4);
  ctx.fillStyle = '#fff'; for (const s of gameState.seals) ctx.fillRect(x + s.x * sx - 2, y + s.y * sy - 2, 4, 4);
  ctx.strokeStyle = '#fff'; ctx.strokeRect(x + (gameState.camera.x - canvas.clientWidth / (2 * gameState.camera.zoom)) * sx, y + (gameState.camera.y - canvas.clientHeight / (2 * gameState.camera.zoom)) * sy, canvas.clientWidth / gameState.camera.zoom * sx, canvas.clientHeight / gameState.camera.zoom * sy);
}

function getResidentSeal() { return (gameState.seals ?? []).find(seal => seal?.type === 'resident') ?? null; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char] ?? char)); }

function updateHud() { markUIDirty('all'); renderUI(); }

function renderUI() {
  if (!gameState.ui) return;
  const selectionChanged = clearContextSelectionIfInvalid();
  if (selectionChanged) markUIDirty('selection');

  const shouldUpdateHud = gameState.ui.needsHudUpdate === true;
  const shouldUpdatePanel = gameState.ui.needsPanelUpdate === true;
  if (!shouldUpdateHud && !shouldUpdatePanel) return;

  try {
    if (shouldUpdateHud) {
      renderHUD();
      renderSpeedControls();
    }
    if (shouldUpdatePanel) {
      renderBottomTabBar();
      renderBottomPanel();
    }
    updateToolButtons();
    if (shouldUpdateHud) gameState.ui.needsHudUpdate = false;
    if (shouldUpdatePanel) gameState.ui.needsPanelUpdate = false;
  } catch (error) {
    console.error('UI render error:', error);
    gameState.ui.needsHudUpdate = false;
    gameState.ui.needsPanelUpdate = false;
    gameState.ui.message = `UIエラー: ${error?.message ?? error}`;
  }
}

function renderHUD() {
  if (!statsEl) return;
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  const nextGoal = getNextKnownnessGoal();
  const saveText = gameState.save?.statusText || '未保存';
  const selectedTool = CONFIG.tools.find(tool => tool?.id === gameState.ui?.selectedTool) ?? null;
  const direction = CONFIG.directions[gameState.ui?.directionIndex]?.name ?? 'S';
  const latestLog = (gameState.logs ?? [])[0] ?? gameState.ui?.message ?? '';
  statsEl.innerHTML = `<div class="hudRow"><b>${Math.floor(gameState.player?.g ?? 0)} G</b><span class="dateLine">${gameState.calendar?.year ?? 1}年 ${gameState.calendar?.month ?? 1}月 ${gameState.calendar?.week ?? 1}w</span><span>知名度 ${Math.floor(knownness)} / ${Math.floor(nextGoal)}</span><span>今月の狩猟 ${gameState.stats?.monthlyHunts ?? 0}</span></div><div class="hudRow"><span>ツール: ${escapeHtml(selectedTool?.label ?? 'なし')}</span><span>入口: ${escapeHtml(direction)}</span><span>保存: ${escapeHtml(saveText)}</span></div>${latestLog ? `<div class="hudMessage">${escapeHtml(latestLog)}</div>` : ''}`;
}

function renderSpeedControls() {
  const speedStatus = document.getElementById('speedStatus');
  if (speedStatus) speedStatus.textContent = formatSpeedLabel(gameState.time?.timeScale);
}

function renderBottomTabBar() {
  for (const button of bottomTabBarEl?.querySelectorAll('button[data-tab], button[data-bottom-tab]') ?? []) {
    button.classList.toggle('active', (button.dataset?.tab ?? button.dataset?.bottomTab) === (gameState.ui?.activeBottomTab ?? null));
  }
}

function renderBottomTabs() { renderBottomTabBar(); }

function getBottomPanelContentElement() {
  return bottomPanelEl?.querySelector?.('.bottom-panel-content') ?? null;
}

function getBottomPanelScrollElement(tabId = gameState.ui?.activeBottomTab ?? gameState.ui?.renderedBottomPanelTab ?? null) {
  if (tabId === 'seals') return bottomPanelEl?.querySelector?.('.people-table-wrap') ?? getBottomPanelContentElement();
  return getBottomPanelContentElement();
}

function getBottomPanelHeaderElement() {
  return bottomPanelEl?.querySelector?.('.bottom-panel-header') ?? null;
}

function saveBottomPanelScrollPosition(tabId = gameState.ui?.activeBottomTab ?? gameState.ui?.renderedBottomPanelTab ?? null) {
  const scrollElement = getBottomPanelScrollElement(tabId);
  if (!scrollElement || !tabId || !gameState.ui) return;
  gameState.ui.panelScrollTopByTab = gameState.ui.panelScrollTopByTab ?? {};
  gameState.ui.panelScrollTopByTab[tabId] = scrollElement.scrollTop;
}

function restoreBottomPanelScrollPosition(tabId = gameState.ui?.activeBottomTab ?? null) {
  const scrollElement = getBottomPanelScrollElement(tabId);
  if (!scrollElement || !tabId) return;
  const saved = safeFiniteNumber(gameState.ui?.panelScrollTopByTab?.[tabId], 0, 0);
  scrollElement.scrollTop = saved;
}

function getBottomPanelMeta(tabId) {
  const meta = {
    build: { title: '建設', hint: '道路・施設・装飾・管理ツールを選んでマップに配置します。' },
    seals: { title: '人物', hint: 'アザラシをクリックすると詳細表示' },
    dungeons: { title: 'ダンジョン', hint: 'マップ上のダンジョンをクリックして攻略開始' },
    progress: { title: '発展', hint: '知名度と訪問者解放の詳細' }
  };
  return meta[tabId] ?? { title: BOTTOM_TABS.find(tab => tab.id === tabId)?.label ?? '', hint: '' };
}

function renderBottomPanelHeader(tabId) {
  const meta = getBottomPanelMeta(tabId);
  return `<div><h2>${escapeHtml(meta.title)}</h2>${meta.hint ? `<div class="panelHint">${escapeHtml(meta.hint)}</div>` : ''}</div><button data-action="close-panel" class="subtle">閉じる</button>`;
}

function renderBottomPanel() {
  if (!bottomPanelEl) return;
  const previousTab = gameState.ui?.renderedBottomPanelTab ?? null;
  saveBottomPanelScrollPosition(previousTab);

  const active = gameState.ui?.activeBottomTab ?? null;
  bottomPanelEl.hidden = !active;
  if (!active) {
    bottomPanelEl.innerHTML = '';
    if (gameState.ui) gameState.ui.renderedBottomPanelTab = null;
    return;
  }

  const tabChanged = previousTab !== active;
  if (!getBottomPanelContentElement() || !getBottomPanelHeaderElement() || tabChanged) {
    bottomPanelEl.innerHTML = '<div class="bottom-panel-header"></div><div class="bottom-panel-content"></div>';
  }
  if (gameState.ui) gameState.ui.renderedBottomPanelTab = active;

  const headerElement = getBottomPanelHeaderElement();
  if (headerElement) headerElement.innerHTML = renderBottomPanelHeader(active);

  const renderers = { build: renderBuildPanel, seals: renderSealsPanel, dungeons: renderDungeonsPanel, progress: renderProgressPanel };
  const content = renderers[active]?.() ?? '';
  const contentElement = getBottomPanelContentElement();
  if (contentElement) {
    contentElement.className = `bottom-panel-content${active === 'seals' ? ' people-panel-content' : ''}`;
    contentElement.innerHTML = content;
  }
  restoreBottomPanelScrollPosition(active);
}

function panelHeader(title, hint = '') {
  return `<div class="bottom-panel-header"><div><h2>${escapeHtml(title)}</h2>${hint ? `<div class="panelHint">${escapeHtml(hint)}</div>` : ''}</div><button data-action="close-panel" class="subtle">閉じる</button></div>`;
}

function renderBuildPanel() {
  const categoryHtml = BUILD_CATEGORIES.map(category => {
    const buttons = category.toolIds.map(toolId => {
      const tool = CONFIG.tools.find(item => item?.id === toolId);
      if (!tool) return '';
      return `<button class="toolButton" data-tool="${escapeHtml(tool.id)}">${escapeHtml(tool.label)}</button>`;
    }).join('');
    return `<div class="compactCard"><b>${escapeHtml(category.label)}</b><div class="categoryButtons">${buttons}</div></div>`;
  }).join('');
  const selected = CONFIG.tools.find(tool => tool?.id === gameState.ui?.selectedTool) ?? null;
  return `<div class="buildPanel">
      <div class="buildCategories">${categoryHtml}</div>
      <div>
        <div class="compactCard"><b>選択中</b><br>${escapeHtml(selected?.label ?? 'なし')}<br>配置カテゴリ: ${escapeHtml(gameState.ui?.placementCategory ?? 'facility')}<br>入口方向: ${escapeHtml(CONFIG.directions[gameState.ui?.directionIndex]?.name ?? 'S')}<div class="buildActions"><button data-action="rotate">R 回転</button><button data-action="clearTool" class="subtle">ツール解除</button></div></div>
        <div class="compactCard helpText"><b>操作</b><br>WASD/矢印: カメラ移動<br>ドラッグ: カメラ移動 / 短いクリック: 配置<br>ホイール: ズーム<br>開拓: 未開拓の草木岩を${getClearingCost()}Gで除去<br><div class="zoomBtns"><button data-action="zoomOut">−</button><button data-action="zoomIn">＋</button></div></div>
        <div class="compactCard savePanel"><b>セーブ</b><br>${escapeHtml(gameState.save?.statusText || '未保存')}<br>最終保存: ${escapeHtml(formatSaveTime(gameState.save?.lastSavedAt))}<br><button data-action="manualSave">手動保存</button></div>
      </div>
    </div>`;
}

function renderSealsPanel() { return renderPeoplePanel(); }

function renderPeoplePanel() {
  const rows = getPeopleRosterRows();
  const state = getSealListState();
  const activeVisitors = (gameState.seals ?? []).filter(seal => seal?.type === 'visitor').length;
  const unlockedVisitors = (gameState.visitorProfiles ?? []).filter(isVisitorProfileUnlocked).length;
  const filters = [
    ['all', '全員'], ['resident', '住民'], ['activeVisitors', '訪問中'],
    ['hunting', '狩猟中'], ['resting', '休憩中'], ['unlockedVisitors', '解放済み'], ['lockedVisitors', '未解放']
  ].map(([id, label]) => `<button data-seal-filter="${id}" class="${state.filter === id ? 'active' : 'subtle'}">${label}</button>`).join('');
  return `<div class="people-panel">
    <div class="people-controls"><div class="people-filter-buttons">${filters}</div><div class="people-counts">訪問中: ${activeVisitors} / 解放済み: ${unlockedVisitors} / 登録: ${(gameState.visitorProfiles ?? []).length}</div></div>
    ${renderPeopleTable(rows)}
    ${renderSelectedPersonDetail(getSelectedPerson())}
  </div>`;
}

function getPeopleRosterRows() {
  const activeProfileIds = new Set((gameState.seals ?? []).map(seal => seal?.profileId).filter(Boolean));
  const rows = [];
  for (const seal of gameState.seals ?? []) {
    if (!seal) continue;
    const stats = getSealEffectiveStats(seal);
    const maxHp = safeFiniteNumber(stats.maxHp, seal?.maxHp ?? CONFIG.seal.maxHp, 1);
    rows.push({
      rosterId: `seal:${seal.id}`,
      kind: 'seal',
      entity: seal,
      seal,
      profile: seal.profileId ? getVisitorProfileById(seal.profileId) : null,
      name: seal.name,
      type: seal.type === 'resident' ? '住民' : '訪問者',
      typeOrder: seal.type === 'resident' ? 0 : 1,
      hpRate: safeFiniteNumber(seal.hp, 0, 0) / Math.max(1, maxHp),
      level: clampInteger(seal.level, 1, Number.MAX_SAFE_INTEGER, 1),
      favor: safeFiniteNumber(seal.favor, 0, 0),
      state: formatPeopleSealState(seal),
      rawState: seal.state,
      stayTime: safeFiniteNumber(seal.visitTimerMs, 0, 0),
      hunts: clampInteger(seal.huntsThisVisit, 0, Number.MAX_SAFE_INTEGER, 0),
      facilitiesUsed: clampInteger(seal.facilitiesUsedThisVisit, 0, Number.MAX_SAFE_INTEGER, 0),
      weapon: formatEquipmentSlotName(seal, 'weapon'),
      armor: formatEquipmentSlotName(seal, 'armor'),
      accessory: formatEquipmentSlotName(seal, 'accessory')
    });
  }
  for (const profile of gameState.visitorProfiles ?? []) {
    if (!profile || activeProfileIds.has(profile.id)) continue;
    const unlocked = isVisitorProfileUnlocked(profile);
    rows.push({
      rosterId: `profile:${profile.id}`,
      kind: unlocked ? 'profile' : 'lockedProfile',
      entity: profile,
      seal: null,
      profile,
      name: profile.name,
      type: '訪問者',
      typeOrder: unlocked ? 2 : 3,
      hpRate: 0,
      level: clampInteger(profile.level, 1, Number.MAX_SAFE_INTEGER, 1),
      favor: safeFiniteNumber(profile.favor, 0, 0),
      state: unlocked ? '未訪問' : '未解放',
      rawState: unlocked ? 'notVisiting' : 'locked',
      stayTime: 0,
      hunts: 0,
      facilitiesUsed: 0,
      weapon: unlocked ? formatEquipmentSlotName(profile, 'weapon') : '-',
      armor: unlocked ? formatEquipmentSlotName(profile, 'armor') : '-',
      accessory: unlocked ? formatEquipmentSlotName(profile, 'accessory') : '-'
    });
  }
  const filter = getSealListState().filter;
  const filtered = rows.filter(row => {
    if (filter === 'resident') return row.seal?.type === 'resident';
    if (filter === 'activeVisitors') return row.seal?.type === 'visitor';
    if (filter === 'unlockedVisitors') return row.kind === 'profile' || row.seal?.type === 'visitor';
    if (filter === 'lockedVisitors') return row.kind === 'lockedProfile';
    if (row.kind === 'lockedProfile') return false;
    if (filter === 'hunting') return ['hunting', 'movingToMonster', 'fighting', 'returningFromHunt', 'movingToHuntArea'].includes(row.rawState);
    if (filter === 'questing') return ['questing', 'movingToDungeon', 'waitingAtDungeon', 'expeditionRunning', 'returningFromDungeon'].includes(row.rawState);
    if (filter === 'resting') return ['resting', 'movingToInn', 'usingFacility', 'choosingFacility', 'movingToFacility'].includes(row.rawState);
    return true;
  });
  return sortPeopleRows(filtered, getSealListState().sortKey, getSealListState().sortDir);
}

function sortPeopleRows(rows, sortKey, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1;
  const textKeys = new Set(['name', 'type', 'state', 'weapon', 'armor', 'accessory']);
  return [...(rows ?? [])].sort((a, b) => {
    let av = sortKey === 'type' ? a.typeOrder : a?.[sortKey];
    let bv = sortKey === 'type' ? b.typeOrder : b?.[sortKey];
    if (textKeys.has(sortKey)) return String(av ?? '').localeCompare(String(bv ?? ''), 'ja') * dir || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja');
    return (safeFiniteNumber(av, 0, 0) - safeFiniteNumber(bv, 0, 0)) * dir || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja');
  });
}

function formatPeopleSealState(seal) {
  const dungeon = getDungeonById(seal?.expeditionId ?? seal?.questingDungeonId);
  if (dungeon) return `${CONFIG.dungeon?.labels?.peopleExpedition ?? '遠征中'}: ${dungeon.name}`;
  return stateLabel(seal?.state);
}

function renderPeopleTable(rows) {
  const columns = [
    ['name', '名前'], ['type', '種別'], ['hpRate', 'HP'], ['level', 'Lv'], ['favor', '好感度'],
    ['state', '状態'], ['stayTime', '滞在'], ['hunts', '狩猟'], ['weapon', '武器'], ['armor', '防具'], ['accessory', 'アクセ']
  ];
  const state = getSealListState();
  const selectedId = getSelectedPerson()?.rosterId ?? null;
  const headers = columns.map(([key, label]) => `<th><button data-seal-sort="${key}" class="sortHeader">${label}${state.sortKey === key ? `<span>${state.sortDir === 'asc' ? ' ▲' : ' ▼'}</span>` : ''}</button></th>`).join('');
  const body = rows.length ? rows.map(row => `<tr data-roster-id="${escapeHtml(row.rosterId)}" class="${row.rosterId === selectedId ? 'selected' : ''}">
    <td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${formatHp(row.entity)}</td><td>${row.level}</td><td>${Math.floor(row.favor)}</td>
    <td>${escapeHtml(row.state)}</td><td>${formatStayTime(row.seal)}</td><td>${row.hunts}</td><td>${escapeHtml(row.weapon)}</td><td>${escapeHtml(row.armor)}</td><td>${escapeHtml(row.accessory)}</td>
  </tr>`).join('') : '<tr><td colspan="11" class="emptyPeople">条件に合うアザラシはいません。</td></tr>';
  return `<div class="people-table-wrap"><table class="people-table"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function getSelectedPerson() {
  const rosterId = gameState.ui?.selectedPersonRosterId ?? (gameState.ui?.selectedSealId ? `seal:${gameState.ui.selectedSealId}` : null);
  if (!rosterId) return null;
  if (rosterId.startsWith('seal:')) {
    const seal = getSealById(rosterId.slice('seal:'.length));
    return seal ? { rosterId, kind: 'seal', entity: seal, seal, profile: seal.profileId ? getVisitorProfileById(seal.profileId) : null } : null;
  }
  if (rosterId.startsWith('profile:')) {
    const profile = getVisitorProfileById(rosterId.slice('profile:'.length));
    return profile ? { rosterId, kind: 'profile', entity: profile, seal: null, profile } : null;
  }
  return null;
}

function renderSelectedPersonDetail(person) {
  if (!person) return '<div class="people-detail compactCard">アザラシをクリック、または一覧から選択すると詳細表示</div>';
  const entity = person.entity;
  const seal = person.seal;
  const profile = person.profile;
  const stats = getPersonEffectiveStats(entity);
  const personality = getPersonalityConfig(entity)?.label ?? entity?.personality ?? 'balanced';
  const stay = seal?.type === 'visitor' ? `<br>滞在: ${formatStayTime(seal)} / 最短${Math.floor(safeFiniteNumber(seal.minStayMs, 0, 0) / 1000)}秒 / 最長${Math.floor(safeFiniteNumber(seal.maxStayMs, 0, 0) / 1000)}秒` : '';
  return `<div class="people-detail compactCard"><b>${escapeHtml(entity?.name ?? '不明')}</b>（${seal?.type === 'resident' ? '住民' : '訪問者'}）<br>
    性格: ${escapeHtml(personality)} / 状態: ${escapeHtml(seal ? formatPeopleSealState(seal) : (isVisitorProfileUnlocked(profile) ? '未訪問' : '未解放'))}<br>
    HP: ${formatHp(entity)} / 所持G: ${seal ? Math.floor(safeFiniteNumber(seal.carriedG, 0, 0)) : '-'} / 装備予算: ${Math.floor(safeFiniteNumber(entity?.gearBudget, 0, 0))}<br>
    Lv: ${clampInteger(entity?.level, 1, Number.MAX_SAFE_INTEGER, 1)} / EXP: ${Math.floor(safeFiniteNumber(entity?.exp, 0, 0))} / 好感度: ${Math.floor(safeFiniteNumber(entity?.favor, 0, 0))}${stay}<br>
    訪問狩猟/施設: ${seal?.huntsThisVisit ?? 0}/${seal?.facilitiesUsedThisVisit ?? 0} / 総訪問: ${profile?.visits ?? '-'} / ダンジョン攻略: ${profile?.dungeonClears ?? 0}<br>
    武器: ${formatEquipmentSlotName(entity, 'weapon')} / 防具: ${formatEquipmentSlotName(entity, 'armor')} / アクセ: ${formatEquipmentSlotName(entity, 'accessory')}<br>
    有効攻撃: ${Math.floor(stats.attack)} / 有効防御: ${Math.floor(stats.defense)} / 有効最大HP: ${Math.ceil(stats.maxHp)}
    <div class="buildActions"><button data-action="closeSeal" class="subtle">選択解除</button></div></div>`;
}

function formatHp(sealOrProfile) {
  if (!sealOrProfile) return '-';
  if (sealOrProfile.type === 'resident' || sealOrProfile.type === 'visitor') {
    const maxHp = getSealEffectiveStats(sealOrProfile).maxHp;
    return `${Math.ceil(safeFiniteNumber(sealOrProfile.hp, 0, 0))}/${Math.ceil(maxHp)}`;
  }
  return `-/${Math.ceil(safeFiniteNumber(sealOrProfile.baseStats?.maxHp, CONFIG.seal.maxHp, 1))}`;
}

function formatStayTime(seal) {
  if (!seal || seal.type !== 'visitor') return '-';
  return `${Math.floor(safeFiniteNumber(seal.visitTimerMs, 0, 0) / 1000)}秒`;
}

function formatEquipmentSlotName(entity, slot) {
  const itemId = entity?.equipment?.[slot] ?? null;
  if (!itemId) return 'なし';
  return getItemDef(itemId)?.name ?? '不明';
}

function getPersonEffectiveStats(entity) {
  if (!entity) return { attack: 0, defense: 0, maxHp: 1 };
  if (entity.type === 'resident' || entity.type === 'visitor') return getSealEffectiveStats(entity);
  const base = entity.baseStats ?? {};
  const stats = {
    attack: safeFiniteNumber(base.attack, CONFIG.seal.attack, 0),
    defense: safeFiniteNumber(base.defense, CONFIG.seal.defense, 0),
    maxHp: safeFiniteNumber(base.maxHp, CONFIG.seal.maxHp, 1)
  };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const item = getItemDef(entity.equipment?.[slot]);
    if (!item) continue;
    stats.attack += safeFiniteNumber(item.attackBonus, 0, 0);
    stats.defense += safeFiniteNumber(item.defenseBonus, 0, 0);
    stats.maxHp += safeFiniteNumber(item.hpBonus, 0, 0);
  }
  return stats;
}


function getVisibleDungeonParticipants(dungeon) {
  const participants = normalizeDungeonParticipantIds(dungeon?.participantIds);
  if (!dungeon || dungeon.state === 'completed' || dungeon.state === 'expired') return [];
  if (dungeon.state === 'returning') {
    return participants.filter(participant => {
      const seal = getSealById(participant.sealId);
      return seal && (seal.expeditionId === dungeon.id || seal.questingDungeonId === dungeon.id || seal.state === 'returningFromDungeon');
    });
  }
  return participants.filter(participant => !!getSealById(participant.sealId));
}

function renderDungeonParticipantStatusText(dungeon) {
  const participants = normalizeDungeonParticipantIds(dungeon?.participantIds);
  if (participants.length <= 0) return '';
  return participants.map(participant => {
    const seal = getSealById(participant.sealId);
    const name = participant.name || seal?.name || participant.id;
    let status = '確認中';
    if (!seal) status = '不在';
    else if (seal.expeditionId === dungeon?.id || seal.questingDungeonId === dungeon?.id) status = stateLabel(seal.state);
    else if (['returning', 'completed'].includes(dungeon?.state)) status = '帰還済み';
    return `${escapeHtml(name)}（${escapeHtml(status)}）`;
  }).join('、');
}

function renderDungeonsPanel() {
  const active = (gameState.dungeons ?? []).filter(dungeon => ['available', 'assembling', 'running', 'returning'].includes(dungeon?.state));
  const running = active.filter(dungeon => ['assembling', 'running', 'returning'].includes(dungeon?.state));
  const runningHtml = running.length ? running.map(dungeon => {
    const participants = renderDungeonParticipantStatusText(dungeon) || '参加者確認中';
    const current = dungeon.nodes?.[dungeon.currentNodeIndex];
    const currentText = current ? `${CONFIG.dungeon?.nodeLabels?.[current.type] ?? current.type}` : dungeonStateLabel(dungeon.state);
    return `<div class="compactCard"><b>${escapeHtml(dungeon.name)}</b><br>${escapeHtml(dungeonStateLabel(dungeon.state))}: ${escapeHtml(currentText)}<br>参加: ${participants}</div>`;
  }).join('') : '<div class="compactCard">攻略中のダンジョンはありません。</div>'; 
  return `<div class="compactGrid">
      <div class="compactCard"><b>概要</b><br>活動中: ${active.length}<br>選択中: ${escapeHtml(getDungeonById(gameState.ui?.selectedDungeonId)?.name ?? 'なし')}</div>
      ${runningHtml}
      ${renderSelectedDungeonDetail()}
    </div>`;
}

function renderProgressPanel() {
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  const nextGoal = getNextKnownnessGoal();
  const ratio = nextGoal > knownness ? knownness / Math.max(1, nextGoal) : 1;
  const nextUnlock = getNextUnlockProfile();
  const thresholds = (CONFIG.KNOWNNESS?.UNLOCK_THRESHOLDS ?? [100, 200, 300, 400, 500]).map(value => `<span class="thresholdPill ${knownness >= value ? 'done' : ''}">${value}</span>`).join('');
  const unlocked = (gameState.visitorProfiles ?? []).filter(isVisitorProfileUnlocked).map(profile => escapeHtml(profile.name)).join('、') || 'なし';
  const monthly = `狩猟${gameState.stats?.monthlyHunts ?? 0}回 / 前月知名度+${Math.floor(safeFiniteNumber(gameState.stats?.monthlyKnownnessGained, 0, 0))} / 今月収入${Math.floor(safeFiniteNumber(gameState.stats?.monthlyPlayerIncome, 0, 0))}G`;
  return `<div class="compactGrid">
      <div class="compactCard"><b>知名度</b><br>${Math.floor(knownness)} / ${Math.floor(nextGoal)}<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></div></div>次の目標: ${Math.floor(nextGoal)}</div>
      <div class="compactCard"><b>次の訪問者</b><br>${nextUnlock ? `${escapeHtml(nextUnlock.name)}（${Math.floor(safeFiniteNumber(nextUnlock.unlockedAtKnownness, 0, 0))}）` : 'すべて解放済み'}</div>
      <div class="compactCard"><b>しきい値</b><div class="thresholdList">${thresholds}</div></div>
      <div class="compactCard"><b>解放済み訪問者</b><br>${unlocked}</div>
      <div class="compactCard"><b>月次サマリー</b><br>${escapeHtml(monthly)}</div>
      <div class="compactCard"><b>ログ</b><div class="log">${(gameState.logs ?? []).map(l => `・${escapeHtml(l)}`).join('<br>') || 'なし'}</div></div>
    </div>`;
}

function renderSelectedSealDetail() {
  const selected = (gameState.seals ?? []).find(seal => seal?.id === gameState.ui?.selectedSealId) ?? null;
  return selected ? renderSelectedSealPanel(selected) : '<div class="compactCard">選択中のアザラシはありません。</div>';
}

function renderSelectedDungeonDetail() {
  return drawDungeonPanel() || '<div class="compactCard">選択中のダンジョンはありません。</div>';
}

function renderSelectedSealPanel(seal) {
  const stats = getSealEffectiveStats(seal);
  const hpMax = safeFiniteNumber(stats.maxHp, seal?.maxHp ?? CONFIG.seal.maxHp, 1);
  const targetText = formatSealTarget(seal);
  const stay = seal?.type === 'visitor' ? `<br>滞在: ${Math.floor(safeFiniteNumber(seal.visitTimerMs, 0, 0) / 1000)}秒 / 最短${Math.floor(safeFiniteNumber(seal.minStayMs, 0, 0) / 1000)}秒 / 最長${Math.floor(safeFiniteNumber(seal.maxStayMs, 0, 0) / 1000)}秒<br>訪問狩猟/施設: ${seal.huntsThisVisit ?? 0}/${seal.facilitiesUsedThisVisit ?? 0} / ${seal.wantsToLeave ? '帰りたい' : '滞在中'}` : '';
  return `<div class="compactCard selectedSealCard"><b>${escapeHtml(seal.name)}</b>（${seal.type === 'resident' ? '住民' : '訪問者'}）<br>性格: ${escapeHtml(getPersonalityConfig(seal)?.label ?? seal.personality)}<br>HP ${Math.ceil(safeFiniteNumber(seal.hp, 0, 0))} / ${Math.ceil(hpMax)}<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, safeFiniteNumber(seal.hp, 0, 0) / hpMax * 100))}%"></div></div>所持G: ${Math.floor(safeFiniteNumber(seal.carriedG, 0, 0))}<br>装備予算: ${Math.floor(safeFiniteNumber(seal.gearBudget, 0, 0))}<br>Lv: ${seal.level} / EXP: ${Math.floor(safeFiniteNumber(seal.exp, 0, 0))}<br>好感度: ${Math.floor(safeFiniteNumber(seal.favor, 0, 0))}<br>状態: ${escapeHtml(stateLabel(seal.state))}<br>行動/目標: ${escapeHtml(targetText)}${stay}<hr>武器: ${equipmentText(seal, 'weapon')}<br>防具: ${equipmentText(seal, 'armor')}<br>アクセ: ${equipmentText(seal, 'accessory')}<br>有効攻撃: ${Math.floor(stats.attack)} / 有効防御: ${Math.floor(stats.defense)} / 有効最大HP: ${Math.ceil(stats.maxHp)}<div class="buildActions"><button data-action="closeSeal" class="subtle">詳細を閉じる</button></div></div>`;
}

function clearContextSelectionIfInvalid() {
  const ui = gameState.ui ?? {};
  let changed = false;
  if (ui.selectedSealId && !(gameState.seals ?? []).some(seal => seal?.id === ui.selectedSealId)) { ui.selectedSealId = null; changed = true; }
  if (ui.selectedDungeonId && !getDungeonById(ui.selectedDungeonId)) { ui.selectedDungeonId = null; changed = true; }
  if (ui.selectedTool && !CONFIG.tools.some(tool => tool?.id === ui.selectedTool)) { ui.selectedTool = null; changed = true; }
  if (ui.selectedPersonRosterId?.startsWith?.('seal:') && !getSealById(ui.selectedPersonRosterId.slice('seal:'.length))) { ui.selectedPersonRosterId = null; changed = true; }
  if (ui.selectedPersonRosterId?.startsWith?.('profile:') && !getVisitorProfileById(ui.selectedPersonRosterId.slice('profile:'.length))) { ui.selectedPersonRosterId = null; changed = true; }
  if (ui.activeBottomTab && !BOTTOM_TABS.some(tab => tab.id === ui.activeBottomTab)) { ui.activeBottomTab = null; changed = true; }
  const collapsed = !ui.activeBottomTab;
  if (ui.panelCollapsed !== collapsed) { ui.panelCollapsed = collapsed; changed = true; }
  return changed;
}

function equipmentText(seal, slot) {
  const itemId = seal?.equipment?.[slot] ?? null;
  if (!itemId) return 'なし';
  const item = getItemDef(itemId);
  if (!item) return '不明な装備';
  const bonuses = [];
  if (safeFiniteNumber(item.attackBonus, 0, 0) > 0) bonuses.push(`攻+${item.attackBonus}`);
  if (safeFiniteNumber(item.defenseBonus, 0, 0) > 0) bonuses.push(`防+${item.defenseBonus}`);
  if (safeFiniteNumber(item.hpBonus, 0, 0) > 0) bonuses.push(`HP+${item.hpBonus}`);
  return `${escapeHtml(item.name)}${bonuses.length ? `（${bonuses.join(' / ')}）` : ''}`;
}
function formatSealTarget(seal) {
  const dungeon = getDungeonById(seal?.expeditionId ?? seal?.questingDungeonId);
  if (dungeon) return seal?.currentAction || `${dungeon.name}へ遠征中`;
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal?.targetId);
  if (facility) return seal?.currentAction || `${CONFIG.facilities[facility.type]?.label ?? '施設'} (${facility.id})`;
  if (seal?.target?.reason) return seal?.currentAction || seal.target.reason;
  return seal?.currentAction || 'なし';
}
function stateLabel(state) { return ({ movingToDungeon:'遠征集合中', waitingAtDungeon:'入口で待機中', expeditionRunning:'遠征中', returningFromDungeon:'遠征帰還中', questing:'攻略参加中', arrivingFromSea:'海から到着中', choosingArrivalAction:'到着後の行動選択', movingToFacility:'施設へ移動中', usingFacility:'施設利用中', choosingHuntArea:'狩場選択', movingToHuntArea:'狩場へ移動中', hunting:'狩猟中', movingToMonster:'獲物へ移動中', fighting:'戦闘中', returningFromHunt:'帰宅中', choosingPostHuntFacility:'帰還後の行動選択', leavingToSea:'帰宅中', idle:'待機中', fallen:'倒れている', rescuing:'救助中', carryingFallenSeal:'搬送中', arriving:'海から到着中', movingToHuntExit:'狩場へ移動中', choosingFacility:'施設選択', leaving:'帰宅中' })[state] ?? state; }

function drawDungeon(context, dungeon) {
  if (!context || !dungeon) return;
  const selected = gameState.ui?.selectedDungeonId === dungeon.id;
  const radius = CONFIG.dungeon?.clickRadius ?? 24;
  context.save();
  context.translate(dungeon.x, dungeon.y);
  if (selected) {
    context.strokeStyle = '#fff36a';
    context.lineWidth = 4 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = ['assembling', 'running', 'returning'].includes(dungeon.state) ? '#7d5cff' : dungeon.state === 'completed' ? '#61e786' : '#2b2348';
  context.strokeStyle = '#f4e5b4';
  context.lineWidth = 3 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
  context.beginPath();
  context.moveTo(-18, 16);
  context.lineTo(-10, -10);
  context.quadraticCurveTo(0, -24, 10, -10);
  context.lineTo(18, 16);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#120e20';
  context.beginPath();
  context.arc(0, 7, 8, Math.PI, 0);
  context.lineTo(8, 16);
  context.lineTo(-8, 16);
  context.closePath();
  context.fill();
  if (['assembling', 'running', 'returning'].includes(dungeon.state)) {
    const participants = getVisibleDungeonParticipants(dungeon);
    const nodes = dungeon.nodes ?? [];
    const total = nodes.reduce((sum, node) => sum + safeFiniteNumber(node?.durationMs, 0, 0), 0) || safeFiniteNumber(dungeon.durationMs, 1, 1);
    const ratio = Math.max(0, Math.min(1, safeFiniteNumber(dungeon.progressMs, 0, 0) / Math.max(1, total)));
    context.fillStyle = 'rgba(0,0,0,.55)';
    context.fillRect(-28, 24, 56, 8);
    context.fillStyle = '#9dfcff';
    context.fillRect(-28, 24, 56 * ratio, 8);
    drawDungeonParticipantCluster(context, dungeon, participants);
  }
  context.restore();
}


function drawDungeonParticipantCluster(context, dungeon, participants) {
  if (!context || !dungeon || !Array.isArray(participants) || participants.length <= 0) return;
  context.save();
  const zoom = Math.max(gameState.camera?.zoom ?? 1, 0.1);
  context.font = `${11 / zoom}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const countKey = dungeon.state === 'assembling' ? 'assemblingCount' : (dungeon.state === 'returning' ? 'returningCount' : 'participantCount');
  const countLabel = (CONFIG.dungeon?.labels?.[countKey] ?? CONFIG.dungeon?.labels?.participantCount ?? '探索中 {count}匹').replace('{count}', String(participants.length));
  const names = participants.map(participant => String(participant?.name || getSealById(participant?.sealId)?.name || '').slice(0, 4)).filter(Boolean).join('・');
  const label = names ? `${countLabel} ${names}` : countLabel;
  const width = Math.min(140, Math.max(76, context.measureText(label).width + 16));
  context.fillStyle = 'rgba(18,14,32,.82)';
  context.fillRect(-width / 2, -50, width, 20);
  context.fillStyle = '#fff7d1';
  context.fillText(label, 0, -40);
  participants.slice(0, 4).forEach((participant, index) => {
    const startX = -((Math.min(4, participants.length) - 1) * 12) / 2;
    const x = startX + index * 12;
    const y = 36;
    context.fillStyle = '#f7fbff';
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#5b4aa5';
    context.lineWidth = 1.5 / zoom;
    context.stroke();
  });
  context.restore();
}

function drawDungeons() {
  for (const dungeon of gameState.dungeons ?? []) drawDungeon(ctx, dungeon);
}

function drawDungeonPanel() {
  const dungeon = getDungeonById(gameState.ui?.selectedDungeonId);
  if (!dungeon) return '';
  const area = getDungeonAreaDef(dungeon.areaId);
  const type = getDungeonTypeDef(dungeon.type);
  const preview = dungeon.rewardPreview ?? getDungeonRewardPreview(dungeon);
  const remaining = Math.max(0, safeFiniteNumber(dungeon.expiresInMs, 0, 0));
  const participants = renderDungeonParticipantStatusText(dungeon) || '未編成（開始時に自動選出）';
  const itemNames = (preview.itemIds ?? []).map(id => getItemDef(id)?.name ?? id).join(' / ') || 'なし';
  const canStart = canStartDungeon(dungeon);
  const startButton = dungeon.state === 'available' ? `<button data-dungeon-action="start" data-dungeon-id="${escapeHtml(dungeon.id)}">攻略開始</button>` : '';
  const route = renderDungeonRoute(dungeon);
  const logs = renderDungeonLog(dungeon);
  const reward = renderDungeonRewardSummary(dungeon);
  const current = dungeon.nodes?.[dungeon.currentNodeIndex];
  const currentText = current ? `${CONFIG.dungeon?.nodeLabels?.[current.type] ?? current.type}` : dungeonStateLabel(dungeon.state);
  const availability = dungeon.state === 'available' ? `残り時間: ${Math.ceil(remaining / 1000)}秒<br>` : '';
  return `<div class="panel sealCard dungeonPanel"><b>🕳️ ${escapeHtml(dungeon.name)}</b><br>エリア: ${escapeHtml(area?.label ?? dungeon.areaId)}<br>状態: ${escapeHtml(dungeonStateLabel(dungeon.state))}<br>${availability}現在: ${escapeHtml(currentText)}<br>参加費: ${Math.floor(safeFiniteNumber(dungeon.recruitCost, 0, 0))}G<br>難易度: ${Math.floor(safeFiniteNumber(type?.difficulty, 0, 0))}<br>敵: ${escapeHtml((dungeon.enemyTypes ?? []).join(' / ') || '不明')}<br>報酬見込み: ${Math.floor(preview.g ?? 0)}G / EXP${Math.floor(preview.exp ?? 0)} / 知名度+${Math.floor(preview.knownness ?? 0)}<br>ドロップ候補: ${escapeHtml(itemNames)}<br>参加者: ${participants}<br>${route}${logs}${reward}${canStart.ok || dungeon.state !== 'available' ? '' : `<span class="warnText">${escapeHtml(canStart.reason)}</span><br>`}<div class="dungeonButtons">${startButton}<button data-dungeon-action="close">閉じる</button></div></div>`;
}

function renderDungeonRoute(dungeon) {
  const nodes = Array.isArray(dungeon?.nodes) ? dungeon.nodes : [];
  if (nodes.length <= 0) return '';
  const participantNames = getVisibleDungeonParticipants(dungeon).map(p => p.name || getSealById(p.sealId)?.name || p.id).join(' / ');
  const html = nodes.map((node, index) => {
    const classes = ['dungeonNode'];
    if (node?.resolved) classes.push('done');
    if (index === dungeon.currentNodeIndex && ['assembling', 'running'].includes(dungeon.state)) classes.push('current');
    const marker = node?.resolved ? '✓' : (index === dungeon.currentNodeIndex ? '●' : '○');
    const names = index === dungeon.currentNodeIndex && participantNames ? `<small>${escapeHtml(participantNames)}</small>` : '';
    return `<div class="${classes.join(' ')}"><span>${marker}</span>${escapeHtml(CONFIG.dungeon?.nodeLabels?.[node?.type] ?? node?.type ?? '?')}${names}</div>`;
  }).join('');
  return `<div class="dungeonRouteTitle">${escapeHtml(CONFIG.dungeon?.labels?.routeTitle ?? '遠征ルート')}</div><div class="dungeonRoute">${html}</div>`;
}

function renderDungeonLog(dungeon) {
  const logs = normalizeDungeonLog(dungeon?.expeditionLog).map(text => `<li>${escapeHtml(text)}</li>`).join('') || '<li>開始するとあざらしの行動が記録されます。</li>';
  return `<div class="dungeonLog"><b>${escapeHtml(CONFIG.dungeon?.labels?.logTitle ?? '遠征ログ')}</b><ul>${logs}</ul></div>`;
}

function renderDungeonRewardSummary(dungeon) {
  if (!['returning', 'completed'].includes(dungeon?.state)) return '';
  const reward = normalizeDungeonReward(dungeon?.reward);
  const items = (reward.items ?? []).map(item => `${getItemDef(item.itemId)?.name ?? item.itemId}x${item.count}`).join('、') || 'なし';
  return `<div class="dungeonReward"><b>${escapeHtml(CONFIG.dungeon?.labels?.completedReward ?? '獲得報酬')}</b>: ${Math.floor(reward.g)}G / EXP${Math.floor(reward.exp)} / 知名度+${Math.floor(reward.knownness)} / ${escapeHtml(items)}</div>`;
}

function dungeonStateLabel(state) { return (CONFIG.dungeon?.stateLabels ?? {})[state] ?? String(state ?? ''); }
