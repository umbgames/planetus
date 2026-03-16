import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SunProps {
  radius?: number;
  distance?: number;
  speed?: number;
  onClick?: () => void;
}

export function Sun({ radius = 2, distance = 30, speed = 0.1, onClick }: SunProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame((state) => {
    if (groupRef.current && distance > 0) {
      const time = state.clock.getElapsedTime() * speed;
      // Orbit around the planet
      const x = Math.cos(time) * distance;
      const z = Math.sin(time) * distance;
      const y = Math.sin(time * 0.5) * distance * 0.3; // Slight vertical oscillation
      
      groupRef.current.position.set(x, y, z);
      
      if (lightRef.current) {
        // Point light at the center of the planet
        lightRef.current.target.position.set(0, 0, 0);
        lightRef.current.target.updateMatrixWorld();
      }
    }
  });

  return (
    <group 
      ref={groupRef}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      onPointerOver={() => { if (onClick) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { if (onClick) document.body.style.cursor = 'auto'; }}
    >
      {/* Sun Mesh */}
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial color="#ffddaa" />
      </mesh>
      
      {/* Glow Effect */}
      <mesh>
        <sphereGeometry args={[radius * 1.5, 32, 32]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      
      <mesh>
        <sphereGeometry args={[radius * 2.5, 32, 32]} />
        <meshBasicMaterial color="#ff5500" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Dynamic Light */}
      <directionalLight
        ref={lightRef}
        color="#ffddaa"
        intensity={3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />
    </group>
  );
}
