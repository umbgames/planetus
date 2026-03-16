import React, { useMemo } from 'react';
import { SolarSystemData, PlanetData, buildScaledOrbitMap, getBodyWorldPosition } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition }) => {
  const size = 220;
  const center = size / 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;

    const orbitMap = buildScaledOrbitMap(solarSystem.bodies);
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const maxDist = Math.max(...planets.map((p) => orbitMap.get(p.id) || 0), 1);
    const scale = 82 / maxDist;
    const elapsedTime = Date.now() / 1000;

    const items = planets.map((planet) => {
      const world = getBodyWorldPosition(planet, elapsedTime, orbitMap);
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
      return { planet, world, color };
    });

    const currentPlanet = currentPlanetId ? items.find((item) => item.planet.id === currentPlanetId) : null;
    const playerWorld = currentPlanet ? currentPlanet.world.clone().add(shipPosition) : shipPosition.clone();

    return { items, scale, playerWorld };
  }, [solarSystem, currentPlanetId, shipPosition]);

  if (!mapData) return null;

  const project = (v: THREE.Vector3) => ({
    x: center + v.x * mapData.scale,
    y: center + v.z * mapData.scale - v.y * mapData.scale * 0.35,
  });

  const playerPoint = project(mapData.playerWorld);

  return (
    <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur border border-cyan-400/20 rounded-3xl overflow-hidden shadow-2xl" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {mapData.items.map(({ planet }) => {
          const radius = (buildScaledOrbitMap(solarSystem!.bodies).get(planet.id) || 0) * mapData.scale;
          return <ellipse key={`orbit-${planet.id}`} cx={center} cy={center} rx={radius} ry={Math.max(radius * 0.72, 2)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}

        <circle cx={center} cy={center} r={18} fill="url(#sunGlow)" />
        <circle cx={center} cy={center} r={4.5} fill="#fbbf24" />

        {mapData.items.map(({ planet, world, color }) => {
          const p = project(world);
          const selected = planet.id === currentPlanetId;
          return (
            <g key={planet.id}>
              <circle cx={p.x} cy={p.y} r={selected ? 4.2 : 2.8} fill={color} stroke={selected ? '#ffffff' : 'none'} strokeWidth={selected ? 1.2 : 0} />
              {selected && <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={color} strokeWidth="1" opacity="0.65" />}
            </g>
          );
        })}

        <circle cx={playerPoint.x} cy={playerPoint.y} r={3.4} fill="#ef4444" />
        <circle cx={playerPoint.x} cy={playerPoint.y} r={7.5} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.45" />
      </svg>

      <div className="absolute top-3 left-4 text-[10px] font-mono tracking-[0.25em] text-cyan-300/80 uppercase">3D Nav Map</div>
      <div className="absolute bottom-3 left-4 text-[10px] text-white/50">Player: <span className="text-red-400">●</span></div>
    </div>
  );
};
