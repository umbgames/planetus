import { SolarSystemData, PlanetData } from './solarSystem';
import { GeographyManager } from './geography';

export interface TextureKitchenProgress {
  completed: number;
  total: number;
  label: string;
}

function warmBodyTexture(planet: PlanetData | PlanetData['moons'][number], textureDetail: 'standard' | 'enhanced') {
  GeographyManager.warmCache(planet.seed, planet.noiseScale, planet.landThreshold, textureDetail, planet.visualClass);
}

export async function prewarmTextureKitchen(
  solarSystem: SolarSystemData,
  isMobile: boolean,
  onProgress?: (progress: TextureKitchenProgress) => void
) {
  const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
  const total = planets.length + planets.reduce((sum, p) => sum + p.moons.length, 0) + 1;
  let completed = 0;
  const textureDetail = isMobile ? 'standard' : 'enhanced';

  const update = (label: string) => {
    completed += 1;
    onProgress?.({ completed, total, label });
  };

  for (const planet of planets) {
    warmBodyTexture(planet, textureDetail);
    update(`Cooking ${planet.name.toUpperCase()} textures`);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    for (const moon of planet.moons) {
      warmBodyTexture(moon, 'standard');
      update(`Cooking ${moon.id.toUpperCase()} textures`);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  }

  update('Texture kitchen ready');
}
