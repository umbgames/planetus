import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SunProps {
  radius?: number;
  distance?: number;
  speed?: number;
  onClick?: () => void;
  color?: string;
}

export function Sun({ radius = 2, distance = 30, speed = 0.1, onClick, color = '#fff1b8' }: SunProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const coreSegments = useMemo(() => (radius > 20 ? 40 : 28), [radius]);

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
        <sphereGeometry args={[radius, coreSegments, coreSegments]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.25, 24, 24]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.7, 20, 20]} />
        <meshBasicMaterial color="#ff8c42" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 2.35, 18, 18]} />
        <meshBasicMaterial color="#ff5a1f" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Dynamic Light */}
      <directionalLight
        ref={lightRef}
        color="#ffddaa"
        intensity={4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
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
