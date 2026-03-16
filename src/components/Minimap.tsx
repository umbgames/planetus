import React, { useMemo, useEffect, useState } from 'react';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
}

function getPlanetWorldPosition(planet: PlanetData, elapsedSeconds: number) {
  const angle = planet.initialAngle + elapsedSeconds * planet.orbitSpeed;
  const x = Math.cos(angle) * planet.orbitDistance;
  const z = Math.sin(angle) * planet.orbitDistance;
  const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
  return new THREE.Vector3(x, y, z);
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition }) => {
  const size = 220;
  const padding = 18;
  const innerSize = size - padding * 2;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startedAt = performance.now();
    const tick = () => {
      setElapsedSeconds((performance.now() - startedAt) / 1000);
      frameId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frameId);
  }, []);

  const mapData = useMemo(() => {
    if (!solarSystem) return null;

    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    const maxDist = Math.max(...planets.map((p) => p.orbitDistance), 1);
    const scale = innerSize / (maxDist * 2.4);

    const plottedPlanets = planets.map((planet) => {
      let color = '#ffffff';
      switch (planet.visualClass) {
        case 'lush': color = '#10b981'; break;
        case 'oceanic': color = '#3b82f6'; break;
        case 'desert': color = '#fbbf24'; break;
        case 'arid_rocky': color = '#d97706'; break;
        case 'barren_gray': color = '#9ca3af'; break;
        case 'icy': color = '#60a5fa'; break;
        case 'volcanic': color = '#ef4444'; break;
      }

      const worldPos = getPlanetWorldPosition(planet, elapsedSeconds);
      return {
        id: planet.id,
        color,
        x: size / 2 + worldPos.x * scale,
        y: size / 2 + worldPos.z * scale,
        radius: planet.id === currentPlanetId ? 4 : 2.5,
      };
    });

    const shipMarker = {
      x: size / 2 + shipPosition.x * scale,
      y: size / 2 + shipPosition.z * scale,
    };

    return { scale, planets: plottedPlanets, shipMarker };
  }, [solarSystem, innerSize, size, elapsedSeconds, currentPlanetId, shipPosition]);

  if (!mapData) return null;

  return (
    <div
      className="absolute bottom-6 right-6 bg-black/70 backdrop-blur border border-cyan-400/20 rounded-full overflow-hidden shadow-2xl"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {solarSystem?.bodies.filter((b): b is PlanetData => b.type === 'planet').map((planet) => (
          <circle
            key={`orbit-${planet.id}`}
            cx={size / 2}
            cy={size / 2}
            r={planet.orbitDistance * mapData.scale}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        <circle cx={size / 2} cy={size / 2} r={5} fill="#fbbf24" className="animate-pulse" />

        {mapData.planets.map((planet) => (
          <g key={`planet-${planet.id}`}>
            <circle
              cx={planet.x}
              cy={planet.y}
              r={planet.radius}
              fill={planet.color}
              stroke={planet.id === currentPlanetId ? '#ffffff' : 'transparent'}
              strokeWidth={planet.id === currentPlanetId ? 1.5 : 0}
            />
            {planet.id === currentPlanetId && (
              <circle
                cx={planet.x}
                cy={planet.y}
                r={9}
                fill="none"
                stroke={planet.color}
                strokeWidth="1"
                className="animate-ping"
              />
            )}
          </g>
        ))}

        <g transform={`translate(${mapData.shipMarker.x}, ${mapData.shipMarker.y})`}>
          <path d="M 0,-6 L 4,5 L 0,2 L -4,5 Z" fill="#22d3ee" />
          <circle cx="0" cy="0" r="10" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" />
        </g>
      </svg>

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-px bg-white/5" />
        <div className="h-full w-px bg-white/5" />
      </div>

      <div className="absolute bottom-2 left-0 w-full text-center">
        <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Navigation System</span>
      </div>
    </div>
  );
};
