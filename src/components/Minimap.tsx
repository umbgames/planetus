import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useShipStore } from '../services/shipStore';
import {
  SolarSystemData,
  PlanetData,
  buildOrbitMap,
  getPlanetWorldPosition,
} from '../services/solarSystem';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  range?: number;
}

type PointItem = {
  id: string;
  color: string;
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  isCurrent: boolean;
};

export const Minimap: React.FC<MinimapProps> = ({
  solarSystem,
  currentPlanetId,
  range = 1400,
}) => {
  const navShipPosition = useShipStore((s) => s.navShipPosition);
  const navShipYaw = useShipStore((s) => s.navShipYaw);
  const navCameraPitch = useShipStore((s) => s.navCameraPitch);
  const navTime = useShipStore((s) => s.navTime);
  const navVisible = useShipStore((s) => s.navVisible);

  const size = 170;
  const half = size / 2;
  const renderRadius = size * 0.44;

  const mapData = useMemo(() => {
    if (!solarSystem || !navVisible) return null;

    const orbitMap = buildOrbitMap(solarSystem.bodies);
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
    if (!planets.length) return null;

    const cosYaw = Math.cos(-navShipYaw);
    const sinYaw = Math.sin(-navShipYaw);

    const clampedPitch = THREE.MathUtils.clamp(navCameraPitch, -0.95, 0.95);
    const pitchFlatten = THREE.MathUtils.lerp(0.82, 0.18, Math.abs(clampedPitch));
    const pitchLift = Math.sin(clampedPitch) * 0.38;

    const points: PointItem[] = [];

    for (const planet of planets) {
      const pos = getPlanetWorldPosition(planet, navTime, orbitMap);

      const lx = pos.x - navShipPosition.x;
      const ly = pos.y - navShipPosition.y;
      const lz = pos.z - navShipPosition.z;

      const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
      const isCurrent = planet.id === currentPlanetId;

      if (dist > range && !isCurrent) continue;

      const rx = lx * cosYaw - lz * sinYaw;
      const rz = lx * sinYaw + lz * cosYaw;
      const ry = ly;

      const px = rx;
      const py = rz * pitchFlatten - ry * (0.18 + Math.abs(pitchLift));

      const radialScale = renderRadius / Math.max(range, 1);
      const sx = px * radialScale;
      const sy = py * radialScale;

      const screenR = Math.sqrt(sx * sx + sy * sy);
      if (screenR > renderRadius && !isCurrent) continue;

      let color = '#cfd4da';
      switch (planet.visualClass) {
        case 'lush':
          color = '#9fbf9f';
          break;
        case 'oceanic':
          color = '#8ea8c9';
          break;
        case 'desert':
          color = '#c7aa72';
          break;
        case 'arid_rocky':
          color = '#a88162';
          break;
        case 'barren_gray':
          color = '#9a9a9a';
          break;
        case 'icy':
          color = '#b7c6cf';
          break;
        case 'volcanic':
          color = '#b06060';
          break;
      }

      const normalized = Math.min(dist / range, 1);
      const depthFactor = THREE.MathUtils.clamp((rz / range + 1) * 0.5, 0.2, 1);

      const size = isCurrent
        ? THREE.MathUtils.lerp(2.4, 3.8, depthFactor)
        : THREE.MathUtils.lerp(1.2, 2.2, depthFactor);

      const opacity = isCurrent
        ? THREE.MathUtils.lerp(0.85, 1.0, 1 - normalized)
        : THREE.MathUtils.lerp(0.35, 0.85, 1 - normalized);

      points.push({
        id: planet.id,
        color,
        x: sx,
        y: sy,
        z: rz,
        size,
        opacity,
        isCurrent,
      });
    }

    points.sort((a, b) => a.z - b.z);

    const sweepAngle = (navTime * 1.2) % (Math.PI * 2);

    return { points, sweepAngle };
  }, [solarSystem, navVisible, navShipYaw, navCameraPitch, navShipPosition, navTime, currentPlanetId, range]);

  if (!navVisible || !mapData) return null;

  const sweepLen = renderRadius;
  const sweepX = half + Math.cos(mapData.sweepAngle - Math.PI / 2) * sweepLen;
  const sweepY = half + Math.sin(mapData.sweepAngle - Math.PI / 2) * sweepLen * 0.92;

  return (
    <div
      className="absolute bottom-5 right-5 pointer-events-none select-none"
      style={{ width: size, height: size, background: 'transparent' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <ellipse
          cx={half}
          cy={half}
          rx={renderRadius}
          ry={renderRadius * 0.52}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
        />

        <line
          x1={half - 8}
          y1={half}
          x2={half + 8}
          y2={half}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
        />
        <line
          x1={half}
          y1={half - 8}
          x2={half}
          y2={half + 8}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
        />

        <line
          x1={half}
          y1={half}
          x2={sweepX}
          y2={sweepY}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        <circle cx={sweepX} cy={sweepY} r={1.2} fill="rgba(255,255,255,0.32)" />

        {mapData.points.map((p) => {
          const x = half + p.x;
          const y = half + p.y;

          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r={p.size} fill={p.color} opacity={p.opacity} />
              {p.isCurrent && (
                <circle
                  cx={x}
                  cy={y}
                  r={p.size + 4}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="0.75"
                  opacity="0.75"
                />
              )}
            </g>
          );
        })}

        <g>
          <circle cx={half} cy={half} r={2.7} fill="#ff3b30" />
          <path
            d={`
              M ${half} ${half - 9}
              L ${half - 4.2} ${half + 4.8}
              L ${half} ${half + 1.5}
              L ${half + 4.2} ${half + 4.8}
              Z
            `}
            fill="#ff3b30"
            opacity="0.95"
          />
        </g>

        <line
          x1={half}
          y1={half - 16}
          x2={half}
          y2={half - 28}
          stroke="rgba(255,255,255,0.38)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
