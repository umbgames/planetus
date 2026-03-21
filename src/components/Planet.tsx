import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { ResourceManager } from './ResourceManager';
import { GeographyManager } from '../services/geography';

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
  textureDetail = 'standard',
  visualClass = 'rocky',
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);
  const segments = useMemo(() => (isMobile ? 30 : 46), [isMobile]);
  const [geographyManager] = useState(() => new GeographyManager());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      geographyManager.setSeed(seed, noiseScale, landThreshold, textureDetail, visualClass);
      await geographyManager.initializeTopicRegions();
      if (cancelled) return;
      setTexture(geographyManager.texture ?? null);
      setDisplacementMap(geographyManager.displacementMap ?? null);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [geographyManager, seed, noiseScale, landThreshold, textureDetail, visualClass]);

  const atmosphereSegments = useMemo(() => (isMobile ? 16 : 20), [isMobile]);

  return (
    <group>
      <mesh ref={planetRef} frustumCulled>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial
          map={texture}
          displacementMap={displacementMap}
          displacementScale={isMobile ? 0.18 : 0.26}
          bumpMap={displacementMap}
          bumpScale={isMobile ? 0.025 : 0.04}
          roughness={1}
          metalness={0}
          flatShading
        />
      </mesh>

      <mesh frustumCulled>
        <sphereGeometry args={[radius * 1.12, atmosphereSegments, atmosphereSegments]} />
        <meshBasicMaterial color="#5e93ff" transparent opacity={0.08} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <BaseManager planetRadius={radius} geographyManager={geographyManager} />
      <ResourceManager planetRadius={radius} isMobile={isMobile} geographyManager={geographyManager} />
    </group>
  );
});
