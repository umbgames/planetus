import * as THREE from 'three';
import { TileData, BuildingData, Video } from '../types';
import { fetchVideosForTile } from './youtube';
import { geographyManager } from './geography';

const TILE_SIZE = 0.5; // Radians roughly
const LOAD_RADIUS = 1.5; // Radians

export class TileManager {
  private activeTiles: Map<string, TileData> = new Map();
  private loadingTiles: Set<string> = new Set();
  private planetRadius: number;
  private onTilesUpdate: (tiles: TileData[]) => void;
  private date: string;

  constructor(planetRadius: number, onTilesUpdate: (tiles: TileData[]) => void, date: string) {
    this.planetRadius = planetRadius;
    this.onTilesUpdate = onTilesUpdate;
    this.date = date;
  }

  public update(cameraPosition: THREE.Vector3) {
    // Only load tiles if we are close enough to the planet
    const dist = cameraPosition.length();
    if (dist > this.planetRadius * 2.5) {
      if (this.activeTiles.size > 0) {
        this.activeTiles.clear();
        this.onTilesUpdate([]);
      }
      return;
    }

    // Normalize camera position to get the point on the sphere
    const camDir = cameraPosition.clone().normalize();
    
    // Convert to spherical coordinates
    const spherical = new THREE.Spherical().setFromVector3(camDir);
    
    // Find grid coordinates
    const gridPhi = Math.floor(spherical.phi / TILE_SIZE);
    const gridTheta = Math.floor(spherical.theta / TILE_SIZE);

    const neededTiles = new Set<string>();

    // Check surrounding tiles
    const searchRadius = Math.ceil(LOAD_RADIUS / TILE_SIZE);
    
    for (let dPhi = -searchRadius; dPhi <= searchRadius; dPhi++) {
      for (let dTheta = -searchRadius; dTheta <= searchRadius; dTheta++) {
        const p = gridPhi + dPhi;
        const t = gridTheta + dTheta;
        
        // Skip invalid phi (poles)
        if (p < 0 || p > Math.PI / TILE_SIZE) continue;
        
        // Wrap theta
        const wrappedT = ((t % (2 * Math.PI / TILE_SIZE)) + (2 * Math.PI / TILE_SIZE)) % (2 * Math.PI / TILE_SIZE);
        
        const tileId = `${p}_${Math.floor(wrappedT)}`;
        neededTiles.add(tileId);
        
        if (!this.activeTiles.has(tileId) && !this.loadingTiles.has(tileId)) {
          this.loadTile(tileId, p, Math.floor(wrappedT));
        }
      }
    }

    // Unload distant tiles
    let changed = false;
    for (const tileId of this.activeTiles.keys()) {
      if (!neededTiles.has(tileId)) {
        this.activeTiles.delete(tileId);
        changed = true;
      }
    }

    if (changed) {
      this.notifyUpdate();
    }
  }

  private async loadTile(tileId: string, gridPhi: number, gridTheta: number) {
    this.loadingTiles.add(tileId);

    const phi = (gridPhi + 0.5) * TILE_SIZE;
    const theta = (gridTheta + 0.5) * TILE_SIZE;
    
    const center = new THREE.Vector3().setFromSphericalCoords(this.planetRadius, phi, theta);
    
    // Check if tile is on land
    if (!geographyManager.isLand(center.x, center.y, center.z)) {
      this.loadingTiles.delete(tileId);
      return;
    }

    const numVideos = 20 + Math.floor(Math.random() * 20); // 20-40 videos
    const videos = await fetchVideosForTile(tileId, numVideos, this.date);
    
    // Group videos into buildings
    const buildings: BuildingData[] = [];
    
    // Sort videos by views (high views first) to give them a higher chance of being in tall buildings
    // But we use weighted randomness as requested
    const sortedVideos = [...videos].sort((a, b) => b.view_count - a.view_count);
    
    let remainingVideos = [...sortedVideos];
    let buildingIdx = 0;
    
    while (remainingVideos.length > 0) {
      // Randomly decide how many videos in this building (1 to 10)
      const stackSize = Math.min(remainingVideos.length, 1 + Math.floor(Math.random() * 10));
      
      const buildingVideos: Video[] = [];
      for (let i = 0; i < stackSize; i++) {
        // Weighted random selection: prefer videos at the start of the array (higher views)
        // Using a simple power function to bias towards 0
        const idx = Math.floor(Math.pow(Math.random(), 2) * remainingVideos.length);
        buildingVideos.push(remainingVideos.splice(idx, 1)[0]);
      }
      
      // Generate position within the tile
      const offsetPhi = (Math.random() - 0.5) * TILE_SIZE * 0.8;
      const offsetTheta = (Math.random() - 0.5) * TILE_SIZE * 0.8;
      
      const bPhi = phi + offsetPhi;
      const bTheta = theta + offsetTheta;
      const bPos = new THREE.Vector3().setFromSphericalCoords(this.planetRadius, bPhi, bTheta);
      
      // Ensure building is on land
      if (geographyManager.isLand(bPos.x, bPos.y, bPos.z)) {
        buildings.push({
          id: `${tileId}_b_${buildingIdx++}`,
          position: [bPos.x, bPos.y, bPos.z],
          videos: buildingVideos,
          height: buildingVideos.length
        });
      }
    }

    const tileData: TileData = {
      id: tileId,
      center: [center.x, center.y, center.z],
      buildings
    };

    // Only add if we still need it
    if (this.loadingTiles.has(tileId)) {
      this.activeTiles.set(tileId, tileData);
      this.loadingTiles.delete(tileId);
      this.notifyUpdate();
    }
  }

  private notifyUpdate() {
    this.onTilesUpdate(Array.from(this.activeTiles.values()));
  }
}
