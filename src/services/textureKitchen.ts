import { SolarSystemData, PlanetData, MoonData } from './solarSystem';
import { GeographyManager } from './geography';

export interface TextureKitchenProgress {
  completed: number;
  total: number;
  label: string;
}

function warmBodyTexture(
  id: string,
  noiseScale: number,
  landThreshold: number,
  visualClass: PlanetData['visualClass'] | MoonData['visualClass'],
  width: number,
  height: number,
) {
  const gm = new GeographyManager();
  gm.setSeed(id, noiseScale, landThreshold, 'standard', visualClass);
  gm.setTextureResolution(width, height);
  void gm.initializeTopicRegions();
}

export async function prewarmTextureKitchen(
  solarSystem: SolarSystemData,
  isMobile: boolean,
  onProgress?: (progress: TextureKitchenProgress) => void,
) {
  const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
  const total = planets.length + planets.reduce((sum, p) => sum + p.moons.length, 0) + 1;
  let completed = 0;

  const update = (label: string) => {
    completed += 1;
    onProgress?.({ completed, total, label });
  };

  const baseRes = isMobile ? { width: 512, height: 256 } : { width: 1024, height: 512 };
  const heroRes = isMobile ? { width: 768, height: 384 } : { width: 1280, height: 640 };

  for (let i = 0; i < planets.length; i += 1) {
    const planet = planets[i];
    const res = i === 0 ? heroRes : baseRes;
    warmBodyTexture(planet.id, planet.noiseScale, planet.landThreshold, planet.visualClass, res.width, res.height);
    update(`Cooking ${planet.id.toUpperCase()} textures`);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    for (const moon of planet.moons) {
      warmBodyTexture(moon.id, moon.noiseScale, moon.landThreshold, moon.visualClass, baseRes.width, baseRes.height);
      update(`Cooking ${moon.id.toUpperCase()} textures`);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  }

  update('Texture kitchen ready');
}
