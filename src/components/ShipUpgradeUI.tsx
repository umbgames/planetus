import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'motion/react';
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
  color = '#9bd8ff',
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.18, 18, 18]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={4}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

function StripLight({
  position,
  rotation = [0, 0, 0],
  size = [0.1, 0.05, 0.7],
  color = '#8ad7ff',
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
        emissiveIntensity={1.4}
        metalness={0.4}
        roughness={0.15}
      />
    </mesh>
  );
}

function ScoutClassic() {
  return (
    <group rotation={[0.18, Math.PI, 0]} position={[0, -0.08, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.38, 2.05, 8, 16]} />
        <meshStandardMaterial color="#b9c4cf" metalness={0.8} roughness={0.22} />
      </mesh>

      <mesh position={[0, 0.18, -0.32]} castShadow>
        <boxGeometry args={[0.38, 0.18, 0.7]} />
        <meshStandardMaterial
          color="#dff6ff"
          emissive="#9bd8ff"
          emissiveIntensity={0.7}
          transparent
          opacity={0.9}
          metalness={0.8}
          roughness={0.06}
        />
      </mesh>

      <mesh position={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[2.5, 0.05, 0.55]} />
        <meshStandardMaterial color="#8fa0b1" metalness={0.7} roughness={0.22} />
      </mesh>

      <mesh position={[0, -0.08, -0.92]} castShadow>
        <boxGeometry args={[0.42, 0.16, 0.7]} />
        <meshStandardMaterial color="#748191" metalness={0.75} roughness={0.22} />
      </mesh>

      <GlowCore position={[0, 0, 1.38]} scale={[0.95, 0.62, 0.5]} color="#9bd8ff" />
    </group>
  );
}

function PhantomShip() {
  return (
    <group rotation={[0.14, Math.PI, 0]} position={[0, -0.12, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.75, 0.34, 3.5]} />
        <meshStandardMaterial color="#d6dde6" metalness={0.9} roughness={0.12} />
      </mesh>

      <mesh position={[0, 0.2, -0.5]} castShadow>
        <boxGeometry args={[0.32, 0.16, 0.82]} />
        <meshStandardMaterial
          color="#edfff7"
          emissive="#7cf7c2"
          emissiveIntensity={0.9}
          transparent
          opacity={0.88}
          metalness={0.85}
          roughness={0.04}
        />
      </mesh>

      <mesh position={[-1.8, 0, -0.15]} rotation={[0, 0, -0.56]} castShadow>
        <boxGeometry args={[2.6, 0.03, 0.42]} />
        <meshStandardMaterial color="#8bf4ca" metalness={0.8} roughness={0.14} />
      </mesh>

      <mesh position={[1.8, 0, -0.15]} rotation={[0, 0, 0.56]} castShadow>
        <boxGeometry args={[2.6, 0.03, 0.42]} />
        <meshStandardMaterial color="#8bf4ca" metalness={0.8} roughness={0.14} />
      </mesh>

      <mesh position={[0, -0.05, 0.8]} castShadow>
        <boxGeometry args={[0.24, 0.1, 0.7]} />
        <meshStandardMaterial color="#687687" metalness={0.7} roughness={0.24} />
      </mesh>

      <StripLight position={[0, 0.05, 0.95]} size={[0.06, 0.04, 1.15]} color="#8bf4ca" />
      <GlowCore position={[-0.2, -0.01, 1.82]} scale={[0.62, 0.5, 0.38]} color="#91ffd8" />
      <GlowCore position={[0.2, -0.01, 1.82]} scale={[0.62, 0.5, 0.38]} color="#91ffd8" />
    </group>
  );
}

function LancerShip() {
  return (
    <group rotation={[0.12, Math.PI, 0]} position={[0, -0.12, 0]}>
      <mesh castShadow rotation={[0, 0, 0]}>
        <capsuleGeometry args={[0.28, 3.4, 8, 16]} />
        <meshStandardMaterial color="#d9d2ff" metalness={0.92} roughness={0.1} />
      </mesh>

      <mesh position={[0, 0.14, -0.75]} castShadow>
        <boxGeometry args={[0.24, 0.14, 0.76]} />
        <meshStandardMaterial
          color="#f6e8ff"
          emissive="#cb9bff"
          emissiveIntensity={0.85}
          transparent
          opacity={0.9}
          metalness={0.9}
          roughness={0.05}
        />
      </mesh>

      <mesh position={[-1.55, 0.04, 0.05]} rotation={[0, 0, -0.42]} castShadow>
        <boxGeometry args={[2.15, 0.04, 0.32]} />
        <meshStandardMaterial color="#bb8cff" metalness={0.84} roughness={0.14} />
      </mesh>

      <mesh position={[1.55, 0.04, 0.05]} rotation={[0, 0, 0.42]} castShadow>
        <boxGeometry args={[2.15, 0.04, 0.32]} />
        <meshStandardMaterial color="#bb8cff" metalness={0.84} roughness={0.14} />
      </mesh>

      <mesh position={[0, 0, -1.85]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.13, 1.6, 5]} />
        <meshStandardMaterial color="#b8bfd6" metalness={0.9} roughness={0.08} />
      </mesh>

      <StripLight position={[0, 0.02, 0.65]} size={[0.05, 0.03, 1.5]} color="#d6a9ff" />
      <GlowCore position={[0, -0.01, 2.06]} scale={[0.7, 0.4, 0.34]} color="#e2bbff" />
    </group>
  );
}

function DestroyerShip() {
  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.22, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 0.7, 4.2]} />
        <meshStandardMaterial color="#c8d3df" metalness={0.88} roughness={0.16} />
      </mesh>

      <mesh position={[0, 0.4, -0.4]} castShadow>
        <boxGeometry args={[0.7, 0.28, 1.18]} />
        <meshStandardMaterial
          color="#e5f0ff"
          emissive="#89b9ff"
          emissiveIntensity={0.78}
          transparent
          opacity={0.9}
          metalness={0.92}
          roughness={0.04}
        />
      </mesh>

      <mesh position={[-2, 0.04, -0.1]} rotation={[0, 0, -0.16]} castShadow>
        <boxGeometry args={[2.55, 0.08, 1.15]} />
        <meshStandardMaterial color="#90b9ff" metalness={0.82} roughness={0.16} />
      </mesh>

      <mesh position={[2, 0.04, -0.1]} rotation={[0, 0, 0.16]} castShadow>
        <boxGeometry args={[2.55, 0.08, 1.15]} />
        <meshStandardMaterial color="#90b9ff" metalness={0.82} roughness={0.16} />
      </mesh>

      <mesh position={[0, -0.22, 0.25]} castShadow>
        <boxGeometry args={[0.92, 0.2, 2.15]} />
        <meshStandardMaterial color="#6d7b8b" metalness={0.72} roughness={0.26} />
      </mesh>

      <mesh position={[-0.56, -0.08, -0.55]} castShadow>
        <boxGeometry args={[0.16, 0.16, 1.8]} />
        <meshStandardMaterial color="#ecf3fb" metalness={0.72} roughness={0.16} />
      </mesh>

      <mesh position={[0.56, -0.08, -0.55]} castShadow>
        <boxGeometry args={[0.16, 0.16, 1.8]} />
        <meshStandardMaterial color="#ecf3fb" metalness={0.72} roughness={0.16} />
      </mesh>

      <mesh position={[0, 0.7, 0.9]} castShadow>
        <boxGeometry args={[0.25, 0.78, 0.28]} />
        <meshStandardMaterial color="#c5d0dc" metalness={0.82} roughness={0.14} />
      </mesh>

      <StripLight position={[0, 0.1, 0.95]} size={[0.08, 0.04, 1.7]} color="#90b9ff" />
      <GlowCore position={[-0.36, -0.03, 2.18]} scale={[0.78, 0.6, 0.42]} color="#acd2ff" />
      <GlowCore position={[0.36, -0.03, 2.18]} scale={[0.78, 0.6, 0.42]} color="#acd2ff" />
    </group>
  );
}

function MegaShipModel() {
  return (
    <group rotation={[0.08, Math.PI, 0]} position={[0, -0.3, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.8, 1.02, 6.9]} />
        <meshStandardMaterial color="#dde4ec" metalness={0.9} roughness={0.12} />
      </mesh>

      <mesh position={[0, 0.92, -0.25]} castShadow>
        <boxGeometry args={[1.45, 0.52, 2.4]} />
        <meshStandardMaterial
          color="#f2f7ff"
          emissive="#8dbfff"
          emissiveIntensity={0.7}
          transparent
          opacity={0.88}
          metalness={0.94}
          roughness={0.05}
        />
      </mesh>

      <mesh position={[-2.8, 0.08, -0.1]} rotation={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[3.2, 0.12, 2.2]} />
        <meshStandardMaterial color="#9ac2ff" metalness={0.84} roughness={0.16} />
      </mesh>

      <mesh position={[2.8, 0.08, -0.1]} rotation={[0, 0, 0.08]} castShadow>
        <boxGeometry args={[3.2, 0.12, 2.2]} />
        <meshStandardMaterial color="#9ac2ff" metalness={0.84} roughness={0.16} />
      </mesh>

      <mesh position={[0, -0.42, -0.4]} castShadow>
        <boxGeometry args={[1.4, 0.36, 3.8]} />
        <meshStandardMaterial color="#758596" metalness={0.76} roughness={0.28} />
      </mesh>

      <mesh position={[-1.65, 0.48, 1.9]} castShadow>
        <boxGeometry args={[0.58, 0.62, 1.65]} />
        <meshStandardMaterial color="#a9b6c4" metalness={0.8} roughness={0.18} />
      </mesh>

      <mesh position={[1.65, 0.48, 1.9]} castShadow>
        <boxGeometry args={[0.58, 0.62, 1.65]} />
        <meshStandardMaterial color="#a9b6c4" metalness={0.8} roughness={0.18} />
      </mesh>

      <mesh position={[0, 1.2, 1.15]} castShadow>
        <boxGeometry args={[0.45, 1.02, 0.45]} />
        <meshStandardMaterial color="#d4dde8" metalness={0.82} roughness={0.14} />
      </mesh>

      <StripLight position={[0, 0.2, 1.32]} size={[0.14, 0.06, 2.5]} color="#9ac2ff" />
      <GlowCore position={[-0.82, 0.02, 3.58]} scale={[1.1, 0.78, 0.5]} color="#c6deff" />
      <GlowCore position={[0, 0.06, 3.67]} scale={[1.3, 0.86, 0.54]} color="#dcebff" />
      <GlowCore position={[0.82, 0.02, 3.58]} scale={[1.1, 0.78, 0.5]} color="#c6deff" />
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
    const points: [number, number, number][] = [];
    for (let i = 0; i < 110; i += 1) {
      points.push([
        (Math.random() - 0.5) * 24,
        Math.random() * 10 - 3,
        (Math.random() - 0.5) * 24,
      ]);
    }
    return points;
  }, []);

  return (
    <group>
      {stars.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function ShipShowcase({ ship }: { ship: ShipEntry }) {
  return (
    <div className="relative h-[56vh] min-h-[460px] w-full overflow-hidden bg-[#eef4fb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(238,244,251,0.65)_30%,transparent_55%),radial-gradient(circle_at_80%_10%,rgba(181,220,255,0.45),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#eaf1f8_100%)]" />

      <Canvas
        camera={{ position: [0, 1.15, 8], fov: 34 }}
        shadows
        dpr={[1, 1.8]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#eef4fb']} />
        <fog attach="fog" args={['#eef4fb', 8, 18]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[8, 10, 6]} intensity={2.2} castShadow />
        <pointLight position={[0, 2, 3]} intensity={1.8} color="#c8e5ff" />
        <pointLight position={[-3, 1, 4]} intensity={1.1} color="#ffffff" />

        <StarField />

        <Float speed={1.5} rotationIntensity={0.16} floatIntensity={0.32}>
          <ShipModel type={ship.id} />
        </Float>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
          <circleGeometry args={[8, 64]} />
          <meshStandardMaterial color="#dfe8f2" roughness={1} metalness={0} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.61, 0]}>
          <ringGeometry args={[1.9, 3.2, 64]} />
          <meshBasicMaterial color="#b8d7f4" transparent opacity={0.32} side={THREE.DoubleSide} />
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
        <div className="text-[11px] uppercase tracking-[0.34em] text-slate-400">Fleet View</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{ship.name}</div>
        <div className="mt-1 text-sm text-slate-500">
          {ship.category === 'station' ? 'capital command asset' : 'tactical hull preview'}
        </div>
      </div>

      <div className="pointer-events-none absolute right-8 top-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-400">
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
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="text-sm font-medium text-slate-900">{value}</div>
      </div>
      <div className="h-[5px] bg-slate-200">
        <div className="h-full bg-slate-900 transition-all duration-300" style={{ width: `${width}%` }} />
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
        description: 'Standard deployed starter hull. Clean, familiar, and unchanged in class identity.',
        price: { common: 0, rare: 0 },
        stats: { health: 100, speed: 100, agility: 100, damage: 10 },
        category: 'ship',
        icon: <Rocket size={16} />,
      },
      {
        id: 'phantom',
        name: 'Phantom',
        description: 'A stealth-leaning blade frame with split wings, low profile mass, and fast strike behavior.',
        price: { common: 2600, rare: 650 },
        stats: { health: 220, speed: 90, agility: 86, damage: 24 },
        category: 'ship',
        icon: <Orbit size={16} />,
      },
      {
        id: 'lancer',
        name: 'Lancer',
        description: 'Long-form spear hull built for precision engagements, direct entry lines, and elite forward pressure.',
        price: { common: 6200, rare: 1800 },
        stats: { health: 190, speed: 96, agility: 80, damage: 34 },
        category: 'ship',
        icon: <Swords size={16} />,
      },
      {
        id: 'destroyer',
        name: 'Destroyer',
        description: 'Heavy tactical warship with stronger command presence, reinforced mid-body mass, and upgraded weapons geometry.',
        price: { common: 11800, rare: 3600 },
        stats: { health: 580, speed: 46, agility: 34, damage: 72 },
        category: 'ship',
        icon: <Bomb size={16} />,
      },
      {
        id: 'megaship',
        name: 'Aegis Command',
        description: 'A capital-scale mobile command platform built for orbital control, fleet coordination, and dominant field presence.',
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
    <div className="fixed inset-0 z-50 bg-[#f3f7fb]">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="mx-auto flex h-screen max-w-[1650px] flex-col px-4 py-4 md:px-6 md:py-6"
      >
        <div className="flex items-center justify-between px-1 pb-4 md:px-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.34em] text-slate-400">Fleet Hangar</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Ship Systems
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-6 md:flex">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Credits</div>
                <div className="mt-1 text-base font-semibold text-slate-950">{userData?.commonResources ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Rare</div>
                <div className="mt-1 text-base font-semibold text-slate-950">{userData?.rareResources ?? 0}</div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center bg-slate-900 text-white transition hover:bg-slate-700"
            >
              <Plus className="rotate-45" size={18} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[1.62fr_0.78fr]">
          <div className="min-h-0 overflow-hidden bg-white shadow-[0_20px_80px_rgba(20,40,70,0.08)]">
            <ShipShowcase ship={activeAsset} />

            <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveIndex((v) => (v - 1 + assets.length) % assets.length)}
                  className="flex items-center gap-2 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Selection</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {activeIndex + 1} / {assets.length}
                  </div>
                </div>

                <button
                  onClick={() => setActiveIndex((v) => (v + 1) % assets.length)}
                  className="flex items-center gap-2 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
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
                      className={`px-4 py-4 text-left transition ${
                        selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <div className={`${selected ? 'text-white' : 'text-slate-600'}`}>{item.icon}</div>
                        {owned && <Check size={15} className={selected ? 'text-white' : 'text-slate-900'} />}
                      </div>

                      <div className="text-sm font-semibold">{item.name}</div>
                      <div className={`mt-1 line-clamp-2 text-xs ${selected ? 'text-white/70' : 'text-slate-500'}`}>
                        {item.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-white px-5 py-5 shadow-[0_20px_80px_rgba(20,40,70,0.08)] md:px-6 md:py-6">
            <div className="text-[10px] uppercase tracking-[0.32em] text-slate-400">
              {activeAsset.category === 'station' ? 'Capital Asset' : 'Ship Profile'}
            </div>

            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {activeAsset.name}
            </h3>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              {activeAsset.description}
            </p>

            {isCurrentShip && (
              <div className="mt-4 inline-flex bg-slate-950 px-3 py-2 text-[10px] uppercase tracking-[0.26em] text-white">
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
              <div className="bg-slate-50 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Credits</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{activeAsset.price.common}</div>
              </div>
              <div className="bg-slate-50 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Rare</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{activeAsset.price.rare}</div>
              </div>
            </div>

            <button
              onClick={handleAcquire}
              disabled={loading !== null || isCurrentShip || !canAfford}
              className={`mt-8 flex w-full items-center justify-center gap-2 px-5 py-4 text-sm font-semibold transition ${
                isCurrentShip
                  ? 'bg-slate-950 text-white'
                  : 'bg-slate-950 text-white hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {loading === activeAsset.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-400">System Notes</div>

              <div className="space-y-3 text-sm leading-7 text-slate-500">
                <p>
                  The UI is now intentionally sharper and cleaner: no outlines, no card borders, no boxed chrome.
                </p>
                <p>
                  The starter scout remains visually familiar, while Phantom, Lancer, Destroyer, and Aegis Command are new hull directions.
                </p>
                <p>
                  The destroyer has been pushed further with stronger mass, harder wing geometry, a taller command spine, and a more premium heavy-warship silhouette.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
