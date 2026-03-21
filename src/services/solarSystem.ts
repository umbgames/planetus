import { createPRNG, hashCombine, seededRange } from '../utils/random';

export type VisualClass =
  | 'lush'
  | 'oceanic'
  | 'desert'
  | 'arid_rocky'
  | 'barren_gray'
  | 'icy'
  | 'volcanic'
  | 'gas_giant';

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
  visualClass: 'barren_gray' | 'arid_rocky' | 'volcanic';
  atmosphereColor: string;
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
  visualClass: VisualClass;
  atmosphereColor: string;
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
const PLANET_NAME_PARTS_A = ['Astra', 'Khar', 'Nexa', 'Vora', 'Tala', 'Drava', 'Solis', 'Oro', 'Cinder', 'Myra', 'Dune', 'Cryo'];
const PLANET_NAME_PARTS_B = ['lon', 'mere', 'th', 'dar', 'os', 'ion', 'ara', 'is', 'ora', ' Prime', ' Secundus', ' IX'];

function pickPlanetName(seed: string, index: number) {
  const prng = createPRNG(hashCombine(seed, 'planetName', index));
  const left = PLANET_NAME_PARTS_A[Math.floor(prng() * PLANET_NAME_PARTS_A.length) % PLANET_NAME_PARTS_A.length];
  const right = PLANET_NAME_PARTS_B[Math.floor(prng() * PLANET_NAME_PARTS_B.length) % PLANET_NAME_PARTS_B.length];
  return `${left}${right}`;
}

function classifyPlanet(radius: number, radialRatio: number, temperatureBias: number, humidityBias: number, seed: string): VisualClass {
  const roll = seededRange(hashCombine(seed, 'visualRoll'), 0, 1);
  const heat = radialRatio < 0.22 ? 0.95 : radialRatio < 0.4 ? 0.72 : radialRatio < 0.68 ? 0.5 : 0.18;
  const cold = radialRatio > 0.78 ? 0.95 : radialRatio > 0.58 ? 0.7 : radialRatio > 0.42 ? 0.45 : 0.15;

  if (radius > 18.5 && roll > 0.16) return 'gas_giant';
  if (heat + temperatureBias > 0.86 && roll > 0.58) return 'volcanic';
  if (heat + temperatureBias > 0.7 && humidityBias < -0.04) return roll > 0.44 ? 'desert' : 'arid_rocky';
  if (cold - temperatureBias > 0.72) return roll > 0.42 ? 'icy' : 'barren_gray';
  if (humidityBias > 0.16 && radialRatio > 0.22 && radialRatio < 0.72) return 'oceanic';
  if (humidityBias > -0.04 && radialRatio > 0.18 && radialRatio < 0.62) return 'lush';
  return roll > 0.5 ? 'barren_gray' : 'arid_rocky';
}

function getAtmosphereColor(visualClass: VisualClass, radialRatio: number): string {
  if (radialRatio < 0.18) return '#ffd1a3';
  if (radialRatio > 0.8) return '#b8d8ff';

  switch (visualClass) {
    case 'volcanic':
      return '#ff8a5c';
    case 'desert':
      return '#f2b874';
    case 'arid_rocky':
      return '#d0a37b';
    case 'barren_gray':
      return '#b7c0ca';
    case 'icy':
      return '#a8d8ff';
    case 'oceanic':
      return '#71c0ff';
    case 'gas_giant':
      return '#e8d7ba';
    case 'lush':
    default:
      return '#8bc8ff';
  }
}

function getMoonVisualClass(parentClass: VisualClass, moonSeed: string): MoonData['visualClass'] {
  if (parentClass === 'volcanic') return 'volcanic';
  return seededRange(hashCombine(moonSeed, 'rockType'), 0, 1) > 0.65 ? 'arid_rocky' : 'barren_gray';
}

export function generateSolarSystem(worldSeed: string): SolarSystemData {
  const prng = createPRNG(worldSeed);
  const numBodies = Math.floor(prng() * 8) + 6;
  const bodies: OrbitalBody[] = [];
  const starRadius = seededRange(hashCombine(worldSeed, 'starRadius'), 8, 16);
  const starColor = STAR_COLORS[Math.floor(prng() * STAR_COLORS.length) % STAR_COLORS.length];

  let orbitDistance = 90;
  const planetsMeta: Array<{ index: number; radius: number; radialRatio: number; bodySeed: string }> = [];

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
        count: Math.floor(seededRange(hashCombine(bodySeed, 'count'), 120, 340)),
        initialAngle,
        seed: bodySeed,
      });
      continue;
    }

    const giantBias = Math.pow(radialRatio, 1.7);
    const baseRadius = seededRange(hashCombine(bodySeed, 'radius'), 6.5, 13.5);
    const giantRoll = seededRange(hashCombine(bodySeed, 'giantRoll'), 0, 1);
    const giantMultiplier = giantRoll > 0.72 - giantBias * 0.28
      ? seededRange(hashCombine(bodySeed, 'giantMultiplier'), 1.5, 3.2 + giantBias * 2.2)
      : seededRange(hashCombine(bodySeed, 'standardMultiplier'), 0.95, 1.45 + giantBias * 0.45);
    const radius = baseRadius * giantMultiplier;
    planetsMeta.push({ index: i, radius, radialRatio, bodySeed });

    const temperatureBias = seededRange(hashCombine(bodySeed, 'temperatureBias'), -0.25, 0.25);
    const humidityBias = seededRange(hashCombine(bodySeed, 'humidityBias'), -0.25, 0.25);
    const visualClass = classifyPlanet(radius, radialRatio, temperatureBias, humidityBias, bodySeed);
    const atmosphereColor = getAtmosphereColor(visualClass, radialRatio);
    const moonCountBase = radius > 16
      ? Math.floor(seededRange(hashCombine(bodySeed, 'moons'), 1, 3))
      : radius > 10
        ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsMid'), 0, 3))
        : bodyPrng() > 0.7
          ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsSmall'), 0, 2))
          : 0;
    const moonCount = Math.min(2, moonCountBase);

    const moons: MoonData[] = Array.from({ length: moonCount }, (_, moonIndex) => {
      const moonSeed = hashCombine(bodySeed, 'moon', moonIndex);
      const moonPrng = createPRNG(moonSeed);
      const moonVisualClass = getMoonVisualClass(visualClass, moonSeed);
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
        noiseScale: seededRange(hashCombine(moonSeed, 'noiseScale'), 1.2, 3.2),
        landThreshold: seededRange(hashCombine(moonSeed, 'landThreshold'), 0.18, 0.42),
        paletteSeed: seededRange(hashCombine(moonSeed, 'paletteSeed'), 0, 1),
        hasClouds: false,
        visualClass: moonVisualClass,
        atmosphereColor: moonVisualClass === 'volcanic' ? '#ff9c73' : '#b5bcc5',
      };
    });

    bodies.push({
      id: `planet_${i}`,
      name: pickPlanetName(worldSeed, i),
      seed: bodySeed,
      type: 'planet',
      radius,
      orbitDistance,
      orbitSpeed: seededRange(hashCombine(bodySeed, 'orbitSpeed'), 0.004, 0.02) * (bodyPrng() > 0.5 ? 1 : -1),
      orbitTiltX: seededRange(hashCombine(bodySeed, 'tiltX'), -0.28, 0.28),
      orbitTiltZ: seededRange(hashCombine(bodySeed, 'tiltZ'), -0.28, 0.28),
      initialAngle,
      noiseScale: seededRange(hashCombine(bodySeed, 'noiseScale'), visualClass === 'gas_giant' ? 0.45 : 0.8, visualClass === 'gas_giant' ? 1.1 : 3.0),
      landThreshold: visualClass === 'oceanic'
        ? seededRange(hashCombine(bodySeed, 'landThresholdOceanic'), 0.18, 0.36)
        : visualClass === 'desert' || visualClass === 'arid_rocky' || visualClass === 'volcanic'
          ? seededRange(hashCombine(bodySeed, 'landThresholdDry'), 0.0, 0.18)
          : seededRange(hashCombine(bodySeed, 'landThreshold'), 0.02, 0.42),
      colorSeed: bodyPrng(),
      temperatureBias,
      humidityBias,
      paletteSeed: seededRange(hashCombine(bodySeed, 'paletteSeed'), 0, 1),
      hasClouds: visualClass !== 'barren_gray' && visualClass !== 'volcanic' && bodyPrng() > (visualClass === 'desert' ? 0.72 : 0.22),
      cloudDensity: visualClass === 'desert' ? seededRange(hashCombine(bodySeed, 'cloudDensityDry'), 0.18, 0.42) : seededRange(hashCombine(bodySeed, 'cloudDensity'), 0.4, 1.0),
      cloudSpeed: seededRange(hashCombine(bodySeed, 'cloudSpeed'), 0.012, 0.05),
      cloudRotationSpeed: seededRange(hashCombine(bodySeed, 'cloudRotationSpeed'), -0.08, 0.08),
      visualClass,
      atmosphereColor,
      moons,
      ring: null,
    });
  }

  const planets = bodies.filter((body): body is PlanetData => body.type === 'planet');
  const sortedBySize = [...planets].sort((a, b) => b.radius - a.radius);
  const ringThreshold = sortedBySize[Math.min(sortedBySize.length - 1, Math.max(1, Math.floor(sortedBySize.length * 0.34))) ]?.radius ?? 16;

  for (const body of planets) {
    const bodySeed = body.seed;
    const qualifiesForRing = body.radius >= ringThreshold && body.radius > 14;
    const shouldHaveRing = qualifiesForRing && seededRange(hashCombine(bodySeed, 'ringRoll'), 0, 1) > 0.18;
    body.ring = shouldHaveRing
      ? {
          innerRadius: body.radius * seededRange(hashCombine(bodySeed, 'ringInner'), 1.35, 1.7),
          outerRadius: body.radius * seededRange(hashCombine(bodySeed, 'ringOuter'), 1.8, 2.6),
          color: RING_COLORS[Math.floor(seededRange(hashCombine(bodySeed, 'ringColor'), 0, RING_COLORS.length - 0.001))],
          opacity: seededRange(hashCombine(bodySeed, 'ringOpacity'), 0.18, 0.42),
        }
      : null;
  }

  return {
    seed: worldSeed,
    starRadius,
    starColor,
    bodies,
  };
}
