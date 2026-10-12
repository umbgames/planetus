import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';


type VisualClass = 'rocky' | 'dry_arid' | 'desert' | 'red' | 'volcanic' | 'lush_green' | 'ice' | 'gas_giant';

const ATMOSPHERE_PALETTE: Record<VisualClass, { inner: string; outer: string }> = {
  rocky: { inner: '#7ab8ff', outer: '#4b8dff' },
  dry_arid: { inner: '#8ec5ff', outer: '#66a7ff' },
  desert: { inner: '#ffbf7d', outer: '#ff8f5d' },
  red: { inner: '#ff8a7a', outer: '#ff5f62' },
  volcanic: { inner: '#ff7700', outer: '#cc3300' },
  lush_green: { inner: '#5cd6ff', outer: '#3b9cff' },
  ice: { inner: '#d0f8ff', outer: '#a3e8ff' },
  gas_giant: { inner: '#ffffff', outer: '#cccccc' },
};

function FresnelAtmosphereShell({
  radius,
  color,
  opacity,
  power,
  width,
  segments,
}: {
  radius: number;
  color: string;
  opacity: number;
  power: number;
  width: number;
  segments: number;
}) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      power: { value: power },
    }),
    [color, opacity, power]
  );

  return (
    <mesh frustumCulled>
      <sphereGeometry args={[radius * width, segments, segments]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormalW;
          varying vec3 vWorldPos;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 glowColor;
          uniform float opacity;
          uniform float power;
          varying vec3 vNormalW;
          varying vec3 vWorldPos;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), power);
            
            // Sun-facing factor: star is at origin, so light direction = -normalize(worldPos)
            vec3 sunDir = normalize(-vWorldPos);
            float sunFacing = dot(normalize(vNormalW), sunDir);
            // Smooth transition from lit to dark side
            float sunFactor = smoothstep(-0.15, 0.45, sunFacing);
            
            float alpha = fresnel * opacity * sunFactor;
            gl_FragColor = vec4(glowColor * fresnel * sunFactor, alpha);
          }
        `}
        toneMapped={false}
      />
    </mesh>
  );
}

interface PlanetProps {
  id?: string;
  radius: number;
  isMobile?: boolean;
  seed: string;
  noiseScale: number;
  landThreshold: number;
  showClouds?: boolean;
  serverTime?: number;
  cloudDensity?: number;
  cloudSpeed?: number;
  cloudRotationSpeed?: number;
  textureDetail?: 'standard' | 'enhanced';
  visualClass?: VisualClass;
  cloudColor?: string;
  isMoon?: boolean;
}

export const Planet = memo(function Planet({
  id,
  radius,
  isMobile = false,
  seed,
  noiseScale,
  landThreshold,
  showClouds = true,
  serverTime = 0,
  cloudDensity = 0.72,
  cloudSpeed = 1,
  cloudRotationSpeed = 1,
  textureDetail = 'standard',
  visualClass = 'rocky',
  cloudColor = '#ffffff',
  isMoon = false,
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const atmosphereInnerRef = useRef<THREE.Group>(null);
  const atmosphereOuterRef = useRef<THREE.Group>(null);
  const cloudLayer1Ref = useRef<THREE.Mesh>(null);
  const cloudLayer2Ref = useRef<THREE.Mesh>(null);
  const cloudLayer3Ref = useRef<THREE.Mesh>(null);

  const cachedData = useMemo(() => {
    return GeographyManager.getCached(seed, noiseScale, landThreshold, textureDetail, visualClass);
  }, [seed, noiseScale, landThreshold, textureDetail, visualClass]);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(() => cachedData?.texture ?? null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(() => cachedData?.displacementMap ?? null);
  const [geographyManager] = useState(() => {
    const mgr = new GeographyManager();
    mgr.setSeed(seed, noiseScale, landThreshold, textureDetail, visualClass);
    if (cachedData) {
      mgr.regions = cachedData.regions.map((r) => ({ ...r, center: r.center.clone(), color: r.color.clone() }));
      mgr.texture = cachedData.texture;
      mgr.displacementMap = cachedData.displacementMap;
      mgr.detailTexture = cachedData.detailTexture;
    }
    return mgr;
  });
  const { gl } = useThree();

  const segments = useMemo(() => (isMobile ? 72 : 160), [isMobile]);
  const atmosphereSegments = useMemo(() => (isMobile ? 40 : 72), [isMobile]);
  const cloudSegments = useMemo(() => (isMobile ? 40 : 80), [isMobile]);
  const atmosphereColors = useMemo(() => {
    if (visualClass === 'gas_giant' && cloudColor !== '#ffffff') {
      const gColor = new THREE.Color(cloudColor);
      return {
        inner: `#${gColor.getHexString()}`,
        outer: `#${gColor.clone().multiplyScalar(0.7).getHexString()}`,
      };
    }
    return ATMOSPHERE_PALETTE[visualClass];
  }, [visualClass, cloudColor]);

  const cloudTextureWidth = isMobile ? 512 : 1024;
  const cloudTextureHeight = isMobile ? 256 : 512;

  const createCloudTexture = (width: number, height: number, density: number, variant: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      fallback.colorSpace = THREE.SRGBColorSpace;
      return fallback;
    }

    ctx.clearRect(0, 0, width, height);

    const seedBase = seed
      .split('')
      .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1 + variant * 11), 0);

    let randomState = seedBase % 2147483647;
    const rand = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };

    // Draw soft, seamless organic cloud whorls with horizontal toroidal wrapping
    const bandCount = Math.floor((isMobile ? 28 : 55) * density);
    for (let i = 0; i < bandCount; i++) {
      const cy = (0.15 + rand() * 0.7) * height;
      const baseRx = (0.08 + rand() * 0.16) * width;
      const baseRy = (0.02 + rand() * 0.045) * height;
      const puffs = 3 + Math.floor(rand() * 4);
      const cx = rand() * width;

      // Polar attenuation factor to prevent pole pinching
      const latFactor = 1 - Math.pow(Math.abs((cy / height) - 0.5) * 2, 3);
      if (latFactor <= 0.05) continue;

      for (let j = 0; j < puffs; j++) {
        const ox = (rand() - 0.5) * baseRx * 1.2;
        const oy = (rand() - 0.5) * baseRy * 0.8;
        const px = (cx + ox + width) % width;
        const py = Math.max(10, Math.min(height - 10, cy + oy));
        const rx = baseRx * (0.4 + rand() * 0.6);
        const ry = baseRy * (0.5 + rand() * 0.5);

        // Draw puff and its wrap-around ghost for zero-seam equirectangular mapping
        for (const wrapOffset of [0, width, -width]) {
          const drawX = px + wrapOffset;
          if (drawX + rx < 0 || drawX - rx > width) continue;

          const grad = ctx.createRadialGradient(drawX, py, 0, drawX, py, rx);
          const alpha = (0.06 + rand() * 0.12) * latFactor;
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.6})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(drawX, py, rx, ry, (rand() - 0.5) * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const cloudTexture = new THREE.CanvasTexture(canvas);
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.generateMipmaps = true;
    cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
    cloudTexture.magFilter = THREE.LinearFilter;
    cloudTexture.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), isMobile ? 2 : 4);
    cloudTexture.needsUpdate = true;

    return cloudTexture;
  };

  const cloudTexture1 = useMemo(
    () => (showClouds && visualClass !== 'gas_giant' ? createCloudTexture(cloudTextureWidth, cloudTextureHeight, Math.max(0.3, Math.min(0.9, cloudDensity)), 1) : null),
    [showClouds, cloudTextureWidth, cloudTextureHeight, cloudDensity, gl, isMobile, seed, visualClass]
  );

  const cloudTexture2 = useMemo(
    () => (showClouds && visualClass !== 'gas_giant' ? createCloudTexture(cloudTextureWidth, cloudTextureHeight, Math.max(0.2, Math.min(0.7, cloudDensity * 0.75)), 2) : null),
    [showClouds, cloudTextureWidth, cloudTextureHeight, cloudDensity, gl, isMobile, seed, visualClass]
  );

  useEffect(() => {
    let cancelled = false;

    const configureMap = (map: THREE.Texture | null, isColorMap: boolean) => {
      if (!map) return;
      map.wrapS = THREE.ClampToEdgeWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.magFilter = THREE.LinearFilter;
      map.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), isMobile ? 4 : 8);
      if (isColorMap) {
        map.colorSpace = THREE.SRGBColorSpace;
      }
      map.needsUpdate = true;
    };

    const run = async () => {
      geographyManager.setSeed(seed, noiseScale, landThreshold, textureDetail, visualClass);
      await geographyManager.initializeTopicRegions();
      if (cancelled) return;

      const nextTexture = geographyManager.texture ?? null;
      const nextDisplacementMap = geographyManager.displacementMap ?? null;

      configureMap(nextTexture, true);
      configureMap(nextDisplacementMap, false);

      setTexture(nextTexture);
      setDisplacementMap(nextDisplacementMap);
      if (planetRef.current) {
        const mat = planetRef.current.material as THREE.MeshStandardMaterial;
        if (mat) mat.needsUpdate = true;
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [geographyManager, seed, noiseScale, landThreshold, textureDetail, visualClass, gl, isMobile]);

  useEffect(() => {
    return () => {
      cloudTexture1?.dispose();
      cloudTexture2?.dispose();
    };
  }, [cloudTexture1, cloudTexture2]);

  const displacementScale = useMemo(() => {
    if (isMoon) return radius * 0.004;
    if (visualClass === 'gas_giant') return 0;
    const base = 0.016;
    return radius * base;
  }, [radius, isMoon, visualClass]);

  const bumpScale = useMemo(() => {
    if (isMoon) return radius * 0.002;
    if (visualClass === 'gas_giant') return 0;
    return radius * 0.004;
  }, [radius, isMoon, visualClass]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Planet rotation is cleanly handled at group level in SolarSystemView to prevent desync with bases

    if (atmosphereInnerRef.current) {
      atmosphereInnerRef.current.rotation.y = t * 0.006;
    }

    if (atmosphereOuterRef.current) {
      atmosphereOuterRef.current.rotation.y = -t * 0.004;
    }

    const speedFactor = cloudSpeed * cloudRotationSpeed;

    if (cloudLayer1Ref.current) {
      cloudLayer1Ref.current.rotation.y += delta * 0.006 * speedFactor;
    }

    if (cloudLayer2Ref.current) {
      cloudLayer2Ref.current.rotation.y -= delta * 0.004 * speedFactor;
    }
  });

  return (
    <group>
      <mesh ref={planetRef} frustumCulled castShadow receiveShadow>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial
          map={texture}
          displacementMap={displacementMap}
          displacementScale={displacementScale}
          displacementBias={-displacementScale * 0.12}
          bumpMap={displacementMap}
          bumpScale={bumpScale}
          roughness={visualClass === 'gas_giant' ? 0.95 : 0.82}
          metalness={0.03}
          envMapIntensity={0.4}
          flatShading={false}
          dithering
          toneMapped
        />
      </mesh>

      <group ref={atmosphereInnerRef}>
        <FresnelAtmosphereShell
          radius={radius}
          color={atmosphereColors.inner}
          opacity={0.34}
          power={3.2}
          width={1.045}
          segments={atmosphereSegments}
        />
      </group>

      <group ref={atmosphereOuterRef}>
        <FresnelAtmosphereShell
          radius={radius}
          color={atmosphereColors.outer}
          opacity={0.18}
          power={4.2}
          width={1.09}
          segments={atmosphereSegments}
        />
      </group>

      {showClouds && cloudTexture1 && (
        <mesh ref={cloudLayer1Ref} frustumCulled>
          <sphereGeometry args={[radius * 1.018, cloudSegments, cloudSegments]} />
          <meshStandardMaterial
            map={cloudTexture1}
            color={cloudColor}
            transparent
            opacity={0.48}
            roughness={0.96}
            metalness={0}
            depthWrite={false}
            blending={THREE.NormalBlending}
            dithering
          />
        </mesh>
      )}

      {showClouds && cloudTexture2 && (
        <mesh ref={cloudLayer2Ref} frustumCulled>
          <sphereGeometry args={[radius * 1.028, cloudSegments, cloudSegments]} />
          <meshStandardMaterial
            map={cloudTexture2}
            color={cloudColor}
            transparent
            opacity={0.32}
            roughness={0.92}
            metalness={0}
            depthWrite={false}
            blending={THREE.NormalBlending}
            dithering
          />
        </mesh>
      )}

      <BaseManager planetRadius={radius} geographyManager={geographyManager} planetId={id} />
      <ResourceManager planetRadius={radius} isMobile={isMobile} geographyManager={geographyManager} planetId={id} />
    </group>
  );
});

