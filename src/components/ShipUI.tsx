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
  lastHitTime = 0,
  isFiring = false,
}: {
  locked: boolean;
  label?: string;
  distance: number | null;
  health?: number;
  lastHitTime?: number;
  isFiring?: boolean;
}) => {
  const [hitActive, setHitActive] = useState(false);

  useEffect(() => {
    if (!lastHitTime) return;
    setHitActive(true);
    const timer = setTimeout(() => setHitActive(false), 200);
    return () => clearTimeout(timer);
  }, [lastHitTime]);

  const accent = locked ? '#ef4444' : '#38bdf8';

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
          transform: isFiring ? 'scale(1.12)' : locked ? 'scale(1.04)' : 'scale(1)',
          transition: 'all 120ms ease-out',
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
            border: `1px solid ${locked ? 'rgba(239,68,68,0.35)' : 'rgba(56,189,248,0.22)'}`,
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
            border: `1px solid ${locked ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.5)'}`,
            borderRadius: '9999px',
          }}
        />
        <div style={{ position: 'absolute', left: '50%', top: 8, width: 1, height: 14, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 1, height: 14, background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: 8, width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', top: '50%', right: 8, width: 14, height: 1, background: 'rgba(255,255,255,0.5)', transform: 'translateY(-50%)' }} />

        {/* Hitmarker X ticks */}
        {hitActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="relative w-8 h-8 scale-110 transition-transform">
              <div className="absolute top-1 left-1 w-2.5 h-0.5 bg-[#ef4444] rotate-45 origin-center shadow-[0_0_8px_#ef4444]" />
              <div className="absolute top-1 right-1 w-2.5 h-0.5 bg-[#ef4444] -rotate-45 origin-center shadow-[0_0_8px_#ef4444]" />
              <div className="absolute bottom-1 left-1 w-2.5 h-0.5 bg-[#ef4444] -rotate-45 origin-center shadow-[0_0_8px_#ef4444]" />
              <div className="absolute bottom-1 right-1 w-2.5 h-0.5 bg-[#ef4444] rotate-45 origin-center shadow-[0_0_8px_#ef4444]" />
            </div>
          </div>
        )}

        <div className="absolute left-1/2 top-full mt-5 -translate-x-1/2 flex flex-col items-center gap-1">
          <div
            className={`text-[10px] font-bold tracking-[0.28em] uppercase ${locked ? 'text-[#ef4444]' : 'text-[#38bdf8]'}`}
            style={{ textShadow: locked ? '0 0 12px rgba(239,68,68,0.45)' : '0 0 12px rgba(56,189,248,0.45)' }}
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
    lastHitTime,
  } = useShipStore();

  const isFiring = (Date.now() - lastMgFire < 130) || (Date.now() - lastMissileFire < 180);

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
          <div className="absolute bottom-8 left-8 flex flex-col gap-5 w-64 pointer-events-none glass-panel p-5 rounded-2xl border-l-4 border-l-[#38bdf8]">
            <div>
              <div className="text-[#94a3b8] text-xs font-bold font-display tracking-widest mb-3">
                FLIGHT SYSTEMS
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                  <div className="text-[10px] text-[#64748b] font-bold tracking-widest uppercase">
                    Velocity
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-black text-white font-mono">
                      {velocity.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-[#64748b]">m/s</div>
                  </div>
                </div>

                <div className="flex justify-between items-baseline">
                  <div className="text-[10px] text-[#64748b] font-bold tracking-widest uppercase">
                    Altitude
                  </div>
                  <div className="flex items-baseline gap-1">
                    <div className="text-2xl font-black text-white font-mono">
                      {altitude.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-[#64748b]">m</div>
                  </div>
                </div>
              </div>
            </div>

            {lockedTarget && (
              <div className="mt-2 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-[#ef4444] font-display tracking-widest uppercase animate-pulse">
                    Target Locked
                  </div>
                  <Target size={14} className="text-[#ef4444]" />
                </div>

                <div className="text-lg font-bold text-white mb-2">
                  {(lockedTarget.id || lockedTarget.name || '').toUpperCase()}
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#94a3b8]">
                  <span>DISTANCE</span>
                  <span className="text-white font-mono">
                    {targetDistance !== null ? `${targetDistance.toFixed(1)}m` : '—'}
                  </span>
                </div>

                {lockedTarget.health !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[9px] text-[#94a3b8] mb-1 font-bold">
                      <span>INTEGRITY</span>
                      <span>{lockedTarget.health}%</span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full transition-all duration-300 ${
                          lockedTarget.health > 50
                            ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]'
                            : lockedTarget.health > 20
                            ? 'bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]'
                            : 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]'
                        }`}
                        style={{ width: `${lockedTarget.health}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {isJumping && (
              <div className="mt-2 text-[#38bdf8] text-xs font-bold font-display tracking-[0.25em] uppercase animate-pulse">
                Hyperspace Jump Initiated
              </div>
            )}
          </div>

          {/* Bottom Center */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 pointer-events-none glass-panel px-6 py-4 rounded-3xl">
            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] text-[#38bdf8] font-bold font-display tracking-[0.2em] uppercase">
                Shield
              </div>
              <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                <div
                  className="h-full bg-[#38bdf8] transition-all duration-300 shadow-[0_0_10px_#38bdf8]"
                  style={{ width: `${shield}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] text-[#fbbf24] font-bold font-display tracking-[0.2em] uppercase">
                Boost
              </div>
              <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                <div
                  className="h-full bg-[#fbbf24] transition-all duration-300 shadow-[0_0_10px_#fbbf24]"
                  style={{ width: `${boostEnergy}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-[9px] text-[#ef4444] font-bold font-display tracking-[0.2em] uppercase">
                Hull
              </div>
              <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                <div
                  className="h-full bg-[#ef4444] transition-all duration-300 shadow-[0_0_10px_#ef4444]"
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Right */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-4 text-right w-60 pointer-events-auto glass-panel p-5 rounded-2xl border-r-4 border-r-[#fbbf24]">
            <div className="text-[#94a3b8] text-xs font-bold font-display tracking-widest">
              CARGO & ARMAMENT
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-[11px] font-bold uppercase tracking-wider">Common</span>
                <span className="text-[#cbd5e1] font-mono text-sm bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {userData ? userData.commonResources : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-[11px] font-bold uppercase tracking-wider">Aetherium</span>
                <span className="text-[#c084fc] font-mono text-sm bg-[#c084fc]/10 px-2 py-0.5 rounded border border-[#c084fc]/20">
                  {userData ? userData.rareResources : 0}
                </span>
              </div>
            </div>

            <div className="h-px bg-white/10 w-full my-1" />

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider">Machine Gun</span>
                  <span className="text-[#fbbf24] font-mono text-sm font-bold">∞</span>
                </div>
                <WeaponCooldown
                  lastFireTime={lastMgFire}
                  cooldownDuration={100}
                  color="bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider">Missiles</span>
                  <span className="text-[#ef4444] font-mono text-sm font-bold">∞</span>
                </div>
                <WeaponCooldown
                  lastFireTime={lastMissileFire}
                  cooldownDuration={250}
                  color="bg-[#ef4444] shadow-[0_0_8px_#ef4444]"
                />
              </div>
            </div>

            <div className="text-[#64748b] text-[9px] mt-1 font-bold uppercase tracking-widest">
              [T] to Lock Target
            </div>
          </div>

          {/* Targeting Reticle */}
          <TargetReticle
            locked={Boolean(lockedTarget)}
            label={lockedTarget ? (lockedTarget.id || lockedTarget.name || '').toUpperCase() : undefined}
            distance={targetDistance}
            health={lockedTarget?.health}
            lastHitTime={lastHitTime}
            isFiring={isFiring}
          />
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
            lastHitTime={lastHitTime}
            isFiring={isFiring}
          />
        </>
      )}
    </div>
  );
}
