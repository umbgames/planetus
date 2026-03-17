import React, { useMemo } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { SpaceStation } from '../services/gameManager';

interface SpaceStationsProps {
  stations: SpaceStation[];
  currentPlanetId: string | null;
  onPilot?: (station: SpaceStation) => void;
}

function SpaceStationMesh({ station, onPilot }: { station: SpaceStation; onPilot?: (station: SpaceStation) => void }) {
  return (
    <group position={[station.position.x, station.position.y, station.position.z]} scale={0.01}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8, 0.65, 18, 48]} />
        <meshStandardMaterial color="#6ee7f9" metalness={0.9} roughness={0.18} emissive="#134e4a" emissiveIntensity={0.35} />
      </mesh>

      <mesh>
        <cylinderGeometry args={[1.5, 1.5, 10, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.95} roughness={0.16} />
      </mesh>

      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.5, 0.5, 20, 10]} />
        <meshStandardMaterial color="#27272a" metalness={0.9} roughness={0.25} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position={[0, side * 3.4, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.7, 10, 0.18]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0, side * 0.9]}>
            <sphereGeometry args={[0.85, 18, 18]} />
            <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={1.5} metalness={0.8} roughness={0.15} />
          </mesh>
        </group>
      ))}

      <Billboard
        position={[0, 11, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onPilot?.(station);
        }}
      >
        <group>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[12, 3.2]} />
            <meshBasicMaterial transparent opacity={0.18} color="#000000" />
          </mesh>
          <Text fontSize={0.72} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={10}>
            {station.ownerName} Station
          </Text>
          <Text position={[0, -1.05, 0]} fontSize={0.28} color="#7dd3fc" anchorX="center" anchorY="middle">
            Pilot station
          </Text>
        </group>
      </Billboard>
    </group>
  );
}

export function SpaceStations({ stations, currentPlanetId, onPilot }: SpaceStationsProps) {
  const planetStations = useMemo(() => stations.filter((s) => s.planetId === currentPlanetId), [stations, currentPlanetId]);

  return (
    <group>
      {planetStations.map((station) => (
        <SpaceStationMesh key={station.id} station={station} onPilot={onPilot} />
      ))}
    </group>
  );
}
