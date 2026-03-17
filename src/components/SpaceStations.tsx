import React, { useMemo } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { SpaceStation } from '../services/gameManager';
import * as THREE from 'three';

interface SpaceStationsProps {
  stations: SpaceStation[];
  currentPlanetId: string | null;
  onPilot?: (station: SpaceStation) => void;
}

function SpaceStationMesh({ station, onPilot }: { station: SpaceStation, onPilot?: (station: SpaceStation) => void }) {
  return (
    <group position={[station.position.x, station.position.y, station.position.z]} scale={0.01}>
      {/* Station Core */}
      <mesh>
        <cylinderGeometry args={[2, 2, 8, 8]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Solar Panels */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1, 15, 0.1]} />
        <meshStandardMaterial color="#1e40af" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6, 0.5, 16, 32]} />
        <meshStandardMaterial color="#60a5fa" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Label & Interaction */}
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
          Click to Pilot
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
