import { createPRNG, hashCombine } from '../utils/random';

type PlanetNameMap = Record<string, string>; // planetId -> name

const STORAGE_PREFIX = 'planetNames:v1:';

const SYLL_A = ['Zy', 'Ve', 'Kro', 'Or', 'Sa', 'Ny', 'Ly', 'Xa', 'Ae', 'Ul', 'Ka', 'Ri', 'Va', 'No', 'Cy', 'Th', 'Mi', 'El', 'Za', 'Lo'];
const SYLL_B = ['ra', 'lar', 'nis', 'rion', 'vex', 'thos', 'mera', 'dax', 'ion', 'aris', 'ora', 'ven', 'tor', 'kai', 'lune', 'syl', 'dris', 'vora', 'nox', 'phyr'];
const SYLL_C = ['', '', '', 'a', 'is', 'on', 'en', 'us', 'yx', 'ar'];

function sanitizeName(name: string) {
  // single-word, letters only, TitleCase.
  const cleaned = name.replace(/[^A-Za-z]/g, '');
  if (!cleaned) return 'Nova';
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}

function generateCandidate(rng: () => number) {
  const a = SYLL_A[Math.floor(rng() * SYLL_A.length)];
  const b = SYLL_B[Math.floor(rng() * SYLL_B.length)];
  const c = SYLL_C[Math.floor(rng() * SYLL_C.length)];
  return sanitizeName(`${a}${b}${c}`);
}

function generateUniqueNames(systemSeed: string, planetIds: string[], existingNames: string[] = []): PlanetNameMap {
  const rng = createPRNG(hashCombine(systemSeed, 'planet-names'));
  const used = new Set(existingNames.map((n) => n.toLowerCase()));
  const map: PlanetNameMap = {};

  for (const pid of planetIds) {
    // Planet-specific stream keeps names stable even if ordering changes.
    const prng = createPRNG(hashCombine(systemSeed, pid, 'name'));
    let name = generateCandidate(prng);
    let guard = 0;
    while (used.has(name.toLowerCase()) && guard++ < 32) {
      name = generateCandidate(() => prng() * 0.6 + rng() * 0.4);
    }
    if (used.has(name.toLowerCase())) {
      name = sanitizeName(name + SYLL_B[Math.floor(prng() * SYLL_B.length)]);
    }
    used.add(name.toLowerCase());
    map[pid] = name;
  }
  return map;
}

export function getOrCreatePlanetNames(systemSeed: string, planetIds: string[]): PlanetNameMap {
  const storageKey = `${STORAGE_PREFIX}${systemSeed}`;
  try {
    const existingRaw = localStorage.getItem(storageKey);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as PlanetNameMap;
      const missing = planetIds.filter((id) => !existing[id]);
      if (missing.length === 0) return existing;
      const filled = { ...existing, ...generateUniqueNames(systemSeed, missing, Object.values(existing)) };
      localStorage.setItem(storageKey, JSON.stringify(filled));
      return filled;
    }
  } catch {
    // ignore
  }

  const generated = generateUniqueNames(systemSeed, planetIds);
  try {
    localStorage.setItem(storageKey, JSON.stringify(generated));
  } catch {
    // ignore
  }
  return generated;
}

export function getPlanetName(systemSeed: string, planetId: string, planetIdsInSystem: string[]) {
  const map = getOrCreatePlanetNames(systemSeed, planetIdsInSystem);
  return map[planetId] ?? 'Nova';
}


export function getIndexedPlanetNames(planets: { id: string; radius: number; moons?: { id: string }[] }[]) {
  const labels: PlanetNameMap = {};
  const ordered = [...planets].sort((a, b) => {
    const aMoonless = (a.moons?.length || 0) === 0 ? 0 : 1;
    const bMoonless = (b.moons?.length || 0) === 0 ? 0 : 1;
    if (aMoonless !== bMoonless) return aMoonless - bMoonless;
    if (a.radius !== b.radius) return a.radius - b.radius;
    return a.id.localeCompare(b.id);
  });
  const names = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven'];

  for (let index = 0; index < ordered.length; index++) {
    labels[ordered[index].id] = `Planet ${names[index] ?? index}`;
  }

  return labels;
}
