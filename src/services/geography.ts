import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';

const noise3D = createNoise3D();

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
}

const REGION_COLORS = [
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#06b6d4', // cyan-500
  '#d946ef', // fuchsia-500
  '#eab308', // yellow-500
];

class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2; // Adjusted to fine-tune land/water balance
  texture: THREE.CanvasTexture | null = null;
  onTextureUpdate: ((texture: THREE.CanvasTexture) => void) | null = null;

  getTerrain(x: number, y: number, z: number) {
    const len = Math.sqrt(x*x + y*y + z*z);
    const nx = x/len;
    const ny = y/len;
    const nz = z/len;
    
    let n = noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.5 * noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    return n;
  }

  isLand(x: number, y: number, z: number) {
    return this.getTerrain(x, y, z) > this.landThreshold;
  }

  initializeTopicRegions() {
    if (this.regions.length > 0) return;

    const TOPICS = [
      { name: 'Tech', color: '#4a3525' },
      { name: 'Gaming', color: '#5c4033' },
      { name: 'Art', color: '#704214' },
      { name: 'Music', color: '#8b4513' },
      { name: 'News', color: '#a0522d' },
      { name: 'Sports', color: '#cd853f' },
    ];

    const newRegions: Region[] = [];

    for (const topic of TOPICS) {
      let center = new THREE.Vector3(1, 0, 0);
      for (let i = 0; i < 500; i++) {
        const u = Math.random();
        const v = Math.random();
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
    // Rejection sampling
    for (let i = 0; i < 500; i++) {
      const u = Math.random();
      const v = Math.random();
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
    
    // Fallback: just return a random land point
    for (let i = 0; i < 500; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      if (this.isLand(x, y, z)) {
        return [x * radius, y * radius, z * radius];
      }
    }
    
    // Ultimate fallback
    return [radius, 0, 0];
  }

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;

  generateTexture() {
    const width = 512;
    const height = 256;
    
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d')!;
      this.imgData = this.ctx.createImageData(width, height);
    }

    const data = this.imgData!.data;

    const waterColor = new THREE.Color('#2c1e16'); // dark brown
    const borderColor = new THREE.Color('#1a110c'); // darker brown
    const defaultLandColor = new THREE.Color('#8b4513'); // medium brown

    for (let y = 0; y < height; y++) {
      const phi = (y / height) * Math.PI; // 0 to PI
      for (let x = 0; x < width; x++) {
        const theta = (x / width) * Math.PI * 2; // 0 to 2PI

        // Note: in Three.js spherical coords, y is up
        const px = Math.sin(phi) * Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi) * Math.sin(theta);

        const pt = new THREE.Vector3(px, py, pz);
        const idx = (y * width + x) * 4;

        if (!this.isLand(px, py, pz)) {
          // Water
          data[idx] = waterColor.r * 255;
          data[idx+1] = waterColor.g * 255;
          data[idx+2] = waterColor.b * 255;
          data[idx+3] = 255;
        } else {
          // Land
          if (this.regions.length === 0) {
            data[idx] = defaultLandColor.r * 255;
            data[idx+1] = defaultLandColor.g * 255;
            data[idx+2] = defaultLandColor.b * 255;
            data[idx+3] = 255;
            continue;
          }

          // Find closest and second closest
          let minDist = Infinity;
          let min2Dist = Infinity;
          let closestRegion: Region | null = null;
          let secondClosestRegion: Region | null = null;

          for (const region of this.regions) {
            const dist = pt.distanceTo(region.center); // Use actual distance for uniform border thickness
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

          // Border detection - thin white line
          // Only draw border if the two regions are geographically close (centers are within a certain distance)
          const areRegionsClose = secondClosestRegion && closestRegion!.center.distanceTo(secondClosestRegion.center) < 1.2;
          
          if (min2Dist - minDist < 0.015 && areRegionsClose) {
            data[idx] = borderColor.r * 255;
            data[idx+1] = borderColor.g * 255;
            data[idx+2] = borderColor.b * 255;
            data[idx+3] = 255;
          } else {
            data[idx] = closestRegion!.color.r * 255;
            data[idx+1] = closestRegion!.color.g * 255;
            data[idx+2] = closestRegion!.color.b * 255;
            data[idx+3] = 255;
          }
        }
      }
    }
    this.ctx!.putImageData(this.imgData!, 0, 0);
    
    if (!this.texture) {
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }
    
    this.texture.needsUpdate = true;

    if (this.onTextureUpdate) {
      this.onTextureUpdate(this.texture);
    }
  }
}

export const geographyManager = new GeographyManager();
