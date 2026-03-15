import { createPRNG } from '../utils/random';

export interface PlanetData {
  id: string;
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
  bodies: OrbitalBody[];
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const prng = createPRNG(worldSeed);
  
  // Number of planets between 4 and 12
  const numBodies = Math.floor(prng() * 9) + 4;
  
  const bodies: OrbitalBody[] = [];
  
  const baseOrbitDistance = 100;
  
  for (let i = 0; i < numBodies; i++) {
    const bodySeed = `${worldSeed}${i}`;
    const bodyPrng = createPRNG(bodySeed);
    
    // 20% chance of asteroid belt, but not the first body
    const isAsteroidBelt = i > 0 && bodyPrng() < 0.2;
    
    // Logarithmic scale for distance
    const orbitDistance = baseOrbitDistance * Math.pow(1.8, i);
    const initialAngle = bodyPrng() * Math.PI * 2;
    
    if (isAsteroidBelt) {
      bodies.push({
        id: `belt_${i}`,
        type: 'asteroid_belt',
        orbitDistance: orbitDistance,
        orbitSpeed: (bodyPrng() * 0.02 + 0.01) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * 0.1,
        count: Math.floor(bodyPrng() * 200) + 100,
        initialAngle: initialAngle,
        seed: bodySeed,
      });
    } else {
      bodies.push({
        id: `planet_${i}`,
        type: 'planet',
        radius: bodyPrng() * 6 + 4, // 4 to 10
        orbitDistance: orbitDistance,
        orbitSpeed: (bodyPrng() * 0.05 + 0.01) * (bodyPrng() > 0.5 ? 1 : -1),
        orbitTiltX: (bodyPrng() - 0.5) * 0.5,
        orbitTiltZ: (bodyPrng() - 0.5) * 0.5,
        initialAngle: initialAngle,
        noiseScale: bodyPrng() * 2 + 0.5,
        landThreshold: bodyPrng() * 0.4 + 0.1,
        colorSeed: bodyPrng(),
      });
    }
  }
  
  return {
    seed: worldSeed,
    starRadius: 8,
    bodies,
  };
}
