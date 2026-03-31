import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface OrbitBannerProps {
  message: { name: string; desc: string } | null;
}

export function OrbitBanner({ message }: OrbitBannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-10 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
        >
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.45em] text-cyan-300/80">Orbit Sync</div>
            <div className="text-white text-3xl md:text-4xl font-semibold tracking-[0.14em] drop-shadow-[0_0_24px_rgba(34,211,238,0.18)]">
              {message.name}
            </div>
            <div className="mt-1 text-zinc-400 text-sm tracking-[0.28em] uppercase">{message.desc}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
