import React, { useEffect, useState } from 'react';
import { Rocket, X, Crosshair, Target, Zap, Flame, Compass, Navigation, LogOut } from 'lucide-react';
import { useShipStore } from '../services/shipStore';
import { UserData } from '../services/gameManager';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import * as THREE from 'three';

interface ShipUIProps {
  onExit: () => void;
  userData?: UserData | null;
  solarSystem?: SolarSystemData | null;
  currentPlanetId?: string | null;
  setCurrentPlanetId?: (id: string | null) => void;
}

const WeaponCooldown = ({ lastFireTime, cooldownDuration, color }: { lastFireTime: number, cooldownDuration: number, color: string }) => {
// ... existing WeaponCooldown ...
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


function VirtualJoystick({ mobileKeys, setMobileKeys }: { mobileKeys: any; setMobileKeys: any }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = 34;

  const updateFromPoint = (clientX: number, clientY: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      const scale = radius / dist;
      dx *= scale;
      dy *= scale;
    }
    setKnob({ x: dx, y: dy });
    setMobileKeys((k: any) => ({
      ...k,
      w: dy < -12,
      s: dy > 12,
      a: dx < -12,
      d: dx > 12,
    }));
  };

  const reset = () => {
    setKnob({ x: 0, y: 0 });
    setMobileKeys((k: any) => ({ ...k, w: false, a: false, s: false, d: false }));
  };

  return (
    <div
      style={{ position: 'absolute', left: 24, bottom: 28, width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', pointerEvents: 'auto', touchAction: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        updateFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(e) => {
        if ((e.buttons & 1) !== 1) return;
        e.stopPropagation();
        updateFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        reset();
      }}
      onPointerCancel={reset}
    >
      <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', left: `calc(50% - 22px + ${knob.x}px)`, top: `calc(50% - 22px + ${knob.y}px)`, width: 44, height: 44, borderRadius: '50%', background: mobileKeys.w || mobileKeys.a || mobileKeys.s || mobileKeys.d ? 'rgba(34,211,238,0.75)' : 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 0 18px rgba(34,211,238,0.18)' }} />
      <div style={{ position: 'absolute', bottom: -24, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Stick</div>
    </div>
  );
}

export function ShipUI({ onExit, userData, solarSystem, currentPlanetId, setCurrentPlanetId }: ShipUIProps) {
  const [isMobile, setIsMobile] = useState(false);
  const { mobileKeys, setMobileKeys, isBoosting, setIsBoosting, lockedTarget, setLockedTarget, lastMgFire, lastMissileFire, shipPosition, velocity, altitude, health, shield, boostEnergy, isJumping, setIsJumping } = useShipStore();
  const [showNav, setShowNav] = useState(false);

  useEffect(() => {
// ... existing checkMobile ...
    const checkMobile = () => {
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(window.innerWidth <= 768 || isMobileUserAgent || window.matchMedia("(pointer: coarse)").matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const planets = solarSystem?.bodies.filter(b => b.type === 'planet') as PlanetData[] || [];

  const formatDistance = (dist: number) => {
    if (dist > 1000) return `${(dist / 1000).toFixed(1)}k km`;
    return `${dist.toFixed(0)} km`;
  };

  const btnStyle = {
// ... existing btnStyle ...
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
// ... existing MobileCooldownOverlay ...
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
            <div className="flex flex-col gap-2">
              <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center gap-3 pointer-events-auto cursor-pointer hover:bg-black/70 transition-colors" onClick={() => setShowNav(!showNav)}>
                <Navigation className="text-cyan-400" size={24} />
                <div>
                  <div className="text-white font-bold tracking-wider">NAVIGATION</div>
                  <div className="text-zinc-400 text-xs">{currentPlanetId || 'Deep Space'}</div>
                </div>
              </div>

              {showNav && (
                <div className="bg-black/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 flex flex-col gap-2 w-64 pointer-events-auto max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase mb-1">Planetary Systems</div>
                  
                  <button 
                    className={`w-full p-3 rounded-lg border flex items-center justify-between transition-all ${currentPlanetId === null ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    onClick={() => {
                      if (setCurrentPlanetId) setCurrentPlanetId(null);
                    }}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-bold ${currentPlanetId === null ? 'text-cyan-400' : 'text-white'}`}>DEEP SPACE</span>
                      <span className="text-[10px] text-zinc-500">Exit planet orbit</span>
                    </div>
                    <LogOut size={14} className={currentPlanetId === null ? 'text-cyan-400' : 'text-white'} />
                  </button>

                  <div className="h-px bg-white/10 my-1" />

                  {planets.map(planet => {
                    const isCurrent = planet.id === currentPlanetId;
                    return (
                      <div 
                        key={planet.id} 
                        className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isCurrent ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>{(planet.id || '').toUpperCase()}</span>
                          <span className="text-[10px] text-zinc-500">Radius: {planet.radius.toFixed(1)}</span>
                        </div>
                        {!isCurrent && (
                          <button 
                            className="p-1.5 bg-white/10 hover:bg-cyan-500/40 rounded-md transition-colors"
                            onClick={() => setLockedTarget({ id: planet.id, type: 'planet' })}
                          >
                            <Target size={14} className={lockedTarget?.id === planet.id ? 'text-cyan-400' : 'text-white'} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {lockedTarget?.type === 'planet' && (
                    <button 
                      className={`mt-4 w-full py-3 rounded-xl border font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${isJumping ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30'}`}
                      onClick={() => setIsJumping(!isJumping)}
                    >
                      <Zap size={18} />
                      {isJumping ? 'ABORT JUMP' : 'INITIATE JUMP'}
                    </button>
                  )}
                </div>
              )}
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
          
          {/* Target Info Panel */}
      {lockedTarget && (
        <div className="absolute top-24 right-8 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl w-64 pointer-events-none">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase">Target Locked</div>
            <Target size={14} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white mb-1">{(lockedTarget.id || lockedTarget.name || '').toUpperCase()}</div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>DISTANCE</span>
            <span className="text-white font-mono">
              {shipPosition.distanceTo(lockedTarget.position || new THREE.Vector3()).toFixed(1)}m
            </span>
          </div>
          {lockedTarget.health !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-[8px] text-zinc-500 mb-1">
                <span>INTEGRITY</span>
                <span>{lockedTarget.health}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${lockedTarget.health > 50 ? 'bg-emerald-500' : lockedTarget.health > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${lockedTarget.health}%` }}
                />
              </div>
            </div>
          )}
          {lockedTarget.shieldHealth !== undefined && lockedTarget.shieldHealth > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[8px] text-cyan-400/80 mb-1">
                <span>SHIELD</span>
                <span>{Math.round(lockedTarget.shieldHealth)}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${lockedTarget.shieldHealth}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ship Integrity */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-none">
        <div className="flex flex-col items-center gap-1">
          <div className="text-[8px] text-cyan-500 font-bold tracking-widest uppercase">Shield</div>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300" 
              style={{ width: `${shield}%` }} 
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="text-[8px] text-amber-500 font-bold tracking-widest uppercase">Boost</div>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-amber-500 transition-all duration-300" 
              style={{ width: `${boostEnergy}%` }} 
            />
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <div className="text-[8px] text-red-500 font-bold tracking-widest uppercase">Hull</div>
          <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-red-500 transition-all duration-300" 
              style={{ width: `${health}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Flight Data */}
      <div className="absolute bottom-32 left-8 flex flex-col gap-4 pointer-events-none">
        <div className="flex flex-col">
          <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">Velocity</div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl font-black text-white font-mono">{velocity.toFixed(0)}</div>
            <div className="text-xs text-zinc-500">m/s</div>
          </div>
        </div>
        
        <div className="flex flex-col">
          <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">Altitude</div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl font-black text-white font-mono">{altitude.toFixed(0)}</div>
            <div className="text-xs text-zinc-500">m</div>
          </div>
        </div>
      </div>

      {/* Jumping Overlay */}
      {isJumping && (
        <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/10 backdrop-blur-sm z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="text-cyan-400 text-6xl font-black tracking-[1em] animate-pulse">JUMPING</div>
            <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 animate-loading" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Crosshair className="text-white/50" size={32} strokeWidth={1} />
            {lockedTarget && (
              <div className="absolute flex flex-col items-center gap-2 mt-20">
                <div className="text-cyan-400 text-[10px] font-bold tracking-widest uppercase animate-pulse">Target Locked</div>
                <div className="text-white text-xs font-mono">{(lockedTarget.id || lockedTarget.name || '').toUpperCase()}</div>
              </div>
            )}
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

          {/* Nav Toggle Button */}
          <button 
            style={{ pointerEvents: 'auto', position: 'absolute', top: 20, left: 20, background: showNav ? 'rgba(34,211,238,0.5)' : 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px', borderRadius: '50%' }}
            onClick={(e) => { e.stopPropagation(); setShowNav(!showNav); }}
          >
            <Navigation size={24} />
          </button>

          {showNav && (
            <div className="absolute top-20 left-5 bg-black/80 backdrop-blur-xl p-4 rounded-xl border border-white/10 flex flex-col gap-2 w-48 pointer-events-auto max-h-[50vh] overflow-y-auto custom-scrollbar">
              {planets.map(planet => {
                const isCurrent = planet.id === currentPlanetId;
                return (
                  <div 
                    key={planet.id} 
                    className={`p-2 rounded-lg border flex items-center justify-between ${isCurrent ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-white/5 border-white/10'}`}
                    onClick={() => !isCurrent && setLockedTarget({ id: planet.id, type: 'planet' })}
                  >
                    <span className={`text-xs font-bold ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>{(planet.id || '').toUpperCase()}</span>
                    {lockedTarget?.id === planet.id && <Target size={12} className="text-cyan-400" />}
                  </div>
                );
              })}
            </div>
          )}
          
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
          
          <VirtualJoystick mobileKeys={mobileKeys} setMobileKeys={setMobileKeys} />

          {/* Instructions */}
          <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', pointerEvents: 'none' }}>
            Right side: Look around
          </div>
        </>
      )}
    </div>
  );
}
