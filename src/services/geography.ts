import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG, hashCombine, hashToUnitFloat, seededRange } from '../utils/random';
import { hasValidPlanetTextures, loadPlanetTextures, putPlanetTextures } from './planetTextureCache';
import { generateStylizedPlanetTextures, StylizedPlanetTextures } from './stylizedPlanetTextures';

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
  resourceZone: 'high' | 'mid' | 'low';
}

export interface CachedGeographyData {
  regions: Region[];
  texture: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
  detailTexture: THREE.CanvasTexture;
}

export type TextureDetail = 'standard' | 'enhanced';
export type BiomeName = 'rocky' | 'dry_arid' | 'desert' | 'red' | 'volcanic' | 'lush_green' | 'ice' | 'gas_giant';

const geometryCache = new Map<string, CachedGeographyData>();

export class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;

  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  detailTexture: THREE.CanvasTexture | null = null;
  stylized: StylizedPlanetTextures | null = null;

  onTextureUpdate: ((texture: THREE.CanvasTexture, displacementMap: THREE.CanvasTexture, detailTexture: THREE.CanvasTexture) => void) | null = null;

  private prng: () => number;
  private noise3D: ReturnType<typeof createNoise3D>;
  private humidityNoise3D: ReturnType<typeof createNoise3D>;
  private seed = 'default';
  private textureDetail: TextureDetail = 'standard';
  private visualClass: BiomeName = 'rocky';
  private textureResolution: { width: number; height: number } | null = null;

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;

  dispCanvas: HTMLCanvasElement | null = null;
  dispCtx: CanvasRenderingContext2D | null = null;
  dispImgData: ImageData | null = null;

  detailCanvas: HTMLCanvasElement | null = null;
  detailCtx: CanvasRenderingContext2D | null = null;
  detailImgData: ImageData | null = null;

  constructor() {
    this.prng = createPRNG(this.seed);
    this.noise3D = createNoise3D(this.prng);
    this.humidityNoise3D = createNoise3D(createPRNG(hashCombine(this.seed, 'humidity')));
  }

  private getCacheKey(seed = this.seed, noiseScale = this.noiseScale, landThreshold = this.landThreshold, textureDetail = this.textureDetail, visualClass = this.visualClass) {
    return `stylized-v4|${seed}|${noiseScale}|${landThreshold}|${textureDetail}|${visualClass}`;
  }

  private configureTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }

  private configureDisplacementTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }

  private adoptPersistentTextures(texture: THREE.Texture, displacementMap: THREE.Texture, detailTexture: THREE.Texture) {
    this.texture = texture as THREE.CanvasTexture;
    this.displacementMap = displacementMap as THREE.CanvasTexture;
    this.detailTexture = detailTexture as THREE.CanvasTexture;
    this.configureTexture(this.texture, false);
    this.configureDisplacementTexture(this.displacementMap, false);
    this.configureTexture(this.detailTexture, true);
    this.stylized = generateStylizedPlanetTextures(this.visualClass as any, this.seed, 2048, 1024);
  }

  setSeed(seed: string, noiseScale: number = 1.5, landThreshold: number = 0.2, textureDetail: TextureDetail = 'standard', visualClass: BiomeName = 'rocky') {
    if (this.seed !== seed || this.noiseScale !== noiseScale || this.landThreshold !== landThreshold || this.textureDetail !== textureDetail || this.visualClass !== visualClass) {
      this.seed = seed;
      this.noiseScale = noiseScale;
      this.landThreshold = landThreshold;
      this.textureDetail = textureDetail;
      this.visualClass = visualClass;
      this.prng = createPRNG(seed);
      this.noise3D = createNoise3D(this.prng);
      this.humidityNoise3D = createNoise3D(createPRNG(hashCombine(seed, 'humidity')));
      this.regions = [];
      this.texture = null;
      this.displacementMap = null;
      this.detailTexture = null;
      this.stylized = null;
    }
  }

  setTextureResolution(width: number, height: number) {
    this.textureResolution = { width, height };
  }

  static async warmCache(seed: string, noiseScale: number, landThreshold: number, textureDetail: TextureDetail = 'standard', visualClass: BiomeName = 'rocky') {
    const manager = new GeographyManager();
    manager.setSeed(seed, noiseScale, landThreshold, textureDetail, visualClass);
    await manager.initializeTopicRegions();
    return manager;
  }

  static getCached(seed: string, noiseScale: number, landThreshold: number, textureDetail: TextureDetail = 'standard', visualClass: BiomeName = 'rocky'): CachedGeographyData | null {
    const key = `stylized-v4|${seed}|${noiseScale}|${landThreshold}|${textureDetail}|${visualClass}`;
    return geometryCache.get(key) ?? null;
  }

  getElevationFromBuffer(x: number, y: number, z: number): number {
    if (!this.stylized) {
      this.stylized = generateStylizedPlanetTextures(this.visualClass as any, this.seed, 2048, 1024);
    }
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = Math.max(-1, Math.min(1, y / len));
    const nz = z / len;
    const phi = Math.acos(ny);
    const theta = Math.atan2(nz, nx);
    const u = ((theta / (2 * Math.PI)) + 0.5 + 1) % 1;
    const v = Math.max(0, Math.min(1, phi / Math.PI));
    const px = Math.min(this.stylized.width - 1, Math.max(0, Math.floor(u * this.stylized.width)));
    const py = Math.min(this.stylized.height - 1, Math.max(0, Math.floor(v * this.stylized.height)));
    const idx = (py * this.stylized.width + px) * 4;
    const dispVal = this.stylized.heightBuffer[idx] || 0;
    return dispVal / 255;
  }

  getTerrain(x: number, y: number, z: number) {
    if (this.stylized) {
      return this.getElevationFromBuffer(x, y, z);
    }
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    let n = this.noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.45 * this.noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    n += 0.2 * (1.0 - Math.abs(this.noise3D(nx * this.noiseScale * 3.5, ny * this.noiseScale * 3.5, nz * this.noiseScale * 3.5)));
    return n;
  }

  getElevation(x: number, y: number, z: number) {
    if (this.stylized) {
      return this.getElevationFromBuffer(x, y, z);
    }
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    return Math.pow(Math.max(0, t - this.landThreshold), 1.45);
  }

  getHeightAtPoint(x: number, y: number, z: number, radius: number, displacementScale: number): number {
    if (!this.isLand(x, y, z)) return radius;
    if (this.stylized) {
      return radius + this.getElevationFromBuffer(x, y, z) * displacementScale;
    }
    return radius + Math.min(1, this.getElevation(x, y, z) * 170 / 255) * displacementScale;
  }

  isLand(x: number, y: number, z: number) {
    if (this.visualClass === 'gas_giant') return false;
    if (this.stylized) {
      return this.getElevationFromBuffer(x, y, z) > 0.08;
    }
    return this.getTerrain(x, y, z) > this.landThreshold;
  }

  async initializeTopicRegions() {
    const cacheKey = this.getCacheKey();
    const memoryCached = geometryCache.get(cacheKey);
    if (memoryCached) {
      this.regions = memoryCached.regions.map((region) => ({ ...region, center: region.center.clone(), color: region.color.clone() }));
      this.texture = memoryCached.texture;
      this.displacementMap = memoryCached.displacementMap;
      this.detailTexture = memoryCached.detailTexture;
      if (this.onTextureUpdate && this.texture && this.displacementMap && this.detailTexture) {
        this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
      }
      return;
    }

    if (this.regions.length > 0 && this.texture && this.displacementMap && this.detailTexture) return;

    const TOPICS = [
      { name: 'Tech', zone: 'high' as const },
      { name: 'Gaming', zone: 'mid' as const },
      { name: 'Art', zone: 'mid' as const },
      { name: 'Music', zone: 'low' as const },
      { name: 'News', zone: 'low' as const },
      { name: 'Sports', zone: 'low' as const },
    ];

    this.regions = TOPICS.map((topic) => {
      let center = new THREE.Vector3(1, 0, 0);
      for (let i = 0; i < 300; i++) {
        const u = this.prng();
        const v = this.prng();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        if (this.isLand(x, y, z)) {
          center = new THREE.Vector3(x, y, z);
          break;
        }
      }
      return {
        id: topic.name,
        hashtag: topic.name,
        center,
        color: new THREE.Color().setHSL(hashToUnitFloat(hashCombine(this.seed, topic.name)), 0.45, 0.5),
        resourceZone: topic.zone,
      };
    });

    if (hasValidPlanetTextures(cacheKey)) {
      const persistent = await loadPlanetTextures(cacheKey);
      if (persistent) {
        this.adoptPersistentTextures(persistent.texture, persistent.displacementMap, persistent.detailTexture);
        geometryCache.set(cacheKey, { regions: this.regions.map((r) => ({ ...r, center: r.center.clone(), color: r.color.clone() })), texture: this.texture!, displacementMap: this.displacementMap!, detailTexture: this.detailTexture! });
        if (this.onTextureUpdate && this.texture && this.displacementMap && this.detailTexture) {
          this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
        }
        return;
      }
    }

    this.generateTexture();
  }

  getRegionForPoint(x: number, y: number, z: number): Region | null {
    if (!this.isLand(x, y, z) || this.regions.length === 0) return null;
    const pt = new THREE.Vector3(x, y, z).normalize();
    let best: Region | null = null;
    let bestDist = Infinity;
    for (const region of this.regions) {
      const dist = pt.distanceToSquared(region.center);
      if (dist < bestDist) {
        bestDist = dist;
        best = region;
      }
    }
    return best;
  }

  getRandomPointForTopic(topic: string, radius: number): [number, number, number] {
    for (let i = 0; i < 400; i++) {
      const u = this.prng();
      const v = this.prng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      const region = this.getRegionForPoint(x, y, z);
      if (region && region.id === topic) return [x * radius, y * radius, z * radius];
    }
    return [radius, 0, 0];
  }

  private getTemperatureAtPoint(x: number, y: number, z: number) {
    const latitude = 1 - Math.abs(y);
    const thermalNoise = this.noise3D(x * 2.1, y * 2.1, z * 2.1) * 0.12;
    return THREE.MathUtils.clamp(latitude + thermalNoise + seededRange(hashCombine(this.seed, 'tempBias'), -0.14, 0.14), 0, 1);
  }

  private getHumidityAtPoint(x: number, y: number, z: number) {
    return THREE.MathUtils.clamp(this.humidityNoise3D(x * 2.5, y * 2.5, z * 2.5) * 0.5 + 0.5 + seededRange(hashCombine(this.seed, 'humidityBias'), -0.14, 0.14), 0, 1);
  }

  getBiomeAtPoint(x: number, y: number, z: number): BiomeName {
    const temperature = this.getTemperatureAtPoint(x, y, z);
    const humidity = this.getHumidityAtPoint(x, y, z);
    const elevation = this.getElevation(x, y, z);

    if (this.visualClass === 'gas_giant') return 'gas_giant';
    if (this.visualClass === 'volcanic') return temperature > 0.35 ? 'volcanic' : 'rocky';
    if (this.visualClass === 'lush_green') return humidity > 0.4 ? 'lush_green' : (temperature < 0.25 ? 'ice' : 'rocky');
    if (this.visualClass === 'ice') return temperature < 0.4 ? 'ice' : 'rocky';

    if (this.visualClass === 'red') return temperature > 0.42 ? 'red' : 'dry_arid';
    if (this.visualClass === 'desert') return humidity < 0.58 ? 'desert' : 'dry_arid';
    if (this.visualClass === 'dry_arid') return elevation > 0.28 ? 'rocky' : 'dry_arid';
    return elevation > 0.22 || humidity < 0.45 ? 'rocky' : 'dry_arid';
  }

  private getBiomePalette() {
    const hueShift = seededRange(hashCombine(this.seed, 'biomeHueShift'), -0.03, 0.03);
    const lightShift = seededRange(hashCombine(this.seed, 'biomeLightShift'), -0.05, 0.05);
    const satShift = seededRange(hashCombine(this.seed, 'biomeSatShift'), -0.08, 0.08);
    const mk = (h: number, s: number, l: number) => new THREE.Color().setHSL((h + hueShift + 1) % 1, THREE.MathUtils.clamp(s + satShift, 0, 1), THREE.MathUtils.clamp(l + lightShift, 0, 1));
    return {
      rocky: mk(0.08, 0.08, 0.48),
      dry_arid: mk(0.11, 0.28, 0.5),
      desert: mk(0.12, 0.52, 0.6),
      red: mk(0.02, 0.55, 0.46),
      volcanic: mk(0.05, 0.15, 0.25), // Dark ash/obsidian
      lush_green: mk(0.3, 0.5, 0.35), // Forest green
      ice: mk(0.55, 0.2, 0.85),       // Pale ice
      gas_giant: mk(0.15, 0.8, 0.5),
      lowland: this.visualClass === 'volcanic' ? mk(0.03, 0.9, 0.55) : // Bright lava
               this.visualClass === 'lush_green' ? mk(0.58, 0.7, 0.4) : // Deep blue ocean
               this.visualClass === 'ice' ? mk(0.55, 0.4, 0.6) :        // Frozen dark sea
               mk(0.1, 0.2, 0.42),
      ridge: mk(0.08, 0.06, 0.68),
      polar: mk(0.56, 0.04, 0.84),
    };
  }

  generateTexture() {
    this.stylized = generateStylizedPlanetTextures(this.visualClass as any, this.seed, 2048, 1024);
    this.canvas = this.stylized.colorCanvas;
    this.dispCanvas = this.stylized.dispCanvas;
    this.detailCanvas = this.stylized.detailCanvas;
    this.texture = this.stylized.colorTexture;
    this.displacementMap = this.stylized.dispTexture;
    this.detailTexture = this.stylized.detailTexture;

    const cacheKey = this.getCacheKey();
    geometryCache.set(cacheKey, {
      regions: this.regions.map((r) => ({ ...r, center: r.center.clone(), color: r.color.clone() })),
      texture: this.texture,
      displacementMap: this.displacementMap,
      detailTexture: this.detailTexture,
    });
    putPlanetTextures(cacheKey, this.canvas, this.dispCanvas, this.detailCanvas);
    if (this.onTextureUpdate) this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
  }
}

export const geographyManager = new GeographyManager();
