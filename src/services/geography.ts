import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';
import { createPRNG } from '../utils/random';

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
  private seed = 'default';

  constructor() {
    this.prng = createPRNG(this.seed);
    this.noise3D = createNoise3D(this.prng);
  }

  private getCacheKey(seed = this.seed, noiseScale = this.noiseScale, landThreshold = this.landThreshold) {
    return `${seed}|${noiseScale}|${landThreshold}`;
  }

  setSeed(seed: string, noiseScale: number = 1.5, landThreshold: number = 0.2) {
    if (this.seed !== seed || this.noiseScale !== noiseScale || this.landThreshold !== landThreshold) {
      this.seed = seed;
      this.noiseScale = noiseScale;
      this.landThreshold = landThreshold;
      this.prng = createPRNG(seed);
      this.noise3D = createNoise3D(this.prng);
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
    const len = Math.sqrt(x * x + y * y + z * z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    let n = this.noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.5 * this.noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    const ridge = this.noise3D(nx * this.noiseScale * 3, ny * this.noiseScale * 3, nz * this.noiseScale * 3);
    n += 0.3 * (1.0 - Math.abs(ridge));
    n += 0.25 * this.noise3D(nx * this.noiseScale * 4, ny * this.noiseScale * 4, nz * this.noiseScale * 4);
    n += 0.125 * this.noise3D(nx * this.noiseScale * 8, ny * this.noiseScale * 8, nz * this.noiseScale * 8);
    n += 0.0625 * this.noise3D(nx * this.noiseScale * 16, ny * this.noiseScale * 16, nz * this.noiseScale * 16);
    n += 0.03125 * this.noise3D(nx * this.noiseScale * 32, ny * this.noiseScale * 32, nz * this.noiseScale * 32);
    return n;
  }

  getElevation(x: number, y: number, z: number) {
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    let elevation = Math.max(0, t - this.landThreshold);
    elevation = Math.pow(elevation, 1.5);
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
      { name: 'Tech', color: '#4a3525', zone: 'high' as const },
      { name: 'Gaming', color: '#5c4033', zone: 'mid' as const },
      { name: 'Art', color: '#704214', zone: 'mid' as const },
      { name: 'Music', color: '#8b4513', zone: 'low' as const },
      { name: 'News', color: '#a0522d', zone: 'low' as const },
      { name: 'Sports', color: '#cd853f', zone: 'low' as const },
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
        color: new THREE.Color(topic.color),
        resourceZone: topic.zone,
      });
    }

    this.regions = newRegions;
    this.generateTexture();
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

    const waterColor = new THREE.Color('#2c1e16');
    const borderColor = new THREE.Color('#1a110c');
    const defaultLandColor = new THREE.Color('#8b4513');

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI;
      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2;
        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);
        const pt = new THREE.Vector3(px, py, pz);
        const idx = (y * width + x) * 4;

        if (!this.isLand(px, py, pz)) {
          const waterNoise = this.noise3D(px * 10, py * 10, pz * 10) * 0.05;
          data[idx] = Math.max(0, Math.min(255, waterColor.r * 255 * (1 + waterNoise)));
          data[idx + 1] = Math.max(0, Math.min(255, waterColor.g * 255 * (1 + waterNoise)));
          data[idx + 2] = Math.max(0, Math.min(255, waterColor.b * 255 * (1 + waterNoise)));
          data[idx + 3] = 255;

          dispData[idx] = 0;
          dispData[idx + 1] = 0;
          dispData[idx + 2] = 0;
          dispData[idx + 3] = 255;
        } else {
          const elevation = this.getElevation(px, py, pz);
          const dispValue = Math.min(255, Math.floor(elevation * 170));
          dispData[idx] = dispValue;
          dispData[idx + 1] = dispValue;
          dispData[idx + 2] = dispValue;
          dispData[idx + 3] = 255;

          if (this.regions.length === 0) {
            const shade = 1 + elevation * 0.5;
            data[idx] = Math.min(255, defaultLandColor.r * 255 * shade);
            data[idx + 1] = Math.min(255, defaultLandColor.g * 255 * shade);
            data[idx + 2] = Math.min(255, defaultLandColor.b * 255 * shade);
            data[idx + 3] = 255;
            continue;
          }

          let minDist = Infinity;
          let min2Dist = Infinity;
          let closestRegion: Region | null = null;
          let secondClosestRegion: Region | null = null;

          for (const region of this.regions) {
            const dist = pt.distanceTo(region.center);
            if (dist < minDist) {
              min2Dist = minDist;
              secondClosestRegion = closestRegion;
              minDist = dist;
              closestRegion = region;
            } else if (dist < min2Dist) {
              min2Dist = dist;
              secondClosestRegion = region;
            }
          }

          const areRegionsClose = secondClosestRegion && closestRegion!.center.distanceTo(secondClosestRegion.center) < 1.2;
          const shade = 1 + elevation * 0.8;
          const surfaceDetail = this.noise3D(px * 50, py * 50, pz * 50) * 0.1;
          const finalShade = shade + surfaceDetail;

          if (min2Dist - minDist < 0.015 && areRegionsClose) {
            data[idx] = borderColor.r * 255;
            data[idx + 1] = borderColor.g * 255;
            data[idx + 2] = borderColor.b * 255;
            data[idx + 3] = 255;
          } else {
            let r = closestRegion!.color.r;
            let g = closestRegion!.color.g;
            let b = closestRegion!.color.b;
            if (closestRegion!.resourceZone === 'high') r = Math.min(1, r * 1.2);
            else if (closestRegion!.resourceZone === 'low') b = Math.min(1, b * 1.2);

            data[idx] = Math.max(0, Math.min(255, r * 255 * finalShade));
            data[idx + 1] = Math.max(0, Math.min(255, g * 255 * finalShade));
            data[idx + 2] = Math.max(0, Math.min(255, b * 255 * finalShade));
            data[idx + 3] = 255;
          }
        }
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
