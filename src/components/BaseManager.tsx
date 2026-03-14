import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { gameManager, BaseData } from '../services/gameManager';
import { useShipStore } from '../services/shipStore';

interface BaseManagerProps {
  planetRadius: number;
  isMobile?: boolean;
}

const CUBE_WIDTH = 0.06;
const CUBE_HEIGHT = 0.02;
const CUBE_DEPTH = 0.06;

const baseGeometry = new THREE.BoxGeometry(1, 1, 1);

function Base({ data, isMobile }: { data: BaseData; isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const highDetailRef = useRef<THREE.Group>(null);
  const lowDetailRef = useRef<THREE.Mesh>(null);
  const minerRef = useRef<THREE.Group>(null);

  const landingLights = useRef<THREE.Group>(null);

  const { camera } = useThree();
  const { lockedTarget, setLockedTarget } = useShipStore();

  const isNPC = data.ownerId === 'npc';

  const color =
    isNPC
      ? '#888888'
      : data.zone === 'high'
      ? '#ef4444'
      : data.zone === 'mid'
      ? '#f59e0b'
      : '#3b82f6';

  const height = data.level * 2;
  const totalHeight = height * CUBE_HEIGHT;

  const isSelected = lockedTarget?.id === data.id;

  const handleBaseClick = (e: any) => {
    e.stopPropagation();
    setLockedTarget({ ...data, type: 'base' });
  };

  useEffect(() => {
    if (!groupRef.current) return;

    const pos = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );

    const normal = pos.clone().normalize();

    groupRef.current.position.copy(pos);

    groupRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );

    const hash = data.id
      .split('')
      .reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);

    groupRef.current.rotateY((hash % 360) * (Math.PI / 180));
  }, [data.position, data.id]);

  useFrame((state) => {
    if (!groupRef.current || !highDetailRef.current || !lowDetailRef.current)
      return;

    if (minerRef.current) {
      minerRef.current.rotation.y = state.clock.elapsedTime * 2;
    }

    if (landingLights.current) {
      landingLights.current.children.forEach((m: any, i) => {
        const mat = m.material;
        mat.emissiveIntensity = 1 + Math.sin(state.clock.elapsedTime * 4 + i) * 0.6;
      });
    }

    const dist = camera.position.distanceTo(groupRef.current.position);

    const maxDist = isMobile ? 12 : 13;
    const fadeDist = isMobile ? 10 : 11;

    if (dist > maxDist) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    let scale = 1;

    if (dist > fadeDist) {
      scale = 1 - (dist - fadeDist) / (maxDist - fadeDist);
      scale = scale * scale;
    }

    groupRef.current.scale.setScalar(scale);

    if (dist > (isMobile ? 6 : 8)) {
      highDetailRef.current.visible = false;
      lowDetailRef.current.visible = true;
    } else {
      highDetailRef.current.visible = true;
      lowDetailRef.current.visible = false;
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={handleBaseClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >

      {/* Selection Highlight */}

      {isSelected && (
        <mesh position={[0, totalHeight / 2, 0]}>
          <cylinderGeometry args={[CUBE_WIDTH * 2.5, CUBE_WIDTH * 2.5, totalHeight + 0.1, 24]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* HIGH DETAIL BASE */}

      <group ref={highDetailRef}>

        {/* Landing Platform */}

        <mesh position={[0, CUBE_HEIGHT * 0.6, 0]} receiveShadow>
          <cylinderGeometry args={[CUBE_WIDTH * 2.4, CUBE_WIDTH * 2.6, CUBE_HEIGHT * 1.4, 24]} />
          <meshStandardMaterial
            color={color}
            metalness={0.8}
            roughness={0.45}
          />
        </mesh>

        {/* Command Tower */}

        <mesh position={[0, totalHeight * 0.5 + CUBE_HEIGHT, 0]} castShadow>
          <cylinderGeometry args={[CUBE_WIDTH * 0.7, CUBE_WIDTH * 0.9, totalHeight, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            metalness={0.85}
            roughness={0.35}
          />
        </mesh>

        {/* Energy Ring */}

        <mesh
          position={[0, totalHeight * 0.7 + CUBE_HEIGHT, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[CUBE_WIDTH * 1.5, 0.01, 10, 32]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* Reactor Core */}

        <mesh position={[0, totalHeight + CUBE_HEIGHT * 1.2, 0]}>
          <sphereGeometry args={[CUBE_WIDTH * 0.45, 16, 16]} />
          <meshStandardMaterial
            color="#a855f7"
            emissive="#a855f7"
            emissiveIntensity={2}
          />
        </mesh>

        {/* Side Modules */}

        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => {
          const x = Math.cos(rot) * CUBE_WIDTH * 1.9;
          const z = Math.sin(rot) * CUBE_WIDTH * 1.9;

          return (
            <group key={i} position={[x, CUBE_HEIGHT * 1.2, z]}>
              <mesh castShadow>
                <boxGeometry args={[CUBE_WIDTH * 0.8, CUBE_HEIGHT * 1.6, CUBE_DEPTH * 0.8]} />
                <meshStandardMaterial
                  color={color}
                  metalness={0.7}
                  roughness={0.4}
                />
              </mesh>

              {/* Antenna */}

              <mesh position={[0, CUBE_HEIGHT, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.04, 8]} />
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#22d3ee"
                  emissiveIntensity={1}
                />
              </mesh>
            </group>
          );
        })}

        {/* LANDING LIGHTS */}

        <group ref={landingLights}>
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => {
            const x = Math.cos(rot) * CUBE_WIDTH * 2.2;
            const z = Math.sin(rot) * CUBE_WIDTH * 2.2;

            return (
              <mesh key={i} position={[x, CUBE_HEIGHT * 0.7, z]}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#22d3ee"
                  emissiveIntensity={1}
                />
              </mesh>
            );
          })}
        </group>

        {/* FACTION DECAL */}

        {!isNPC && (
          <mesh position={[0, totalHeight * 0.5, CUBE_WIDTH * 1]}>
            <planeGeometry args={[0.05, 0.05]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.9}
            />
          </mesh>
        )}

        {/* Miner Indicator */}

        {data.hasMiner && (
          <group ref={minerRef} position={[0, totalHeight + CUBE_HEIGHT * 1.8, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[CUBE_WIDTH * 0.8, 0.006, 8, 24]} />
              <meshStandardMaterial
                color="#a855f7"
                emissive="#a855f7"
                emissiveIntensity={1}
              />
            </mesh>
          </group>
        )}

      </group>

      {/* LOW DETAIL */}

      <mesh
        ref={lowDetailRef}
        geometry={baseGeometry}
        position={[0, totalHeight / 2, 0]}
        scale={[CUBE_WIDTH * 1.2, totalHeight, CUBE_DEPTH * 1.2]}
        visible={false}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>

      {/* HEALTH BAR */}

      {data.health < 100 && (
        <Html position={[0, totalHeight + 0.1, 0]} center distanceFactor={10}>
          <div className="bg-black/80 border border-zinc-700 p-1 rounded w-16 flex flex-col items-center pointer-events-none">
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{ width: `${data.health}%` }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function BaseManager({ planetRadius, isMobile = false }: BaseManagerProps) {
  const [bases, setBases] = useState<BaseData[]>([]);

  useEffect(() => {
    gameManager.onBasesUpdate = (newBases) => {
      setBases(newBases);
    };

    if (gameManager.bases.length === 0) {
      gameManager.init();
    } else {
      setBases(gameManager.bases);
    }

    return () => {
      gameManager.onBasesUpdate = null;
    };
  }, []);

  return (
    <group>
      {bases.map((base) => (
        <Base key={base.id} data={base} isMobile={isMobile} />
      ))}
    </group>
  );
}
