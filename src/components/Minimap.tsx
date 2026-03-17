import React, { useMemo } from 'react';
import { SolarSystemData, PlanetData, buildOrbitMap, getPlanetWorldPosition } from '../services/solarSystem';
import * as THREE from 'three';

interface MinimapProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  shipPosition: THREE.Vector3;
  shipYaw?: number;      // radians
  visible?: boolean;     // false in solar system view
}

type PointItem = {
  id: string;
  color: string;
  x: number;
  y: number;
  z: number;
  depth: number;
  size: number;
  opacity: number;
  isCurrent: boolean;
};

export const Minimap: React.FC<MinimapProps> = ({
  solarSystem,
  currentPlanetId,
  shipPosition,
  shipYaw = 0,
  visible = true,
}) => {
  const size = 170;
  const half = size / 2;
  const maxRenderRadius = size * 0.42;

  const mapData = useMemo(() => {
    if (!solarSystem || !visible) return null;

    const orbitMap = buildOrbitMap(solarSystem.bodies);
    const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');

    if (!planets.length) return null;

    const elapsed = performance.now() / 1000;

    // include ship offset so map remains centered around player-local area
    const worldPoints = planets.map((planet) => {
      const pos = getPlanetWorldPosition(planet, elapsed, orbitMap);

      let color = '#d1d5db';
      switch (planet.visualClass) {
        case 'lush':
          color = '#34d399';
          break;
        case 'oceanic':
          color = '#60a5fa';
          break;
        case 'desert':
          color = '#fbbf24';
          break;
        case 'arid_rocky':
          color = '#f97316';
          break;
        case 'barren_gray':
          color = '#9ca3af';
          break;
        case 'icy':
          color = '#7dd3fc';
          break;
        case 'volcanic':
          color = '#ef4444';
          break;
      }

      // localize around ship
      const local = new THREE.Vector3(
        pos.x - shipPosition.x,
        pos.y - shipPosition.y,
        pos.z - shipPosition.z
      );

      return {
        id: planet.id,
        color,
        local,
        isCurrent: planet.id === currentPlanetId,
      };
    });

    // rotate map by ship yaw so display follows ship/camera heading
    const cos = Math.cos(-shipYaw);
    const sin = Math.sin(-shipYaw);

    const rotated = worldPoints.map((p) => {
      const rx = p.local.x * cos - p.local.z * sin;
      const rz = p.local.x * sin + p.local.z * cos;
      const ry = p.local.y;

      return {
        ...p,
        rotated: new THREE.Vector3(rx, ry, rz),
      };
    });

    const maxDistance = Math.max(
      ...rotated.map((p) => Math.sqrt(p.rotated.x ** 2 + p.rotated.y ** 2 + p.rotated.z ** 2)),
      1
    );

    // aggressive compression so objects become tiny nav points
    const scale = maxRenderRadius / maxDistance;

    const points: PointItem[] = rotated.map((p) => {
      const px = p.rotated.x * scale;
      const py = p.rotated.z * scale * 0.72 - p.rotated.y * scale * 0.25;
      const pz = p.rotated.z;

      // normalized depth from -1 to 1
      const depthNorm = THREE.MathUtils.clamp(pz / maxDistance, -1, 1);

      // farther back = smaller/dimmer
      const depthFactor = (depthNorm + 1) * 0.5;
      const size = p.isCurrent
        ? THREE.MathUtils.lerp(2.4, 4.2, depthFactor)
        : THREE.MathUtils.lerp(1.2, 2.6, depthFactor);

      const opacity = p.isCurrent
        ? THREE.MathUtils.lerp(0.65, 1.0, depthFactor)
        : THREE.MathUtils.lerp(0.35, 0.9, depthFactor);

      return {
        id: p.id,
        color: p.color,
        x: px,
        y: py,
        z: pz,
        depth: depthNorm,
        size,
        opacity,
        isCurrent: p.isCurrent,
      };
    });

    // draw back-to-front for better faux-3D layering
    points.sort((a, b) => a.z - b.z);

    return { points };
  }, [
    solarSystem,
    currentPlanetId,
    shipPosition.x,
    shipPosition.y,
    shipPosition.z,
    shipYaw,
    visible,
  ]);

  if (!visible || !mapData) return null;

  const shipX = half;
  const shipY = half;

  return (
    <div
      className="absolute bottom-5 right-5 pointer-events-none select-none"
      style={{
        width: size,
        height: size,
        background: 'transparent',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          overflow: 'visible',
          filter: 'drop-shadow(0 0 10px rgba(120,200,255,0.08))',
        }}
      >
        <defs>
          <radialGradient id="shipGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="45%" stopColor="#7dd3fc" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="scanGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* subtle center scan haze */}
        <circle cx={shipX} cy={shipY} r={28} fill="url(#scanGlow)" />

        {/* faint depth guide only, no border */}
        <ellipse
          cx={half}
          cy={half + 2}
          rx={size * 0.28}
          ry={size * 0.11}
          fill="none"
          stroke="rgba(125,211,252,0.08)"
          strokeWidth="0.8"
        />

        {/* planet/object points */}
        {mapData.points.map((p) => {
          const x = half + p.x;
          const y = half + p.y;
          const glowR = p.size * 2.4;
          const coreR = p.size;

          return (
            <g key={p.id}>
              <circle
                cx={x}
                cy={y}
                r={glowR}
                fill={p.color}
                opacity={p.opacity * 0.12}
              />
              <circle
                cx={x}
                cy={y}
                r={coreR}
                fill={p.color}
                opacity={p.opacity}
              />
              {p.isCurrent && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={coreR + 4}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="0.9"
                    opacity="0.8"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={coreR + 8}
                    fill="none"
                    stroke={p.color}
                    strokeWidth="0.7"
                    opacity="0.28"
                  />
                </>
              )}
            </g>
          );
        })}

        {/* player/ship marker */}
        <g>
          <circle cx={shipX} cy={shipY} r={10} fill="url(#shipGlow)" opacity="0.9" />
          <circle cx={shipX} cy={shipY} r={2.4} fill="#ffffff" />
          <path
            d={`
              M ${shipX} ${shipY - 8}
              L ${shipX - 4.5} ${shipY + 5}
              L ${shipX} ${shipY + 2}
              L ${shipX + 4.5} ${shipY + 5}
              Z
            `}
            fill="#7dd3fc"
            opacity="0.95"
          />
        </g>

        {/* heading indicator */}
        <line
          x1={shipX}
          y1={shipY - 18}
          x2={shipX}
          y2={shipY - 34}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <circle
          cx={shipX}
          cy={shipY - 36}
          r={1.7}
          fill="#ffffff"
          opacity="0.85"
        />
      </svg>

      {/* tiny holographic label */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-mono uppercase tracking-[0.35em] text-cyan-200/30">
        nav
      </div>
    </div>
  );
};
