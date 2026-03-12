import React, { useRef, useEffect, useState, useMemo } from 'react';
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

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uTime;
    
    // ... your noise functions here ...
    
    void main() {
      float n1 = 0.0; // simplified for brevity
      float n2 = 0.0;
      float n = n1 + n2;
      float alpha = smoothstep(0.1, 0.8, n);
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.4);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius * 1.08, 64, 64]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.04, 64, 64]} />
        <meshStandardMaterial
          color="#aaccff"
          transparent
          opacity={0.15}
          roughness={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
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
    // 1️⃣ Assign the callback BEFORE generating the texture
    geographyManager.onTextureUpdate = (newTexture, newDisplacementMap) => {
      // Fix for Three.js high-res texture
      newTexture.wrapS = newTexture.wrapT = THREE.RepeatWrapping;
      newTexture.flipY = false;
      newTexture.needsUpdate = true;

      newDisplacementMap.wrapS = newDisplacementMap.wrapT = THREE.RepeatWrapping;
      newDisplacementMap.flipY = false;
      newDisplacementMap.needsUpdate = true;

      setTexture(newTexture);
      setDisplacementMap(newDisplacementMap);
      console.log("Texture applied to Planet");
    };

    // 2️⃣ Generate regions and textures after callback is set
    geographyManager.initializeTopicRegions();

    return () => {
      geographyManager.onTextureUpdate = null;
    };
  }, []);

  // 3️⃣ Force material update whenever texture changes
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
        <mesh>
          <sphereGeometry args={[radius * 1.15, 32, 32]} />
          <meshBasicMaterial
            color="#4488ff"
            transparent
            opacity={0.05}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </Sphere>

      <Clouds radius={radius} />
      <BaseManager planetRadius={radius} />
    </group>
  );
}
