import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { geographyManager } from '../services/geography';
import { gameManager, BaseData } from '../services/gameManager';

interface BaseManagerProps {
  planetRadius: number;
}

// Make buildings much smaller for scale
const CUBE_WIDTH = 0.06;
const CUBE_HEIGHT = 0.02;
const CUBE_DEPTH = 0.06;

const baseGeometry = new THREE.BoxGeometry(1, 1, 1);

function Base({ data }: { data: BaseData }) {
  const groupRef = useRef<THREE.Group>(null);
  const highDetailRef = useRef<THREE.Group>(null);
  const lowDetailRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  // Determine color based on owner/zone
  const isNPC = data.ownerId === 'npc';
  const color = isNPC ? '#888888' : (data.zone === 'high' ? '#ef4444' : data.zone === 'mid' ? '#f59e0b' : '#3b82f6');
  const height = data.level * 2;
  
  useEffect(() => {
    if (groupRef.current) {
      const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      const normal = pos.clone().normalize();
      
      groupRef.current.position.copy(pos);
      groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      
      // Use ID for consistent rotation
      const hash = data.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
      groupRef.current.rotateY((hash % 360) * (Math.PI / 180));
    }
  }, [data.position, data.id]);

  useFrame(() => {
    if (!groupRef.current || !highDetailRef.current || !lowDetailRef.current) return;
    
    // Calculate distance to camera for LOD
    const dist = camera.position.distanceTo(groupRef.current.position);
    
    // Planet radius is 10. Max altitude before hiding is around 2-3.
    const maxDist = 13; // Hide completely at this distance
    const fadeDist = 11; // Start scaling down at this distance
    
    if (dist > maxDist) {
      // Hide completely at great distance (Occlusion/Distance Culling)
      groupRef.current.visible = false;
    } else {
      groupRef.current.visible = true;
      
      // Scale up smoothly as you get closer
      let scale = 1;
      if (dist > fadeDist) {
        scale = 1 - ((dist - fadeDist) / (maxDist - fadeDist));
        scale = scale * scale; // Ease-in effect
      }
      groupRef.current.scale.setScalar(scale);

      // Detail LOD
      if (dist > 8) {
        // Simplify at medium distance
        highDetailRef.current.visible = false;
        lowDetailRef.current.visible = true;
      } else {
        // Full detail when close
        highDetailRef.current.visible = true;
        lowDetailRef.current.visible = false;
      }
    }
  });

  const totalHeight = height * CUBE_HEIGHT;

  return (
    <group ref={groupRef}>
      {/* High Detail Version */}
      <group ref={highDetailRef}>
        {Array.from({ length: height }).map((_, index) => {
          const yOffset = (index + 0.5) * CUBE_HEIGHT;
          
          let xOffset = 0;
          let zOffset = 0;
          let rotationY = 0;
          
          let currentWidth = CUBE_WIDTH;
          let currentDepth = CUBE_DEPTH;
          
          // Base style based on zone
          if (data.zone === 'high') {
            rotationY = index * 0.1;
          } else if (data.zone === 'mid') {
            xOffset = (index % 2 === 0 ? 1 : -1) * CUBE_WIDTH * 0.2;
          } else {
            currentWidth = CUBE_WIDTH * Math.max(0.5, 1 - (index / height) * 0.5);
            currentDepth = CUBE_DEPTH * Math.max(0.5, 1 - (index / height) * 0.5);
          }
          
          return (
            <mesh 
              key={index} 
              geometry={baseGeometry}
              position={[xOffset, yOffset, zOffset]}
              rotation={[0, rotationY, 0]}
              scale={[currentWidth, CUBE_HEIGHT, currentDepth]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial 
                color={color}
                emissive={color}
                emissiveIntensity={0.2}
                roughness={0.4}
                metalness={0.6}
              />
            </mesh>
          );
        })}
      </group>
      
      {/* Low Detail Version (Single Box) */}
      <mesh
        ref={lowDetailRef}
        geometry={baseGeometry}
        position={[0, totalHeight / 2, 0]}
        scale={[CUBE_WIDTH * 1.1, totalHeight, CUBE_DEPTH * 1.1]}
        visible={false}
      >
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

export function BaseManager({ planetRadius }: BaseManagerProps) {
  const [bases, setBases] = useState<BaseData[]>([]);

  useEffect(() => {
    gameManager.onBasesUpdate = (newBases) => {
      setBases(newBases);
    };
    
    // Initialize game manager if not already
    if (gameManager.bases.length === 0) {
      gameManager.init();
    } else {
      setBases(gameManager.bases);
    }
    
    return () => {
      gameManager.onBasesUpdate = null;
    };
  }, []);

  return (
    <group>
      {bases.map(base => (
        <Base key={base.id} data={base} />
      ))}
    </group>
  );
}
