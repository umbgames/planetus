import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG } from '../utils/random';
import { PlanetVisualClass } from './solarSystem';

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
  resourceZone: 'high' | 'mid' | 'low';
}

interface TextureCacheEntry {
  color: string;
  displacement: string;
}

const TEXTURE_CACHE_PREFIX = 'planet-us:texture-cache:';
const memoryTextureCache = new Map<string, TextureCacheEntry>();

export class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;
  visualClass: PlanetVisualClass = 'lush';
  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  onTextureUpdate: ((texture: THREE.CanvasTexture, displacementMap: THREE.CanvasTexture) => void) | null = null;
  
  private prng: () => number;
  private noise3D: (x: number, y: number, z: number) => number;
  private tempNoise3D: (x: number, y: number, z: number) => number;
  private humidNoise3D: (x: number, y: number, z: number) => number;
  private seed: string = 'default';

  constructor() {
    this.prng = createPRNG(this.seed);
    this.noise3D = createNoise3D(this.prng);
    this.tempNoise3D = createNoise3D(createPRNG(this.seed + '_temp'));
    this.humidNoise3D = createNoise3D(createPRNG(this.seed + '_humid'));
  }

  private getTextureCacheKey() {
    return `${TEXTURE_CACHE_PREFIX}${this.seed}:${this.noiseScale}:${this.landThreshold}:${this.visualClass}`;
  }

  private getMemoryEntry() {
    return memoryTextureCache.get(this.getTextureCacheKey()) ?? null;
  }

  private setMemoryEntry(entry: TextureCacheEntry) {
    memoryTextureCache.set(this.getTextureCacheKey(), entry);
  }

  private getPersistedEntry() {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(this.getTextureCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TextureCacheEntry;
      if (!parsed?.color || !parsed?.displacement) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private persistEntry(entry: TextureCacheEntry) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.getTextureCacheKey(), JSON.stringify(entry));
    } catch {
      // Best-effort cache only.
    }
  }

  private async createTextureFromDataUrl(url: string, colorSpace?: THREE.ColorSpace) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load cached texture'));
      image.src = url;
    });

    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (colorSpace) texture.colorSpace = colorSpace;
    return texture;
  }

  async restoreTexturesFromCache() {
    const entry = this.getMemoryEntry() ?? this.getPersistedEntry();
    if (!entry) return false;

    try {
      const [colorTexture, dispTexture] = await Promise.all([
        this.createTextureFromDataUrl(entry.color, THREE.SRGBColorSpace),
        this.createTextureFromDataUrl(entry.displacement),
      ]);

      if (this.texture && this.texture !== colorTexture) this.texture.dispose();
      if (this.displacementMap && this.displacementMap !== dispTexture) this.displacementMap.dispose();

      this.texture = colorTexture as unknown as THREE.CanvasTexture;
      this.displacementMap = dispTexture as unknown as THREE.CanvasTexture;
      this.setMemoryEntry(entry);
      if (this.onTextureUpdate) {
        this.onTextureUpdate(this.texture, this.displacementMap);
      }
      return true;
    } catch {
      return false;
    }
  }

  static async preloadPlanetTexture(seed: string, noiseScale: number, landThreshold: number, visualClass: PlanetVisualClass) {
    const manager = new GeographyManager();
    manager.setSeed(seed, noiseScale, landThreshold, visualClass);
    manager.initializeTopicRegions();
    const restored = await manager.restoreTexturesFromCache();
    if (!restored) {
      manager.generateTexture();
    }
  }

  setSeed(seed: string, noiseScale: number = 1.5, landThreshold: number = 0.2, visualClass: PlanetVisualClass = 'lush') {
    if (this.seed !== seed || this.noiseScale !== noiseScale || this.landThreshold !== landThreshold || this.visualClass !== visualClass) {
      this.seed = seed;
      this.noiseScale = noiseScale;
      this.landThreshold = landThreshold;
      this.visualClass = visualClass;
      this.prng = createPRNG(seed);
      this.noise3D = createNoise3D(this.prng);
      this.tempNoise3D = createNoise3D(createPRNG(seed + '_temp'));
      this.humidNoise3D = createNoise3D(createPRNG(seed + '_humid'));
      this.regions = [];
      this.texture = null;
      this.displacementMap = null;
    }
  }

  getTerrain(x: number, y: number, z: number) {
    const len = Math.sqrt(x*x + y*y + z*z);
    const nx = x/len;
    const ny = y/len;
    const nz = z/len;
    
    const n1 = (this.noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale) + 1) * 0.5;
    const n2 = (this.noise3D(nx * this.noiseScale * 2.0, ny * this.noiseScale * 2.0, nz * this.noiseScale * 2.0) + 1) * 0.5;
    const n3 = (this.noise3D(nx * this.noiseScale * 4.0, ny * this.noiseScale * 4.0, nz * this.noiseScale * 4.0) + 1) * 0.5;
    
    return n1 * 0.6 + n2 * 0.3 + n3 * 0.1;
  }

  getBiome(x: number, y: number, z: number) {
    const len = Math.sqrt(x*x + y*y + z*z);
    const nx = x/len;
    const ny = y/len;
    const nz = z/len;

    const latitude = 1.0 - Math.abs(ny);
    const tNoise = this.tempNoise3D(nx * 2, ny * 2, nz * 2) * 0.2;
    const temperature = latitude + tNoise;

    const hNoise = (this.humidNoise3D(nx * 3, ny * 3, nz * 3) + 1) * 0.5;
    const humidity = hNoise;

    const isHot = temperature > 0.6;
    const isCold = temperature < 0.3;
    const isWet = humidity > 0.5;

    if (isCold) {
      return isWet ? 'snow_forest' : 'tundra';
    } else if (isHot) {
      return isWet ? 'jungle' : 'desert';
    } else {
      return isWet ? 'forest' : 'grassland';
    }
  }

  getElevation(x: number, y: number, z: number) {
    const t = this.getTerrain(x, y, z);
    if (t < this.landThreshold) return 0;
    let elevation = Math.max(0, (t - this.landThreshold) / (1.0 - this.landThreshold));
    elevation = Math.pow(elevation, 1.5);
    return elevation;
  }

  getHeightAtPoint(x: number, y: number, z: number, radius: number, displacementScale: number): number {
    if (!this.isLand(x, y, z)) return radius;
    const elevation = this.getElevation(x, y, z);
    const dispValueNormalized = Math.min(1, elevation);
    return radius + dispValueNormalized * displacementScale;
  }

  isLand(x: number, y: number, z: number) {
    return this.getTerrain(x, y, z) >= this.landThreshold;
  }

  initializeTopicRegions() {
    if (this.regions.length === 0) {
      const TOPICS = [
        { name: 'Tech', zone: 'high' as const },
        { name: 'Gaming', zone: 'mid' as const },
        { name: 'Art', zone: 'mid' as const },
        { name: 'Music', zone: 'low' as const },
        { name: 'News', zone: 'low' as const },
        { name: 'Sports', zone: 'low' as const },
      ];

      const newRegions: Region[] = [];

      for (const topic of TOPICS) {
        let center = new THREE.Vector3(1, 0, 0);
        for (let i = 0; i < 500; i++) {
          const u = this.prng();
          const v = this.prng();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2 * v - 1);
          const x = Math.sin(phi) * Math.cos(theta);
          const y = Math.cos(phi);
          const z = Math.sin(phi) * Math.sin(theta);

          if (this.isLand(x, y, z)) {
            let tooClose = false;
            const pt = new THREE.Vector3(x, y, z);
            for (const r of newRegions) {
              if (pt.distanceToSquared(r.center) < 0.4) {
                tooClose = true;
                break;
              }
            }
            if (!tooClose) {
              center = pt;
              break;
            }
          }
        }

        newRegions.push({
          id: topic.name,
          hashtag: topic.name,
          center,
          color: new THREE.Color(0x888888),
          resourceZone: topic.zone,
        });
      }

      this.regions = newRegions;
    }

    if (!this.texture) {
      this.generateTexture();
    }
  }

  getRegionForPoint(x: number, y: number, z: number): Region | null {
    if (!this.isLand(x, y, z)) return null;
    if (this.regions.length === 0) return null;

    let minDist = Infinity;
    let closestRegion: Region | null = null;
    const pt = new THREE.Vector3(x, y, z).normalize();

    for (const region of this.regions) {
      const dist = pt.distanceToSquared(region.center);
      if (dist < minDist) {
        minDist = dist;
        closestRegion = region;
      }
    }
    return closestRegion;
  }

  getRandomPointForTopic(topic: string, radius: number): [number, number, number] {
    for (let i = 0; i < 500; i++) {
      const u = this.prng();
      const v = this.prng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      const region = this.getRegionForPoint(x, y, z);
      if (region && region.id === topic) {
        return [x * radius, y * radius, z * radius];
      }
    }
    
    for (let i = 0; i < 500; i++) {
      const u = this.prng();
      const v = this.prng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      if (this.isLand(x, y, z)) {
        return [x * radius, y * radius, z * radius];
      }
    }
    
    return [radius, 0, 0];
  }

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;
  
  dispCanvas: HTMLCanvasElement | null = null;
  dispCtx: CanvasRenderingContext2D | null = null;
  dispImgData: ImageData | null = null;

  generateTexture() {
    const width = 1024;
    const height = 512;
    
    if (!this.canvas) {
      try {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!this.ctx) throw new Error('Could not get 2D context');
        this.imgData = this.ctx.createImageData(width, height);
        
        this.dispCanvas = document.createElement('canvas');
        this.dispCanvas.width = width;
        this.dispCanvas.height = height;
        this.dispCtx = this.dispCanvas.getContext('2d', { willReadFrequently: true });
        if (!this.dispCtx) throw new Error('Could not get 2D displacement context');
        this.dispImgData = this.dispCtx.createImageData(width, height);
      } catch (e) {
        console.error('Failed to initialize canvases for planet textures', e);
        return;
      }
    }

    const data = this.imgData!.data;
    const dispData = this.dispImgData!.data;

    const getPalette = (vClass: PlanetVisualClass) => {
      switch (vClass) {
        case 'lush':
          return {
            ocean: new THREE.Color('#1e3a8a'), beaches: new THREE.Color('#fde047'), low: new THREE.Color('#84cc16'), mid: new THREE.Color('#15803d'), high: new THREE.Color('#71717a'), peak: new THREE.Color('#ffffff'),
          };
        case 'oceanic':
          return {
            ocean: new THREE.Color('#1e40af'), beaches: new THREE.Color('#fef08a'), low: new THREE.Color('#10b981'), mid: new THREE.Color('#059669'), high: new THREE.Color('#64748b'), peak: new THREE.Color('#f1f5f9'),
          };
        case 'desert':
          return {
            ocean: new THREE.Color('#78350f'), beaches: new THREE.Color('#d97706'), low: new THREE.Color('#f59e0b'), mid: new THREE.Color('#fbbf24'), high: new THREE.Color('#b45309'), peak: new THREE.Color('#78350f'),
          };
        case 'arid_rocky':
          return {
            ocean: new THREE.Color('#451a03'), beaches: new THREE.Color('#78350f'), low: new THREE.Color('#92400e'), mid: new THREE.Color('#b45309'), high: new THREE.Color('#57534e'), peak: new THREE.Color('#292524'),
          };
        case 'barren_gray':
          return {
            ocean: new THREE.Color('#171717'), beaches: new THREE.Color('#262626'), low: new THREE.Color('#404040'), mid: new THREE.Color('#525252'), high: new THREE.Color('#737373'), peak: new THREE.Color('#a3a3a3'),
          };
        case 'icy':
          return {
            ocean: new THREE.Color('#0c4a6e'), beaches: new THREE.Color('#bae6fd'), low: new THREE.Color('#e0f2fe'), mid: new THREE.Color('#f0f9ff'), high: new THREE.Color('#ffffff'), peak: new THREE.Color('#ffffff'),
          };
        case 'volcanic':
          return {
            ocean: new THREE.Color('#1a0a0a'), beaches: new THREE.Color('#2d0a0a'), low: new THREE.Color('#450a0a'), mid: new THREE.Color('#7f1d1d'), high: new THREE.Color('#dc2626'), peak: new THREE.Color('#f87171'),
          };
        default:
          return {
            ocean: new THREE.Color('#1e3a8a'), beaches: new THREE.Color('#fde047'), low: new THREE.Color('#84cc16'), mid: new THREE.Color('#15803d'), high: new THREE.Color('#71717a'), peak: new THREE.Color('#ffffff'),
          };
      }
    };

    const palette = getPalette(this.visualClass);

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI;
      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2;

        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);

        const heightVal = this.getTerrain(px, py, pz);
        const idx = (y * width + x) * 4;

        let color: THREE.Color;
        let dispValue = 0;

        if (heightVal < this.landThreshold) {
          color = palette.ocean;
          dispValue = 0;
        } else {
          const normHeight = (heightVal - this.landThreshold) / (1.0 - this.landThreshold);
          dispValue = Math.min(255, Math.floor(normHeight * 255));
          
          if (normHeight < 0.1) color = palette.beaches;
          else if (normHeight < 0.4) color = palette.low;
          else if (normHeight < 0.7) color = palette.mid;
          else if (normHeight < 0.9) color = palette.high;
          else color = palette.peak;
        }

        const colorNoise = this.noise3D(px * 50, py * 50, pz * 50) * 0.05;
        
        data[idx] = Math.max(0, Math.min(255, color.r * 255 * (1 + colorNoise)));
        data[idx+1] = Math.max(0, Math.min(255, color.g * 255 * (1 + colorNoise)));
        data[idx+2] = Math.max(0, Math.min(255, color.b * 255 * (1 + colorNoise)));
        data[idx+3] = 255;
        
        dispData[idx] = dispValue;
        dispData[idx+1] = dispValue;
        dispData[idx+2] = dispValue;
        dispData[idx+3] = 255;
      }
    }
    this.ctx!.putImageData(this.imgData!, 0, 0);
    this.dispCtx!.putImageData(this.dispImgData!, 0, 0);
    
    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      
      this.displacementMap = new THREE.CanvasTexture(this.dispCanvas);
      this.displacementMap.minFilter = THREE.LinearFilter;
      this.displacementMap.magFilter = THREE.LinearFilter;
    }
    
    this.texture.needsUpdate = true;
    this.displacementMap!.needsUpdate = true;

    const cacheEntry: TextureCacheEntry = {
      color: this.canvas.toDataURL('image/webp', 0.82),
      displacement: this.dispCanvas!.toDataURL('image/webp', 0.82),
    };
    this.setMemoryEntry(cacheEntry);
    this.persistEntry(cacheEntry);

    if (this.onTextureUpdate) {
      this.onTextureUpdate(this.texture, this.displacementMap!);
    }
  }
}

export const geographyManager = new GeographyManager();
