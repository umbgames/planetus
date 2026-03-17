import React, { useMemo } from 'react';
import * as THREE from 'three';
import { SolarSystemData, PlanetData, buildOrbitMap, getPlanetWorldPosition } from '../services/solarSystem';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
  shipHeading?: number;
}

const colorForClass = (visualClass: PlanetData["visualClass"]) => {
  switch (visualClass) {
    case 'lush': return '#22c55e';
    case 'oceanic': return '#38bdf8';
    case 'desert': return '#f59e0b';
    case 'arid_rocky': return '#b45309';
    case 'barren_gray': return '#a1a1aa';
    case 'icy': return '#bfdbfe';
    case 'volcanic': return '#ef4444';
    default: return '#ffffff';
  }
};

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition, shipHeading = 0 }) => {
  const size = 180;
  const center = size / 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;
    const orbitMap = buildOrbitMap(solarSystem.bodies);
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const elapsed = performance.now() / 1000;
    const range = Math.max(140, ...planets.map((p) => (orbitMap.get(p.id) ?? p.orbitDistance) * 0.22));

    const rotate = (vec: THREE.Vector3) => {
      const c = Math.cos(-shipHeading);
      const s = Math.sin(-shipHeading);
      return new THREE.Vector3(vec.x * c - vec.z * s, vec.y, vec.x * s + vec.z * c);
    };

    const shipWorld = shipPosition.clone();

    return {
      range,
      planets: planets.map((planet) => {
        const world = getPlanetWorldPosition(planet, elapsed, orbitMap);
        const rel = new THREE.Vector3(world.x, world.y, world.z).sub(shipWorld);
        const rotated = rotate(rel);
        const normalized = rotated.clone().divideScalar(range);
        const clamped = normalized.length() > 1 ? normalized.normalize() : normalized;
        const depth = THREE.MathUtils.clamp((rotated.y / range) * 0.9, -0.9, 0.9);
        return {
          id: planet.id,
          x: clamped.x,
          y: clamped.z,
          depth,
          color: colorForClass(planet.visualClass),
          current: planet.id === currentPlanetId,
        };
      })
    };
  }, [solarSystem, currentPlanetId, shipPosition.x, shipPosition.y, shipPosition.z, shipHeading]);

  if (!mapData) return null;

  return (
    <div
      className="absolute bottom-5 right-5 overflow-hidden rounded-3xl border border-cyan-400/30 bg-black/65 shadow-2xl backdrop-blur-xl"
      style={{ width: size, height: size * 0.82, boxShadow: '0 0 30px rgba(34,211,238,0.15), inset 0 0 30px rgba(34,211,238,0.08)' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_62%)]" />
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`}>
        <defs>
          <linearGradient id="gridFade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
          </linearGradient>
        </defs>

        <g opacity="0.45">
          <path d={`M ${22} ${center * 0.98} L ${center} ${26} L ${size - 22} ${center * 0.98} L ${center} ${size * 0.82 - 18} Z`} fill="none" stroke="url(#gridFade)" strokeWidth="1" />
          <path d={`M ${center} ${22} L ${center} ${size * 0.82 - 16}`} stroke="rgba(34,211,238,0.12)" strokeWidth="1" />
          <path d={`M ${24} ${center * 0.98} L ${size - 24} ${center * 0.98}`} stroke="rgba(34,211,238,0.12)" strokeWidth="1" />
        </g>

        {mapData.planets.map((p) => {
          const px = center + p.x * 60;
          const py = center * 0.98 + p.y * 34 - p.depth * 12;
          const r = p.current ? 4.5 : THREE.MathUtils.lerp(2, 3.8, (p.depth + 1) / 2);
          return (
            <g key={p.id}>
              <circle cx={px} cy={py} r={r * 2.2} fill={p.color} opacity={0.12} />
              <circle cx={px} cy={py} r={r} fill={p.color} opacity={0.96} />
              {p.current && <circle cx={px} cy={py} r={r + 5} fill="none" stroke={p.color} strokeWidth="1" opacity={0.8} />}
            </g>
          );
        })}

        <g>
          <path d={`M ${center} ${center * 0.98 - 13} L ${center - 7} ${center * 0.98 + 10} L ${center} ${center * 0.98 + 4} L ${center + 7} ${center * 0.98 + 10} Z`} fill="#22d3ee" />
          <circle cx={center} cy={center * 0.98} r="12" fill="none" stroke="rgba(34,211,238,0.22)" strokeWidth="1" />
        </g>
      </svg>

      <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-[0.35em] text-cyan-300/85">Nav 3D</div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-[9px] uppercase tracking-[0.28em] text-white/35">Ship-linked tactical map</div>
    </div>
  );
};
