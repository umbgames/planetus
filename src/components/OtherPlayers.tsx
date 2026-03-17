import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { UserData } from '../services/gameManager';
import { SolarSystemData, PlanetData } from '../services/solarSystem';

interface OtherPlayersProps {
  players: UserData[];
  localUserId: string | undefined;
  currentPlanetId: string | null;
  solarSystem: SolarSystemData | null;
  onTargetPlayer?: (uid: string) => void;
  targetId?: string | null;
}

function OtherPlayerShip({ 
  player, 
  currentPlanetId, 
  solarSystem,
  isTargeted,
  onSelect
}: { 
  player: UserData, 
  currentPlanetId: string | null, 
  solarSystem: SolarSystemData | null,
  isTargeted?: boolean,
  onSelect?: () => void
}) {
  const groupRef = useRef<THREE.Group>(null);
  const shipRef = useRef<THREE.Group>(null);

  const playerPos = useMemo(() => {
    if (!player.playerSave) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(player.playerSave.position.x, player.playerSave.position.y, player.playerSave.position.z);
  }, [player.playerSave]);

  const playerRot = useMemo(() => {
    if (!player.playerSave) return new THREE.Euler(0, 0, 0);
    return new THREE.Euler(player.playerSave.rotation.x, player.playerSave.rotation.y, player.playerSave.rotation.z);
  }, [player.playerSave]);

  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(new THREE.Euler());

  useFrame((state, delta) => {
    if (!groupRef.current || !solarSystem) return;

    const getPlanetPos = (id: string | null) => {
      if (!id || !solarSystem) return new THREE.Vector3(0, 0, 0);
      const planet = solarSystem.bodies.find(b => b.id === id) as PlanetData;
      if (!planet) return new THREE.Vector3(0, 0, 0);
      const time = state.clock.getElapsedTime();
      const angle = planet.initialAngle + time * planet.orbitSpeed;
      const x = Math.cos(angle) * planet.orbitDistance;
      const z = Math.sin(angle) * planet.orbitDistance;
      const y = x * Math.sin(planet.orbitTiltZ) + z * Math.sin(planet.orbitTiltX);
      return new THREE.Vector3(x, y, z);
    };

    const targetPlanetPos = getPlanetPos(player.currentPlanetId || null);
    const currentViewPlanetPos = getPlanetPos(currentPlanetId);

    // Calculate position relative to current view
    const absolutePos = playerPos.clone().add(targetPlanetPos);
    const relativePos = absolutePos.sub(currentViewPlanetPos);

    // Interpolate position
    groupRef.current.position.lerp(relativePos, 0.1);
    
    // Interpolate rotation
    const targetQuat = new THREE.Quaternion().setFromEuler(playerRot);
    groupRef.current.quaternion.slerp(targetQuat, 0.1);

    if (shipRef.current) {
      shipRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={shipRef} scale={0.001}>
        {/* Simple Ship Model */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 1, 8]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.8, 0.1, 0.4]} />
          <meshStandardMaterial color="#1e40af" metalness={0.8} />
        </mesh>
        
        {/* Engine Glow */}
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.05, 0.2]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={2} />
        </mesh>
      </group>

      {/* Player Name Tag */}
      <Billboard position={[0, 1.2, 0]} onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}>
        <Text
          fontSize={0.4}
          color={isTargeted ? "#ef4444" : "#ffffff"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {player.displayName}
        </Text>
        {isTargeted && (
          <mesh position={[0, -0.6, 0]}>
            <ringGeometry args={[0.6, 0.7, 4]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </mesh>
        )}
      </Billboard>
    </group>
  );
}

export function OtherPlayers({ 
  players, 
  localUserId, 
  currentPlanetId, 
  solarSystem,
  onTargetPlayer,
  targetId
}: OtherPlayersProps) {
  const otherPlayers = useMemo(() => {
    return players.filter(p => p.uid !== localUserId && p.currentPlanetId === currentPlanetId);
  }, [players, localUserId, currentPlanetId]);

  return (
    <group>
      {otherPlayers.map((player) => (
        <OtherPlayerShip 
          key={player.uid} 
          player={player} 
          currentPlanetId={currentPlanetId}
          solarSystem={solarSystem}
          isTargeted={targetId === player.uid}
          onSelect={() => onTargetPlayer?.(player.uid)}
        />
      ))}
    </group>
  );
}
