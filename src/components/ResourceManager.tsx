import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameManager, ResourceNode } from '../services/gameManager';

import { GeographyManager } from '../services/geography';
import { createPRNG, hashCombine } from '../utils/random';

interface ResourceManagerProps {
  planetRadius: number;
  isMobile?: boolean;
  geographyManager: GeographyManager;
}

function buildLocalDeterministicResources(geographyManager: GeographyManager, planetRadius: number): ResourceNode[] {
  geographyManager.initializeTopicRegions();
  const seed = geographyManager.getSeed();
  const commonCount = 56;
  const rareCount = 14;
  const out: ResourceNode[] = [];

  const spawnForZone = (type: 'common' | 'rare', count: number, zones: Array<'high' | 'mid' | 'low'>) => {
    const regions = geographyManager.regions.filter(r => zones.includes(r.resourceZone));
    if (!regions.length) return;
    const prng = createPRNG(hashCombine(seed, 'local-resources', type));
    let accepted = 0;
    let attempts = 0;
    while (accepted < count && attempts < count * 80) {
      attempts += 1;
      const region = regions[Math.floor(prng() * regions.length) % regions.length];
      const [x, y, z] = geographyManager.getRandomPointForTopic(region.id, planetRadius);
      const nx = x / planetRadius;
      const ny = y / planetRadius;
      const nz = z / planetRadius;
      const thresholdNoise = geographyManager.getTerrain(nx, ny, nz);
      const threshold = type === 'rare' ? 0.17 : 0.02;
      if (thresholdNoise < geographyManager.landThreshold + threshold) continue;
      const height = geographyManager.getHeightAtPoint(nx, ny, nz, planetRadius, 0.8);
      const snapped = new THREE.Vector3(nx, ny, nz).normalize().multiplyScalar(height);
      out.push({
        id: `local_${type}_${accepted}`,
        type,
        position: { x: snapped.x, y: snapped.y, z: snapped.z },
        active: true,
        createdAt: 'local',
      });
      accepted += 1;
    }
  };

  spawnForZone('common', commonCount, ['low', 'mid', 'high']);
  spawnForZone('rare', rareCount, ['high']);
  return out;
}

function CommonResource({ scale, isMobile }: { scale: number, isMobile: boolean }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.5, 0]} rotation={[0.1, 0.2, 0.1]}>
        <cylinderGeometry args={[0, 0.4, 1.5, isMobile ? 3 : 5]} />
        <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.4, 0.2, 0.3]} rotation={[0.4, 0.1, 0.5]}>
        <cylinderGeometry args={[0, 0.3, 1.0, isMobile ? 3 : 5]} />
        <meshStandardMaterial color="#10b981" emissive="#047857" emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[-0.3, 0.1, -0.2]} rotation={[-0.2, -0.4, -0.3]}>
        <cylinderGeometry args={[0, 0.35, 1.2, isMobile ? 3 : 5]} />
        <meshStandardMaterial color="#f97316" emissive="#c2410c" emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  );
}

function RareResource({ scale, isMobile }: { scale: number, isMobile: boolean }) {
  return (
    <group scale={scale * 1.5}>
      {/* Aetherium Core */}
      <mesh>
        <icosahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color="#d946ef" emissive="#c026d3" emissiveIntensity={1.5} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Ethereal Outer Shell */}
      {!isMobile && (
        <mesh>
          <icosahedronGeometry args={[0.9, 1]} />
          <meshStandardMaterial color="#a855f7" emissive="#9333ea" emissiveIntensity={0.5} wireframe={true} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

function Resource({ data, isMobile }: { data: ResourceNode, isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [lodLevel, setLodLevel] = useState<'full' | 'proxy' | 'hidden'>('full');
  
  const isCommon = data.type === 'common';
  const scale = isCommon ? 0.15 : 0.12;
  
  useEffect(() => {
    if (groupRef.current) {
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      const normal = pos.clone().normalize();
      
      groupRef.current.position.copy(pos);
      groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }
  }, [data.position]);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    
    // Calculate distance to camera for LOD
    const dist = camera.position.distanceTo(groupRef.current.position);
    const fullDist = isMobile ? 18 : 34;
    const proxyDist = isMobile ? 60 : 120;

    if (dist > proxyDist) {
      if (lodLevel !== 'hidden') setLodLevel('hidden');
      groupRef.current.visible = false;
    } else {
      groupRef.current.visible = true;
      const nextLod = dist > fullDist ? 'proxy' : 'full';
      if (nextLod !== lodLevel) setLodLevel(nextLod);
      // Floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 + data.id.length) * 0.05 + 0.1;
      meshRef.current.rotation.y += nextLod === 'proxy' ? 0.01 : 0.02;
      meshRef.current.rotation.x += nextLod === 'proxy' ? 0.005 : 0.01;
    }
  });

  if (!data.active) return null;

  return (
    <group ref={groupRef}>
      <group ref={meshRef} userData={{ isResource: true, resourceId: data.id }}>
        {lodLevel === 'proxy' ? (
          <mesh>
            <icosahedronGeometry args={[isCommon ? 0.16 : 0.22, 0]} />
            <meshStandardMaterial
              color={isCommon ? '#f59e0b' : '#d946ef'}
              emissive={isCommon ? '#b45309' : '#c026d3'}
              emissiveIntensity={isCommon ? 0.45 : 0.9}
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        ) : (
          isCommon ? <CommonResource scale={scale} isMobile={isMobile} /> : <RareResource scale={scale} isMobile={isMobile} />
        )}
      </group>
    </group>
  );
}

export function ResourceManager({ planetRadius, isMobile = false, geographyManager }: ResourceManagerProps) {
  const [resources, setResources] = useState<ResourceNode[]>([]);


  useEffect(() => {
    const localFallback = buildLocalDeterministicResources(geographyManager, planetRadius);

    const updateResources = (newResources: ResourceNode[]) => {
      const activeResources = newResources.filter(r => r.active);
      setResources(activeResources.length > 0 ? activeResources : localFallback);
    };

    gameManager.onResourcesUpdate = updateResources;
    updateResources(gameManager.resources);

    return () => {
      gameManager.onResourcesUpdate = null;
    };
  }, [geographyManager, planetRadius]);

  return (
    <group>
      {resources.map(res => (
        <Resource key={res.id} data={res} isMobile={isMobile} />
      ))}
    </group>
  );
}
