let loadedImages = new Set();
let allLayersReady = false;
let loadingFinishScheduled = false;

const layerImageStatus = {
  1: { loaded: 0, total: 2 },
  2: { loaded: 0, total: 2 },
  3: { loaded: 0, total: 2 },
  4: { loaded: 0, total: 2 },
  5: { loaded: 0, total: 2 },
  6: { loaded: 0, total: 2 }
};

function updateLoadingProgress() {
  const totalLoaded = Object.values(layerImageStatus).reduce((sum, l) => sum + l.loaded, 0);
  const totalImages = Object.values(layerImageStatus).reduce((sum, l) => sum + l.total, 0);
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) loadingIndicator.textContent = `Loading... ${totalLoaded}/${totalImages}`;
}

function getLayerNumber(img) {
  if (!img) return null;

  const layerElement = img.closest('.layer');
  if (!layerElement || !layerElement.dataset.layer) return null;

  const layer = Number.parseInt(layerElement.dataset.layer, 10);
  return Number.isFinite(layer) ? layer : null;
}

function markImageSettled(img) {
  if (loadedImages.has(img)) return;
  loadedImages.add(img);

  const layer = getLayerNumber(img);
  if (layer === null || !layerImageStatus[layer]) {
    updateLoadingProgress();
    return;
  }

  layerImageStatus[layer].loaded++;
  updateLoadingProgress();

  const allComplete = Object.values(layerImageStatus).every(l => l.loaded === l.total);
  if (allComplete && !allLayersReady && !loadingFinishScheduled) {
    loadingFinishScheduled = true;
    setTimeout(() => { finishLoading(); }, 200);
  }
}

function onImageLoad(img) {
  if (typeof img.decode !== 'function') {
    markImageSettled(img);
    return;
  }

  img.decode().then(() => {
    markImageSettled(img);
  }).catch(error => {
    console.error('Failed to decode image:', img.src, error);
    markImageSettled(img);
  });
}

function onImageError(img) {
  console.error('Failed to load image:', img.src);
  markImageSettled(img);
}

function waitForLayerTransitions(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return Promise.resolve();

  return Promise.all(layers.map(layer => new Promise(resolve => {
    let timeout;
    const finish = () => {
      clearTimeout(timeout);
      layer.removeEventListener('transitionend', onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = event => {
      if (event.target === layer && event.propertyName === 'opacity') finish();
    };

    layer.addEventListener('transitionend', onTransitionEnd);
    const duration = getComputedStyle(layer).transitionDuration.split(',')[0].trim();
    const durationMs = parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000);
    timeout = setTimeout(finish, durationMs + 50);
  })));
}

function finishLoading() {
  allLayersReady = true;
  scaleForViewport();

  if (document.body) {
    document.body.classList.remove('loading');
  }

  const container = document.getElementById('parallaxContainer');
  if (!container) return;

  container.classList.add('ready');

  const layers = Array.from(container.querySelectorAll('.layer'));
  const layersVisible = waitForLayerTransitions(layers);
  layers.forEach(layer => layer.classList.add('loaded'));

  layersVisible.then(() => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  });
}

function setupImageLoading() {
  const images = document.querySelectorAll('.layer img');
  images.forEach(img => {
    if (img.complete && img.naturalWidth > 0) {
      onImageLoad(img);
    } else if (img.complete) {
      onImageError(img);
    } else {
      img.addEventListener('load', () => onImageLoad(img), { once: true });
      img.addEventListener('error', () => onImageError(img), { once: true });
    }
  });
}

function getActualViewportSize() {
  let width = window.innerWidth;
  let height = window.innerHeight;
  if (window.visualViewport) {
    width = window.visualViewport.width;
    height = window.visualViewport.height;
  }
  if (width <= 0 || height <= 0) {
    width = document.documentElement.clientWidth || window.innerWidth;
    height = document.documentElement.clientHeight || window.innerHeight;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function scaleForViewport() {
  if (!allLayersReady) return;
  const container = document.getElementById('parallaxContainer');
  const viewport = getActualViewportSize();
  const scaleX = viewport.width / 1920;
  const scaleY = viewport.height / 1080;
  const scale = Math.max(scaleX, scaleY);
  const scaledWidth = 1920 * scale;
  const scaledHeight = 1080 * scale;
  const offsetX = (viewport.width - scaledWidth) / 2;
  const offsetY = (viewport.height - scaledHeight) / 2;
  document.body.style.width = '100vw';
  document.body.style.height = '100vh';
  document.body.style.position = 'fixed';
  const transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  if (container.style.transform === transform) return;
  requestAnimationFrame(() => {
    container.style.transform = transform;
  });
}

let resizeTimeout;
let orientationTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(scaleForViewport, 150);
}
function handleOrientationChange() {
  clearTimeout(orientationTimeout);
  orientationTimeout = setTimeout(scaleForViewport, 800);
}

window.addEventListener('resize', handleResize, { passive: true });
document.addEventListener('fullscreenchange', handleResize);
if (screen.orientation) {
  screen.orientation.addEventListener('change', handleOrientationChange);
} else {
  window.addEventListener('orientationchange', handleOrientationChange);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleResize, { passive: true });
}

// GIF handling
async function fetchGifList() {
  const response = await fetch('data/images.json');
  if (!response.ok) throw new Error("Failed to load images.json");
  const list = await response.json();
  if (!Array.isArray(list) || list.length === 0) throw new Error("images.json empty");
  return list;
}

function releaseGif(gif) {
  if (gif.parentElement) gif.parentElement.removeChild(gif);
}

function loadGif(gif, src) {
  return new Promise((resolve, reject) => {
    gif.addEventListener('load', resolve, { once: true });
    gif.addEventListener('error', () => reject(new Error(`Failed to load Pokémon image: ${src}`)), { once: true });
    gif.src = src;
  });
}

function scheduleTravelingGif(gifs, isValentinesDay, delay = 2000 + Math.random() * 4000) {
  setTimeout(() => spawnTravelingGif(gifs, isValentinesDay), delay);
}

async function spawnTravelingGif(gifs, isValentinesDay) {
  if (document.hidden || !allLayersReady) {
    scheduleTravelingGif(gifs, isValentinesDay);
    return;
  }

  const container = document.getElementById('parallaxContainer');
  if (!container) {
    return;
  }

  const gif = document.createElement('img');
  gif.className = 'traveling-gif';
  const useShiny = Math.random() < (1 / 4096) ? 'shiny' : 'normal';
  const randomGif = isValentinesDay ? "0370 - Luvdisc.gif" : gifs[Math.floor(Math.random() * gifs.length)];
  const src = `images/home/${useShiny}/${randomGif}`;
  try {
    await loadGif(gif, src);
  } catch (error) {
    console.error(error);
    scheduleTravelingGif(gifs, isValentinesDay);
    return;
  }
  if (document.hidden || !allLayersReady) {
    scheduleTravelingGif(gifs, isValentinesDay);
    return;
  }
  const pokemonName = randomGif.replace(/^\d+\s*-\s*/, '').replace('.gif', '');
  gif.alt = `${useShiny === 'shiny' ? 'Shiny ' : ''}${pokemonName} swimming`;
  container.appendChild(gif);
  const layerZ = Math.floor(Math.random() * 4) + 3;
  gif.style.zIndex = layerZ;
  const scale = 0.5 + (layerZ - 3) * 0.25;
  const speed = 15 - (layerZ - 3) * 2;
  gif.style.width = `${200 * scale}px`;
  const minTop = 80;
  const maxTop = 1080 - 280 - (200 * scale);
  gif.style.top = `${minTop + Math.random() * (maxTop - minTop)}px`;
  const leftToRight = Math.random() < 0.5;
  if (leftToRight) {
    gif.style.left = '0px';
    gif.style.transform = `scale(${scale})`;
    gif.style.animation = `moveLTRFlipped ${speed}s linear forwards`;
  } else {
    gif.style.left = '0px';
    gif.style.transform = `scale(${scale})`;
    gif.style.animation = `moveRTL ${speed}s linear forwards`;
  }
  gif.addEventListener('animationend', () => releaseGif(gif), { once: true });
  scheduleTravelingGif(gifs, isValentinesDay);
}

// Initialize
async function initialize() {
  try {
    if (!document.body || !document.getElementById('parallaxContainer')) {
      return;
    }

    setupImageLoading();
    const gifs = await fetchGifList();
    const today = new Date();
    const isValentinesDay = today.getMonth() === 1 && today.getDate() === 14;
    const checkReady = () => {
      if (allLayersReady) {
        setTimeout(() => {
          spawnTravelingGif(gifs, isValentinesDay);
        }, 1000);
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
