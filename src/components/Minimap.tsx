import React, { useMemo } from 'react';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
}

function getPlanetPosition(planet: PlanetData, time: number) {
  const angle = planet.initialAngle + time * planet.orbitSpeed;
  const x = Math.cos(angle) * planet.orbitDistance;
  const z = Math.sin(angle) * planet.orbitDistance;
  const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
  return new THREE.Vector3(x, y, z);
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition }) => {
  const size = 220;
  const padding = 18;
  const innerSize = size - padding * 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;

    const time = performance.now() / 1000;
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const maxDist = Math.max(...planets.map((b) => b.orbitDistance), 1);
    const scale = innerSize / (maxDist * 2.4);

    const planetPoints = planets.map((planet) => {
      const pos = getPlanetPosition(planet, time);
      const depth = (pos.z / Math.max(planet.orbitDistance, 1)) * 0.5 + 0.5;
      const x = size / 2 + pos.x * scale;
      const y = size / 2 + pos.y * scale * 0.6;

      let color = '#ffffff';
      switch (planet.visualClass) {
        case 'lush': color = '#10b981'; break;
        case 'oceanic': color = '#3b82f6'; break;
        case 'desert': color = '#fbbf24'; break;
        case 'arid_rocky': color = '#d97706'; break;
        case 'barren_gray': color = '#9ca3af'; break;
        case 'icy': color = '#93c5fd'; break;
        case 'volcanic': color = '#ef4444'; break;
      }

      return { id: planet.id, x, y, depth, color, orbitDistance: planet.orbitDistance };
    });

    const playerX = size / 2 + shipPosition.x * scale;
    const playerY = size / 2 + shipPosition.y * scale * 0.6;

    return { scale, planetPoints, playerX, playerY };
  }, [solarSystem, shipPosition.x, shipPosition.y, shipPosition.z, currentPlanetId]);

  if (!mapData) return null;

  return (
    <div className="absolute bottom-6 right-6 bg-black/55 backdrop-blur-md border border-white/15 rounded-3xl overflow-hidden shadow-2xl" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="minimapSun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>

        {mapData.planetPoints.map((p) => (
          <ellipse
            key={`orbit-${p.id}`}
            cx={size / 2}
            cy={size / 2}
            rx={p.orbitDistance * mapData.scale}
            ry={p.orbitDistance * mapData.scale * 0.6}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        <circle cx={size / 2} cy={size / 2} r={7} fill="url(#minimapSun)" />

        {mapData.planetPoints.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={Math.max(2, 2 + p.depth * 2)} fill={p.color} opacity={0.65 + p.depth * 0.35} />
            {p.id === currentPlanetId && (
              <circle cx={p.x} cy={p.y} r={10} fill="none" stroke={p.color} strokeWidth="1.5" opacity="0.8" />
            )}
          </g>
        ))}

        <circle cx={mapData.playerX} cy={mapData.playerY} r={4} fill="#ef4444" />
        <circle cx={mapData.playerX} cy={mapData.playerY} r={8} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.6" />
      </svg>

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-px bg-white/5" />
        <div className="h-full w-px bg-white/5" />
      </div>

      <div className="absolute top-2 left-3 text-[10px] font-mono text-white/45 uppercase tracking-[0.3em]">Nav 3D</div>
      <div className="absolute bottom-2 left-3 text-[10px] font-mono text-red-400/80 uppercase tracking-[0.2em]">Player</div>
    </div>
  );
};
