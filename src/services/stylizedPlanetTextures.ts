import * as THREE from 'three';
import { VisualClass } from './solarSystem';
import { createPRNG, hashCombine } from '../utils/random';

export interface StylizedPlanetTextures {
  colorCanvas: HTMLCanvasElement;
  dispCanvas: HTMLCanvasElement;
  roughCanvas: HTMLCanvasElement;
  detailCanvas: HTMLCanvasElement;
  colorTexture: THREE.CanvasTexture;
  dispTexture: THREE.CanvasTexture;
  roughTexture: THREE.CanvasTexture;
  detailTexture: THREE.CanvasTexture;
  heightBuffer: Uint8ClampedArray;
  width: number;
  height: number;
}

const textureCache = new Map<string, StylizedPlanetTextures>();

function configureTexture(tex: THREE.CanvasTexture, isColor = false, repeat = false) {
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
}

/**
 * Creates high quality, crisp cartoonish textures with distinct water,
 * coastal shallows, beaches, and rich stylized biomes.
 */
export function generateStylizedPlanetTextures(
  visualClass: VisualClass,
  seed: string,
  width = 2048,
  height = 1024
): StylizedPlanetTextures {
  const cacheKey = `${visualClass}|${seed}|${width}x${height}`;
  const existing = textureCache.get(cacheKey);
  if (existing) return existing;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d', { willReadFrequently: true })!;

  const dispCanvas = document.createElement('canvas');
  dispCanvas.width = width;
  dispCanvas.height = height;
  const dispCtx = dispCanvas.getContext('2d', { willReadFrequently: true })!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d', { willReadFrequently: true })!;

  const detailCanvas = document.createElement('canvas');
  detailCanvas.width = 64;
  detailCanvas.height = 64;
  const detailCtx = detailCanvas.getContext('2d')!;

  const rand = createPRNG(hashCombine(seed, 'stylized-planet'));

  // Fill detail canvas with neutral 128
  detailCtx.fillStyle = '#808080';
  detailCtx.fillRect(0, 0, 64, 64);

  // Helper: Draw organic continent blob using bezier control points
  const drawContinentBlob = (
    cCtx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    numPoints: number,
    irregularity: number
  ) => {
    cCtx.beginPath();
    const points: [number, number][] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rVariance = 1 + (rand() - 0.5) * irregularity;
      const px = cx + Math.cos(angle) * radiusX * rVariance;
      const py = cy + Math.sin(angle) * radiusY * rVariance;
      points.push([px, py]);
    }

    cCtx.moveTo((points[0][0] + points[points.length - 1][0]) / 2, (points[0][1] + points[points.length - 1][1]) / 2);
    for (let i = 0; i < points.length; i++) {
      const next = points[(i + 1) % points.length];
      const midX = (points[i][0] + next[0]) / 2;
      const midY = (points[i][1] + next[1]) / 2;
      cCtx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
    }
    cCtx.closePath();
    cCtx.fill();
  };

  if (visualClass === 'lush_green') {
    // -----------------------------------------------------------------
    // 1. TERRA / LUSH GREEN: Royal Blue Oceans, Turquoise Coastal Reefs,
    // Sandy Beaches, Emerald/Olive Continents, Snow Peaks, Polar Ice
    // -----------------------------------------------------------------

    // 1.1 Ocean Base (Color, Roughness, Height)
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#0a3875');
    oceanGrad.addColorStop(0.3, '#0d47a1');
    oceanGrad.addColorStop(0.5, '#1565c0');
    oceanGrad.addColorStop(0.7, '#0d47a1');
    oceanGrad.addColorStop(1, '#0a3875');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Deep water roughness: ultra-smooth glossy (roughness ~0.03)
    roughCtx.fillStyle = '#080808';
    roughCtx.fillRect(0, 0, width, height);

    // Water height: flat 0
    dispCtx.fillStyle = '#000000';
    dispCtx.fillRect(0, 0, width, height);

    // Ocean currents / stylized deeper ocean bands
    ctx.fillStyle = 'rgba(10, 40, 110, 0.45)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const cy = (0.2 + rand() * 0.6) * height;
      ctx.ellipse(rand() * width, cy, (0.15 + rand() * 0.25) * width, (0.05 + rand() * 0.08) * height, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1.2 Generate Continent Seeds
    const numContinents = 5 + Math.floor(rand() * 4);
    interface ContinentData {
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      subBlobs: { ox: number; oy: number; rx: number; ry: number }[];
    }
    const continents: ContinentData[] = [];

    for (let i = 0; i < numContinents; i++) {
      const cx = (0.1 + (i / numContinents) * 0.8 + (rand() - 0.5) * 0.15) * width;
      const cy = (0.25 + rand() * 0.5) * height;
      const rx = (0.08 + rand() * 0.12) * width;
      const ry = (0.1 + rand() * 0.16) * height;

      const subBlobs = [];
      const numSub = 3 + Math.floor(rand() * 5);
      for (let s = 0; s < numSub; s++) {
        subBlobs.push({
          ox: (rand() - 0.5) * rx * 1.3,
          oy: (rand() - 0.5) * ry * 1.3,
          rx: rx * (0.4 + rand() * 0.6),
          ry: ry * (0.4 + rand() * 0.6),
        });
      }
      continents.push({ cx, cy, rx, ry, subBlobs });
    }

    // 1.3 Turquoise Shallow Water / Coastal Shelf (The crisp cartoon water contour)
    ctx.fillStyle = '#00e5ff';
    for (const cont of continents) {
      drawContinentBlob(ctx, cont.cx, cont.cy, cont.rx * 1.32, cont.ry * 1.32, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(ctx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.32, sb.ry * 1.32, 12, 0.4);
      }
    }

    // 1.4 Golden Sand Beaches (Crisp shoreline border)
    ctx.fillStyle = '#ffe082';
    for (const cont of continents) {
      drawContinentBlob(ctx, cont.cx, cont.cy, cont.rx * 1.14, cont.ry * 1.14, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(ctx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.14, sb.ry * 1.14, 12, 0.4);
      }
    }

    // Roughness for beaches: medium (roughness ~0.4)
    roughCtx.fillStyle = '#666666';
    for (const cont of continents) {
      drawContinentBlob(roughCtx, cont.cx, cont.cy, cont.rx * 1.14, cont.ry * 1.14, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(roughCtx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.14, sb.ry * 1.14, 12, 0.4);
      }
    }

    // Displacement for beaches: slight step (height = 25)
    dispCtx.fillStyle = '#191919';
    for (const cont of continents) {
      drawContinentBlob(dispCtx, cont.cx, cont.cy, cont.rx * 1.14, cont.ry * 1.14, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(dispCtx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.14, sb.ry * 1.14, 12, 0.4);
      }
    }

    // 1.5 Emerald Green Continents (Lowland Grass)
    ctx.fillStyle = '#4caf50';
    for (const cont of continents) {
      drawContinentBlob(ctx, cont.cx, cont.cy, cont.rx * 1.05, cont.ry * 1.05, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(ctx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.05, sb.ry * 1.05, 12, 0.4);
      }
    }

    // Roughness for land: matte cartoon (roughness ~0.84)
    roughCtx.fillStyle = '#d5d5d5';
    for (const cont of continents) {
      drawContinentBlob(roughCtx, cont.cx, cont.cy, cont.rx * 1.05, cont.ry * 1.05, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(roughCtx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.05, sb.ry * 1.05, 12, 0.4);
      }
    }

    // Height for lowlands: height = 75
    dispCtx.fillStyle = '#4b4b4b';
    for (const cont of continents) {
      drawContinentBlob(dispCtx, cont.cx, cont.cy, cont.rx * 1.05, cont.ry * 1.05, 16, 0.45);
      for (const sb of cont.subBlobs) {
        drawContinentBlob(dispCtx, cont.cx + sb.ox, cont.cy + sb.oy, sb.rx * 1.05, sb.ry * 1.05, 12, 0.4);
      }
    }

    // 1.6 Deep Forest Green Patches
    ctx.fillStyle = '#2e7d32';
    for (const cont of continents) {
      drawContinentBlob(ctx, cont.cx + (rand() - 0.5) * cont.rx * 0.4, cont.cy + (rand() - 0.5) * cont.ry * 0.4, cont.rx * 0.65, cont.ry * 0.65, 14, 0.5);
    }

    // 1.7 Cartoon Mountain Ranges with Crisp Snow Peaks
    for (const cont of continents) {
      // Foothills (rich brown)
      ctx.fillStyle = '#795548';
      dispCtx.fillStyle = '#969696'; // height = 150
      drawContinentBlob(ctx, cont.cx, cont.cy, cont.rx * 0.45, cont.ry * 0.45, 12, 0.4);
      drawContinentBlob(dispCtx, cont.cx, cont.cy, cont.rx * 0.45, cont.ry * 0.45, 12, 0.4);

      // Peaks (white snow)
      ctx.fillStyle = '#ffffff';
      dispCtx.fillStyle = '#e0e0e0'; // height = 224
      drawContinentBlob(ctx, cont.cx, cont.cy, cont.rx * 0.22, cont.ry * 0.22, 10, 0.35);
      drawContinentBlob(dispCtx, cont.cx, cont.cy, cont.rx * 0.22, cont.ry * 0.22, 10, 0.35);
    }

    // 1.8 Polar Ice Caps (North & South)
    ctx.fillStyle = '#ffffff';
    dispCtx.fillStyle = '#707070';
    roughCtx.fillStyle = '#808080';
    // North pole
    ctx.beginPath();
    ctx.rect(0, 0, width, height * 0.08);
    ctx.fill();
    dispCtx.fillRect(0, 0, width, height * 0.08);
    roughCtx.fillRect(0, 0, width, height * 0.08);
    // South pole
    ctx.beginPath();
    ctx.rect(0, height * 0.92, width, height * 0.08);
    ctx.fill();
    dispCtx.fillRect(0, height * 0.92, width, height * 0.08);
    roughCtx.fillRect(0, height * 0.92, width, height * 0.08);

    // Scalloped ice fringe
    ctx.fillStyle = '#e1f5fe';
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.arc(x, height * 0.08, 35, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, height * 0.92, 35, Math.PI, Math.PI * 2);
      ctx.fill();
    }

  } else if (visualClass === 'desert') {
    // -----------------------------------------------------------------
    // 2. AURELIA / DESERT: Golden Sand Dunes, Terracotta Canyons,
    // Sapphire Oasis Lakes with Palm Shores
    // -----------------------------------------------------------------

    // Base: Golden Desert Dunes
    const desertGrad = ctx.createLinearGradient(0, 0, 0, height);
    desertGrad.addColorStop(0, '#f4a261');
    desertGrad.addColorStop(0.5, '#e76f51');
    desertGrad.addColorStop(1, '#f4a261');
    ctx.fillStyle = desertGrad;
    ctx.fillRect(0, 0, width, height);

    roughCtx.fillStyle = '#dcdcdc'; // Matte sand
    roughCtx.fillRect(0, 0, width, height);

    dispCtx.fillStyle = '#505050'; // Base dune height = 80
    dispCtx.fillRect(0, 0, width, height);

    // Dune ridges / stylized contours
    ctx.fillStyle = '#e59866';
    dispCtx.fillStyle = '#646464';
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      const cy = (0.1 + rand() * 0.8) * height;
      ctx.ellipse(rand() * width, cy, (0.1 + rand() * 0.2) * width, (0.015 + rand() * 0.03) * height, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Terracotta Canyons & Red Rock Mesas
    ctx.fillStyle = '#b71c1c';
    dispCtx.fillStyle = '#a0a0a0'; // Canyon rim height = 160
    for (let i = 0; i < 7; i++) {
      const cx = rand() * width;
      const cy = (0.2 + rand() * 0.6) * height;
      drawContinentBlob(ctx, cx, cy, (0.06 + rand() * 0.08) * width, (0.06 + rand() * 0.08) * height, 12, 0.4);
      drawContinentBlob(dispCtx, cx, cy, (0.06 + rand() * 0.08) * width, (0.06 + rand() * 0.08) * height, 12, 0.4);
    }

    // Sapphire Oasis Lakes with lush palm shores
    const numOases = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < numOases; i++) {
      const cx = (0.15 + (i / numOases) * 0.7 + (rand() - 0.5) * 0.1) * width;
      const cy = (0.3 + rand() * 0.4) * height;
      const rx = (0.035 + rand() * 0.04) * width;
      const ry = (0.03 + rand() * 0.035) * height;

      // Lush palm border
      ctx.fillStyle = '#2e7d32';
      drawContinentBlob(ctx, cx, cy, rx * 1.5, ry * 1.5, 12, 0.3);

      // Turquoise shallow oasis edge
      ctx.fillStyle = '#00e5ff';
      drawContinentBlob(ctx, cx, cy, rx * 1.2, ry * 1.2, 10, 0.25);

      // Deep sapphire oasis water
      ctx.fillStyle = '#0288d1';
      drawContinentBlob(ctx, cx, cy, rx, ry, 10, 0.2);

      // Oasis water is ultra-glossy
      roughCtx.fillStyle = '#080808';
      drawContinentBlob(roughCtx, cx, cy, rx * 1.2, ry * 1.2, 10, 0.25);

      // Oasis water is flat level 0
      dispCtx.fillStyle = '#000000';
      drawContinentBlob(dispCtx, cx, cy, rx * 1.2, ry * 1.2, 10, 0.25);
    }

  } else if (visualClass === 'volcanic') {
    // -----------------------------------------------------------------
    // 3. PYROS / VOLCANIC: Charcoal Obsidian Crags, Glowing Magma Seas,
    // Branching Lava Veins
    // -----------------------------------------------------------------

    // Base: Glowing Molten Lava Sea
    const lavaGrad = ctx.createLinearGradient(0, 0, width, height);
    lavaGrad.addColorStop(0, '#ff3d00');
    lavaGrad.addColorStop(0.5, '#ff9100');
    lavaGrad.addColorStop(1, '#ff3d00');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, width, height);

    // Liquid lava is shiny glossy!
    roughCtx.fillStyle = '#080808';
    roughCtx.fillRect(0, 0, width, height);

    // Lava ocean is flat 0
    dispCtx.fillStyle = '#000000';
    dispCtx.fillRect(0, 0, width, height);

    // Charcoal Obsidian Continents
    const numPlates = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < numPlates; i++) {
      const cx = (0.1 + (i / numPlates) * 0.8 + (rand() - 0.5) * 0.1) * width;
      const cy = (0.2 + rand() * 0.6) * height;
      const rx = (0.07 + rand() * 0.1) * width;
      const ry = (0.08 + rand() * 0.12) * height;

      // Smoldering crust border
      ctx.fillStyle = '#37474f';
      drawContinentBlob(ctx, cx, cy, rx * 1.1, ry * 1.1, 14, 0.4);

      // Solid charcoal obsidian rock
      ctx.fillStyle = '#1e1e24';
      drawContinentBlob(ctx, cx, cy, rx, ry, 14, 0.4);

      // Rock is matte
      roughCtx.fillStyle = '#dcdcdc';
      drawContinentBlob(roughCtx, cx, cy, rx, ry, 14, 0.4);

      // Obsidian plate height = 120
      dispCtx.fillStyle = '#787878';
      drawContinentBlob(dispCtx, cx, cy, rx, ry, 14, 0.4);

      // Volcanic peak caldera
      ctx.fillStyle = '#ff6d00';
      dispCtx.fillStyle = '#b0b0b0'; // Peak = 176
      drawContinentBlob(ctx, cx, cy, rx * 0.35, ry * 0.35, 10, 0.3);
      drawContinentBlob(dispCtx, cx, cy, rx * 0.35, ry * 0.35, 10, 0.3);

      // Glowing central caldera eye
      ctx.fillStyle = '#ffea00';
      drawContinentBlob(ctx, cx, cy, rx * 0.15, ry * 0.15, 8, 0.2);
    }

    // Glowing Lava Veins cutting across obsidian
    ctx.strokeStyle = '#ffab00';
    ctx.lineWidth = 4;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let vx = rand() * width;
      let vy = rand() * height;
      ctx.moveTo(vx, vy);
      for (let s = 0; s < 5; s++) {
        vx += (rand() - 0.5) * 140;
        vy += (rand() - 0.5) * 140;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }

  } else if (visualClass === 'ice') {
    // -----------------------------------------------------------------
    // 4. GLACIES / ICE: Deep Violet-Cyan Frozen Sea, Pack-Ice Continents,
    // Aquamarine Crevasses, Crisp Snow Caps
    // -----------------------------------------------------------------

    // Base: Deep Frozen Sea
    const iceSeaGrad = ctx.createLinearGradient(0, 0, 0, height);
    iceSeaGrad.addColorStop(0, '#006064');
    iceSeaGrad.addColorStop(0.5, '#00838f');
    iceSeaGrad.addColorStop(1, '#006064');
    ctx.fillStyle = iceSeaGrad;
    ctx.fillRect(0, 0, width, height);

    // Frozen sea is glossy ice (roughness ~0.08)
    roughCtx.fillStyle = '#141414';
    roughCtx.fillRect(0, 0, width, height);

    dispCtx.fillStyle = '#000000';
    dispCtx.fillRect(0, 0, width, height);

    // Pack-Ice Continents
    const numIceSheets = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < numIceSheets; i++) {
      const cx = (0.1 + (i / numIceSheets) * 0.8 + (rand() - 0.5) * 0.1) * width;
      const cy = (0.2 + rand() * 0.6) * height;
      const rx = (0.08 + rand() * 0.12) * width;
      const ry = (0.09 + rand() * 0.14) * height;

      // Cyan shallow shelf
      ctx.fillStyle = '#00e5ff';
      drawContinentBlob(ctx, cx, cy, rx * 1.25, ry * 1.25, 14, 0.4);

      // Crystalline pack ice
      ctx.fillStyle = '#b2ebf2';
      drawContinentBlob(ctx, cx, cy, rx * 1.1, ry * 1.1, 14, 0.4);

      // Snow-capped interior
      ctx.fillStyle = '#ffffff';
      drawContinentBlob(ctx, cx, cy, rx * 0.9, ry * 0.9, 14, 0.4);

      // Ice sheet roughness
      roughCtx.fillStyle = '#505050';
      drawContinentBlob(roughCtx, cx, cy, rx * 1.1, ry * 1.1, 14, 0.4);

      // Ice height = 110
      dispCtx.fillStyle = '#6e6e6e';
      drawContinentBlob(dispCtx, cx, cy, rx * 1.1, ry * 1.1, 14, 0.4);
    }

    // Vast Polar Glaciers
    ctx.fillStyle = '#ffffff';
    dispCtx.fillStyle = '#909090';
    ctx.fillRect(0, 0, width, height * 0.18);
    ctx.fillRect(0, height * 0.82, width, height * 0.18);
    dispCtx.fillRect(0, 0, width, height * 0.18);
    dispCtx.fillRect(0, height * 0.82, width, height * 0.18);

  } else if (visualClass === 'red') {
    // -----------------------------------------------------------------
    // 5. KHOR / RED BADLANDS: Martian Rust Canyons, Copper Plateaus,
    // Dark Basalt Silt Plains
    // -----------------------------------------------------------------

    const redGrad = ctx.createLinearGradient(0, 0, 0, height);
    redGrad.addColorStop(0, '#c0392b');
    redGrad.addColorStop(0.5, '#d35400');
    redGrad.addColorStop(1, '#c0392b');
    ctx.fillStyle = redGrad;
    ctx.fillRect(0, 0, width, height);

    roughCtx.fillStyle = '#d0d0d0';
    roughCtx.fillRect(0, 0, width, height);

    dispCtx.fillStyle = '#505050';
    dispCtx.fillRect(0, 0, width, height);

    // Deep Dark Basalt Canyons
    ctx.fillStyle = '#3e2723';
    dispCtx.fillStyle = '#1e1e1e';
    for (let i = 0; i < 8; i++) {
      const cx = rand() * width;
      const cy = (0.2 + rand() * 0.6) * height;
      drawContinentBlob(ctx, cx, cy, (0.06 + rand() * 0.08) * width, (0.03 + rand() * 0.05) * height, 12, 0.5);
      drawContinentBlob(dispCtx, cx, cy, (0.06 + rand() * 0.08) * width, (0.03 + rand() * 0.05) * height, 12, 0.5);
    }

    // Elevated Copper Plateaus
    ctx.fillStyle = '#f39c12';
    dispCtx.fillStyle = '#969696';
    for (let i = 0; i < 7; i++) {
      const cx = rand() * width;
      const cy = (0.2 + rand() * 0.6) * height;
      drawContinentBlob(ctx, cx, cy, (0.08 + rand() * 0.1) * width, (0.06 + rand() * 0.09) * height, 10, 0.35);
      drawContinentBlob(dispCtx, cx, cy, (0.08 + rand() * 0.1) * width, (0.06 + rand() * 0.09) * height, 10, 0.35);
    }

    // Polar Dry Ice Frost
    ctx.fillStyle = '#ffebee';
    ctx.fillRect(0, 0, width, height * 0.06);
    ctx.fillRect(0, height * 0.94, width, height * 0.06);

  } else if (visualClass === 'gas_giant') {
    // -----------------------------------------------------------------
    // 6. TITANIS / GAS GIANT: Banded Silk Atmosphere & Great Cartoon Storm
    // -----------------------------------------------------------------

    const bands = [
      { color: '#ffe082', y: 0.0 },
      { color: '#ffb74d', y: 0.12 },
      { color: '#b2ebf2', y: 0.25 },
      { color: '#ffcc80', y: 0.38 },
      { color: '#d7ccc8', y: 0.5 },
      { color: '#ffab91', y: 0.62 },
      { color: '#80deea', y: 0.75 },
      { color: '#ffe082', y: 0.88 },
      { color: '#ffb74d', y: 1.0 },
    ];

    const gasGrad = ctx.createLinearGradient(0, 0, 0, height);
    for (const b of bands) {
      gasGrad.addColorStop(b.y, b.color);
    }
    ctx.fillStyle = gasGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric wave distortion
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const by = (i / 12) * height;
      ctx.ellipse(rand() * width, by, width * 0.6, height * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Great Cartoon Storm Vortex
    const stormX = width * 0.62;
    const stormY = height * 0.58;
    const sGrad = ctx.createRadialGradient(stormX, stormY, 10, stormX, stormY, height * 0.14);
    sGrad.addColorStop(0, '#ffffff');
    sGrad.addColorStop(0.35, '#ff7043');
    sGrad.addColorStop(0.8, '#d84315');
    sGrad.addColorStop(1, 'rgba(216, 67, 21, 0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.ellipse(stormX, stormY, width * 0.11, height * 0.07, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Uniform atmospheric velvet roughness
    roughCtx.fillStyle = '#a0a0a0';
    roughCtx.fillRect(0, 0, width, height);

    // Smooth gas surface: flat 128
    dispCtx.fillStyle = '#808080';
    dispCtx.fillRect(0, 0, width, height);

  } else if (visualClass === 'dry_arid') {
    // -----------------------------------------------------------------
    // 7. ARIDIA / DRY ARID: Warm Ochre Steppes, Sandstone Tablelands,
    // Cracked Clay Flats, Ancient Dry Riverbeds
    // -----------------------------------------------------------------
    const aridGrad = ctx.createLinearGradient(0, 0, 0, height);
    aridGrad.addColorStop(0, '#cda077');
    aridGrad.addColorStop(0.5, '#dda15e');
    aridGrad.addColorStop(1, '#cda077');
    ctx.fillStyle = aridGrad;
    ctx.fillRect(0, 0, width, height);

    roughCtx.fillStyle = '#cccccc';
    roughCtx.fillRect(0, 0, width, height);

    dispCtx.fillStyle = '#484848';
    dispCtx.fillRect(0, 0, width, height);

    // Dried cracked ancient riverbeds
    ctx.strokeStyle = '#8c5936';
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let vx = rand() * width;
      let vy = (0.15 + rand() * 0.7) * height;
      ctx.moveTo(vx, vy);
      for (let s = 0; s < 6; s++) {
        vx += (rand() - 0.5) * 120;
        vy += (rand() - 0.5) * 60;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }

    // Sandstone Tablelands
    const numMesas = 8 + Math.floor(rand() * 4);
    for (let i = 0; i < numMesas; i++) {
      const cx = (0.1 + (i / numMesas) * 0.8 + (rand() - 0.5) * 0.1) * width;
      const cy = (0.2 + rand() * 0.6) * height;
      const rx = (0.07 + rand() * 0.1) * width;
      const ry = (0.05 + rand() * 0.08) * height;

      // Tableland base
      ctx.fillStyle = '#b07d62';
      dispCtx.fillStyle = '#808080';
      drawContinentBlob(ctx, cx, cy, rx, ry, 12, 0.35);
      drawContinentBlob(dispCtx, cx, cy, rx, ry, 12, 0.35);

      // Elevated mesa cap
      ctx.fillStyle = '#bc6c25';
      dispCtx.fillStyle = '#b8b8b8';
      drawContinentBlob(ctx, cx, cy, rx * 0.6, ry * 0.6, 10, 0.3);
      drawContinentBlob(dispCtx, cx, cy, rx * 0.6, ry * 0.6, 10, 0.3);
    }

    // Salt flats / bleached dried lakebeds
    const numFlats = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < numFlats; i++) {
      const cx = rand() * width;
      const cy = (0.25 + rand() * 0.5) * height;
      const rx = (0.04 + rand() * 0.05) * width;
      const ry = (0.025 + rand() * 0.035) * height;

      ctx.fillStyle = '#fefae0';
      dispCtx.fillStyle = '#303030';
      drawContinentBlob(ctx, cx, cy, rx, ry, 10, 0.25);
      drawContinentBlob(dispCtx, cx, cy, rx, ry, 10, 0.25);
    }

  } else {
    // -----------------------------------------------------------------
    // 8. ROCKY / SELENE (MOON): Cartoon Craters, Lunar Maria Basins
    // -----------------------------------------------------------------

    ctx.fillStyle = '#546e7a';
    ctx.fillRect(0, 0, width, height);

    roughCtx.fillStyle = '#d0d0d0';
    roughCtx.fillRect(0, 0, width, height);

    dispCtx.fillStyle = '#505050';
    dispCtx.fillRect(0, 0, width, height);

    // Dark Basalt Lunar Maria
    ctx.fillStyle = '#263238';
    dispCtx.fillStyle = '#282828';
    for (let i = 0; i < 5; i++) {
      const cx = (0.15 + (i / 5) * 0.7) * width;
      const cy = (0.25 + rand() * 0.5) * height;
      drawContinentBlob(ctx, cx, cy, (0.08 + rand() * 0.1) * width, (0.08 + rand() * 0.1) * height, 12, 0.4);
      drawContinentBlob(dispCtx, cx, cy, (0.08 + rand() * 0.1) * width, (0.08 + rand() * 0.1) * height, 12, 0.4);
    }

    // Impact Craters with crisp white rims
    const numCraters = 24 + Math.floor(rand() * 12);
    for (let i = 0; i < numCraters; i++) {
      const cx = rand() * width;
      const cy = (0.1 + rand() * 0.8) * height;
      const r = (0.015 + rand() * 0.035) * height;

      // Outer rim highlight
      ctx.fillStyle = '#eceff1';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      dispCtx.fillStyle = '#b0b0b0'; // Rim height = 176
      dispCtx.beginPath();
      dispCtx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      dispCtx.fill();

      // Inner crater pit
      ctx.fillStyle = '#37474f';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      dispCtx.fillStyle = '#1e1e1e'; // Pit height = 30
      dispCtx.beginPath();
      dispCtx.arc(cx, cy, r, 0, Math.PI * 2);
      dispCtx.fill();
    }
  }

  // Extract heightBuffer from dispCanvas for ultra-fast isLand and getElevation queries
  const dispImg = dispCtx.getImageData(0, 0, width, height);
  const heightBuffer = dispImg.data;

  // Create Three.js Textures
  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  configureTexture(colorTexture, true, false);

  const dispTexture = new THREE.CanvasTexture(dispCanvas);
  configureTexture(dispTexture, false, false);

  const roughTexture = new THREE.CanvasTexture(roughCanvas);
  configureTexture(roughTexture, false, false);

  const detailTexture = new THREE.CanvasTexture(detailCanvas);
  configureTexture(detailTexture, false, true);

  const result: StylizedPlanetTextures = {
    colorCanvas,
    dispCanvas,
    roughCanvas,
    detailCanvas,
    colorTexture,
    dispTexture,
    roughTexture,
    detailTexture,
    heightBuffer,
    width,
    height,
  };

  textureCache.set(cacheKey, result);
  return result;
}
