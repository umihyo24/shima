const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const toolsEl = document.getElementById('tools');
const sealCardsEl = document.getElementById('sealCards');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const loadBtn = document.getElementById('loadBtn');
const startSaveInfoEl = document.getElementById('startSaveInfo');

const gameState = createNewGameState();

function loop(now) {
  const realDeltaMs = Math.min(CONFIG.timing.maxDt * 1000, now - gameState.lastTime);
  gameState.lastTime = now;
  const timeScale = clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE);
  update(realDeltaMs * timeScale);
  if (gameState.ui.needsHudUpdate) {
    updateHud();
    gameState.ui.needsHudUpdate = false;
  }
  render();
  requestAnimationFrame(loop);
}

initializeAssetRegistry();
gameState.world.tiles = generateInitialMap();
buildTools();
bindInputEvents();
updateStartSaveInfo();
updateHud();
requestAnimationFrame(loop);
