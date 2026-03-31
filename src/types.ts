export interface BuildingData {
  id: string;
  position: [number, number, number];
  height: number;
  color: string;
}

export interface TileData {
  id: string;
  center: [number, number, number];
  buildings: BuildingData[];
}
