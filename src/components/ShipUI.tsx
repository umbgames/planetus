import React, { useEffect, useMemo, useState } from 'react';
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
  Navigation,
  LogOut,
} from 'lucide-react';
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

function CooldownBar({
  lastFireTime,
  cooldownDuration,
  className,
}: {
  lastFireTime: number;
  cooldownDuration: number;
  className?: string;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - lastFireTime;
      if (elapsed < cooldownDuration) {
        setProgress((elapsed / cooldownDuration) * 100);
        frame = requestAnimationFrame(tick);
      } else {
        setProgress(100);
      }
    };

    tick();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [lastFireTime, cooldownDuration]);

  return (
    <div className="mt-1 h-px w-full bg-white/10 overflow-hidden">
      <div
        className={className ?? 'bg-white/70 h-full'}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function MobileCooldownOverlay({
  lastFireTime,
  cooldownDuration,
}: {
  lastFireTime: number;
  cooldownDuration: number;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - lastFireTime;
      if (elapsed < cooldownDuration) {
        setProgress((elapsed / cooldownDuration) * 100);
        frame = requestAnimationFrame(tick);
      } else {
        setProgress(100);
      }
    };

    tick();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [lastFireTime, cooldownDuration]);

  if (progress >= 100) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 bg-white/10 pointer-events-none"
      style={{ height: `${100 - progress}%` }}
    />
  );
}

function StatBar({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[92px]">
      <div className="text-[9px] uppercase tracking-[0.25em] text-white/45">{label}</div>
      <div className="h-1 bg-white/10 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ShipUI({
  onExit,
  userData,
  solarSystem,
  currentPlanetId,
  setCurrentPlanetId,
}: ShipUIProps) {
  const [isMobile, setIsMobile] = useState(false);

  const {
    mobileKeys,
    setMobileKeys,
    isBoosting,
    setIsBoosting,
    lockedTarget,
    setLockedTarget,
    lastMgFire,
    lastMissileFire,
    shipPosition,
    velocity,
    altitude,
    health,
    shield,
    boostEnergy,
    isJumping,
    setIsJumping,
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

  const planets = useMemo(
    () => ((solarSystem?.bodies.filter((b) => b.type === 'planet') as PlanetData[]) || []),
    [solarSystem]
  );

  const targetDistance = lockedTarget
    ? shipPosition.distanceTo(lockedTarget.position || new THREE.Vector3())
    : null;

  const mobileButtonBase: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.16)',
    color: 'white',
    background: 'transparent',
    pointerEvents: 'auto',
    position: 'relative',
    touchAction: 'none',
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none select-none text-white">
      {!isMobile && (
        <div className="absolute inset-0 p-5">
          {/* Top left: nav */}
          <div className="absolute top-5 left-5 max-w-[280px] pointer-events-auto">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/55 mb-3">
              <Navigation size={14} />
              <span>Navigation</span>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <button
                className={`text-left border-l pl-3 transition-opacity ${
                  currentPlanetId === null
                    ? 'border-white text-white'
                    : 'border-white/20 text-white/55 hover:text-white'
                }`}
                onClick={() => setCurrentPlanetId?.(null)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>Deep Space</span>
                  <LogOut size={12} />
                </div>
              </button>

              {planets.map((planet) => {
                const isCurrent = planet.id === currentPlanetId;
                const isLocked = lockedTarget?.id === planet.id;

                return (
                  <div key={planet.id} className="flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-3 border-l border-white/15 pl-3">
                      <button
                        className={`text-left transition-opacity ${
                          isCurrent ? 'text-white' : 'text-white/60 hover:text-white'
                        }`}
                        onClick={() => setCurrentPlanetId?.(planet.id)}
                      >
                        <div className="uppercase">{planet.id}</div>
                        <div className="text-[10px] text-white/35">
                          {planet.radius.toFixed(1)} radius · {planet.moons.length} moon
                          {planet.moons.length === 1 ? '' : 's'}
                        </div>
                      </button>

                      <button
                        className={`shrink-0 ${isLocked ? 'text-white' : 'text-white/45 hover:text-white'}`}
                        onClick={() => setLockedTarget({ id: planet.id, type: 'planet' })}
                      >
                        <Target size={13} />
                      </button>
                    </div>

                    {planet.moons.length > 0 && (
                      <div className="ml-4 flex flex-col gap-1">
                        {planet.moons.map((moon) => {
                          const moonLocked = lockedTarget?.id === moon.id;
                          return (
                            <button
                              key={moon.id}
                              className={`text-left border-l pl-3 ${
                                moonLocked
                                  ? 'border-white text-white'
                                  : 'border-white/10 text-white/45 hover:text-white'
                              }`}
                              onClick={() => {
                                setCurrentPlanetId?.(planet.id);
                                setLockedTarget({
                                  id: moon.id,
                                  type: 'moon',
                                  parentPlanetId: planet.id,
                                });
                              }}
                            >
                              {moon.id.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lockedTarget?.type === 'planet' && (
              <button
                className={`mt-4 text-xs uppercase tracking-[0.2em] border-b pb-1 pointer-events-auto ${
                  isJumping ? 'border-white text-white' : 'border-white/30 text-white/65 hover:text-white'
                }`}
                onClick={() => setIsJumping(!isJumping)}
              >
                {isJumping ? 'Abort Jump' : 'Initiate Jump'}
              </button>
            )}
          </div>

          {/* Top right: resources / weapons */}
          <div className="absolute top-5 right-5 w-[220px] text-right">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45 mb-3">
              Status
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-white/35 text-[10px] uppercase tracking-[0.18em]">Resources</div>
                <div className="mt-1 text-white/80">Common {userData?.commonResources ?? 0}</div>
                <div className="text-white/80">Aetherium {userData?.rareResources ?? 0}</div>
              </div>

              <div>
                <div className="text-white/35 text-[10px] uppercase tracking-[0.18em]">Weapons</div>

                <div className="mt-1">
                  <div className="flex items-center justify-end gap-2 text-white/80">
                    <span>MG</span>
                    <span className="font-mono">∞</span>
                  </div>
                  <CooldownBar
                    lastFireTime={lastMgFire}
                    cooldownDuration={100}
                    className="bg-white/75 h-full"
                  />
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-end gap-2 text-white/80">
                    <span>MSL</span>
                    <span className="font-mono">∞</span>
                  </div>
                  <CooldownBar
                    lastFireTime={lastMissileFire}
                    cooldownDuration={250}
                    className="bg-white/45 h-full"
                  />
                </div>
              </div>

              <div className="text-[10px] text-white/35 uppercase tracking-[0.18em]">
                T to lock target
              </div>
            </div>
          </div>

          {/* Target info */}
          {lockedTarget && (
            <div className="absolute top-28 right-5 w-[220px] text-right">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                Locked Target
              </div>
              <div className="mt-1 text-base uppercase">{lockedTarget.id || lockedTarget.name}</div>

              <div className="mt-2 text-xs text-white/55">
                Distance{' '}
                <span className="font-mono text-white">
                  {targetDistance?.toFixed(1)}m
                </span>
              </div>

              {lockedTarget.health !== undefined && (
                <div className="mt-2">
                  <div className="text-[10px] text-white/35 uppercase tracking-[0.18em] mb-1">
                    Integrity {lockedTarget.health}%
                  </div>
                  <div className="h-1 bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white/75"
                      style={{ width: `${lockedTarget.health}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom left: flight data */}
          <div className="absolute bottom-24 left-5 flex flex-col gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Velocity</div>
              <div className="text-3xl font-mono">{velocity.toFixed(0)}</div>
              <div className="text-[10px] text-white/35">m/s</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Altitude</div>
              <div className="text-3xl font-mono">{altitude.toFixed(0)}</div>
              <div className="text-[10px] text-white/35">m</div>
            </div>

            {isJumping && (
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                Jumping…
              </div>
            )}
          </div>

          {/* Bottom center: ship bars */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6">
            <StatBar label="Shield" value={shield} colorClass="bg-white/90" />
            <StatBar label="Boost" value={boostEnergy} colorClass="bg-white/70" />
            <StatBar label="Hull" value={health} colorClass="bg-white/50" />
          </div>

          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Crosshair className="text-white/40" size={28} strokeWidth={1} />
            {lockedTarget && (
              <div className="absolute mt-16 text-center">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/55">
                  Locked
                </div>
                <div className="text-xs font-mono text-white/85 uppercase">
                  {lockedTarget.id || lockedTarget.name}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isMobile && (
        <>
          {/* Top controls */}
          <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-auto">
            <div className="max-w-[70%] overflow-x-auto whitespace-nowrap no-scrollbar text-xs">
              <button
                className={`mr-3 border-b pb-1 ${
                  currentPlanetId === null ? 'border-white text-white' : 'border-white/20 text-white/50'
                }`}
                onClick={() => setCurrentPlanetId?.(null)}
              >
                Deep Space
              </button>

              {planets.map((planet) => (
                <button
                  key={planet.id}
                  className={`mr-3 border-b pb-1 uppercase ${
                    currentPlanetId === planet.id
                      ? 'border-white text-white'
                      : 'border-white/20 text-white/50'
                  }`}
                  onClick={() => setCurrentPlanetId?.(planet.id)}
                >
                  {planet.id}
                </button>
              ))}
            </div>

            <button
              className="pointer-events-auto text-white/75 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
            >
              <X size={22} />
            </button>
          </div>

          {/* Mobile target / state */}
          <div className="absolute top-14 left-4 text-xs text-white/60">
            {lockedTarget ? (
              <div className="uppercase">
                Target: <span className="text-white">{lockedTarget.id || lockedTarget.name}</span>
              </div>
            ) : (
              <div>No target</div>
            )}
            {isJumping && <div className="mt-1 uppercase text-white">Jumping…</div>}
          </div>

          {/* Bottom center stats */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <StatBar label="Shield" value={shield} colorClass="bg-white/90" />
            <StatBar label="Boost" value={boostEnergy} colorClass="bg-white/70" />
            <StatBar label="Hull" value={health} colorClass="bg-white/50" />
          </div>

          {/* Right controls */}
          <div className="absolute bottom-8 right-6 flex flex-col gap-3 pointer-events-auto">
            <button
              style={{
                ...mobileButtonBase,
                borderColor: isBoosting ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
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
              <Rocket size={24} />
            </button>

            <div className="flex gap-3">
              <button
                style={{
                  ...mobileButtonBase,
                  borderColor: mobileKeys.lock || lockedTarget ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
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
                <Target size={22} />
              </button>

              <button
                style={{
                  ...mobileButtonBase,
                  borderColor: mobileKeys.missile ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
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
                <Flame size={22} />
                <MobileCooldownOverlay lastFireTime={lastMissileFire} cooldownDuration={250} />
              </button>
            </div>

            <button
              style={{
                ...mobileButtonBase,
                borderColor: mobileKeys.mg ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
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
              <Zap size={22} />
              <MobileCooldownOverlay lastFireTime={lastMgFire} cooldownDuration={100} />
            </button>
          </div>

          {/* Left d-pad */}
          <div
            className="absolute bottom-8 left-6 grid gap-2 pointer-events-auto"
            style={{ gridTemplateColumns: 'repeat(3, 56px)' }}
          >
            <div />
            <button
              style={{
                ...mobileButtonBase,
                borderColor: mobileKeys.w ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
              }}
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
            >
              <ArrowUp />
            </button>
            <div />

            <button
              style={{
                ...mobileButtonBase,
                borderColor: mobileKeys.a ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
              }}
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
            >
              <ArrowLeft />
            </button>

            <button
              style={{
                ...mobileButtonBase,
                borderColor: mobileKeys.s ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
              }}
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
            >
              <ArrowDown />
            </button>

            <button
              style={{
                ...mobileButtonBase,
                borderColor: mobileKeys.d ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)',
              }}
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
            >
              <ArrowRight />
            </button>
          </div>

          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Crosshair className="text-white/35" size={26} strokeWidth={1} />
          </div>
        </>
      )}
    </div>
  );
}
