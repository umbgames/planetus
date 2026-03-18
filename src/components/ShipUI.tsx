import React, { useEffect, useState } from 'react';
import {
  Rocket,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Target,
  Zap,
  Flame,
} from 'lucide-react';
import { useShipStore } from '../services/shipStore';
import { UserData } from '../services/gameManager';
import { SolarSystemData } from '../services/solarSystem';
import * as THREE from 'three';

interface ShipUIProps {
  onExit: () => void;
  userData?: UserData | null;
  solarSystem?: SolarSystemData | null;
  currentPlanetId?: string | null;
  setCurrentPlanetId?: (id: string | null) => void;
}

const WeaponCooldown = ({
  lastFireTime,
  cooldownDuration,
  color,
}: {
  lastFireTime: number;
  cooldownDuration: number;
  color: string;
}) => {
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
      <div className={`h-full ${color}`} style={{ width: `${progress}%` }} />
    </div>
  );
};

export function ShipUI({
  onExit,
  userData,
}: ShipUIProps) {
  const [isMobile, setIsMobile] = useState(false);

  const {
    mobileKeys,
    setMobileKeys,
    isBoosting,
    setIsBoosting,
    lockedTarget,
    lastMgFire,
    lastMissileFire,
    shipPosition,
    velocity,
    altitude,
    health,
    shield,
    boostEnergy,
    isJumping,
  } = useShipStore();

  useEffect(() => {
    const checkMobile = () => {
      const isMobileUserAgent =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      setIsMobile(
        window.innerWidth <= 768 ||
          isMobileUserAgent ||
          window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window
      );
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

  const MobileCooldownOverlay = ({
    lastFireTime,
    cooldownDuration,
  }: {
    lastFireTime: number;
    cooldownDuration: number;
  }) => {
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
          pointerEvents: 'none',
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none">
      {!isMobile && (
        <div className="absolute inset-0 p-4">
          {/* Exit */}
          <button
            className="absolute top-4 right-4 bg-black/50 backdrop-blur-md p-3 rounded-full border border-white/10 pointer-events-auto hover:bg-black/70 transition-colors"
            onClick={onExit}
          >
            <X className="text-white" size={18} />
          </button>

          {/* Bottom Left: Flight + Target */}
          <div className="absolute bottom-8 left-8 flex flex-col gap-4 pointer-events-none">
            <div className="bg-black/45 backdrop-blur-md p-4 rounded-xl border border-white/10 w-64">
              <div className="text-zinc-400 text-xs font-bold tracking-wider mb-3">
                FLIGHT
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">
                    Velocity
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-black text-white font-mono">
                      {velocity.toFixed(0)}
                    </div>
                    <div className="text-xs text-zinc-500">m/s</div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">
                    Altitude
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-black text-white font-mono">
                      {altitude.toFixed(0)}
                    </div>
                    <div className="text-xs text-zinc-500">m</div>
                  </div>
                </div>
              </div>
            </div>

            {lockedTarget && (
              <div className="bg-black/45 backdrop-blur-md border border-white/10 p-4 rounded-xl w-64">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-zinc-500 tracking-widest uppercase">
                    Target Locked
                  </div>
                  <Target size={14} className="text-cyan-400" />
                </div>

                <div className="text-lg font-bold text-white mb-1">
                  {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>DISTANCE</span>
                  <span className="text-white font-mono">
                    {shipPosition
                      .distanceTo(lockedTarget.position || new THREE.Vector3())
                      .toFixed(1)}
                    m
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
                        className={`h-full transition-all duration-300 ${
                          lockedTarget.health > 50
                            ? 'bg-emerald-500'
                            : lockedTarget.health > 20
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${lockedTarget.health}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {isJumping && (
              <div className="bg-cyan-500/15 backdrop-blur-md border border-cyan-400/30 p-3 rounded-xl w-fit">
                <div className="text-cyan-400 text-xs font-bold tracking-[0.3em] uppercase animate-pulse">
                  Jumping
                </div>
              </div>
            )}
          </div>

          {/* Bottom Center: Ship Integrity */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-cyan-500 font-bold tracking-widest uppercase">
                Shield
              </div>
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${shield}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-amber-500 font-bold tracking-widest uppercase">
                Boost
              </div>
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${boostEnergy}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-red-500 font-bold tracking-widest uppercase">
                Hull
              </div>
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Right: Resources + Weapons */}
          <div className="absolute bottom-8 right-8 bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col gap-3 text-right w-56 pointer-events-auto">
            <div className="text-zinc-400 text-xs font-bold tracking-wider">
              RESOURCES
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-zinc-300 font-mono text-sm">
                  {userData ? userData.commonResources : 0}
                </span>
                <span className="text-white text-xs">Common</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-fuchsia-400 font-mono text-sm">
                  {userData ? userData.rareResources : 0}
                </span>
                <span className="text-white text-xs">Aetherium</span>
              </div>
            </div>

            <div className="text-zinc-400 text-xs font-bold tracking-wider mt-2">
              WEAPONS
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-yellow-500 font-mono text-sm">∞</span>
                <span className="text-white text-xs">MG (L-Click)</span>
              </div>
              <WeaponCooldown
                lastFireTime={lastMgFire}
                cooldownDuration={100}
                color="bg-yellow-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-red-500 font-mono text-sm">∞</span>
                <span className="text-white text-xs">MSL (R-Click)</span>
              </div>
              <WeaponCooldown
                lastFireTime={lastMissileFire}
                cooldownDuration={250}
                color="bg-red-500"
              />
            </div>

            <div className="text-zinc-500 text-[10px] mt-1">Press T to Lock Target</div>
          </div>

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Crosshair className="text-white/50" size={32} strokeWidth={1} />
            {lockedTarget && (
              <div className="absolute flex flex-col items-center gap-2 mt-20">
                <div className="text-cyan-400 text-[10px] font-bold tracking-widest uppercase animate-pulse">
                  Target Locked
                </div>
                <div className="text-white text-xs font-mono">
                  {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isMobile && (
        <>
          {/* Exit Button */}
          <button
            style={{
              pointerEvents: 'auto',
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              padding: '10px',
              borderRadius: '50%',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
          >
            <X size={24} />
          </button>

          {/* Bottom HUD */}
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 120,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            <div
              className="bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10"
              style={{ minWidth: 130 }}
            >
              <div className="text-[10px] text-zinc-500 font-bold tracking-wider mb-2">
                FLIGHT
              </div>
              <div className="text-white text-xs">VEL: {velocity.toFixed(0)}</div>
              <div className="text-white text-xs">ALT: {altitude.toFixed(0)}</div>
              {lockedTarget && (
                <div className="text-cyan-400 text-xs mt-2">
                  {String(lockedTarget.id || lockedTarget.name).toUpperCase()}
                </div>
              )}
            </div>

            <div
              className="bg-black/50 backdrop-blur-md p-3 rounded-xl border border-white/10 text-right"
              style={{ minWidth: 150 }}
            >
              <div className="text-[10px] text-zinc-500 font-bold tracking-wider mb-2">
                STATUS
              </div>
              <div className="text-white text-xs">
                Common: {userData ? userData.commonResources : 0}
              </div>
              <div className="text-fuchsia-400 text-xs">
                Aetherium: {userData ? userData.rareResources : 0}
              </div>
            </div>
          </div>

          {/* Bottom center ship bars */}
          <div className="absolute bottom-[92px] left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-cyan-500 font-bold tracking-widest uppercase">
                Shield
              </div>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-cyan-400" style={{ width: `${shield}%` }} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-amber-500 font-bold tracking-widest uppercase">
                Boost
              </div>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-amber-500" style={{ width: `${boostEnergy}%` }} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-red-500 font-bold tracking-widest uppercase">
                Hull
              </div>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-red-500" style={{ width: `${health}%` }} />
              </div>
            </div>
          </div>

          {/* Boost Button */}
          <button
            style={{
              ...btnStyle,
              bottom: 40,
              right: 40,
              background: isBoosting ? 'rgba(255,68,68,0.8)' : 'rgba(0,0,0,0.5)',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsBoosting(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setIsBoosting(false);
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              setIsBoosting(false);
            }}
          >
            <Rocket size={28} />
          </button>

          {/* Machine Gun Button */}
          <button
            style={{
              ...btnStyle,
              bottom: 110,
              right: 40,
              background: mobileKeys.mg ? 'rgba(255,170,0,0.8)' : 'rgba(0,0,0,0.5)',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, mg: true }));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, mg: false }));
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, mg: false }));
            }}
          >
            <Zap size={24} color="#fff" />
            <MobileCooldownOverlay lastFireTime={lastMgFire} cooldownDuration={100} />
            <span
              style={{
                position: 'absolute',
                bottom: -20,
                fontSize: '10px',
                color: '#ffaa00',
                fontWeight: 'bold',
              }}
            >
              ∞
            </span>
          </button>

          {/* Missile Button */}
          <button
            style={{
              ...btnStyle,
              bottom: 40,
              right: 110,
              background: mobileKeys.missile ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.5)',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, missile: true }));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, missile: false }));
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, missile: false }));
            }}
          >
            <Flame size={24} color="#fff" />
            <MobileCooldownOverlay
              lastFireTime={lastMissileFire}
              cooldownDuration={250}
            />
            <span
              style={{
                position: 'absolute',
                bottom: -20,
                fontSize: '10px',
                color: '#ff0000',
                fontWeight: 'bold',
              }}
            >
              ∞
            </span>
          </button>

          {/* Target Lock Button */}
          <button
            style={{
              ...btnStyle,
              bottom: 110,
              right: 110,
              background: lockedTarget
                ? 'rgba(255,0,0,0.5)'
                : mobileKeys.lock
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(0,0,0,0.5)',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, lock: true }));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, lock: false }));
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              setMobileKeys((k: any) => ({ ...k, lock: false }));
            }}
          >
            <Target size={24} color={lockedTarget ? '#ff0000' : '#fff'} />
          </button>

          {/* D-Pad */}
          <div
            style={{
              position: 'absolute',
              bottom: 40,
              left: 40,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 60px)',
              gap: '10px',
            }}
          >
            <div />
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, w: true }));
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, w: false }));
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, w: false }));
              }}
              style={{
                ...btnStyle,
                background: mobileKeys.w ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)',
              }}
            >
              <ArrowUp />
            </button>
            <div />

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, a: true }));
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, a: false }));
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, a: false }));
              }}
              style={{
                ...btnStyle,
                background: mobileKeys.a ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)',
              }}
            >
              <ArrowLeft />
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, s: true }));
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, s: false }));
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, s: false }));
              }}
              style={{
                ...btnStyle,
                background: mobileKeys.s ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)',
              }}
            >
              <ArrowDown />
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, d: true }));
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, d: false }));
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setMobileKeys((k: any) => ({ ...k, d: false }));
              }}
              style={{
                ...btnStyle,
                background: mobileKeys.d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.5)',
              }}
            >
              <ArrowRight />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
