import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';

export function LoadingScreen({
  active,
  progress,
  label,
}: {
  active: boolean;
  progress: number;
  label: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-[80] bg-black flex items-center justify-center pointer-events-auto overflow-hidden"
        >
          {/* background */}
          <div className="absolute inset-0 opacity-60">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.12),transparent_60%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(transparent,rgba(255,255,255,0.05),transparent)] animate-scanline" />
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px] opacity-20" />
          </div>

          <div className="relative w-full max-w-md px-8">
            <div className="flex items-center justify-center gap-3 mb-7">
              <LoaderCircle size={26} className="text-cyan-400 animate-spin" />
              <div className="text-white text-2xl font-black tracking-[0.22em]">PLANET:US</div>
            </div>

            <div className="text-center text-zinc-400 text-sm mb-4">{label}</div>
            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div
                className="h-full bg-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <div className="text-center text-cyan-200/80 text-xs mt-3 font-mono tracking-widest">
              {pct}%
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
