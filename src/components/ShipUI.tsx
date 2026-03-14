import React, { useEffect, useState } from 'react';
import { Rocket, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Target, Zap, Flame } from 'lucide-react';
import { useShipStore } from '../services/shipStore';
import { UserData } from '../services/gameManager';

interface ShipUIProps {
  onExit: () => void;
  userData?: UserData | null;
}

const WeaponCooldown = ({ lastFireTime, cooldownDuration, color }: { lastFireTime: number, cooldownDuration: number, color: string }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let animationFrameId: number;
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - lastFireTime;
      if (elapsed < cooldownDuration) {
        setProgress((elapsed / cooldownDuration) * 100);
        animationFrameId = requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
      }
    };
    updateProgress();
    return () => cancelAnimationFrame(animationFrameId);
  }, [lastFireTime, cooldownDuration]);

  return (
    <div className="absolute bottom-0 left-0 w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className={color}
        style={{
          width: `${progress}%`,
          transition: 'width 0.1s linear',
          boxShadow: `0 0 10px ${color.replace('bg-', '')}, 0 0 20px ${color.replace('bg-', '')}55`,
          height: '100%'
        }}
      />
    </div>
  );
};

const btnStyle = {
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.2)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 0 10px rgba(0,255,255,0.3)',
  transition: 'all 0.15s ease',
  pointerEvents: 'auto' as const,
  position: 'absolute' as const,
  overflow: 'hidden' as const
};

export function ShipUI({ onExit, userData }: ShipUIProps) {
  const [isMobile, setIsMobile] = useState(false);
  const { mobileKeys, setMobileKeys, isBoosting, setIsBoosting, lockedTarget, lastMgFire, lastMissileFire } = useShipStore();

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth <= 768 || isMobileUserAgent || window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const MobileCooldownOverlay = ({ lastFireTime, cooldownDuration }: { lastFireTime: number, cooldownDuration: number }) => {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
      let animationFrameId: number;
      const updateProgress = () => {
        const now = Date.now();
        const elapsed = now - lastFireTime;
        if (elapsed < cooldownDuration) {
          setProgress((elapsed / cooldownDuration) * 100);
          animationFrameId = requestAnimationFrame(updateProgress);
        } else {
          setProgress(100);
        }
      };
      updateProgress();
      return () => cancelAnimationFrame(animationFrameId);
    }, [lastFireTime, cooldownDuration]);

    if (progress === 100) return null;

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${100 - progress}%`,
          backgroundColor: 'rgba(0,0,0,0.6)',
          pointerEvents: 'none',
          borderRadius: '50%'
        }}
      />
    );
  };

  // Curved positions for MG and Missile around crosshair
  const weaponPositions = [
    { bottom: '50%', right: 'calc(50% + 100px)', transform: 'translate(50%,50%)' }, // MG top-right
    { bottom: '50%', right: 'calc(50% + 140px)', transform: 'translate(50%,50%)' }  // Missile bottom-right
  ];

  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none">
      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Crosshair className="text-white/50" size={32} strokeWidth={1} />
      </div>

      {/* Weapons Curved */}
      <button
        style={{ ...btnStyle, ...weaponPositions[0], pointerEvents: 'auto' }}
        onPointerDown={() => setMobileKeys((k: any) => ({ ...k, mg: true }))}
        onPointerUp={() => setMobileKeys((k: any) => ({ ...k, mg: false }))}
        onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, mg: false }))}
      >
        <Zap size={24} color={!userData || userData.machineGunAmmo ? '#fff' : '#555'} />
        <MobileCooldownOverlay lastFireTime={lastMgFire} cooldownDuration={100} />
        <span style={{ position: 'absolute', bottom: -20, fontSize: '10px', color: '#ffaa00', fontWeight: 'bold' }}>
          {userData ? userData.machineGunAmmo : '∞'}
        </span>
      </button>

      <button
        style={{ ...btnStyle, ...weaponPositions[1], pointerEvents: 'auto' }}
        onPointerDown={() => setMobileKeys((k: any) => ({ ...k, missile: true }))}
        onPointerUp={() => setMobileKeys((k: any) => ({ ...k, missile: false }))}
        onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, missile: false }))}
      >
        <Flame size={24} color={!userData || userData.missileAmmo ? '#fff' : '#555'} />
        <MobileCooldownOverlay lastFireTime={lastMissileFire} cooldownDuration={1000} />
        <span style={{ position: 'absolute', bottom: -20, fontSize: '10px', color: '#ff0000', fontWeight: 'bold' }}>
          {userData ? userData.missileAmmo : '∞'}
        </span>
      </button>

      {/* Resources Bottom-Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 text-right pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md p-2 rounded-lg flex flex-col gap-1 border border-white/10">
          <div className="text-zinc-400 text-xs font-bold tracking-wider">Resources</div>
          <div className="flex justify-end gap-2 items-center">
            <span className="text-zinc-300 font-mono text-sm">{userData ? userData.commonResources : 0}</span>
            <span className="text-white text-xs">Common</span>
          </div>
          <div className="flex justify-end gap-2 items-center">
            <span className="text-fuchsia-400 font-mono text-sm">{userData ? userData.rareResources : 0}</span>
            <span className="text-white text-xs">Aetherium</span>
          </div>
        </div>
      </div>

      {/* Mobile Controls Optimized */}
      {isMobile && (
        <>
          {/* Exit */}
          <button
            style={{ ...btnStyle, top: 20, right: 20, pointerEvents: 'auto', background: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => { e.stopPropagation(); onExit(); }}
          >
            <X size={24} />
          </button>

          {/* Boost Bottom-Right */}
          <button
            style={{ ...btnStyle, bottom: 40, right: 100, pointerEvents: 'auto', background: isBoosting ? 'rgba(255,68,68,0.8)' : 'rgba(0,0,0,0.5)' }}
            onPointerDown={() => setIsBoosting(true)}
            onPointerUp={() => setIsBoosting(false)}
            onPointerLeave={() => setIsBoosting(false)}
          >
            <Rocket size={28} />
          </button>

          {/* D-Pad Left-Bottom */}
          <div style={{ position: 'absolute', bottom: 40, left: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: '10px' }}>
            <div />
            <button
              style={{ ...btnStyle, background: mobileKeys.w ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
              onPointerDown={() => setMobileKeys((k: any) => ({ ...k, w: true }))}
              onPointerUp={() => setMobileKeys((k: any) => ({ ...k, w: false }))}
              onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, w: false }))}
            ><ArrowUp /></button>
            <div />
            <button
              style={{ ...btnStyle, background: mobileKeys.a ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
              onPointerDown={() => setMobileKeys((k: any) => ({ ...k, a: true }))}
              onPointerUp={() => setMobileKeys((k: any) => ({ ...k, a: false }))}
              onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, a: false }))}
            ><ArrowLeft /></button>
            <button
              style={{ ...btnStyle, background: mobileKeys.s ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
              onPointerDown={() => setMobileKeys((k: any) => ({ ...k, s: true }))}
              onPointerUp={() => setMobileKeys((k: any) => ({ ...k, s: false }))}
              onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, s: false }))}
            ><ArrowDown /></button>
            <button
              style={{ ...btnStyle, background: mobileKeys.d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
              onPointerDown={() => setMobileKeys((k: any) => ({ ...k, d: true }))}
              onPointerUp={() => setMobileKeys((k: any) => ({ ...k, d: false }))}
              onPointerLeave={() => setMobileKeys((k: any) => ({ ...k, d: false }))}
            ><ArrowRight /></button>
          </div>
        </>
      )}
    </div>
  );
}
