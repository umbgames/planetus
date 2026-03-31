import { Video } from '../types';
import { geographyManager } from './geography';

const YOUTUBE_API_KEY = 'AIzaSyCTzC6K93wGtq8R5Ym3nR2SVcqFx6ZprOQ';

const TOPICS = ['Tech', 'Gaming', 'Music', 'News', 'Sports', 'Entertainment', 'Education', 'Vlog'];
const HASHTAGS: Record<string, string[]> = {
  Tech: ['#coding', '#AI', '#gadgets', '#future', '#software'],
  Gaming: ['#gaming', '#esports', '#stream', '#letsplay', '#rpg'],
  Music: ['#music', '#live', '#cover', '#newrelease', '#beats'],
  News: ['#breaking', '#world', '#politics', '#update', '#daily'],
  Sports: ['#football', '#basketball', '#highlights', '#fitness', '#workout'],
  Entertainment: ['#funny', '#comedy', '#movie', '#review', '#podcast'],
  Education: ['#learn', '#science', '#history', '#tutorial', '#howto'],
  Vlog: ['#dailyvlog', '#travel', '#lifestyle', '#food', '#dayinmylife']
};

const THUMBNAILS = [
  'https://picsum.photos/seed/yt1/320/180',
  'https://picsum.photos/seed/yt2/320/180',
  'https://picsum.photos/seed/yt3/320/180',
  'https://picsum.photos/seed/yt4/320/180',
  'https://picsum.photos/seed/yt5/320/180',
  'https://picsum.photos/seed/yt6/320/180',
  'https://picsum.photos/seed/yt7/320/180',
  'https://picsum.photos/seed/yt8/320/180',
];

export function generateMockVideo(id: string): Video {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const tags = HASHTAGS[topic];
  const numTags = 1 + Math.floor(Math.random() * 3);
  const selectedTags = [];
  for (let i = 0; i < numTags; i++) {
    selectedTags.push(tags[Math.floor(Math.random() * tags.length)]);
  }

  // High view count probability
  const isViral = Math.random() > 0.9;
  const view_count = isViral 
    ? 1000000 + Math.floor(Math.random() * 10000000)
    : 1000 + Math.floor(Math.random() * 500000);

  return {
    id,
    title: `Amazing ${topic} Video ${id.substring(0, 4)}`,
    thumbnail_url: THUMBNAILS[Math.floor(Math.random() * THUMBNAILS.length)],
    view_count,
    like_count: Math.floor(view_count * (0.01 + Math.random() * 0.05)),
    channel_name: `${topic}Channel${Math.floor(Math.random() * 100)}`,
    topic,
    hashtags: [...new Set(selectedTags)]
  };
}

export async function fetchVideosForTile(tileId: string, count: number = 30, date: string = ''): Promise<Video[]> {
  try {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const query = date ? `${topic} ${date}` : topic;
    
    // Fetch search results
    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${count}&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`);
    const searchData = await searchRes.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      throw new Error("No videos found");
    }

    // Fetch statistics for the videos
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
    const statsData = await statsRes.json();

    const statsMap: Record<string, any> = {};
    if (statsData.items) {
      statsData.items.forEach((item: any) => {
        statsMap[item.id] = item.statistics;
      });
    }

    return searchData.items.map((item: any): Video => {
      const stats = statsMap[item.id.videoId] || {};
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        // Use high res if available, fallback to medium/default
        thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        view_count: parseInt(stats.viewCount || '0', 10),
        like_count: parseInt(stats.likeCount || '0', 10),
        channel_name: item.snippet.channelTitle,
        topic: topic,
        hashtags: HASHTAGS[topic] || []
      };
    });
  } catch (err) {
    console.error("YouTube API error, falling back to mock data:", err);
    // Fallback to mock data
    const videos: Video[] = [];
    for (let i = 0; i < count; i++) {
      const video = generateMockVideo(`${tileId}_vid_${i}`);
      if (date) {
        video.title = `${video.title} (${date})`;
      }
      videos.push(video);
    }
    return videos;
  }
}

export async function fetchTopVideoForHashtag(hashtag: string, date: string): Promise<Video> {
  try {
    const query = date ? `${hashtag} ${date}` : hashtag;
    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&order=viewCount&key=${YOUTUBE_API_KEY}`);
    const searchData = await searchRes.json();
    
    if (searchData.items && searchData.items.length > 0) {
      const item = searchData.items[0];
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${item.id.videoId}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();
      const stats = statsData.items?.[0]?.statistics || {};
      
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        view_count: parseInt(stats.viewCount || '0', 10),
        like_count: parseInt(stats.likeCount || '0', 10),
        channel_name: item.snippet.channelTitle,
        topic: 'Trending',
        hashtags: [hashtag]
      };
    }
  } catch (err) {
    console.error("YouTube API error, falling back to mock data:", err);
  }

  // Fallback
  const id = `top_${hashtag.replace('#', '')}_${date}`;
  const view_count = 5000000 + Math.floor(Math.random() * 10000000);
  
  return {
    id,
    title: `Top Video for ${hashtag} on ${date}`,
    thumbnail_url: `https://picsum.photos/seed/${id}/320/180`,
    view_count,
    like_count: Math.floor(view_count * 0.05),
    channel_name: `${hashtag.replace('#', '')}Trending`,
    topic: 'Trending',
    hashtags: [hashtag]
  };
}
