import React, { useMemo, useRef } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { SpaceStation } from '../services/gameManager';
import * as THREE from 'three';
import { SharedMegaShipModel } from './SharedShipModels';

interface SpaceStationsProps {
  stations: SpaceStation[];
  currentPlanetId: string | null;
  planet1Id?: string | null;
  planetRadius?: number;
  onPilot?: (station: SpaceStation) => void;
  onDockAtStarbase?: () => void;
}

export function getStarbaseSpawnPosition(planetRadius = 10, offsetAltitude = 1.85) {
  const orbitRadius = planetRadius * offsetAltitude;
  // Position right off the forward launch deck of Starbase Prime
  return new THREE.Vector3(orbitRadius, 0.5, 0);
}

export function PrimeStarbase({
  planetRadius = 10,
  onDock,
}: {
  planetRadius?: number;
  onDock?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const orbitRadius = Math.max(16, planetRadius * 1.85);
    const orbitSpeed = 0.024; // Smooth, majestic orbital drift
    const angle = t * orbitSpeed;
    const verticalSway = Math.sin(t * 0.15) * 0.4;
    
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = verticalSway;
    
    groupRef.current.position.set(x, y, z);
    // Face forward along orbital trajectory
    groupRef.current.rotation.y = -angle + Math.PI / 2;

    if (beaconRef.current) {
      beaconRef.current.rotation.z = t * 1.5;
    }
  });

  return (
    <group ref={groupRef} scale={0.045}>
      <SharedMegaShipModel />

      {/* Orbital Docking Guidance Rings */}
      <group position={[0, 0, -4.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8, 0.05, 12, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.65} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -2.5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.2, 0.05, 12, 32]} />
          <meshBasicMaterial color="#00ff66" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      </group>

      {/* Animated Navigation Strobe Array */}
      <group ref={beaconRef} position={[0, 2.5, 0]}>
        {[-3.5, 3.5].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>
        ))}
      </group>

      <Billboard position={[0, 10, 0]} onClick={(e) => {
        e.stopPropagation();
        onDock?.();
      }}>
        <Text
          fontSize={0.85}
          color="#38bdf8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#020617"
        >
          STARBASE ALPHA
        </Text>
        <Text
          position={[0, -0.9, 0]}
          fontSize={0.42}
          color="#e2e8f0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#020617"
        >
          HOMESECTOR COMMAND • SAFE ZONE
        </Text>
        <Text
          position={[0, -1.6, 0]}
          fontSize={0.28}
          color="#4ade80"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#020617"
        >
          [ REFUEL & REPAIR HUB ]
        </Text>
      </Billboard>
    </group>
  );
}

function SpaceStationMesh({ station, onPilot }: { station: SpaceStation, onPilot?: (station: SpaceStation) => void }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const orbitRadius = Math.max(station.orbitRadius || 24, 24);
    const orbitSpeed = station.orbitSpeed || 0.0003;
    const angle = (station.initialAngle || 0) + t * orbitSpeed * 60;
    const verticalBob = Math.sin(t * 0.18 + (station.initialAngle || 0)) * 2;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = 8 + verticalBob;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = -angle + Math.PI;
  });

  return (
    <group ref={groupRef} scale={0.032}>
      <SharedMegaShipModel />

      <Billboard position={[0, 8, 0]} onClick={(e) => {
        e.stopPropagation();
        onPilot?.(station);
      }}>
        <Text
          fontSize={0.65}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.06}
          outlineColor="#000000"
        >
          {station.ownerName}'s Station
        </Text>
        <Text
          position={[0, -0.8, 0]}
          fontSize={0.32}
          color="#60a5fa"
          anchorX="center"
          anchorY="middle"
        >
          Deep Space Outpost
        </Text>
      </Billboard>
    </group>
  );
}

export function SpaceStations({
  stations,
  currentPlanetId,
  planet1Id,
  planetRadius = 10,
  onPilot,
  onDockAtStarbase,
}: SpaceStationsProps) {
  const planetStations = useMemo(() => {
    return stations.filter(s => s.planetId === currentPlanetId);
  }, [stations, currentPlanetId]);

  const isPlanet1 = Boolean(planet1Id && currentPlanetId === planet1Id);

  return (
    <group>
      {/* Permanent Main Orbiting Base at Planet 1 where everyone starts */}
      {isPlanet1 && (
        <PrimeStarbase
          planetRadius={planetRadius}
          onDock={onDockAtStarbase}
        />
      )}

      {planetStations.map((station) => (
        <SpaceStationMesh key={station.id} station={station} onPilot={onPilot} />
      ))}
    </group>
  );
}
