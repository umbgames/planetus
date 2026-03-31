import * as THREE from 'three';

// Persistent (localStorage) planet texture cache.
// - Memory cache already exists in GeographyManager.
// - This adds optional persistence across sessions to reduce cold-start pop-in.

const CACHE_VERSION = 2;
const STORAGE_PREFIX = 'planetTextureCache:v2:entry:';
const INDEX_KEY = 'planetTextureCache:v2:index';

// Keep this conservative for mobile/localStorage quotas.
const MAX_ENTRIES = 10;
const MAX_TOTAL_BYTES = 4_500_000; // ~4.5MB across all cached textures
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

let enabled = true;

export function setPersistentTextureCacheEnabled(v: boolean) {
  enabled = v;
}

export function isPersistentTextureCacheEnabled() {
  return enabled;
}

type CacheEntry = {
  v: number;
  t: number; // write timestamp
  tex: string; // data URL (webp)
  disp: string; // data URL (webp)
  detail: string; // data URL (webp)
  w: number;
  h: number;
  dw: number;
  dh: number;
};

type IndexEntry = { k: string; t: number; bytes: number };

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function keyFor(cacheKey: string) {
  return STORAGE_PREFIX + encodeURIComponent(cacheKey);
}

function estimateBytes(str: string) {
  // Rough, but good enough for LRU eviction.
  return str.length * 2;
}

function readIndex(): IndexEntry[] {
  return safeJsonParse<IndexEntry[]>(localStorage.getItem(INDEX_KEY)) ?? [];
}

function writeIndex(entries: IndexEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function pruneIndex() {
  const idx = readIndex().sort((a, b) => b.t - a.t);
  let total = 0;
  const keep: IndexEntry[] = [];

  for (const it of idx) {
    if (keep.length >= MAX_ENTRIES) break;
    if (total + it.bytes > MAX_TOTAL_BYTES) break;
    total += it.bytes;
    keep.push(it);
  }

  const drop = idx.filter((x) => !keep.find((k) => k.k === x.k));
  for (const it of drop) {
    try {
      localStorage.removeItem(keyFor(it.k));
    } catch {
      // ignore
    }
  }

  writeIndex(keep);
}

function downscaleCanvas(src: HTMLCanvasElement, maxWidth: number) {
  if (src.width <= maxWidth) return src;

  const ratio = maxWidth / src.width;
  const w = Math.floor(src.width * ratio);
  const h = Math.floor(src.height * ratio);

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;

  const ctx = c.getContext('2d');
  if (!ctx) return src;

  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function configureColorTexture(texture: THREE.Texture, repeat = false) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}

function configureDataTexture(texture: THREE.Texture, repeat = false) {
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}

export function putPlanetTextures(
  cacheKey: string,
  colorCanvas: HTMLCanvasElement,
  dispCanvas: HTMLCanvasElement,
  detailCanvas: HTMLCanvasElement
) {
  if (!enabled) return;

  try {
    // Persist reduced-size versions to keep within localStorage quotas.
    const color = downscaleCanvas(colorCanvas, 768);
    const disp = downscaleCanvas(dispCanvas, 768);
    const detail = downscaleCanvas(detailCanvas, 512);

    const tex = color.toDataURL('image/webp', 0.62);
    const dispUrl = disp.toDataURL('image/webp', 0.58);
    const detailUrl = detail.toDataURL('image/webp', 0.62);

    const entry: CacheEntry = {
      v: CACHE_VERSION,
      t: Date.now(),
      tex,
      disp: dispUrl,
      detail: detailUrl,
      w: color.width,
      h: color.height,
      dw: detail.width,
      dh: detail.height,
    };

    const raw = JSON.stringify(entry);
    const bytes = estimateBytes(raw);
    if (bytes > MAX_TOTAL_BYTES * 0.7) return; // too large for any sane cache

    localStorage.setItem(keyFor(cacheKey), raw);

    const idx = readIndex().filter((x) => x.k !== cacheKey);
    idx.unshift({ k: cacheKey, t: entry.t, bytes });
    writeIndex(idx);
    pruneIndex();
  } catch {
    // ignore quota errors
  }
}

export async function loadPlanetTextures(
  cacheKey: string
): Promise<{
  texture: THREE.Texture;
  displacementMap: THREE.Texture;
  detailTexture: THREE.Texture;
} | null> {
  if (!enabled) return null;

  const raw = safeJsonParse<CacheEntry>(localStorage.getItem(keyFor(cacheKey)));
  if (!raw) return null;
  if (raw.v !== CACHE_VERSION) return null;
  if (Date.now() - raw.t > TTL_MS) return null;

  const load = async (src: string) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;

    try {
      await (img as any).decode?.();
    } catch {
      // ignore
    }

    return img;
  };

  try {
    const [colorImg, dispImg, detailImg] = await Promise.all([
      load(raw.tex),
      load(raw.disp),
      load(raw.detail),
    ]);

    const texture = new THREE.Texture(colorImg);
    configureColorTexture(texture, false);

    const displacementMap = new THREE.Texture(dispImg);
    configureDataTexture(displacementMap, false);

    const detailTexture = new THREE.Texture(detailImg);
    configureColorTexture(detailTexture, true);

    // bump LRU timestamp
    const idx = readIndex().filter((x) => x.k !== cacheKey);
    idx.unshift({ k: cacheKey, t: Date.now(), bytes: estimateBytes(JSON.stringify(raw)) });
    writeIndex(idx);

    return { texture, displacementMap, detailTexture };
  } catch {
    return null;
  }
}

export function hasValidPlanetTextures(cacheKey: string) {
  if (!enabled) return false;

  const raw = safeJsonParse<CacheEntry>(localStorage.getItem(keyFor(cacheKey)));
  if (!raw) return false;
  if (raw.v !== CACHE_VERSION) return false;
  if (Date.now() - raw.t > TTL_MS) return false;
  if (!raw.detail) return false;

  return true;
}
