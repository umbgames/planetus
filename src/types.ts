export interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  channel_name: string;
  topic: string;
  hashtags: string[];
}

export interface BuildingData {
  id: string;
  position: [number, number, number];
  videos: Video[];
  height: number;
}

export interface TileData {
  id: string;
  center: [number, number, number];
  buildings: BuildingData[];
}
