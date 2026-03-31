import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { SolarSystemData, PlanetData } from '../services/solarSystem';
import { buildOrbitMap, getPlanetWorldPosition } from '../services/orbitUtils';

interface SatelliteProps {
  satellites: any[];
  onSatelliteClick?: (tag: any) => void;
  solarSystem: SolarSystemData | null;
  currentPlanetId: string | null;
}

const vertexShader = `
  varying vec3 vPosition;
  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uInitialAngle;
  uniform float uTrailLength;
  uniform vec3 uColor;

  void main() {
    float fragAngle = atan(vPosition.y, vPosition.x);
    float currentSatAngle = uTime * uSpeed + uInitialAngle;
    
    float TWO_PI = 6.28318530718;
    
    fragAngle = mod(fragAngle, TWO_PI);
    currentSatAngle = mod(currentSatAngle, TWO_PI);
    
    float diff = currentSatAngle - fragAngle;
    
    if (uSpeed > 0.0) {
        diff = mod(diff, TWO_PI);
    } else {
        diff = mod(-diff, TWO_PI);
    }
    
    float opacity = 0.0;
    if (diff < uTrailLength) {
        opacity = 1.0 - (diff / uTrailLength);
        opacity = pow(opacity, 1.5);
    }
    
    if (opacity < 0.01) discard;
    
    float pulse = 0.8 + sin(uTime * 3.0 + uInitialAngle) * 0.2;
    
    gl_FragColor = vec4(uColor, opacity * pulse);
  }
`;

function SingleSatellite({ tag, onClick }: { tag: any, onClick?: () => void }) {
  const orbitRef = useRef<THREE.Group>(null);
  const satRef = useRef<THREE.Group>(null);
  const trailMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const trailColor = useMemo(() => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const hash = tag.name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [tag.name]);

  const baseColor = useMemo(() => new THREE.Color(trailColor), [trailColor]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: tag.speed },
    uInitialAngle: { value: tag.initialAngle },
    uTrailLength: { value: 1.2 },
    uColor: { value: baseColor }
  }), [tag.speed, tag.initialAngle, baseColor]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (orbitRef.current) {
      orbitRef.current.rotation.y = time * tag.speed + tag.initialAngle;
    }
    if (satRef.current) {
      // Add a slight wobble, slowed down
      satRef.current.rotation.z = Math.sin(time * 2 + tag.initialAngle) * 0.05;
    }
    if (trailMaterialRef.current) {
      trailMaterialRef.current.uniforms.uTime.value = time;
    }
  });

  const scale = Math.max(0.4, Math.min(1.2, tag.bases / 10));
  
  // Orient the satellite based on its direction of travel
  const satRotationY = tag.speed > 0 ? Math.PI : 0;

  return (
    <group rotation={[tag.tiltX, tag.tiltY, tag.tiltZ]}>
      {/* Shader-based Trail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[tag.orbitRadius, 0.03, 8, 128]} />
        <shaderMaterial 
          ref={trailMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={orbitRef}>
        <group position={[tag.orbitRadius, 0, 0]}>
          <group 
            ref={satRef} 
            rotation={[0, satRotationY, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            onPointerOver={() => document.body.style.cursor = 'pointer'}
            onPointerOut={() => document.body.style.cursor = 'auto'}
          >
            <group scale={[0.4, 0.4, 0.4]}>
              {/* Main body */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} />
              </mesh>
              
              {/* Solar panel left */}
              <mesh position={[-0.6, 0, 0]}>
                <boxGeometry args={[1, 0.05, 0.4]} />
                <meshStandardMaterial color="#1d4ed8" metalness={0.9} roughness={0.1} />
              </mesh>
              
              {/* Solar panel right */}
              <mesh position={[0.6, 0, 0]}>
                <boxGeometry args={[1, 0.05, 0.4]} />
                <meshStandardMaterial color="#1d4ed8" metalness={0.9} roughness={0.1} />
              </mesh>

              {/* Antenna base */}
              <mesh position={[0, 0, 0.4]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
              </mesh>
              
              {/* Antenna dish */}
              <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.15, 0.02, 0.2]} />
                <meshStandardMaterial color="#9ca3af" metalness={0.8} />
              </mesh>
            </group>

            {/* Player Name Text */}
            <Billboard position={[0, 0.6, 0]}>
              <Text
                fontSize={0.8 * scale}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#000000"
              >
                {tag.name}
              </Text>
            </Billboard>
          </group>
        </group>
      </group>
    </group>
  );
}

export function Satellite({ satellites, onSatelliteClick, solarSystem, currentPlanetId }: SatelliteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitMap = useMemo(() => solarSystem ? buildOrbitMap(solarSystem.bodies) : new Map<string, number>(), [solarSystem]);
  const mainPlanetPos = useMemo(() => new THREE.Vector3(), []);
  const currentPlanetPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (groupRef.current && solarSystem) {
      const mainPlanet = solarSystem.bodies.find((b): b is PlanetData => b.type === 'planet');
      if (mainPlanet) {
        const time = state.clock.getElapsedTime();
        getPlanetWorldPosition(mainPlanet, time, orbitMap, mainPlanetPos);

        if (currentPlanetId) {
          const currentPlanet = solarSystem.bodies.find((b): b is PlanetData => b.type === 'planet' && b.id === currentPlanetId);
          if (currentPlanet) {
            getPlanetWorldPosition(currentPlanet, time, orbitMap, currentPlanetPos);
            groupRef.current.position.subVectors(mainPlanetPos, currentPlanetPos);
          } else {
            groupRef.current.position.copy(mainPlanetPos);
          }
        } else {
          groupRef.current.position.copy(mainPlanetPos);
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {satellites.map((tag) => (
        <SingleSatellite 
          key={tag.name} 
          tag={tag} 
          onClick={() => onSatelliteClick?.(tag)} 
        />
      ))}
    </group>
  );
}
