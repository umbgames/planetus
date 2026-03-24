import React, { useEffect, useState } from 'react';
import { Rocket, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Target, Zap, Flame } from 'lucide-react';
import { useShipStore } from '../services/shipStore';
import { UserData } from '../services/gameManager';
import { SolarSystemData } from '../services/solarSystem';

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

export function ShipUI({ onExit, userData }: ShipUIProps) {
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
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto' as const,
    position: 'absolute' as const,
    overflow: 'hidden' as const,
  };

  const hasValidShipPosition =
    shipPosition &&
    typeof shipPosition.x === 'number' &&
    typeof shipPosition.y === 'number' &&
    typeof shipPosition.z === 'number';

  const hasValidTargetPosition =
    lockedTarget?.position &&
    typeof lockedTarget.position.x === 'number' &&
    typeof lockedTarget.position.y === 'number' &&
    typeof lockedTarget.position.z === 'number';

  const targetDistance =
    hasValidShipPosition && hasValidTargetPosition
      ? shipPosition.distanceTo(lockedTarget.position)
      : null;

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
          backgroundColor: 'rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none">
      {!isMobile && (
        <div className="absolute inset-0 p-4">
          <button
            className="absolute top-4 right-4 p-3 rounded-full text-white/90 pointer-events-auto hover:text-white transition-colors"
            onClick={onExit}
          >
            <X size={18} />
          </button>

          {/* Bottom Left */}
          <div className="absolute bottom-8 left-8 flex flex-col gap-5 w-64 pointer-events-none">
            <div>
              <div className="text-zinc-400 text-xs font-bold tracking-wider mb-3">
                FLIGHT
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">
                    Velocity
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-3xl font-black text-white font-mono">
                      {velocity.toFixed(0)}
                    </div>
                    <div className="text-xs text-zinc-500">m/s</div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">
                    Altitude
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-3xl font-black text-white font-mono">
                      {altitude.toFixed(0)}
                    </div>
                    <div className="text-xs text-zinc-500">m</div>
                  </div>
                </div>
              </div>
            </div>

            {lockedTarget && (
              <div>
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
                    {targetDistance !== null ? `${targetDistance.toFixed(1)}m` : '—'}
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
              <div className="text-cyan-400 text-xs font-bold tracking-[0.25em] uppercase animate-pulse">
                Jumping
              </div>
            )}
          </div>

          {/* Bottom Center */}
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

          {/* Bottom Right */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 text-right w-52 pointer-events-auto">
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

            <div className="text-zinc-500 text-[10px] mt-1">
              Press T to Lock Target
            </div>
          </div>

          {/* Targeting Reticle */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative h-16 w-16">
              <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
              <div className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
              <div className="absolute left-0 top-0 h-4 w-4 border-l border-t border-white/45" />
              <div className="absolute right-0 top-0 h-4 w-4 border-r border-t border-white/45" />
              <div className="absolute bottom-0 left-0 h-4 w-4 border-b border-l border-white/45" />
              <div className="absolute bottom-0 right-0 h-4 w-4 border-b border-r border-white/45" />
              {lockedTarget && (
                <>
                  <div className="absolute inset-0 animate-pulse rounded-full border border-cyan-400/35" />
                  <div className="absolute left-1/2 top-[calc(100%+20px)] min-w-52 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-center backdrop-blur-md">
                    <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-400">
                      Target Locked
                    </div>
                    <div className="mt-1 text-xs font-mono text-white">
                      {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      <span>{targetDistance !== null ? `${targetDistance.toFixed(0)} m` : 'NO RANGE'}</span>
                      {lockedTarget.health !== undefined && <span>{lockedTarget.health}% integrity</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <>
          {/* Exit */}
          <button
            style={{
              pointerEvents: 'auto',
              position: 'absolute',
              top: 14,
              right: 14,
              color: 'white',
              padding: '8px',
              borderRadius: '50%',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
          >
            <X size={22} />
          </button>

          {/* Mobile top hint */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '11px',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            Right side: Look around
          </div>

          {/* Mobile left info */}
          <div className="absolute left-4 bottom-[152px] flex flex-col gap-3 pointer-events-none max-w-[120px]">
            <div>
              <div className="text-[10px] text-zinc-500 font-bold tracking-wider mb-1">
                FLIGHT
              </div>
              <div className="text-white text-sm font-mono leading-tight">
                {velocity.toFixed(0)}
              </div>
              <div className="text-zinc-500 text-[10px] uppercase">m/s</div>

              <div className="mt-2 text-white text-sm font-mono leading-tight">
                {altitude.toFixed(0)}
              </div>
              <div className="text-zinc-500 text-[10px] uppercase">m</div>
            </div>

            {lockedTarget && (
              <div>
                <div className="text-cyan-400 text-[10px] font-bold tracking-widest uppercase">
                  Locked
                </div>
                <div className="text-white text-xs font-mono mt-1 break-words">
                  {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                </div>
                {targetDistance !== null && (
                  <div className="text-zinc-400 text-[10px] mt-1">
                    {targetDistance.toFixed(1)}m
                  </div>
                )}
                {lockedTarget.health !== undefined && (
                  <div className="mt-2">
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
              <div className="text-cyan-400 text-[10px] font-bold tracking-[0.25em] uppercase animate-pulse">
                Jumping
              </div>
            )}
          </div>

          {/* Mobile right info */}
          <div className="absolute right-4 bottom-[152px] flex flex-col gap-3 text-right pointer-events-none max-w-[132px]">
            <div>
              <div className="text-zinc-500 text-[10px] font-bold tracking-wider mb-1">
                STATUS
              </div>
              <div className="text-white text-xs">
                Common: {userData ? userData.commonResources : 0}
              </div>
              <div className="text-fuchsia-400 text-xs">
                Aetherium: {userData ? userData.rareResources : 0}
              </div>
            </div>

            <div>
              <div className="text-zinc-500 text-[10px] font-bold tracking-wider mb-1">
                WEAPONS
              </div>

              <div className="mb-2">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-yellow-500 font-mono text-[10px]">∞</span>
                  <span className="text-white text-[10px]">MG</span>
                </div>
                <WeaponCooldown
                  lastFireTime={lastMgFire}
                  cooldownDuration={100}
                  color="bg-yellow-500"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-red-500 font-mono text-[10px]">∞</span>
                  <span className="text-white text-[10px]">MSL</span>
                </div>
                <WeaponCooldown
                  lastFireTime={lastMissileFire}
                  cooldownDuration={250}
                  color="bg-red-500"
                />
              </div>
            </div>
          </div>

          {/* Mobile center bars */}
          <div className="absolute bottom-[112px] left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
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

          {/* Right controls */}
          <button
            style={{
              ...btnStyle,
              bottom: 36,
              right: 20,
              background: isBoosting ? 'rgba(255,68,68,0.8)' : 'rgba(0,0,0,0.35)',
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

          <button
            style={{
              ...btnStyle,
              bottom: 106,
              right: 20,
              background: mobileKeys.mg ? 'rgba(255,170,0,0.8)' : 'rgba(0,0,0,0.35)',
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
            <Zap size={24} color={!userData || userData.machineGunAmmo ? '#fff' : '#555'} />
            <MobileCooldownOverlay lastFireTime={lastMgFire} cooldownDuration={100} />
            <span
              style={{
                position: 'absolute',
                bottom: -18,
                fontSize: '10px',
                color: '#ffaa00',
                fontWeight: 'bold',
              }}
            >
              ∞
            </span>
          </button>

          <button
            style={{
              ...btnStyle,
              bottom: 36,
              right: 90,
              background: mobileKeys.missile ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.35)',
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
            <Flame size={24} color={!userData || userData.missileAmmo ? '#fff' : '#555'} />
            <MobileCooldownOverlay
              lastFireTime={lastMissileFire}
              cooldownDuration={250}
            />
            <span
              style={{
                position: 'absolute',
                bottom: -18,
                fontSize: '10px',
                color: '#ff0000',
                fontWeight: 'bold',
              }}
            >
              ∞
            </span>
          </button>

          <button
            style={{
              ...btnStyle,
              bottom: 106,
              right: 90,
              background: lockedTarget
                ? 'rgba(255,0,0,0.5)'
                : mobileKeys.lock
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(0,0,0,0.35)',
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

          {/* Left controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 36,
              left: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 56px)',
              gap: '8px',
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
                width: '56px',
                height: '56px',
                background: mobileKeys.w ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
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
                width: '56px',
                height: '56px',
                background: mobileKeys.a ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
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
                width: '56px',
                height: '56px',
                background: mobileKeys.s ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
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
                width: '56px',
                height: '56px',
                background: mobileKeys.d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
              }}
            >
              <ArrowRight />
            </button>
          </div>

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Crosshair className="text-white/50" size={28} strokeWidth={1} />
            {lockedTarget && (
              <div className="absolute flex flex-col items-center gap-2 mt-16">
                <div className="text-cyan-400 text-[10px] font-bold tracking-widest uppercase animate-pulse">
                  Target Locked
                </div>
                <div className="text-white text-[11px] font-mono max-w-[160px] text-center break-words">
                  {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
