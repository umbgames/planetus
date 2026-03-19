import { SolarSystemData, PlanetData, MoonData } from "./solarSystem";
import { GeographyManager } from "./geography";

export interface TextureKitchenProgress {
  completed: number;
  total: number;
  label: string;
}

function warmBodyTexture(id: string, noiseScale: number, landThreshold: number, visualClass: PlanetData['visualClass'] | MoonData['visualClass'], detail: 'standard' | 'enhanced') {
  const gm = new GeographyManager();
  gm.setSeed(id, noiseScale, landThreshold, visualClass, detail);
  gm.initializeTopicRegions();
  gm.generateTexture();
}

export async function prewarmTextureKitchen(
  solarSystem: SolarSystemData,
  isMobile: boolean,
  onProgress?: (progress: TextureKitchenProgress) => void
) {
  const planets = solarSystem.bodies.filter((b): b is PlanetData => b.type === 'planet');
  const total = planets.length + planets.reduce((sum, p) => sum + p.moons.length, 0) + 1;
  let completed = 0;

  const update = (label: string) => {
    completed += 1;
    onProgress?.({ completed, total, label });
  };

  const baseDetail = isMobile ? 'standard' : 'enhanced';
  const heroDetail = 'enhanced';

  for (let i = 0; i < planets.length; i += 1) {
    const planet = planets[i];
    const detail = i === 0 ? heroDetail : baseDetail;
    warmBodyTexture(planet.id, planet.noiseScale, planet.landThreshold, planet.visualClass, detail);
    update(`Cooking ${planet.id.toUpperCase()} textures`);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    for (const moon of planet.moons) {
      warmBodyTexture(moon.id, moon.noiseScale, moon.landThreshold, moon.visualClass, baseDetail);
      update(`Cooking ${moon.id.toUpperCase()} textures`);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  }

  update('Texture kitchen ready');
}
