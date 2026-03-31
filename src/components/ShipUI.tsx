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

const TargetReticle = ({
  locked,
  label,
  distance,
  health,
}: {
  locked: boolean;
  label?: string;
  distance: number | null;
  health?: number;
}) => {
  const accent = locked ? '#ffb347' : '#7dd3fc';

  const bracket = (style: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        width: 28,
        height: 28,
        borderColor: accent,
        borderStyle: 'solid',
        opacity: locked ? 0.95 : 0.65,
        ...style,
      }}
    />
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        style={{
          position: 'relative',
          width: locked ? 132 : 92,
          height: locked ? 132 : 92,
          transform: locked ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 180ms ease',
        }}
      >
        {bracket({ top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 })}
        {bracket({ top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 })}
        {bracket({ bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 })}
        {bracket({ bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 })}

        <div
          style={{
            position: 'absolute',
            inset: locked ? 22 : 26,
            border: `1px solid ${locked ? 'rgba(255,179,71,0.32)' : 'rgba(125,211,252,0.2)'}`,
            borderRadius: '9999px',
            opacity: locked ? 0.55 : 0.35,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 18,
            height: 18,
            transform: 'translate(-50%, -50%)',
            border: `1px solid ${locked ? 'rgba(255,244,221,0.85)' : 'rgba(255,255,255,0.5)'}`,
            borderRadius: '9999px',
          }}
        />
        <div style={{ position: 'absolute', left: '50%', top: 8, width: 1, height: 14, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 1, height: 14, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: 8, width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', top: '50%', right: 8, width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'translateY(-50%)' }} />

        <div className="absolute left-1/2 top-full mt-5 -translate-x-1/2 flex flex-col items-center gap-1">
          <div
            className={`text-[10px] font-bold tracking-[0.28em] uppercase ${locked ? 'text-amber-300' : 'text-cyan-300'}`}
            style={{ textShadow: '0 0 12px rgba(255,179,71,0.35)' }}
          >
            {locked ? 'Target Locked' : 'Tracking'}
          </div>
          {label && <div className="text-white text-[11px] font-mono tracking-wider">{label}</div>}
          <div className="flex items-center gap-3 text-[10px] text-white/75 font-mono">
            <span>{distance !== null ? `${distance.toFixed(0)}m` : '—'}</span>
            {typeof health === 'number' && <span>{health}% INT</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileJoystick = ({ onChange }: { onChange: (x: number, y: number) => void }) => {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const centerRef = React.useRef({ x: 0, y: 0 });
  const baseRef = React.useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    setActive(true);
    if (baseRef.current) {
      const rect = baseRef.current.getBoundingClientRect();
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    updatePos(e.clientX, e.clientY);
  };

  const updatePos = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const maxRadius = 40;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxRadius);
    const angle = Math.atan2(dy, dx);
    const newX = Math.cos(angle) * distance;
    const newY = Math.sin(angle) * distance;
    setPosition({ x: newX, y: newY });
    
    onChange(newX / maxRadius, newY / maxRadius);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!active) return;
    e.stopPropagation();
    updatePos(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.target.releasePointerCapture(e.pointerId);
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      style={{
        position: 'absolute',
        bottom: 36,
        left: 20,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(4px)',
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.8)',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
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

          {/* Left controls - Joystick */}
          <MobileJoystick
            onChange={(x, y) => {
              const keysToSet: any = { w: false, s: false, a: false, d: false };
              if (y < -0.3) keysToSet.w = true;
              else if (y > 0.3) keysToSet.s = true;
              if (x < -0.3) keysToSet.a = true;
              else if (x > 0.3) keysToSet.d = true;
              setMobileKeys((k: any) => ({ ...k, ...keysToSet }));
            }}
          />

          <TargetReticle
            locked={Boolean(lockedTarget)}
            label={lockedTarget ? (lockedTarget.id || lockedTarget.name || '').toUpperCase() : undefined}
            distance={targetDistance}
            health={lockedTarget?.health}
          />
        </>
      )}
    </div>
  );
}
