import React, { useMemo, useRef } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { SpaceStation } from '../services/gameManager';
import * as THREE from 'three';
import { SharedMegaShipModel } from './SharedShipModels';

interface SpaceStationsProps {
  stations: SpaceStation[];
  currentPlanetId: string | null;
  onPilot?: (station: SpaceStation) => void;
}

function SpaceStationMesh({ station, onPilot }: { station: SpaceStation, onPilot?: (station: SpaceStation) => void }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const orbitRadius = Math.max(station.orbitRadius || 180, 180);
    const orbitSpeed = station.orbitSpeed || 0.00022;
    const angle = (station.initialAngle || 0) + t * orbitSpeed * 60;
    const verticalBob = Math.sin(t * 0.18 + (station.initialAngle || 0)) * 8;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;
    const y = 48 + verticalBob;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = -angle + Math.PI;
  });

  return (
    <group ref={groupRef} scale={0.028}>
      <SharedMegaShipModel />

      <Billboard position={[0, 8, 0]} onClick={(e) => {
        e.stopPropagation();
        onPilot?.(station);
      }}>
        <Text
          fontSize={0.6}
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
          fontSize={0.3}
          color="#60a5fa"
          anchorX="center"
          anchorY="middle"
        >
          Deep Space Command
        </Text>
      </Billboard>
    </group>
  );
}

export function SpaceStations({ stations, currentPlanetId, onPilot }: SpaceStationsProps) {
  const planetStations = useMemo(() => {
    return stations.filter(s => s.planetId === currentPlanetId);
  }, [stations, currentPlanetId]);

  return (
    <group>
      {planetStations.map((station) => (
        <SpaceStationMesh key={station.id} station={station} onPilot={onPilot} />
      ))}
    </group>
  );
}
