import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gameManager, ResourceNode } from '../services/gameManager';
import { GeographyManager } from '../services/geography';
import { createPRNG, cyrb128 } from '../utils/random';
import { createNoise3D } from 'simplex-noise';

interface ResourceManagerProps {
  planetRadius: number;
  isMobile?: boolean;
  geographyManager: GeographyManager;
  planetSeed?: string;
}

function hashString(str: string): string {
  const h = cyrb128(str);
  return h[0].toString(16) + h[1].toString(16) + h[2].toString(16) + h[3].toString(16);
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
  
  const isCommon = data.type === 'common';
  const scale = isCommon ? 0.08 : 0.065;
  
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
    const maxDist = isMobile ? 10 : 15;
    
    if (dist > maxDist) {
      groupRef.current.visible = false;
    } else {
      groupRef.current.visible = true;
      // Floating animation
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

export function ResourceManager({ planetRadius, isMobile = false, geographyManager, planetSeed = 'default_planet' }: ResourceManagerProps) {
  const [depletedResources, setDepletedResources] = useState<Set<string>>(new Set());

  const proceduralResources = useMemo(() => {
    const resources: ResourceNode[] = [];
    const commonSeed = hashString(planetSeed + '_common');
    const rareSeed = hashString(planetSeed + '_rare');
    
    const commonNoise = createNoise3D(createPRNG(commonSeed));
    const rareNoise = createNoise3D(createPRNG(rareSeed));

    // Generate points on a sphere using Fibonacci lattice for even distribution
    const samples = 1000;
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < samples; i++) {
      const y = 1 - (i / (samples - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      if (!geographyManager.isLand(x, y, z)) continue;

      const rNoiseVal = (rareNoise(x * 2, y * 2, z * 2) + 1) * 0.5;
      const cNoiseVal = (commonNoise(x * 3, y * 3, z * 3) + 1) * 0.5;

      const elevation = geographyManager.getHeightAtPoint(x, y, z, planetRadius, isMobile ? 0.45 : 0.65);
      
      const pos = { x: x * elevation, y: y * elevation, z: z * elevation };
      const id = `${planetSeed}_res_${i}`;

      if (rNoiseVal > 0.85) {
        resources.push({
          id,
          planetId: planetSeed,
          type: 'rare',
          position: pos,
          active: true,
          createdAt: new Date().toISOString()
        });
      } else if (cNoiseVal > 0.70) {
        resources.push({
          id,
          planetId: planetSeed,
          type: 'common',
          position: pos,
          active: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    return resources;
  }, [planetSeed, planetRadius, geographyManager, isMobile]);

  useEffect(() => {
    const updateResources = (serverResources: ResourceNode[]) => {
      // Server resources now act as a list of depleted/extracted resources
      // Or we can just filter out ones that are marked inactive on the server
      const depleted = new Set<string>();
      serverResources.forEach(r => {
        if (!r.active) depleted.add(r.id);
      });
      setDepletedResources(depleted);
      
      // Also update gameManager.resources so the ship can interact with them
      // We merge procedural resources with server state
      const activeResources = proceduralResources.map(pr => ({
        ...pr,
        active: !depleted.has(pr.id)
      }));
      
      // Merge with existing resources from other planets
      const otherResources = gameManager.resources.filter(r => r.planetId !== planetSeed);
      gameManager.resources = [...otherResources, ...activeResources.filter(r => r.active)];
    };
    
    gameManager.addResourceListener(updateResources);
    
    return () => {
      gameManager.removeResourceListener(updateResources);
    };
  }, [proceduralResources]);

  return (
    <group>
      {proceduralResources.map(res => (
        <Resource key={res.id} data={{...res, active: !depletedResources.has(res.id)}} isMobile={isMobile} />
      ))}
    </group>
  );
}
