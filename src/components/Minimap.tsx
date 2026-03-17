import React, { useMemo } from 'react';
import { SolarSystemData, PlanetData, buildOrbitMap, getPlanetDisplayName, getPlanetWorldPosition } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition }) => {
  const size = 220;
  const padding = 20;
  const innerSize = size - padding * 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;
    const orbitMap = buildOrbitMap(solarSystem.bodies);
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const maxDist = Math.max(...planets.map(p => orbitMap.get(p.id) ?? p.orbitDistance), 1);
    const scale = innerSize / (maxDist * 2.3);
    const elapsed = performance.now() / 1000;
    return {
      scale,
      planets: planets.map((planet) => {
        let color = '#ffffff';
        switch (planet.visualClass) {
          case 'lush': color = '#10b981'; break;
          case 'oceanic': color = '#3b82f6'; break;
          case 'desert': color = '#fbbf24'; break;
          case 'arid_rocky': color = '#d97706'; break;
          case 'barren_gray': color = '#9ca3af'; break;
          case 'icy': color = '#7dd3fc'; break;
          case 'volcanic': color = '#ef4444'; break;
        }
        const pos = getPlanetWorldPosition(planet, elapsed, orbitMap);
        return { id: planet.id, name: getPlanetDisplayName(planet.id, solarSystem), color, orbitDistance: orbitMap.get(planet.id) ?? planet.orbitDistance, pos };
      })
    };
  }, [solarSystem, innerSize, shipPosition.x, shipPosition.y, shipPosition.z]);

  if (!mapData) return null;

  return (
    <div 
      className="absolute bottom-6 right-6 bg-black/60 backdrop-blur border border-white/20 rounded-full overflow-hidden shadow-2xl"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Orbits */}
        {mapData.planets.map(p => (
          <ellipse key={`orbit-${p.id}`} cx={size / 2} cy={size / 2} rx={p.orbitDistance * mapData.scale} ry={p.orbitDistance * mapData.scale * 0.45} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        ))}

        <defs>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="1" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={size / 2} cy={size / 2} r={16} fill="url(#sunGlow)" />
        <circle cx={size / 2} cy={size / 2} r={4} fill="#fbbf24" className="animate-pulse" />

        {mapData.planets.map(p => {
          const x = size / 2 + p.pos.x * mapData.scale;
          const y = size / 2 + p.pos.z * mapData.scale * 0.45 - p.pos.y * mapData.scale * 0.2;
          return (
            <g key={`planet-${p.id}`}>
              <circle cx={x} cy={y} r={p.id === currentPlanetId ? 4.5 : 2.8} fill={p.color} opacity={0.95} />
              {p.id === currentPlanetId && (
                <circle cx={x} cy={y} r={9} fill="none" stroke={p.color} strokeWidth="1" className="animate-ping" />
              )}
            </g>
          );
        })}

        <circle cx={size / 2 + shipPosition.x * mapData.scale} cy={size / 2 + shipPosition.z * mapData.scale * 0.45 - shipPosition.y * mapData.scale * 0.2} r={3.5} fill="#ef4444" />
      </svg>
      
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-px bg-white/5" />
        <div className="h-full w-px bg-white/5" />
      </div>

      <div className="absolute bottom-2 left-0 w-full text-center">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">3D Nav</span>
      </div>
    </div>
  );
};
