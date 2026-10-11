import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type DeployableShipType = 'scout' | 'phantom' | 'lancer' | 'destroyer';
export type RawShipType = DeployableShipType | 'fighter' | 'interceptor' | 'bomber' | 'megaship' | string | undefined | null;

export function normalizeShipType(type: RawShipType): DeployableShipType {
  switch (type) {
    case 'fighter':
      return 'phantom';
    case 'interceptor':
      return 'lancer';
    case 'bomber':
      return 'destroyer';
    case 'phantom':
    case 'lancer':
    case 'destroyer':
    case 'scout':
      return type;
    default:
      return 'scout';
  }
}

// ============================================================================
// SHARED MATERIALS & REUSABLE SCI-FI SUBCOMPONENTS
// ============================================================================

function HullMaterial({
  color = '#1f242d',
  metalness = 0.88,
  roughness = 0.24,
  emissive = '#000000',
  emissiveIntensity = 0,
}: {
  color?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
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

function CockpitGlass({
  color = '#0a233a',
  emissive = '#00c3ff',
  emissiveIntensity = 0.6,
  opacity = 0.85,
}: {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.95}
      roughness={0.06}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent
      opacity={opacity}
      toneMapped={false}
    />
  );
}

/**
 * Mirror helper: renders a child at both +X and -X with mirrored rotation
 */
function SymmetricPair({
  position,
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  children,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  children: React.ReactNode;
}) {
  const [x, y, z] = position;
  const [rx, ry, rz] = rotation;
  const [sx, sy, sz] = scale;

  return (
    <>
      <group position={[x, y, z]} rotation={[rx, ry, rz]} scale={[sx, sy, sz]}>
        {children}
      </group>
      <group position={[-x, y, z]} rotation={[rx, -ry, -rz]} scale={[sx, sy, sz]}>
        {children}
      </group>
    </>
  );
}

/**
 * High-performance sci-fi engine thruster with bell nozzle, glowing inner turbine,
 * pulsating plasma flame cone, and dynamic ion halo ring.
 */
function EngineThruster({
  position,
  rotation = [0, 0, 0],
  bellRadius = 0.16,
  bellLength = 0.28,
  color = '#00f0ff',
  flameRadius = 0.14,
  flameLength = 1.1,
  flickerOffset = 0,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  bellRadius?: number;
  bellLength?: number;
  color?: string;
  flameRadius?: number;
  flameLength?: number;
  flickerOffset?: number;
}) {
  const flameRef = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);
  const innerCoreRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 4.2 + flickerOffset;
    const pulse = 0.94 + Math.sin(t * 2.8) * 0.08 + Math.sin(t * 5.3) * 0.04;
    if (flameRef.current) {
      flameRef.current.scale.set(pulse, pulse, 0.92 + Math.sin(t * 3.4) * 0.15);
    }
    if (innerCoreRef.current) {
      innerCoreRef.current.scale.setScalar(0.9 + Math.sin(t * 4.1) * 0.12);
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += 0.03;
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(t * 2.2) * 0.04;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Outer Titanium Nozzle Bell */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[bellRadius * 0.72, bellRadius, bellLength, 20, 1, true]} />
        <meshStandardMaterial color="#14171d" metalness={0.96} roughness={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Titanium Collar Rim */}
      <mesh position={[0, 0, bellLength * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[bellRadius * 0.98, 0.02, 10, 24]} />
        <meshStandardMaterial color="#2d3340" metalness={0.92} roughness={0.28} />
      </mesh>

      {/* Glowing Turbine Injector Plate */}
      <mesh position={[0, 0, -bellLength * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[bellRadius * 0.65, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} toneMapped={false} />
      </mesh>

      {/* Inner Glowing Core Sphere */}
      <mesh ref={innerCoreRef} position={[0, 0, bellLength * 0.1]}>
        <sphereGeometry args={[bellRadius * 0.55, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} toneMapped={false} />
      </mesh>

      {/* Pulsing Plasma Flame Cone (shoots backwards toward +Z) */}
      <mesh ref={flameRef} position={[0, 0, bellLength * 0.5 + flameLength * 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[flameRadius, flameLength, 18, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={4.5}
          transparent
          opacity={0.42}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rotating Ion Halo Ring */}
      <mesh ref={haloRef} position={[0, 0, bellLength * 0.5 + flameLength * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[flameRadius * 0.8, flameRadius * 1.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Heavy Weapon Hardpoint / Cannon Barrel (aligned at X = ±0.65 to match Ship.tsx fire points)
 */
function WeaponBarrel({
  position,
  barrelRadius = 0.034,
  barrelLength = 0.82,
  glowColor = '#00f0ff',
}: {
  position: [number, number, number];
  barrelRadius?: number;
  barrelLength?: number;
  glowColor?: string;
}) {
  return (
    <group position={position}>
      {/* Heavy Mounting Pylon */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.07, 0.06, barrelLength * 0.55]} />
        <HullMaterial color="#12161f" roughness={0.3} />
      </mesh>

      {/* Fluted Barrel Shroud */}
      <mesh position={[0, 0, -barrelLength * 0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[barrelRadius * 1.35, barrelRadius * 1.45, barrelLength * 0.45, 12]} />
        <HullMaterial color="#1a202c" metalness={0.92} roughness={0.25} />
      </mesh>

      {/* Main Forward Barrel Tube */}
      <mesh position={[0, 0, -barrelLength * 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[barrelRadius, barrelRadius, barrelLength * 0.9, 14]} />
        <meshStandardMaterial color="#0c0e13" metalness={0.96} roughness={0.18} />
      </mesh>

      {/* Glowing Muzzle Collimator Ring */}
      <mesh position={[0, 0, -barrelLength * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[barrelRadius * 1.1, barrelRadius * 1.1, 0.035, 14]} />
        <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={5} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ============================================================================
// SHIP 1: SCOUT ("Agile Razor Atmospheric / Orbital Interceptor")
// ============================================================================
function ScoutClassic() {
  return (
    <group position={[0, 0, 0]}>
      {/* --- CENTRAL STREAMLINED FUSELAGE --- */}
      {/* Needle-sharp Aerodynamic Prow Cone */}
      <mesh position={[0, 0.02, -1.82]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.22, 0.85, 16]} />
        <HullMaterial color="#1e2430" roughness={0.2} metalness={0.92} />
      </mesh>

      {/* Forward Main Fuselage Core */}
      <mesh position={[0, 0.04, -1.05]} castShadow>
        <boxGeometry args={[0.42, 0.24, 0.9]} />
        <HullMaterial color="#242b38" roughness={0.22} metalness={0.88} />
      </mesh>

      {/* Mid/Aft Main Hull Keel */}
      <mesh position={[0, 0.02, 0.05]} castShadow>
        <boxGeometry args={[0.54, 0.28, 1.45]} />
        <HullMaterial color="#1c212b" roughness={0.24} metalness={0.9} />
      </mesh>

      {/* Ventral Keel Sponson (Bottom Stabilizer) */}
      <mesh position={[0, -0.14, 0.1]} castShadow>
        <boxGeometry args={[0.26, 0.12, 1.25]} />
        <HullMaterial color="#12161f" roughness={0.3} metalness={0.94} />
      </mesh>

      {/* --- HIGH-TECH COCKPIT CANOPY --- */}
      {/* Sleek Elongated Glass Dome */}
      <mesh position={[0, 0.16, -0.65]} scale={[0.88, 0.65, 2.3]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <CockpitGlass color="#051c2e" emissive="#00d4ff" emissiveIntensity={0.7} opacity={0.88} />
      </mesh>

      {/* Canopy Structural Titanium Arch */}
      <mesh position={[0, 0.18, -0.6]} castShadow>
        <boxGeometry args={[0.28, 0.06, 0.05]} />
        <HullMaterial color="#10141b" metalness={0.96} roughness={0.15} />
      </mesh>

      {/* Internal Holographic HUD Display Plate */}
      <mesh position={[0, 0.13, -0.82]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[0.15, 0.08]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* --- FORWARD CANARDS --- */}
      <SymmetricPair position={[0.34, 0.03, -1.35]} rotation={[0, 0.42, -0.05]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.028, 0.32]} />
          <HullMaterial color="#161a22" metalness={0.94} roughness={0.22} />
        </mesh>
      </SymmetricPair>

      {/* --- MAIN SWEPT-DELTA WINGS & WINGLETS --- */}
      {/* Swept Main Delta Wing Assembly (thickness 0.038 for razor-sharp aerospace look) */}
      <SymmetricPair position={[0.96, 0.01, 0.38]} rotation={[0, -0.32, 0.04]}>
        {/* Main Wing Plate */}
        <mesh castShadow>
          <boxGeometry args={[1.32, 0.038, 1.22]} />
          <HullMaterial color="#252c3a" roughness={0.22} metalness={0.88} />
        </mesh>
        {/* Dark Armor Leading-Edge Slat */}
        <mesh position={[-0.2, 0.012, -0.45]} castShadow>
          <boxGeometry args={[0.88, 0.042, 0.18]} />
          <HullMaterial color="#141821" roughness={0.18} metalness={0.95} />
        </mesh>
        {/* Wing Energy Conduit Line */}
        <mesh position={[0.02, 0.022, 0.08]}>
          <boxGeometry args={[0.95, 0.015, 0.04]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={3.5} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* Canted Vertical Winglets at Wingtips */}
      <SymmetricPair position={[1.64, 0.18, 0.72]} rotation={[0, -0.08, 0.38]}>
        <mesh castShadow>
          <boxGeometry args={[0.035, 0.36, 0.58]} />
          <HullMaterial color="#181d26" metalness={0.92} roughness={0.25} />
        </mesh>
        {/* Winglet Strobe Light */}
        <mesh position={[0.02, 0.16, 0.22]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color="#00f0ff" toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* --- WING ROOT AIR/RAM INTAKES --- */}
      <SymmetricPair position={[0.34, -0.01, -0.22]} rotation={[0, 0.08, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.18, 0.14, 0.58]} />
          <HullMaterial color="#151921" metalness={0.92} roughness={0.28} />
        </mesh>
        {/* Glowing Compressor Grid */}
        <mesh position={[0, 0, -0.29]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.12, 0.09]} />
          <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={3} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* --- WING-MOUNTED PULSE CANNONS (Exact Ship.tsx Blaster Coords X=±0.65) --- */}
      <SymmetricPair position={[0.65, -0.04, -0.4]}>
        <WeaponBarrel position={[0, 0, 0]} barrelRadius={0.032} barrelLength={0.78} glowColor="#00f0ff" />
      </SymmetricPair>

      {/* --- DORSAL TAIL FIN --- */}
      <mesh position={[0, 0.26, 0.62]} rotation={[-0.24, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 0.34, 0.72]} />
        <HullMaterial color="#1a1f29" metalness={0.9} roughness={0.24} />
      </mesh>
      {/* Dorsal Spine Cyan Strip */}
      <mesh position={[0, 0.42, 0.58]}>
        <boxGeometry args={[0.018, 0.02, 0.54]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={4} toneMapped={false} />
      </mesh>

      {/* --- TWIN PROPULSION ENGINES (Exact Ship.tsx Trail Coords X=±0.8, Z=1.2) --- */}
      <SymmetricPair position={[0.78, 0.0, 1.22]}>
        <EngineThruster
          position={[0, 0, 0]}
          bellRadius={0.16}
          bellLength={0.3}
          color="#00f0ff"
          flameRadius={0.14}
          flameLength={1.25}
          flickerOffset={0}
        />
      </SymmetricPair>

      {/* Starboard Green & Port Red Navigation Lights */}
      <mesh position={[1.68, 0.03, 0.5]}>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshBasicMaterial color="#00ff66" toneMapped={false} />
      </mesh>
      <mesh position={[-1.68, 0.03, 0.5]}>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshBasicMaterial color="#ff1133" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ============================================================================
// SHIP 2: PHANTOM ("Black-Ops Forward-Swept Blade Stealth Interceptor")
// ============================================================================
function PhantomShip() {
  const pulseRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 2.5;
    if (pulseRef.current) {
      const mat = pulseRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 2.4 + Math.sin(t) * 1.2;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* --- FACETED RADAR-ABSORBENT STEALTH FUSELAGE --- */}
      {/* Razor Chisel Nose Cone */}
      <mesh position={[0, 0.01, -1.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.26, 0.95, 4]} />
        <HullMaterial color="#080a0f" metalness={0.84} roughness={0.36} />
      </mesh>

      {/* Faceted Main Diamond Hull Body */}
      <mesh position={[0, 0.02, -0.95]} castShadow>
        <boxGeometry args={[0.62, 0.18, 1.15]} />
        <HullMaterial color="#0c0f16" metalness={0.88} roughness={0.32} />
      </mesh>

      {/* Aft Stealth Chassis */}
      <mesh position={[0, 0.02, 0.22]} castShadow>
        <boxGeometry args={[0.88, 0.22, 1.35]} />
        <HullMaterial color="#0a0d13" metalness={0.86} roughness={0.34} />
      </mesh>

      {/* --- FLUSH LOW-OBSERVABLE STEALTH COCKPIT --- */}
      <mesh position={[0, 0.14, -0.6]} scale={[0.82, 0.48, 2.2]}>
        <sphereGeometry args={[0.24, 16, 16]} />
        <CockpitGlass color="#18040a" emissive="#ff003c" emissiveIntensity={0.65} opacity={0.92} />
      </mesh>

      {/* --- AGGRESSIVE FORWARD-SWEPT KNIFE WINGS --- */}
      {/* Forward-swept wing sweeps out to X=±1.82 and forward from Z=0.6 to Z=-0.5 */}
      <SymmetricPair position={[1.1, 0.01, 0.12]} rotation={[0, 0.34, -0.03]}>
        {/* Main Forward-Swept Blade Wing */}
        <mesh castShadow>
          <boxGeometry args={[1.42, 0.034, 0.95]} />
          <HullMaterial color="#0d1118" metalness={0.88} roughness={0.3} />
        </mesh>
        {/* Knife-Edge Leading Edge */}
        <mesh position={[0.15, 0.01, -0.38]} castShadow>
          <boxGeometry args={[1.05, 0.038, 0.14]} />
          <HullMaterial color="#05070a" metalness={0.96} roughness={0.16} />
        </mesh>
        {/* Crimson Stealth Formation Glow Ribbon */}
        <mesh position={[-0.04, 0.02, 0.25]}>
          <boxGeometry args={[1.12, 0.015, 0.03]} />
          <meshStandardMaterial color="#ff003c" emissive="#ff003c" emissiveIntensity={4.2} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* Outward-Canted Stealth Twin Vertical Stabilizers */}
      <SymmetricPair position={[0.55, 0.24, 0.75]} rotation={[0, 0.08, -0.58]}>
        <mesh castShadow>
          <boxGeometry args={[0.032, 0.42, 0.65]} />
          <HullMaterial color="#0b0e14" metalness={0.9} roughness={0.28} />
        </mesh>
        {/* Stabilizer Glowing Crimson Fin Tip */}
        <mesh position={[0.018, 0.19, 0.1]}>
          <boxGeometry args={[0.02, 0.04, 0.38]} />
          <meshStandardMaterial color="#ff1e56" emissive="#ff1e56" emissiveIntensity={4.5} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* --- RECESSED WING HARDPOINTS (Exact Ship.tsx Blaster Coords X=±0.65) --- */}
      <SymmetricPair position={[0.65, -0.03, -0.55]}>
        <WeaponBarrel position={[0, 0, 0]} barrelRadius={0.03} barrelLength={0.72} glowColor="#ff003c" />
      </SymmetricPair>

      {/* --- BREATHING CRIMSON THERMAL DISSIPATION VENTS --- */}
      <mesh ref={pulseRef} position={[0, 0.125, 0.35]}>
        <boxGeometry args={[0.26, 0.02, 0.72]} />
        <meshStandardMaterial color="#ff003c" emissive="#ff003c" emissiveIntensity={2.8} toneMapped={false} />
      </mesh>

      {/* Vent Shield Louvers */}
      {[-0.2, -0.05, 0.1, 0.25].map((zOffset, i) => (
        <mesh key={i} position={[0, 0.138, 0.35 + zOffset]} castShadow>
          <boxGeometry args={[0.3, 0.016, 0.05]} />
          <HullMaterial color="#080a0f" metalness={0.92} roughness={0.2} />
        </mesh>
      ))}

      {/* --- TWIN STEALTH VECTORING EXHAUSTS (X=±0.65, Z=1.3) --- */}
      <SymmetricPair position={[0.65, 0.0, 1.25]}>
        {/* Stealth Angular Shroud */}
        <mesh position={[0, 0, -0.08]} castShadow>
          <boxGeometry args={[0.34, 0.24, 0.28]} />
          <HullMaterial color="#080a0f" metalness={0.94} roughness={0.22} />
        </mesh>
        <EngineThruster
          position={[0, 0, 0.08]}
          bellRadius={0.13}
          bellLength={0.25}
          color="#ff0055"
          flameRadius={0.12}
          flameLength={1.15}
          flickerOffset={1.4}
        />
      </SymmetricPair>
    </group>
  );
}

// ============================================================================
// SHIP 3: LANCER ("High-Velocity Orbital Railgun Accelerator Sniper")
// ============================================================================
function LancerShip() {
  const coilRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 6;
    if (coilRef.current) {
      coilRef.current.children.forEach((child, i) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 2.5 + Math.sin(t + i * 1.4) * 2.0;
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* --- MASSIVE CENTERLINE ACCELERATOR RAIL TUBE --- */}
      {/* Long central electromagnetic spine (from Z=-2.8 to Z=1.4) */}
      <mesh position={[0, 0.01, -0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.085, 3.8, 16]} />
        <HullMaterial color="#1a1e27" metalness={0.94} roughness={0.18} />
      </mesh>

      {/* Needle-sharp Twin Charging Prongs at Bow */}
      <SymmetricPair position={[0.11, 0.01, -2.75]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.024, 0.65, 10]} />
          <meshStandardMaterial color="#2d3342" metalness={0.95} roughness={0.16} />
        </mesh>
        <mesh position={[0, 0, -0.32]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={6} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* Central Rail Arc Glow Core */}
      <mesh position={[0, 0.01, -2.6]}>
        <sphereGeometry args={[0.065, 12, 12]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={8} toneMapped={false} />
      </mesh>

      {/* 4 Segmented Magnetic Acceleration Coils */}
      <group ref={coilRef}>
        {[-2.1, -1.5, -0.9, -0.3].map((zPos, i) => (
          <mesh key={i} position={[0, 0.01, zPos]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.022, 12, 24]} />
            <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={3.5} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* High-Aspect Ratio Slender Fuselage */}
      <mesh position={[0, 0.04, 0.35]} castShadow>
        <boxGeometry args={[0.42, 0.3, 1.8]} />
        <HullMaterial color="#e2e8f0" metalness={0.72} roughness={0.28} />
      </mesh>

      {/* Elevated Long Tandem Sniper Cockpit */}
      <mesh position={[0, 0.22, -0.05]} scale={[0.65, 0.52, 2.1]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <CockpitGlass color="#1e0a38" emissive="#a855f7" emissiveIntensity={0.8} opacity={0.86} />
      </mesh>

      {/* --- SWEPT STABILIZER LANCE BLADES --- */}
      <SymmetricPair position={[0.82, 0.02, 0.65]} rotation={[0, -0.42, 0.06]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.035, 1.15]} />
          <HullMaterial color="#222834" metalness={0.9} roughness={0.22} />
        </mesh>
        {/* Arctic White Wing Armor Shell */}
        <mesh position={[-0.1, 0.022, -0.2]} castShadow>
          <boxGeometry args={[0.68, 0.038, 0.55]} />
          <HullMaterial color="#cbd5e1" metalness={0.65} roughness={0.32} />
        </mesh>
        {/* Violet Energy Conduit */}
        <mesh position={[0.08, 0.024, 0.12]}>
          <boxGeometry args={[0.85, 0.015, 0.035]} />
          <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={4.5} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* Sensor Outrigger Telemetry Booms */}
      <SymmetricPair position={[1.35, 0.08, 1.1]} rotation={[0, 0.05, 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.04, 0.24, 0.42]} />
          <HullMaterial color="#1a202c" metalness={0.92} roughness={0.2} />
        </mesh>
      </SymmetricPair>

      {/* --- FORWARD WEAPON HARDPOINTS (Exact Ship.tsx Blaster Coords X=±0.65) --- */}
      <SymmetricPair position={[0.65, -0.04, -0.5]}>
        <WeaponBarrel position={[0, 0, 0]} barrelRadius={0.028} barrelLength={0.85} glowColor="#c084fc" />
      </SymmetricPair>

      {/* --- HEAVY PARTICLE ACCELERATOR ENGINE (Center) + TWIN VERNIER THRUSTERS --- */}
      {/* Primary Heavy Engine (Center) */}
      <EngineThruster
        position={[0, 0.02, 1.45]}
        bellRadius={0.2}
        bellLength={0.34}
        color="#c084fc"
        flameRadius={0.17}
        flameLength={1.4}
        flickerOffset={0.5}
      />

      {/* Auxiliary Vernier Thrusters (X=±0.78, Z=1.3) */}
      <SymmetricPair position={[0.78, 0.0, 1.3]}>
        <EngineThruster
          position={[0, 0, 0]}
          bellRadius={0.11}
          bellLength={0.22}
          color="#a855f7"
          flameRadius={0.09}
          flameLength={0.85}
          flickerOffset={2.2}
        />
      </SymmetricPair>
    </group>
  );
}

// ============================================================================
// SHIP 4: DESTROYER ("Heavy Armored Tactical Cruiser / Dreadnought Gunship")
// ============================================================================
function DestroyerShip() {
  const reactorRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 3.2;
    if (reactorRef.current) {
      const mat = reactorRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 3.0 + Math.sin(t) * 1.4;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* --- HEAVY CHISELED ARMORED BOW --- */}
      {/* Heavy Wedge Prow Bow */}
      <mesh position={[0, 0.05, -1.75]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.55, 1.15, 4]} />
        <HullMaterial color="#1a1e26" metalness={0.86} roughness={0.34} />
      </mesh>

      {/* Dual Heavy Torpedo Launch Tubes at Nose */}
      <SymmetricPair position={[0.26, -0.06, -2.0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.35, 12]} />
          <HullMaterial color="#0e1117" metalness={0.94} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 12]} />
          <meshStandardMaterial color="#ff5500" emissive="#ff5500" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </SymmetricPair>

      {/* Massive Center Armored Citadel Chassis */}
      <mesh position={[0, 0.12, -0.45]} castShadow>
        <boxGeometry args={[1.25, 0.48, 1.7]} />
        <HullMaterial color="#232a36" metalness={0.84} roughness={0.36} />
      </mesh>

      {/* Aft Engine Hull Bulkhead */}
      <mesh position={[0, 0.1, 0.72]} castShadow>
        <boxGeometry args={[1.55, 0.52, 1.2]} />
        <HullMaterial color="#1c222c" metalness={0.88} roughness={0.32} />
      </mesh>

      {/* --- TIERED SUPERSTRUCTURE / COMMAND BRIDGE TOWER --- */}
      <mesh position={[0, 0.46, 0.12]} castShadow>
        <boxGeometry args={[0.62, 0.28, 0.85]} />
        <HullMaterial color="#141820" metalness={0.92} roughness={0.25} />
      </mesh>

      {/* Armored Panoramic Command Bridge Visor */}
      <mesh position={[0, 0.52, -0.32]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.55, 0.07, 0.04]} />
        <CockpitGlass color="#1f1406" emissive="#ffaa00" emissiveIntensity={1.8} opacity={0.95} />
      </mesh>

      {/* Command Bridge Sensor Mast */}
      <mesh position={[0, 0.68, 0.3]} castShadow>
        <cylinderGeometry args={[0.02, 0.035, 0.25, 8]} />
        <HullMaterial color="#374151" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* --- HEAVY FLANKING ARMOR SPONSONS & VLS MISSILE GRIDS --- */}
      <SymmetricPair position={[1.15, 0.05, 0.05]}>
        {/* Armored Outrigger Sponson Skirt */}
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.38, 1.95]} />
          <HullMaterial color="#1e2430" metalness={0.86} roughness={0.34} />
        </mesh>
        {/* Heavy Composite Armor Slat */}
        <mesh position={[0.18, 0.08, -0.1]} castShadow>
          <boxGeometry args={[0.15, 0.28, 1.55]} />
          <HullMaterial color="#12161f" metalness={0.92} roughness={0.28} />
        </mesh>
        {/* VLS Missile Cell Silo Hatch Grid on Dorsal Sponson */}
        {[-0.5, -0.25, 0.0, 0.25, 0.5].map((zOff, i) => (
          <mesh key={i} position={[-0.05, 0.2, zOff]} castShadow>
            <boxGeometry args={[0.18, 0.015, 0.16]} />
            <meshStandardMaterial color="#0b0d12" metalness={0.94} roughness={0.22} />
          </mesh>
        ))}
      </SymmetricPair>

      {/* --- TWIN HEAVY AUTOCANNON TURRETS (X=±0.65, Z=-0.7) --- */}
      <SymmetricPair position={[0.65, 0.24, -0.65]}>
        {/* Armored Turret Base */}
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.12, 0.28]} />
          <HullMaterial color="#11141b" metalness={0.94} roughness={0.24} />
        </mesh>
        {/* Twin Rifled Heavy Barrels */}
        {[-0.05, 0.05].map((xOff, i) => (
          <mesh key={i} position={[xOff, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.028, 0.65, 12]} />
            <HullMaterial color="#080a0e" metalness={0.96} roughness={0.16} />
          </mesh>
        ))}
        {/* Muzzle Flash Rings */}
        {[-0.05, 0.05].map((xOff, i) => (
          <mesh key={i} position={[xOff, 0.02, -0.65]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.03, 0.008, 8, 16]} />
            <meshStandardMaterial color="#ff7700" emissive="#ff7700" emissiveIntensity={4} toneMapped={false} />
          </mesh>
        ))}
      </SymmetricPair>

      {/* --- MOLTEN GLOWING REACTOR RADIATORS --- */}
      <mesh ref={reactorRef} position={[0, 0.38, 0.72]}>
        <boxGeometry args={[0.82, 0.04, 0.75]} />
        <meshStandardMaterial color="#ff5500" emissive="#ff5500" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {/* Heavy Radiator Grilles */}
      {[-0.25, -0.1, 0.05, 0.2].map((zOff, i) => (
        <mesh key={i} position={[0, 0.41, 0.72 + zOff]} castShadow>
          <boxGeometry args={[0.88, 0.02, 0.06]} />
          <HullMaterial color="#12161f" metalness={0.92} roughness={0.25} />
        </mesh>
      ))}

      {/* --- HEAVY INDUSTRIAL QUAD ENGINE CLUSTER --- */}
      {/* Primary Heavy Thrusters (X=±0.8, Z=1.5) */}
      <SymmetricPair position={[0.8, 0.05, 1.42]}>
        <EngineThruster
          position={[0, 0, 0]}
          bellRadius={0.22}
          bellLength={0.36}
          color="#ff6600"
          flameRadius={0.19}
          flameLength={1.35}
          flickerOffset={0.7}
        />
      </SymmetricPair>

      {/* Secondary Center Booster Thruster */}
      <EngineThruster
        position={[0, 0.02, 1.55]}
        bellRadius={0.26}
        bellLength={0.4}
        color="#ffaa00"
        flameRadius={0.22}
        flameLength={1.6}
        flickerOffset={1.8}
      />
    </group>
  );
}

// ============================================================================
// CAPITAL SHIP: AEGIS COMMAND / MEGASHIP ("Mobile Starbase Carrier Fortress")
// ============================================================================
export function SharedMegaShipModel() {
  const radarRef = useRef<THREE.Group>(null!);
  const hangarDoorLRef = useRef<THREE.Mesh>(null!);
  const hangarDoorRRef = useRef<THREE.Mesh>(null!);
  const runwayGlowRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (radarRef.current) {
      radarRef.current.rotation.y = t * 0.8;
    }
    // Animated hangar bay doors that gently slide
    const doorSlide = Math.sin(t * 0.7) * 0.12;
    if (hangarDoorLRef.current) {
      hangarDoorLRef.current.position.x = -0.58 - Math.max(0, doorSlide);
    }
    if (hangarDoorRRef.current) {
      hangarDoorRRef.current.position.x = 0.58 + Math.max(0, doorSlide);
    }
    // Animated airport runway approach strobe sequencing
    if (runwayGlowRef.current) {
      runwayGlowRef.current.children.forEach((child, i) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        const wave = Math.sin(t * 5.0 - i * 0.6);
        mat.opacity = wave > 0.2 ? 0.95 : 0.2;
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* --- MASSIVE CAPITAL HULL FRAME --- */}
      {/* Main Armored Chassis Hull */}
      <mesh position={[0, 0.08, 0.2]} castShadow>
        <boxGeometry args={[3.8, 0.65, 5.6]} />
        <HullMaterial color="#161b24" metalness={0.88} roughness={0.3} />
      </mesh>

      {/* Reinforced Heavy Prow Armor Ram */}
      <mesh position={[0, 0.08, -2.85]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[1.75, 1.2, 4]} />
        <HullMaterial color="#11151d" metalness={0.92} roughness={0.25} />
      </mesh>

      {/* Ventral Keel Hull Superstructure */}
      <mesh position={[0, -0.38, 0.3]} castShadow>
        <boxGeometry args={[2.5, 0.42, 4.2]} />
        <HullMaterial color="#10141c" metalness={0.9} roughness={0.32} />
      </mesh>

      {/* --- THROUGH-DECK FLIGHT RUNWAY & INTERNAL HANGAR DECK --- */}
      {/* Recessed Flight Deck Runway Surface */}
      <mesh position={[0, 0.42, 0.0]} receiveShadow>
        <boxGeometry args={[1.45, 0.04, 4.6]} />
        <HullMaterial color="#0c1017" metalness={0.94} roughness={0.38} />
      </mesh>

      {/* Animated Centerline Runway Approach Strobes */}
      <group ref={runwayGlowRef}>
        {[-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0].map((zPos, i) => (
          <mesh key={i} position={[0, 0.45, zPos]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.09, 0.25]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.8} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Runway Perimeter Green Landing Guidance Lines */}
      {[-0.68, 0.68].map((xPos, i) => (
        <mesh key={i} position={[xPos, 0.45, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 4.4]} />
          <meshBasicMaterial color="#00ff66" transparent opacity={0.65} toneMapped={false} />
        </mesh>
      ))}

      {/* Internal Illuminated Hangar Bay Cavity */}
      <mesh position={[0, 0.36, -1.45]}>
        <boxGeometry args={[1.35, 0.16, 0.95]} />
        <meshStandardMaterial color="#051524" emissive="#0088cc" emissiveIntensity={1.8} toneMapped={false} />
      </mesh>

      {/* Miniature Parked Scout Fighters Inside Hangar Bay */}
      {[-0.32, 0.32].map((xPos, i) => (
        <mesh key={i} position={[xPos, 0.32, -1.45]} scale={0.12} castShadow>
          <coneGeometry args={[0.3, 1.0, 6]} />
          <meshStandardMaterial color="#7dd3fc" metalness={0.8} />
        </mesh>
      ))}

      {/* Sliding Armored Hangar Bay Doors */}
      <mesh ref={hangarDoorLRef} position={[-0.58, 0.46, -1.92]} castShadow>
        <boxGeometry args={[0.48, 0.06, 0.65]} />
        <HullMaterial color="#222a38" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh ref={hangarDoorRRef} position={[0.58, 0.46, -1.92]} castShadow>
        <boxGeometry args={[0.48, 0.06, 0.65]} />
        <HullMaterial color="#222a38" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* --- DUAL ISLAND COMMAND BRIDGES & COMMUNICATIONS --- */}
      <SymmetricPair position={[1.42, 0.58, 0.65]}>
        {/* Island Bridge Superstructure */}
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.52, 1.65]} />
          <HullMaterial color="#1a202c" metalness={0.92} roughness={0.24} />
        </mesh>
        {/* Observation Windows Visor */}
        <mesh position={[-0.24, 0.16, -0.35]} rotation={[0, -0.4, 0]}>
          <boxGeometry args={[0.04, 0.08, 0.85]} />
          <CockpitGlass color="#082b45" emissive="#00f0ff" emissiveIntensity={2.0} opacity={0.9} />
        </mesh>
      </SymmetricPair>

      {/* Rotating Orbital Radar Array Mast on Starboard Island */}
      <group ref={radarRef} position={[1.45, 1.05, 0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.45, 10]} />
          <HullMaterial color="#475569" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0.3, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.24, 0.024, 10, 24, Math.PI * 1.5]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.94} roughness={0.16} emissive="#00f0ff" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* --- OUTRIGGER DOCKING CATWALKS & FLANK SPONSONS --- */}
      <SymmetricPair position={[2.15, 0.08, 0.4]}>
        <mesh castShadow>
          <boxGeometry args={[0.52, 0.32, 3.4]} />
          <HullMaterial color="#141822" metalness={0.88} roughness={0.32} />
        </mesh>
        {/* Docking Ring Clamp */}
        <mesh position={[0.26, 0.0, -0.4]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.28, 0.04, 12, 24]} />
          <HullMaterial color="#f59e0b" metalness={0.85} roughness={0.28} />
        </mesh>
      </SymmetricPair>

      {/* --- CAPITAL DEFENSIVE POINT-DEFENSE TURRETS --- */}
      {[
        [-1.15, 0.48, -0.9],
        [1.15, 0.48, -0.9],
        [-1.15, 0.48, 1.4],
        [1.15, 0.48, 1.4],
      ].map(([tx, ty, tz], i) => (
        <group key={i} position={[tx, ty, tz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.15, 0.08, 12]} />
            <HullMaterial color="#0f131a" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.06, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
            <HullMaterial color="#2d3748" metalness={0.96} roughness={0.15} />
          </mesh>
        </group>
      ))}

      {/* --- GIANT 5-ENGINE CAPITAL PROPULSION BANK --- */}
      {/* Center Grand Thruster */}
      <EngineThruster
        position={[0, 0.08, 3.05]}
        bellRadius={0.34}
        bellLength={0.48}
        color="#00f0ff"
        flameRadius={0.3}
        flameLength={2.1}
        flickerOffset={0.2}
      />
      {/* Mid Thrusters */}
      <SymmetricPair position={[0.95, 0.08, 3.0]}>
        <EngineThruster
          position={[0, 0, 0]}
          bellRadius={0.26}
          bellLength={0.42}
          color="#00d4ff"
          flameRadius={0.22}
          flameLength={1.75}
          flickerOffset={1.1}
        />
      </SymmetricPair>
      {/* Outer Thrusters */}
      <SymmetricPair position={[1.75, 0.08, 2.92]}>
        <EngineThruster
          position={[0, 0, 0]}
          bellRadius={0.2}
          bellLength={0.36}
          color="#38bdf8"
          flameRadius={0.16}
          flameLength={1.4}
          flickerOffset={2.3}
        />
      </SymmetricPair>
    </group>
  );
}

// ============================================================================
// SHARED SHIP MODEL DISPATCHER
// ============================================================================
export function SharedShipModel({ type }: { type: RawShipType }) {
  const normalized = normalizeShipType(type);
  if (normalized === 'phantom') return <PhantomShip />;
  if (normalized === 'lancer') return <LancerShip />;
  if (normalized === 'destroyer') return <DestroyerShip />;
  return <ScoutClassic />;
}
