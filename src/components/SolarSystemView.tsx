import React, { useRef, useMemo, useState, memo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SolarSystemData, PlanetData, AsteroidBeltData, MoonData } from '../services/solarSystem';
import { Planet } from './Planet';
import { Sun } from './Sun';
import { VISUAL_SCALE, buildOrbitMap, getScaledPlanetRadius, getScaledStarRadius, getScaledAsteroidOrbitDistance, getScaledAsteroidWidth } from '../services/orbitUtils';

interface SolarSystemViewProps {
  data: SolarSystemData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
  showOrbitRings?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

interface OrbitingPlanetProps {
  planet: PlanetData;
  isMobile: boolean;
  currentPlanetId: string | null;
  setCurrentPlanetId: (id: string | null) => void;
  scaledOrbitDistance: number;
  quality?: 'low' | 'medium' | 'high';
}

function PlanetRing({ planetRadius, ring }: { planetRadius: number; ring: NonNullable<PlanetData['rings']> }) {
  const color = useMemo(() => new THREE.Color().setHSL((ring.colorSeed * 0.3 + 0.08) % 1, 0.28, 0.64), [ring.colorSeed]);
  return (
    <mesh rotation={[Math.PI / 2 + ring.tiltX, 0, ring.tiltZ]}>
      <ringGeometry args={[getScaledPlanetRadius(ring.innerRadius), getScaledPlanetRadius(ring.outerRadius), 96]} />
      <meshStandardMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} roughness={0.95} metalness={0.04} />
    </mesh>
  );
}

function OrbitingMoon({ moon, parentRadius, isMobile }: { moon: MoonData; parentRadius: number; isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaledMoonRadius = getScaledPlanetRadius(moon.radius * 0.35);
  const scaledMoonOrbit = getScaledPlanetRadius(parentRadius * 0.65 + moon.orbitDistance);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const angle = moon.initialAngle + time * moon.orbitSpeed;
    groupRef.current.position.set(Math.cos(angle) * scaledMoonOrbit, 0, Math.sin(angle) * scaledMoonOrbit);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[scaledMoonRadius, isMobile ? 16 : 24, isMobile ? 16 : 24]} />
        <meshStandardMaterial color="#8b8b8b" roughness={1} />
      </mesh>
    </group>
  );
}

const OrbitingPlanet = memo(function OrbitingPlanet({ planet, isMobile, currentPlanetId, setCurrentPlanetId, scaledOrbitDistance, quality = 'medium' }: OrbitingPlanetProps) {
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

    if (spinRef.current) spinRef.current.rotation.y += 0.02 * delta;

    groupRef.current.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    const activationDistance = Math.max(80, scaledRadius * 18 * VISUAL_SCALE.PLANET_LOD_DISTANCE_MULTIPLIER);
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
        {isActive ? (
          <Planet
            radius={scaledRadius}
            isMobile={isMobile}
            seed={planet.seed}
            biomeSeed={planet.biomeSeed}
            noiseScale={planet.noiseScale}
            landThreshold={planet.landThreshold}
            temperatureBias={planet.temperatureBias}
            humidityBias={planet.humidityBias}
            serverTimeSeconds={Date.now() / 1000}
            cloudRotationSpeed={planet.cloudRotationSpeed}
          />
        ) : (
          <mesh>
            <sphereGeometry args={[scaledRadius, quality === 'low' ? 10 : quality === 'medium' ? 14 : 18, quality === 'low' ? 10 : quality === 'medium' ? 14 : 18]} />
            <meshStandardMaterial color="#444444" roughness={1} />
          </mesh>
        )}

        {planet.rings && <PlanetRing planetRadius={planet.radius} ring={planet.rings} />}
        {planet.moons.map((moon) => <OrbitingMoon key={moon.id} moon={moon} parentRadius={planet.radius} isMobile={isMobile} />)}
      </group>
    </group>
  );
});

function OrbitRing({ radius, color = '#1e3a8a' }: { radius: number; color?: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.22, radius + 0.22, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function AsteroidBelt({ belt, scaledOrbitDistance, scaledWidth, quality = 'medium' }: { belt: AsteroidBeltData; scaledOrbitDistance: number; scaledWidth: number; quality?: 'low' | 'medium' | 'high'; }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const asteroidCount = useMemo(() => {
    const ratio = quality === 'low' ? 0.28 : quality === 'medium' ? 0.5 : 0.8;
    return Math.max(40, Math.floor(belt.count * ratio));
  }, [belt.count, quality]);

  const asteroids = useMemo(() => {
    const items = [] as { position: THREE.Vector3; scale: number; rotation: THREE.Euler }[];
    let seed = 1337;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < asteroidCount; i++) {
      const angle = random() * Math.PI * 2;
      const distance = scaledOrbitDistance + (random() - 0.5) * scaledWidth;
      items.push({
        position: new THREE.Vector3(Math.cos(angle) * distance, (random() - 0.5) * scaledWidth * 0.2, Math.sin(angle) * distance),
        scale: random() * 0.5 + 0.1,
        rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      });
    }
    return items;
  }, [asteroidCount, scaledOrbitDistance, scaledWidth]);

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
        <meshStandardMaterial color="#888888" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

export function SolarSystemView({ data, isMobile, currentPlanetId, setCurrentPlanetId, showOrbitRings = true, quality = 'medium' }: SolarSystemViewProps) {
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
    }
  });

  return (
    <group ref={groupRef}>
      <Sun radius={scaledStarRadius} distance={0} speed={0} onClick={() => setCurrentPlanetId(null)} />

      {showOrbitRings && data.bodies.map((body) => body.type === 'planet' ? (
        <OrbitRing key={`ring-${body.id}`} radius={orbitMap.get(body.id) ?? body.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER} color={currentPlanetId === body.id ? '#38bdf8' : '#1d4ed8'} />
      ) : null)}

      {data.bodies.map((body) => {
        if (body.type === 'planet') {
          const scaledOrbitDistance = orbitMap.get(body.id) ?? body.orbitDistance * VISUAL_SCALE.ORBIT_DISTANCE_MULTIPLIER;
          return <OrbitingPlanet key={body.id} planet={body} isMobile={isMobile} currentPlanetId={currentPlanetId} setCurrentPlanetId={setCurrentPlanetId} scaledOrbitDistance={scaledOrbitDistance} quality={quality} />;
        }
        const scaledOrbitDistance = getScaledAsteroidOrbitDistance(body);
        const scaledWidth = getScaledAsteroidWidth(body);
        return <AsteroidBelt key={body.id} belt={body} scaledOrbitDistance={scaledOrbitDistance} scaledWidth={scaledWidth} quality={quality} />;
      })}
    </group>
  );
}
