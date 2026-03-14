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

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [lastFireTime, cooldownDuration]);

  return (
    <div className="w-full h-1 bg-white/10 mt-1 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color}`} 
        style={{ width: `${progress}%` }}
      />
    </div>
  );
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

  const btnStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto' as const,
    position: 'absolute' as const,
    overflow: 'hidden' as const,
  };

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

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
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
          pointerEvents: 'none'
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none">
      {/* Ship HUD */}
      {!isMobile && (
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center gap-3">
              <Rocket className="text-cyan-400" size={24} />
              <div>
                <div className="text-white font-bold tracking-wider">SHIP MODE</div>
                <div className="text-zinc-400 text-xs">Press O to exit</div>
              </div>
            </div>
            
            <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-3 text-right w-48">
              <div className="text-zinc-400 text-xs font-bold tracking-wider">RESOURCES</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-zinc-300 font-mono text-sm">{userData ? userData.commonResources : 0}</span>
                  <span className="text-white text-xs">Common</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-fuchsia-400 font-mono text-sm">{userData ? userData.rareResources : 0}</span>
                  <span className="text-white text-xs">Aetherium</span>
                </div>
              </div>

              <div className="text-zinc-400 text-xs font-bold tracking-wider mt-2">WEAPONS</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-yellow-500 font-mono text-sm">{userData ? userData.machineGunAmmo : '∞'}</span>
                  <span className="text-white text-xs">MG (L-Click)</span>
                </div>
                <WeaponCooldown lastFireTime={lastMgFire} cooldownDuration={100} color="bg-yellow-500" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-red-500 font-mono text-sm">{userData ? userData.missileAmmo : '∞'}</span>
                  <span className="text-white text-xs">MSL (R-Click)</span>
                </div>
                <WeaponCooldown lastFireTime={lastMissileFire} cooldownDuration={1000} color="bg-red-500" />
              </div>

              <div className="text-zinc-500 text-[10px] mt-1">Press T to Lock Target</div>
            </div>
          </div>
          
          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Crosshair className="text-white/50" size={32} strokeWidth={1} />
          </div>
        </div>
      )}
      
      {isMobile && (
        <>
          {/* Exit Button */}
          <button 
            style={{ pointerEvents: 'auto', position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px', borderRadius: '50%' }}
            onClick={(e) => { e.stopPropagation(); onExit(); }}
          >
            <X size={24} />
          </button>
          
          {/* Boost Button */}
          <button 
            style={{ ...btnStyle, bottom: 40, right: 40, background: isBoosting ? 'rgba(255,68,68,0.8)' : 'rgba(0,0,0,0.5)' }}
            onPointerDown={(e) => { e.stopPropagation(); setIsBoosting(true); }}
            onPointerUp={(e) => { e.stopPropagation(); setIsBoosting(false); }}
            onPointerLeave={(e) => { e.stopPropagation(); setIsBoosting(false); }}
          >
            <Rocket size={28} />
          </button>

          {/* Machine Gun Button */}
          <button 
            style={{ ...btnStyle, bottom: 110, right: 40, background: mobileKeys.mg ? 'rgba(255,170,0,0.8)' : 'rgba(0,0,0,0.5)' }}
            onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, mg: true})); }}
            onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, mg: false})); }}
            onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, mg: false})); }}
          >
            <Zap size={24} color={!userData || userData.machineGunAmmo ? '#fff' : '#555'} />
            <MobileCooldownOverlay lastFireTime={lastMgFire} cooldownDuration={100} />
            <span style={{ position: 'absolute', bottom: -20, fontSize: '10px', color: '#ffaa00', fontWeight: 'bold' }}>{userData ? userData.machineGunAmmo : '∞'}</span>
          </button>

          {/* Missile Button */}
          <button 
            style={{ ...btnStyle, bottom: 40, right: 110, background: mobileKeys.missile ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.5)' }}
            onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, missile: true})); }}
            onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, missile: false})); }}
            onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, missile: false})); }}
          >
            <Flame size={24} color={!userData || userData.missileAmmo ? '#fff' : '#555'} />
            <MobileCooldownOverlay lastFireTime={lastMissileFire} cooldownDuration={1000} />
            <span style={{ position: 'absolute', bottom: -20, fontSize: '10px', color: '#ff0000', fontWeight: 'bold' }}>{userData ? userData.missileAmmo : '∞'}</span>
          </button>

          {/* Target Lock Button */}
          <button 
            style={{ ...btnStyle, position: 'absolute', bottom: 110, right: 110, background: lockedTarget ? 'rgba(255,0,0,0.5)' : (mobileKeys.lock ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)') }}
            onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, lock: true})); }}
            onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, lock: false})); }}
            onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, lock: false})); }}
          >
            <Target size={24} color={lockedTarget ? '#ff0000' : '#fff'} />
          </button>
          
          {/* D-Pad */}
          <div style={{ position: 'absolute', bottom: 40, left: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: '10px' }}>
            <div />
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, w: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, w: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, w: false})) }}
              style={{ ...btnStyle, background: mobileKeys.w ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowUp /></button>
            <div />
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, a: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, a: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, a: false})) }}
              style={{ ...btnStyle, background: mobileKeys.a ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowLeft /></button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, s: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, s: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, s: false})) }}
              style={{ ...btnStyle, background: mobileKeys.s ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowDown /></button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, d: true})) }}
              onPointerUp={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, d: false})) }}
              onPointerLeave={(e) => { e.stopPropagation(); setMobileKeys((k: any) => ({...k, d: false})) }}
              style={{ ...btnStyle, background: mobileKeys.d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)' }}><ArrowRight /></button>
          </div>
          
          {/* Instructions */}
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', pointerEvents: 'none' }}>
            Right side: Look around
          </div>
        </>
      )}
    </div>
  );
}
