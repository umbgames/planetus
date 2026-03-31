import { v4 as uuidv4 } from 'uuid';
import { Post } from '../types';
import { geographyManager } from './geography';

const TOPICS = [
  { name: 'Tech', color: '#4a3525' },
  { name: 'Gaming', color: '#5c4033' },
  { name: 'Art', color: '#704214' },
  { name: 'Music', color: '#8b4513' },
  { name: 'News', color: '#a0522d' },
  { name: 'Sports', color: '#cd853f' },
];

const SAMPLE_TEXTS = [
  "Just launched my new project! #tech #coding",
  "What an amazing game last night! #sports",
  "Listening to this new album on repeat. #music",
  "Check out my latest digital painting. #art",
  "Breaking news: major scientific discovery announced today. #news",
  "Can't wait for the new console release! #gaming",
  "Learning Three.js is so much fun. #tech #webgl",
  "The sunset today was absolutely beautiful.",
  "Who else is excited for the weekend?",
  "Just had the best coffee of my life.",
];

const SAMPLE_AUTHORS = [
  { name: 'Alice Smith', username: 'alicesmith' },
  { name: 'Bob Jones', username: 'bobjones' },
  { name: 'Charlie Brown', username: 'charlieb' },
  { name: 'Diana Prince', username: 'dianap' },
  { name: 'Evan Wright', username: 'evanw' },
];

export function generateSimulatedPost(radius: number = 10): Post {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const author = SAMPLE_AUTHORS[Math.floor(Math.random() * SAMPLE_AUTHORS.length)];
  const text = SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
  
  // Engagement follows a power law roughly (many low, few high)
  const rand = Math.random();
  let engagementScore = 0;
  if (rand > 0.95) engagementScore = 0.8 + Math.random() * 0.2; // High
  else if (rand > 0.7) engagementScore = 0.4 + Math.random() * 0.4; // Medium
  else engagementScore = Math.random() * 0.4; // Low

  const likes = Math.floor(engagementScore * 10000);
  const retweets = Math.floor(engagementScore * 2000);
  const replies = Math.floor(engagementScore * 500);

  // Extract hashtags
  const hashtags = text.match(/#[a-z0-9]+/gi) || [];
  const primaryHashtag = hashtags.length > 0 ? hashtags[0] : 'general';

  return {
    id: uuidv4(),
    text,
    author,
    metrics: { likes, retweets, replies },
    createdAt: new Date().toISOString(),
    hashtags,
    topic: topic.name,
    engagementScore,
    position: geographyManager.getRandomPointForTopic(topic.name, radius),
    targetScale: 1, // Will be animated to 1
    currentScale: 0,
  };
}

export async function fetchTwitterPosts(token: string, query: string, radius: number = 10): Promise<Post[]> {
  try {
    const response = await fetch('/api/twitter/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, query }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from proxy');
    }

    const data = await response.json();
    
    if (!data.data) return [];

    const users = data.includes?.users || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return data.data.map((tweet: any) => {
      const user: any = userMap.get(tweet.author_id) || { name: 'Unknown', username: 'unknown' };
      const metrics = tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0 };
      
      // Calculate a normalized engagement score (heuristic)
      const totalEngagement = metrics.like_count + metrics.retweet_count * 2 + metrics.reply_count * 3;
      const engagementScore = Math.min(1, Math.max(0.05, totalEngagement / 1000)); // Cap at 1000 for max height

      const hashtags = tweet.entities?.hashtags?.map((h: any) => `#${h.tag}`) || [];
      const primaryHashtag = hashtags.length > 0 ? hashtags[0] : 'general';
      
      // Assign random topic for color if no hashtag matches
      let topic = TOPICS[Math.floor(Math.random() * TOPICS.length)].name;
      
      return {
        id: tweet.id,
        text: tweet.text,
        author: {
          name: user.name,
          username: user.username,
          profileImageUrl: user.profile_image_url,
        },
        metrics: {
          likes: metrics.like_count,
          retweets: metrics.retweet_count,
          replies: metrics.reply_count,
        },
        createdAt: tweet.created_at,
        hashtags,
        topic,
        engagementScore,
        position: geographyManager.getRandomPointForTopic(topic, radius),
        targetScale: 1,
        currentScale: 0,
      };
    });
  } catch (error) {
    console.error("Error fetching Twitter posts:", error);
    return [];
  }
}

export const getTopicColor = (topicName: string) => {
  const topic = TOPICS.find(t => t.name === topicName);
  return topic ? topic.color : '#ffffff';
};
