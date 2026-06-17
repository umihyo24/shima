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
  drawPlacementPreview();
  drawObjects();
  drawMonsters();
  drawDungeons();
  drawSeals();
  renderFogOverlay(ctx);
  ctx.restore();
  ctx.save();
  ctx.scale(devicePixelRatioClamped(), devicePixelRatioClamped());
  drawMinimap();
  if (gameState.phase === CONFIG.phase.playing) renderNextGoalPanel(ctx);
  ctx.restore();
}


function fillRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function strokeRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.stroke();
}

function renderNextGoalPanel(context) {
  const panel = CONFIG.NEXT_GOAL_PANEL ?? {};
  const x = safeFiniteNumber(panel.x, 0, 0);
  const y = safeFiniteNumber(panel.y, 0, 0);
  const width = safeFiniteNumber(panel.width, 1, 1);
  const height = safeFiniteNumber(panel.height, 1, 1);
  const padding = safeFiniteNumber(panel.padding, 0, 0);
  const radius = safeFiniteNumber(panel.radius, 0, 0);
  const lineHeight = safeFiniteNumber(panel.lineHeight, 1, 1);
  const shadowOffsetX = safeFiniteNumber(panel.shadowOffsetX, 0, 0);
  const shadowOffsetY = safeFiniteNumber(panel.shadowOffsetY, 0, 0);
  const borderWidth = safeFiniteNumber(panel.borderWidth, 1, 0);
  const knownness = Math.floor(safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0));
  const nextUnlock = getNextFameUnlock();

  context.save();
  context.fillStyle = panel.shadowColor ?? 'rgba(0,0,0,.22)';
  fillRoundedRect(context, x + shadowOffsetX, y + shadowOffsetY, width, height, radius);
  context.fillStyle = panel.background ?? 'rgba(12,43,56,.82)';
  fillRoundedRect(context, x, y, width, height, radius);
  context.strokeStyle = panel.border ?? 'rgba(180,240,255,.72)';
  context.lineWidth = borderWidth;
  strokeRoundedRect(context, x + borderWidth / 2, y + borderWidth / 2, width - borderWidth, height - borderWidth, radius);

  context.textBaseline = 'top';
  context.font = panel.titleFont ?? '700 15px system-ui';
  context.fillStyle = panel.titleColor ?? '#fff8ba';
  context.fillText('次の目標', x + padding, y + padding);

  context.font = panel.bodyFont ?? '13px system-ui';
  if (gameState.oceanProgress?.safeRouteUnlocked !== true) {
    context.fillStyle = panel.textColor ?? '#f5fbff';
    context.fillText('深海ボスを討伐して第2の島へ', x + padding, y + padding + lineHeight);
    context.fillStyle = panel.accentColor ?? '#aef3ff';
    context.fillText('安全航路: 未開通', x + padding, y + padding + lineHeight * 2);
    context.restore();
    return;
  }

  if (!nextUnlock) {
    context.fillStyle = panel.textColor ?? '#f5fbff';
    context.fillText('すべての発見済み', x + padding, y + padding + lineHeight);
    context.fillText('島をさらに発展させよう', x + padding, y + padding + lineHeight * 2);
    context.restore();
    return;
  }

  const required = Math.floor(safeFiniteNumber(nextUnlock.requiredKnownness, knownness, 0));
  const remaining = Math.max(0, required - knownness);
  const name = getUnlockDisplayName(nextUnlock);
  const label = getUnlockTypeLabel(nextUnlock);
  context.fillStyle = panel.textColor ?? '#f5fbff';
  context.fillText(`知名度 ${knownness} / ${required}`, x + padding, y + padding + lineHeight);
  context.fillStyle = panel.accentColor ?? '#aef3ff';
  context.fillText(`あと${remaining}で「${name}」${label}`, x + padding, y + padding + lineHeight * 2);
  context.restore();
}

function drawWorld() {
  for (let y = 0; y < CONFIG.world.rows; y += 1) {
    for (let x = 0; x < CONFIG.world.cols; x += 1) {
      const wx = x * CONFIG.world.tile, wy = y * CONFIG.world.tile;
      const tile = getTile(x, y);
      ctx.fillStyle = tile?.terrain === CONFIG.tileState.terrainLand
        ? (isBuildableTile(x, y) ? CONFIG.render.buildableLand : CONFIG.render.blockedLand)
        : tile?.terrain === CONFIG.tileState.terrainDeepWater ? CONFIG.render.deepWater
          : tile?.terrain === CONFIG.tileState.terrainOutside ? CONFIG.render.outside : (CONFIG.render.shallowWater ?? CONFIG.render.water);
      if (tile?.terrain === CONFIG.tileState.terrainLand && ((isFirstIslandTile(x, y) && (x === CONFIG.world.islandX || y === CONFIG.world.islandY || x === CONFIG.world.islandX + CONFIG.world.islandW - 1 || y === CONFIG.world.islandY + CONFIG.world.islandH - 1)) || (isSecondIslandTile(x, y) && !isSecondIslandTile(x - 1, y)) || (isSecondIslandTile(x, y) && !isSecondIslandTile(x + 1, y)) || (isSecondIslandTile(x, y) && !isSecondIslandTile(x, y - 1)) || (isSecondIslandTile(x, y) && !isSecondIslandTile(x, y + 1)))) ctx.fillStyle = CONFIG.render.beach;
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
  drawLabel('深海危険域：深海のぬし', CONFIG.world.deepSeaX * CONFIG.world.tile + 8, CONFIG.world.deepSeaY * CONFIG.world.tile + 24, '#fff3a6');
  drawLabel('第2の島', CONFIG.world.secondIslandX * CONFIG.world.tile + 8, CONFIG.world.secondIslandY * CONFIG.world.tile + 24, '#123');
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


function isObjectVisibleByFog(object) {
  const w = clampInteger(object?.w, 1, CONFIG.world.cols, 1);
  const h = clampInteger(object?.h, 1, CONFIG.world.rows, 1);
  const ox = Math.trunc(safeFiniteNumber(object?.x, 0, 0));
  const oy = Math.trunc(safeFiniteNumber(object?.y, 0, 0));
  for (let y = oy; y < oy + h; y += 1) for (let x = ox; x < ox + w; x += 1) {
    if (isTileCurrentlyVisible(x, y) || isTileDiscovered(x, y)) return true;
  }
  return false;
}

function drawObjects() {
  for (const o of gameState.world.objects ?? []) {
    if (o?.isMoving === true || !isObjectVisibleByFog(o)) continue;
    if (o?.kind === 'facility') drawFacility(o); else drawDecoration(o);
  }
}

function drawFacility(o) {
  const x = o.x * CONFIG.world.tile, y = o.y * CONFIG.world.tile, w = o.w * CONFIG.world.tile, h = o.h * CONFIG.world.tile;
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[o?.type] ?? {};
  const rotation = getFacilityRotation(o);
  ctx.fillStyle = CONFIG.render.shadow; ctx.fillRect(x + 5, y + 7, w, h);
  drawImageOrFallback(ctx, cfg.assetKey ?? `cards.facility_neutral_${o.type}_idle`, x, y, w, h, () => {
    ctx.fillStyle = cfg.color ?? '#777'; ctx.fillRect(x + 5, y + 12, Math.max(8, w - 10), Math.max(8, h - 17));
    ctx.fillStyle = '#3a2115'; ctx.fillRect(x + Math.max(7, w * 0.28), y + h - Math.min(30, h * 0.44), Math.max(10, w * 0.44), Math.min(26, h * 0.34));
    if (o.type === 'bench') {
      ctx.fillStyle = '#7a4b2d'; ctx.fillRect(x + w * 0.16, y + h * 0.38, w * 0.68, h * 0.12);
      ctx.fillRect(x + w * 0.2, y + h * 0.54, w * 0.6, h * 0.12);
      ctx.fillStyle = '#5a321d'; ctx.fillRect(x + w * 0.22, y + h * 0.64, w * 0.08, h * 0.22);
      ctx.fillRect(x + w * 0.7, y + h * 0.64, w * 0.08, h * 0.22);
    } else if (o.type === 'observationDeck') {
      ctx.fillStyle = '#d8edf4'; ctx.fillRect(x + w * 0.22, y + h * 0.18, w * 0.56, h * 0.18);
      ctx.fillStyle = '#5d7d8b'; ctx.fillRect(x + w * 0.32, y + h * 0.36, w * 0.1, h * 0.42);
      ctx.fillRect(x + w * 0.58, y + h * 0.36, w * 0.1, h * 0.42);
      ctx.strokeStyle = '#264a5c'; ctx.lineWidth = Math.max(1, 2 / gameState.camera.zoom); ctx.strokeRect(x + w * 0.2, y + h * 0.16, w * 0.6, h * 0.22);
      ctx.fillStyle = '#fff4c0'; ctx.fillText('海', x + w * 0.43, y + h * 0.58);
    } else if (o.type === 'sealPlaza') {
      ctx.fillStyle = '#d4c79d'; ctx.fillRect(x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84);
      ctx.strokeStyle = 'rgba(90,75,45,.45)'; ctx.lineWidth = Math.max(1, 1 / gameState.camera.zoom);
      for (let px = 1; px < 3; px += 1) { ctx.beginPath(); ctx.moveTo(x + w * px / 3, y + h * 0.08); ctx.lineTo(x + w * px / 3, y + h * 0.92); ctx.stroke(); }
      for (let py = 1; py < 3; py += 1) { ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h * py / 3); ctx.lineTo(x + w * 0.92, y + h * py / 3); ctx.stroke(); }
      ctx.fillStyle = '#fff4c0'; ctx.fillText('広場', x + w * 0.34, y + h * 0.54);
    } else if (o.type === 'publicToilet') {
      ctx.fillStyle = '#e9fbff'; ctx.fillRect(x + w * 0.22, y + h * 0.28, w * 0.22, h * 0.4);
      ctx.fillStyle = '#bfefff'; ctx.fillRect(x + w * 0.56, y + h * 0.28, w * 0.22, h * 0.4);
      ctx.fillStyle = '#247088'; ctx.fillText('WC', x + w * 0.36, y + h * 0.82);
    } else if (o.type === 'manjuShop') {
      ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.32, Math.max(5, w * 0.16), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b4b5f'; ctx.fillText('まん', x + 6, y + h * 0.86);
    } else {
      ctx.fillStyle = '#fff4c0'; ctx.fillText(cfg.label ?? o.type, x + 12, y + 30);
    }
    ctx.fillStyle = '#fff8ba';
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.42);
    ctx.lineTo(w * 0.12, -h * 0.22);
    ctx.lineTo(-w * 0.12, -h * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, { rotation: rotation * Math.PI / 2 });
  const usable = isFacilityUsable(o);
  ctx.strokeStyle = usable ? '#5cff7d' : '#ff5a50'; ctx.lineWidth = 3 / gameState.camera.zoom; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  drawEntranceMarker(o, { connected: isEntranceConnectedToRoad(o), subtle: true });
  if (isLevelableFacility(o)) {
    const label = `Lv${getFacilityLevel(o)}`;
    ctx.font = '11px system-ui';
    const lw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,.58)'; ctx.fillRect(x + 4, y + 4, lw, 17);
    ctx.fillStyle = '#fff8ba'; ctx.fillText(label, x + 8, y + 17);
  }
}


function getFacilityFootprintEdgePoint(facility, inset = 0) {
  const dir = getEntranceDirectionVector(facility);
  const x = safeFiniteNumber(facility?.x, 0, 0) * CONFIG.world.tile;
  const y = safeFiniteNumber(facility?.y, 0, 0) * CONFIG.world.tile;
  const w = Math.max(1, safeFiniteNumber(facility?.w, CONFIG.placement.facilitySize, 1)) * CONFIG.world.tile;
  const h = Math.max(1, safeFiniteNumber(facility?.h, CONFIG.placement.facilitySize, 1)) * CONFIG.world.tile;
  if (dir.name === 'N') return { x: x + w / 2, y: y + inset };
  if (dir.name === 'E') return { x: x + w - inset, y: y + h / 2 };
  if (dir.name === 'S') return { x: x + w / 2, y: y + h - inset };
  return { x: x + inset, y: y + h / 2 };
}

function drawEntranceMarker(facility, options = {}) {
  if (!facility || facility?.kind !== 'facility') return;
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility?.type] ?? {};
  if (cfg.entranceRequired !== true && !cfg.entranceSide) return;
  const dir = getEntranceDirectionVector(facility);
  const connected = options?.connected === true;
  const subtle = options?.subtle === true;
  const color = connected ? (CONFIG.UI?.entranceConnectedColor ?? '#34e86b') : (CONFIG.UI?.entranceDisconnectedColor ?? '#ff4d4d');
  const edge = getFacilityFootprintEdgePoint(facility, subtle ? CONFIG.world.tile * 0.12 : 0);
  const arrowLength = CONFIG.world.tile * (subtle ? 0.28 : 0.42);
  const headSize = CONFIG.world.tile * (subtle ? 0.1 : 0.14);
  const startX = edge.x - dir.dx * arrowLength * (subtle ? 0.55 : 0.15);
  const startY = edge.y - dir.dy * arrowLength * (subtle ? 0.55 : 0.15);
  const endX = edge.x + dir.dx * arrowLength * (subtle ? 0.45 : 0.85);
  const endY = edge.y + dir.dy * arrowLength * (subtle ? 0.45 : 0.85);
  ctx.save();
  ctx.globalAlpha = subtle ? 0.86 : 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, (subtle ? 3 : 5) / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  const angle = Math.atan2(dir.dy, dir.dx);
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - Math.cos(angle - Math.PI / 6) * headSize, endY - Math.sin(angle - Math.PI / 6) * headSize);
  ctx.lineTo(endX - Math.cos(angle + Math.PI / 6) * headSize, endY - Math.sin(angle + Math.PI / 6) * headSize);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = subtle ? 'rgba(20,18,14,.55)' : 'rgba(20,18,14,.72)';
  const doorW = CONFIG.world.tile * (subtle ? 0.22 : 0.28);
  const doorH = CONFIG.world.tile * (subtle ? 0.12 : 0.16);
  ctx.translate(edge.x, edge.y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.fillRect(-doorW / 2, -doorH / 2, doorW, doorH);
  ctx.restore();
}

function drawEntranceAccessTile(tile, connected) {
  if (!tile || !getTile(tile.x, tile.y)) return;
  const inset = Math.max(2, CONFIG.world.tile * 0.08);
  ctx.save();
  ctx.fillStyle = connected ? (CONFIG.UI?.entranceAccessConnected ?? 'rgba(52,232,107,.42)') : (CONFIG.UI?.entranceAccessDisconnected ?? 'rgba(255,77,77,.42)');
  ctx.fillRect(tile.x * CONFIG.world.tile + inset, tile.y * CONFIG.world.tile + inset, CONFIG.world.tile - inset * 2, CONFIG.world.tile - inset * 2);
  ctx.strokeStyle = connected ? (CONFIG.UI?.entranceConnectedColor ?? '#34e86b') : (CONFIG.UI?.entranceDisconnectedColor ?? '#ff4d4d');
  ctx.lineWidth = Math.max(2, 3 / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  ctx.strokeRect(tile.x * CONFIG.world.tile + inset, tile.y * CONFIG.world.tile + inset, CONFIG.world.tile - inset * 2, CONFIG.world.tile - inset * 2);
  ctx.restore();
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

function getSealRenderSize(seal) {
  const settings = getEntityRenderConfig();
  const sizeClass = normalizeSealSizeClass(seal?.sizeClass);
  const classScale = safeFiniteNumber(settings.sealSizeClassScale?.[sizeClass], settings.sealSizeClassScale?.normal ?? 1, 0.1);
  return CONFIG.world.tile * safeFiniteNumber(settings.sealSpriteScale, 1.5, 0.1) * classScale;
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
  const spriteSize = getSealRenderSize(seal);
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
  drawSpriteFacing(context, seal.assetKey || (seal.type === 'visitor' ? assetKeyForVisitorProfile(seal.profileId) : 'seals.resident'), drawX, drawY, spriteSize, spriteSize, seal.facingOverride ?? seal.facing, (fallbackContext, fx, fy, width, height, options) => drawFallbackSeal(fallbackContext, seal, fx, fy, width, height, options));
  drawSealNameAndHp(context, seal, x, y, spriteSize);
}


function getMonsterCombatGroup(monster) {
  const radius = safeFiniteNumber(CONFIG.monster?.territory?.groupRadius, 120, 0);
  return (gameState.seals ?? []).filter(seal => seal && ['movingToMonster', 'fighting'].includes(seal.state) && (seal.targetId === monster?.id || distance(seal.x, seal.y, monster?.x, monster?.y) <= radius));
}

function drawMonsterTerritory(context, monster, x, y) {
  const states = CONFIG.monster?.states ?? {};
  const territory = CONFIG.monster?.territory ?? {};
  const visuals = CONFIG.monster?.visuals ?? {};
  const radius = safeFiniteNumber(territory.reactionRadius, 0, 0);
  if (radius <= 0 || monster?.state === states.idle) return;
  context.save();
  context.strokeStyle = monster?.state === states.engaged ? `rgba(255,108,77,${safeFiniteNumber(visuals.engagedLineAlpha, 0.36, 0)})` : `rgba(255,238,160,${safeFiniteNumber(visuals.territoryAlpha, 0.1, 0)})`;
  context.lineWidth = Math.max(1, 2 / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  context.setLineDash(monster?.state === states.engaged ? [] : [8, 8]);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawMonsterCombatLinks(context, monster, x, y) {
  const group = getMonsterCombatGroup(monster);
  if (group.length <= 0) return;
  const visuals = CONFIG.monster?.visuals ?? {};
  context.save();
  context.strokeStyle = `rgba(255,235,135,${safeFiniteNumber(visuals.engagedLineAlpha, 0.36, 0)})`;
  context.lineWidth = Math.max(1, 2 / Math.max(gameState.camera?.zoom ?? 1, 0.1));
  for (const seal of group) {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(safeFiniteNumber(seal?.x, x, 0), safeFiniteNumber(seal?.y, y, 0));
    context.stroke();
  }
  if (group.length > 1) {
    context.fillStyle = `rgba(255,221,96,${safeFiniteNumber(visuals.groupRingAlpha, 0.18, 0)})`;
    context.beginPath();
    context.arc(x, y, safeFiniteNumber(CONFIG.monster?.territory?.groupRadius, 120, 0) * 0.42, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMonsterStateDot(context, monster, x, y, spriteSize) {
  const states = CONFIG.monster?.states ?? {};
  const radius = safeFiniteNumber(CONFIG.monster?.visuals?.stateDotRadius, 3, 1);
  const color = monster?.state === states.engaged ? '#ff6c4d' : monster?.state === states.patrol ? '#ffe66b' : '#b9f3ff';
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.arc(x + spriteSize * 0.32, y - spriteSize * 0.26, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function isWorldPointVisibleByFog(x, y) {
  const grid = worldToGrid(x, y);
  return isTileCurrentlyVisible(grid.x, grid.y) || isTileDiscovered(grid.x, grid.y);
}

function drawMonster(context, monster) {
  if (!isWorldPointVisibleByFog(monster?.x, monster?.y)) return;
  const { x, y } = getEntityScreenPosition(monster);
  const spriteSize = getMonsterRenderSize() * (monster?.isGiant ? safeFiniteNumber(CONFIG.GIANT_ENEMY?.scale, 2.2, 0.1) : 1);
  const drawX = x - spriteSize / 2;
  const drawY = y - spriteSize / 2;
  drawMonsterTerritory(context, monster, x, y);
  drawMonsterCombatLinks(context, monster, x, y);
  drawEntityShadow(context, x, y, spriteSize, spriteSize, 'monster');
  drawSpriteFacing(context, monster.assetKey || 'monsters.crab', drawX, drawY, spriteSize, spriteSize, monster.facingOverride ?? monster.facing, (fallbackContext, fx, fy, width, height, options) => drawFallbackMonster(fallbackContext, monster, fx, fy, width, height, options));
  drawMonsterHp(context, monster, x, y, spriteSize);
  if (monster?.isGiant) { context.font = '700 13px system-ui'; context.textAlign = 'center'; context.fillStyle = 'rgba(0,0,0,.6)'; context.fillText(monster?.name ?? '巨大敵', x + 1, y - spriteSize / 2 - 13); context.fillStyle = '#fff3a6'; context.fillText(monster?.name ?? '巨大敵', x, y - spriteSize / 2 - 14); context.textAlign = 'start'; }
  drawMonsterStateDot(context, monster, x, y, spriteSize);
}

function drawMysteryShadow(context, monster) {
  const { x, y } = getEntityScreenPosition(monster);
  context.save();
  context.fillStyle = CONFIG.OCEAN_CHART.colors.mystery;
  context.beginPath();
  context.ellipse(x, y, CONFIG.world.tile * 0.35, CONFIG.world.tile * 0.2, 0, 0, Math.PI * 2);
  context.fill();
  context.font = '700 22px system-ui';
  context.textAlign = 'center';
  context.fillStyle = 'rgba(220,235,255,.7)';
  context.fillText('?', x, y - CONFIG.world.tile * 0.25);
  context.restore();
}


function drawExpeditionRangeOverlay(context) {
  if (gameState.ui?.activeManagementPanel !== 'expedition' || gameState.expedition?.active) return;
  const origin = typeof getActiveExpeditionOriginTile === 'function' ? getActiveExpeditionOriginTile() : { x: CONFIG.world.safeX, y: CONFIG.world.safeY };
  const range = safeFiniteNumber(CONFIG.OCEAN_EXPEDITION?.rangeTiles, 18, 1);
  context.save();
  context.fillStyle = 'rgba(120, 220, 255, .16)';
  context.strokeStyle = 'rgba(170, 245, 255, .42)';
  context.lineWidth = 1 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
  for (let y = 0; y < CONFIG.world.rows; y += 1) for (let x = 0; x < CONFIG.world.cols; x += 1) {
    if (distance(origin.x, origin.y, x, y) > range) continue;
    context.fillRect(x * CONFIG.world.tile, y * CONFIG.world.tile, CONFIG.world.tile, CONFIG.world.tile);
    context.strokeRect(x * CONFIG.world.tile, y * CONFIG.world.tile, CONFIG.world.tile, CONFIG.world.tile);
  }
  const destination = gameState.expedition?.destinationTile;
  if (destination) {
    context.strokeStyle = '#fff3a6';
    context.lineWidth = 3 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
    context.strokeRect(destination.x * CONFIG.world.tile + 4, destination.y * CONFIG.world.tile + 4, CONFIG.world.tile - 8, CONFIG.world.tile - 8);
  }
  context.restore();
}

function drawOceanLandmarks(context) {
  const progress = gameState.oceanProgress ?? {};
  context.save();
  context.textAlign = 'center';
  for (const boss of CONFIG.OCEAN_EXPEDITION?.bosses ?? []) {
    if (!(progress.discoveredBossIds ?? []).includes(boss.id)) continue;
    const p = gridToWorld(boss.x, boss.y);
    context.fillStyle = 'rgba(70, 20, 90, .75)';
    context.beginPath();
    context.arc(p.x, p.y, CONFIG.world.tile * .34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd1ff';
    context.font = '700 12px system-ui';
    context.fillText(boss.name, p.x, p.y - CONFIG.world.tile * .45);
  }
  for (const island of getIslandDefinitions()) {
    if (progress.lighthouses?.[island.id] !== true) continue;
    const p = gridToWorld(island.x + Math.floor(island.w / 2), island.y);
    context.fillStyle = '#fff3a6';
    context.font = '24px system-ui';
    context.fillText('灯', p.x, p.y);
  }
  context.restore();
}

function drawExpedition(context) {
  const expedition = gameState.expedition;
  if (!expedition?.active) return;
  context.save();
  context.fillStyle = '#fff3a6';
  context.strokeStyle = '#0a3348';
  context.lineWidth = 2 / Math.max(gameState.camera?.zoom ?? 1, 0.1);
  context.beginPath();
  context.arc(expedition.x, expedition.y, CONFIG.world.tile * 0.22, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawMonsters() {
  for (const monster of gameState.monsters ?? []) {
    if (!monster || monster.hp <= 0) continue;
    drawMonster(ctx, monster);
  }
  drawExpeditionRangeOverlay(ctx);
  drawOceanLandmarks(ctx);
  drawExpedition(ctx);
}

function drawSeals() {
  for (const seal of gameState.seals ?? []) {
    if (!seal || seal.state === 'expeditionRunning' || !isWorldPointVisibleByFog(seal.x, seal.y)) continue;
    drawSeal(ctx, seal);
  }
}

function drawPlacementPreview() {
  const edit = gameState.ui?.roadEdit;
  if (edit?.active) drawRoadRoutePreview(edit);
  else if (isFacilityMoveActive()) drawMovePlacementPreview();
  else {
    const gx = gameState.input?.mouseTile?.x ?? -1;
    const gy = gameState.input?.mouseTile?.y ?? -1;
    const tool = CONFIG.tools.find(t => t?.id === gameState.ui?.selectedTool) ?? null;
    if (gx >= 0 && gy >= 0 && tool && tool?.kind !== 'move') {
      if (tool?.kind === 'clear') drawClearPreview(gx, gy);
      else if (tool?.kind !== 'road' || getTile(gx, gy)) {
        const directionIndex = gameState.ui?.directionIndex ?? 0;
        const footprint = getRotatedFootprintSize(tool, directionIndex);
        const result = canPlaceAt(gx, gy, tool, directionIndex);
        ctx.fillStyle = result.ok ? CONFIG.render.valid : CONFIG.render.invalid;
        ctx.fillRect(gx * CONFIG.world.tile, gy * CONFIG.world.tile, footprint.w * CONFIG.world.tile, footprint.h * CONFIG.world.tile);
        if (tool?.kind === 'facility') {
          const previewFacility = { type: tool.id, kind: tool.kind, x: gx, y: gy, w: footprint.w, h: footprint.h, directionIndex };
          const entrance = getPlacementPreviewEntranceTile();
          const connected = isEntranceConnectedToRoad(previewFacility);
          if (entrance) drawEntranceAccessTile(entrance, connected);
          drawEntranceMarker(previewFacility, { connected, preview: true });
        }
      }
    }
  }
  const fb = gameState.ui?.placementFeedback;
  if (fb) drawLabel(fb.text, fb.x * CONFIG.world.tile, fb.y * CONFIG.world.tile - 8, fb.ok ? '#d8ffe0' : '#ffd6d6');
}

function drawMovePlacementPreview() {
  const edit = gameState.ui?.moveEdit;
  const facility = getMovingFacility();
  if (!edit?.active || !facility) return;
  const tool = getTool(facility.type);
  const gx = clampInteger(edit.previewX, 0, CONFIG.world.cols - 1, facility.x ?? 0);
  const gy = clampInteger(edit.previewY, 0, CONFIG.world.rows - 1, facility.y ?? 0);
  const directionIndex = clampInteger(edit.previewDirection, 0, CONFIG.directions.length - 1, facility.directionIndex ?? 0);
  const footprint = getRotatedFootprintSize(tool, directionIndex);
  const result = canPlaceAt(gx, gy, tool, directionIndex);
  ctx.fillStyle = result.ok ? CONFIG.render.valid : CONFIG.render.invalid;
  ctx.fillRect(gx * CONFIG.world.tile, gy * CONFIG.world.tile, footprint.w * CONFIG.world.tile, footprint.h * CONFIG.world.tile);
  const previewFacility = { ...facility, isMoving: false, x: gx, y: gy, w: footprint.w, h: footprint.h, directionIndex };
  const entrance = getFacilityEntranceTile(previewFacility);
  const connected = isEntranceConnectedToRoad(previewFacility);
  if (entrance) drawEntranceAccessTile(entrance, connected);
  drawEntranceMarker(previewFacility, { connected, preview: true });
  drawLabel(result.ok ? '移動先をクリック' : result.reason, gx * CONFIG.world.tile, gy * CONFIG.world.tile - 8, result.ok ? '#d8ffe0' : '#ffd6d6');
}

function drawRoadRoutePreview(edit) {
  const style = CONFIG.render ?? {};
  const validColor = edit?.mode === 'delete' ? style.roadPreviewDelete : style.roadPreviewValid;
  const invalidColor = edit?.mode === 'delete' ? style.roadPreviewDeleteInvalid : style.roadPreviewInvalid;
  drawRoadRouteTileList(edit?.invalidTiles, invalidColor);
  drawRoadRouteTileList(edit?.validTiles, validColor);
  const start = edit?.startTile;
  if (start && getTile(start.x, start.y)) {
    const inset = Math.max(3, CONFIG.world.tile * 0.12);
    ctx.save();
    ctx.strokeStyle = style.roadPreviewStart ?? '#fff';
    ctx.lineWidth = Math.max(2, 3 / Math.max(gameState.camera?.zoom ?? 1, 0.1));
    ctx.strokeRect(start.x * CONFIG.world.tile + inset, start.y * CONFIG.world.tile + inset, CONFIG.world.tile - inset * 2, CONFIG.world.tile - inset * 2);
    ctx.restore();
  }
}

function drawRoadRouteTileList(tiles, color) {
  if (!Array.isArray(tiles) || !color) return;
  const inset = Math.max(2, CONFIG.world.tile * 0.08);
  ctx.fillStyle = color;
  for (const tile of tiles) {
    if (!tile || !getTile(tile.x, tile.y)) continue;
    ctx.fillRect(tile.x * CONFIG.world.tile + inset, tile.y * CONFIG.world.tile + inset, CONFIG.world.tile - inset * 2, CONFIG.world.tile - inset * 2);
  }
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
  const bodyColor = ['fallen', 'downed', 'beingCarried'].includes(seal?.state) ? '#cbd2d8' : (seal?.type === 'resident' ? '#fff7ec' : '#d8f4ff');
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


function renderFogOverlay(context) {
  const fog = gameState.worldFog;
  if (!fog?.tiles) return;
  const visual = CONFIG.OCEAN_CHART_VISUAL ?? {};
  context.save();
  for (let y = 0; y < CONFIG.world.rows; y += 1) for (let x = 0; x < CONFIG.world.cols; x += 1) {
    if (isTileCurrentlyVisible(x, y)) {
      if (safeFiniteNumber(visual.currentVisibleAlpha, 0, 0) <= 0) continue;
      context.fillStyle = CONFIG.OCEAN_CHART.colors.currentVision;
    } else if (isTileDiscovered(x, y)) {
      if (safeFiniteNumber(visual.discoveredAlpha, 0, 0) <= 0) continue;
      context.fillStyle = visual.discoveredTint ?? CONFIG.OCEAN_CHART.colors.discovered;
    } else {
      context.fillStyle = visual.unknownColor ?? CONFIG.OCEAN_CHART.colors.unknown;
    }
    context.fillRect(x * CONFIG.world.tile, y * CONFIG.world.tile, CONFIG.world.tile, CONFIG.world.tile);
  }
  context.restore();
}

function renderMinimapFog(context, x, y, sx, sy) {
  const visual = CONFIG.OCEAN_CHART_VISUAL ?? {};
  context.save();
  for (let ty = 0; ty < CONFIG.world.rows; ty += 1) for (let tx = 0; tx < CONFIG.world.cols; tx += 1) {
    if (isTileCurrentlyVisible(tx, ty)) context.fillStyle = visual.minimapVisibleTint ?? 'rgba(170,235,255,0)';
    else if (isTileDiscovered(tx, ty)) context.fillStyle = visual.minimapDiscoveredTint ?? 'rgba(0,0,0,.42)';
    else context.fillStyle = visual.minimapUnknownColor ?? '#000';
    context.fillRect(x + tx * CONFIG.world.tile * sx, y + ty * CONFIG.world.tile * sy, CONFIG.world.tile * sx, CONFIG.world.tile * sy);
  }
  context.restore();
}

function drawMinimap() {
  const w = CONFIG.render.minimapW, h = CONFIG.render.minimapH, x = 16;
  const bottomBase = 72;
  const drawerOffset = gameState.ui?.activeBuildCategory ? 252 : 0;
  const y = Math.max(118, canvas.clientHeight - h - bottomBase - drawerOffset);
  ctx.fillStyle = 'rgba(5,18,28,.82)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(x, y, w, h);
  const sx = w / (CONFIG.world.cols * CONFIG.world.tile), sy = h / (CONFIG.world.rows * CONFIG.world.tile);
  for (let ty = 0; ty < CONFIG.world.rows; ty += 1) for (let tx = 0; tx < CONFIG.world.cols; tx += 1) {
    const tile = getTile(tx, ty);
    if (tile?.terrain === CONFIG.tileState.terrainDeepWater) ctx.fillStyle = CONFIG.render.deepWater;
    else if (tile?.terrain === CONFIG.tileState.terrainOutside) ctx.fillStyle = CONFIG.render.outside;
    else if (tile?.terrain === CONFIG.tileState.terrainLand) ctx.fillStyle = isBuildableTile(tx, ty) ? CONFIG.render.buildableLand : CONFIG.render.blockedLand;
    else continue;
    ctx.fillRect(x + tx * CONFIG.world.tile * sx, y + ty * CONFIG.world.tile * sy, CONFIG.world.tile * sx, CONFIG.world.tile * sy);
  }
  renderMinimapFog(ctx, x, y, sx, sy);
  ctx.fillStyle = '#ff3b30'; for (const m of gameState.monsters ?? []) if (m && isWorldPointVisibleByFog(m.x, m.y)) ctx.fillRect(x + m.x * sx - 2, y + m.y * sy - 2, 4, 4);
  ctx.fillStyle = '#fff'; for (const s of gameState.seals ?? []) if (s && isWorldPointVisibleByFog(s.x, s.y)) ctx.fillRect(x + s.x * sx - 2, y + s.y * sy - 2, 4, 4);
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
      renderTopHud();
      renderSpeedHud();
      if (!shouldUpdatePanel && gameState.ui?.inspector?.open) renderInspector();
    }
    if (shouldUpdatePanel) {
      renderBuildBar();
      renderBuildDrawer();
      renderManagementButtons();
      renderManagementPanel();
      renderInspector();
      renderGiantHuntPanel();
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

function renderTopHud() {
  if (!statsEl) return;
  const knownness = safeFiniteNumber(gameState.village?.knownness, CONFIG.knownness.initial, 0);
  const nextGoal = getNextKnownnessGoal();
  const saveText = gameState.save?.statusText || '未保存';
  const selectedTool = CONFIG.tools.find(tool => tool?.id === gameState.ui?.selectedTool) ?? null;
  const direction = getDirectionSideName(gameState.ui?.directionIndex ?? 2);
  statsEl.innerHTML = `<div class="hudRow"><b>${Math.floor(gameState.player?.g ?? 0)} G</b><span class="dateLine">${gameState.calendar?.year ?? 1}年 ${gameState.calendar?.month ?? 1}月 ${gameState.calendar?.week ?? 1}w</span><span>知名度 ${Math.floor(knownness)} / ${Math.floor(nextGoal)}</span><span>今月の狩猟 ${gameState.stats?.monthlyHunts ?? 0}</span></div><div class="hudRow"><span>ツール: ${escapeHtml(selectedTool?.label ?? 'なし')}</span><span>入口: ${escapeHtml(direction)}</span><span>保存: ${escapeHtml(saveText)}</span></div>${renderLogHud()}`;
}

function renderHUD() { renderTopHud(); }

function renderLogHud() {
  const logs = (gameState.logs ?? []).slice(0, 4);
  if (!logs.length && !gameState.ui?.message) return '';
  const lines = logs.length ? logs : [gameState.ui.message];
  return `<div class="hudLog">${lines.map(line => `<div class="hudMessage">${escapeHtml(line)}</div>`).join('')}</div>`;
}

function renderSpeedHud() {
  const speedStatus = document.getElementById('speedStatus');
  if (speedStatus) speedStatus.textContent = formatSpeedLabel(gameState.time?.timeScale);
}

function renderBuildBar() {
  for (const button of bottomTabBarEl?.querySelectorAll('button[data-build-toggle]') ?? []) {
    button.classList.toggle('active', button.dataset?.buildToggle === (gameState.ui?.activeBuildCategory ?? null));
  }
}
function renderBottomTabBar() { renderBuildBar(); }
function renderBottomTabs() { renderBuildBar(); }

function getBottomPanelContentElement() {
  return managementPanelEl?.querySelector?.('.management-panel-content') ?? bottomPanelEl?.querySelector?.('.bottom-panel-content') ?? null;
}

function getBottomPanelScrollElement(tabId = gameState.ui?.activeManagementPanel ?? gameState.ui?.renderedBottomPanelTab ?? null) {
  if (tabId === 'people' || tabId === 'seals') return managementPanelEl?.querySelector?.('.people-table-wrap') ?? bottomPanelEl?.querySelector?.('.people-table-wrap') ?? getBottomPanelContentElement();
  return getBottomPanelContentElement();
}

function getBottomPanelHeaderElement() {
  return managementPanelEl?.querySelector?.('.management-panel-header') ?? bottomPanelEl?.querySelector?.('.bottom-panel-header') ?? null;
}

function saveBottomPanelScrollPosition(tabId = gameState.ui?.activeManagementPanel ?? gameState.ui?.renderedBottomPanelTab ?? null) {
  const scrollElement = getBottomPanelScrollElement(tabId);
  if (!scrollElement || !tabId || !gameState.ui) return;
  gameState.ui.panelScrollTopByTab = gameState.ui.panelScrollTopByTab ?? {};
  gameState.ui.panelScrollTopByTab[tabId] = scrollElement.scrollTop;
}

function restoreBottomPanelScrollPosition(tabId = gameState.ui?.activeManagementPanel ?? null) {
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

function getManagementPanelContentElement() {
  return managementPanelEl?.querySelector?.('.management-panel-content') ?? null;
}

function getManagementPanelHeaderElement() {
  return managementPanelEl?.querySelector?.('.management-panel-header') ?? null;
}

function renderBuildDrawer() {
  if (!bottomPanelEl) return;
  const active = normalizeBuildCategory(gameState.ui?.activeBuildCategory, null);
  bottomPanelEl.hidden = !active;
  if (!active) {
    bottomPanelEl.innerHTML = '';
    return;
  }
  if (gameState.ui) gameState.ui.buildCategory = active;
  bottomPanelEl.innerHTML = `<div class="build-drawer-inner">
    <div class="build-drawer-tools">
      <div class="build-drawer-title"><b>${escapeHtml(getBuildCategoryLabel(active))}</b><button data-action="closeBuild" class="subtle">閉じる</button></div>
      ${renderBuildItemList()}
    </div>
    <div class="build-tool-info">${renderBuildToolInfo()}${renderSelectedFacilityInfo()}</div>
  </div>`;
}

function renderBottomPanel() { renderBuildDrawer(); }

function renderBuildToolInfo() { return renderSelectedBuildInfo(); }

function renderManagementButtons() {
  for (const button of managementButtonsEl?.querySelectorAll('button[data-management-panel]') ?? []) {
    button.classList.toggle('active', button.dataset?.managementPanel === (gameState.ui?.activeManagementPanel ?? null));
  }
}

function getManagementPanelMeta(panelId) {
  const meta = {
    people: { title: '人物', hint: '行をクリックすると詳細インスペクタを表示します' },
    dungeons: { title: 'ダンジョン', hint: '選択中ダンジョンと攻略状況' },
    expedition: { title: '遠征', hint: '海図を広げるチーム遠征' },
    progress: { title: '発展', hint: '知名度と解放状況' }
  };
  return meta[panelId] ?? { title: '', hint: '' };
}

function renderManagementPanel() {
  if (!managementPanelEl) return;
  const previousPanel = gameState.ui?.renderedBottomPanelTab ?? null;
  saveBottomPanelScrollPosition(previousPanel);
  const active = gameState.ui?.activeManagementPanel ?? null;
  managementPanelEl.hidden = !active;
  if (!active) {
    managementPanelEl.innerHTML = '';
    if (gameState.ui) gameState.ui.renderedBottomPanelTab = null;
    return;
  }
  const panelChanged = previousPanel !== active;
  if (!getManagementPanelContentElement() || !getManagementPanelHeaderElement() || panelChanged) {
    managementPanelEl.innerHTML = '<div class="management-panel-header"></div><div class="management-panel-content"></div>';
  }
  if (gameState.ui) gameState.ui.renderedBottomPanelTab = active;
  const meta = getManagementPanelMeta(active);
  const headerElement = getManagementPanelHeaderElement();
  if (headerElement) headerElement.innerHTML = `<div><h2>${escapeHtml(meta.title)}</h2>${meta.hint ? `<div class="panelHint">${escapeHtml(meta.hint)}</div>` : ''}</div><button data-action="closeManagement" class="subtle">閉じる</button>`;
  const renderers = { people: renderPeoplePanel, dungeons: renderDungeonsPanel, expedition: renderExpeditionPanel, progress: renderProgressPanel };
  const contentElement = getManagementPanelContentElement();
  if (contentElement) {
    contentElement.className = `management-panel-content${active === 'people' ? ' people-panel-content' : ''}`;
    contentElement.innerHTML = renderers[active]?.() ?? '';
  }
  restoreBottomPanelScrollPosition(active);
}

function panelHeader(title, hint = '') {
  return `<div class="bottom-panel-header"><div><h2>${escapeHtml(title)}</h2>${hint ? `<div class="panelHint">${escapeHtml(hint)}</div>` : ''}</div><button data-action="close-panel" class="subtle">閉じる</button></div>`;
}


function getBuildCategoryLabel(categoryId) {
  return BUILD_CATEGORIES.find(category => category?.id === categoryId)?.label ?? categoryId ?? '';
}

function formatBuildCost(tool) {
  if (!tool) return '-';
  if (tool.kind === 'clear') return `${getClearingCost()}G`;
  const cost = tool.cost;
  if (typeof cost === 'number') return cost > 0 ? `${Math.floor(cost)}G` : '無料';
  return cost ? String(cost) : '無料';
}

function renderBuildMetaRow(label, value) {
  const text = value === undefined || value === null || value === '' ? '-' : value;
  return `<div class="build-info-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(text)}</b></div>`;
}

function renderBuildCategoryTabs() {
  const activeCategory = normalizeBuildCategory(gameState.ui?.buildCategory);
  return `<div class="build-category-tabs" role="tablist" aria-label="建設カテゴリ">
    ${BUILD_CATEGORIES.map(category => `<button type="button" role="tab" data-build-category="${escapeHtml(category.id)}" class="${category.id === activeCategory ? 'active' : ''}" aria-selected="${category.id === activeCategory ? 'true' : 'false'}">${escapeHtml(`${category.icon ? `${category.icon} ` : ''}${category.label}`)}</button>`).join('')}
  </div>`;
}

function renderBuildItemList() {
  const activeCategory = normalizeBuildCategory(gameState.ui?.buildCategory);
  const category = BUILD_CATEGORIES.find(item => item?.id === activeCategory) ?? BUILD_CATEGORIES[0] ?? null;
  const buttons = (category?.toolIds ?? []).map(toolId => {
    if (toolId === 'rotate') return `<button class="toolButton managementAction" data-action="rotate"><span class="toolName">↻ 回転</span><span class="toolMeta">選択中の施設入口、または配置プレビューを回転します。</span></button>`;
    const tool = getBuildToolDef(toolId);
    if (!tool) return '';
    const size = `${tool.width ?? tool.w ?? 1}x${tool.height ?? tool.h ?? 1}`;
    return `<button class="toolButton buildItemButton" data-tool="${escapeHtml(tool.id)}">
      <span class="toolName">${escapeHtml(tool.label ?? tool.name ?? tool.id)}</span>
      <span class="toolMeta">${escapeHtml(size)} / ${escapeHtml(formatBuildCost(tool))}</span>
    </button>`;
  }).join('');
  return `<div class="build-item-list" aria-label="${escapeHtml(category?.label ?? '')}の建設アイテム">${buttons}</div>`;
}

function renderSelectedBuildInfo() {
  const selected = getBuildToolDef(gameState.ui?.selectedTool);
  if (!selected) return `<div class="compactCard build-info-card empty"><b>建設物を選択してください</b></div>`;
  if (selected.id === 'move') {
    return `<div class="compactCard build-info-card"><div class="build-info-title"><b>移動</b><span>management</span></div><div class="build-info-section"><b>使い方</b><p>既存施設を選択して移動します。Rで向きを変更できます。右クリック/Escapeでキャンセル。</p></div><div class="buildActions"><button data-action="rotate">R 回転</button><button data-action="clearTool" class="subtle">ツール解除</button></div></div>`;
  }

  const footprint = getRotatedFootprintSize(selected, gameState.ui?.directionIndex ?? 0);
  const direction = selected.kind === 'facility' && selected.hasDirection !== false
    ? getDirectionSideName(getFacilityEntranceDirectionIndex({ type: selected.id, kind: selected.kind, x: 0, y: 0, w: footprint.w, h: footprint.h, directionIndex: gameState.ui?.directionIndex ?? 0 }))
    : '-';
  const rows = [
    renderBuildMetaRow('カテゴリ', getBuildCategoryLabel(getBuildCategoryForTool(selected))),
    renderBuildMetaRow('サイズ', `${footprint.w}x${footprint.h}`),
    renderBuildMetaRow('コスト', formatBuildCost(selected)),
    renderBuildMetaRow('入口方向', direction),
    renderBuildMetaRow('道路接続', selected.requiresRoadEntrance ? '必要' : '不要'),
    ...(selected.id === 'publicToilet' || isLifeFacility({ kind: 'facility', type: selected.id }) ? [renderBuildMetaRow('収入', 'なし')] : [])
  ].join('');
  return `<div class="compactCard build-info-card">
    <div class="build-info-title"><b>${escapeHtml(selected.name ?? selected.label ?? selected.id)}</b><span>${escapeHtml(selected.kind ?? '')}</span></div>
    <div class="build-info-grid">${rows}</div>
    <div class="build-info-section"><b>効果</b><p>${escapeHtml(getBuildToolEffectText(selected.id) || '-')}</p></div>
    <div class="build-info-section"><b>レベル</b><p>${escapeHtml(selected.levelText || '-')}</p></div>
    <div class="build-info-section"><b>配置メモ</b><p>${escapeHtml(selected.notes || '-')}</p></div>
    <div class="buildActions"><button data-action="rotate">R 回転</button><button data-action="clearTool" class="subtle">ツール解除</button></div>
  </div>`;
}

function getSelectedFacility() {
  const id = gameState.ui?.selectedFacilityId ?? null;
  return id ? (gameState.world?.objects ?? []).find(object => object?.id === id && object?.kind === 'facility') ?? null : null;
}

function renderSelectedFacilityInfo() {
  const facility = getSelectedFacility();
  if (!facility) return '';
  const cfg = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility.type] ?? {};
  const name = cfg.label ?? facility.type;
  const requiresRoad = facilityRequiresRoadConnection(facility);
  const direction = requiresRoad ? getDirectionSideName(getFacilityEntranceDirectionIndex(facility)) : '-';
  const connected = requiresRoad ? isEntranceConnectedToRoad(facility) : true;
  const levelText = isLevelableFacility(facility) ? `<br>Lv${getFacilityLevel(facility)} (${escapeHtml(getFacilityLevelProgressText(facility))})` : '';
  const effectText = isLifeFacility(facility) ? `<br>効果: 好感度+${Math.floor(getLifeFacilityFavorGain(facility))} / HP徐々に回復 ${Math.floor(getFacilityRecoveryPerSecond(facility))}/秒` : '';
  return `<div class="compactCard selected-facility-card"><b>マップ上の選択施設</b><br>${escapeHtml(name)} (${facility.w}x${facility.h})${levelText}${effectText}<br>入口: ${escapeHtml(direction)}<br>道路接続: ${requiresRoad ? (connected ? 'あり' : 'なし') : '不要'}<br>座標: ${facility.x}, ${facility.y}</div>`;
}

function renderBuildPanel() {
  const activeCategory = normalizeBuildCategory(gameState.ui?.buildCategory);
  if (gameState.ui && gameState.ui.buildCategory !== activeCategory) gameState.ui.buildCategory = activeCategory;
  return `<div class="build-panel-layout">
    <div class="build-panel-left">
      ${renderBuildCategoryTabs()}
      ${renderBuildItemList()}
    </div>
    <div class="build-panel-right">
      ${renderSelectedBuildInfo()}
      ${renderSelectedFacilityInfo()}
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
    <div class="people-list-hint">行をクリックすると詳細インスペクタを表示します</div>
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

function getDungeonRequirementText(def) {
  if (!def) return '';
  const parts = [];
  const knownness = safeFiniteNumber(gameState.village?.knownness, 0, 0);
  const requiredKnownness = safeFiniteNumber(def?.knownnessRequired, 0, 0);
  if (knownness < requiredKnownness) parts.push(`知名度 ${Math.floor(knownness)}/${Math.floor(requiredKnownness)}`);
  if (def?.previousDungeonId) {
    const previous = getDungeonDefById(def.previousDungeonId);
    parts.push(`${previous?.name ?? def.previousDungeonId} Lv${previous?.level ?? ''} ${getDungeonClearCount(def.previousDungeonId)}/${Math.floor(safeFiniteNumber(def.previousClearCountRequired, 0, 0))}回クリア`);
  }
  return parts.join(' / ') || '条件達成待ち';
}

function renderPermanentDungeonList() {
  const unlockedIds = new Set(getUnlockedDungeonDefs().map(def => def.id));
  return (CONFIG.DUNGEONS?.definitions ?? []).map(def => {
    const dungeon = (gameState.dungeons ?? []).find(item => item?.dungeonDefId === def.id) ?? null;
    const unlocked = unlockedIds.has(def.id);
    const clearCount = getDungeonClearCount(def.id);
    const claimed = gameState.dungeonProgress?.firstClearRewardsClaimed?.[def.id] === true;
    const itemNames = (def.firstClearUnlockItems ?? []).map(id => getItemDef(id)?.name ?? id).join(' / ') || 'なし';
    const status = unlocked ? `${escapeHtml(dungeonStateLabel(dungeon?.state ?? 'available'))}` : `未解放: ${escapeHtml(getDungeonRequirementText(def))}`;
    const button = unlocked && dungeon?.state === 'available' ? `<button data-dungeon-action="start" data-dungeon-id="${escapeHtml(dungeon.id)}"${getDungeonStartError(dungeon) ? ' disabled' : ''}>攻略開始</button>` : '';
    const select = unlocked && dungeon ? `<button data-dungeon-action="select" data-dungeon-id="${escapeHtml(dungeon.id)}">詳細</button>` : '';
    return `<div class="compactCard dungeon-list-card ${unlocked ? 'unlocked' : 'locked'}"><b>${escapeHtml(def.name)} Lv${Math.floor(safeFiniteNumber(def.level, 1, 1))}</b><br>${status}<br>クリア: ${clearCount}回 / 初回商品: ${escapeHtml(itemNames)}（${claimed ? '受取済み' : '未受取'}）<div class="dungeonButtons">${button}${select}</div></div>`;
  }).join('');
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
  return `<div class="dungeon-panel-grid">
      ${renderSelectedDungeonDetail()}
      <div class="dungeon-running-list">
        <div class="compactCard"><b>常設ダンジョン</b><br>攻略可能: ${getUnlockedDungeonDefs().length} / 全${(CONFIG.DUNGEONS?.definitions ?? []).length}<br>選択中: ${escapeHtml(getDungeonById(gameState.ui?.selectedDungeonId)?.name ?? 'なし')}</div>
        ${renderPermanentDungeonList()}
        ${runningHtml}
      </div>
    </div>`;
}

function renderFacilityProgressList() {
  const facilities = (gameState.world?.objects ?? []).filter(o => o?.kind === 'facility');
  if (facilities.length <= 0) return '対象施設なし';
  return facilities.map(facility => {
    const name = (CONFIG.facilities ?? CONFIG.FACILITIES)?.[facility.type]?.label ?? facility.type;
    const levelText = isLevelableFacility(facility) ? ` Lv${getFacilityLevel(facility)} / 使用 ${getFacilityUseCount(facility)}（次:${escapeHtml(getFacilityLevelProgressText(facility))}）` : '';
    const shopText = renderFacilityShopItemSummary(facility);
    const entranceText = facilityRequiresRoadConnection(facility) ? getDirectionSideName(getFacilityEntranceDirectionIndex(facility)) : '-';
    const roadText = facilityRequiresRoadConnection(facility) ? (isEntranceConnectedToRoad(facility) ? 'Yes' : 'No') : '不要';
    const effectText = facility?.type === 'inn' ? ` / 料金${Math.floor(getFacilityPrice(facility))}G / HP回復なし / 累計${Math.floor(safeFiniteNumber(facility.totalIncome, 0, 0))}G` : (isLifeFacility(facility) ? ` / 効果 好感度+${Math.floor(getLifeFacilityFavorGain(facility))} HP徐々に回復${Math.floor(getFacilityRecoveryPerSecond(facility))}/秒` : ` / 料金${Math.floor(getFacilityPrice(facility))}G / 食事回復${Math.floor(getFacilityHealAmount(facility))} / 累計${Math.floor(safeFiniteNumber(facility.totalIncome, 0, 0))}G`);
    return `${escapeHtml(name)}${levelText} / Entrance: ${escapeHtml(entranceText)} / Road Connected: ${roadText}${effectText}${shopText}`;
  }).join('<br>');
}

function renderFacilityShopItemSummary(facility) {
  const items = getShopItemCandidatesForFacility(facility);
  if (items.length <= 0) return '';
  const selectedSeal = (gameState.seals ?? []).find(seal => seal?.id === gameState.ui?.selectedSealId) ?? null;
  const itemText = items.map(item => {
    const affordable = selectedSeal ? safeFiniteNumber(selectedSeal?.gearBudget, 0, 0) >= safeFiniteNumber(item?.price, 0, 0) : false;
    const upgrade = selectedSeal ? isEquipmentUpgradeForSeal(selectedSeal, item) : false;
    const status = selectedSeal ? (affordable && upgrade ? '購入可' : (upgrade ? '予算不足' : '更新なし')) : '選択なし';
    return `${escapeHtml(item.name)} ${Math.floor(safeFiniteNumber(item.price, 0, 0))}G(${status})`;
  }).join('、');
  return ` / 商品: ${itemText}`;
}


function renderExpeditionPanel() {
  const expedition = createExpeditionState(gameState.expedition);
  const members = chooseExpeditionMembers().map(seal => escapeHtml(seal?.name ?? 'あざらし')).join(' / ') || '待機中のあざらしなし';
  const dest = expedition.destinationTile ? `${expedition.destinationTile.x}, ${expedition.destinationTile.y}` : '海図上のタイルをクリック';
  const progress = createOceanProgress(gameState.oceanProgress);
  const regions = (CONFIG.OCEAN_EXPEDITION?.regions ?? []).map(region => `${progress.discoveredRegionIds.includes(region.id) ? '✅' : '⬛'} ${escapeHtml(region.name)}`).join('<br>');
  const bosses = (CONFIG.OCEAN_EXPEDITION?.bosses ?? []).map(boss => `${progress.discoveredBossIds.includes(boss.id) ? '🦀' : '？'} ${escapeHtml(boss.name)}`).join('<br>');
  const islandCards = getIslandDefinitions().filter(island => island.id !== CONFIG.OCEAN_CHART.islandIds.start).map(island => {
    const found = gameState.discoveredIslands?.[island.id] === true;
    const active = progress.activeIslandIds.includes(island.id);
    const project = progress.lighthouseProjects?.[island.id];
    const building = project && project.complete !== true;
    const button = found && !active && !building ? `<button data-expedition-action="lighthouse" data-island-id="${escapeHtml(island.id)}">航路灯台プロジェクト</button>` : '';
    const projectText = building ? `<br>灯台建設中: ${Math.ceil(safeFiniteNumber(project.remainingMs, 0, 0) / 1000)}秒` : '';
    return `<div class="compactCard"><b>${island.id === CONFIG.OCEAN_CHART.islandIds.second ? '第2の島' : escapeHtml(island.id)}</b><br>状態: ${active ? 'Active Area' : (found ? 'Discovered Area' : 'Unknown Area')}${projectText}<div class="buildActions">${button}</div></div>`;
  }).join('');
  return `<div class="expedition-panel-grid">
    <div class="compactCard"><b>Expedition A</b><br>Members: ${members}<br>目的地: ${escapeHtml(dest)}<br>海図上に水色の到達範囲を表示中。<div class="buildActions"><button data-expedition-action="launch"${expedition.active || !expedition.destinationTile ? ' disabled' : ''}>遠征を開始</button></div></div>
    <div class="compactCard"><b>海域発見</b><br>${regions || '未設定'}</div>
    <div class="compactCard"><b>海の大物</b><br>${bosses || '未設定'}<br><small>発見後、狩猟パネルから討伐すると航路が広がります。</small></div>
    ${islandCards}
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
  const catalog = (gameState.shopCatalog?.unlockedItemIds ?? []).map(id => getItemDef(id)?.name ?? id).join('、') || 'なし';
  return `<div class="progress-panel-grid">
      <div class="compactCard"><b>知名度</b><br>${Math.floor(knownness)} / ${Math.floor(nextGoal)}<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></div></div>次の目標: ${Math.floor(nextGoal)}</div>
      <div class="compactCard"><b>次の訪問者</b><br>${nextUnlock ? `${escapeHtml(nextUnlock.name)}（${Math.floor(safeFiniteNumber(nextUnlock.unlockedAtKnownness, 0, 0))}）` : 'すべて解放済み'}</div>
      <div class="compactCard"><b>しきい値</b><div class="thresholdList">${thresholds}</div></div>
      <div class="compactCard progress-wide-card"><b>解放済み訪問者</b><br>${unlocked}</div>
      <div class="compactCard"><b>月次サマリー</b><br>${escapeHtml(monthly)}</div>
      <div class="compactCard progress-wide-card"><b>解放済み商品</b><br>${escapeHtml(catalog)}</div>
      <div class="compactCard progress-wide-card"><b>施設レベル</b><br>${renderFacilityProgressList()}</div>
      <div class="compactCard"><b>最近の出来事</b><div class="log compact-recent-log">${(gameState.logs ?? []).slice(0, 4).map(l => `・${escapeHtml(l)}`).join('<br>') || 'なし'}</div></div>
    </div>`;
}


function getInspectorElement() { return document.getElementById('inspectorPanel'); }

function renderInspector() {
  const element = getInspectorElement();
  if (!element) return;
  const inspector = gameState.ui?.inspector ?? { open: false, type: null, id: null };
  if (!inspector.open || !inspector.type || !inspector.id) {
    element.hidden = true;
    element.innerHTML = '';
    return;
  }
  if (inspector.type === 'facility') {
    const facility = getFacilityById(inspector.id);
    if (!facility) {
      clearFacilitySelection();
      element.hidden = true;
      element.innerHTML = '';
      return;
    }
    element.hidden = false;
    element.innerHTML = renderFacilityInspector(facility);
    return;
  }
  if (inspector.type === 'seal') {
    const seal = getSealById(inspector.id);
    if (!seal) {
      closeInspector();
      element.hidden = true;
      element.innerHTML = '';
      return;
    }
    element.hidden = false;
    element.innerHTML = renderSealInspector(seal);
    return;
  }
  element.hidden = false;
  element.innerHTML = `<div class="inspectorHeader"><b>インスペクタ</b><button data-action="closeInspector" class="subtle">閉じる</button></div><div class="mutedText">この対象の詳細表示は未対応です。</div>`;
}


function renderFacilityInspector(facility) {
  const def = getFacilityDefinition(facility?.type) ?? {};
  const name = def.name ?? def.label ?? facility?.type ?? '不明な施設';
  const category = def.category ?? getTool(facility?.type)?.category ?? facility?.kind ?? 'facility';
  const effect = def.effectText ?? getTool(facility?.type)?.effectText ?? '効果情報はありません。';
  const progress = ensureFacilityProgress(facility?.type);
  const size = `${Math.max(1, safeFiniteNumber(facility?.w, def.w ?? 1, 1))}x${Math.max(1, safeFiniteNumber(facility?.h, def.h ?? 1, 1))}`;
  const status = formatFacilityStatus(facility);
  const labels = CONFIG.inspector?.buttonLabels ?? { move: '移動', rotate: '回転', delete: '削除' };
  return `<div class="inspectorHeader"><div><div class="inspectorKicker">${escapeHtml(category)}</div><h2>${escapeHtml(name)}</h2></div><button data-action="closeInspector" class="subtle">閉じる</button></div>
    <section><h3>概要</h3><div class="inspectorInfoGrid"><span>種類</span><b>${escapeHtml(facility?.type ?? '-')}</b><span>サイズ</span><b>${escapeHtml(size)}</b><span>状態</span><b>${escapeHtml(status)}</b><span>共有利用</span><b>${Math.floor(safeFiniteNumber(progress.totalUses, 0, 0))}</b></div><p class="mutedText">${escapeHtml(effect)}</p></section>
    ${renderFacilityProgressInspectorSection(facility)}
    ${renderFacilityShopGoodsInspectorSection(facility)}
    <div class="buildActions"><button data-action="moveFacility">${escapeHtml(labels.move)}</button><button data-action="rotateFacility">${escapeHtml(labels.rotate)}</button><button data-action="deleteFacility" class="subtle">${escapeHtml(labels.delete)}</button></div>`;
}

function formatFacilityStatus(facility) {
  if (!facility) return '不明';
  const users = (gameState.seals ?? []).filter(seal => seal?.targetId === facility.id || seal?.targetFacilityId === facility.id).length;
  return users > 0 ? `${users}匹が利用/移動中` : '待機中';
}

function renderFacilityProgressInspectorSection(facility) {
  const def = getFacilityDefinition(facility?.type) ?? {};
  const progress = ensureFacilityProgress(facility?.type);
  if (!isLevelableFacility(facility)) {
    return `<section><h3>効果</h3><div class="inspectorInfoGrid"><span>レベル</span><b>固定効果</b><span>容量</span><b>${escapeHtml(def.capacity ?? (def.useSlots?.length ?? '-'))}</b><span>利用</span><b>${Math.floor(safeFiniteNumber(progress.totalUses, 0, 0))}</b></div><p class="mutedText">${escapeHtml(def.notes ?? 'レベルなし')}</p></section>`;
  }
  const threshold = getNextFacilityLevelThreshold(facility);
  const next = Number.isFinite(threshold) ? `${Math.floor(safeFiniteNumber(progress.totalUses, 0, 0))}/${threshold}` : 'Max Level';
  const quality = 1 + Math.max(0, getFacilityLevel(facility) - 1) * safeFiniteNumber(CONFIG.FACILITY_LEVELS?.healingMultiplierPerLevel, 0, 0);
  const recoveryLabel = facility?.type === 'inn' ? 'HPなし' : (isLifeFacility(facility) ? `${Math.ceil(getFacilityRecoveryPerSecond(facility))}/秒` : Math.ceil(getFacilityHealAmount(facility)));
  return `<section><h3>共有レベル</h3><div class="inspectorInfoGrid"><span>Lv</span><b>${getFacilityLevel(facility)}</b><span>次</span><b>${escapeHtml(next)}</b><span>料金</span><b>${Math.floor(getFacilityPrice(facility))}G</b><span>品質</span><b>x${quality.toFixed(2)}</b><span>回復</span><b>${escapeHtml(recoveryLabel)}</b><span>収益倍率</span><b>x${getFacilityIncomeMultiplier(facility).toFixed(2)}</b></div></section>`;
}

function renderFacilityShopGoodsInspectorSection(facility) {
  const soldTypes = CONFIG.EQUIPMENT?.SHOP_ITEM_TYPES?.[facility?.type] ?? [];
  if (!soldTypes.length) return '';
  const items = getUnlockedShopItemsForFacility(facility);
  const rows = items.length ? items.map(item => `<li><b>${escapeHtml(item?.name ?? item?.id ?? '不明')}</b> ${Math.floor(safeFiniteNumber(item?.price, 0, 0))}G ${escapeHtml(formatItemStats(item))}</li>`).join('') : '<li>解放済み商品なし</li>';
  return `<section><h3>販売商品</h3><div class="mutedText">商品解放型</div><ul class="facilityGoodsList">${rows}</ul></section>`;
}

function formatItemStats(item) {
  const parts = [];
  if (safeFiniteNumber(item?.attackBonus, 0, 0)) parts.push(`攻+${item.attackBonus}`);
  if (safeFiniteNumber(item?.defenseBonus, 0, 0)) parts.push(`防+${item.defenseBonus}`);
  if (safeFiniteNumber(item?.hpBonus, 0, 0)) parts.push(`HP+${item.hpBonus}`);
  if (safeFiniteNumber(item?.favorBonus, 0, 0)) parts.push(`好感+${item.favorBonus}`);
  return parts.join(' / ');
}

function renderSealInspector(seal) {
  const stats = getSealEffectiveStats(seal);
  const maxHp = Math.max(1, safeFiniteNumber(stats.maxHp, seal?.maxHp ?? CONFIG.seal.maxHp, 1));
  const hp = clampNumber(safeFiniteNumber(seal?.hp, 0, 0), 0, maxHp, 0);
  const hpRate = Math.max(0, Math.min(100, hp / maxHp * 100));
  const typeLabel = seal?.type === 'resident' ? '住民' : '訪問者';
  const icon = seal?.type === 'resident' ? '🦭' : '🌊🦭';
  const stay = seal?.type === 'visitor' ? `<div class="inspectorInfoGrid"><span>滞在</span><b>${formatStayTime(seal)}</b><span>訪問狩猟</span><b>${Math.floor(safeFiniteNumber(seal?.huntsThisVisit, 0, 0))}</b><span>訪問施設</span><b>${Math.floor(safeFiniteNumber(seal?.facilitiesUsedThisVisit, 0, 0))}</b><span>帰宅希望</span><b>${seal?.wantsToLeave ? 'あり' : 'なし'}</b></div>` : '';
  const targetText = formatSealTarget(seal) || 'なし';
  const recoveryText = formatRecoverySource(seal);
  return `<div class="inspectorHeader"><div><div class="inspectorKicker">${escapeHtml(typeLabel)}</div><h2>${escapeHtml(seal?.name ?? '不明')}</h2></div><button data-action="closeInspector" class="subtle">閉じる</button></div>
    <div class="sealInspectorTop"><div class="sealInspectorIcon" aria-hidden="true">${icon}</div><div><div class="sealInspectorLevel">Lv ${Math.floor(safeFiniteNumber(seal?.level, 1, 1))} / ${escapeHtml(formatSealState(seal))}</div><div class="hpText">HP ${Math.ceil(hp)} / ${Math.ceil(maxHp)}</div><div class="bar"><div class="fill" style="width:${hpRate}%"></div></div></div></div>
    <section><h3>ステータス</h3><div class="inspectorInfoGrid">
      <span>好感度</span><b>${Math.floor(safeFiniteNumber(seal?.favor, 0, 0))}</b><span>所持G</span><b>${Math.floor(safeFiniteNumber(seal?.carriedG, 0, 0))}</b><span>装備予算</span><b>${Math.floor(safeFiniteNumber(seal?.gearBudget, 0, 0))}</b><span>戦力</span><b>${Math.floor(getSealPowerScore(seal))}</b><span>攻撃</span><b>${Math.floor(stats.attack)}</b><span>防御</span><b>${Math.floor(stats.defense)}</b><span>最大HP</span><b>${Math.ceil(stats.maxHp)}</b><span>EXP</span><b>${Math.floor(safeFiniteNumber(seal?.exp, 0, 0))}</b>
    </div></section>
    <section><h3>装備</h3>${renderInspectorEquipment(seal)}</section>
    <section><h3>行動</h3><div class="inspectorInfoGrid"><span>現在</span><b>${escapeHtml(targetText)}</b><span>回復元</span><b>${escapeHtml(recoveryText)}</b></div>${stay}</section>`;
}

function renderInspectorEquipment(seal) {
  return `<div class="inspectorInfoGrid"><span>武器</span><b>${formatEquipmentName(seal?.equipment?.weapon)}</b><span>防具</span><b>${formatEquipmentName(seal?.equipment?.armor)}</b><span>アクセ</span><b>${formatEquipmentName(seal?.equipment?.accessory)}</b></div>`;
}

function getSealPowerScore(seal) {
  const stats = getSealEffectiveStats(seal);
  return safeFiniteNumber(stats.attack, 0, 0) * 2 + safeFiniteNumber(stats.defense, 0, 0) * 1.5 + safeFiniteNumber(stats.maxHp, 0, 0) * 0.25 + safeFiniteNumber(seal?.level, 1, 1) * 3;
}

function formatSealState(seal) { return stateLabel(seal?.state ?? 'idle') || '不明'; }
function formatRecoverySource(seal) {
  const source = String(seal?.recoverySource ?? '');
  const labels = { downed: 'ダウン中の自然回復', carried: '搬送救助', 'fallback-rest': '空き地/道路休憩', 'inn-prep': '宿屋の旅支度（HPなし）', restaurant: '食堂の食事', manjuShop: 'まんじゅう', bench: 'ベンチ休憩', observationDeck: '展望台休憩', sealPlaza: '広場休憩' };
  return labels[source] ?? (source || 'なし');
}

function formatEquipmentName(itemId) {
  if (!itemId) return 'なし';
  return escapeHtml(getItemDef(itemId)?.name ?? '不明');
}

function renderSelectedSealDetail() {
  const selected = (gameState.seals ?? []).find(seal => seal?.id === gameState.ui?.selectedSealId) ?? null;
  return selected ? renderSelectedSealPanel(selected) : '<div class="compactCard">選択中のアザラシはありません。</div>';
}

function renderSelectedDungeonDetail() {
  return renderDungeonPanel() || '<div class="compactCard">選択中のダンジョンはありません。</div>';
}

function renderSelectedSealPanel(seal) {
  const stats = getSealEffectiveStats(seal);
  const hpMax = safeFiniteNumber(stats.maxHp, seal?.maxHp ?? CONFIG.seal.maxHp, 1);
  const targetText = formatSealTarget(seal);
  const stay = seal?.type === 'visitor' ? `<br>滞在: ${Math.floor(safeFiniteNumber(seal.visitTimerMs, 0, 0) / 1000)}秒 / 最短${Math.floor(safeFiniteNumber(seal.minStayMs, 0, 0) / 1000)}秒 / 最長${Math.floor(safeFiniteNumber(seal.maxStayMs, 0, 0) / 1000)}秒<br>訪問狩猟/施設: ${seal.huntsThisVisit ?? 0}/${seal.facilitiesUsedThisVisit ?? 0} / ${seal.wantsToLeave ? '帰りたい' : '滞在中'}` : '';
  return `<div class="compactCard selectedSealCard"><b>${escapeHtml(seal.name)}</b>（${seal.type === 'resident' ? '住民' : '訪問者'}）<br>性格: ${escapeHtml(getPersonalityConfig(seal)?.label ?? seal.personality)}<br>HP ${Math.ceil(safeFiniteNumber(seal.hp, 0, 0))} / ${Math.ceil(hpMax)}<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, safeFiniteNumber(seal.hp, 0, 0) / hpMax * 100))}%"></div></div>所持G: ${Math.floor(safeFiniteNumber(seal.carriedG, 0, 0))}<br>装備予算: ${Math.floor(safeFiniteNumber(seal.gearBudget, 0, 0))}<br>Lv: ${seal.level} / EXP: ${Math.floor(safeFiniteNumber(seal.exp, 0, 0))}<br>好感度: ${Math.floor(safeFiniteNumber(seal.favor, 0, 0))}<br>状態: ${escapeHtml(stateLabel(seal.state))}<br>回復元: ${escapeHtml(formatRecoverySource(seal))}<br>行動/目標: ${escapeHtml(targetText)}${stay}<hr>武器: ${equipmentText(seal, 'weapon')}<br>防具: ${equipmentText(seal, 'armor')}<br>アクセ: ${equipmentText(seal, 'accessory')}<br>有効攻撃: ${Math.floor(stats.attack)} / 有効防御: ${Math.floor(stats.defense)} / 有効最大HP: ${Math.ceil(stats.maxHp)}<div class="buildActions"><button data-action="closeSeal" class="subtle">詳細を閉じる</button></div></div>`;
}

function clearContextSelectionIfInvalid() {
  const ui = gameState.ui ?? {};
  let changed = false;
  if (ui.selectedSealId && !(gameState.seals ?? []).some(seal => seal?.id === ui.selectedSealId)) { ui.selectedSealId = null; changed = true; }
  if (ui.inspector?.open && ui.inspector?.type === 'facility' && !getFacilityById(ui.inspector?.id)) { ui.inspector = { type: null, id: null, open: false }; ui.facilityInspectorOpen = false; changed = true; }
  if (ui.inspector?.open && ui.inspector?.type === 'seal' && !getSealById(ui.inspector?.id)) { ui.inspector = { type: null, id: null, open: false }; changed = true; }
  if (ui.selectedDungeonId && !getDungeonById(ui.selectedDungeonId)) { ui.selectedDungeonId = null; changed = true; }
  if (ui.selectedFacilityId && !(gameState.world?.objects ?? []).some(object => object?.id === ui.selectedFacilityId && object?.kind === 'facility')) { ui.selectedFacilityId = null; changed = true; }
  if (ui.selectedTool && !CONFIG.tools.some(tool => tool?.id === ui.selectedTool)) { ui.selectedTool = null; changed = true; }
  if (ui.selectedPersonRosterId?.startsWith?.('seal:') && !getSealById(ui.selectedPersonRosterId.slice('seal:'.length))) { ui.selectedPersonRosterId = null; changed = true; }
  if (ui.selectedPersonRosterId?.startsWith?.('profile:') && !getVisitorProfileById(ui.selectedPersonRosterId.slice('profile:'.length))) { ui.selectedPersonRosterId = null; changed = true; }
  if (ui.activeManagementPanel === 'seals') { ui.activeManagementPanel = 'people'; changed = true; }
  if (ui.activeManagementPanel && !MANAGEMENT_PANELS.some(panel => panel.id === ui.activeManagementPanel)) { ui.activeManagementPanel = null; changed = true; }
  if (ui.activeBuildCategory) { const normalized = normalizeBuildCategory(ui.activeBuildCategory, null); if (normalized !== ui.activeBuildCategory) { ui.activeBuildCategory = normalized; changed = true; } }
  if (ui.buildCategory !== undefined) { const normalizedBuildCategory = normalizeBuildCategory(ui.buildCategory); if (normalizedBuildCategory !== ui.buildCategory) { ui.buildCategory = normalizedBuildCategory; changed = true; } }
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
  if (facility) return seal?.currentAction || `${(CONFIG.facilities ?? CONFIG.FACILITIES)[facility.type]?.label ?? '施設'} (${facility.id})`;
  if (seal?.target?.reason) return seal?.currentAction || seal.target.reason;
  return seal?.currentAction || 'なし';
}
function stateLabel(state) { return ({ movingToDungeon:'遠征集合中', waitingAtDungeon:'入口で待機中', expeditionRunning:'遠征中', returningFromDungeon:'遠征帰還中', questing:'攻略参加中', arrivingFromSea:'海から到着中', choosingArrivalAction:'到着後の行動選択', movingToFacility:'施設へ移動中', usingFacility:'施設利用中', choosingHuntArea:'狩場選択', movingToHuntArea:'狩場へ移動中', hunting:'狩猟中', movingToMonster:'獲物へ移動中', fighting:'戦闘中', returningFromHunt:'帰宅中', choosingPostHuntFacility:'帰還後の行動選択', leavingToSea:'帰宅中', idle:'待機中', fallen:'倒れている', downed:'ダウン中', rescuing:'救助中', carryingFallenSeal:'搬送中', beingCarried:'搬送されている', resting:'休憩中', arriving:'海から到着中', movingToHuntExit:'狩場へ移動中', choosingFacility:'施設選択', leaving:'帰宅中' })[state] ?? state; }

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
  context.font = `${12 / Math.max(gameState.camera?.zoom ?? 1, 0.1)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const stateText = dungeonStateLabel(dungeon.state);
  const labelWidth = Math.min(96, Math.max(48, context.measureText(stateText).width + 12));
  context.fillStyle = 'rgba(8, 22, 32, .78)';
  context.fillRect(-labelWidth / 2, -43, labelWidth, 18);
  context.fillStyle = '#fff7d1';
  context.fillText(stateText, 0, -34);
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

function renderDungeonPanel() {
  const dungeon = getDungeonById(gameState.ui?.selectedDungeonId);
  if (!dungeon) return '';
  return `<div class="compactCard sealCard dungeonPanel">${renderDungeonSummary(dungeon)}<div class="dungeonDetailScroll">${renderDungeonRouteCompact(dungeon)}${renderDungeonLog(dungeon)}${renderDungeonRewardSummary(dungeon)}${renderDungeonExtraDetails(dungeon)}</div></div>`;
}

function drawDungeonPanel() { return renderDungeonPanel(); }

function renderDungeonSummary(dungeon) {
  const area = getDungeonAreaDef(dungeon?.areaId);
  const levelDef = getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level);
  const preview = dungeon?.rewardPreview ?? getDungeonRewardPreview(dungeon);
  const participants = renderDungeonParticipantStatusText(dungeon) || '未編成（開始時に自動選出）';
  const itemNames = (preview?.itemIds ?? []).map(id => getItemDef(id)?.name ?? id).join(' / ') || 'なし';
  const current = dungeon?.nodes?.[dungeon?.currentNodeIndex];
  const currentText = current ? `${CONFIG.dungeon?.nodeLabels?.[current.type] ?? current.type}` : dungeonStateLabel(dungeon?.state);
  const clearCount = getDungeonClearCount(dungeon?.dungeonDefId ?? getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level)?.id);
  const partyPower = getPartyPower(dungeon?.participantIds);
  const powerText = partyPower > 0 ? `${Math.floor(partyPower)} / 推奨${Math.floor(getDungeonRecommendedPower(dungeon))}` : `推奨${Math.floor(getDungeonRecommendedPower(dungeon))}`;
  const rewardText = `${Math.floor(preview?.g ?? 0)}G / EXP${Math.floor(preview?.exp ?? 0)} / 知名度+${Math.floor(preview?.knownness ?? 0)}`;
  const remainingText = dungeon?.state === 'available' ? '期限なし' : '—';
  return `<div class="dungeonSummary">
    <div class="dungeonSummaryLeft">
      <div class="dungeonTitle">🕳️ ${escapeHtml(dungeon?.name ?? 'ダンジョン')} Lv${Math.floor(safeFiniteNumber(dungeon?.level, levelDef?.level ?? 1, 1))}</div>
      <div class="dungeonSummaryGrid">
        <span>エリア</span><b>${escapeHtml(area?.label ?? dungeon?.areaId ?? '不明')}</b>
        <span>状態</span><b>${escapeHtml(dungeonStateLabel(dungeon?.state))}</b>
        <span>常設</span><b>${escapeHtml(remainingText)}</b>
        <span>現在</span><b>${escapeHtml(currentText)}</b>
        <span>戦力</span><b>${escapeHtml(powerText)}</b>
        <span>クリア</span><b>${clearCount}回</b>
      </div>
    </div>
    <div class="dungeonSummaryRight">
      <div class="dungeonSummaryGrid">
        <span>参加費</span><b>${Math.floor(safeFiniteNumber(dungeon?.recruitCost, 0, 0))}G</b>
        <span>報酬</span><b>${escapeHtml(rewardText)}</b>
        <span>初回商品</span><b>${escapeHtml(itemNames)}</b>
        <span>参加者</span><b>${participants}</b>
      </div>
      ${renderDungeonActionButtons(dungeon)}
    </div>
  </div>`;
}

function renderDungeonActionButtons(dungeon) {
  const error = getDungeonStartError(dungeon);
  const canShowStart = dungeon?.state === 'available';
  const warning = canShowStart && error ? `<div class="warnText dungeonStartWarning">${escapeHtml(error)}</div>` : '';
  const startButton = canShowStart ? `<button data-dungeon-action="start" data-dungeon-id="${escapeHtml(dungeon?.id)}"${error ? ' disabled' : ''}>攻略開始</button>` : '';
  return `<div class="dungeonActions">${warning}<div class="dungeonButtons">${startButton}<button data-dungeon-action="close">閉じる</button></div></div>`;
}

function renderDungeonRouteCompact(dungeon) {
  const nodes = Array.isArray(dungeon?.nodes) ? dungeon.nodes : [];
  if (nodes.length <= 0) return '<div class="dungeonRouteTitle">遠征ルート</div><div class="dungeonRoute dungeonRouteCompact"><span class="mutedText">開始後に表示されます。</span></div>';
  const participantNames = getVisibleDungeonParticipants(dungeon).map(p => p.name || getSealById(p.sealId)?.name || p.id).join(' / ');
  const html = nodes.map((node, index) => {
    const classes = ['dungeonNode'];
    if (node?.resolved) classes.push('done');
    if (index === dungeon?.currentNodeIndex && ['assembling', 'running'].includes(dungeon?.state)) classes.push('current');
    const marker = node?.resolved ? '✓' : (index === dungeon?.currentNodeIndex ? '●' : '○');
    const names = index === dungeon?.currentNodeIndex && participantNames ? `<small>${escapeHtml(participantNames)}</small>` : '';
    return `<div class="${classes.join(' ')}"><span>${marker}</span>${escapeHtml(CONFIG.dungeon?.nodeLabels?.[node?.type] ?? node?.type ?? '?')}${names}</div>`;
  }).join('');
  return `<div class="dungeonRouteTitle">${escapeHtml(CONFIG.dungeon?.labels?.routeTitle ?? '遠征ルート')}</div><div class="dungeonRoute dungeonRouteCompact">${html}</div>`;
}

function renderDungeonRoute(dungeon) { return renderDungeonRouteCompact(dungeon); }

function renderDungeonLog(dungeon) {
  const logs = normalizeDungeonLog(dungeon?.expeditionLog).map(text => `<li>${escapeHtml(text)}</li>`).join('') || '<li>開始するとあざらしの行動が記録されます。</li>';
  return `<div class="dungeonLog"><b>${escapeHtml(CONFIG.dungeon?.labels?.logTitle ?? '遠征ログ')}</b><ul>${logs}</ul></div>`;
}

function renderDungeonExtraDetails(dungeon) {
  const area = getDungeonAreaDef(dungeon?.areaId);
  const clearCount = getDungeonClearCount(dungeon?.dungeonDefId ?? getDungeonLevelDef(dungeon?.typeId ?? dungeon?.type, dungeon?.level)?.id);
  return `<div class="dungeonExtraDetails"><b>詳細</b><br>エリア説明: ${escapeHtml(area?.label ?? dungeon?.areaId ?? '不明')} / クリア回数: ${clearCount}</div>`;
}

function renderDungeonRewardSummary(dungeon) {
  if (!['returning', 'completed'].includes(dungeon?.state)) return '';
  const reward = normalizeDungeonReward(dungeon?.reward);
  return `<div class="dungeonReward"><b>${escapeHtml(CONFIG.dungeon?.labels?.completedReward ?? '獲得報酬')}</b>: ${Math.floor(reward.g)}G / EXP${Math.floor(reward.exp)} / 知名度+${Math.floor(reward.knownness)}</div>`;
}

function dungeonStateLabel(state) { return (CONFIG.dungeon?.stateLabels ?? {})[state] ?? String(state ?? ''); }


function renderGiantHuntPanel() {
  const element = getInspectorElement();
  if (!element || gameState.ui?.giantHuntOpen !== true) return;
  const enemy = getGiantEnemyById(gameState.ui?.giantHuntEnemyId);
  if (!enemy) { closeGiantHunt(); return; }
  const participants = getGiantHuntParticipants(enemy);
  const totalPower = participants.reduce((sum, seal) => sum + getSealCombatPower(seal), 0);
  const enemyPower = safeFiniteNumber(enemy.power, enemy.attack, 0);
  const successText = participants.length <= 0 ? '参加可能なアザラシがいません' : totalPower >= enemyPower ? '討伐できそうです' : '戦力不足かもしれません';
  const rows = participants.map(seal => `<li>${escapeHtml(seal?.name ?? '不明')} Lv.${clampInteger(seal?.level, 1, 999, 1)} / 戦力 ${Math.floor(getSealCombatPower(seal))}</li>`).join('') || '<li>参加可能なアザラシがいません</li>';
  element.hidden = false;
  element.innerHTML = `<div class="inspectorHeader"><div><div class="inspectorKicker">Giant Hunt</div><h2>${escapeHtml(enemy?.name ?? '巨大敵')}</h2></div><button data-action="closeGiantHunt" class="subtle">閉じる</button></div>
    <section><h3>敵情報</h3><div class="inspectorInfoGrid"><span>Lv</span><b>${clampInteger(enemy?.level, 1, 999, 1)}</b><span>HP</span><b>${Math.ceil(safeFiniteNumber(enemy?.hp, 0, 0))}/${Math.ceil(safeFiniteNumber(enemy?.maxHp, 1, 1))}</b><span>戦力</span><b>${Math.floor(enemyPower)}</b><span>推奨</span><b>${Math.floor(enemyPower)}</b><span>報酬</span><b>${Math.floor(safeFiniteNumber(enemy?.rewardGold, 0, 0))}G / 知名度+${Math.floor(safeFiniteNumber(enemy?.rewardFame, CONFIG.GIANT_ENEMY?.rewardFame, 0))}</b></div></section>
    <section><p class="compactNote">通常時、アザラシはボスへ自分から向かいません。討伐開始で選抜メンバーだけが向かいます。</p></section>
    <section><h3>選抜メンバー</h3><ul class="compactList">${rows}</ul><div class="inspectorInfoGrid"><span>合計戦力</span><b>${Math.floor(totalPower)}</b><span>見込み</span><b>${escapeHtml(successText)}</b></div></section>
    <div class="inspectorActions"><button data-action="startGiantHunt" data-giant-enemy-id="${escapeHtml(enemy.id)}" ${participants.length <= 0 ? 'disabled' : ''}>討伐開始</button><button data-action="closeGiantHunt" class="subtle">閉じる</button></div>`;
}
