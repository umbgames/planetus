import React, { useMemo } from 'react';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
}

export const Minimap: React.FC<MinimapProps> = ({ solarSystem, currentPlanetId, shipPosition }) => {
  const size = 200;
  const padding = 20;
  const innerSize = size - padding * 2;

  const mapData = useMemo(() => {
    if (!solarSystem) return null;

    // Find max distance for scaling
    const maxDist = Math.max(...solarSystem.bodies.map(b => b.orbitDistance), 1);
    const scale = innerSize / (maxDist * 2.2);

    return {
      scale,
      planets: solarSystem.bodies.map(b => {
        let color = "#ffffff";
        if (b.type === 'planet') {
          switch (b.visualClass) {
            case 'lush': color = "#10b981"; break;
            case 'oceanic': color = "#3b82f6"; break;
            case 'desert': color = "#fbbf24"; break;
            case 'arid_rocky': color = "#d97706"; break;
            case 'barren_gray': color = "#9ca3af"; break;
            case 'icy': color = "#60a5fa"; break;
            case 'volcanic': color = "#ef4444"; break;
          }
        } else {
          color = "#4b5563"; // Asteroid belt
        }

        return {
          id: b.id,
          name: b.type === 'planet' ? `Planet ${b.id.split('_')[1]}` : 'Asteroid Belt',
          color,
          orbitDistance: b.orbitDistance,
          type: b.type
        };
      })
    };
  }, [solarSystem, innerSize]);

  if (!mapData) return null;

  return (
    <div 
      className="absolute bottom-6 right-6 bg-black/60 backdrop-blur border border-white/20 rounded-full overflow-hidden shadow-2xl"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Orbits */}
        {mapData.planets.map(p => (
          p.type === 'planet' && (
            <circle 
              key={`orbit-${p.id}`}
              cx={size / 2}
              cy={size / 2}
              r={p.orbitDistance * mapData.scale}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          )
        ))}

        {/* Sun */}
        <circle 
          cx={size / 2}
          cy={size / 2}
          r={4}
          fill="#fbbf24"
          className="animate-pulse"
        />

        {/* Planets */}
        {mapData.planets.map(p => {
          // For simplicity, we'll just place them at an angle based on their ID hash
          const hash = p.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const angle = (hash % 360) * (Math.PI / 180);
          const x = size / 2 + Math.cos(angle) * p.orbitDistance * mapData.scale;
          const y = size / 2 + Math.sin(angle) * p.orbitDistance * mapData.scale;

          return (
            <g key={`planet-${p.id}`}>
              <circle 
                cx={x}
                cy={y}
                r={p.id === currentPlanetId ? 4 : 2}
                fill={p.color}
                className={p.id === currentPlanetId ? "stroke-white stroke-2" : ""}
              />
              {p.id === currentPlanetId && (
                <circle 
                  cx={x}
                  cy={y}
                  r={8}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="1"
                  className="animate-ping"
                />
              )}
            </g>
          );
        })}

        {/* Player Indicator (if in ship mode) */}
        {/* This would need more accurate positioning relative to the sun/planets */}
        <path 
          d="M 0,-4 L 3,4 L 0,2 L -3,4 Z"
          fill="#3b82f6"
          transform={`translate(${size / 2}, ${size / 2}) rotate(0)`}
          className="drop-shadow-glow"
        />
      </svg>
      
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-px bg-white/5" />
        <div className="h-full w-px bg-white/5" />
      </div>

      <div className="absolute bottom-2 left-0 w-full text-center">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Navigation System</span>
      </div>
    </div>
  );
};
