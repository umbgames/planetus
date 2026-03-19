import { createPRNG, hashCombine, seededRange } from '../utils/random';

export type VisualClass = 'lush' | 'oceanic' | 'desert' | 'arid_rocky' | 'barren_gray' | 'icy' | 'volcanic' | 'gas_giant' | 'red_desert';

export interface MoonData {
  id: string;
  seed: string;
  parentPlanetId: string;
  name: string;
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
  visualClass: VisualClass;
}

export interface RingData {
  innerRadius: number;
  outerRadius: number;
  color: string;
  opacity: number;
}

export interface PlanetData {
  id: string;
  name: string;
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
  visualClass: VisualClass;
  atmosphereColor: string;
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

const PLANET_NAMES = ['Astra','Virel','Kharon','Cinder','Ossia','Mira','Tethys','Nyra','Dune','Brakka','Helion','Voss','Rhea','Talos','Sirocco'];
const VISUAL_CLASSES: VisualClass[] = ['lush','oceanic','desert','arid_rocky','barren_gray','icy','volcanic','red_desert'];
const ATMOSPHERE_BY_CLASS: Record<VisualClass, string> = {
  lush: '#7fc8ff',
  oceanic: '#72b6ff',
  desert: '#ffd28a',
  arid_rocky: '#e2b07a',
  barren_gray: '#b5c0cf',
  icy: '#c7ebff',
  volcanic: '#ff8d6a',
  gas_giant: '#f4d3a1',
  red_desert: '#ff9b7a',
};

function clampMoonCount(radius: number, prng: () => number) {
  if (radius > 24) return 2;
  if (radius > 12) return prng() > 0.5 ? 2 : 1;
  return prng() > 0.68 ? 1 : 0;
}

function pickVisualClass(radialRatio: number, radius: number, bodySeed: string): VisualClass {
  if (radius > 22) return 'gas_giant';
  const roll = seededRange(hashCombine(bodySeed, 'visualClass'), 0, 1);
  if (radialRatio < 0.2) return roll > 0.55 ? 'volcanic' : 'arid_rocky';
  if (radialRatio < 0.38) return roll > 0.7 ? 'red_desert' : 'desert';
  if (radialRatio < 0.62) return roll > 0.45 ? 'lush' : 'oceanic';
  if (radialRatio < 0.82) return roll > 0.55 ? 'barren_gray' : 'icy';
  return roll > 0.45 ? 'icy' : 'barren_gray';
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
        orbitSpeed: (seededRange(hashCombine(bodySeed, 'speed'), 0.006, 0.018)) * (bodyPrng() > 0.5 ? 1 : -1),
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
    const visualClass = pickVisualClass(radialRatio, radius, bodySeed);
    const hasRing = radius > 18 && radialRatio > 0.45 && bodyPrng() > 0.28;
    const moonCount = clampMoonCount(radius, bodyPrng);

    const moons: MoonData[] = Array.from({ length: moonCount }, (_, moonIndex) => {
      const moonSeed = hashCombine(bodySeed, 'moon', moonIndex);
      const moonPrng = createPRNG(moonSeed);
      return {
        id: `planet_${i}_moon_${moonIndex}`,
        seed: moonSeed,
        parentPlanetId: `planet_${i}`,
        name: `${PLANET_NAMES[i % PLANET_NAMES.length]}-${moonIndex + 1}`,
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
        visualClass: 'barren_gray',
      };
    });

    bodies.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
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
      hasClouds: visualClass !== 'barren_gray' && visualClass !== 'volcanic' && bodyPrng() > 0.18,
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
      visualClass,
      atmosphereColor: ATMOSPHERE_BY_CLASS[visualClass],
    });
  }

  return {
    seed: worldSeed,
    starRadius,
    starColor,
    bodies,
  };
}
