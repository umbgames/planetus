import React, { useEffect, useMemo, useState } from 'react';
import { X, Crosshair, Target, Zap, Compass, Navigation, LogOut, Shield, Gauge, Rocket } from 'lucide-react';
import { useShipStore } from '../services/shipStore';
import { UserData } from '../services/gameManager';
import { SolarSystemData, PlanetData } from '../services/solarSystem';

interface ShipUIProps {
  onExit: () => void;
  userData?: UserData | null;
  solarSystem?: SolarSystemData | null;
  currentPlanetId?: string | null;
  setCurrentPlanetId?: (id: string | null) => void;
}

const WeaponCooldown = ({ lastFireTime, cooldownDuration, color }: { lastFireTime: number; cooldownDuration: number; color: string }) => {
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
    return () => animationFrameId && cancelAnimationFrame(animationFrameId);
  }, [lastFireTime, cooldownDuration]);

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full ${color}`} style={{ width: `${progress}%` }} />
    </div>
  );
};

function StatBar({ label, value, max = 100, color = 'bg-cyan-400' }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/45">
        <span>{label}</span>
        <span className="font-mono text-white/75">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ShipUI({ onExit, userData, solarSystem, currentPlanetId, setCurrentPlanetId }: ShipUIProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const {
    lockedTarget,
    setLockedTarget,
    lastMgFire,
    lastMissileFire,
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
      const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      setIsMobile(window.innerWidth <= 768 || coarse);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const planets = useMemo(() => (solarSystem?.bodies.filter((b): b is PlanetData => b.type === 'planet') ?? []), [solarSystem]);
  const currentPlanet = planets.find((planet) => planet.id === currentPlanetId);

  const minimalistPanel = 'rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.35)]';
  const navLabel = currentPlanet ? currentPlanet.name : 'Deep Space';

  if (isMobile) {
    return (
      <div className="pointer-events-none absolute inset-0 z-50 select-none">
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          <div className={`${minimalistPanel} pointer-events-auto px-4 py-3`}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Navigation</div>
            <div className="mt-1 text-sm font-semibold text-white">{navLabel}</div>
          </div>

          <button
            onClick={onExit}
            className={`${minimalistPanel} pointer-events-auto flex h-12 w-12 items-center justify-center text-white/80 transition hover:text-white`}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 select-none">
      <div className="absolute inset-x-6 top-6 flex items-start justify-between gap-4">
        <div className={`${minimalistPanel} pointer-events-auto min-w-[260px] px-5 py-4`}>
          <button onClick={() => setShowNav((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Current Sector</div>
              <div className="mt-1 text-xl font-semibold tracking-tight text-white">{navLabel}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-cyan-300">
              <Navigation size={18} />
            </div>
          </button>

          {showNav && (
            <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
              <button
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${currentPlanetId === null ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-white/8 bg-white/4 text-white/80 hover:bg-white/8'}`}
                onClick={() => setCurrentPlanetId?.(null)}
              >
                <div>
                  <div className="text-sm font-medium">Deep Space</div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Free orbit</div>
                </div>
                <LogOut size={16} />
              </button>

              {planets.map((planet) => {
                const isCurrent = planet.id === currentPlanetId;
                const isLocked = lockedTarget?.id === planet.id;
                return (
                  <div
                    key={planet.id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${isCurrent ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/8 bg-white/4 hover:bg-white/8'}`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${isCurrent ? 'text-cyan-300' : 'text-white'}`}>{planet.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Radius {planet.radius.toFixed(0)} km</div>
                    </div>
                    {!isCurrent && (
                      <button
                        className={`rounded-lg border px-3 py-2 transition ${isLocked ? 'border-cyan-400/40 bg-cyan-400 text-black' : 'border-white/8 bg-white/5 text-white/80 hover:bg-white/10'}`}
                        onClick={() => setLockedTarget({ id: planet.id, name: planet.name, type: 'planet' })}
                      >
                        <Target size={15} />
                      </button>
                    )}
                  </div>
                );
              })}

              {lockedTarget?.type === 'planet' && (
                <button
                  className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${isJumping ? 'border-red-400/40 bg-red-500/15 text-red-300' : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/20'}`}
                  onClick={() => setIsJumping(!isJumping)}
                >
                  <Zap size={16} />
                  {isJumping ? 'Abort jump' : `Jump to ${lockedTarget.name ?? 'target'}`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <div className={`${minimalistPanel} w-[220px] px-5 py-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Flight</div>
                <div className="mt-1 text-base font-semibold text-white">Ship status</div>
              </div>
              <Rocket size={16} className="text-white/40" />
            </div>

            <div className="space-y-3">
              <StatBar label="Hull" value={health} color="bg-emerald-400" />
              <StatBar label="Shield" value={shield} color="bg-cyan-400" />
              <StatBar label="Boost" value={boostEnergy} color="bg-violet-400" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-4 text-xs">
              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                <div className="mb-1 flex items-center gap-2 text-white/45"><Gauge size={12} /> Speed</div>
                <div className="font-mono text-white">{velocity.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                <div className="mb-1 flex items-center gap-2 text-white/45"><Compass size={12} /> Altitude</div>
                <div className="font-mono text-white">{altitude.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className={`${minimalistPanel} w-[220px] px-5 py-4`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Weapons</div>
                <div className="mt-1 text-base font-semibold text-white">Combat systems</div>
              </div>
              <Crosshair size={16} className="text-white/40" />
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-white/75">
                  <span>Pulse laser</span>
                  <span className="font-mono text-white">{userData ? userData.machineGunAmmo : '∞'}</span>
                </div>
                <WeaponCooldown lastFireTime={lastMgFire} cooldownDuration={100} color="bg-amber-400" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-white/75">
                  <span>Heavy laser</span>
                  <span className="font-mono text-white">{userData ? userData.missileAmmo : '∞'}</span>
                </div>
                <WeaponCooldown lastFireTime={lastMissileFire} cooldownDuration={1000} color="bg-rose-400" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                  <div className="mb-1 flex items-center gap-2 text-white/45"><Shield size={12} /> Lock</div>
                  <div className="truncate font-medium text-white">{lockedTarget?.name || lockedTarget?.id || 'None'}</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-3">
                  <div className="mb-1 flex items-center gap-2 text-white/45"><Zap size={12} /> Jump</div>
                  <div className={`font-medium ${isJumping ? 'text-cyan-300' : 'text-white'}`}>{isJumping ? 'Charging' : 'Standby'}</div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onExit}
            className={`${minimalistPanel} pointer-events-auto flex h-[60px] w-[60px] items-center justify-center text-white/75 transition hover:text-white`}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
