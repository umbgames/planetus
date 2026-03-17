import { hashCombine, hashString } from '../utils/random';

const STORAGE_KEY = 'planetus|planet-names|v2';

const NAME_PREFIXES = [
  'Zyr', 'Kron', 'Vel', 'Or', 'Nyx', 'Sol', 'Astra', 'Vex', 'Lun', 'Cael', 'Drav', 'Tyr', 'Nova', 'Ery', 'Cyr', 'Pyra', 'Vala', 'Myr', 'Xeph', 'Ryn'
];
const NAME_SUFFIXES = [
  'a', 'is', 'ar', 'on', 'or', 'en', 'ia', 'ys', 'us', 'ex', 'yn', 'ara', 'eth', 'ion', 'oris', 'ara', 'is', 'or', 'um', 'el'
];

type PlanetNameMap = Record<string, string>;

let cachedNames: PlanetNameMap | null = null;

function loadNames(): PlanetNameMap {
  if (cachedNames) return cachedNames;
  if (typeof window === 'undefined') return {};
  try {
    cachedNames = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return cachedNames || {};
  } catch {
    cachedNames = {};
    return cachedNames;
  }
}

function saveNames(map: PlanetNameMap) {
  cachedNames = map;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota issues; names remain deterministic.
  }
}

function titleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function buildCandidate(seed: string, attempt = 0) {
  const prefix = NAME_PREFIXES[(hashString(hashCombine(seed, 'prefix', attempt)) % NAME_PREFIXES.length + NAME_PREFIXES.length) % NAME_PREFIXES.length];
  const suffix = NAME_SUFFIXES[(hashString(hashCombine(seed, 'suffix', attempt)) % NAME_SUFFIXES.length + NAME_SUFFIXES.length) % NAME_SUFFIXES.length];
  return titleCase(`${prefix}${suffix}`.replace(/[^A-Za-z]/g, ''));
}

export function getPlanetName(systemSeed: string, planetId: string) {
  const key = `${systemSeed}|${planetId}`;
  const map = loadNames();
  if (map[key]) return map[key];

  const used = new Set(Object.values(map));
  let attempt = 0;
  let candidate = buildCandidate(key, attempt);
  while (used.has(candidate)) {
    attempt += 1;
    candidate = buildCandidate(key, attempt);
  }

  map[key] = candidate;
  saveNames(map);
  return candidate;
}

export function getPlanetNames(systemSeed: string, planetIds: string[]) {
  const result: Record<string, string> = {};
  planetIds.forEach((planetId) => {
    result[planetId] = getPlanetName(systemSeed, planetId);
  });
  return result;
}
