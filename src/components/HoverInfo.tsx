import React from 'react';
import { Post } from '../types';
import { motion } from 'motion/react';
import { Heart, MessageCircle, Repeat2, Clock } from 'lucide-react';

interface HoverInfoProps {
  post: Post | null;
  position: { x: number; y: number } | null;
}

export function HoverInfo({ post, position }: HoverInfoProps) {
  if (!post || !position) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 pointer-events-none bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl p-4 shadow-2xl w-80 text-white"
      style={{
        left: position.x + 15,
        top: position.y + 15,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        {post.author.profileImageUrl ? (
          <img src={post.author.profileImageUrl} alt={post.author.name} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-bold">
            {post.author.name.charAt(0)}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm">{post.author.name}</div>
          <div className="text-zinc-400 text-xs">@{post.author.username}</div>
        </div>
      </div>
      
      <p className="text-sm mb-3 leading-relaxed">
        {post.text}
      </p>
      
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.hashtags.map(tag => (
            <span key={tag} className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between text-zinc-400 text-xs pt-3 border-t border-zinc-700/50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Heart size={14} className="text-pink-500" /> {post.metrics.likes.toLocaleString()}</span>
          <span className="flex items-center gap-1"><Repeat2 size={14} className="text-emerald-500" /> {post.metrics.retweets.toLocaleString()}</span>
          <span className="flex items-center gap-1"><MessageCircle size={14} className="text-blue-500" /> {post.metrics.replies.toLocaleString()}</span>
        </div>
        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
    </motion.div>
  );
}
