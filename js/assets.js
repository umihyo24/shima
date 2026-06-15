function createImage(key) {
  const assetKey = String(key || '');
  if (!assetKey) return null;
  gameState.images = gameState.images ?? {};
  const cached = gameState.images?.[assetKey];
  if (cached) return cached;
  const path = CONFIG.ASSETS?.paths?.[assetKey];
  const record = { key: assetKey, path: path ?? '', img: null, status: path ? 'loading' : 'failed', loaded: false, failed: !path, fallbackTried: false };
  if (!path) {
    gameState.images[assetKey] = record;
    return record;
  }
  const img = new Image();
  record.img = img;
  img.onload = () => { record.status = 'loaded'; record.loaded = true; record.failed = false; };
  img.onerror = () => {
    const fallbackPath = getRelativeAssetFallbackPath(record.path);
    if (!record.fallbackTried && fallbackPath && fallbackPath !== img.src) {
      record.fallbackTried = true;
      record.path = fallbackPath;
      img.src = fallbackPath;
      return;
    }
    record.status = 'failed';
    record.loaded = false;
    record.failed = true;
  };
  img.src = path;
  gameState.images[assetKey] = record;
  return record;
}

function getRelativeAssetFallbackPath(path) {
  const raw = String(path || '');
  if (!raw.startsWith('/assets/')) return '';
  return raw.slice(1);
}

function initializeAssetRegistry() {
  gameState.images = {};
  for (const key of Object.keys(CONFIG.ASSETS?.paths ?? {})) createImage(key);
}

function getAsset(key) {
  const assetKey = String(key || '');
  if (!assetKey) return null;
  return gameState.images?.[assetKey] ?? createImage(assetKey);
}

function isAssetLoaded(key) {
  const asset = getAsset(key);
  const img = asset?.img;
  return asset?.status === 'loaded' && asset?.loaded === true && img?.complete === true && img?.naturalWidth > 0;
}

function safeDrawImage(context, asset, x, y, w, h) {
  const img = asset?.img;
  if (!asset || !isAssetLoaded(asset.key)) return false;
  try {
    context.drawImage(img, x, y, w, h);
    return true;
  } catch (error) {
    asset.status = 'failed';
    asset.loaded = false;
    asset.failed = true;
    return false;
  }
}

function drawImageOrFallback(context, key, x, y, w, h, fallbackFn, options = {}) {
  const asset = getAsset(key);
  const rotation = Number.isFinite(options?.rotation) ? options.rotation : 0;
  let drawn = false;
  if (rotation) {
    context.save();
    context.translate(x + w / 2, y + h / 2);
    context.rotate(rotation);
    drawn = safeDrawImage(context, asset, -w / 2, -h / 2, w, h);
    context.restore();
  } else {
    drawn = safeDrawImage(context, asset, x, y, w, h);
  }
  if (drawn) return true;
  if (typeof fallbackFn === 'function') fallbackFn(context, x, y, w, h, options);
  return false;
}

function drawSpriteFacing(context, key, x, y, w, h, facing, fallbackFn) {
  const face = facing === 'right' ? 'right' : 'left';
  const flip = face === 'right';
  const asset = getAsset(key);
  if (isAssetLoaded(key)) {
    context.save();
    if (flip) {
      context.translate(x + w, y);
      context.scale(-1, 1);
      safeDrawImage(context, asset, 0, 0, w, h);
    } else {
      safeDrawImage(context, asset, x, y, w, h);
    }
    context.restore();
    return true;
  }
  if (typeof fallbackFn === 'function') fallbackFn(context, x, y, w, h, { facing: face });
  return false;
}
