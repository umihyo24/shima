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
  drawGates();
  drawObjects();
  drawMonsters();
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
  drawOpenCorridors();
  drawExpansionBoundary();
  drawLabel('島エリア（緑=建設可 / 濃緑=未開拓）', CONFIG.world.islandX * CONFIG.world.tile + 10, CONFIG.world.islandY * CONFIG.world.tile + 24, '#123');
  drawLabel('外の冒険エリア：coast（カニ出現）', CONFIG.world.coastX * CONFIG.world.tile + 10, CONFIG.world.coastY * CONFIG.world.tile + 24, '#e8fbff');
  const safe = gridToWorld(CONFIG.world.safeX, CONFIG.world.safeY); drawFlag(safe.x, safe.y);
}

function drawOpenCorridors() {
  ctx.save();
  ctx.strokeStyle = CONFIG.render.corridor;
  ctx.lineWidth = CONFIG.world.tile * (CONFIG.map.corridorWidth * 2 + 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of CONFIG.map.protectedCorridors ?? []) {
    const start = gridToWorld(line.from?.x, line.from?.y);
    const end = gridToWorld(line.to?.x, line.to?.y);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
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


function drawGates() {
  const entry = gameState.gates?.entryGate;
  if (entry) drawGateMarker(gatePointToWorld(entry), '入口', '#ffe27a');
  for (const gate of gameState.gates?.huntGates ?? []) {
    drawGateMarker(gatePointToWorld(gate?.village), '狩猟道標', '#9df7ff');
    drawGateMarker(gatePointToWorld(gate?.outside), gate?.areaId ?? '外', '#7aff9d');
  }
}

function drawGateMarker(point, label, color) {
  if (!point) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 3 / gameState.camera.zoom;
  ctx.beginPath();
  ctx.moveTo(point.x, point.y - 18);
  ctx.lineTo(point.x + 16, point.y + 12);
  ctx.lineTo(point.x - 16, point.y + 12);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  drawLabel(label, point.x - 22, point.y - 24, color);
  ctx.restore();
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
    drawSpriteFacing(ctx, seal.assetKey || (seal.type === 'visitor' ? assetKeyForVisitorProfile(seal.profileId) : 'seals.resident'), seal.x - w / 2, seal.y - h / 2, w, h, seal.facing, (context, x, y, width, height, options) => drawFallbackSeal(context, seal, x, y, width, height, options));
    drawHpBar(seal.x - 22, seal.y - 29, 44, seal.hp / seal.maxHp, '#5fe45e');
    drawLabel(seal?.type === 'resident' ? '住' : '訪', seal.x - 10, seal.y - 38, seal?.type === 'resident' ? '#ffd98a' : '#aef3ff');
  }
}

function drawPlacementPreview() {
  const gx = gameState.input.mouseTile.x, gy = gameState.input.mouseTile.y;
  const tool = getTool(gameState.ui.selectedTool);
  if (gx < 0 || gy < 0) return;
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

function drawFlag(x, y) { ctx.fillStyle = '#73451d'; ctx.fillRect(x - 3, y - 28, 6, 38); ctx.fillStyle = '#2a7bd1'; ctx.fillRect(x + 3, y - 28, 24, 16); ctx.fillStyle = '#ffd24d'; ctx.fillText('S', x + 9, y - 16); }
function drawHpBar(x, y, w, ratio, color) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio ?? 0)) * w, 6); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeRect(x, y, w, 6); }
function drawLabel(text, x, y, color) { ctx.font = CONFIG.render.bigFont; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = color; ctx.fillText(text, x, y); }

function drawMinimap() {
  const w = CONFIG.render.minimapW, h = CONFIG.render.minimapH, x = 14, y = canvas.clientHeight - h - 154;
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

function updateHud() {
  const saveText = gameState.save?.statusText || '未保存';
  const lastSaved = formatSaveTime(gameState.save?.lastSavedAt);
  const visitors = (gameState.seals ?? []).filter(s => s?.type === 'visitor');
  const nextVisitor = Math.max(0, CONFIG.visitor.spawnInterval - safeFiniteNumber(gameState.timers?.visitorSpawn, 0, 0));
  const resident = getResidentSeal();
  const tategoto = getVisitorProfileById(CONFIG.knownness.unlockTargetId);
  const activeNames = visitors.map(v => `${escapeHtml(v?.name)}(好感度${Math.floor(safeFiniteNumber(v?.favor, 0, 0))})`).join('、') || 'なし';
  statsEl.innerHTML = `<b>${Math.floor(gameState.player.g)} G</b><br>住民: ${escapeHtml(resident?.name ?? gameState.residentName)}<br>知名度: ${Math.floor(safeFiniteNumber(gameState.village?.knownness, 0, 0))}<br><span class="dateLine">${gameState.calendar?.year ?? 1}年 ${gameState.calendar?.month ?? 1}月 ${gameState.calendar?.week ?? 1}w</span> / 今月の狩猟: ${gameState.stats?.monthlyHunts ?? 0}<br>速度: ${formatSpeedLabel(gameState.time?.timeScale)}<br>タテゴト: ${(safeFiniteNumber(gameState.village?.knownness, 0, 0) >= safeFiniteNumber(tategoto?.unlockedAtKnownness, 0, 0)) ? '解放' : `未解放(${Math.floor(safeFiniteNumber(tategoto?.unlockedAtKnownness, 0, 0))})`}<br>訪問者: ${visitors.length} / ${CONFIG.visitor.maxActive}<br>固定訪問者: ${activeNames}<br>次の訪問者目安: ${nextVisitor.toFixed(0)}秒<br>ズーム: ${gameState.camera.zoom.toFixed(2)} / ツール: ${getTool(gameState.ui.selectedTool)?.label}<br>開拓費: ${getClearingCost()}G / 半径${CONFIG.CLEARING.RADIUS} / 開拓${clampInteger(gameState.village?.clearCount, 0, Number.MAX_SAFE_INTEGER, 0)}回<br>入口方向: ${CONFIG.directions[gameState.ui.directionIndex]?.name}<br>最終保存: ${lastSaved}<br>保存状態: ${escapeHtml(saveText)}<div class="log">${(gameState.logs ?? []).map(l => `・${escapeHtml(l)}`).join('<br>')}</div>`;
  sealCardsEl.innerHTML = (gameState.seals ?? []).map(s => {
    const stay = s?.type === 'visitor' ? `<br>滞在: ${Math.floor(safeFiniteNumber(s.visitTimerMs, 0, 0) / 1000)}秒 / ${s.wantsToLeave ? '帰りたい' : '滞在中'}` : '';
    return `<div class="panel sealCard"><b>${escapeHtml(s.name)}</b>（${s.type === 'resident' ? '住民' : '訪問者'}）<br>性格: ${escapeHtml(getPersonalityConfig(s)?.label ?? s.personality)}<br>HP ${Math.ceil(s.hp)} / ${s.maxHp}<div class="bar"><div class="fill" style="width:${Math.max(0, Math.min(100, s.hp / s.maxHp * 100))}%"></div></div>所持G: ${s.carriedG}<br>Lv: ${s.level} / EXP: ${s.exp}<br>好感度: ${s.favor}<br>状態: ${stateLabel(s.state)}${stay}<br>訪問狩猟/施設: ${s.huntsThisVisit ?? 0}/${s.facilitiesUsedThisVisit ?? 0}</div>`;
  }).join('');
  updateToolButtons();
}
function stateLabel(state) { return ({ arriving:'到着', choosingHuntGate:'狩猟門選択', movingToHuntGate:'狩猟門へ移動', hunting:'狩猟探索', movingToMonster:'カニへ移動', fighting:'戦闘中', returningFromHunt:'狩猟門へ帰還', choosingFacility:'施設選択', movingToFacility:'施設へ移動', usingFacility:'施設利用中', leaving:'帰宅中', resting:'休憩中', fallen:'倒れている', rescuing:'救助中', carryingFallenSeal:'搬送中' })[state] ?? state; }

