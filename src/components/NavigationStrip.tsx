import React, { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { buildOrbitMap, getBodyWorldPosition, getMoonWorldPosition } from '../services/orbitUtils';

interface NavigationStripProps {
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
  active: boolean;
}

interface NavMarker {
  id: string;
  xPercent: number;
  size: number;
  active: boolean;
}

export function NavigationStrip({ solarSystem, currentPlanetId, active }: NavigationStripProps) {
  const { camera, clock } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const offset = useMemo(() => new THREE.Vector3(0, 2, -8), []);

  const orbitMap = useMemo(
    () => (solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>()),
    [solarSystem]
  );

  const [markers, setMarkers] = useState<NavMarker[]>([]);

  const scratchForward = useMemo(() => new THREE.Vector3(), []);
  const scratchTarget = useMemo(() => new THREE.Vector3(), []);
  const scratchRelative = useMemo(() => new THREE.Vector3(), []);
  const scratchCurrent = useMemo(() => new THREE.Vector3(), []);
  const scratchPlanar = useMemo(() => new THREE.Vector3(), []);

  const frameCounter = useRef(0);

  useFrame(() => {
    frameCounter.current += 1;

    // 🔹 CAMERA FOLLOW (runs every frame)
    if (groupRef.current) {
      const worldOffset = offset.clone().applyQuaternion(camera.quaternion);

      const targetPosition = camera.position.clone().add(worldOffset);

      // smooth follow (optional but nicer)
      groupRef.current.position.lerp(targetPosition, 0.15);

      groupRef.current.quaternion.copy(camera.quaternion);
    }

    // 🔹 Marker updates (throttled)
    if (frameCounter.current % 5 !== 0) return;

    if (!active || !solarSystem) {
      setMarkers([]);
      return;
    }

    const elapsed = clock.getElapsedTime();

    const planets = solarSystem.bodies.filter(
      (body): body is PlanetData => body.type === 'planet'
    );

    const activeOrbit = currentPlanetId
      ? orbitMap.get(currentPlanetId) ?? 0
      : 0;

    const orbitDistances = planets
      .map((planet) => orbitMap.get(planet.id) ?? planet.orbitDistance)
      .sort((a, b) => a - b);

    const nearestGap = currentPlanetId
      ? orbitDistances.reduce((best, orbitDistance) => {
          const gap = Math.abs(orbitDistance - activeOrbit);
          return gap > 0.01 && gap < best ? gap : best;
        }, Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;

    const visibilityBand = Number.isFinite(nearestGap)
      ? Math.max(180, nearestGap + 120)
      : 420;

    const currentOrigin = currentPlanetId
      ? getBodyWorldPosition(
          currentPlanetId,
          solarSystem,
          elapsed,
          orbitMap,
          scratchCurrent
        )
      : scratchCurrent.set(0, 0, 0);

    camera.getWorldDirection(scratchForward);
    scratchForward.y = 0;

    if (scratchForward.lengthSq() < 0.0001) {
      scratchForward.set(0, 0, -1);
    }

    scratchForward.normalize();

    const nextMarkers: NavMarker[] = [];
    const maxAngle = Math.PI * 0.46;

    for (const planet of planets) {
      const scaledOrbit =
        orbitMap.get(planet.id) ?? planet.orbitDistance;

      if (
        currentPlanetId &&
        planet.id !== currentPlanetId &&
        Math.abs(scaledOrbit - activeOrbit) > visibilityBand
      ) {
        continue;
      }

      const planetWorld = getBodyWorldPosition(
        planet.id,
        solarSystem,
        elapsed,
        orbitMap,
        scratchTarget
      );

      scratchRelative
        .copy(planetWorld)
        .sub(currentOrigin)
        .sub(camera.position);

      scratchPlanar.set(scratchRelative.x, 0, scratchRelative.z);

      if (scratchPlanar.lengthSq() < 1) continue;

      scratchPlanar.normalize();

      const angle = Math.atan2(
        scratchForward.x * scratchPlanar.z -
          scratchForward.z * scratchPlanar.x,
        scratchForward.dot(scratchPlanar)
      );

      if (Math.abs(angle) <= maxAngle) {
        nextMarkers.push({
          id: planet.id,
          xPercent: 50 + (angle / maxAngle) * 44,
          size: planet.id === currentPlanetId ? 11 : 8,
          active: Math.abs(angle) < 0.045,
        });
      }

      for (const moon of planet.moons) {
        const moonWorld = getMoonWorldPosition(
          planet,
          moon,
          elapsed,
          orbitMap,
          scratchTarget
        );

        scratchRelative
          .copy(moonWorld)
          .sub(currentOrigin)
          .sub(camera.position);

        scratchPlanar.set(scratchRelative.x, 0, scratchRelative.z);

        if (scratchPlanar.lengthSq() < 1) continue;

        scratchPlanar.normalize();

        const moonAngle = Math.atan2(
          scratchForward.x * scratchPlanar.z -
            scratchForward.z * scratchPlanar.x,
          scratchForward.dot(scratchPlanar)
        );

        if (Math.abs(moonAngle) <= maxAngle) {
          nextMarkers.push({
            id: moon.id,
            xPercent: 50 + (moonAngle / maxAngle) * 44,
            size: 5,
            active: Math.abs(moonAngle) < 0.035,
          });
        }
      }
    }

    nextMarkers.sort(
      (a, b) => Math.abs(a.xPercent - 50) - Math.abs(b.xPercent - 50)
    );

    setMarkers(nextMarkers.slice(0, 14));
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div className="w-[320px]">
          <div className="relative h-10">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-cyan-400/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.18)]" />

            {markers.map((marker) => (
              <div
                key={marker.id}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  marker.active
                    ? 'bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.55)]'
                    : 'bg-white/80'
                }`}
                style={{
                  left: `${marker.xPercent}%`,
                  width: `${marker.size}px`,
                  height: `${marker.size}px`,
                }}
              />
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}
