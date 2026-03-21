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
  spinSpeed: number;
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
  visualClass: VisualClass;
  spinSpeed: number;
  heat: number;
  atmosphereColor: string;
  atmosphereOpacity: number;
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
const VISUAL_CLASS_POOL: VisualClass[] = ['rocky', 'dry_arid', 'desert', 'red'];

function pickVisualClass(heat: number, radialRatio: number, bodySeed: string): VisualClass {
  const climateRoll = seededRange(hashCombine(bodySeed, 'visualClassRoll'), 0, 1);

  if (heat > 0.8) {
    return climateRoll > 0.48 ? 'red' : 'desert';
  }

  if (heat > 0.58) {
    return climateRoll > 0.62 ? 'red' : climateRoll > 0.2 ? 'desert' : 'dry_arid';
  }

  if (heat < 0.24) {
    return climateRoll > 0.7 ? 'rocky' : 'dry_arid';
  }

  if (radialRatio > 0.72) {
    return climateRoll > 0.55 ? 'rocky' : 'dry_arid';
  }

  return VISUAL_CLASS_POOL[Math.floor(seededRange(hashCombine(bodySeed, 'visualClassFallback'), 0, VISUAL_CLASS_POOL.length - 0.001))];
}

function getAtmosphereColor(visualClass: VisualClass, heat: number): string {
  if (heat > 0.8) return visualClass === 'red' ? '#ff8a66' : '#ffb06a';
  if (heat > 0.6) return visualClass === 'desert' ? '#ffd29a' : '#ffb38f';
  if (heat < 0.25) return '#a7c8ff';
  if (visualClass === 'red') return '#ff9b8a';
  if (visualClass === 'rocky') return '#a5b7d8';
  return '#d7c0a2';
}

function getAtmosphereOpacity(radius: number, heat: number, visualClass: VisualClass): number {
  const sizeFactor = radius > 18 ? 0.15 : radius > 12 ? 0.11 : 0.07;
  const thermalFactor = heat > 0.75 ? 0.04 : heat < 0.25 ? 0.015 : 0.03;
  const classFactor = visualClass === 'rocky' ? -0.02 : visualClass === 'dry_arid' ? -0.005 : 0.012;
  return Math.max(0.02, Math.min(0.2, sizeFactor + thermalFactor + classFactor));
}

function getCloudSettings(visualClass: VisualClass, radius: number, heat: number, bodySeed: string) {
  const canHaveClouds = radius > 8 && visualClass !== 'rocky';
  if (!canHaveClouds) {
    return { hasClouds: false, cloudDensity: 0.15, cloudSpeed: 0.012, cloudRotationSpeed: 0.01 };
  }

  const densityBase = visualClass === 'desert' ? 0.2 : visualClass === 'red' ? 0.32 : 0.42;
  const heatMod = heat > 0.8 ? -0.08 : heat < 0.25 ? -0.04 : 0.06;
  return {
    hasClouds: seededRange(hashCombine(bodySeed, 'cloudPresence'), 0, 1) > (visualClass === 'desert' ? 0.5 : 0.28),
    cloudDensity: Math.max(0.12, Math.min(0.72, densityBase + heatMod + seededRange(hashCombine(bodySeed, 'cloudDensity'), -0.08, 0.08))),
    cloudSpeed: seededRange(hashCombine(bodySeed, 'cloudSpeed'), 0.01, 0.03),
    cloudRotationSpeed: seededRange(hashCombine(bodySeed, 'cloudRotationSpeed'), -0.035, 0.035),
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
    const isAsteroidBelt = i > 1 && bodyPrng() < 0.14;
    orbitDistance += seededRange(hashCombine(bodySeed, 'orbitGap'), 55, 120);
    const initialAngle = bodyPrng() * Math.PI * 2;
    const radialRatio = i / Math.max(1, numBodies - 1);
    const heat = Math.max(0, Math.min(1, 1 - radialRatio + seededRange(hashCombine(bodySeed, 'heatBias'), -0.12, 0.12)));

    if (isAsteroidBelt) {
      bodies.push({
        id: `belt_${i}`,
        type: 'asteroid_belt',
        orbitDistance,
        orbitSpeed: seededRange(hashCombine(bodySeed, 'speed'), 0.006, 0.018) * (bodyPrng() > 0.5 ? 1 : -1),
        width: orbitDistance * seededRange(hashCombine(bodySeed, 'width'), 0.08, 0.16),
        count: Math.floor(seededRange(hashCombine(bodySeed, 'count'), 120, 360)),
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
    const visualClass = pickVisualClass(heat, radialRatio, bodySeed);
    const isRingEligible = radius >= 18.5 && radialRatio > 0.3;
    const hasRing = isRingEligible && bodyPrng() > 0.55;

    const moonCountBase = radius > 18
      ? Math.floor(seededRange(hashCombine(bodySeed, 'moons'), 1, 3))
      : radius > 11
        ? Math.floor(seededRange(hashCombine(bodySeed, 'moonsMid'), 0, 3))
        : bodyPrng() > 0.72
          ? 1
          : 0;
    const moonCount = Math.min(2, moonCountBase);

    const moons: MoonData[] = Array.from({ length: moonCount }, (_, moonIndex) => {
      const moonSeed = hashCombine(bodySeed, 'moon', moonIndex);
      const moonPrng = createPRNG(moonSeed);
      return {
        id: `planet_${i}_moon_${moonIndex}`,
        seed: moonSeed,
        parentPlanetId: `planet_${i}`,
        radius: seededRange(hashCombine(moonSeed, 'radius'), Math.max(1.2, radius * 0.1), Math.max(2.8, radius * 0.22)),
        orbitDistance: radius * seededRange(hashCombine(moonSeed, 'orbit'), 3.8 + moonIndex * 1.2, 6.4 + moonIndex * 1.5),
        orbitSpeed: seededRange(hashCombine(moonSeed, 'speed'), 0.014, 0.05) * (moonPrng() > 0.5 ? 1 : -1),
        orbitTiltX: seededRange(hashCombine(moonSeed, 'tiltX'), -0.22, 0.22),
        orbitTiltZ: seededRange(hashCombine(moonSeed, 'tiltZ'), -0.22, 0.22),
        initialAngle: moonPrng() * Math.PI * 2,
        noiseScale: seededRange(hashCombine(moonSeed, 'noiseScale'), 1.6, 3.4),
        landThreshold: seededRange(hashCombine(moonSeed, 'landThreshold'), -0.02, 0.18),
        paletteSeed: seededRange(hashCombine(moonSeed, 'paletteSeed'), 0, 1),
        hasClouds: false,
        visualClass: 'rocky',
        spinSpeed: seededRange(hashCombine(moonSeed, 'spinSpeed'), 0.01, 0.03) * (moonPrng() > 0.5 ? 1 : -1),
      };
    });

    const cloudSettings = getCloudSettings(visualClass, radius, heat, bodySeed);

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
      noiseScale: visualClass === 'rocky'
        ? seededRange(hashCombine(bodySeed, 'noiseScaleRocky'), 1.4, 3.1)
        : visualClass === 'red'
          ? seededRange(hashCombine(bodySeed, 'noiseScaleRed'), 1.0, 2.3)
          : seededRange(hashCombine(bodySeed, 'noiseScale'), 0.65, 2.2),
      landThreshold: visualClass === 'desert'
        ? seededRange(hashCombine(bodySeed, 'landThresholdDesert'), -0.08, 0.08)
        : visualClass === 'rocky'
          ? seededRange(hashCombine(bodySeed, 'landThresholdRocky'), -0.12, 0.04)
          : seededRange(hashCombine(bodySeed, 'landThreshold'), -0.02, 0.24),
      colorSeed: bodyPrng(),
      temperatureBias: (heat - 0.5) * 0.9,
      humidityBias: visualClass === 'desert'
        ? seededRange(hashCombine(bodySeed, 'humidityBiasDesert'), -0.58, -0.25)
        : visualClass === 'dry_arid'
          ? seededRange(hashCombine(bodySeed, 'humidityBiasArid'), -0.45, -0.12)
          : visualClass === 'rocky'
            ? seededRange(hashCombine(bodySeed, 'humidityBiasRocky'), -0.35, -0.08)
            : seededRange(hashCombine(bodySeed, 'humidityBiasRed'), -0.28, 0.02),
      paletteSeed: seededRange(hashCombine(bodySeed, 'paletteSeed'), 0, 1),
      hasClouds: cloudSettings.hasClouds,
      cloudDensity: cloudSettings.cloudDensity,
      cloudSpeed: cloudSettings.cloudSpeed,
      cloudRotationSpeed: cloudSettings.cloudRotationSpeed,
      moons,
      ring: hasRing
        ? {
            innerRadius: radius * seededRange(hashCombine(bodySeed, 'ringInner'), 1.45, 1.8),
            outerRadius: radius * seededRange(hashCombine(bodySeed, 'ringOuter'), 1.95, 2.85),
            color: RING_COLORS[Math.floor(seededRange(hashCombine(bodySeed, 'ringColor'), 0, RING_COLORS.length - 0.001))],
            opacity: seededRange(hashCombine(bodySeed, 'ringOpacity'), 0.16, 0.34),
          }
        : null,
      visualClass,
      spinSpeed: seededRange(hashCombine(bodySeed, 'spinSpeed'), 0.008, 0.022) * (bodyPrng() > 0.5 ? 1 : -1),
      heat,
      atmosphereColor: getAtmosphereColor(visualClass, heat),
      atmosphereOpacity: getAtmosphereOpacity(radius, heat, visualClass),
    });
  }

  return {
    seed: worldSeed,
    starRadius,
    starColor,
    bodies,
  };
}
