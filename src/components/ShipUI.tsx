import React, { useEffect, useState } from 'react';
import { Joystick } from 'react-joystick-component';
import { Rocket, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Target, Zap, Flame, Compass, Navigation, LogOut } from 'lucide-react';
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
        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-4">
              <div 
                className="bg-[#151619] p-4 rounded-xl border border-white/10 flex items-center gap-4 pointer-events-auto cursor-pointer hover:border-cyan-500/50 transition-all shadow-2xl" 
                onClick={() => setShowNav(!showNav)}
              >
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 border border-dashed border-cyan-500/30 rounded-full animate-spin-slow" />
                  <Navigation className="text-cyan-400" size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-0.5">Navigation System</div>
                  <div className="text-white font-black tracking-tighter text-lg">{currentPlanetId ? currentPlanetId.toUpperCase() : 'DEEP SPACE'}</div>
                </div>
              </div>

              {showNav && (
                <div className="bg-[#151619] p-6 rounded-2xl border border-white/10 flex flex-col gap-3 w-72 pointer-events-auto max-h-[60vh] overflow-y-auto custom-scrollbar shadow-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-zinc-500 text-[10px] font-mono tracking-[0.3em] uppercase">Sector Map</div>
                    <Compass size={12} className="text-zinc-600" />
                  </div>
                  
                  <button 
                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all group ${currentPlanetId === null ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                    onClick={() => {
                      if (setCurrentPlanetId) setCurrentPlanetId(null);
                    }}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-black tracking-tight ${currentPlanetId === null ? 'text-cyan-400' : 'text-white'}`}>VOID SECTOR</span>
                      <span className="text-[10px] font-mono text-zinc-500">0.0.0.0</span>
                    </div>
                    <LogOut size={16} className={currentPlanetId === null ? 'text-cyan-400' : 'text-zinc-600 group-hover:text-white'} />
                  </button>

                  <div className="h-px bg-white/5 my-2" />

                  {planets.map(planet => {
                    const isCurrent = planet.id === currentPlanetId;
                    const isLocked = lockedTarget?.id === planet.id;
                    return (
                      <div 
                        key={planet.id} 
                        className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isCurrent ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-sm font-black tracking-tight ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>{planet.name.toUpperCase()}</span>
                          <span className="text-[10px] font-mono text-zinc-500">R: {planet.radius.toFixed(0)}km</span>
                        </div>
                        {!isCurrent && (
                          <button 
                            className={`p-2 rounded-lg transition-all ${isLocked ? 'bg-cyan-500 text-black' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                            onClick={() => setLockedTarget({ id: planet.id, type: 'planet' })}
                          >
                            <Target size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {lockedTarget?.type === 'planet' && (
                    <button 
                      className={`mt-6 w-full py-4 rounded-xl border font-black tracking-[0.2em] transition-all flex flex-col items-center justify-center gap-1 ${isJumping ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30'}`}
                      onClick={() => setIsJumping(!isJumping)}
                    >
                      <div className="flex items-center gap-2">
                        <Zap size={18} />
                        <span>{isJumping ? 'ABORT JUMP' : 'INITIATE JUMP'}</span>
                      </div>
                      <div className="text-[8px] font-mono opacity-50">WARP DRIVE READY</div>
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              {/* Resources Panel */}
              <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex flex-col gap-4 w-56 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-zinc-500 text-[10px] font-mono tracking-[0.3em] uppercase">Cargo Bay</div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="text-[10px] font-mono text-zinc-400 uppercase">Common</div>
                    <div className="text-white font-black font-mono">{userData ? userData.commonResources : 0}</div>
                  </div>
                  <div className="flex items-center justify-between bg-fuchsia-500/10 p-2 rounded-lg border border-fuchsia-500/20">
                    <div className="text-[10px] font-mono text-fuchsia-400 uppercase">Aetherium</div>
                    <div className="text-fuchsia-300 font-black font-mono">{userData ? userData.rareResources : 0}</div>
                  </div>
                </div>
              </div>

              {/* Weapons Panel */}
              <div className="bg-[#151619] p-4 rounded-xl border border-white/10 flex flex-col gap-4 w-56 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-zinc-500 text-[10px] font-mono tracking-[0.3em] uppercase">Weapon Systems</div>
                  <Crosshair size={12} className="text-zinc-600" />
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">Light Laser</span>
                      <span className="text-yellow-500 font-black font-mono">{userData ? userData.machineGunAmmo : '∞'}</span>
                    </div>
                    <WeaponCooldown lastFireTime={lastMgFire} cooldownDuration={100} color="bg-yellow-500" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">Heavy Laser</span>
                      <span className="text-red-500 font-black font-mono">{userData ? userData.missileAmmo : '∞'}</span>
                    </div>
                    <WeaponCooldown lastFireTime={lastMissileFire} cooldownDuration={1000} color="bg-red-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Target Info Panel */}
          {lockedTarget && (
            <div className="absolute top-32 right-8 bg-[#151619] p-6 rounded-2xl border border-cyan-500/30 w-72 pointer-events-none shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <div className="text-cyan-500 text-[10px] font-mono tracking-[0.3em] uppercase mb-1">Target Locked</div>
                  <div className="text-xl font-black tracking-tight text-white">{(lockedTarget.name || lockedTarget.id || '').toUpperCase()}</div>
                </div>
                <div className="w-10 h-10 rounded-full border border-cyan-500/30 flex items-center justify-center">
                  <Target size={18} className="text-cyan-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Range</span>
                  <span className="text-white font-black font-mono">
                    {shipPosition.distanceTo(lockedTarget.position || new THREE.Vector3()).toFixed(0)}m
                  </span>
                </div>

                {lockedTarget.health !== undefined && (
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase mb-2">
                      <span>Integrity</span>
                      <span className="text-white">{lockedTarget.health}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${lockedTarget.health > 50 ? 'bg-emerald-500' : lockedTarget.health > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${lockedTarget.health}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom HUD: Ship Integrity */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-12 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-mono text-cyan-500 tracking-[0.2em] uppercase">Shield Matrix</div>
              <div className="relative w-48 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-300" 
                  style={{ width: `${shield}%` }} 
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-mono text-amber-500 tracking-[0.2em] uppercase">Engine Boost</div>
              <div className="relative w-48 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300" 
                  style={{ width: `${boostEnergy}%` }} 
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-mono text-red-500 tracking-[0.2em] uppercase">Hull Integrity</div>
              <div className="relative w-48 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-300" 
                  style={{ width: `${health}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Flight Data: Monospace Timecodes Style */}
          <div className="absolute bottom-12 left-12 flex flex-col gap-8 pointer-events-none">
            <div className="flex flex-col">
              <div className="text-[10px] font-mono text-zinc-500 tracking-[0.3em] uppercase mb-2">Velocity Vector</div>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-black text-white font-mono tracking-tighter">{velocity.toFixed(1)}</div>
                <div className="text-xs font-mono text-zinc-600 uppercase">m/s</div>
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="text-[10px] font-mono text-zinc-500 tracking-[0.3em] uppercase mb-2">Altimeter Data</div>
              <div className="flex items-baseline gap-2">
                <div className="text-5xl font-black text-white font-mono tracking-tighter">{altitude.toFixed(0)}</div>
                <div className="text-xs font-mono text-zinc-600 uppercase">m</div>
              </div>
            </div>
          </div>

          {/* Jumping Overlay */}
          {isJumping && (
            <div className="absolute inset-0 flex items-center justify-center bg-cyan-500/5 backdrop-blur-sm z-50 pointer-events-none">
              <div className="flex flex-col items-center gap-6">
                <div className="text-cyan-400 text-7xl font-black tracking-[1.5em] animate-pulse drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">WARP</div>
                <div className="w-80 h-[2px] bg-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-cyan-400 animate-loading" />
                </div>
                <div className="text-cyan-500 font-mono text-xs tracking-[0.5em] uppercase">Folding Space-Time</div>
              </div>
            </div>
          )}

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 border border-white/20 rounded-full" />
              <div className="absolute w-full h-[1px] bg-white/20" />
              <div className="absolute h-full w-[1px] bg-white/20" />
              <Crosshair className="text-white/80" size={24} strokeWidth={1} />
            </div>
            {lockedTarget && (
              <div className="absolute flex flex-col items-center gap-2 mt-32">
                <div className="text-cyan-400 text-[10px] font-mono font-bold tracking-[0.5em] uppercase animate-pulse">Tracking Active</div>
                <div className="text-white text-xs font-mono bg-cyan-500/20 px-3 py-1 rounded border border-cyan-500/30">{(lockedTarget.name || lockedTarget.id || '').toUpperCase()}</div>
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
          
          {/* Joystick */}
          <div style={{ position: 'absolute', bottom: 40, left: 40, zIndex: 100 }}>
            <Joystick 
              size={120} 
              baseColor="rgba(0,0,0,0.5)" 
              stickColor="rgba(255,255,255,0.5)" 
              move={(e) => {
                setMobileKeys((k: any) => ({
                  ...k,
                  w: e.y && e.y > 0.2,
                  s: e.y && e.y < -0.2,
                  a: e.x && e.x < -0.2,
                  d: e.x && e.x > 0.2
                }));
              }} 
              stop={() => {
                setMobileKeys((k: any) => ({
                  ...k,
                  w: false,
                  s: false,
                  a: false,
                  d: false
                }));
              }} 
            />
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
