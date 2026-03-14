import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { BaseData } from "../services/gameManager";
import { useShipStore } from "../services/shipStore";

const CUBE_WIDTH = 0.06;
const CUBE_HEIGHT = 0.02;

function Base({ data, isMobile }: { data: BaseData; isMobile: boolean }) {
  const lodRef = useRef<THREE.LOD>(null);
  const radarRef = useRef<THREE.Group>(null);
  const levitationRef = useRef<THREE.Mesh>(null);

  const { lockedTarget, setLockedTarget } = useShipStore();

  const isNPC = data.ownerId === "npc";

  const color =
    isNPC
      ? "#888888"
      : data.zone === "high"
      ? "#ef4444"
      : data.zone === "mid"
      ? "#f59e0b"
      : "#3b82f6";

  const height = data.level * 2;
  const totalHeight = height * CUBE_HEIGHT;

  const isSelected = lockedTarget?.id === data.id;

  const handleBaseClick = (e: any) => {
    e.stopPropagation();
    setLockedTarget({ ...data, type: "base" });
  };

  useEffect(() => {
    if (!lodRef.current) return;

    const pos = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );

    const normal = pos.clone().normalize();

    lodRef.current.position.copy(pos);

    lodRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal
    );
  }, [data.position]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (radarRef.current) radarRef.current.rotation.y = t * 1.2;

    if (levitationRef.current) {
      const mat: any = levitationRef.current.material;
      mat.emissiveIntensity = 1 + Math.sin(t * 3) * 0.5;
    }
  });

  /* HIGH DETAIL MODEL */

  const highDetail = (
    <group>

      {/* levitation field */}

      <mesh
        ref={levitationRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
      >
        <torusGeometry args={[0.15, 0.015, 16, 64]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={1}
        />
      </mesh>

      {/* platform */}

      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.02, 24]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.4} />
      </mesh>

      {/* tower */}

      <mesh position={[0, totalHeight * 0.5 + 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.05, totalHeight, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* reactor */}

      <mesh position={[0, totalHeight + 0.06, 0]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#a855f7"
          emissiveIntensity={2}
        />
      </mesh>

      {/* radar */}

      <group ref={radarRef} position={[0.08, totalHeight + 0.03, 0]}>
        <mesh>
          <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
          <meshStandardMaterial color="#9ca3af" />
        </mesh>

        <mesh position={[0.025, 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.02, 0.01, 12, 1, true]} />
          <meshStandardMaterial
            color="#e5e7eb"
            emissive="#22d3ee"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>

      {/* faction decal */}

      {!isNPC && (
        <mesh position={[0, totalHeight * 0.5, 0.08]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );

  /* MEDIUM DETAIL MODEL */

  const mediumDetail = (
    <mesh position={[0, totalHeight * 0.5, 0]}>
      <cylinderGeometry args={[0.12, 0.14, totalHeight, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );

  /* LOW DETAIL MODEL */

  const lowDetail = (
    <mesh position={[0, totalHeight * 0.5, 0]}>
      <cylinderGeometry args={[0.13, 0.13, 0.05, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );

  return (
    <group onClick={handleBaseClick}>

      <primitive ref={lodRef} object={new THREE.LOD()}>

        {/* High detail */}
        <group>
          {highDetail}
        </group>

      </primitive>

      {/* LOD registration */}

      <primitive
        object={(() => {
          const lod = new THREE.LOD();

          lod.addLevel(
            new THREE.Group().add(highDetail as any),
            0
          );

          lod.addLevel(
            new THREE.Group().add(mediumDetail as any),
            isMobile ? 20 : 30
          );

          lod.addLevel(
            new THREE.Group().add(lowDetail as any),
            isMobile ? 60 : 90
          );

          return lod;
        })()}
      />

      {/* selection highlight */}

      {isSelected && (
        <mesh position={[0, totalHeight / 2, 0]}>
          <cylinderGeometry args={[0.2, 0.2, totalHeight + 0.1, 24]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={0.25}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* health bar */}

      {data.health < 100 && (
        <Html position={[0, totalHeight + 0.1, 0]} center>
          <div className="bg-black/80 border border-zinc-700 p-1 rounded w-16 pointer-events-none">
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full"
                style={{ width: `${data.health}%` }}
              />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default Base;
