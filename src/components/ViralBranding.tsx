import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Instagram, Share2, Copy, Check, ExternalLink, X, Sparkles, Flame } from 'lucide-react';

interface ViralBrandingProps {
  onShowToast?: (msg: string) => void;
}

export function ViralBranding({ onShowToast }: ViralBrandingProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = 'https://planetus.fun';
  const shareText = '🪐 Jump into Planet:Us - the free open-source 3D space MMO (github.com/umbgames/planetus) running directly in your browser! By @umbgames & @umbtechnologies:';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('🚀 Link copied! Share with your fleet!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Planet:Us - Free 3D Space MMO',
          text: shareText,
          url: shareUrl,
        });
      } catch {
        setShowShareModal(true);
      }
    } else {
      setShowShareModal(true);
    }
  };

  return (
    <>
      {/* Floating UMB Games and Technology Ltd Badge (Bottom-Right HUD) */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-auto flex flex-col items-end gap-2 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-black/75 hover:bg-black/90 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400/60 p-2.5 px-3.5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300 flex items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.2em] text-cyan-400 font-bold">Made By</span>
              <button
                onClick={() => setShowAboutModal(true)}
                className="text-white hover:text-cyan-300 font-bold tracking-tight text-left transition-colors flex items-center gap-1"
                title="View UMB Games & Technology info"
              >
                UMB Games & Technology Ltd
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Direct Link to umbtechnologies.com */}
          <a
            href="https://umbtechnologies.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Visit umbtechnologies.com"
          >
            <Globe size={13} className="text-cyan-400" />
            <span className="hidden sm:inline">umbtechnologies.com</span>
          </a>

          {/* Instagram @umbgames */}
          <a
            href="https://www.instagram.com/umbgames"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/25 text-pink-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Follow @umbgames on Instagram"
          >
            <Instagram size={13} className="text-pink-400" />
            <span className="hidden sm:inline">@umbgames</span>
          </a>

          {/* Instagram @umbtechnologies */}
          <a
            href="https://www.instagram.com/umbtechnologies"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Follow @umbtechnologies on Instagram"
          >
            <Instagram size={13} className="text-purple-400" />
            <span className="hidden md:inline">@umbtechnologies</span>
          </a>

          {/* GitHub Open Source */}
          <a
            href="https://github.com/umbgames/planetus"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Open-Source on GitHub: github.com/umbgames/planetus"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="hidden lg:inline">GitHub</span>
          </a>

          {/* Viral Share CTA */}
          <button
            onClick={handleNativeShare}
            className="p-1.5 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-[11px] transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95"
            title="Share Planet:Us with Friends"
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>
        </motion.div>
      </div>

      {/* Share / Viral Popup Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-cyan-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex justify-between items-center mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Spread The Galaxy</h3>
                    <p className="text-xs text-zinc-400">Invite your friends & clan members</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Copy URL input box */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between gap-3 mb-5 relative z-10">
                <span className="text-xs font-mono text-cyan-300 truncate">{shareUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Instant Social Broadcast Buttons */}
              <div className="grid grid-cols-2 gap-2.5 mb-5 relative z-10 text-xs">
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 font-semibold transition-colors"
                >
                  <span>Share on WhatsApp</span>
                </a>

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=Planetus,SpaceMMO,Web3D,Gaming`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold transition-colors"
                >
                  <span>Post on X / Twitter</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-sky-950/60 hover:bg-sky-900/60 border border-sky-500/30 text-sky-300 font-semibold transition-colors"
                >
                  <span>Share on Telegram</span>
                </a>

                {/* Reddit */}
                <a
                  href={`https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent('Planet:Us - Free 3D Space MMO Browser Game by UMB Games & Technology Ltd')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-950/60 hover:bg-orange-900/60 border border-orange-500/30 text-orange-300 font-semibold transition-colors"
                >
                  <span>Share on Reddit</span>
                </a>
              </div>

              {/* Developer Attribution Card */}
              <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex items-center justify-between text-xs relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">Created & Published By</span>
                  <span className="font-bold text-white">UMB Games and Technology Ltd</span>
                </div>
                <a
                  href="https://umbtechnologies.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  umbtechnologies.com
                  <ExternalLink size={12} />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About UMB Games & Technology Ltd Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto"
            onClick={() => setShowAboutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-cyan-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-black">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">UMB Games & Technology Ltd</h3>
                    <p className="text-xs text-cyan-400 font-mono">Official Game Studio & Tech Lab</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-zinc-300 leading-relaxed mb-6">
                <p>
                  <strong>Planet:Us</strong> is an original flagship 3D space strategy MMO developed by{' '}
                  <strong className="text-white">UMB Games and Technology Ltd</strong>, bringing real-time multiplayer dogfights, procedural galaxy rendering, and economy simulation directly to the web browser.
                </p>
                <p>
                  We build next-generation immersive web applications, WebGL simulations, and real-time multiplayer ecosystems designed to run instantly across all devices without friction.
                </p>
              </div>

              {/* Official Channels Grid */}
              <div className="space-y-2 mb-6">
                <a
                  href="https://umbtechnologies.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-2xl p-3 px-4 flex items-center justify-between text-white font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe size={18} className="text-cyan-400" />
                    <span>Official Studio Website: umbtechnologies.com</span>
                  </div>
                  <ExternalLink size={14} className="text-zinc-500 group-hover:text-white transition-colors" />
                </a>

                <a
                  href="https://www.instagram.com/umbgames"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-pink-950/40 to-purple-950/40 hover:from-pink-900/50 hover:to-purple-900/50 border border-pink-500/30 rounded-2xl p-3 px-4 flex items-center justify-between text-white font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Instagram size={18} className="text-pink-400" />
                    <span>Instagram Games: @umbgames</span>
                  </div>
                  <ExternalLink size={14} className="text-pink-300 group-hover:text-white transition-colors" />
                </a>

                <a
                  href="https://www.instagram.com/umbtechnologies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-purple-950/40 to-indigo-950/40 hover:from-purple-900/50 hover:to-indigo-900/50 border border-purple-500/30 rounded-2xl p-3 px-4 flex items-center justify-between text-white font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Instagram size={18} className="text-purple-400" />
                    <span>Instagram Tech: @umbtechnologies</span>
                  </div>
                  <ExternalLink size={14} className="text-purple-300 group-hover:text-white transition-colors" />
                </a>

                <a
                  href="https://github.com/umbgames/planetus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-2xl p-3 px-4 flex items-center justify-between text-white font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <span>Open-Source Repository: github.com/umbgames/planetus</span>
                  </div>
                  <ExternalLink size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
                </a>
              </div>

              <div className="text-center text-[11px] text-zinc-500 font-mono">
                &copy; 2026 UMB Games and Technology Ltd. All rights reserved.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
