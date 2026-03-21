import React, { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SolarSystemData, PlanetData } from '../services/solarSystem';
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
  priority: number;
}

const EDGE_MIN = 6;
const EDGE_MAX = 94;
const INNER_SPAN = 44;
const MAX_MARKERS = 14;

function clampToStrip(angle: number, maxAngle: number) {
  const raw = 50 + (angle / maxAngle) * INNER_SPAN;
  return Math.max(EDGE_MIN, Math.min(EDGE_MAX, raw));
}

export function NavigationStrip({ solarSystem, currentPlanetId, active }: NavigationStripProps) {
  const { camera, clock } = useThree();
  const orbitMap = useMemo(
    () => (solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>()),
    [solarSystem]
  );

  const [markers, setMarkers] = useState<NavMarker[]>([]);
  const previousPositions = useRef<Map<string, number>>(new Map());
  const frameCounter = useRef(0);

  const scratchForward = useMemo(() => new THREE.Vector3(), []);
  const scratchTarget = useMemo(() => new THREE.Vector3(), []);
  const scratchRelative = useMemo(() => new THREE.Vector3(), []);
  const scratchCurrent = useMemo(() => new THREE.Vector3(), []);
  const scratchPlanar = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    frameCounter.current += 1;
    if (frameCounter.current % 5 !== 0) return;

    if (!active || !solarSystem) {
      previousPositions.current.clear();
      setMarkers([]);
      return;
    }

    const elapsed = clock.getElapsedTime();
    const planets = solarSystem.bodies.filter(
      (body): body is PlanetData => body.type === 'planet'
    );

    const activeOrbit = currentPlanetId ? orbitMap.get(currentPlanetId) ?? 0 : 0;
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
      ? getBodyWorldPosition(currentPlanetId, solarSystem, elapsed, orbitMap, scratchCurrent)
      : scratchCurrent.set(0, 0, 0);

    camera.getWorldDirection(scratchForward);
    scratchForward.y = 0;
    if (scratchForward.lengthSq() < 0.0001) scratchForward.set(0, 0, -1);
    scratchForward.normalize();

    const nextMarkers: NavMarker[] = [];
    const maxAngle = Math.PI * 0.46;

    const getSmoothedX = (id: string, nextX: number) => {
      const prev = previousPositions.current.get(id);
      const smoothed = prev == null ? nextX : prev + (nextX - prev) * 0.35;
      previousPositions.current.set(id, smoothed);
      return smoothed;
    };

    for (const planet of planets) {
      const scaledOrbit = orbitMap.get(planet.id) ?? planet.orbitDistance;

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

      scratchRelative.copy(planetWorld).sub(currentOrigin).sub(camera.position);
      scratchPlanar.set(scratchRelative.x, 0, scratchRelative.z);

      if (scratchPlanar.lengthSq() < 1) continue;

      scratchPlanar.normalize();

      const angle = Math.atan2(
        scratchForward.x * scratchPlanar.z - scratchForward.z * scratchPlanar.x,
        scratchForward.dot(scratchPlanar)
      );

      const xPercent = getSmoothedX(planet.id, clampToStrip(angle, maxAngle));
      const isCurrentTarget = planet.id === currentPlanetId;

      nextMarkers.push({
        id: planet.id,
        xPercent,
        size: isCurrentTarget ? 11 : 8,
        active: Math.abs(angle) < 0.045,
        priority: isCurrentTarget ? 1000 : 100 - Math.abs(angle),
      });

      for (const moon of planet.moons) {
        const moonWorld = getMoonWorldPosition(planet, moon, elapsed, orbitMap, scratchTarget);

        scratchRelative.copy(moonWorld).sub(currentOrigin).sub(camera.position);
        scratchPlanar.set(scratchRelative.x, 0, scratchRelative.z);

        if (scratchPlanar.lengthSq() < 1) continue;

        scratchPlanar.normalize();

        const moonAngle = Math.atan2(
          scratchForward.x * scratchPlanar.z - scratchForward.z * scratchPlanar.x,
          scratchForward.dot(scratchPlanar)
        );

        const moonXPercent = getSmoothedX(moon.id, clampToStrip(moonAngle, maxAngle));
        const isCurrentMoon = moon.id === currentPlanetId;

        nextMarkers.push({
          id: moon.id,
          xPercent: moonXPercent,
          size: isCurrentMoon ? 7 : 5,
          active: Math.abs(moonAngle) < 0.035,
          priority: isCurrentMoon ? 950 : 60 - Math.abs(moonAngle),
        });
      }
    }

    nextMarkers.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return Math.abs(a.xPercent - 50) - Math.abs(b.xPercent - 50);
    });

    const trimmed = nextMarkers.slice(0, MAX_MARKERS);

    const visibleIds = new Set(trimmed.map((marker) => marker.id));
    for (const id of Array.from(previousPositions.current.keys())) {
      if (!visibleIds.has(id)) previousPositions.current.delete(id);
    }

    setMarkers(trimmed);
  });

  if (!active) return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[55] w-[min(70vw,620px)]">
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
  );
}
