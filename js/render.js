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

function drawMonsters() {
  for (const monster of gameState.monsters ?? []) {
    if (!monster || monster.hp <= 0) continue;
    const size = CONFIG.SPRITES.monster;
    const w = size.w;
    const h = size.h;
    drawSpriteFacing(ctx, monster.assetKey || 'monsters.crab', monster.x - w / 2, monster.y - h / 2, w, h, monster.facing, (context, x, y, width, height, options) => drawFallbackMonster(context, monster, x, y, width, height, options));
    drawHpBar(monster.x - 20, monster.y - 30, 40, monster.hp / monster.maxHp, '#e14635');
  }
}

function drawSeals() {
  for (const seal of gameState.seals ?? []) {
    if (!seal) continue;
    const size = CONFIG.SPRITES.seal;
    const w = size.w;
    const h = size.h;
    ctx.fillStyle = CONFIG.render.shadow;
    ctx.beginPath();
    ctx.ellipse(seal.x, seal.y + 15, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (gameState.ui?.selectedSealId === seal.id) {
      ctx.strokeStyle = '#ffe66b';
      ctx.lineWidth = 4 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
      ctx.beginPath();
      ctx.ellipse(seal.x, seal.y + 9, 29, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawSpriteFacing(ctx, seal.assetKey || (seal.type === 'visitor' ? assetKeyForVisitorProfile(seal.profileId) : 'seals.resident'), seal.x - w / 2, seal.y - h / 2, w, h, seal.facing, (context, x, y, width, height, options) => drawFallbackSeal(context, seal, x, y, width, height, options));
    const effectiveMaxHp = getSealEffectiveStats(seal).maxHp;
    drawHpBar(seal.x - 22, seal.y - 29, 44, safeFiniteNumber(seal.hp, 0, 0) / Math.max(1, effectiveMaxHp), '#5fe45e');
    drawLabel(seal?.type === 'resident' ? '住' : '訪', seal.x - 10, seal.y - 38, seal?.type === 'resident' ? '#ffd98a' : '#aef3ff');
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

function getBottomPanelScrollElement() {
  return bottomPanelEl?.querySelector?.('.bottom-panel-content') ?? null;
}

function getBottomPanelHeaderElement() {
  return bottomPanelEl?.querySelector?.('.bottom-panel-header') ?? null;
}

function saveBottomPanelScrollPosition(tabId = gameState.ui?.activeBottomTab ?? gameState.ui?.renderedBottomPanelTab ?? null) {
  const scrollElement = getBottomPanelScrollElement();
  if (!scrollElement || !tabId || !gameState.ui) return;
  gameState.ui.panelScrollTopByTab = gameState.ui.panelScrollTopByTab ?? {};
  gameState.ui.panelScrollTopByTab[tabId] = scrollElement.scrollTop;
}

function restoreBottomPanelScrollPosition(tabId = gameState.ui?.activeBottomTab ?? null) {
  const scrollElement = getBottomPanelScrollElement();
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
  if (!getBottomPanelScrollElement() || !getBottomPanelHeaderElement() || tabChanged) {
    bottomPanelEl.innerHTML = '<div class="bottom-panel-header"></div><div class="bottom-panel-content"></div>';
  }
  if (gameState.ui) gameState.ui.renderedBottomPanelTab = active;

  const headerElement = getBottomPanelHeaderElement();
  if (headerElement) headerElement.innerHTML = renderBottomPanelHeader(active);

  const renderers = { build: renderBuildPanel, seals: renderSealsPanel, dungeons: renderDungeonsPanel, progress: renderProgressPanel };
  const content = renderers[active]?.() ?? '';
  const scrollElement = getBottomPanelScrollElement();
  if (scrollElement) scrollElement.innerHTML = content;
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

function renderSealsPanel() {
  const resident = getResidentSeal();
  const visitors = (gameState.seals ?? []).filter(seal => seal?.type === 'visitor');
  const unlocked = (gameState.visitorProfiles ?? []).filter(isVisitorProfileUnlocked);
  const locked = (gameState.visitorProfiles ?? []).filter(profile => !isVisitorProfileUnlocked(profile));
  const visitorCards = visitors.length ? visitors.map(seal => `<div class="compactCard"><b>${escapeHtml(seal.name)}</b><br>${escapeHtml(stateLabel(seal.state))}<br>HP ${Math.ceil(safeFiniteNumber(seal.hp, 0, 0))}/${Math.ceil(getSealEffectiveStats(seal).maxHp)}</div>`).join('') : '<div class="compactCard">訪問中のあざらしはいません。</div>';
  return `<div class="compactGrid">
      <div class="compactCard"><b>住民</b><br>${escapeHtml(resident?.name ?? gameState.residentName)}<br>${escapeHtml(stateLabel(resident?.state ?? 'idle'))}</div>
      <div class="compactCard"><b>訪問者</b><br>活動中: ${visitors.length} / ${CONFIG.visitor.maxActive}<br>解放済み: ${unlocked.length} / ${(gameState.visitorProfiles ?? []).length}<br>未解放: ${locked.map(profile => `${escapeHtml(profile.name)}(${Math.floor(safeFiniteNumber(profile.unlockedAtKnownness, 0, 0))})`).join('、') || 'なし'}</div>
      ${visitorCards}
      ${renderSelectedSealDetail()}
    </div>`;
}

function renderDungeonsPanel() {
  const active = (gameState.dungeons ?? []).filter(dungeon => ['available', 'running'].includes(dungeon?.state));
  const running = active.filter(dungeon => dungeon?.state === 'running');
  const runningHtml = running.length ? running.map(dungeon => {
    const ratio = Math.max(0, Math.min(100, safeFiniteNumber(dungeon.progressMs, 0, 0) / Math.max(1, safeFiniteNumber(dungeon.durationMs, 1, 1)) * 100));
    return `<div class="compactCard"><b>${escapeHtml(dungeon.name)}</b><div class="bar"><div class="fill" style="width:${ratio}%"></div></div>進行 ${Math.floor(ratio)}%</div>`;
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
  const facility = (gameState.world.objects ?? []).find(o => o?.id === seal?.targetId);
  if (facility) return seal?.currentAction || `${CONFIG.facilities[facility.type]?.label ?? '施設'} (${facility.id})`;
  if (seal?.target?.reason) return seal?.currentAction || seal.target.reason;
  return seal?.currentAction || 'なし';
}
function stateLabel(state) { return ({ questing:'攻略参加中', arrivingFromSea:'海から到着中', choosingArrivalAction:'到着後の行動選択', movingToFacility:'施設へ移動中', usingFacility:'施設利用中', choosingHuntArea:'狩場選択', movingToHuntArea:'狩場へ移動中', hunting:'探索中', movingToMonster:'獲物へ移動中', fighting:'戦闘中', returningFromHunt:'帰宅中', choosingPostHuntFacility:'帰還後の行動選択', leavingToSea:'帰宅中', idle:'待機中', fallen:'倒れている', rescuing:'救助中', carryingFallenSeal:'搬送中', arriving:'海から到着中', movingToHuntExit:'狩場へ移動中', choosingFacility:'施設選択', leaving:'帰宅中' })[state] ?? state; }

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
  context.fillStyle = dungeon.state === 'running' ? '#7d5cff' : dungeon.state === 'completed' ? '#61e786' : '#2b2348';
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
  if (dungeon.state === 'running') {
    const ratio = Math.max(0, Math.min(1, safeFiniteNumber(dungeon.progressMs, 0, 0) / Math.max(1, safeFiniteNumber(dungeon.durationMs, 1, 1))));
    context.fillStyle = 'rgba(0,0,0,.55)';
    context.fillRect(-22, 24, 44, 6);
    context.fillStyle = '#9dfcff';
    context.fillRect(-22, 24, 44 * ratio, 6);
  }
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
  const ratio = Math.max(0, Math.min(100, safeFiniteNumber(dungeon.progressMs, 0, 0) / Math.max(1, safeFiniteNumber(dungeon.durationMs, 1, 1)) * 100));
  const participants = normalizeDungeonParticipantIds(dungeon.participantIds).map(p => escapeHtml(p.name || p.id)).join('、') || '未編成（開始時に自動選出）';
  const itemNames = (preview.itemIds ?? []).map(id => getItemDef(id)?.name ?? id).join(' / ') || 'なし';
  const canStart = canStartDungeon(dungeon);
  const startButton = dungeon.state === 'available' ? `<button data-dungeon-action="start" data-dungeon-id="${escapeHtml(dungeon.id)}">攻略開始</button>` : '';
  const progress = dungeon.state === 'running' ? `<div class="bar"><div class="fill" style="width:${ratio}%"></div></div>進行: ${Math.floor(ratio)}%<br>` : '';
  return `<div class="panel sealCard dungeonPanel"><b>🕳️ ${escapeHtml(dungeon.name)}</b><br>エリア: ${escapeHtml(area?.label ?? dungeon.areaId)}<br>状態: ${escapeHtml(dungeonStateLabel(dungeon.state))}<br>残り時間: ${Math.ceil(remaining / 1000)}秒<br>参加費: ${Math.floor(safeFiniteNumber(dungeon.recruitCost, 0, 0))}G<br>難易度: ${Math.floor(safeFiniteNumber(type?.difficulty, 0, 0))}<br>敵: ${escapeHtml((dungeon.enemyTypes ?? []).join(' / ') || '不明')}<br>報酬見込み: ${Math.floor(preview.g ?? 0)}G / EXP${Math.floor(preview.exp ?? 0)} / 知名度+${Math.floor(preview.knownness ?? 0)}<br>ドロップ候補: ${escapeHtml(itemNames)}<br>参加者: ${participants}<br>${progress}${canStart.ok ? '' : `<span class="warnText">${escapeHtml(canStart.reason)}</span><br>`}<div class="dungeonButtons">${startButton}<button data-dungeon-action="close">閉じる</button></div></div>`;
}

function dungeonStateLabel(state) { return ({ available: '発見済み', running: '攻略中', completed: '攻略完了', expired: '消滅' })[state] ?? String(state ?? ''); }
