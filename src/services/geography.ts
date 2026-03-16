import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG, hashCombine, hashToUnitFloat, seededRange } from '../utils/random';

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
  resourceZone: 'high' | 'mid' | 'low';
}

interface CachedGeographyData {
  regions: Region[];
  texture: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
}

type TextureDetail = 'standard' | 'enhanced';

type BiomeName = 'tundra' | 'snow_forest' | 'grassland' | 'forest' | 'desert' | 'jungle';

const geometryCache = new Map<string, CachedGeographyData>();

export class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;
  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  onTextureUpdate: ((texture: THREE.CanvasTexture, displacementMap: THREE.CanvasTexture) => void) | null = null;

  private prng: () => number;
  private noise3D: (x: number, y: number, z: number) => number;
  private humidityNoise3D: (x: number, y: number, z: number) => number;
  private seed = 'default';
  private textureDetail: TextureDetail = 'enhanced';

  constructor() {
    this.prng = createPRNG(this.seed);
    this.noise3D = createNoise3D(this.prng);
    this.humidityNoise3D = createNoise3D(createPRNG(hashCombine(this.seed, 'humidity')));
  }

  private getCacheKey(seed = this.seed, noiseScale = this.noiseScale, landThreshold = this.landThreshold, textureDetail = this.textureDetail) {
    return `${seed}|${noiseScale}|${landThreshold}|${textureDetail}`;
  }

  setSeed(seed: string, noiseScale: number = 1.5, landThreshold: number = 0.2, textureDetail: TextureDetail = 'enhanced') {
    if (this.seed !== seed || this.noiseScale !== noiseScale || this.landThreshold !== landThreshold || this.textureDetail !== textureDetail) {
      this.seed = seed;
      this.noiseScale = noiseScale;
      this.landThreshold = landThreshold;
      this.prng = createPRNG(seed);
      this.textureDetail = textureDetail;
      this.noise3D = createNoise3D(this.prng);
      this.humidityNoise3D = createNoise3D(createPRNG(hashCombine(seed, 'humidity')));
      this.regions = [];
      this.texture = null;
      this.displacementMap = null;
    }
  }

  static warmCache(seed: string, noiseScale: number, landThreshold: number, textureDetail: TextureDetail = 'enhanced') {
    const manager = new GeographyManager();
    manager.setSeed(seed, noiseScale, landThreshold, textureDetail);
    manager.initializeTopicRegions();
    return manager;
  }

  getTerrain(x: number, y: number, z: number) {
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    let n = this.noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.55 * this.noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    const ridge = this.noise3D(nx * this.noiseScale * 3, ny * this.noiseScale * 3, nz * this.noiseScale * 3);
    n += 0.28 * (1.0 - Math.abs(ridge));
    n += 0.18 * this.noise3D(nx * this.noiseScale * 5, ny * this.noiseScale * 5, nz * this.noiseScale * 5);
    return n;
  }

  getElevation(x: number, y: number, z: number) {
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    let elevation = Math.max(0, t - this.landThreshold);
    elevation = Math.pow(elevation, 1.65);
    return elevation;
  }

  getHeightAtPoint(x: number, y: number, z: number, radius: number, displacementScale: number): number {
    if (!this.isLand(x, y, z)) return radius;
    const elevation = this.getElevation(x, y, z);
    const dispValueNormalized = Math.min(1, elevation * 170 / 255);
    return radius + dispValueNormalized * displacementScale;
  }

  isLand(x: number, y: number, z: number) {
    return this.getTerrain(x, y, z) > this.landThreshold;
  }

  initializeTopicRegions() {
    const cached = geometryCache.get(this.getCacheKey());
    if (cached) {
      this.regions = cached.regions.map((region) => ({
        ...region,
        center: region.center.clone(),
        color: region.color.clone(),
      }));
      this.texture = cached.texture;
      this.displacementMap = cached.displacementMap;
      if (this.onTextureUpdate && this.texture && this.displacementMap) {
        this.onTextureUpdate(this.texture, this.displacementMap);
      }
      return;
    }

    if (this.regions.length > 0 && this.texture && this.displacementMap) return;

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
          const pt = new THREE.Vector3(x, y, z);
          const tooClose = newRegions.some((r) => pt.distanceToSquared(r.center) < 0.4);
          if (!tooClose) {
            center = pt;
            break;
          }
        }
      }

      const color = new THREE.Color().setHSL(hashToUnitFloat(hashCombine(this.seed, topic.name)), 0.55, 0.5);
      newRegions.push({
        id: topic.name,
        hashtag: topic.name,
        center,
        color,
        resourceZone: topic.zone,
      });
    }

    this.regions = newRegions;
    this.generateTexture();
  }

  getRegionForPoint(x: number, y: number, z: number): Region | null {
    if (!this.isLand(x, y, z) || this.regions.length === 0) return null;
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
      if (region && region.id === topic) return [x * radius, y * radius, z * radius];
    }

    for (let i = 0; i < 500; i++) {
      const u = this.prng();
      const v = this.prng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      if (this.isLand(x, y, z)) return [x * radius, y * radius, z * radius];
    }

    return [radius, 0, 0];
  }

  private getTemperatureAtPoint(x: number, y: number, z: number) {
    const latitude = 1 - Math.abs(y);
    const thermalNoise = this.noise3D(x * 2.2, y * 2.2, z * 2.2) * 0.18;
    const seedBias = seededRange(hashCombine(this.seed, 'tempBias'), -0.18, 0.18);
    return THREE.MathUtils.clamp(latitude + thermalNoise + seedBias, 0, 1);
  }

  private getHumidityAtPoint(x: number, y: number, z: number) {
    const humidity = this.humidityNoise3D(x * 2.8, y * 2.8, z * 2.8) * 0.5 + 0.5;
    const extra = this.humidityNoise3D(x * 6.2, y * 6.2, z * 6.2) * 0.12;
    const seedBias = seededRange(hashCombine(this.seed, 'humidityBias'), -0.18, 0.18);
    return THREE.MathUtils.clamp(humidity + extra + seedBias, 0, 1);
  }

  getBiomeAtPoint(x: number, y: number, z: number): BiomeName {
    const temperature = this.getTemperatureAtPoint(x, y, z);
    const humidity = this.getHumidityAtPoint(x, y, z);
    const tempBand = temperature < 0.33 ? 'cold' : temperature < 0.66 ? 'temperate' : 'hot';
    const humidityBand = humidity < 0.5 ? 'dry' : 'wet';

    if (tempBand === 'cold' && humidityBand === 'dry') return 'tundra';
    if (tempBand === 'cold' && humidityBand === 'wet') return 'snow_forest';
    if (tempBand === 'temperate' && humidityBand === 'dry') return 'grassland';
    if (tempBand === 'temperate' && humidityBand === 'wet') return 'forest';
    if (tempBand === 'hot' && humidityBand === 'dry') return 'desert';
    return 'jungle';
  }

  private getBiomePalette() {
    const hueShift = seededRange(hashCombine(this.seed, 'biomeHueShift'), -0.06, 0.06);
    const lightShift = seededRange(hashCombine(this.seed, 'biomeLightShift'), -0.08, 0.08);
    const satShift = seededRange(hashCombine(this.seed, 'biomeSatShift'), -0.1, 0.1);
    const mk = (h: number, s: number, l: number) => new THREE.Color().setHSL(
      (h + hueShift + 1) % 1,
      THREE.MathUtils.clamp(s + satShift, 0, 1),
      THREE.MathUtils.clamp(l + lightShift, 0, 1)
    );
    return {
      tundra: mk(0.14, 0.22, 0.66),
      snow_forest: mk(0.54, 0.26, 0.77),
      grassland: mk(0.26, 0.42, 0.48),
      forest: mk(0.32, 0.5, 0.34),
      desert: mk(0.11, 0.55, 0.58),
      jungle: mk(0.36, 0.62, 0.3),
      waterDeep: mk(0.58, 0.55, 0.18),
      waterShallow: mk(0.54, 0.48, 0.32),
      shoreline: mk(0.13, 0.45, 0.68),
      mountain: mk(0.08, 0.12, 0.62),
      snowCap: mk(0.56, 0.12, 0.9),
    };
  }

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;
  dispCanvas: HTMLCanvasElement | null = null;
  dispCtx: CanvasRenderingContext2D | null = null;
  dispImgData: ImageData | null = null;

  generateTexture() {
    const width = this.textureDetail === 'enhanced' ? 1536 : 1024;
    const height = this.textureDetail === 'enhanced' ? 768 : 512;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d')!;
      this.imgData = this.ctx.createImageData(width, height);

      this.dispCanvas = document.createElement('canvas');
      this.dispCanvas.width = width;
      this.dispCanvas.height = height;
      this.dispCtx = this.dispCanvas.getContext('2d')!;
      this.dispImgData = this.dispCtx.createImageData(width, height);
    }

    const data = this.imgData!.data;
    const dispData = this.dispImgData!.data;
    const palette = this.getBiomePalette();

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI;
      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2;
        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);
        const idx = (y * width + x) * 4;
        const elevation = this.getElevation(px, py, pz);

        if (!this.isLand(px, py, pz)) {
          const coastFactor = THREE.MathUtils.clamp((this.getTerrain(px, py, pz) - this.landThreshold + 0.12) / 0.12, 0, 1);
          const color = palette.waterDeep.clone().lerp(palette.waterShallow, coastFactor);
          const wave = this.noise3D(px * 14, py * 14, pz * 14) * 0.05;
          color.offsetHSL(0, 0, wave);
          data[idx] = Math.round(color.r * 255);
          data[idx + 1] = Math.round(color.g * 255);
          data[idx + 2] = Math.round(color.b * 255);
          data[idx + 3] = 255;
          dispData[idx] = 0;
          dispData[idx + 1] = 0;
          dispData[idx + 2] = 0;
          dispData[idx + 3] = 255;
          continue;
        }

        const dispValue = Math.min(255, Math.floor(elevation * 180));
        dispData[idx] = dispValue;
        dispData[idx + 1] = dispValue;
        dispData[idx + 2] = dispValue;
        dispData[idx + 3] = 255;

        const biome = this.getBiomeAtPoint(px, py, pz);
        const base = palette[biome].clone();
        const region = this.getRegionForPoint(px, py, pz);
        const detail = this.noise3D(px * 28, py * 28, pz * 28) * 0.08;
        const micro = this.noise3D(px * 54, py * 54, pz * 54) * 0.05 + this.noise3D(px * 92, py * 92, pz * 92) * 0.02;
        const humidity = this.getHumidityAtPoint(px, py, pz);
        const temperature = this.getTemperatureAtPoint(px, py, pz);

        if (elevation > 0.46) {
          base.lerp(palette.mountain, THREE.MathUtils.clamp((elevation - 0.46) * 1.8, 0, 1));
        }
        if (Math.abs(py) > 0.82 || (temperature < 0.18 && elevation > 0.2)) {
          base.lerp(palette.snowCap, THREE.MathUtils.clamp((Math.abs(py) - 0.82) * 4 + elevation * 0.4, 0, 1));
        }
        if (elevation < 0.04) {
          base.lerp(palette.shoreline, 0.45 - elevation * 6);
        }
        if (region) {
          base.lerp(region.color, region.resourceZone === 'high' ? 0.12 : region.resourceZone === 'mid' ? 0.07 : 0.04);
        }
        base.offsetHSL(
          this.noise3D(px * 8, py * 8, pz * 8) * 0.015,
          this.noise3D(px * 12, py * 12, pz * 12) * 0.035,
          micro
        );

        const shade = 0.95 + elevation * 0.85 + humidity * 0.06 - (1 - temperature) * 0.04 + detail + micro;
        data[idx] = Math.max(0, Math.min(255, Math.round(base.r * 255 * shade)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255 * shade)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255 * shade)));
        data[idx + 3] = 255;
      }
    }

    this.ctx!.putImageData(this.imgData!, 0, 0);
    this.dispCtx!.putImageData(this.dispImgData!, 0, 0);

    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.displacementMap = new THREE.CanvasTexture(this.dispCanvas!);
    }

    this.texture.needsUpdate = true;
    this.displacementMap!.needsUpdate = true;

    geometryCache.set(this.getCacheKey(), {
      regions: this.regions.map((region) => ({
        ...region,
        center: region.center.clone(),
        color: region.color.clone(),
      })),
      texture: this.texture,
      displacementMap: this.displacementMap!,
    });

    if (this.onTextureUpdate) {
      this.onTextureUpdate(this.texture, this.displacementMap!);
    }
  }
}

export const geographyManager = new GeographyManager();
