import React, { useRef, useMemo, useState, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData, AsteroidBeltData, VISUAL_SCALE, getScaledPlanetRadius, buildScaledOrbitMap } from '../services/solarSystem';
import { Planet } from './Planet';
import { Sun } from './Sun';
import { createPRNG } from '../utils/random';

interface SolarSystemViewProps {
  data: SolarSystemData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
}

interface OrbitingPlanetProps {

  planet: PlanetData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
  scaledOrbitDistance: number;
}

const OrbitingPlanet = memo(function OrbitingPlanet({
  planet,
  isMobile,
  currentPlanetId,
  setCurrentPlanetId,
  scaledOrbitDistance,
}: OrbitingPlanetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isActive, setIsActive] = useState(false);
  const { camera } = useThree();
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  const scaledRadius = useMemo(
    () => getScaledPlanetRadius(planet.radius),
    [planet.radius]
  );

  const isSelected = currentPlanetId === planet.id;
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const angle = planet.initialAngle + time * planet.orbitSpeed;

    const x = Math.cos(angle) * scaledOrbitDistance;
    const z = Math.sin(angle) * scaledOrbitDistance;

    // Preserve orbital tilt look
    const y =
      x * Math.sin(planet.orbitTiltZ) +
      z * Math.sin(planet.orbitTiltX);

    groupRef.current.position.set(x, y, z);

    // axial spin
    groupRef.current.rotation.y += 0.005;

    // LOD activation distance should scale with planet size and orbital presentation
    groupRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    const activationDistance = Math.max(80, scaledRadius * 32);

    if (dist < activationDistance && !isActive) {
      setIsActive(true);
    } else if (dist >= activationDistance && isActive) {
      setIsActive(false);
    }
    
    if (ringRef.current && isSelected) {
      const scale = 1 + Math.sin(time * 4) * 0.05;
      ringRef.current.scale.set(scale, scale, scale);
      ringRef.current.lookAt(camera.position);
    }
  });

  const proxyColor = useMemo(() => {
    switch (planet.visualClass) {
      case 'lush': return '#4d7c0f';
      case 'oceanic': return '#1d4ed8';
      case 'desert': return '#d97706';
      case 'arid_rocky': return '#78350f';
      case 'barren_gray': return '#525252';
      case 'icy': return '#bae6fd';
      case 'volcanic': return '#991b1b';
      default: return '#444444';
    }
  }, [planet.visualClass]);

  return (
    <group
      ref={groupRef}
      name={planet.id}
      onClick={(e) => {
        e.stopPropagation();
        setCurrentPlanetId(planet.id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {isActive ? (
        <Planet
          radius={scaledRadius}
          isMobile={isMobile}
          seed={planet.id}
          noiseScale={planet.noiseScale}
          landThreshold={planet.landThreshold}
          visualClass={planet.visualClass}
        />
      ) : (
        <mesh>
          <sphereGeometry args={[scaledRadius, 16, 16]} />
          <meshStandardMaterial color={proxyColor} roughness={1} />
        </mesh>
      )}
      
      {isSelected && (
        <mesh ref={ringRef}>
          <ringGeometry args={[scaledRadius * 1.2, scaledRadius * 1.3, 64]} />
          <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
});

function AsteroidBelt({
  belt,
  scaledOrbitDistance,
  scaledWidth,
}: {
  belt: AsteroidBeltData;
  scaledOrbitDistance: number;
  scaledWidth: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const asteroids = useMemo(() => {
    const items = [];
    const prng = createPRNG(belt.seed);

    for (let i = 0; i < belt.count; i++) {
      const angle = prng() * Math.PI * 2;
      const distance =
        scaledOrbitDistance + (prng() - 0.5) * scaledWidth;

      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = (prng() - 0.5) * scaledWidth * 0.2;

      const scale = prng() * 0.5 + 0.1;

      items.push({
        position: new THREE.Vector3(x, y, z),
        scale,
        rotation: new THREE.Euler(
          prng() * Math.PI,
          prng() * Math.PI,
          prng() * Math.PI
        ),
      });
    }
    return items;
  }, [belt.count, scaledOrbitDistance, scaledWidth, belt.seed]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y =
      belt.initialAngle + state.clock.getElapsedTime() * belt.orbitSpeed;
  });

  return (
    <group ref={groupRef}>
      {asteroids.map((ast, i) => (
        <mesh
          key={i}
          position={ast.position}
          scale={ast.scale}
          rotation={ast.rotation}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#888888" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function SolarSystemView({
  data,
  isMobile,
  currentPlanetId,
  setCurrentPlanetId,
}: SolarSystemViewProps) {
  const groupRef = useRef<THREE.Group>(null);

  const orbitMap = useMemo(() => buildScaledOrbitMap(data.bodies), [data.bodies]);

  const scaledStarRadius = useMemo(() => {
    return Math.max(
      data.starRadius * VISUAL_SCALE.STAR_RADIUS_MULTIPLIER,
      12
    );
  }, [data.starRadius]);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (currentPlanetId) {
      const planet = data.bodies.find(
        (b): b is PlanetData => b.type === 'planet' && b.id === currentPlanetId
      );

      if (planet) {
        const scaledOrbitDistance =
          orbitMap.get(planet.id) ??
          planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;

        const time = state.clock.getElapsedTime();
        const angle = planet.initialAngle + time * planet.orbitSpeed;

        const x = Math.cos(angle) * scaledOrbitDistance;
        const z = Math.sin(angle) * scaledOrbitDistance;
        const y =
          x * Math.sin(planet.orbitTiltZ) +
          z * Math.sin(planet.orbitTiltX);

        groupRef.current.position.set(-x, -y, -z);
      }
    } else {
      groupRef.current.position.set(0, 0, 0);
    }
  });

  return (
    <group ref={groupRef}>
      <Sun
        radius={scaledStarRadius}
        distance={0}
        speed={0}
        onClick={() => setCurrentPlanetId(null)}
      />

      {data.bodies.map((body) => {
        if (body.type === 'planet') {
          const planet = body as PlanetData;
          const scaledOrbitDistance =
            orbitMap.get(planet.id) ??
            planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;

          return (
            <OrbitingPlanet
              key={planet.id}
              planet={planet}
              isMobile={isMobile}
              currentPlanetId={currentPlanetId}
              setCurrentPlanetId={setCurrentPlanetId}
              scaledOrbitDistance={scaledOrbitDistance}
            />
          );
        }

        if (body.type === 'asteroid_belt') {
          const belt = body as AsteroidBeltData;

          const scaledOrbitDistance =
            belt.orbitDistance * VISUAL_SCALE.ASTEROID_DISTANCE_MULTIPLIER;

          const scaledWidth =
            belt.width * VISUAL_SCALE.ASTEROID_WIDTH_MULTIPLIER;

          return (
            <AsteroidBelt
              key={belt.id}
              belt={belt}
              scaledOrbitDistance={scaledOrbitDistance}
              scaledWidth={scaledWidth}
            />
          );
        }

        return null;
      })}
    </group>
  );
}