import * as THREE from 'three';
import { SolarSystemData, PlanetData, AsteroidBeltData, MoonData } from './solarSystem';

export const VISUAL_SCALE = {
  STAR_RADIUS_MULTIPLIER: 4.5,
  PLANET_RADIUS_MULTIPLIER: 1.24,
  ORBIT_DISTANCE_MULTIPLIER: 2.8,
  MIN_ORBIT_GAP: 18,
  ASTEROID_DISTANCE_MULTIPLIER: 2.8,
  ASTEROID_WIDTH_MULTIPLIER: 1.4,
  PLANET_LOD_DISTANCE_MULTIPLIER: 1.8,
  SHIP_SWITCH_RADIUS_MULTIPLIER: 10,
  SUN_SWITCH_RADIUS_MULTIPLIER: 5,
} as const;

export function getScaledPlanetRadius(radius: number) {
  return radius * VISUAL_SCALE.PLANET_RADIUS_MULTIPLIER;
}

export function getScaledStarRadius(radius: number) {
  return Math.max(radius * VISUAL_SCALE.STAR_RADIUS_MULTIPLIER, 12);
}

export function buildOrbitMap(bodies: SolarSystemData['bodies']) {
  const planets = bodies
    .filter((b): b is PlanetData => b.type === 'planet')
    .slice()
    .sort((a, b) => a.orbitDistance - b.orbitDistance);

  const scaledOrbitMap = new Map<string, number>();
  let lastScaledOrbit = 0;
  let lastOriginalOrbit = 0;

  planets.forEach((planet, index) => {
    const baseScaled = planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;

    if (index === 0) {
      scaledOrbitMap.set(planet.id, baseScaled);
      lastScaledOrbit = baseScaled;
      lastOriginalOrbit = planet.orbitDistance;
      return;
    }

    const originalGap = planet.orbitDistance - lastOriginalOrbit;
    const scaledGap = Math.max(
      originalGap * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER,
      VISUAL_SCALE.MIN_ORBIT_GAP
    );

    const nextOrbit = lastScaledOrbit + scaledGap;
    scaledOrbitMap.set(planet.id, nextOrbit);

    lastScaledOrbit = nextOrbit;
    lastOriginalOrbit = planet.orbitDistance;
  });

  return scaledOrbitMap;
}

export function getScaledOrbitDistance(id: string | null, solarSystem: SolarSystemData | null, orbitMap?: Map<string, number>) {
  if (!id || !solarSystem) return 0;
  const planet = solarSystem.bodies.find((b): b is PlanetData => b.type === 'planet' && b.id === id);
  if (!planet) return 0;
  return orbitMap?.get(planet.id) ?? planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
}

export function getPlanetWorldPosition(
  planet: PlanetData,
  elapsedTime: number,
  orbitMap?: Map<string, number>,
  target = new THREE.Vector3(),
) {
  const orbitDistance = orbitMap?.get(planet.id) ?? planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
  const angle = planet.initialAngle + elapsedTime * planet.orbitSpeed;
  const x = Math.cos(angle) * orbitDistance;
  const z = Math.sin(angle) * orbitDistance;
  const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
  return target.set(x, y, z);
}

export function getBodyWorldPosition(
  id: string | null,
  solarSystem: SolarSystemData | null,
  elapsedTime: number,
  orbitMap?: Map<string, number>,
  target = new THREE.Vector3(),
) {
  if (!id || !solarSystem) return target.set(0, 0, 0);
  const planet = solarSystem.bodies.find((b): b is PlanetData => b.type === 'planet' && b.id === id);
  if (!planet) return target.set(0, 0, 0);
  return getPlanetWorldPosition(planet, elapsedTime, orbitMap, target);
}


export function getMoonWorldPosition(
  planet: PlanetData,
  moon: MoonData,
  elapsedTime: number,
  orbitMap?: Map<string, number>,
  target = new THREE.Vector3(),
) {
  const planetPos = getPlanetWorldPosition(planet, elapsedTime, orbitMap, new THREE.Vector3());
  const moonAngle = moon.initialAngle + elapsedTime * moon.orbitSpeed;
  const moonX = Math.cos(moonAngle) * moon.orbitDistance;
  const moonZ = Math.sin(moonAngle) * moon.orbitDistance;
  const moonY = moonX * Math.sin(moon.orbitTiltZ) + moonZ * Math.sin(moon.orbitTiltX);
  return target.copy(planetPos).add(new THREE.Vector3(moonX, moonY, moonZ));
}

export function getScaledAsteroidOrbitDistance(belt: AsteroidBeltData) {
  return belt.orbitDistance * VISUAL_SCALE.ASTEROID_DISTANCE_MULTIPLIER;
}

export function getScaledAsteroidWidth(belt: AsteroidBeltData) {
  return belt.width * VISUAL_SCALE.ASTEROID_WIDTH_MULTIPLIER;
}
