import { createPRNG, deriveSeed, lerp } from '../utils/random';

export interface MoonData {
  id: string;
  seed: string;
  radius: number;
  orbitDistance: number;
  orbitSpeed: number;
  initialAngle: number;
  noiseScale: number;
  landThreshold: number;
  biomeSeed: string;
}

export interface RingData {
  innerRadius: number;
  outerRadius: number;
  tiltX: number;
  tiltZ: number;
  colorSeed: number;
}

export interface PlanetData {
  id: string;
  type: 'planet';
  seed: string;
  biomeSeed: string;
  starSystemSeed: string;
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
  cloudSeed: string;
  cloudRotationSpeed: number;
  moons: MoonData[];
  rings?: RingData;
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
  galaxySeed: string;
  starSystemSeed: string;
  starRadius: number;
  bodies: OrbitalBody[];
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const galaxySeed = deriveSeed(worldSeed, 'galaxy');
  const starSystemSeed = deriveSeed(galaxySeed, 'star-system-0');
  const prng = createPRNG(starSystemSeed);

  const numBodies = Math.floor(prng() * 8) + 5;
  const bodies: OrbitalBody[] = [];
  const baseOrbitDistance = 100;

  for (let i = 0; i < numBodies; i++) {
    const bodySeed = deriveSeed(starSystemSeed, `body-${i}`);
    const biomeSeed = deriveSeed(bodySeed, 'biome');
    const cloudSeed = deriveSeed(bodySeed, 'clouds');
    const bodyPrng = createPRNG(bodySeed);

    const orbitDistance = baseOrbitDistance * Math.pow(1.72, i);
    const initialAngle = bodyPrng() * Math.PI * 2;
    const isAsteroidBelt = i > 0 && bodyPrng() < 0.16;

    if (isAsteroidBelt) {
      bodies.push({
        id: `belt_${i}`,
        type: 'asteroid_belt',
        orbitDistance,
        orbitSpeed: (bodyPrng() * 0.018 + 0.008) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * lerp(0.08, 0.18, bodyPrng()),
        count: Math.floor(lerp(160, 420, bodyPrng())),
        initialAngle,
        seed: bodySeed,
      });
      continue;
    }

    const distanceFactor = i / Math.max(1, numBodies - 1);
    const minRadius = lerp(4, 9, distanceFactor);
    const maxRadius = lerp(10, 22, distanceFactor);
    const radius = lerp(minRadius, maxRadius, Math.pow(bodyPrng(), 0.65));

    const moonCount = bodyPrng() < 0.35 ? 0 : Math.min(4, Math.floor(bodyPrng() * (1 + distanceFactor * 5)));
    const hasRings = radius > 11 && bodyPrng() > 0.58;

    const moons: MoonData[] = [];
    for (let moonIndex = 0; moonIndex < moonCount; moonIndex++) {
      const moonSeed = deriveSeed(bodySeed, `moon-${moonIndex}`);
      const moonPrng = createPRNG(moonSeed);
      moons.push({
        id: `moon_${i}_${moonIndex}`,
        seed: moonSeed,
        radius: lerp(radius * 0.12, radius * 0.32, moonPrng()),
        orbitDistance: radius * lerp(2.2 + moonIndex * 1.4, 3.6 + moonIndex * 2.1, moonPrng()),
        orbitSpeed: (moonPrng() * 0.3 + 0.08) * (moonPrng() > 0.5 ? 1 : -1),
        initialAngle: moonPrng() * Math.PI * 2,
        noiseScale: lerp(0.7, 2.8, moonPrng()),
        landThreshold: lerp(0.06, 0.28, moonPrng()),
        biomeSeed: deriveSeed(moonSeed, 'biome'),
      });
    }

    bodies.push({
      id: `planet_${i}`,
      type: 'planet',
      seed: bodySeed,
      biomeSeed,
      starSystemSeed,
      radius,
      orbitDistance,
      orbitSpeed: (bodyPrng() * 0.04 + 0.008) * (bodyPrng() > 0.5 ? 1 : -1),
      orbitTiltX: (bodyPrng() - 0.5) * 0.45,
      orbitTiltZ: (bodyPrng() - 0.5) * 0.45,
      initialAngle,
      noiseScale: lerp(0.55, 2.8, bodyPrng()),
      landThreshold: lerp(0.08, 0.34, bodyPrng()),
      colorSeed: bodyPrng(),
      temperatureBias: lerp(-0.3, 0.35, bodyPrng()) - distanceFactor * 0.35,
      humidityBias: lerp(-0.2, 0.25, bodyPrng()),
      cloudSeed,
      cloudRotationSpeed: lerp(0.03, 0.16, bodyPrng()),
      moons,
      rings: hasRings
        ? {
            innerRadius: radius * lerp(1.45, 1.9, bodyPrng()),
            outerRadius: radius * lerp(2.05, 2.85, bodyPrng()),
            tiltX: (bodyPrng() - 0.5) * 0.9,
            tiltZ: (bodyPrng() - 0.5) * 0.9,
            colorSeed: bodyPrng(),
          }
        : undefined,
    });
  }

  return {
    seed: worldSeed,
    galaxySeed,
    starSystemSeed,
    starRadius: 8,
    bodies,
  };
}
