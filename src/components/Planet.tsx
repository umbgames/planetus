import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';


const ATMOSPHERE_PALETTE: Record<'rocky' | 'dry_arid' | 'desert' | 'red', { inner: string; outer: string }> = {
  rocky: { inner: '#7ab8ff', outer: '#4b8dff' },
  dry_arid: { inner: '#8ec5ff', outer: '#66a7ff' },
  desert: { inner: '#ffbf7d', outer: '#ff8f5d' },
  red: { inner: '#ff8a7a', outer: '#ff5f62' },
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
            float alpha = fresnel * opacity;
            gl_FragColor = vec4(glowColor * fresnel, alpha);
          }
        `}
        toneMapped={false}
      />
    </mesh>
  );
}

interface PlanetProps {
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
  visualClass?: 'rocky' | 'dry_arid' | 'desert' | 'red';
}

export const Planet = memo(function Planet({
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
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const atmosphereInnerRef = useRef<THREE.Group>(null);
  const atmosphereOuterRef = useRef<THREE.Group>(null);
  const cloudLayer1Ref = useRef<THREE.Mesh>(null);
  const cloudLayer2Ref = useRef<THREE.Mesh>(null);
  const cloudLayer3Ref = useRef<THREE.Mesh>(null);

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);
  const [geographyManager] = useState(() => new GeographyManager());
  const { gl } = useThree();

  const segments = useMemo(() => (isMobile ? 72 : 160), [isMobile]);
  const atmosphereSegments = useMemo(() => (isMobile ? 40 : 72), [isMobile]);
  const cloudSegments = useMemo(() => (isMobile ? 40 : 80), [isMobile]);
  const atmosphereColors = useMemo(() => ATMOSPHERE_PALETTE[visualClass], [visualClass]);

  const cloudTextureSize = isMobile ? 512 : 1024;

  const createCloudTexture = (size: number, density: number, variant: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      fallback.colorSpace = THREE.SRGBColorSpace;
      return fallback;
    }

    ctx.clearRect(0, 0, size, size);

    const seedBase = seed
      .split('')
      .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1 + variant * 7), 0);

    let randomState = seedBase % 2147483647;
    const rand = () => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    };

    const background = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.15, size * 0.5, size * 0.5, size * 0.72);
    background.addColorStop(0, 'rgba(255,255,255,0.02)');
    background.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);

    const clusterCount = Math.floor((isMobile ? 90 : 180) * density * (0.9 + variant * 0.12));
    for (let i = 0; i < clusterCount; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const clusterRadius = (size * (0.025 + rand() * 0.055)) * (0.85 + variant * 0.08);
      const puffs = 4 + Math.floor(rand() * 7);

      for (let j = 0; j < puffs; j++) {
        const angle = rand() * Math.PI * 2;
        const distance = rand() * clusterRadius * 0.85;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        const r = clusterRadius * (0.28 + rand() * 0.9);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
        const alpha = 0.05 + rand() * 0.15;
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
        gradient.addColorStop(0.45, `rgba(255,255,255,${alpha * 0.7})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const hazePasses = isMobile ? 2 : 3;
    for (let i = 0; i < hazePasses; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = size * (0.12 + rand() * 0.18);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(255,255,255,${0.025 + rand() * 0.03})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const cloudTexture = new THREE.CanvasTexture(canvas);
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.RepeatWrapping;
    cloudTexture.repeat.set(1 + variant * 0.06, 1 + variant * 0.04);
    cloudTexture.offset.set(variant * 0.017, variant * 0.011);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.generateMipmaps = true;
    cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
    cloudTexture.magFilter = THREE.LinearFilter;
    cloudTexture.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), isMobile ? 2 : 8);
    cloudTexture.needsUpdate = true;

    return cloudTexture;
  };

  const cloudTexture1 = useMemo(
    () => (showClouds ? createCloudTexture(cloudTextureSize, Math.max(0.3, Math.min(1, cloudDensity)), 1) : null),
    [showClouds, cloudTextureSize, cloudDensity, gl, isMobile, seed]
  );

  const cloudTexture2 = useMemo(
    () => (showClouds ? createCloudTexture(cloudTextureSize, Math.max(0.28, Math.min(1, cloudDensity * 0.9)), 2) : null),
    [showClouds, cloudTextureSize, cloudDensity, gl, isMobile, seed]
  );

  const cloudTexture3 = useMemo(
    () => (showClouds ? createCloudTexture(cloudTextureSize, Math.max(0.25, Math.min(1, cloudDensity * 0.82)), 3) : null),
    [showClouds, cloudTextureSize, cloudDensity, gl, isMobile, seed]
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
      map.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), isMobile ? 4 : 12);
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
      cloudTexture3?.dispose();
    };
  }, [cloudTexture1, cloudTexture2, cloudTexture3]);

  const displacementScale = useMemo(() => {
    const base = isMobile ? 0.06 : 0.095;
    const detailBoost = textureDetail === 'enhanced' ? 1.08 : 1;
    return radius * base * detailBoost;
  }, [isMobile, textureDetail, radius]);

  const bumpScale = useMemo(() => {
    const base = isMobile ? 0.012 : 0.018;
    return radius * base;
  }, [isMobile, radius]);

  const baseCloudRotation = useMemo(() => serverTime * 0.00006, [serverTime]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.035;
    }

    if (atmosphereInnerRef.current) {
      atmosphereInnerRef.current.rotation.y = t * 0.01;
      atmosphereInnerRef.current.rotation.z = Math.sin(t * 0.12) * 0.01;
    }

    if (atmosphereOuterRef.current) {
      atmosphereOuterRef.current.rotation.y = -t * 0.006;
      atmosphereOuterRef.current.rotation.x = Math.cos(t * 0.08) * 0.008;
    }

    const speedFactor = cloudSpeed * cloudRotationSpeed;

    if (cloudLayer1Ref.current) {
      cloudLayer1Ref.current.rotation.y = baseCloudRotation + t * 0.022 * speedFactor;
      cloudLayer1Ref.current.rotation.z = Math.sin(t * 0.08) * 0.01;
    }

    if (cloudLayer2Ref.current) {
      cloudLayer2Ref.current.rotation.y = -baseCloudRotation * 0.65 + t * 0.015 * speedFactor;
      cloudLayer2Ref.current.rotation.x = 0.06 + Math.cos(t * 0.07) * 0.01;
      cloudLayer2Ref.current.rotation.z = 0.02;
    }

    if (cloudLayer3Ref.current) {
      cloudLayer3Ref.current.rotation.y = baseCloudRotation * 1.2 + t * 0.03 * speedFactor;
      cloudLayer3Ref.current.rotation.x = -0.045;
      cloudLayer3Ref.current.rotation.z = Math.sin(t * 0.06) * 0.012;
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
          displacementBias={-displacementScale * 0.18}
          bumpMap={displacementMap}
          bumpScale={bumpScale}
          roughness={0.78}
          metalness={0.02}
          envMapIntensity={0.55}
          flatShading={false}
          dithering
          toneMapped
        />
      </mesh>

      <group ref={atmosphereInnerRef}>
        <FresnelAtmosphereShell
          radius={radius}
          color={atmosphereColors.inner}
          opacity={0.38}
          power={2.9}
          width={1.04}
          segments={atmosphereSegments}
        />
      </group>

      <group ref={atmosphereOuterRef}>
        <FresnelAtmosphereShell
          radius={radius}
          color={atmosphereColors.outer}
          opacity={0.22}
          power={3.8}
          width={1.09}
          segments={atmosphereSegments}
        />
      </group>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.014, atmosphereSegments, atmosphereSegments]} />
        <meshBasicMaterial
          color={atmosphereColors.inner}
          transparent
          opacity={0.035}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {showClouds && cloudTexture1 && cloudTexture2 && cloudTexture3 && (
        <>
          <mesh ref={cloudLayer1Ref} frustumCulled>
            <sphereGeometry args={[radius * 1.018, cloudSegments, cloudSegments]} />
            <meshStandardMaterial
              map={cloudTexture1}
              transparent
              opacity={0.26}
              alphaMap={cloudTexture1}
              roughness={0.95}
              metalness={0}
              depthWrite={false}
              blending={THREE.NormalBlending}
              dithering
            />
          </mesh>

          <mesh ref={cloudLayer2Ref} frustumCulled>
            <sphereGeometry args={[radius * 1.029, cloudSegments, cloudSegments]} />
            <meshStandardMaterial
              map={cloudTexture2}
              transparent
              opacity={0.18}
              alphaMap={cloudTexture2}
              roughness={0.9}
              metalness={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              dithering
            />
          </mesh>

          <mesh ref={cloudLayer3Ref} frustumCulled>
            <sphereGeometry args={[radius * 1.042, cloudSegments, cloudSegments]} />
            <meshStandardMaterial
              map={cloudTexture3}
              transparent
              opacity={0.12}
              alphaMap={cloudTexture3}
              roughness={0.92}
              metalness={0}
              depthWrite={false}
              blending={THREE.NormalBlending}
              dithering
            />
          </mesh>
        </>
      )}

      <BaseManager planetRadius={radius} geographyManager={geographyManager} />
      <ResourceManager planetRadius={radius} isMobile={isMobile} geographyManager={geographyManager} />
    </group>
  );
});
