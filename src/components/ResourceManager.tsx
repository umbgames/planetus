import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameManager, ResourceNode } from '../services/gameManager';

import { GeographyManager } from '../services/geography';

interface ResourceManagerProps {
  planetRadius: number;
  isMobile?: boolean;
  geographyManager: GeographyManager;
  planetId?: string;
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

export function ResourceManager({ planetRadius, isMobile = false, geographyManager, planetId }: ResourceManagerProps) {
  const [resources, setResources] = useState<ResourceNode[]>([]);


  useEffect(() => {
    const updateResources = (newResources: ResourceNode[]) => {
      const activeResources = newResources.filter(r => r.active && r.planetId === (planetId || 'alpha_centauri'));
      setResources(activeResources);
    };

    gameManager.onResourcesUpdate = updateResources;
    updateResources(gameManager.resources);

    return () => {
      gameManager.onResourcesUpdate = null;
    };
  }, []);

  return (
    <group>
      {resources.map(res => (
        <Resource key={res.id} data={res} isMobile={isMobile} />
      ))}
    </group>
  );
}
