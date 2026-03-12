import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { BaseManager } from './BaseManager';
import { geographyManager } from '../services/geography';

function Clouds({ radius }: { radius: number }) {
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
      cloudsRef.current.rotation.z = state.clock.elapsedTime * 0.005;
    }
  });

  return (
    <group>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius * 1.08, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {/* Atmospheric Haze Layer */}
      <mesh>
        <sphereGeometry args={[radius * 1.04, 64, 64]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={0.15}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

interface PlanetProps {
  radius: number;
}

export function Planet({ radius }: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [displacementMap, setDisplacementMap] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    // 1️⃣ Assign callback BEFORE generating texture
    geographyManager.onTextureUpdate = (newTexture, newDisplacementMap) => {
      console.log("Planet onTextureUpdate fired", newTexture, newDisplacementMap);

      // Ensure Three.js knows about wrapping and flipY
      newTexture.wrapS = newTexture.wrapT = THREE.RepeatWrapping;
      newTexture.flipY = false;
      newTexture.needsUpdate = true;

      newDisplacementMap.wrapS = newDisplacementMap.wrapT = THREE.RepeatWrapping;
      newDisplacementMap.flipY = false;
      newDisplacementMap.needsUpdate = true;

      // Update state to trigger re-render
      setTexture(newTexture);
      setDisplacementMap(newDisplacementMap);
    };

    // 2️⃣ Generate regions & texture AFTER callback is set
    geographyManager.initializeTopicRegions();

    return () => {
      geographyManager.onTextureUpdate = null;
    };
  }, []);

  // 3️⃣ Force material update when textures change
  useEffect(() => {
    if (planetRef.current && texture && displacementMap) {
      const mat = planetRef.current.material as THREE.MeshStandardMaterial;
      mat.map = texture;
      mat.displacementMap = displacementMap;
      mat.needsUpdate = true;
      console.log("Planet material updated with new textures");
    }
  }, [texture, displacementMap]);

  return (
    <group>
      <Sphere ref={planetRef} args={[radius, 512, 512]} castShadow receiveShadow>
        <meshStandardMaterial
          map={texture ?? undefined}
          displacementMap={displacementMap ?? undefined}
          displacementScale={0.8}
          bumpMap={displacementMap ?? undefined}
          bumpScale={0.2}
          roughness={0.85}
          metalness={0.05}
        />
      </Sphere>

      <Clouds radius={radius} />
      <BaseManager planetRadius={radius} />
    </group>
  );
}
