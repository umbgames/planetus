import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG, hashCombine, hashToUnitFloat, seededRange } from '../utils/random';
import {
  hasValidPlanetTextures,
  loadPlanetTextures,
  putPlanetTextures,
} from './planetTextureCache';

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
  detailTexture: THREE.CanvasTexture;
}

type TextureDetail = 'standard' | 'enhanced';
type VisualClass = 'lush' | 'oceanic' | 'desert' | 'arid_rocky' | 'barren_gray' | 'icy' | 'volcanic';
type BiomeName = 'tundra' | 'snow_forest' | 'grassland' | 'forest' | 'desert' | 'jungle';

const geometryCache = new Map<string, CachedGeographyData>();

export class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;

  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  detailTexture: THREE.CanvasTexture | null = null;

  onTextureUpdate: ((
    texture: THREE.CanvasTexture,
    displacementMap: THREE.CanvasTexture,
    detailTexture: THREE.CanvasTexture
  ) => void) | null = null;

  private prng: () => number;
  private noise3D: (x: number, y: number, z: number) => number;
  private humidityNoise3D: (x: number, y: number, z: number) => number;
  private seed = 'default';
  private textureDetail: TextureDetail = 'enhanced';
  private visualClass: VisualClass = 'lush';

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

  private getCacheKey(
    seed = this.seed,
    noiseScale = this.noiseScale,
    landThreshold = this.landThreshold,
    textureDetail = this.textureDetail,
    visualClass = this.visualClass
  ) {
    return `${seed}|${noiseScale}|${landThreshold}|${textureDetail}|${visualClass}`;
  }

  private configureTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }

  private configureDisplacementTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
  }

  private adoptPersistentTextures(
    texture: THREE.Texture,
    displacementMap: THREE.Texture,
    detailTexture: THREE.Texture
  ) {
    this.texture = texture as THREE.CanvasTexture;
    this.displacementMap = displacementMap as THREE.CanvasTexture;
    this.detailTexture = detailTexture as THREE.CanvasTexture;

    this.configureTexture(this.texture, false);
    this.configureDisplacementTexture(this.displacementMap, false);
    this.configureTexture(this.detailTexture, true);
  }

  setSeed(
    seed: string,
    noiseScale: number = 1.5,
    landThreshold: number = 0.2,
    textureDetail: TextureDetail = 'enhanced',
    visualClass: VisualClass = 'lush'
  ) {
    if (
      this.seed !== seed ||
      this.noiseScale !== noiseScale ||
      this.landThreshold !== landThreshold ||
      this.textureDetail !== textureDetail ||
      this.visualClass !== visualClass
    ) {
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
    }
  }

  static warmCache(
    seed: string,
    noiseScale: number,
    landThreshold: number,
    textureDetail: TextureDetail = 'enhanced',
    visualClass: VisualClass = 'lush'
  ) {
    const manager = new GeographyManager();
    manager.setSeed(seed, noiseScale, landThreshold, textureDetail, visualClass);
    void manager.initializeTopicRegions();
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

  async initializeTopicRegions() {
    const memoryCached = geometryCache.get(this.getCacheKey());
    if (memoryCached) {
      this.regions = memoryCached.regions.map((region) => ({
        ...region,
        center: region.center.clone(),
        color: region.color.clone(),
      }));
      this.texture = memoryCached.texture;
      this.displacementMap = memoryCached.displacementMap;
      this.detailTexture = memoryCached.detailTexture;

      if (this.onTextureUpdate && this.texture && this.displacementMap && this.detailTexture) {
        this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
      }
      return;
    }

    if (this.regions.length > 0 && this.texture && this.displacementMap && this.detailTexture) {
      return;
    }

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

    const cacheKey = this.getCacheKey();
    if (hasValidPlanetTextures(cacheKey)) {
      const persistent = await loadPlanetTextures(cacheKey);
      if (persistent) {
        this.adoptPersistentTextures(
          persistent.texture,
          persistent.displacementMap,
          persistent.detailTexture
        );

        geometryCache.set(cacheKey, {
          regions: this.regions.map((region) => ({
            ...region,
            center: region.center.clone(),
            color: region.color.clone(),
          })),
          texture: this.texture,
          displacementMap: this.displacementMap,
          detailTexture: this.detailTexture,
        });

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

    const mk = (h: number, s: number, l: number) =>
      new THREE.Color().setHSL(
        (h + hueShift + 1) % 1,
        THREE.MathUtils.clamp(s + satShift, 0, 1),
        THREE.MathUtils.clamp(l + lightShift, 0, 1)
      );

    const visualTweaks: Record<VisualClass, { hue: number; sat: number; light: number; waterHue: number; waterLight: number }> = {
      lush: { hue: 0.0, sat: 0.12, light: 0.02, waterHue: 0.0, waterLight: 0.0 },
      oceanic: { hue: -0.03, sat: 0.08, light: 0.04, waterHue: -0.04, waterLight: 0.06 },
      desert: { hue: -0.02, sat: 0.08, light: 0.1, waterHue: -0.02, waterLight: -0.02 },
      arid_rocky: { hue: -0.01, sat: -0.08, light: -0.02, waterHue: 0.01, waterLight: -0.04 },
      barren_gray: { hue: 0.0, sat: -0.24, light: -0.02, waterHue: 0.0, waterLight: -0.08 },
      icy: { hue: 0.04, sat: -0.12, light: 0.14, waterHue: 0.04, waterLight: 0.12 },
      volcanic: { hue: -0.06, sat: 0.1, light: -0.08, waterHue: -0.06, waterLight: -0.12 },
    };

    const tweak = visualTweaks[this.visualClass];
    const tint = (color: THREE.Color, isWater = false) => {
      const next = color.clone();
      next.offsetHSL(
        tweak.hue + (isWater ? tweak.waterHue : 0),
        tweak.sat,
        tweak.light + (isWater ? tweak.waterLight : 0)
      );
      return next;
    };

    return {
      tundra: tint(mk(0.14, 0.22, 0.66)),
      snow_forest: tint(mk(0.54, 0.26, 0.77)),
      grassland: tint(mk(0.26, 0.42, 0.48)),
      forest: tint(mk(0.32, 0.5, 0.34)),
      desert: tint(mk(0.11, 0.55, 0.58)),
      jungle: tint(mk(0.36, 0.62, 0.3)),
      waterDeep: tint(mk(0.58, 0.55, 0.18), true),
      waterShallow: tint(mk(0.54, 0.48, 0.32), true),
      shoreline: tint(mk(0.13, 0.45, 0.68)),
      mountain: tint(mk(0.08, 0.12, 0.62)),
      snowCap: tint(mk(0.56, 0.12, 0.9)),
    };
  }

  generateTexture() {
    const width = this.textureDetail === 'enhanced' ? 2048 : 1024;
    const height = this.textureDetail === 'enhanced' ? 1024 : 512;

    const detailWidth = this.textureDetail === 'enhanced' ? 1024 : 512;
    const detailHeight = this.textureDetail === 'enhanced' ? 1024 : 512;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }

    if (!this.dispCanvas) {
      this.dispCanvas = document.createElement('canvas');
      this.dispCtx = this.dispCanvas.getContext('2d')!;
    }

    if (!this.detailCanvas) {
      this.detailCanvas = document.createElement('canvas');
      this.detailCtx = this.detailCanvas.getContext('2d')!;
    }

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d')!;
      this.imgData = this.ctx.createImageData(width, height);
      this.texture = null;
    } else if (!this.imgData) {
      this.imgData = this.ctx.createImageData(width, height);
    }

    if (this.dispCanvas.width !== width || this.dispCanvas.height !== height) {
      this.dispCanvas.width = width;
      this.dispCanvas.height = height;
      this.dispCtx = this.dispCanvas.getContext('2d')!;
      this.dispImgData = this.dispCtx.createImageData(width, height);
      this.displacementMap = null;
    } else if (!this.dispImgData) {
      this.dispImgData = this.dispCtx.createImageData(width, height);
    }

    if (this.detailCanvas.width !== detailWidth || this.detailCanvas.height !== detailHeight) {
      this.detailCanvas.width = detailWidth;
      this.detailCanvas.height = detailHeight;
      this.detailCtx = this.detailCanvas.getContext('2d')!;
      this.detailImgData = this.detailCtx.createImageData(detailWidth, detailHeight);
      this.detailTexture = null;
    } else if (!this.detailImgData) {
      this.detailImgData = this.detailCtx.createImageData(detailWidth, detailHeight);
    }

    const data = this.imgData.data;
    const dispData = this.dispImgData!.data;
    const detailData = this.detailImgData!.data;
    const palette = this.getBiomePalette();

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const phi = v * Math.PI;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const theta = u * Math.PI * 2;

        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);

        const idx = (y * width + x) * 4;
        const terrain = this.getTerrain(px, py, pz);
        const elevation = this.getElevation(px, py, pz);

        if (terrain <= this.landThreshold) {
          const coastFactor = THREE.MathUtils.clamp(
            (terrain - this.landThreshold + 0.14) / 0.14,
            0,
            1
          );

          const waveLarge = this.noise3D(px * 10, py * 10, pz * 10) * 0.04;
          const waveFine = this.noise3D(px * 28, py * 28, pz * 28) * 0.025;

          const color = palette.waterDeep.clone().lerp(palette.waterShallow, coastFactor);
          color.offsetHSL(0, 0, waveLarge + waveFine);

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

        const dispValue = Math.min(255, Math.floor(elevation * 200));
        dispData[idx] = dispValue;
        dispData[idx + 1] = dispValue;
        dispData[idx + 2] = dispValue;
        dispData[idx + 3] = 255;

        const biome = this.getBiomeAtPoint(px, py, pz);
        const base = palette[biome].clone();
        const region = this.getRegionForPoint(px, py, pz);

        const humidity = this.getHumidityAtPoint(px, py, pz);
        const temperature = this.getTemperatureAtPoint(px, py, pz);

        const detailLarge = this.noise3D(px * 18, py * 18, pz * 18) * 0.05;
        const detailMid = this.noise3D(px * 40, py * 40, pz * 40) * 0.05;
        const detailFine = this.noise3D(px * 90, py * 90, pz * 90) * 0.03;
        const detailMicro = this.noise3D(px * 160, py * 160, pz * 160) * 0.018;

        if (elevation > 0.46) {
          base.lerp(
            palette.mountain,
            THREE.MathUtils.clamp((elevation - 0.46) * 2.1, 0, 1)
          );
        }

        if (Math.abs(py) > 0.82 || (temperature < 0.18 && elevation > 0.2)) {
          base.lerp(
            palette.snowCap,
            THREE.MathUtils.clamp((Math.abs(py) - 0.82) * 4 + elevation * 0.45, 0, 1)
          );
        }

        if (elevation < 0.05) {
          base.lerp(
            palette.shoreline,
            THREE.MathUtils.clamp(0.52 - elevation * 7, 0, 0.52)
          );
        }

        if (region) {
          base.lerp(
            region.color,
            region.resourceZone === 'high' ? 0.14 : region.resourceZone === 'mid' ? 0.08 : 0.045
          );
        }

        base.offsetHSL(
          this.noise3D(px * 10, py * 10, pz * 10) * 0.012,
          detailMid * 0.22,
          detailLarge + detailMid + detailFine + detailMicro
        );

        const localContrast =
          elevation * 0.95 +
          humidity * 0.05 -
          (1 - temperature) * 0.035 +
          detailLarge +
          detailMid +
          detailFine;

        const shade = 0.92 + localContrast;

        data[idx] = Math.max(0, Math.min(255, Math.round(base.r * 255 * shade)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255 * shade)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255 * shade)));
        data[idx + 3] = 255;
      }
    }

    for (let y = 0; y < detailHeight; y++) {
      const v = y / detailHeight;

      for (let x = 0; x < detailWidth; x++) {
        const u = x / detailWidth;

        const nx = Math.cos(u * Math.PI * 2);
        const ny = Math.sin(v * Math.PI * 2);
        const nz = Math.sin((u + v) * Math.PI);

        const idx = (y * detailWidth + x) * 4;

        const terrainA = this.noise3D(nx * 14, ny * 14, nz * 14);
        const terrainB = this.noise3D(nx * 32, ny * 32, nz * 32);
        const terrainC = this.noise3D(nx * 68, ny * 68, nz * 68);
        const terrainD = this.noise3D(nx * 132, ny * 132, nz * 132);

        const humidity = this.humidityNoise3D(nx * 9, ny * 9, nz * 9) * 0.5 + 0.5;
        const mask = THREE.MathUtils.clamp(terrainA * 0.5 + 0.5, 0, 1);

        const dryColor = new THREE.Color(0.43, 0.39, 0.28);
        const lushColor = new THREE.Color(0.22, 0.34, 0.18);
        const rockColor = new THREE.Color(0.5, 0.48, 0.46);
        const sandColor = new THREE.Color(0.62, 0.56, 0.4);

        const base = dryColor.clone().lerp(lushColor, humidity * 0.75);
        base.lerp(sandColor, THREE.MathUtils.clamp((terrainB * -0.5) + 0.25, 0, 0.35));
        base.lerp(rockColor, THREE.MathUtils.clamp(terrainC * 0.5 + terrainD * 0.35, 0, 0.5));

        const brightness = 0.88 + terrainB * 0.14 + terrainC * 0.08 + terrainD * 0.05;
        base.multiplyScalar(brightness * (0.92 + mask * 0.12));

        detailData[idx] = Math.max(0, Math.min(255, Math.round(base.r * 255)));
        detailData[idx + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255)));
        detailData[idx + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255)));
        detailData[idx + 3] = 255;
      }
    }

    this.ctx!.putImageData(this.imgData, 0, 0);
    this.dispCtx!.putImageData(this.dispImgData!, 0, 0);
    this.detailCtx!.putImageData(this.detailImgData!, 0, 0);

    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
    }
    this.configureTexture(this.texture, false);

    if (!this.displacementMap) {
      this.displacementMap = new THREE.CanvasTexture(this.dispCanvas!);
    }
    this.configureDisplacementTexture(this.displacementMap, false);

    if (!this.detailTexture) {
      this.detailTexture = new THREE.CanvasTexture(this.detailCanvas!);
    }
    this.configureTexture(this.detailTexture, true);

    const cacheKey = this.getCacheKey();

    geometryCache.set(cacheKey, {
      regions: this.regions.map((region) => ({
        ...region,
        center: region.center.clone(),
        color: region.color.clone(),
      })),
      texture: this.texture,
      displacementMap: this.displacementMap,
      detailTexture: this.detailTexture,
    });

    if (this.canvas && this.dispCanvas && this.detailCanvas) {
      putPlanetTextures(cacheKey, this.canvas, this.dispCanvas, this.detailCanvas);
    }

    if (this.onTextureUpdate) {
      this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
    }
  }
}

export const geographyManager = new GeographyManager();
