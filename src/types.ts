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

export interface Post {
  id: string;
  text: string;
  author: {
    name: string;
    username: string;
    profileImageUrl?: string;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  createdAt: string;
  hashtags: string[];
  topic: string;
  engagementScore: number;
  position: [number, number, number];
  targetScale: number;
  currentScale: number;
}

export interface BuildingData {
  id: string;
  position: [number, number, number];
  height: number;
  color: string;
  videos?: Video[];
}

export interface TileData {
  id: string;
  center: [number, number, number];
  buildings: BuildingData[];
}
