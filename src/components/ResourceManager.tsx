import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GeographyManager } from '../services/geography';
import { gameManager, ResourceNode } from '../services/gameManager';

interface ResourceManagerProps {
  planetRadius: number;
  isMobile?: boolean;
  geographyManager: GeographyManager;
}

function CommonResource({ scale = 0.15, isMobile = false }: { scale?: number; isMobile?: boolean }) {
  return (
    <group scale={scale}>
      <mesh castShadow>
        <octahedronGeometry args={[1, isMobile ? 0 : 1]} />
        <meshStandardMaterial color="#c08457" roughness={0.8} metalness={0.08} />
      </mesh>
    </group>
  );
}

function RareResource({ scale = 0.12, isMobile = false }: { scale?: number; isMobile?: boolean }) {
  return (
    <group scale={scale}>
      <mesh castShadow>
        <icosahedronGeometry args={[1, isMobile ? 0 : 1]} />
        <meshStandardMaterial color="#67e8f9" emissive="#155e75" emissiveIntensity={0.55} roughness={0.35} metalness={0.35} />
      </mesh>
    </group>
  );
}

function Resource({ data, isMobile = false }: { data: ResourceNode; isMobile?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const isCommon = data.type === 'common';
  const scale = isCommon ? 0.15 : 0.12;

  useEffect(() => {
    if (!groupRef.current) return;
    const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    const normal = pos.clone().normalize();
    groupRef.current.position.copy(pos);
    groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [data.position.x, data.position.y, data.position.z]);

  useFrame((state) => {
    if (!groupRef.current || !meshRef.current) return;
    const dist = camera.position.distanceTo(groupRef.current.position);
    const maxDist = isMobile ? 10 : 15;
    groupRef.current.visible = dist <= maxDist;
    if (groupRef.current.visible) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 + data.id.length) * 0.05 + 0.1;
      meshRef.current.rotation.y += 0.02;
      meshRef.current.rotation.x += 0.01;
    }
  });

  if (!data.active) return null;

  return (
    <group ref={groupRef}>
      <group ref={meshRef} userData={{ isResource: true, resourceId: data.id }}>
        {isCommon ? <CommonResource scale={scale} isMobile={isMobile} /> : <RareResource scale={scale} isMobile={isMobile} />}
      </group>
    </group>
  );
}

export function ResourceManager({ planetRadius, isMobile = false, geographyManager }: ResourceManagerProps) {
  const [remoteResources, setRemoteResources] = useState<ResourceNode[]>([]);

  useEffect(() => {
    const updateResources = (newResources: ResourceNode[]) => setRemoteResources(newResources);
    gameManager.onResourcesUpdate = updateResources;
    updateResources(gameManager.resources);
    return () => {
      gameManager.onResourcesUpdate = null;
    };
  }, []);

  const resources = useMemo(() => {
    const deterministic = geographyManager.generateDeterministicResources(planetRadius, isMobile ? 0.45 : 0.65);
    const remoteMap = new Map<string, ResourceNode>(remoteResources.map((r) => [r.id, r] as [string, ResourceNode]));

    return deterministic.map((item) => {
      const remote = remoteMap.get(item.id);
      return {
        id: item.id,
        type: item.type,
        position: remote?.position ?? { x: item.position.x, y: item.position.y, z: item.position.z },
        active: remote?.active ?? true,
        createdAt: remote?.createdAt ?? 'deterministic',
      } satisfies ResourceNode;
    });
  }, [geographyManager, planetRadius, isMobile, remoteResources]);

  return (
    <group>
      {resources.map((res) => (
        <Resource key={res.id} data={res} isMobile={isMobile} />
      ))}
    </group>
  );
}
