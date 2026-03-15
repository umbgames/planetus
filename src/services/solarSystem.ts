import { createPRNG, hashCombine, seededRange } from '../utils/random';

export interface MoonData {
  id: string;
  seed: string;
  radius: number;
  orbitDistance: number;
  orbitSpeed: number;
  initialAngle: number;
  noiseScale: number;
  landThreshold: number;
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
        orbitSpeed: (seededRange(hashCombine(bodySeed, 'speed'), 0.006, 0.018)) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * seededRange(hashCombine(bodySeed, 'width'), 0.08, 0.16),
        count: Math.floor(seededRange(hashCombine(bodySeed, 'count'), 180, 520)),
        initialAngle,
        seed: bodySeed,
      });
      continue;
    }

    const giantBias = radialRatio * radialRatio;
    const radius = seededRange(hashCombine(bodySeed, 'radius'), 4, 9) + giantBias * seededRange(hashCombine(bodySeed, 'giantBonus'), 3, 18);
    const hasRing = radius > 12 && bodyPrng() > 0.45;
    const moonCount = radius > 13
      ? Math.floor(seededRange(hashCombine(bodySeed, 'moons'), 1, 5))
      : bodyPrng() > 0.62
        ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsSmall'), 0, 3))
        : 0;

    const moons: MoonData[] = Array.from({ length: moonCount }, (_, moonIndex) => {
      const moonSeed = hashCombine(bodySeed, 'moon', moonIndex);
      const moonPrng = createPRNG(moonSeed);
      return {
        id: `planet_${i}_moon_${moonIndex}`,
        seed: moonSeed,
        radius: seededRange(hashCombine(moonSeed, 'radius'), Math.max(0.8, radius * 0.08), Math.max(1.6, radius * 0.22)),
        orbitDistance: radius * seededRange(hashCombine(moonSeed, 'orbit'), 2.1 + moonIndex * 0.55, 3.2 + moonIndex * 0.9),
        orbitSpeed: seededRange(hashCombine(moonSeed, 'speed'), 0.1, 0.32) * (moonPrng() > 0.5 ? 1 : -1),
        initialAngle: moonPrng() * Math.PI * 2,
        noiseScale: seededRange(hashCombine(moonSeed, 'noiseScale'), 0.8, 2.3),
        landThreshold: seededRange(hashCombine(moonSeed, 'landThreshold'), 0.05, 0.35),
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
      hasClouds: bodyPrng() > 0.22,
      cloudDensity: seededRange(hashCombine(bodySeed, 'cloudDensity'), 0.4, 1.0),
      cloudSpeed: seededRange(hashCombine(bodySeed, 'cloudSpeed'), 0.012, 0.05),
      cloudRotationSpeed: seededRange(hashCombine(bodySeed, 'cloudRotationSpeed'), -0.08, 0.08),
      moons,
      ring: hasRing
        ? {
            innerRadius: radius * seededRange(hashCombine(bodySeed, 'ringInner'), 1.35, 1.7),
            outerRadius: radius * seededRange(hashCombine(bodySeed, 'ringOuter'), 1.8, 2.6),
            color: RING_COLORS[Math.floor(seededRange(hashCombine(bodySeed, 'ringColor'), 0, RING_COLORS.length - 0.001))],
            opacity: seededRange(hashCombine(bodySeed, 'ringOpacity'), 0.18, 0.42),
          }
        : null,
    });
  }

  return {
    seed: worldSeed,
    starRadius,
    starColor,
    bodies,
  };
}
