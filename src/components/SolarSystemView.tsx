import React, { useRef, useMemo, useState, memo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData, AsteroidBeltData, MoonData } from '../services/solarSystem';
import { Planet } from './Planet';
import { Sun } from './Sun';
import {
  VISUAL_SCALE,
  buildOrbitMap,
  getScaledPlanetRadius,
  getScaledStarRadius,
} from '../services/orbitUtils';
import { createPRNG } from '../utils/random';
import { useShipStore } from '../services/shipStore';
import { getMoonWorldPosition } from '../services/orbitUtils';
import { planetRotationRef } from '../services/runtimeRefs';

const getTextureDetailForQuality = (_quality: 'low' | 'medium' | 'high') => 'standard' as const;

interface SolarSystemViewProps {
  data: SolarSystemData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
  showOrbitRings?: boolean;
  quality?: 'low' | 'medium' | 'high';
  enableLOD?: boolean;
}

interface OrbitingPlanetProps {
  planet: PlanetData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
  scaledOrbitDistance: number;
  quality?: 'low' | 'medium' | 'high';
  enableLOD?: boolean;
}

const RingMesh = memo(function RingMesh({ innerRadius, outerRadius, color, opacity }: { innerRadius: number; outerRadius: number; color: string; opacity: number }) {
  return (
    <group rotation={[Math.PI / 2.55, 0, 0.25]}>
      <mesh>
        <ringGeometry args={[innerRadius, outerRadius, 56]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
});

const OrbitingMoon = memo(function OrbitingMoon({ moon, parentPlanet, isMobile, quality = 'low', setCurrentPlanetId }: { moon: MoonData; parentPlanet: PlanetData; isMobile: boolean; quality?: 'low' | 'medium' | 'high'; setCurrentPlanetId: (id: string | null) => void; }) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const { setLockedTarget } = useShipStore();
  const scaledRadius = getScaledPlanetRadius(moon.radius) * 0.9;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const angle = moon.initialAngle + state.clock.getElapsedTime() * moon.orbitSpeed;
    const x = Math.cos(angle) * moon.orbitDistance;
    const z = Math.sin(angle) * moon.orbitDistance;
    const y = x * Math.sin(moon.orbitTiltZ) + z * Math.sin(moon.orbitTiltX);
    groupRef.current.position.set(x, y, z);
    if (spinRef.current) spinRef.current.rotation.y += moon.spinSpeed * delta;
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        setCurrentPlanetId(parentPlanet.id);
        setLockedTarget({ id: moon.id, type: 'moon', parentPlanetId: parentPlanet.id });
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <group ref={spinRef}>
        <Planet
          radius={scaledRadius}
          isMobile={isMobile}
          seed={moon.seed}
          noiseScale={moon.noiseScale}
          landThreshold={moon.landThreshold}
          showClouds={false}
          textureDetail={getTextureDetailForQuality(quality)}
          visualClass={moon.visualClass}
          atmosphereColor="#a9b6c5"
          atmosphereOpacity={0.025}
        />
      </group>
    </group>
  );
});

const OrbitingPlanet = memo(function OrbitingPlanet({
  planet,
  isMobile,
  currentPlanetId,
  setCurrentPlanetId,
  scaledOrbitDistance,
  quality = 'low',
  enableLOD = false,
}: OrbitingPlanetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const [isActive, setIsActive] = useState(false);
  const { camera } = useThree();
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  const scaledRadius = useMemo(() => getScaledPlanetRadius(planet.radius), [planet.radius]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const angle = planet.initialAngle + time * planet.orbitSpeed;
    const x = Math.cos(angle) * scaledOrbitDistance;
    const z = Math.sin(angle) * scaledOrbitDistance;
    const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
    groupRef.current.position.set(x, y, z);

    if (spinRef.current) {
      spinRef.current.rotation.y += planet.spinSpeed * delta;
      if (currentPlanetId === planet.id) {
        planetRotationRef.current = spinRef.current.rotation.y;
      }
    }

    groupRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    if (!enableLOD) {
      if (!isActive) setIsActive(true);
      return;
    }

    const activationDistance = Math.max(180, scaledRadius * 28 * VISUAL_SCALE.PLANET_LOD_DISTANCE_MULTIPLIER);
    if (dist < activationDistance && !isActive) setIsActive(true);
    else if (dist >= activationDistance && isActive) setIsActive(false);
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        setCurrentPlanetId(planet.id);
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <group ref={spinRef}>
        {isActive && (
          <>
            {planet.ring && (
              <RingMesh
                innerRadius={getScaledPlanetRadius(planet.ring.innerRadius)}
                outerRadius={getScaledPlanetRadius(planet.ring.outerRadius)}
                color={planet.ring.color}
                opacity={planet.ring.opacity}
              />
            )}

            <Planet
              radius={scaledRadius}
              isMobile={isMobile}
              seed={planet.seed}
              noiseScale={planet.noiseScale}
              landThreshold={planet.landThreshold}
              showClouds={planet.hasClouds}
              cloudDensity={planet.cloudDensity}
              cloudSpeed={planet.cloudSpeed}
              cloudRotationSpeed={planet.cloudRotationSpeed}
              textureDetail={getTextureDetailForQuality(quality)}
              visualClass={planet.visualClass}
              atmosphereColor={planet.atmosphereColor}
              atmosphereOpacity={planet.atmosphereOpacity}
            />

            {planet.moons.map((moon) => (
              <OrbitingMoon
                key={moon.id}
                moon={moon}
                parentPlanet={planet}
                isMobile={isMobile}
                quality={quality}
                setCurrentPlanetId={setCurrentPlanetId}
              />
            ))}
          </>
        )}
      </group>
    </group>
  );
});

function OrbitRing({ radius, color = '#1e3a8a' }: { radius: number; color?: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.18, radius + 0.18, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function AsteroidBelt({ belt, scaledOrbitDistance, scaledWidth, quality = 'low' }: { belt: AsteroidBeltData; scaledOrbitDistance: number; scaledWidth: number; quality?: 'low' | 'medium' | 'high'; }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const asteroidCount = useMemo(() => {
    const ratio = quality === 'low' ? 0.18 : quality === 'medium' ? 0.35 : 0.55;
    return Math.max(28, Math.floor(belt.count * ratio));
  }, [belt.count, quality]);

  const asteroids = useMemo(() => {
    const items = [] as Array<{ position: THREE.Vector3; scale: number; rotation: THREE.Euler }>;
    const random = createPRNG(belt.seed);
    for (let i = 0; i < asteroidCount; i++) {
      const angle = random() * Math.PI * 2;
      const distance = scaledOrbitDistance + (random() - 0.5) * scaledWidth;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = (random() - 0.5) * scaledWidth * 0.16;
      const scale = random() * 0.45 + 0.08;
      items.push({
        position: new THREE.Vector3(x, y, z),
        scale,
        rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      });
    }
    return items;
  }, [asteroidCount, scaledOrbitDistance, scaledWidth, belt.seed]);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    asteroids.forEach((ast, i) => {
      dummy.position.copy(ast.position);
      dummy.rotation.copy(ast.rotation);
      dummy.scale.setScalar(ast.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [asteroids]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = belt.initialAngle + state.clock.getElapsedTime() * belt.orbitSpeed;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, asteroidCount]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#888888" roughness={0.95} />
      </instancedMesh>
    </group>
  );
}

export function SolarSystemView({ data, isMobile, currentPlanetId, setCurrentPlanetId, showOrbitRings = true, quality = 'low', enableLOD = false }: SolarSystemViewProps) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitMap = useMemo(() => buildOrbitMap(data.bodies), [data.bodies]);
  const scaledStarRadius = useMemo(() => getScaledStarRadius(data.starRadius), [data.starRadius]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (currentPlanetId) {
      const planet = data.bodies.find((b): b is PlanetData => b.type === 'planet' && b.id === currentPlanetId);
      if (planet) {
        const scaledOrbitDistance = orbitMap.get(planet.id) ?? planet.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
        const time = state.clock.getElapsedTime();
        const angle = planet.initialAngle + time * planet.orbitSpeed;
        const x = Math.cos(angle) * scaledOrbitDistance;
        const z = Math.sin(angle) * scaledOrbitDistance;
        const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
        groupRef.current.position.set(-x, -y, -z);
      }
    } else {
      groupRef.current.position.set(0, 0, 0);
      planetRotationRef.current = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <Sun radius={scaledStarRadius} distance={0} speed={0} onClick={() => setCurrentPlanetId(null)} color={data.starColor} />

      {showOrbitRings && data.bodies.map((body) => {
        if (body.type !== 'planet') return null;
        const orbitDistance = orbitMap.get(body.id) ?? body.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
        return <OrbitRing key={`ring-${body.id}`} radius={orbitDistance} color={currentPlanetId === body.id ? '#38bdf8' : '#1d4ed8'} />;
      })}

      {data.bodies.map((body) => {
        if (body.type === 'planet') {
          const scaledOrbitDistance = orbitMap.get(body.id) ?? body.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
          return (
            <OrbitingPlanet
              key={body.id}
              planet={body}
              isMobile={isMobile}
              currentPlanetId={currentPlanetId}
              setCurrentPlanetId={setCurrentPlanetId}
              scaledOrbitDistance={scaledOrbitDistance}
              quality={quality}
              enableLOD={enableLOD}
            />
          );
        }

        const scaledOrbitDistance = body.orbitDistance * VISUAL_SCALE.ASTEROID_DISTANCE_MULTIPLIER;
        const scaledWidth = body.width * VISUAL_SCALE.ASTEROID_WIDTH_MULTIPLIER;
        return <AsteroidBelt key={body.id} belt={body} scaledOrbitDistance={scaledOrbitDistance} scaledWidth={scaledWidth} quality={quality} />;
      })}
    </group>
  );
}
