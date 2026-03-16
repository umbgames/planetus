import { createPRNG, cyrb128 } from '../utils/random';

export type PlanetVisualClass = 'lush' | 'oceanic' | 'desert' | 'arid_rocky' | 'barren_gray' | 'icy' | 'volcanic';


export interface PlanetAtmosphereProfile {
  sky: string;
  fog: string;
  glow: string;
  haze: string;
}

export function getPlanetAtmosphereProfile(visualClass: PlanetVisualClass): PlanetAtmosphereProfile {
  switch (visualClass) {
    case 'lush':
      return { sky: '#7fc8ff', fog: '#a7dfff', glow: '#57a8ff', haze: '#d5f0ff' };
    case 'oceanic':
      return { sky: '#4ea1ff', fog: '#7fc6ff', glow: '#2b7fff', haze: '#cbe8ff' };
    case 'desert':
      return { sky: '#d89b52', fog: '#e8bc7a', glow: '#ffcc77', haze: '#f7dec0' };
    case 'arid_rocky':
      return { sky: '#8f6245', fog: '#b08262', glow: '#b66a3d', haze: '#d7b095' };
    case 'barren_gray':
      return { sky: '#5f6675', fog: '#858da0', glow: '#9ba3b5', haze: '#c6ccd9' };
    case 'icy':
      return { sky: '#a6d8ff', fog: '#d6eeff', glow: '#8ecaff', haze: '#eff8ff' };
    case 'volcanic':
      return { sky: '#4c2420', fog: '#7a3228', glow: '#ff6a33', haze: '#d67148' };
    default:
      return { sky: '#7fc8ff', fog: '#a7dfff', glow: '#57a8ff', haze: '#d5f0ff' };
  }
}

export function getPlanetAtmosphereColor(visualClass: PlanetVisualClass) {
  return getPlanetAtmosphereProfile(visualClass).glow;
}

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
  visualClass: PlanetVisualClass;
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

function hashString(str: string): string {
  const h = cyrb128(str);
  return h[0].toString(16) + h[1].toString(16) + h[2].toString(16) + h[3].toString(16);
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const prng = createPRNG(worldSeed);
  
  // Number of planets between 4 and 12
  const numBodies = Math.floor(prng() * 9) + 4;
  
  const bodies: OrbitalBody[] = [];
  
  const baseOrbitDistance = 100;
  
  const VISUAL_CLASSES: PlanetVisualClass[] = ['lush', 'oceanic', 'desert', 'arid_rocky', 'barren_gray', 'icy', 'volcanic'];

  for (let i = 0; i < numBodies; i++) {
    const bodySeed = hashString(`${worldSeed}_${i}`);
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
      // Determine visual class based on distance from sun
      // Closer: volcanic, desert, arid
      // Middle: lush, oceanic
      // Far: barren, icy
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
        visualClass,
      });
    }
  }
  
  return {
    seed: worldSeed,
    starRadius: 8,
    bodies,
  };
}
