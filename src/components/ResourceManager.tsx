import React, { useEffect, useRef, useState, useMemo } from 'react';
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

function CommonResource({ scale, isMobile }: { scale: number; isMobile: boolean }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.5, 0]} rotation={[0.1, 0.2, 0.1]}>
        <cylinderGeometry args={[0, 0.45, 1.6, isMobile ? 4 : 6]} />
        <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[0.45, 0.2, 0.35]} rotation={[0.4, 0.1, 0.5]}>
        <cylinderGeometry args={[0, 0.35, 1.2, isMobile ? 4 : 6]} />
        <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[-0.35, 0.1, -0.25]} rotation={[-0.2, -0.4, -0.3]}>
        <cylinderGeometry args={[0, 0.38, 1.3, isMobile ? 4 : 6]} />
        <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
      </mesh>
    </group>
  );
}

function RareResource({ scale, isMobile }: { scale: number; isMobile: boolean }) {
  return (
    <group scale={scale * 1.5}>
      {/* Aetherium Core */}
      <mesh>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#d946ef" emissive="#c026d3" emissiveIntensity={1.4} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Ethereal Outer Shell */}
      {!isMobile && (
        <mesh>
          <icosahedronGeometry args={[1.05, 1]} />
          <meshStandardMaterial color="#c084fc" emissive="#9333ea" emissiveIntensity={0.6} wireframe={true} transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}

function Resource({ data, isMobile, geographyManager, planetRadius }: { data: ResourceNode; isMobile: boolean; geographyManager: GeographyManager; planetRadius: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [lodLevel, setLodLevel] = useState<'full' | 'proxy' | 'hidden'>('full');
  
  const camWorldPos = useMemo(() => new THREE.Vector3(), []);
  const nodeWorldPos = useMemo(() => new THREE.Vector3(), []);

  const isCommon = data.type === 'common';
  const scale = isCommon ? 0.32 : 0.28;
  
  useEffect(() => {
    if (groupRef.current) {
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      const normal = pos.clone().normalize();
      
      const displacementScale = planetRadius * 0.028;
      const height = geographyManager.getHeightAtPoint(pos.x, pos.y, pos.z, planetRadius, displacementScale);
      
      // Elevate slightly above terrain relief so crystals never clip underground
      const adjustedPos = normal.clone().multiplyScalar(height + 0.06);
      
      groupRef.current.position.copy(adjustedPos);
      groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    }
  }, [data.position, planetRadius, geographyManager]);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    
    // Calculate true 3D distance between camera and resource node in world space
    camera.getWorldPosition(camWorldPos);
    groupRef.current.getWorldPosition(nodeWorldPos);
    const dist = camWorldPos.distanceTo(nodeWorldPos);

    const fullDist = isMobile ? 35 : 75;
    const proxyDist = isMobile ? 200 : 380;

    if (dist > proxyDist) {
      if (lodLevel !== 'hidden') setLodLevel('hidden');
      groupRef.current.visible = false;
    } else {
      groupRef.current.visible = true;
      const nextLod = dist > fullDist ? 'proxy' : 'full';
      if (nextLod !== lodLevel) setLodLevel(nextLod);
      // Gentle floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5 + (data.position.x || 1)) * 0.04 + 0.08;
      meshRef.current.rotation.y += nextLod === 'proxy' ? 0.012 : 0.024;
      meshRef.current.rotation.x += nextLod === 'proxy' ? 0.006 : 0.012;
    }
  });

  if (!data.active) return null;

  return (
    <group ref={groupRef}>
      <group ref={meshRef} userData={{ isResource: true, resourceId: data.id }}>
        {lodLevel === 'proxy' ? (
          <mesh>
            <octahedronGeometry args={[isCommon ? 0.32 : 0.42, 0]} />
            <meshStandardMaterial
              color={isCommon ? '#f59e0b' : '#d946ef'}
              emissive={isCommon ? '#d97706' : '#c026d3'}
              emissiveIntensity={isCommon ? 0.9 : 1.5}
              roughness={0.25}
              metalness={0.8}
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
  const effectivePlanetId = planetId || 'alpha_centauri';

  useEffect(() => {
    const handleUpdate = (allResources: ResourceNode[]) => {
      const activeResources = allResources.filter(r => r.active && r.planetId === effectivePlanetId);
      setResources(activeResources);
    };

    gameManager.addResourceListener(handleUpdate);
    gameManager.ensurePlanetResources(
      effectivePlanetId,
      geographyManager.seed || effectivePlanetId,
      planetRadius,
      geographyManager
    );

    return () => {
      gameManager.removeResourceListener(handleUpdate);
    };
  }, [effectivePlanetId, planetRadius, geographyManager]);

  return (
    <group>
      {resources.map(res => (
        <Resource
          key={res.id}
          data={res}
          isMobile={isMobile}
          geographyManager={geographyManager}
          planetRadius={planetRadius}
        />
      ))}
    </group>
  );
}
