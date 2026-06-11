const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const speedHudEl = document.getElementById('speedHud');
const bottomTabBarEl = document.getElementById('bottomTabBar');
const bottomPanelEl = document.getElementById('bottomPanel');
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const loadBtn = document.getElementById('loadBtn');
const startSaveInfoEl = document.getElementById('startSaveInfo');

const gameState = createNewGameState();

function loop(now) {
  try {
    const realDeltaMs = Math.min(CONFIG.timing.maxDt * 1000, now - gameState.lastTime);
    gameState.lastTime = now;
    const timeScale = clampNumber(gameState.time?.timeScale, 0, Math.max(...CONFIG.TIME.SPEED_OPTIONS), CONFIG.TIME.DEFAULT_SCALE);
    update(realDeltaMs * timeScale);
    render();
    if (gameState.ui?.needsHudUpdate || gameState.ui?.needsPanelUpdate) renderUI();
  } catch (error) {
    console.error('Game loop error:', error);
    if (gameState.ui) {
      gameState.ui.message = `エラー: ${error?.message ?? error}`;
      gameState.ui.needsHudUpdate = false;
      gameState.ui.needsPanelUpdate = false;
    }
  } finally {
    requestAnimationFrame(loop);
  }
}

initializeAssetRegistry();
gameState.world.tiles = generateInitialMap();
buildTools();
bindInputEvents();
updateStartSaveInfo();
renderUI();
requestAnimationFrame(loop);
