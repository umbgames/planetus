import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import {
  Rocket,
  Zap,
  Shield,
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Crown,
  Gauge,
  Orbit,
  Swords,
  Bomb,
  Sparkles,
} from 'lucide-react';
import { gameManager, UserData } from '../services/gameManager';
import { SharedMegaShipModel, SharedShipModel, normalizeShipType } from './SharedShipModels';

interface ShipUpgradeUIProps {
  userData: UserData | null;
  onClose: () => void;
}

type ShipId = 'scout' | 'phantom' | 'lancer' | 'destroyer' | 'megaship';

type ShipEntry = {
  id: ShipId;
  name: string;
  description: string;
  price: { common: number; rare: number };
  stats: { health: number; speed: number; agility: number; damage: number };
  category: 'ship' | 'station';
  icon: React.ReactNode;
};

function statRatio(value: number, max: number) {
  return Math.max(0, Math.min(1, value / max));
}

function GlowCore({
  position,
  scale = [1, 1, 1],
  color = '#00f0ff',
  intensity = 4,
  opacity = 0.9,
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
  intensity?: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.2, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

function StripLight({
  position,
  rotation = [0, 0, 0],
  size = [0.1, 0.05, 0.7],
  color = '#00f0ff',
  intensity = 5,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  intensity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
  );
}

function HullMaterial({
  color = '#1a1f2a',
  emissive = '#000000',
  emissiveIntensity = 0,
  metalness = 0.88,
  roughness = 0.24,
}: {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

function PanelLine({
  position,
  rotation = [0, 0, 0],
  size = [0.02, 0.01, 0.3],
  color = '#38404f',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.72} roughness={0.46} />
    </mesh>
  );
}

function GreebleCluster({
  positions,
  scale = [1, 1, 1],
  color = '#222834',
}: {
  positions: [number, number, number][];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <group scale={scale}>
      {positions.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.08, 0.05 + (i % 3) * 0.02, 0.08 + (i % 2) * 0.05]} />
          <meshStandardMaterial color={color} metalness={0.85} roughness={0.34} />
        </mesh>
      ))}
    </group>
  );
}

function EngineBell({
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  color = '#111318',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 0.22, 20, 1, true]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.28} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.12, 24]} />
        <meshStandardMaterial color="#3b4659" metalness={0.9} roughness={0.2} emissive="#0c1625" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function EngineFX({
  position,
  color = '#00f0ff',
  radius = 0.16,
  length = 1,
  flickerOffset = 0,
}: {
  position: [number, number, number];
  color?: string;
  radius?: number;
  length?: number;
  flickerOffset?: number;
}) {
  const coreRef = useRef<THREE.Mesh>(null!);
  const plumeRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 3 + flickerOffset;
    const pulse = 0.9 + Math.sin(t * 2.7) * 0.08 + Math.sin(t * 5.1) * 0.04;

    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }

    if (plumeRef.current) {
      plumeRef.current.scale.x = pulse;
      plumeRef.current.scale.y = pulse;
      plumeRef.current.scale.z = 0.9 + Math.sin(t * 3.3) * 0.14;
      plumeRef.current.position.z = 0.18 + Math.sin(t * 2.2) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += 0.05;
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.11 + Math.sin(t * 2.4) * 0.03;
    }
  });

  return (
    <group position={position}>
      <GlowCore position={[0, 0, 0]} scale={[radius * 3.2, radius * 2.3, radius * 2.3]} color={color} intensity={6} />
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={8}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={plumeRef} position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[radius * 0.95, length, 18, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={5}
          transparent
          opacity={0.38}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.18 + length * 0.45]}>
        <ringGeometry args={[radius * 0.9, radius * 1.6, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ExhaustTrail({
  position,
  color = '#00f0ff',
  radius = 0.2,
  length = 2.2,
  flickerOffset = 0,
}: {
  position: [number, number, number];
  color?: string;
  radius?: number;
  length?: number;
  flickerOffset?: number;
}) {
  const trailRef = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 2.1 + flickerOffset;
    if (trailRef.current) {
      trailRef.current.scale.x = 1 + Math.sin(t * 3.2) * 0.06;
      trailRef.current.scale.y = 1 + Math.sin(t * 2.8) * 0.08;
      trailRef.current.scale.z = 1 + Math.sin(t * 4.1) * 0.1;
      trailRef.current.position.z = length * 0.5 + Math.sin(t * 1.5) * 0.04;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += 0.015;
      const material = haloRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.05 + Math.sin(t * 2.4) * 0.015;
    }
  });

  return (
    <group position={position}>
      <mesh ref={trailRef} position={[0, 0, length * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.42, radius, length, 18, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          transparent
          opacity={0.18}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, length * 0.75]}>
        <ringGeometry args={[radius * 0.7, radius * 1.4, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ShieldField({
  radius = 1,
  color = '#3bcfff',
  opacity = 0.08,
  scale = [1, 1, 1],
}: {
  radius?: number;
  color?: string;
  opacity?: number;
  scale?: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y += 0.0035;
      ref.current.rotation.z = Math.sin(t * 0.35) * 0.08;
      const material = ref.current.material as THREE.MeshStandardMaterial;
      material.opacity = opacity + Math.sin(t * 1.4) * 0.015;
    }
  });

  return (
    <mesh ref={ref} scale={scale}>
      <icosahedronGeometry args={[radius, 2]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.7}
        metalness={0.15}
        roughness={0.1}
        transparent
        opacity={opacity}
        wireframe={false}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SurfacePanels({
  rows = 2,
  cols = 4,
  width = 1,
  depth = 2,
  y = 0.12,
  inset = 0.02,
  color = '#2a3240',
}: {
  rows?: number;
  cols?: number;
  width?: number;
  depth?: number;
  y?: number;
  inset?: number;
  color?: string;
}) {
  const panels = useMemo(() => {
    const items: [number, number, number, number, number, number][] = [];
    const stepX = width / cols;
    const stepZ = depth / rows;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const w = stepX - inset;
        const d = stepZ - inset;
        const x = -width / 2 + stepX * c + stepX / 2;
        const z = -depth / 2 + stepZ * r + stepZ / 2;
        items.push([x, y, z, w, 0.012, d]);
      }
    }
    return items;
  }, [rows, cols, width, depth, y, inset]);

  return (
    <group>
      {panels.map((panel, i) => (
        <mesh key={i} position={[panel[0], panel[1], panel[2]]} castShadow>
          <boxGeometry args={[panel[3], panel[4], panel[5]]} />
          <meshStandardMaterial color={color} metalness={0.92} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function ScoutClassic() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.08, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.38, 0.28, 2.25]} />
        <HullMaterial color="#1f232b" roughness={0.21} />
      </mesh>

      <SurfacePanels rows={5} cols={2} width={0.34} depth={2.0} y={0.145} color="#2a313d" />

      <mesh position={[0.02, 0.01, 0.2]} castShadow>
        <boxGeometry args={[2.35, 0.05, 0.58]} />
        <HullMaterial color="#11151c" roughness={0.16} metalness={0.96} />
      </mesh>
      <mesh position={[-0.03, -0.02, -0.55]} castShadow rotation={[0, 0.04, 0]}>
        <boxGeometry args={[1.24, 0.05, 0.42]} />
        <HullMaterial color="#12161e" roughness={0.17} metalness={0.95} />
      </mesh>

      <mesh position={[0.08, 0.2, -0.22]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.72]} />
        <meshStandardMaterial color="#04070c" metalness={1} roughness={0.06} emissive="#0b2340" emissiveIntensity={0.7} />
      </mesh>

      <mesh position={[-0.48, 0.06, 0.4]} rotation={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.14, 0.12, 0.58]} />
        <HullMaterial color="#202734" roughness={0.34} />
      </mesh>
      <mesh position={[0.42, -0.03, -0.4]} rotation={[0, -0.14, 0]} castShadow>
        <boxGeometry args={[0.1, 0.08, 0.42]} />
        <HullMaterial color="#272d39" roughness={0.36} />
      </mesh>

      <mesh position={[-0.72, 0.0, 0.3]} castShadow rotation={[0, 0.15, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.18]} />
        <HullMaterial color="#1d2330" roughness={0.28} />
      </mesh>
      <mesh position={[0.75, 0.0, 0.12]} castShadow rotation={[0, -0.12, 0]}>
        <boxGeometry args={[0.36, 0.08, 0.16]} />
        <HullMaterial color="#1d2330" roughness={0.28} />
      </mesh>

      <GreebleCluster
        positions={[
          [-0.09, 0.16, 0.78],
          [0.09, 0.15, 0.92],
          [-0.08, -0.11, 0.65],
          [0.1, -0.12, 0.76],
          [0.02, 0.12, -0.9],
        ]}
        color="#2d3441"
      />

      <PanelLine position={[0, 0.145, 0.65]} size={[0.22, 0.014, 0.03]} color="#4b576d" />
      <PanelLine position={[0, 0.145, 0.05]} size={[0.18, 0.014, 0.03]} color="#4b576d" />
      <StripLight position={[-0.12, 0.13, 0.45]} size={[0.02, 0.02, 0.42]} color="#00d7ff" intensity={3.6} />
      <StripLight position={[0.12, 0.13, 0.4]} size={[0.02, 0.02, 0.35]} color="#5be0ff" intensity={3.2} />

      <EngineBell position={[0, 0, 1.02]} scale={[1.4, 1.2, 1.2]} />
      <EngineFX position={[0, 0, 1.15]} scale={undefined} color="#00f0ff" radius={0.15} length={0.8} />
      <ExhaustTrail position={[0, 0, 1.23]} color="#5beeff" radius={0.2} length={1.7} />
      <ShieldField radius={1.42} opacity={0.06} color="#49d7ff" scale={[1.2, 0.72, 1.62]} />
    </group>
  );
}

function PhantomShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.1, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.95, 0.12, 2.9]} />
        <HullMaterial color="#07090d" metalness={0.83} roughness={0.38} />
      </mesh>

      <SurfacePanels rows={6} cols={2} width={0.84} depth={2.46} y={0.07} color="#141923" />

      <mesh position={[-1.2, 0, -0.18]} rotation={[0, -0.62, 0]} castShadow>
        <boxGeometry args={[1.9, 0.08, 0.62]} />
        <HullMaterial color="#0a0d14" metalness={0.93} roughness={0.29} />
      </mesh>
      <mesh position={[1.2, 0, -0.18]} rotation={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[1.72, 0.08, 0.56]} />
        <HullMaterial color="#0a0d14" metalness={0.93} roughness={0.29} />
      </mesh>

      <mesh position={[0.03, 0.085, 0.84]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.66]} />
        <HullMaterial color="#181d26" metalness={0.73} roughness={0.5} />
      </mesh>

      <mesh position={[-0.56, 0.02, 0.54]} rotation={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[0.34, 0.06, 0.92]} />
        <HullMaterial color="#121721" metalness={0.88} roughness={0.35} />
      </mesh>
      <mesh position={[0.63, -0.01, 0.2]} rotation={[0, -0.11, 0]} castShadow>
        <boxGeometry args={[0.28, 0.05, 0.78]} />
        <HullMaterial color="#121721" metalness={0.88} roughness={0.35} />
      </mesh>

      <GreebleCluster
        positions={[
          [-0.22, 0.07, 0.7],
          [0.22, 0.07, 0.76],
          [-0.14, 0.06, -0.42],
          [0.16, 0.06, -0.66],
          [0.0, 0.07, 1.08],
        ]}
        scale={[0.9, 0.8, 1]}
        color="#1e2530"
      />

      <StripLight position={[-0.4, 0.065, 0.02]} size={[0.022, 0.018, 1.7]} color="#ff003c" intensity={4.6} />
      <StripLight position={[0.4, 0.065, -0.04]} size={[0.022, 0.018, 1.55]} color="#ff003c" intensity={4.6} />
      <StripLight position={[0, 0.078, 1.05]} size={[0.18, 0.016, 0.28]} color="#7c1737" intensity={2.4} />
      <PanelLine position={[0, 0.072, -0.95]} size={[0.44, 0.01, 0.02]} color="#31394a" />

      <EngineBell position={[-0.25, 0, 1.28]} scale={[1, 0.9, 0.9]} />
      <EngineBell position={[0.25, 0, 1.28]} scale={[1, 0.9, 0.9]} />
      <EngineFX position={[-0.25, 0, 1.45]} color="#ff1d55" radius={0.09} length={0.62} flickerOffset={0.4} />
      <EngineFX position={[0.25, 0, 1.45]} color="#ff1d55" radius={0.09} length={0.62} flickerOffset={1.2} />
      <ExhaustTrail position={[-0.25, 0, 1.52]} color="#ff4a72" radius={0.12} length={1.35} flickerOffset={0.2} />
      <ExhaustTrail position={[0.25, 0, 1.52]} color="#ff4a72" radius={0.12} length={1.35} flickerOffset={1.1} />
      <ShieldField radius={1.7} opacity={0.055} color="#ff3d8d" scale={[1.45, 0.48, 1.92]} />
    </group>
  );
}

function LancerShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.1, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.36, 3.9]} />
        <HullMaterial color="#181c24" roughness={0.19} />
      </mesh>

      <SurfacePanels rows={7} cols={2} width={0.3} depth={3.4} y={0.19} color="#2b3240" />

      <mesh position={[-0.31, 0.0, -1.2]} castShadow rotation={[0.02, 0.03, 0]}>
        <boxGeometry args={[0.16, 0.46, 2.24]} />
        <HullMaterial color="#252938" roughness={0.27} metalness={0.82} />
      </mesh>
      <mesh position={[0.3, 0.0, -1.14]} castShadow rotation={[-0.01, -0.02, 0]}>
        <boxGeometry args={[0.14, 0.42, 2.08]} />
        <HullMaterial color="#262b39" roughness={0.29} metalness={0.82} />
      </mesh>

      <mesh position={[0, 0.02, -1.18]} castShadow>
        <boxGeometry args={[0.1, 0.1, 2.3]} />
        <meshStandardMaterial color="#6f3cff" emissive="#b026ff" emissiveIntensity={2.8} metalness={0.72} roughness={0.2} toneMapped={false} />
      </mesh>

      <mesh position={[-0.62, 0.0, 1.24]} rotation={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[1.22, 0.05, 0.82]} />
        <HullMaterial color="#10141b" roughness={0.18} metalness={0.94} />
      </mesh>
      <mesh position={[0.63, 0.01, 1.16]} rotation={[0, -0.05, 0]} castShadow>
        <boxGeometry args={[1.1, 0.05, 0.76]} />
        <HullMaterial color="#10141b" roughness={0.18} metalness={0.94} />
      </mesh>

      <mesh position={[-0.1, 0.24, 0.94]} castShadow rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.86]} />
        <HullMaterial color="#202633" roughness={0.25} />
      </mesh>

      <GreebleCluster
        positions={[
          [-0.09, 0.22, 1.32],
          [0.11, 0.21, 1.1],
          [-0.08, 0.18, 0.54],
          [0.08, 0.18, 0.25],
          [0.0, -0.11, 1.5],
        ]}
        color="#2e3544"
      />

      <StripLight position={[0, 0.2, 0.85]} size={[0.06, 0.05, 1.24]} color="#b026ff" intensity={4.2} />
      <StripLight position={[-0.18, 0.13, -0.3]} size={[0.018, 0.018, 0.82]} color="#8a5fff" intensity={3.2} />
      <StripLight position={[0.18, 0.13, -0.18]} size={[0.018, 0.018, 0.7]} color="#d6a9ff" intensity={3.2} />
      <PanelLine position={[0, 0.19, -0.52]} size={[0.12, 0.014, 0.02]} color="#5b4ea5" />

      <EngineBell position={[0, 0, 1.8]} scale={[1.5, 1.4, 1.4]} />
      <EngineFX position={[0, 0, 1.98]} color="#d6a9ff" radius={0.16} length={0.98} flickerOffset={0.3} />
      <ExhaustTrail position={[0, 0, 2.08]} color="#c99eff" radius={0.22} length={2.0} flickerOffset={0.8} />
      <ShieldField radius={1.58} opacity={0.06} color="#b17cff" scale={[0.95, 0.72, 2.22]} />
    </group>
  );
}

function DestroyerShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.62, 0.82, 3.88]} />
        <HullMaterial color="#1a1d24" metalness={0.84} roughness={0.37} />
      </mesh>

      <SurfacePanels rows={6} cols={4} width={1.38} depth={3.28} y={0.42} color="#252c38" />

      <mesh position={[-1.2, 0, 0.24]} castShadow rotation={[0.01, 0.02, 0]}>
        <boxGeometry args={[0.82, 0.62, 2.86]} />
        <HullMaterial color="#13161d" metalness={0.87} roughness={0.29} />
      </mesh>
      <mesh position={[1.22, 0.02, 0.14]} castShadow rotation={[-0.01, -0.03, 0]}>
        <boxGeometry args={[0.74, 0.58, 2.72]} />
        <HullMaterial color="#14171e" metalness={0.87} roughness={0.29} />
      </mesh>

      <mesh position={[0, 0.68, -0.84]} castShadow rotation={[0.04, 0, 0]}>
        <boxGeometry args={[0.92, 0.52, 1.24]} />
        <HullMaterial color="#0d1016" metalness={0.93} roughness={0.19} />
      </mesh>

      <mesh position={[-0.55, 0.18, -1.32]} castShadow>
        <boxGeometry args={[0.28, 0.16, 0.7]} />
        <HullMaterial color="#202733" roughness={0.31} />
      </mesh>
      <mesh position={[0.54, 0.14, -1.1]} castShadow>
        <boxGeometry args={[0.34, 0.2, 0.86]} />
        <HullMaterial color="#202733" roughness={0.31} />
      </mesh>

      <mesh position={[-1.68, 0.14, -0.2]} castShadow rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.26, 0.18, 1.64]} />
        <HullMaterial color="#212733" roughness={0.32} />
      </mesh>
      <mesh position={[1.66, 0.08, 0.35]} castShadow rotation={[0, 0, 0.06]}>
        <boxGeometry args={[0.24, 0.16, 1.46]} />
        <HullMaterial color="#212733" roughness={0.32} />
      </mesh>

      <mesh position={[-0.84, 0.52, 0.54]} castShadow>
        <boxGeometry args={[0.14, 0.18, 1.86]} />
        <HullMaterial color="#262d38" roughness={0.32} />
      </mesh>
      <mesh position={[0.82, 0.48, 0.36]} castShadow>
        <boxGeometry args={[0.12, 0.16, 1.7]} />
        <HullMaterial color="#262d38" roughness={0.32} />
      </mesh>

      <GreebleCluster
        positions={[
          [-0.42, 0.44, 1.15],
          [0.3, 0.44, 1.32],
          [-0.2, 0.43, 0.38],
          [0.52, 0.43, -0.1],
          [-0.08, -0.28, 1.48],
          [0.1, -0.3, 1.2],
        ]}
        scale={[1.2, 1.1, 1.1]}
        color="#303846"
      />

      <StripLight position={[0, 0.72, -1.46]} size={[0.64, 0.05, 0.05]} color="#ffaa00" intensity={4.6} />
      <StripLight position={[-0.82, 0.42, 0.55]} size={[0.05, 0.05, 2.02]} color="#ff5500" intensity={3.6} />
      <StripLight position={[0.82, 0.41, 0.45]} size={[0.05, 0.05, 1.92]} color="#ff5500" intensity={3.6} />
      <StripLight position={[0.0, -0.16, 1.1]} size={[0.5, 0.03, 1.2]} color="#5d1d0f" intensity={1.8} />
      <PanelLine position={[0, 0.42, 1.38]} size={[0.88, 0.02, 0.03]} color="#465160" />

      <EngineBell position={[-1.2, 0, 1.45]} scale={[1.45, 1.2, 1.2]} />
      <EngineBell position={[1.2, 0, 1.45]} scale={[1.45, 1.2, 1.2]} />
      <EngineBell position={[0, 0, 1.78]} scale={[1.8, 1.35, 1.35]} />
      <EngineFX position={[-1.2, 0, 1.66]} color="#ff3300" radius={0.15} length={0.82} flickerOffset={0.2} />
      <EngineFX position={[1.2, 0, 1.66]} color="#ff3300" radius={0.15} length={0.82} flickerOffset={1.4} />
      <EngineFX position={[0, 0, 1.96]} color="#ff661a" radius={0.18} length={1.05} flickerOffset={0.8} />
      <ExhaustTrail position={[-1.2, 0, 1.76]} color="#ff7f3a" radius={0.18} length={1.7} flickerOffset={0.5} />
      <ExhaustTrail position={[1.2, 0, 1.76]} color="#ff7f3a" radius={0.18} length={1.7} flickerOffset={1.1} />
      <ExhaustTrail position={[0, 0, 2.1]} color="#ffb066" radius={0.24} length={2.25} flickerOffset={1.7} />
      <ShieldField radius={2.28} opacity={0.05} color="#ff8b4d" scale={[1.28, 0.78, 1.72]} />
    </group>
  );
}

function MegaShipModel() {
  const radarRef = useRef<THREE.Group>(null!);
  const leftDoorRef = useRef<THREE.Group>(null!);
  const rightDoorRef = useRef<THREE.Group>(null!);
  const hangarGlowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (radarRef.current) {
      radarRef.current.rotation.y += 0.018;
      radarRef.current.rotation.z = Math.sin(t * 0.35) * 0.05;
    }

    const openAmount = (Math.sin(t * 0.65) * 0.5 + 0.5) * 0.42;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = -0.55 - openAmount;
      leftDoorRef.current.rotation.y = -openAmount * 0.4;
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = 0.55 + openAmount;
      rightDoorRef.current.rotation.y = openAmount * 0.4;
    }

    if (hangarGlowRef.current) {
      const material = hangarGlowRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 1.4 + Math.sin(t * 2.1) * 0.35;
      material.opacity = 0.45 + Math.sin(t * 1.2) * 0.08;
    }
  });

  return (
    <group rotation={[0.05, Math.PI, 0]} position={[0, -0.2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[3.9, 0.72, 6.1]} />
        <HullMaterial color="#101318" metalness={0.88} roughness={0.28} />
      </mesh>

      <SurfacePanels rows={8} cols={5} width={3.25} depth={5.5} y={0.37} color="#1f2733" />

      <mesh position={[0, 0.02, -1.3]} castShadow>
        <boxGeometry args={[2.8, 0.24, 2.2]} />
        <HullMaterial color="#161b23" metalness={0.86} roughness={0.42} />
      </mesh>

      <mesh position={[-1.65, 0.24, 0.25]} castShadow rotation={[0, 0.04, 0]}>
        <boxGeometry args={[0.42, 0.34, 3.68]} />
        <HullMaterial color="#171d27" roughness={0.32} />
      </mesh>
      <mesh position={[1.58, 0.2, -0.12]} castShadow rotation={[0, -0.03, 0]}>
        <boxGeometry args={[0.5, 0.32, 3.95]} />
        <HullMaterial color="#171d27" roughness={0.32} />
      </mesh>

      <mesh position={[-0.94, 0.52, -0.55]} castShadow>
        <boxGeometry args={[0.58, 0.18, 4.72]} />
        <HullMaterial color="#0d1218" metalness={0.93} roughness={0.5} />
      </mesh>
      <mesh position={[0.94, 0.52, -0.55]} castShadow>
        <boxGeometry args={[0.58, 0.18, 4.72]} />
        <HullMaterial color="#0d1218" metalness={0.93} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.52, -0.55]} castShadow>
        <boxGeometry args={[0.18, 0.12, 4.72]} />
        <meshStandardMaterial color="#0d1015" metalness={0.94} roughness={0.5} emissive="#032436" emissiveIntensity={0.25} />
      </mesh>

      <mesh position={[1.63, 0.92, 0.82]} castShadow rotation={[0, -0.05, 0]}>
        <boxGeometry args={[0.54, 1.24, 1.5]} />
        <HullMaterial color="#1a1f29" metalness={0.77} roughness={0.28} />
      </mesh>
      <mesh position={[1.8, 1.42, 0.98]} castShadow>
        <boxGeometry args={[0.24, 0.42, 0.52]} />
        <HullMaterial color="#202633" metalness={0.75} roughness={0.3} />
      </mesh>

      <mesh position={[-1.58, 0.64, 0.86]} castShadow rotation={[0, 0.08, 0]}>
        <boxGeometry args={[0.34, 0.62, 0.84]} />
        <HullMaterial color="#1b202a" metalness={0.77} roughness={0.3} />
      </mesh>
      <mesh position={[-1.76, 1.02, 0.76]} castShadow>
        <boxGeometry args={[0.12, 0.44, 0.16]} />
        <HullMaterial color="#2a3240" roughness={0.24} />
      </mesh>
      <mesh position={[-1.46, 1.16, 0.95]} castShadow>
        <boxGeometry args={[0.08, 0.62, 0.08]} />
        <HullMaterial color="#2a3240" roughness={0.24} />
      </mesh>

      <group position={[0, 0.46, -1.44]}>
        <mesh castShadow>
          <boxGeometry args={[1.58, 0.08, 0.76]} />
          <HullMaterial color="#0a0d12" metalness={0.9} roughness={0.48} />
        </mesh>

        <group ref={leftDoorRef} position={[-0.55, 0.02, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.06, 0.72]} />
            <HullMaterial color="#1a202a" metalness={0.86} roughness={0.26} />
          </mesh>
          <StripLight position={[0, 0.04, 0]} size={[0.03, 0.01, 0.56]} color="#00f0ff" intensity={2.8} />
        </group>

        <group ref={rightDoorRef} position={[0.55, 0.02, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.06, 0.72]} />
            <HullMaterial color="#1a202a" metalness={0.86} roughness={0.26} />
          </mesh>
          <StripLight position={[0, 0.04, 0]} size={[0.03, 0.01, 0.56]} color="#00f0ff" intensity={2.8} />
        </group>

        <mesh ref={hangarGlowRef} position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.44]} />
          <meshStandardMaterial
            color="#082f46"
            emissive="#00cfff"
            emissiveIntensity={1.6}
            transparent
            opacity={0.48}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <group ref={radarRef} position={[1.95, 1.55, 0.55]}>
        <mesh castShadow rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.36, 12]} />
          <meshStandardMaterial color="#3b4659" metalness={0.88} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.18, 0.02, 10, 28, Math.PI]} />
          <meshStandardMaterial color="#8894aa" metalness={0.9} roughness={0.18} emissive="#113355" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.12, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <sphereGeometry args={[0.03, 14, 14]} />
          <meshStandardMaterial color="#cce6ff" emissive="#69d5ff" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>

      <mesh position={[-0.22, 0.18, 1.7]} castShadow>
        <boxGeometry args={[1.2, 0.12, 1.22]} />
        <HullMaterial color="#1b212c" roughness={0.32} />
      </mesh>
      <mesh position={[1.22, 0.14, 1.95]} castShadow>
        <boxGeometry args={[0.82, 0.1, 0.96]} />
        <HullMaterial color="#1d2430" roughness={0.33} />
      </mesh>

      <GreebleCluster
        positions={[
          [-1.2, 0.66, 1.72],
          [-0.84, 0.68, 1.44],
          [0.82, 0.66, 1.62],
          [1.26, 0.66, 1.28],
          [0.02, 0.64, 1.95],
          [0.35, 0.64, 1.58],
          [-0.12, -0.25, 2.3],
          [0.28, -0.25, 2.44],
        ]}
        scale={[1.5, 1.25, 1.4]}
        color="#2d3542"
      />

      <StripLight position={[-0.92, 0.58, -0.55]} size={[0.06, 0.02, 4.22]} color="#00f0ff" intensity={3.4} />
      <StripLight position={[0.92, 0.58, -0.55]} size={[0.06, 0.02, 4.22]} color="#00f0ff" intensity={3.4} />
      <StripLight position={[0, 0.58, -0.55]} size={[0.024, 0.02, 4.22]} color="#00f0ff" intensity={2.8} />
      <StripLight position={[1.62, 1.22, 0.12]} size={[0.03, 0.03, 0.78]} color="#ffd266" intensity={3.2} />
      <StripLight position={[-1.58, 0.9, 0.9]} size={[0.02, 0.02, 0.42]} color="#7be7ff" intensity={2.6} />
      <PanelLine position={[0, 0.37, 2.52]} size={[2.8, 0.02, 0.04]} color="#445063" />
      <PanelLine position={[0, -0.36, 0.42]} size={[3.1, 0.02, 0.04]} color="#313b49" />

      <EngineBell position={[-1.3, 0, 2.86]} scale={[1.65, 1.2, 1.2]} />
      <EngineBell position={[0, 0, 2.86]} scale={[2, 1.45, 1.45]} />
      <EngineBell position={[1.3, 0, 2.86]} scale={[1.65, 1.2, 1.2]} />
      <EngineFX position={[-1.3, 0, 3.12]} color="#00aaff" radius={0.17} length={1.15} flickerOffset={0.4} />
      <EngineFX position={[0, 0, 3.12]} color="#00f0ff" radius={0.22} length={1.4} flickerOffset={1.2} />
      <EngineFX position={[1.3, 0, 3.12]} color="#00aaff" radius={0.17} length={1.15} flickerOffset={2.1} />
      <ExhaustTrail position={[-1.3, 0, 3.26]} color="#73d5ff" radius={0.23} length={2.3} flickerOffset={0.5} />
      <ExhaustTrail position={[0, 0, 3.32]} color="#8df6ff" radius={0.32} length={2.9} flickerOffset={1.1} />
      <ExhaustTrail position={[1.3, 0, 3.26]} color="#73d5ff" radius={0.23} length={2.3} flickerOffset={1.8} />
      <ShieldField radius={3.48} opacity={0.04} color="#4fd6ff" scale={[1.12, 0.54, 1.38]} />
    </group>
  );
}

function ShipModel({ type }: { type: ShipId }) {
  if (type === 'scout') return <ScoutClassic />;
  if (type === 'phantom') return <PhantomShip />;
  if (type === 'lancer') return <LancerShip />;
  if (type === 'destroyer') return <DestroyerShip />;
  return <MegaShipModel />;
}

function StarField() {
  const stars = useMemo(() => {
    const points: Array<{ position: [number, number, number]; size: number; color: string }> = [];
    for (let i = 0; i < 220; i += 1) {
      points.push({
        position: [
          (Math.random() - 0.5) * 34,
          Math.random() * 18 - 6,
          (Math.random() - 0.5) * 34,
        ],
        size: 0.01 + Math.random() * 0.028,
        color:
          Math.random() > 0.93
            ? '#7ce7ff'
            : Math.random() > 0.86
            ? '#caa7ff'
            : '#ffffff',
      });
    }
    return points;
  }, []);

  return (
    <group>
      {stars.map((star, i) => (
        <mesh key={i} position={star.position}>
          <sphereGeometry args={[star.size, 8, 8]} />
          <meshBasicMaterial color={star.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function DockRings() {
  const outerRef = useRef<THREE.Mesh>(null!);
  const innerRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (outerRef.current) {
      outerRef.current.rotation.z += 0.0025;
      const material = outerRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.05 + Math.sin(t * 0.8) * 0.01;
    }
    if (innerRef.current) {
      innerRef.current.rotation.z -= 0.003;
      const material = innerRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.16 + Math.sin(t * 1.1) * 0.02;
    }
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.61, 0]} ref={innerRef}>
        <ringGeometry args={[1.9, 2.02, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.15} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.61, 0]} ref={outerRef}>
        <ringGeometry args={[2.78, 2.86, 64]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.05} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </>
  );
}

function ShipShowcase({ ship }: { ship: ShipEntry }) {
  return (
    <div className="relative h-[56vh] min-h-[460px] w-full overflow-hidden bg-[#020617]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,240,255,0.08),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(176,38,255,0.08),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(255,120,40,0.06),transparent_38%),linear-gradient(180deg,#020617_0%,#090e1a_100%)]" />

      <Canvas
        camera={{ position: [0, 1.2, 8.2], fov: 34 }}
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 6, 24]} />

        <ambientLight intensity={0.26} />
        <directionalLight
          position={[8, 10, 6]}
          intensity={2.9}
          color="#e4f1ff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00008}
        />
        <spotLight
          position={[-7, 7, 5]}
          angle={0.45}
          penumbra={0.85}
          intensity={1.4}
          color="#7fdfff"
          castShadow
        />
        <pointLight position={[0, 2.4, -3.4]} intensity={3.2} color="#00f0ff" />
        <pointLight position={[-3.6, -1.2, 4.4]} intensity={2.3} color="#b026ff" />
        <pointLight position={[4.4, -0.6, 3.4]} intensity={1.4} color="#ff7a2b" />
        <pointLight position={[0, -1.1, 5.8]} intensity={1.1} color="#6ee9ff" />

        <StarField />

        <Float speed={1.4} rotationIntensity={0.16} floatIntensity={0.3}>
          <group position={[0, 0.04, 0]}>
            {ship.category === 'station' ? <SharedMegaShipModel /> : <SharedShipModel type={ship.id} />}
          </group>
        </Float>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
          <circleGeometry args={[12, 64]} />
          <meshStandardMaterial color="#050812" roughness={0.82} metalness={0.28} />
        </mesh>

        <DockRings />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.9}
          maxPolarAngle={Math.PI / 1.9}
          autoRotate
          autoRotateSpeed={0.58}
        />
        <Environment preset="city" />
      </Canvas>

      <div className="pointer-events-none absolute left-8 top-8">
        <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-500">Fleet View</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{ship.name}</div>
        <div className="mt-1 text-sm text-slate-400">
          {ship.category === 'station' ? 'capital command asset' : 'tactical hull preview'}
        </div>
      </div>

      <div className="pointer-events-none absolute right-8 top-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-cyan-500">
        <Sparkles size={14} />
        live 3d
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  max,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  icon: React.ReactNode;
}) {
  const width = statRatio(value, max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
          <span className="text-cyan-500">{icon}</span>
          <span>{label}</span>
        </div>
        <div className="text-sm font-medium text-white">{value}</div>
      </div>
      <div className="h-[5px] bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export const ShipUpgradeUI: React.FC<ShipUpgradeUIProps> = ({ userData, onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const assets = useMemo<ShipEntry[]>(
    () => [
      {
        id: 'scout',
        name: 'Scout',
        description: 'Standard deployed starter hull. Sleek, sharp interceptor optimized for atmospheric entry.',
        price: { common: 0, rare: 0 },
        stats: { health: 100, speed: 100, agility: 100, damage: 10 },
        category: 'ship',
        icon: <Rocket size={16} />,
      },
      {
        id: 'phantom',
        name: 'Phantom',
        description: 'A stealth-leaning blade frame with swept wings, minimal radar cross-section, and silent drives.',
        price: { common: 2600, rare: 650 },
        stats: { health: 220, speed: 90, agility: 86, damage: 24 },
        category: 'ship',
        icon: <Orbit size={16} />,
      },
      {
        id: 'lancer',
        name: 'Lancer',
        description: 'Long-form sniper hull built around a central energy accelerator. Elite precision and forward pressure.',
        price: { common: 6200, rare: 1800 },
        stats: { health: 190, speed: 96, agility: 80, damage: 34 },
        category: 'ship',
        icon: <Swords size={16} />,
      },
      {
        id: 'destroyer',
        name: 'Destroyer',
        description: 'Heavy tactical cruiser. Dense armored block chassis, overwhelming reactor output, and upgraded weapons geometry.',
        price: { common: 11800, rare: 3600 },
        stats: { health: 580, speed: 46, agility: 34, damage: 72 },
        category: 'ship',
        icon: <Bomb size={16} />,
      },
      {
        id: 'megaship',
        name: 'Aegis Command',
        description: 'A capital-scale mobile command carrier. Hosts internal flight decks for fleet coordination and orbital control.',
        price: { common: 26000, rare: 11000 },
        stats: { health: 1100, speed: 20, agility: 14, damage: 150 },
        category: 'station',
        icon: <Crown size={16} />,
      },
    ],
    []
  );

  const activeAsset = assets[activeIndex];
  const currentShipType = normalizeShipType(userData?.shipConfig?.type);

  const canAfford =
    (userData?.commonResources || 0) >= activeAsset.price.common &&
    (userData?.rareResources || 0) >= activeAsset.price.rare;

  const isCurrentShip = activeAsset.category === 'ship' && currentShipType === activeAsset.id;
  const currentUpgradeLevel = (userData?.shipConfig?.addons || []).filter((addon) => /^upgrade_mk_\d+$/.test(addon)).length;
  const upgradePrice = { common: Math.round(600 * Math.pow(1.7, currentUpgradeLevel)), rare: Math.round(140 * Math.pow(1.6, currentUpgradeLevel)) };
  const canUpgrade = isCurrentShip && currentUpgradeLevel < 5 && (userData?.commonResources || 0) >= upgradePrice.common && (userData?.rareResources || 0) >= upgradePrice.rare;

  const handleAcquire = async () => {
    setLoading(activeAsset.id);
    try {
      if (activeAsset.id === 'megaship') {
        if (userData?.currentPlanetId) {
          await gameManager.buySpaceStation(userData.currentPlanetId);
        }
      } else {
        await gameManager.buyShip(activeAsset.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async () => {
    setLoading(`${activeAsset.id}-upgrade`);
    try {
      await gameManager.upgradeShip();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] text-slate-200">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="mx-auto flex h-screen max-w-[1650px] flex-col px-4 py-4 md:px-6 md:py-6"
      >
        <div className="flex items-center justify-between px-1 pb-4 md:px-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-500">Fleet Hangar</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Ship Systems
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-6 md:flex">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Credits</div>
                <div className="mt-1 text-base font-semibold text-white">{userData?.commonResources ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Rare</div>
                <div className="mt-1 text-base font-semibold text-white">{userData?.rareResources ?? 0}</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-white border border-slate-800"
            >
              <Plus className="rotate-45" size={18} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1.62fr_0.78fr]">
          <div className="min-h-0 overflow-hidden bg-[#050914] shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-slate-800/60">
            <ShipShowcase ship={activeAsset} />

            <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveIndex((v) => (v - 1 + assets.length) % assets.length)}
                  className="flex items-center gap-2 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 border border-slate-800"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Selection</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {activeIndex + 1} / {assets.length}
                  </div>
                </div>

                <button
                  onClick={() => setActiveIndex((v) => (v + 1) % assets.length)}
                  className="flex items-center gap-2 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 border border-slate-800"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {assets.map((item, index) => {
                  const selected = activeAsset.id === item.id;
                  const owned = item.category === 'ship' && currentShipType === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveIndex(index)}
                      className={`px-4 py-4 text-left transition border ${
                        selected
                          ? 'bg-cyan-950/30 border-cyan-500/50 text-white shadow-[inset_0_0_20px_rgba(6,182,212,0.15)]'
                          : 'bg-slate-900/50 border-transparent text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <div className={`${selected ? 'text-cyan-400' : 'text-slate-500'}`}>{item.icon}</div>
                        {owned && <Check size={15} className={selected ? 'text-cyan-400' : 'text-slate-600'} />}
                      </div>

                      <div className="text-sm font-semibold">{item.name}</div>
                      <div className={`mt-1 line-clamp-2 text-xs ${selected ? 'text-cyan-100/70' : 'text-slate-500'}`}>
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-[#050914] px-5 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-slate-800/60 md:px-6 md:py-6">
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-500">
              {activeAsset.category === 'station' ? 'Capital Asset' : 'Ship Profile'}
            </div>

            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {activeAsset.name}
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-400">
              {activeAsset.description}
            </p>

            {isCurrentShip && (
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="inline-flex bg-cyan-950/50 border border-cyan-500/30 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-cyan-400">
                  Active Deployment
                </div>
                <div className="inline-flex bg-slate-900/80 border border-slate-700 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-slate-300">
                  Upgrade Level {currentUpgradeLevel}
                </div>
              </div>
            )}

            <div className="mt-8 space-y-5">
              <StatRow label="Integrity" value={activeAsset.stats.health} max={1100} icon={<Shield size={14} />} />
              <StatRow label="Speed" value={activeAsset.stats.speed} max={100} icon={<Zap size={14} />} />
              <StatRow label="Agility" value={activeAsset.stats.agility} max={100} icon={<Gauge size={14} />} />
              <StatRow label="Damage" value={activeAsset.stats.damage} max={150} icon={<Target size={14} />} />
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Credits</div>
                <div className="mt-2 text-2xl font-semibold text-white">{activeAsset.price.common}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Rare</div>
                <div className="mt-2 text-2xl font-semibold text-white">{activeAsset.price.rare}</div>
              </div>
            </div>

            <button
              onClick={handleAcquire}
              disabled={loading !== null || isCurrentShip || !canAfford}
              className={`mt-8 flex w-full items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition ${
                isCurrentShip
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed'
              }`}
            >
              {loading === activeAsset.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
              ) : isCurrentShip ? (
                <>
                  <Check size={16} />
                  Deployed
                </>
              ) : activeAsset.id === 'megaship' ? (
                'Authorize Construction'
              ) : (
                'Acquire Ship'
              )}
            </button>

            {isCurrentShip && (
              <>
                <button
                  onClick={handleUpgrade}
                  disabled={loading !== null || !canUpgrade}
                  className="mt-4 flex w-full items-center justify-center gap-2 border border-slate-700 bg-slate-900 px-5 py-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/50 hover:text-cyan-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-600"
                >
                  {loading === `${activeAsset.id}-upgrade` ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-100" />
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {currentUpgradeLevel >= 5 ? 'Ship Fully Upgraded' : `Upgrade Ship · ${upgradePrice.common} Credits · ${upgradePrice.rare} Rare`}
                    </>
                  )}
                </button>
              </>
            )}

            <div className="mt-10 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">System Notes</div>

              <div className="space-y-3 text-sm leading-7 text-slate-400">
                <p>
                  The UI operates on a stark, dark contrast architecture. High metallic values and emissive neon elements have replaced legacy geometric primitives.
                </p>
                <p>
                  Hull geometries are built for aerodynamic hostility and vacuum stealth. Forward sweeps, block-armor plating, and central rail configurations define the new fleet standard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
