import { createNoise3D } from 'simplex-noise';
import * as THREE from 'three';

const noise3D = createNoise3D();

export interface Region {
  id: string;
  hashtag: string;
  center: THREE.Vector3;
  color: THREE.Color;
  resourceZone: 'high' | 'mid' | 'low';
}

const REGION_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#f97316', '#84cc16', '#06b6d4', '#d946ef', '#eab308',
];

class GeographyManager {
  regions: Region[] = [];
  noiseScale = 1.5;
  landThreshold = 0.2;
  texture: THREE.CanvasTexture | null = null;
  displacementMap: THREE.CanvasTexture | null = null;
  onTextureUpdate: ((texture: THREE.CanvasTexture, displacementMap: THREE.CanvasTexture) => void) | null = null;

  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  imgData: ImageData | null = null;

  dispCanvas: HTMLCanvasElement | null = null;
  dispCtx: CanvasRenderingContext2D | null = null;
  dispImgData: ImageData | null = null;

  /** Terrain noise calculations */
  getTerrain(x: number, y: number, z: number) {
    const len = Math.sqrt(x*x + y*y + z*z);
    const nx = x/len, ny = y/len, nz = z/len;

    let n = noise3D(nx * this.noiseScale, ny * this.noiseScale, nz * this.noiseScale);
    n += 0.5 * noise3D(nx * this.noiseScale * 2, ny * this.noiseScale * 2, nz * this.noiseScale * 2);
    const ridge = noise3D(nx * this.noiseScale * 3, ny * this.noiseScale * 3, nz * this.noiseScale * 3);
    n += 0.3 * (1.0 - Math.abs(ridge));
    n += 0.25 * noise3D(nx * this.noiseScale * 4, ny * this.noiseScale * 4, nz * this.noiseScale * 4);
    n += 0.125 * noise3D(nx * this.noiseScale * 8, ny * this.noiseScale * 8, nz * this.noiseScale * 8);
    n += 0.0625 * noise3D(nx * this.noiseScale * 16, ny * this.noiseScale * 16, nz * this.noiseScale * 16);
    n += 0.03125 * noise3D(nx * this.noiseScale * 32, ny * this.noiseScale * 32, nz * this.noiseScale * 32);
    return n;
  }

  getElevation(x: number, y: number, z: number) {
    const t = this.getTerrain(x, y, z);
    if (t <= this.landThreshold) return 0;
    let elevation = Math.max(0, t - this.landThreshold);
    return Math.pow(elevation, 1.5);
  }

  isLand(x: number, y: number, z: number) {
    return this.getTerrain(x, y, z) > this.landThreshold;
  }

  /** Initialize topic regions */
  initializeTopicRegions() {
    if (this.regions.length > 0) return;

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
      let center = new THREE.Vector3(1,0,0);
      for (let i=0;i<500;i++){
        const u=Math.random(), v=Math.random();
        const theta=2*Math.PI*u;
        const phi=Math.acos(2*v-1);
        const x=Math.sin(phi)*Math.cos(theta);
        const y=Math.cos(phi);
        const z=Math.sin(phi)*Math.sin(theta);
        if(this.isLand(x,y,z)){
          let tooClose=false;
          const pt = new THREE.Vector3(x,y,z);
          for(const r of newRegions){
            if(pt.distanceToSquared(r.center)<0.4){tooClose=true;break;}
          }
          if(!tooClose){center=pt;break;}
        }
      }
      newRegions.push({
        id: topic.name,
        hashtag: topic.name,
        center,
        color: new THREE.Color(topic.color),
        resourceZone: topic.zone
      });
    }

    this.regions = newRegions;

    console.log("Regions initialized:", this.regions.map(r=>r.id));
    this.generateTexture(); // generate after callback
  }

  /** Generate terrain texture */
  generateTexture(width = 4096, height = 2048) {
    console.log("Generating texture with size:", width, "x", height);

    // Create canvases if needed
    if(!this.canvas){
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
    const defaultLandColor = new THREE.Color('#8b4513');

    let pixelsWritten = 0;

    for(let y=0;y<height;y++){
      const phi = (y/height)*Math.PI;
      for(let x=0;x<width;x++){
        const theta=(x/width)*2*Math.PI;
        const px = Math.sin(phi)*Math.cos(theta);
        const py = Math.cos(phi);
        const pz = Math.sin(phi)*Math.sin(theta);
        const pt = new THREE.Vector3(px,py,pz);
        const idx = (y*width+x)*4;

        if(!this.isLand(px,py,pz)){
          // Water
          data[idx] = waterColor.r*255;
          data[idx+1] = waterColor.g*255;
          data[idx+2] = waterColor.b*255;
          data[idx+3] = 255;

          dispData[idx]=0; dispData[idx+1]=0; dispData[idx+2]=0; dispData[idx+3]=255;
        } else {
          const elevation = this.getElevation(px,py,pz);
          const dispValue = Math.min(255, Math.floor(elevation*170));
          dispData[idx]=dispValue; dispData[idx+1]=dispValue; dispData[idx+2]=dispValue; dispData[idx+3]=255;

          const shade = 1+elevation*0.5;
          data[idx] = Math.max(0, Math.min(255, defaultLandColor.r*255*shade));
          data[idx+1] = Math.max(0, Math.min(255, defaultLandColor.g*255*shade));
          data[idx+2] = Math.max(0, Math.min(255, defaultLandColor.b*255*shade));
          data[idx+3] = 255;
          pixelsWritten++;
        }
      }
    }

    console.log("Pixels written:", pixelsWritten, "/", width*height);

    this.ctx!.putImageData(this.imgData!,0,0);
    this.dispCtx!.putImageData(this.dispImgData!,0,0);

    if(!this.texture){
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.displacementMap = new THREE.CanvasTexture(this.dispCanvas);
    } else {
      this.texture.image = this.canvas;
      this.texture.needsUpdate = true;
      this.displacementMap!.image = this.dispCanvas;
      this.displacementMap!.needsUpdate = true;
    }

    console.log("Texture generated:", this.texture?.image.width, "x", this.texture?.image.height);

    if(this.onTextureUpdate){
      console.log("Calling onTextureUpdate callback");
      this.onTextureUpdate(this.texture, this.displacementMap!);
    }
  }
}

export const geographyManager = new GeographyManager();
