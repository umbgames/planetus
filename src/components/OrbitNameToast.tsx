import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export function OrbitNameToast({ name, nonce }: { name: string | null; nonce: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!name) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(t);
  }, [name, nonce]);

  return (
    <AnimatePresence>
      {name && visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -6] }}
          exit={{ opacity: 0, y: -6 }}
          transition={{
            duration: 3.2,
            times: [0, 0.18, 0.76, 1],
            ease: [0.16, 1, 0.3, 1],
          }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="text-white drop-shadow-[0_0_16px_rgba(34,211,238,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.35em] text-cyan-300/90 font-semibold text-center">
              Orbit Entry
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-center">
              {name}
            </div>
            <div className="mx-auto mt-2 h-[2px] w-24 bg-cyan-400/80 rounded-full" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
