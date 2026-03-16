import * as THREE from 'three';
import { createPRNG, cyrb128 } from '../utils/random';

export type PlanetVisualClass = 'lush' | 'oceanic' | 'desert' | 'arid_rocky' | 'barren_gray' | 'icy' | 'volcanic';

export interface PlanetData {
  id: string;
  name: string;
  type: 'planet';
  radius: number;
  orbitDistance: number;
  orbitSpeed: number;
  orbitTiltX: number;
  orbitTiltZ: number;
  initialAngle: number;
  noiseScale: number;
  landThreshold: number;
  colorSeed: number;
  visualClass: PlanetVisualClass;
}

export interface AsteroidBeltData {
  id: string;
  name?: string;
  type: 'asteroid_belt';
  orbitDistance: number;
  orbitSpeed: number;
  width: number;
  count: number;
  initialAngle: number;
  seed: string;
}

export type OrbitalBody = PlanetData | AsteroidBeltData;

export interface SolarSystemData {
  seed: string;
  starRadius: number;
  bodies: OrbitalBody[];
}

function hashString(str: string): string {
  const h = cyrb128(str);
  return h[0].toString(16) + h[1].toString(16) + h[2].toString(16) + h[3].toString(16);
}

function generatePlanetName(prng: () => number): string {
  const starts = ['Ar', 'Bel', 'Cor', 'Dra', 'Ery', 'Fal', 'Gor', 'Hel', 'Ith', 'Jor', 'Kai', 'Lun', 'Mor', 'Nyx', 'Or', 'Py', 'Quo', 'Ryn', 'Sol', 'Tor', 'Ul', 'Vex', 'Wyr', 'Xan', 'Yor', 'Zel'];
  const mids = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'or', 'en', 'ul'];
  const ends = ['on', 'ar', 'is', 'os', 'um', 'ix', 'or', 'ea', 'eth', 'al', 'yr'];
  return `${starts[Math.floor(prng() * starts.length)]}${mids[Math.floor(prng() * mids.length)]}${ends[Math.floor(prng() * ends.length)]}`;
}

export const VISUAL_SCALE = {
  STAR_RADIUS_MULTIPLIER: 4.5,
  PLANET_RADIUS_MULTIPLIER: 0.9,
  ORBIT_DISTANCE_MULTIPLIER: 2.8,
  MIN_ORBIT_GAP: 18,
  ASTEROID_DISTANCE_MULTIPLIER: 2.8,
  ASTEROID_WIDTH_MULTIPLIER: 1.4,
};

export function buildScaledOrbitMap(bodies: SolarSystemData['bodies']) {
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
    const scaledGap = Math.max(originalGap * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER, VISUAL_SCALE.MIN_ORBIT_GAP);
    const nextOrbit = lastScaledOrbit + scaledGap;

    scaledOrbitMap.set(planet.id, nextOrbit);
    lastScaledOrbit = nextOrbit;
    lastOriginalOrbit = planet.orbitDistance;
  });

  return scaledOrbitMap;
}

export function getScaledPlanetRadius(radius: number) {
  return radius * VISUAL_SCALE.PLANET_RADIUS_MULTIPLIER;
}

export function getBodyWorldPosition(body: PlanetData, elapsedTime: number, scaledOrbitMap?: Map<string, number>) {
  const orbitDistance = scaledOrbitMap?.get(body.id) ?? (body.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER);
  const angle = body.initialAngle + elapsedTime * body.orbitSpeed;
  const x = Math.cos(angle) * orbitDistance;
  const z = Math.sin(angle) * orbitDistance;
  const y = x * Math.sin(body.orbitTiltZ) + z * Math.sin(body.orbitTiltX);
  return new THREE.Vector3(x, y, z);
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const prng = createPRNG(worldSeed);
  const numBodies = Math.floor(prng() * 9) + 4;
  const bodies: OrbitalBody[] = [];
  const baseOrbitDistance = 100;
  const usedNames = new Set<string>();

  for (let i = 0; i < numBodies; i++) {
    const bodySeed = hashString(`${worldSeed}_${i}`);
    const bodyPrng = createPRNG(bodySeed);
    const isAsteroidBelt = i > 0 && bodyPrng() < 0.2;
    const orbitDistance = baseOrbitDistance * Math.pow(1.8, i);
    const initialAngle = bodyPrng() * Math.PI * 2;

    if (isAsteroidBelt) {
      bodies.push({
        id: `belt_${i}`,
        name: `Belt${i + 1}`,
        type: 'asteroid_belt',
        orbitDistance,
        orbitSpeed: (bodyPrng() * 0.02 + 0.01) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * 0.1,
        count: Math.floor(bodyPrng() * 200) + 100,
        initialAngle,
        seed: bodySeed,
      });
      continue;
    }

    let visualClass: PlanetVisualClass;
    const distRatio = i / numBodies;
    if (distRatio < 0.2) {
      visualClass = bodyPrng() < 0.5 ? 'volcanic' : 'desert';
    } else if (distRatio < 0.4) {
      visualClass = bodyPrng() < 0.6 ? 'arid_rocky' : 'desert';
    } else if (distRatio < 0.7) {
      visualClass = bodyPrng() < 0.5 ? 'lush' : 'oceanic';
    } else if (distRatio < 0.85) {
      visualClass = bodyPrng() < 0.7 ? 'barren_gray' : 'icy';
    } else {
      visualClass = 'icy';
    }

    let name = generatePlanetName(bodyPrng);
    while (usedNames.has(name)) {
      name = generatePlanetName(bodyPrng);
    }
    usedNames.add(name);

    bodies.push({
      id: `planet_${i}`,
      name,
      type: 'planet',
      radius: bodyPrng() * 6 + 4,
      orbitDistance,
      orbitSpeed: (bodyPrng() * 0.05 + 0.01) * (bodyPrng() > 0.5 ? 1 : -1),
      orbitTiltX: (bodyPrng() - 0.5) * 0.5,
      orbitTiltZ: (bodyPrng() - 0.5) * 0.5,
      initialAngle,
      noiseScale: bodyPrng() * 2 + 0.5,
      landThreshold: bodyPrng() * 0.4 + 0.1,
      colorSeed: bodyPrng(),
      visualClass,
    });
  }

  return {
    seed: worldSeed,
    starRadius: 8,
    bodies,
  };
}
