let loadedImages = new Set();
let allLayersReady = false;
let currentScale = 1;
let isScaling = false;

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

function onImageLoad(img) {
  const layer = parseInt(img.closest('.layer').dataset.layer);
  layerImageStatus[layer].loaded++;
  updateLoadingProgress();
  if (layerImageStatus[layer].loaded === layerImageStatus[layer].total) {
    const layerElement = img.closest('.layer');
    setTimeout(() => { layerElement.classList.add('loaded'); }, 50);
  }
  const allComplete = Object.values(layerImageStatus).every(l => l.loaded === l.total);
  if (allComplete && !allLayersReady) {
    setTimeout(() => { finishLoading(); }, 200);
  }
}

function finishLoading() {
  allLayersReady = true;
  document.body.classList.remove('loading');
  document.getElementById('parallaxContainer').classList.add('ready');
  document.getElementById('loadingIndicator').classList.add('hidden');
  setTimeout(() => { scaleForViewport(); }, 100);
}

function setupImageLoading() {
  const images = document.querySelectorAll('.layer img');
  images.forEach(img => {
    if (img.complete && img.naturalWidth > 0) {
      onImageLoad(img);
    } else {
      img.addEventListener('load', () => onImageLoad(img));
      img.addEventListener('error', e => {
        console.error('Failed to load image:', e.target.src);
        onImageLoad(img);
      });
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
  if (!allLayersReady || isScaling) return;
  isScaling = true;
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
  if (Math.abs(scale - currentScale) > 0.01) {
    currentScale = scale;
    requestAnimationFrame(() => {
      container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      setTimeout(() => { isScaling = false; }, 100);
    });
  } else {
    isScaling = false;
  }
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

const gifPool = [];
function getGif() {
  let gif;
  if (gifPool.length > 0) {
    gif = gifPool.pop();
  } else {
    gif = document.createElement('img');
    gif.className = 'traveling-gif';
    gif.onerror = () => releaseGif(gif);
  }
  gif.style.display = 'block';
  return gif;
}
function releaseGif(gif) {
  gif.style.animation = '';
  gif.style.left = '';
  gif.style.top = '';
  gif.style.width = '';
  gif.style.transform = '';
  gif.style.display = 'none';
  gifPool.push(gif);
  if (gif.parentElement) gif.parentElement.removeChild(gif);
}

function spawnTravelingGif(gifs, isValentinesDay) {
  if (document.hidden || !allLayersReady) {
    setTimeout(() => spawnTravelingGif(gifs, isValentinesDay), 2000 + Math.random() * 4000);
    return;
  }
  const gif = getGif();
  const useShiny = Math.random() < (1 / 4096) ? 'shiny' : 'normal';
  const randomGif = isValentinesDay ? "0370 - Luvdisc.gif" : gifs[Math.floor(Math.random() * gifs.length)];
  gif.src = `images/home/${useShiny}/${randomGif}`;
  const pokemonName = randomGif.replace(/^\d+\s*-\s*/, '').replace('.gif', '');
  gif.alt = `${useShiny === 'shiny' ? 'Shiny ' : ''}${pokemonName} swimming`;
  const container = document.getElementById('parallaxContainer');
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
  setTimeout(() => spawnTravelingGif(gifs, isValentinesDay), 2000 + Math.random() * 4000);
}

// Initialize
async function initialize() {
  try {
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
