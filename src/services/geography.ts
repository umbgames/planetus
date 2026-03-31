import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG, hashCombine, hashToUnitFloat, seededRange } from '../utils/random';
import { hasValidPlanetTextures, loadPlanetTextures, putPlanetTextures } from './planetTextureCache';

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
export type BiomeName = 'rocky' | 'dry_arid' | 'desert' | 'red' | 'volcanic' | 'lush_green' | 'ice' | 'gas_giant';

const geometryCache = new Map<string, CachedGeographyData>();

export class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;

  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  detailTexture: THREE.CanvasTexture | null = null;

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
    return `flat-v3|${seed}|${noiseScale}|${landThreshold}|${textureDetail}|${visualClass}`;
  }

  private configureTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.needsUpdate = true;
  }

  private configureDisplacementTexture(tex: THREE.CanvasTexture, repeat = false) {
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 1;
    tex.needsUpdate = true;
  }

  private adoptPersistentTextures(texture: THREE.Texture, displacementMap: THREE.Texture, detailTexture: THREE.Texture) {
    this.texture = texture as THREE.CanvasTexture;
    this.displacementMap = displacementMap as THREE.CanvasTexture;
    this.detailTexture = detailTexture as THREE.CanvasTexture;
    this.configureTexture(this.texture, false);
    this.configureDisplacementTexture(this.displacementMap, false);
    this.configureTexture(this.detailTexture, true);
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

  getTerrain(x: number, y: number, z: number) {
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
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    return Math.pow(Math.max(0, t - this.landThreshold), 1.45);
  }

  getHeightAtPoint(x: number, y: number, z: number, radius: number, displacementScale: number): number {
    if (!this.isLand(x, y, z)) return radius;
    return radius + Math.min(1, this.getElevation(x, y, z) * 170 / 255) * displacementScale;
  }

  isLand(x: number, y: number, z: number) {
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
    const width = this.textureResolution?.width ?? 2048;
    const height = this.textureResolution?.height ?? 1024;
    const detailWidth = 32;
    const detailHeight = 32;

    if (!this.canvas) { this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d')!; }
    if (!this.dispCanvas) { this.dispCanvas = document.createElement('canvas'); this.dispCtx = this.dispCanvas.getContext('2d')!; }
    if (!this.detailCanvas) { this.detailCanvas = document.createElement('canvas'); this.detailCtx = this.detailCanvas.getContext('2d')!; }

    this.canvas.width = width; this.canvas.height = height; this.imgData = this.ctx!.createImageData(width, height);
    this.dispCanvas.width = width; this.dispCanvas.height = height; this.dispImgData = this.dispCtx!.createImageData(width, height);
    this.detailCanvas.width = detailWidth; this.detailCanvas.height = detailHeight; this.detailImgData = this.detailCtx!.createImageData(detailWidth, detailHeight);

    const data = this.imgData.data;
    const dispData = this.dispImgData.data;
    const detailData = this.detailImgData.data;
    const palette = this.getBiomePalette();

    if (this.visualClass === 'gas_giant') {
      const baseHue = hashToUnitFloat(hashCombine(this.seed, 'gasH'));
      const baseSat = 0.55 + hashToUnitFloat(hashCombine(this.seed, 'gasS')) * 0.35;
      // 5 band colors for dramatic contrast
      const color1 = new THREE.Color().setHSL(baseHue, baseSat, 0.52);
      const color2 = new THREE.Color().setHSL((baseHue + 0.04) % 1, baseSat + 0.15, 0.32);
      const color3 = new THREE.Color().setHSL((baseHue - 0.06 + 1) % 1, baseSat * 0.6, 0.72);
      const color4 = new THREE.Color().setHSL((baseHue + 0.12) % 1, baseSat + 0.1, 0.25);
      const color5 = new THREE.Color().setHSL((baseHue - 0.03 + 1) % 1, baseSat * 0.9, 0.58);
      const stormHue = (baseHue + 0.02) % 1;
      const stormColor = new THREE.Color().setHSL(stormHue, 0.85, 0.65);

      // Pre-calculate storm center positions (Great Red Spot like features)
      const stormCount = 2 + Math.floor(hashToUnitFloat(hashCombine(this.seed, 'stormN')) * 3);
      const storms: { lat: number; lon: number; size: number }[] = [];
      for (let s = 0; s < stormCount; s++) {
        storms.push({
          lat: (hashToUnitFloat(hashCombine(this.seed, `stormLat${s}`)) - 0.5) * 1.2,
          lon: hashToUnitFloat(hashCombine(this.seed, `stormLon${s}`)) * Math.PI * 2,
          size: 0.06 + hashToUnitFloat(hashCombine(this.seed, `stormSz${s}`)) * 0.14,
        });
      }

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

          // Multi-octave turbulence for realistic chaotic flow
          const turb1 = this.noise3D(px * 2, py * 14, pz * 2);
          const turb2 = this.noise3D(px * 4.5, py * 9, pz * 4.5) * 0.5;
          const turb3 = this.noise3D(px * 9, py * 5, pz * 9) * 0.25;
          const turbulence = turb1 + turb2 + turb3;

          // Banded structure: many tight bands distorted by turbulence  
          const bandFreq = 28 + hashToUnitFloat(hashCombine(this.seed, 'bandF')) * 12;
          const distortedLat = py * bandFreq + turbulence * 4.5;
          const bandValue = Math.sin(distortedLat) * 0.5 + 0.5;

          // Swirl distortion for jet streams
          const swirlX = this.noise3D(px * 6, py * 3, pz * 6) * 0.4;
          const swirlZ = this.noise3D(px * 5, py * 3.5, pz * 5) * 0.4;
          const jetStream = this.noise3D((px + swirlX) * 3, py * 18, (pz + swirlZ) * 3) * 0.5 + 0.5;

          // Combine band pattern with jet streams
          const mix = bandValue * 0.6 + jetStream * 0.4;

          // 5-color banding with smooth transitions
          const base = color1.clone();
          if (mix < 0.2) {
            base.lerpColors(color4, color2, mix / 0.2);
          } else if (mix < 0.4) {
            base.lerpColors(color2, color1, (mix - 0.2) / 0.2);
          } else if (mix < 0.6) {
            base.lerpColors(color1, color5, (mix - 0.4) / 0.2);
          } else if (mix < 0.8) {
            base.lerpColors(color5, color3, (mix - 0.6) / 0.2);
          } else {
            base.lerpColors(color3, color4, (mix - 0.8) / 0.2);
          }

          // Fine detail turbulence for micro-texture
          const microDetail = this.noise3D(px * 22, py * 22, pz * 22) * 0.06;
          base.r = THREE.MathUtils.clamp(base.r + microDetail, 0, 1);
          base.g = THREE.MathUtils.clamp(base.g + microDetail * 0.8, 0, 1);
          base.b = THREE.MathUtils.clamp(base.b + microDetail * 0.6, 0, 1);

          // Great storms (oval vortices)
          for (const storm of storms) {
            const dlat = py - storm.lat;
            const dlon = Math.atan2(pz, px) - storm.lon;
            const stormDist = Math.sqrt(dlat * dlat * 4 + dlon * dlon) / storm.size;
            if (stormDist < 1.0) {
              const stormIntensity = Math.pow(1 - stormDist, 2.5);
              // Spiral arms around storm
              const spiralAngle = Math.atan2(dlat, dlon) + stormDist * 6;
              const spiralPattern = Math.sin(spiralAngle * 3) * 0.5 + 0.5;
              const sColor = stormColor.clone().lerp(new THREE.Color(0xffeedd), spiralPattern * 0.4);
              base.lerp(sColor, stormIntensity * 0.85);
            }
          }

          // Subtle edge darkening for depth
          const latDarken = 1.0 - Math.pow(Math.abs(py), 3) * 0.25;
          base.multiplyScalar(latDarken);

          data[idx] = Math.max(0, Math.min(255, Math.round(base.r * 255)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255)));
          data[idx + 3] = 255;

          // Gas giants are smooth, no displacement
          dispData[idx] = 128; dispData[idx + 1] = 128; dispData[idx + 2] = 128; dispData[idx + 3] = 255;
        }
      }
    } else {
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
          const bandNoise = this.noise3D(px * 8, py * 8, pz * 8) * 0.035;
          const latitudeShade = 1 - Math.abs(py) * 0.12;
          // High-frequency surface grain for close-up detail
          const surfaceGrain = this.noise3D(px * 32, py * 32, pz * 32) * 0.025;

          if (terrain <= this.landThreshold) {
            const lowland = palette.lowland.clone();
            // Richer lowland detail
            const lowlandDetail = this.noise3D(px * 12, py * 12, pz * 12) * 0.08;
            lowland.multiplyScalar(0.92 + bandNoise + latitudeShade * 0.04 + lowlandDetail);
            
            // Lava glowing effect with veins
            if (this.visualClass === 'volcanic') {
              const lavaFlow = this.noise3D(px * 15, py * 15, pz * 15) * 0.5 + 0.5;
              const lavaVeins = Math.pow(Math.abs(this.noise3D(px * 25, py * 25, pz * 25)), 0.5);
              lowland.lerp(new THREE.Color('#ff2a00'), lavaFlow * 0.7);
              lowland.lerp(new THREE.Color('#ffaa00'), lavaVeins * 0.35);
              lowland.multiplyScalar(1.3);
            }
            
            // Ocean depth variation for lush planets
            if (this.visualClass === 'lush_green') {
              const depthVar = this.noise3D(px * 6, py * 6, pz * 6) * 0.15;
              lowland.multiplyScalar(0.85 + depthVar);
            }

            data[idx] = Math.max(0, Math.min(255, Math.round(lowland.r * 255)));
            data[idx + 1] = Math.max(0, Math.min(255, Math.round(lowland.g * 255)));
            data[idx + 2] = Math.max(0, Math.min(255, Math.round(lowland.b * 255)));
            data[idx + 3] = 255;
            dispData[idx] = 0; dispData[idx + 1] = 0; dispData[idx + 2] = 0; dispData[idx + 3] = 255;
            continue;
          }

          const base = palette[this.getBiomeAtPoint(px, py, pz)].clone();
          if (elevation > 0.34) base.lerp(palette.ridge, THREE.MathUtils.clamp((elevation - 0.34) * 1.8, 0, 0.85));
          if (Math.abs(py) > 0.86) base.lerp(palette.polar, THREE.MathUtils.clamp((Math.abs(py) - 0.86) * 4.5, 0, 0.8));
          base.multiplyScalar(0.88 + bandNoise + surfaceGrain + latitudeShade + elevation * 0.15);

          data[idx] = Math.max(0, Math.min(255, Math.round(base.r * 255)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(base.g * 255)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round(base.b * 255)));
          data[idx + 3] = 255;

          // Higher displacement for deeper terrain
          const dispValue = Math.min(255, Math.floor(elevation * 320));
          dispData[idx] = dispValue; dispData[idx + 1] = dispValue; dispData[idx + 2] = dispValue; dispData[idx + 3] = 255;
        }
      }
    }

    for (let y = 0; y < detailHeight; y++) {
      for (let x = 0; x < detailWidth; x++) {
        const idx = (y * detailWidth + x) * 4;
        detailData[idx] = 128; detailData[idx + 1] = 128; detailData[idx + 2] = 128; detailData[idx + 3] = 255;
      }
    }

    this.ctx!.putImageData(this.imgData, 0, 0);
    this.dispCtx!.putImageData(this.dispImgData, 0, 0);
    this.detailCtx!.putImageData(this.detailImgData, 0, 0);

    if (!this.texture) this.texture = new THREE.CanvasTexture(this.canvas);
    if (!this.displacementMap) this.displacementMap = new THREE.CanvasTexture(this.dispCanvas);
    if (!this.detailTexture) this.detailTexture = new THREE.CanvasTexture(this.detailCanvas);
    this.configureTexture(this.texture, false);
    this.configureDisplacementTexture(this.displacementMap, false);
    this.configureTexture(this.detailTexture, true);

    const cacheKey = this.getCacheKey();
    geometryCache.set(cacheKey, { regions: this.regions.map((r) => ({ ...r, center: r.center.clone(), color: r.color.clone() })), texture: this.texture, displacementMap: this.displacementMap, detailTexture: this.detailTexture });
    putPlanetTextures(cacheKey, this.canvas, this.dispCanvas, this.detailCanvas);
    if (this.onTextureUpdate) this.onTextureUpdate(this.texture, this.displacementMap, this.detailTexture);
  }
}

export const geographyManager = new GeographyManager();
