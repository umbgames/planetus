import * as THREE from 'three';
import { createPRNG, hashCombine, seededRange } from '../utils/random';

export type VisualClass = 'rocky' | 'dry_arid' | 'desert' | 'red';

export interface MoonData {
  id: string;
  seed: string;
  parentPlanetId: string;
  radius: number;
  orbitDistance: number;
  orbitSpeed: number;
  orbitTiltX: number;
  orbitTiltZ: number;
  initialAngle: number;
  noiseScale: number;
  landThreshold: number;
  paletteSeed: number;
  hasClouds: boolean;
  visualClass: 'rocky';
}

export interface RingData {
  innerRadius: number;
  outerRadius: number;
  color: string;
  opacity: number;
}

export interface PlanetData {
  id: string;
  seed: string;
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
  temperatureBias: number;
  humidityBias: number;
  paletteSeed: number;
  hasClouds: boolean;
  cloudDensity: number;
  cloudSpeed: number;
  cloudRotationSpeed: number;
  visualClass: VisualClass;
  moons: MoonData[];
  ring: RingData | null;
}

export interface AsteroidBeltData {
  id: string;
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
  starColor: string;
  bodies: OrbitalBody[];
}

const STAR_COLORS = ['#fff4de', '#ffe8b5', '#ffd6a5', '#cfe8ff', '#bcd5ff', '#ffd1dc'];
const RING_COLORS = ['#d8c3a5', '#c4b5a0', '#bfa88a', '#d9d1c7', '#c7c2b8'];

function createRingData(bodySeed: string, radius: number): RingData {
  return {
    innerRadius: radius * seededRange(hashCombine(bodySeed, 'ringInner'), 1.45, 1.72),
    outerRadius: radius * seededRange(hashCombine(bodySeed, 'ringOuter'), 1.95, 2.75),
    color: RING_COLORS[Math.floor(seededRange(hashCombine(bodySeed, 'ringColor'), 0, RING_COLORS.length - 0.001))],
    opacity: seededRange(hashCombine(bodySeed, 'ringOpacity'), 0.2, 0.38),
  };
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const prng = createPRNG(worldSeed);
  const numBodies = Math.floor(prng() * 8) + 6;
  const bodies: OrbitalBody[] = [];
  const starRadius = seededRange(hashCombine(worldSeed, 'starRadius'), 8, 16);
  const starColor = STAR_COLORS[Math.floor(prng() * STAR_COLORS.length) % STAR_COLORS.length];

  let orbitDistance = 90;

  for (let i = 0; i < numBodies; i++) {
    const bodySeed = hashCombine(worldSeed, 'body', i);
    const bodyPrng = createPRNG(bodySeed);
    const isAsteroidBelt = i > 1 && bodyPrng() < 0.16;
    orbitDistance += seededRange(hashCombine(bodySeed, 'orbitGap'), 55, 120);
    const initialAngle = bodyPrng() * Math.PI * 2;
    const radialRatio = i / Math.max(1, numBodies - 1);

    if (isAsteroidBelt) {
      bodies.push({
        id: `belt_${i}`,
        type: 'asteroid_belt',
        orbitDistance,
        orbitSpeed: seededRange(hashCombine(bodySeed, 'speed'), 0.006, 0.018) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * seededRange(hashCombine(bodySeed, 'width'), 0.08, 0.16),
        count: Math.floor(seededRange(hashCombine(bodySeed, 'count'), 180, 520)),
        initialAngle,
        seed: bodySeed,
      });
      continue;
    }

    const giantBias = Math.pow(radialRatio, 1.7);
    const baseRadius = seededRange(hashCombine(bodySeed, 'radius'), 6.5, 13.5);
    const giantRoll = seededRange(hashCombine(bodySeed, 'giantRoll'), 0, 1);
    const giantMultiplier = giantRoll > (0.72 - giantBias * 0.28)
      ? seededRange(hashCombine(bodySeed, 'giantMultiplier'), 1.5, 3.2 + giantBias * 2.2)
      : seededRange(hashCombine(bodySeed, 'standardMultiplier'), 0.95, 1.45 + giantBias * 0.45);
    const radius = baseRadius * giantMultiplier;
    const isRingCandidate = radius >= 18.5 && radialRatio > 0.25;
    const moonCountBase = radius > 16
      ? Math.floor(seededRange(hashCombine(bodySeed, 'moons'), 1, 3))
      : radius > 10
        ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsMid'), 0, 3))
        : bodyPrng() > 0.7
          ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsSmall'), 0, 2))
          : 0;
    const moonCount = Math.min(2, moonCountBase);

    const heat = THREE.MathUtils.clamp(1 - radialRatio + seededRange(hashCombine(bodySeed, 'heatBias'), -0.12, 0.12), 0, 1);
    const visualClass: VisualClass =
      heat > 0.72
        ? (bodyPrng() > 0.45 ? 'desert' : 'red')
        : heat > 0.5
          ? 'dry_arid'
          : bodyPrng() > 0.65
            ? 'red'
            : 'rocky';

    const moons: MoonData[] = Array.from({ length: moonCount }, (_, moonIndex) => {
      const moonSeed = hashCombine(bodySeed, 'moon', moonIndex);
      const moonPrng = createPRNG(moonSeed);
      return {
        id: `planet_${i}_moon_${moonIndex}`,
        seed: moonSeed,
        parentPlanetId: `planet_${i}`,
        radius: seededRange(hashCombine(moonSeed, 'radius'), Math.max(1.2, radius * 0.1), Math.max(2.8, radius * 0.26)),
        orbitDistance: radius * seededRange(hashCombine(moonSeed, 'orbit'), 3.8 + moonIndex * 1.1, 6.6 + moonIndex * 1.6),
        orbitSpeed: seededRange(hashCombine(moonSeed, 'speed'), 0.014, 0.065) * (moonPrng() > 0.5 ? 1 : -1),
        orbitTiltX: seededRange(hashCombine(moonSeed, 'tiltX'), -0.28, 0.28),
        orbitTiltZ: seededRange(hashCombine(moonSeed, 'tiltZ'), -0.28, 0.28),
        initialAngle: moonPrng() * Math.PI * 2,
        noiseScale: seededRange(hashCombine(moonSeed, 'noiseScale'), 0.9, 2.6),
        landThreshold: seededRange(hashCombine(moonSeed, 'landThreshold'), 0.03, 0.33),
        paletteSeed: seededRange(hashCombine(moonSeed, 'paletteSeed'), 0, 1),
        hasClouds: false,
        visualClass: 'rocky',
      };
    });

    bodies.push({
      id: `planet_${i}`,
      seed: bodySeed,
      type: 'planet',
      radius,
      orbitDistance,
      orbitSpeed: seededRange(hashCombine(bodySeed, 'orbitSpeed'), 0.004, 0.02) * (bodyPrng() > 0.5 ? 1 : -1),
      orbitTiltX: seededRange(hashCombine(bodySeed, 'tiltX'), -0.28, 0.28),
      orbitTiltZ: seededRange(hashCombine(bodySeed, 'tiltZ'), -0.28, 0.28),
      initialAngle,
      noiseScale: seededRange(hashCombine(bodySeed, 'noiseScale'), 0.55, 2.9),
      landThreshold: seededRange(hashCombine(bodySeed, 'landThreshold'), 0.02, 0.42),
      colorSeed: bodyPrng(),
      temperatureBias: seededRange(hashCombine(bodySeed, 'temperatureBias'), -0.25, 0.25),
      humidityBias: seededRange(hashCombine(bodySeed, 'humidityBias'), -0.25, 0.25),
      paletteSeed: seededRange(hashCombine(bodySeed, 'paletteSeed'), 0, 1),
      hasClouds: false,
      cloudDensity: 0,
      cloudSpeed: 0,
      cloudRotationSpeed: 0,
      visualClass,
      moons,
      ring: isRingCandidate ? createRingData(bodySeed, radius) : null,
    });
  }


  const planets = bodies.filter((body): body is PlanetData => body.type === 'planet');
  const ringCandidates = planets.filter((planet) => planet.ring && planet.radius >= 18.5);
  const chosenRingPlanet = (ringCandidates.length > 0
    ? ringCandidates.sort((a, b) => b.radius - a.radius)[0]
    : planets.sort((a, b) => b.radius - a.radius)[0]) ?? null;

  planets.forEach((planet) => {
    planet.ring = chosenRingPlanet && planet.id === chosenRingPlanet.id
      ? createRingData(planet.seed, planet.radius)
      : null;
  });

  return {
    seed: worldSeed,
    starRadius,
    starColor,
    bodies,
  };
}

