import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { clamp01, createPRNG, deriveSeed, hashToUnitFloat, lerp } from '../utils/random';

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
  resourceZone: 'high' | 'mid' | 'low';
}

export interface DeterministicResourceNode {
  id: string;
  type: 'common' | 'rare';
  position: THREE.Vector3;
}

type BiomeType = 'tundra' | 'snow_forest' | 'grassland' | 'forest' | 'desert' | 'jungle' | 'ocean';

interface CachedGeographyData {
  regions: Region[];
  texture: THREE.CanvasTexture;
  displacementMap: THREE.CanvasTexture;
}

const geometryCache = new Map<string, CachedGeographyData>();
const tmpVec = new THREE.Vector3();

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
  private detailNoise3D: (x: number, y: number, z: number) => number;
  private resourceNoise3D: (x: number, y: number, z: number) => number;
  private seed = 'default';
  private biomeSeed = 'default::biome';
  private temperatureBias = 0;
  private humidityBias = 0;

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;
  dispCanvas: HTMLCanvasElement | null = null;
  dispCtx: CanvasRenderingContext2D | null = null;
  dispImgData: ImageData | null = null;

  constructor() {
    this.prng = createPRNG(this.seed);
    this.noise3D = createNoise3D(createPRNG(this.seed));
    this.humidityNoise3D = createNoise3D(createPRNG(deriveSeed(this.seed, 'humidity')));
    this.detailNoise3D = createNoise3D(createPRNG(deriveSeed(this.seed, 'detail')));
    this.resourceNoise3D = createNoise3D(createPRNG(deriveSeed(this.seed, 'resources')));
  }

  private getCacheKey() {
    return `${this.seed}|${this.biomeSeed}|${this.noiseScale}|${this.landThreshold}|${this.temperatureBias}|${this.humidityBias}`;
  }

  setSeed(
    seed: string,
    noiseScale: number = 1.5,
    landThreshold: number = 0.2,
    options?: { biomeSeed?: string; temperatureBias?: number; humidityBias?: number }
  ) {
    const biomeSeed = options?.biomeSeed ?? deriveSeed(seed, 'biome');
    const temperatureBias = options?.temperatureBias ?? 0;
    const humidityBias = options?.humidityBias ?? 0;

    if (
      this.seed !== seed ||
      this.noiseScale !== noiseScale ||
      this.landThreshold !== landThreshold ||
      this.biomeSeed !== biomeSeed ||
      this.temperatureBias !== temperatureBias ||
      this.humidityBias !== humidityBias
    ) {
      this.seed = seed;
      this.biomeSeed = biomeSeed;
      this.noiseScale = noiseScale;
      this.landThreshold = landThreshold;
      this.temperatureBias = temperatureBias;
      this.humidityBias = humidityBias;
      this.prng = createPRNG(seed);
      this.noise3D = createNoise3D(createPRNG(seed));
      this.humidityNoise3D = createNoise3D(createPRNG(deriveSeed(biomeSeed, 'humidity')));
      this.detailNoise3D = createNoise3D(createPRNG(deriveSeed(biomeSeed, 'detail')));
      this.resourceNoise3D = createNoise3D(createPRNG(deriveSeed(seed, 'resources')));
      this.regions = [];
      this.texture = null;
      this.displacementMap = null;
    }
  }

  static warmCache(seed: string, noiseScale: number, landThreshold: number) {
    const manager = new GeographyManager();
    manager.setSeed(seed, noiseScale, landThreshold);
    manager.initializeTopicRegions();
    return manager;
  }

  getTerrain(x: number, y: number, z: number) {
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    let n = this.noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.5 * this.noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    const ridge = this.noise3D(nx * this.noiseScale * 3, ny * this.noiseScale * 3, nz * this.noiseScale * 3);
    n += 0.3 * (1.0 - Math.abs(ridge));
    n += 0.25 * this.detailNoise3D(nx * this.noiseScale * 4, ny * this.noiseScale * 4, nz * this.noiseScale * 4);
    n += 0.125 * this.detailNoise3D(nx * this.noiseScale * 8, ny * this.noiseScale * 8, nz * this.noiseScale * 8);
    return n;
  }

  getElevation(x: number, y: number, z: number) {
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    return Math.pow(Math.max(0, t - this.landThreshold), 1.5);
  }

  getHeightAtPoint(x: number, y: number, z: number, radius: number, displacementScale: number): number {
    if (!this.isLand(x, y, z)) return radius;
    const dispValueNormalized = Math.min(1, this.getElevation(x, y, z) * 170 / 255);
    return radius + dispValueNormalized * displacementScale;
  }

  isLand(x: number, y: number, z: number) {
    return this.getTerrain(x, y, z) > this.landThreshold;
  }

  getLatitude(x: number, y: number, z: number) {
    tmpVec.set(x, y, z).normalize();
    return Math.asin(tmpVec.y) / (Math.PI / 2);
  }

  getTemperature(x: number, y: number, z: number) {
    const latitude = 1 - Math.abs(this.getLatitude(x, y, z));
    const tempNoise = this.detailNoise3D(x * 1.75, y * 1.75, z * 1.75) * 0.18;
    return clamp01(latitude + tempNoise + this.temperatureBias);
  }

  getHumidity(x: number, y: number, z: number) {
    const humidity = this.humidityNoise3D(x * 2.1, y * 2.1, z * 2.1) * 0.5 + 0.5 + this.humidityBias;
    return clamp01(humidity);
  }

  getBiome(x: number, y: number, z: number): BiomeType {
    if (!this.isLand(x, y, z)) return 'ocean';

    const temperature = this.getTemperature(x, y, z);
    const humidity = this.getHumidity(x, y, z);

    if (temperature < 0.33) {
      return humidity < 0.5 ? 'tundra' : 'snow_forest';
    }
    if (temperature < 0.66) {
      return humidity < 0.5 ? 'grassland' : 'forest';
    }
    return humidity < 0.5 ? 'desert' : 'jungle';
  }

  private getBiomeBaseColor(biome: BiomeType) {
    switch (biome) {
      case 'tundra': return new THREE.Color('#93a7a7');
      case 'snow_forest': return new THREE.Color('#d4e1e7');
      case 'grassland': return new THREE.Color('#82a85e');
      case 'forest': return new THREE.Color('#3f6a3c');
      case 'desert': return new THREE.Color('#c9aa62');
      case 'jungle': return new THREE.Color('#2f7a46');
      default: return new THREE.Color('#23354e');
    }
  }

  private getBiomeColor(x: number, y: number, z: number, elevation: number) {
    const biome = this.getBiome(x, y, z);
    if (biome === 'ocean') {
      const waterDepth = clamp01((this.landThreshold - this.getTerrain(x, y, z)) * 0.8 + 0.4);
      return new THREE.Color().setRGB(0.09, 0.15 + waterDepth * 0.05, 0.28 + waterDepth * 0.1);
    }

    const base = this.getBiomeBaseColor(biome);
    const variation = this.detailNoise3D(x * 8, y * 8, z * 8) * 0.08;
    const temperature = this.getTemperature(x, y, z);
    const humidity = this.getHumidity(x, y, z);
    const lift = elevation * 0.32 + temperature * 0.06 - humidity * 0.04 + variation;

    const color = base.clone();
    color.offsetHSL(variation * 0.08, variation * 0.12, lift);
    return color;
  }

  initializeTopicRegions() {
    const cached = geometryCache.get(this.getCacheKey());
    if (cached) {
      this.regions = cached.regions.map((region) => ({ ...region, center: region.center.clone(), color: region.color.clone() }));
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

    this.regions = TOPICS.map((topic, index) => {
      const topicSeed = deriveSeed(this.seed, topic.name);
      const topicPrng = createPRNG(topicSeed);
      let center = new THREE.Vector3(1, 0, 0);

      for (let i = 0; i < 800; i++) {
        const u = topicPrng();
        const v = topicPrng();
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

      const color = new THREE.Color().setHSL((hashToUnitFloat(topicSeed) + index * 0.07) % 1, 0.38, 0.42);
      return {
        id: topic.name,
        hashtag: topic.name,
        center,
        color,
        resourceZone: topic.zone,
      };
    });

    this.generateTexture();
  }

  getRegionForPoint(x: number, y: number, z: number): Region | null {
    if (!this.isLand(x, y, z) || this.regions.length === 0) return null;
    const pt = tmpVec.set(x, y, z).normalize();
    let minDist = Infinity;
    let closestRegion: Region | null = null;
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
    const prng = createPRNG(deriveSeed(this.seed, `topic-point-${topic}`));
    for (let i = 0; i < 800; i++) {
      const u = prng();
      const v = prng();
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

  generateDeterministicResources(radius: number, displacementScale: number = 0.8) {
    const common: DeterministicResourceNode[] = [];
    const rare: DeterministicResourceNode[] = [];
    const sampleSteps = 92;
    const rareNoise3D = createNoise3D(createPRNG(deriveSeed(this.seed, 'resource-rare')));
    const commonNoise3D = createNoise3D(createPRNG(deriveSeed(this.seed, 'resource-common')));

    for (let yIndex = 0; yIndex <= sampleSteps; yIndex++) {
      const v = yIndex / sampleSteps;
      const phi = v * Math.PI;
      const ringSteps = Math.max(24, Math.floor(Math.sin(phi) * sampleSteps * 2));

      for (let xIndex = 0; xIndex < ringSteps; xIndex++) {
        const u = xIndex / ringSteps;
        const theta = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);

        if (!this.isLand(nx, ny, nz)) continue;

        const rareNoise = rareNoise3D(nx * 3.2, ny * 3.2, nz * 3.2) * 0.5 + 0.5;
        const commonNoise = commonNoise3D(nx * 4.4, ny * 4.4, nz * 4.4) * 0.5 + 0.5;

        const worldPos = new THREE.Vector3(nx, ny, nz).multiplyScalar(this.getHeightAtPoint(nx, ny, nz, radius, displacementScale));
        const cellKey = `${yIndex}_${xIndex}`;

        if (rareNoise > 0.85) {
          rare.push({ id: `res_${this.seed}_rare_${cellKey}`, type: 'rare', position: worldPos });
        } else if (commonNoise > 0.70) {
          common.push({ id: `res_${this.seed}_common_${cellKey}`, type: 'common', position: worldPos });
        }
      }
    }

    return [...common, ...rare];
  }

  generateTexture() {
    const width = 2048;
    const height = 1024;

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

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI;
      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2;
        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);
        const idx = (y * width + x) * 4;
        const elevation = this.getElevation(px, py, pz);
        const dispValue = Math.min(255, Math.floor(elevation * 170));

        dispData[idx] = dispValue;
        dispData[idx + 1] = dispValue;
        dispData[idx + 2] = dispValue;
        dispData[idx + 3] = 255;

        const color = this.getBiomeColor(px, py, pz, elevation);
        data[idx] = Math.round(clamp01(color.r) * 255);
        data[idx + 1] = Math.round(clamp01(color.g) * 255);
        data[idx + 2] = Math.round(clamp01(color.b) * 255);
        data[idx + 3] = 255;
      }
    }

    this.ctx!.putImageData(this.imgData!, 0, 0);
    this.dispCtx!.putImageData(this.dispImgData!, 0, 0);

    this.texture = new THREE.CanvasTexture(this.canvas!);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    this.displacementMap = new THREE.CanvasTexture(this.dispCanvas!);
    this.displacementMap.needsUpdate = true;

    geometryCache.set(this.getCacheKey(), {
      regions: this.regions.map((region) => ({ ...region, center: region.center.clone(), color: region.color.clone() })),
      texture: this.texture,
      displacementMap: this.displacementMap,
    });

    if (this.onTextureUpdate && this.texture && this.displacementMap) {
      this.onTextureUpdate(this.texture, this.displacementMap);
    }
  }
}

export const geographyManager = new GeographyManager();
