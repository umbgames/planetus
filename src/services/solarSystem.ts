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

export const VISUAL_SCALE = {
  STAR_RADIUS_MULTIPLIER: 4.5,
  PLANET_RADIUS_MULTIPLIER: 0.9,
  ORBIT_DISTANCE_MULTIPLIER: 2.8,
  MIN_ORBIT_GAP: 18,
  ASTEROID_DISTANCE_MULTIPLIER: 2.8,
  ASTEROID_WIDTH_MULTIPLIER: 1.4,
  PLANET_LOD_DISTANCE_MULTIPLIER: 1.8,
};

const PLANET_NAME_POOL = [
  'Astra','Veyra','Noxis','Cindor','Lyra','Orin','Kairo','Zephra','Solis','Drava',
  'Nyra','Talos','Erynd','Mira','Kest','Vorin','Axiom','Sable','Ivara','Pyra',
  'Riven','Caelum','Drax','Eldra','Vanta','Koris','Thalos','Bront','Myra','Zenith'
];

export function getScaledPlanetRadius(radius: number) {
  return radius * VISUAL_SCALE.PLANET_RADIUS_MULTIPLIER;
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
    const scaledGap = Math.max(originalGap * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER, VISUAL_SCALE.MIN_ORBIT_GAP);
    const nextOrbit = lastScaledOrbit + scaledGap;
    scaledOrbitMap.set(planet.id, nextOrbit);
    lastScaledOrbit = nextOrbit;
    lastOriginalOrbit = planet.orbitDistance;
  });

  return scaledOrbitMap;
}

export function getPlanetWorldPosition(planet: PlanetData, elapsedTime: number, orbitMap?: Map<string, number>) {
  const orbitDistance = orbitMap?.get(planet.id) ?? planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
  const angle = planet.initialAngle + elapsedTime * planet.orbitSpeed;
  const x = Math.cos(angle) * orbitDistance;
  const z = Math.sin(angle) * orbitDistance;
  const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
  return { x, y, z };
}

export function getPlanetDisplayName(planetId: string, solarSystem?: SolarSystemData | null) {
  const named = solarSystem?.bodies.find((b): b is PlanetData => b.type === 'planet' && b.id === planetId);
  return named?.name ?? planetId.replace('planet_', 'PLANET-');
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
        name: PLANET_NAME_POOL[i % PLANET_NAME_POOL.length],
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
