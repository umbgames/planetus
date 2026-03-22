import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion'; // Assuming framer-motion is used based on your import pattern
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
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={4}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

function StripLight({
  position,
  rotation = [0, 0, 0],
  size = [0.1, 0.05, 0.7],
  color = '#00f0ff',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={5}
        toneMapped={false}
      />
    </mesh>
  );
}

// ------------------------------------------------------------------
// FUTURISTIC SHIP MODELS
// ------------------------------------------------------------------

function ScoutClassic() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.08, 0]}>
      {/* Central Fuselage */}
      <mesh castShadow>
        <boxGeometry args={[0.35, 0.25, 2.2]} />
        <meshStandardMaterial color="#1e2229" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Swept Wings */}
      <mesh position={[0, -0.02, 0.2]} castShadow>
        <boxGeometry args={[2.2, 0.05, 0.5]} />
        <meshStandardMaterial color="#12141a" metalness={0.95} roughness={0.15} />
      </mesh>
      <mesh position={[0, -0.02, -0.5]} castShadow>
        <boxGeometry args={[1.2, 0.05, 0.4]} />
        <meshStandardMaterial color="#12141a" metalness={0.95} roughness={0.15} />
      </mesh>
      {/* Cockpit Canopy */}
      <mesh position={[0, 0.18, -0.2]}>
        <boxGeometry args={[0.2, 0.12, 0.7]} />
        <meshStandardMaterial color="#000000" metalness={1} roughness={0.1} emissive="#002244" emissiveIntensity={0.5} />
      </mesh>
      {/* Primary Engine */}
      <GlowCore position={[0, 0, 1.15]} scale={[0.8, 0.6, 0.6]} color="#00f0ff" />
    </group>
  );
}

function PhantomShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.1, 0]}>
      {/* Flat Stealth Body */}
      <mesh castShadow>
        <boxGeometry args={[0.9, 0.12, 2.8]} />
        <meshStandardMaterial color="#08080a" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* Swept Forward Wings */}
      <mesh position={[-1.2, 0, -0.2]} rotation={[0, -0.6, 0]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.6]} />
        <meshStandardMaterial color="#0c0d12" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 0, -0.2]} rotation={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.8, 0.08, 0.6]} />
        <meshStandardMaterial color="#0c0d12" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Stealth Vents */}
      <mesh position={[0, 0.08, 0.8]} castShadow>
        <boxGeometry args={[0.4, 0.08, 0.6]} />
        <meshStandardMaterial color="#1a1c23" metalness={0.7} roughness={0.5} />
      </mesh>
      {/* Threat Neon Signatures */}
      <StripLight position={[-0.4, 0.06, 0]} size={[0.02, 0.02, 1.6]} color="#ff003c" />
      <StripLight position={[0.4, 0.06, 0]} size={[0.02, 0.02, 1.6]} color="#ff003c" />
      {/* Twin Silent Drives */}
      <GlowCore position={[-0.25, 0, 1.45]} scale={[0.5, 0.2, 0.4]} color="#ff003c" />
      <GlowCore position={[0.25, 0, 1.45]} scale={[0.5, 0.2, 0.4]} color="#ff003c" />
    </group>
  );
}

function LancerShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.1, 0]}>
      {/* Central Rail Body */}
      <mesh castShadow>
        <boxGeometry args={[0.35, 0.35, 3.8]} />
        <meshStandardMaterial color="#1a1c24" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Forward Rail Prongs */}
      <mesh position={[-0.3, 0, -1.2]} castShadow>
        <boxGeometry args={[0.15, 0.45, 2.2]} />
        <meshStandardMaterial color="#252833" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 0, -1.2]} castShadow>
        <boxGeometry args={[0.15, 0.45, 2.2]} />
        <meshStandardMaterial color="#252833" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Energy Accelerator Core */}
      <StripLight position={[0, 0, -1.2]} size={[0.1, 0.1, 2.2]} color="#b026ff" />
      <StripLight position={[0, 0.2, 0.8]} size={[0.05, 0.05, 1.2]} color="#b026ff" />
      {/* Stabilizer Fins */}
      <mesh position={[-0.6, 0, 1.2]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.2, 0.05, 0.8]} />
        <meshStandardMaterial color="#12141a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.6, 0, 1.2]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[1.2, 0.05, 0.8]} />
        <meshStandardMaterial color="#12141a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Overcharged Engine */}
      <GlowCore position={[0, 0, 1.95]} scale={[0.8, 0.8, 0.8]} color="#d6a9ff" />
    </group>
  );
}

function DestroyerShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.2, 0]}>
      {/* Heavy Hull Block */}
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.8, 3.8]} />
        <meshStandardMaterial color="#1b1d24" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* Armored Weapon Pods */}
      <mesh position={[-1.2, 0, 0.2]} castShadow>
        <boxGeometry args={[0.8, 0.6, 2.8]} />
        <meshStandardMaterial color="#14151a" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 0, 0.2]} castShadow>
        <boxGeometry args={[0.8, 0.6, 2.8]} />
        <meshStandardMaterial color="#14151a" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Command Bridge Tower */}
      <mesh position={[0, 0.65, -0.8]} castShadow>
        <boxGeometry args={[0.9, 0.5, 1.2]} />
        <meshStandardMaterial color="#0d0e12" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Bridge Viewport Light */}
      <StripLight position={[0, 0.7, -1.4]} size={[0.6, 0.05, 0.05]} color="#ffaa00" />
      {/* Reactor Lines */}
      <StripLight position={[-0.8, 0.4, 0.5]} size={[0.05, 0.05, 2.0]} color="#ff5500" />
      <StripLight position={[0.8, 0.4, 0.5]} size={[0.05, 0.05, 2.0]} color="#ff5500" />
      {/* Heavy Thruster Banks */}
      <GlowCore position={[-1.2, 0, 1.65]} scale={[1.2, 0.8, 0.5]} color="#ff3300" />
      <GlowCore position={[1.2, 0, 1.65]} scale={[1.2, 0.8, 0.5]} color="#ff3300" />
      <GlowCore position={[0, 0, 1.95]} scale={[1.6, 0.9, 0.5]} color="#ff5500" />
    </group>
  );
}

function MegaShipModel() {
  return (
    <group rotation={[0.05, Math.PI, 0]} position={[0, -0.2, 0]}>
      {/* Monolithic Carrier Base */}
      <mesh castShadow>
        <boxGeometry args={[3.8, 0.7, 6.0]} />
        <meshStandardMaterial color="#111318" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Flight Deck Cutout Runway */}
      <mesh position={[0, 0.38, -0.5]}>
        <boxGeometry args={[2.2, 0.1, 4.5]} />
        <meshStandardMaterial color="#08090c" metalness={0.9} roughness={0.6} />
      </mesh>
      {/* Runway Navigation Strips */}
      <StripLight position={[-0.9, 0.45, -0.5]} size={[0.06, 0.02, 4.2]} color="#00f0ff" />
      <StripLight position={[0.9, 0.45, -0.5]} size={[0.06, 0.02, 4.2]} color="#00f0ff" />
      <StripLight position={[0, 0.45, -0.5]} size={[0.02, 0.02, 4.2]} color="#00f0ff" />
      {/* Command Superstructure */}
      <mesh position={[1.6, 0.9, 0.8]} castShadow>
        <boxGeometry args={[0.5, 1.2, 1.4]} />
        <meshStandardMaterial color="#1a1c24" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Station Antennas / Towers */}
      <mesh position={[-1.6, 0.6, 0.8]} castShadow>
        <boxGeometry args={[0.3, 0.6, 0.8]} />
        <meshStandardMaterial color="#1a1c24" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Massive Drive Plumes */}
      <GlowCore position={[-1.3, 0, 3.1]} scale={[1.4, 0.8, 0.8]} color="#00aaff" />
      <GlowCore position={[0, 0, 3.1]} scale={[1.8, 1.0, 0.8]} color="#00f0ff" />
      <GlowCore position={[1.3, 0, 3.1]} scale={[1.4, 0.8, 0.8]} color="#00aaff" />
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

// ------------------------------------------------------------------
// ENVIRONMENT & UI
// ------------------------------------------------------------------

function StarField() {
  const stars = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i < 150; i += 1) {
      points.push([
        (Math.random() - 0.5) * 30,
        Math.random() * 15 - 5,
        (Math.random() - 0.5) * 30,
      ]);
    }
    return points;
  }, []);

  return (
    <group>
      {stars.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color={Math.random() > 0.8 ? '#00f0ff' : '#ffffff'} />
        </mesh>
      ))}
    </group>
  );
}

function ShipShowcase({ ship }: { ship: ShipEntry }) {
  return (
    <div className="relative h-[56vh] min-h-[460px] w-full overflow-hidden bg-[#020617]">
      {/* Deep Space Background Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,240,255,0.06),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(176,38,255,0.06),transparent_35%),linear-gradient(180deg,#020617_0%,#090e1a_100%)]" />

      <Canvas
        camera={{ position: [0, 1.15, 8], fov: 34 }}
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 6, 22]} />
        
        <ambientLight intensity={0.5} />
        {/* Harsh futuristic directional light */}
        <directionalLight position={[8, 10, 6]} intensity={2.5} color="#e0f0ff" castShadow />
        {/* Cyberpunk rim lights */}
        <pointLight position={[0, 2, -3]} intensity={2.5} color="#00f0ff" />
        <pointLight position={[-3, -1, 4]} intensity={2.0} color="#b026ff" />

        <StarField />

        <Float speed={1.5} rotationIntensity={0.16} floatIntensity={0.32}>
          <ShipModel type={ship.id} />
        </Float>

        {/* Holographic floor grid simulation */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
          <circleGeometry args={[12, 64]} />
          <meshStandardMaterial color="#050812" roughness={0.8} metalness={0.2} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.61, 0]}>
          <ringGeometry args={[1.9, 2.0, 64]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.61, 0]}>
          <ringGeometry args={[2.8, 2.85, 64]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.9}
          maxPolarAngle={Math.PI / 1.9}
          autoRotate
          autoRotateSpeed={0.7}
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
  const currentShipType = userData?.shipConfig?.type || 'scout';

  const canAfford =
    (userData?.commonResources || 0) >= activeAsset.price.common &&
    (userData?.rareResources || 0) >= activeAsset.price.rare;

  const isCurrentShip = activeAsset.category === 'ship' && currentShipType === activeAsset.id;

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
              <div className="mt-4 inline-flex bg-cyan-950/50 border border-cyan-500/30 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-cyan-400">
                Active Deployment
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
