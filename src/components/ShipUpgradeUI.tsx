import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'motion/react';
import {
  Rocket,
  Shield,
  Zap,
  Target,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Crown,
  Swords,
  Gauge,
  Bomb,
  Building2,
} from 'lucide-react';
import { gameManager, UserData } from '../services/gameManager';

interface ShipUpgradeUIProps {
  userData: UserData | null;
  onClose: () => void;
}

type ShipEntry = {
  id: 'scout' | 'fighter' | 'interceptor' | 'bomber' | 'megaship';
  name: string;
  description: string;
  price: { common: number; rare: number };
  stats: { health: number; speed: number; agility: number; damage: number };
  accent: string;
  icon: React.ReactNode;
  category: 'ship' | 'station';
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStat(value: number, max: number) {
  return clamp(value / max, 0, 1);
}

function EngineGlow({
  position,
  scale = [1, 1, 1],
  color = '#8be9fd',
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[0.18, 20, 20]} />
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

function WingPanel({
  position,
  rotation = [0, 0, 0],
  size = [1.8, 0.06, 0.75],
  color,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size?: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={0.7}
        roughness={0.25}
        emissive={color}
        emissiveIntensity={0.14}
      />
    </mesh>
  );
}

function ShipPreviewModel({ type }: { type: ShipEntry['id'] }) {
  const hullDark = '#8b98a7';
  const hullMid = '#b8c4d1';
  const hullDeep = '#5f6c7d';

  if (type === 'scout') {
    return (
      <group rotation={[0.2, Math.PI, 0]} position={[0, -0.1, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.42, 2.1, 8, 16]} />
          <meshStandardMaterial color={hullMid} metalness={0.85} roughness={0.2} />
        </mesh>

        <mesh position={[0, 0.22, -0.4]} castShadow>
          <boxGeometry args={[0.46, 0.26, 0.92]} />
          <meshStandardMaterial
            color="#d7f6ff"
            emissive="#8be9fd"
            emissiveIntensity={0.8}
            metalness={0.9}
            roughness={0.05}
            transparent
            opacity={0.92}
          />
        </mesh>

        <WingPanel position={[0, -0.02, 0.2]} size={[3.4, 0.05, 0.68]} color="#60a5fa" />
        <WingPanel position={[0, 0.14, 0.95]} size={[1.1, 0.04, 0.42]} color="#93c5fd" />
        <WingPanel position={[0, -0.12, -1.1]} size={[0.5, 0.22, 0.9]} color={hullDeep} />

        <mesh position={[0, -0.02, -1.55]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.26, 0.8, 6]} />
          <meshStandardMaterial color={hullDark} metalness={0.75} roughness={0.2} />
        </mesh>

        <EngineGlow position={[0, 0, 1.42]} scale={[1, 0.7, 0.6]} color="#67e8f9" />
      </group>
    );
  }

  if (type === 'fighter') {
    return (
      <group rotation={[0.18, Math.PI, 0]} position={[0, -0.05, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.5, 2.45, 8, 16]} />
          <meshStandardMaterial color={hullMid} metalness={0.88} roughness={0.17} />
        </mesh>

        <mesh position={[0, 0.28, -0.35]} castShadow>
          <boxGeometry args={[0.55, 0.3, 1.05]} />
          <meshStandardMaterial
            color="#dcfff5"
            emissive="#34d399"
            emissiveIntensity={0.75}
            metalness={0.92}
            roughness={0.05}
            transparent
            opacity={0.9}
          />
        </mesh>

        <WingPanel position={[-1.45, -0.02, 0.1]} rotation={[0, 0, -0.22]} size={[1.85, 0.05, 0.9]} color="#34d399" />
        <WingPanel position={[1.45, -0.02, 0.1]} rotation={[0, 0, 0.22]} size={[1.85, 0.05, 0.9]} color="#34d399" />

        <mesh position={[0, -0.08, 0.92]} castShadow>
          <boxGeometry args={[0.42, 0.16, 0.8]} />
          <meshStandardMaterial color={hullDeep} metalness={0.7} roughness={0.25} />
        </mesh>

        <mesh position={[-0.38, -0.1, -0.2]} castShadow>
          <boxGeometry args={[0.12, 0.12, 1.55]} />
          <meshStandardMaterial color="#d1d9e6" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0.38, -0.1, -0.2]} castShadow>
          <boxGeometry args={[0.12, 0.12, 1.55]} />
          <meshStandardMaterial color="#d1d9e6" metalness={0.7} roughness={0.2} />
        </mesh>

        <EngineGlow position={[-0.24, -0.02, 1.55]} scale={[0.7, 0.62, 0.5]} color="#6ee7b7" />
        <EngineGlow position={[0.24, -0.02, 1.55]} scale={[0.7, 0.62, 0.5]} color="#6ee7b7" />
      </group>
    );
  }

  if (type === 'interceptor') {
    return (
      <group rotation={[0.16, Math.PI, 0]} position={[0, -0.08, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.38, 2.6, 8, 16]} />
          <meshStandardMaterial color="#c5d0da" metalness={0.92} roughness={0.14} />
        </mesh>

        <mesh position={[0, 0.2, -0.4]} castShadow>
          <boxGeometry args={[0.42, 0.22, 0.86]} />
          <meshStandardMaterial
            color="#fff5c9"
            emissive="#fbbf24"
            emissiveIntensity={0.78}
            metalness={0.95}
            roughness={0.05}
            transparent
            opacity={0.9}
          />
        </mesh>

        <WingPanel position={[-1.95, 0.02, 0.15]} rotation={[0, 0, -0.48]} size={[2.5, 0.04, 0.48]} color="#fbbf24" />
        <WingPanel position={[1.95, 0.02, 0.15]} rotation={[0, 0, 0.48]} size={[2.5, 0.04, 0.48]} color="#fbbf24" />

        <mesh position={[0, -0.1, 0.95]} castShadow>
          <boxGeometry args={[0.26, 0.12, 0.78]} />
          <meshStandardMaterial color="#64748b" metalness={0.72} roughness={0.25} />
        </mesh>

        <mesh position={[0, 0.1, -1.5]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.22, 1, 6]} />
          <meshStandardMaterial color="#7c8999" metalness={0.82} roughness={0.18} />
        </mesh>

        <EngineGlow position={[0, 0, 1.72]} scale={[0.85, 0.5, 0.42]} color="#fde68a" />
      </group>
    );
  }

  if (type === 'bomber') {
    return (
      <group rotation={[0.14, Math.PI, 0]} position={[0, -0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.25, 0.62, 3.5]} />
          <meshStandardMaterial color="#98a5b3" metalness={0.82} roughness={0.22} />
        </mesh>

        <mesh position={[0, 0.36, -0.5]} castShadow>
          <boxGeometry args={[0.62, 0.3, 1.05]} />
          <meshStandardMaterial
            color="#ffe4ef"
            emissive="#fb7185"
            emissiveIntensity={0.72}
            metalness={0.9}
            roughness={0.06}
            transparent
            opacity={0.9}
          />
        </mesh>

        <WingPanel position={[-1.85, -0.05, 0.2]} rotation={[0, 0, -0.18]} size={[2.35, 0.08, 1.15]} color="#fb7185" />
        <WingPanel position={[1.85, -0.05, 0.2]} rotation={[0, 0, 0.18]} size={[2.35, 0.08, 1.15]} color="#fb7185" />

        <mesh position={[0, -0.22, 0.25]} castShadow>
          <boxGeometry args={[0.82, 0.22, 1.7]} />
          <meshStandardMaterial color="#5f6b79" metalness={0.7} roughness={0.3} />
        </mesh>

        <mesh position={[-0.52, -0.14, -0.35]} castShadow>
          <boxGeometry args={[0.18, 0.18, 1.4]} />
          <meshStandardMaterial color="#d6dde7" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0.52, -0.14, -0.35]} castShadow>
          <boxGeometry args={[0.18, 0.18, 1.4]} />
          <meshStandardMaterial color="#d6dde7" metalness={0.7} roughness={0.2} />
        </mesh>

        <EngineGlow position={[-0.34, -0.04, 1.84]} scale={[0.78, 0.68, 0.52]} color="#fda4af" />
        <EngineGlow position={[0.34, -0.04, 1.84]} scale={[0.78, 0.68, 0.52]} color="#fda4af" />
      </group>
    );
  }

  return (
    <group rotation={[0.1, Math.PI, 0]} position={[0, -0.2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.2, 0.9, 6.2]} />
        <meshStandardMaterial color="#8f9cab" metalness={0.86} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.82, -0.2]} castShadow>
        <boxGeometry args={[1.25, 0.5, 2.2]} />
        <meshStandardMaterial
          color="#e6f0ff"
          emissive="#60a5fa"
          emissiveIntensity={0.65}
          metalness={0.95}
          roughness={0.06}
          transparent
          opacity={0.88}
        />
      </mesh>

      <WingPanel position={[-2.3, 0.08, -0.15]} rotation={[0, 0, -0.12]} size={[2.9, 0.12, 2.15]} color="#60a5fa" />
      <WingPanel position={[2.3, 0.08, -0.15]} rotation={[0, 0, 0.12]} size={[2.9, 0.12, 2.15]} color="#60a5fa" />

      <mesh position={[0, -0.42, -0.6]} castShadow>
        <boxGeometry args={[1.28, 0.35, 3.3]} />
        <meshStandardMaterial color="#5c6978" metalness={0.74} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.34, 2.2]} castShadow>
        <boxGeometry args={[1.35, 0.36, 1.5]} />
        <meshStandardMaterial color="#667386" metalness={0.72} roughness={0.28} />
      </mesh>

      <mesh position={[-1.45, 0.44, 1.8]} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.6]} />
        <meshStandardMaterial color="#7e8a98" metalness={0.78} roughness={0.2} />
      </mesh>
      <mesh position={[1.45, 0.44, 1.8]} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.6]} />
        <meshStandardMaterial color="#7e8a98" metalness={0.78} roughness={0.2} />
      </mesh>

      <mesh position={[0, 1.08, 1.3]} castShadow>
        <boxGeometry args={[0.42, 0.9, 0.42]} />
        <meshStandardMaterial color="#aab6c5" metalness={0.82} roughness={0.16} />
      </mesh>

      <mesh position={[0, 0.05, -2.65]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.72, 1.6, 8]} />
        <meshStandardMaterial color="#6f7b8a" metalness={0.8} roughness={0.22} />
      </mesh>

      <EngineGlow position={[-0.76, 0, 3.22]} scale={[1.15, 0.82, 0.55]} color="#93c5fd" />
      <EngineGlow position={[0, 0.05, 3.28]} scale={[1.35, 0.9, 0.6]} color="#bfdbfe" />
      <EngineGlow position={[0.76, 0, 3.22]} scale={[1.15, 0.82, 0.55]} color="#93c5fd" />
    </group>
  );
}

function Starfield() {
  const stars = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 90; i += 1) {
      positions.push([
        (Math.random() - 0.5) * 20,
        Math.random() * 8 - 2,
        (Math.random() - 0.5) * 20,
      ]);
    }
    return positions;
  }, []);

  return (
    <group>
      {stars.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color="#dbeafe" />
        </mesh>
      ))}
    </group>
  );
}

function PreviewScene({ ship }: { ship: ShipEntry }) {
  return (
    <div className="relative h-[52vh] min-h-[420px] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#06080d]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_22%)] pointer-events-none" />

      <Canvas
        camera={{ position: [0, 1.2, 8.2], fov: 34 }}
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#06080d']} />
        <fog attach="fog" args={['#06080d', 8, 18]} />

        <ambientLight intensity={0.65} />
        <directionalLight position={[7, 9, 6]} intensity={1.8} castShadow />
        <pointLight position={[0, 1.8, 3]} intensity={2.2} color="#93c5fd" />
        <pointLight position={[-4, 0, 4]} intensity={1.2} color="#ffffff" />

        <Starfield />

        <Float speed={1.6} rotationIntensity={0.16} floatIntensity={0.38}>
          <ShipPreviewModel type={ship.id} />
        </Float>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]} receiveShadow>
          <circleGeometry args={[8, 64]} />
          <meshStandardMaterial color="#0a1018" roughness={1} metalness={0} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.54, 0]}>
          <ringGeometry args={[1.75, 3.1, 64]} />
          <meshBasicMaterial color="#1d4ed8" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.8}
          maxPolarAngle={Math.PI / 1.9}
          autoRotate
          autoRotateSpeed={0.65}
        />

        <Environment preset="city" />
      </Canvas>

      <div className="absolute left-5 top-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Drydock View</div>
        <div className="mt-1 text-lg font-semibold text-white">{ship.name}</div>
        <div className="text-xs text-zinc-400">{ship.category === 'station' ? 'Capital Asset Model' : 'Hull Preview Model'}</div>
      </div>

      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="text-[11px] uppercase tracking-[0.24em] text-zinc-300">Live 3D</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}

function StatBar({
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
  const ratio = normalizeStat(value, max);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-zinc-400">{icon}</span>
          <span className="text-xs uppercase tracking-[0.22em]">{label}</span>
        </div>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/6">
        <div
          className="h-full rounded-full bg-white/80 transition-all duration-300"
          style={{ width: `${ratio * 100}%` }}
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
        description: 'Light reconnaissance hull built for mobility and fast route discovery.',
        price: { common: 0, rare: 0 },
        stats: { health: 100, speed: 100, agility: 100, damage: 10 },
        accent: 'text-sky-300',
        icon: <Rocket size={16} />,
        category: 'ship',
      },
      {
        id: 'fighter',
        name: 'Fighter',
        description: 'Balanced frontline craft with stronger armor and better weapons handling.',
        price: { common: 2000, rare: 500 },
        stats: { health: 250, speed: 82, agility: 72, damage: 25 },
        accent: 'text-emerald-300',
        icon: <Swords size={16} />,
        category: 'ship',
      },
      {
        id: 'interceptor',
        name: 'Interceptor',
        description: 'Fast strike frame optimized for burst movement and aggressive approach angles.',
        price: { common: 5000, rare: 1500 },
        stats: { health: 150, speed: 100, agility: 92, damage: 15 },
        accent: 'text-amber-300',
        icon: <Gauge size={16} />,
        category: 'ship',
      },
      {
        id: 'bomber',
        name: 'Bomber',
        description: 'Heavy attack platform with oversized payload capacity and strong survivability.',
        price: { common: 10000, rare: 3000 },
        stats: { health: 500, speed: 42, agility: 36, damage: 60 },
        accent: 'text-rose-300',
        icon: <Bomb size={16} />,
        category: 'ship',
      },
      {
        id: 'megaship',
        name: 'Orbital Command',
        description: 'Massive clan-scale mobile command ship with full capital-class presence.',
        price: { common: 25000, rare: 10000 },
        stats: { health: 1000, speed: 24, agility: 18, damage: 140 },
        accent: 'text-violet-300',
        icon: <Crown size={16} />,
        category: 'station',
      },
    ],
    []
  );

  const activeAsset = assets[activeIndex] ?? assets[0];
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="mx-auto flex h-screen max-w-[1600px] flex-col px-4 py-4 md:px-6 md:py-6"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0d12] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 md:px-7 md:py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
                <Rocket size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-[0.08em] text-white md:text-xl">
                  Fleet Hangar
                </h2>
                <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  Minimal Acquisition Interface
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-6">
              <div className="hidden items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 md:flex">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Credits</div>
                  <div className="text-sm font-semibold text-white">
                    {userData?.commonResources ?? 0}
                  </div>
                </div>
                <div className="h-8 w-px bg-white/8" />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Rare</div>
                  <div className="text-sm font-semibold text-violet-300">
                    {userData?.rareResources ?? 0}
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <Plus className="rotate-45" size={18} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
            <div className="grid gap-5 xl:grid-cols-[1.6fr_0.78fr]">
              <div className="space-y-4">
                <PreviewScene ship={activeAsset} />

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setActiveIndex((v) => (v - 1 + assets.length) % assets.length)}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Selection</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {activeIndex + 1} / {assets.length}
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveIndex((v) => (v + 1) % assets.length)}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
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
                        className={`group rounded-[22px] border p-4 text-left transition ${
                          selected
                            ? 'border-white/25 bg-white/[0.08]'
                            : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                              selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/20 text-zinc-400'
                            }`}
                          >
                            {item.icon}
                          </div>
                          {owned && <Check size={16} className="text-emerald-300" />}
                          {item.id === 'megaship' && !owned && <Building2 size={16} className="text-violet-300" />}
                        </div>

                        <div className="text-sm font-medium text-white">{item.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 md:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                        {activeAsset.category === 'station' ? 'Capital Asset' : 'Ship Hull'}
                      </div>
                      <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                        {activeAsset.name}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {activeAsset.description}
                      </p>
                    </div>

                    {isCurrentShip && (
                      <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                        Active
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <StatBar label="Integrity" value={activeAsset.stats.health} max={1000} icon={<Shield size={14} />} />
                    <StatBar label="Speed" value={activeAsset.stats.speed} max={100} icon={<Zap size={14} />} />
                    <StatBar label="Agility" value={activeAsset.stats.agility} max={100} icon={<Gauge size={14} />} />
                    <StatBar label="Damage" value={activeAsset.stats.damage} max={140} icon={<Target size={14} />} />
                  </div>

                  <div className="mt-6 rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Cost</div>
                    <div className="mt-3 flex items-end gap-5">
                      <div>
                        <div className="text-2xl font-semibold text-white">
                          {activeAsset.price.common}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Credits</div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold text-violet-300">
                          {activeAsset.price.rare}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Rare</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAcquire}
                    disabled={loading !== null || isCurrentShip || !canAfford}
                    className={`mt-6 flex w-full items-center justify-center gap-2 rounded-[20px] border px-5 py-4 text-sm font-medium transition ${
                      isCurrentShip
                        ? 'cursor-default border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 bg-white text-black hover:bg-zinc-200 disabled:border-white/8 disabled:bg-white/5 disabled:text-zinc-600'
                    }`}
                  >
                    {loading === activeAsset.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    ) : isCurrentShip ? (
                      <>
                        <Check size={16} />
                        Deployed
                      </>
                    ) : activeAsset.id === 'megaship' ? (
                      'Authorize Construction'
                    ) : (
                      'Acquire Hull'
                    )}
                  </button>
                </div>

                <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Notes</div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                    <p>
                      The interface is intentionally reduced: the 3D view dominates the upper screen, while lower actions are compressed into icon-driven selectors.
                    </p>
                    <p>
                      The former mega ship card is now treated as a real previewable capital model, not a text-only block.
                    </p>
                    <p>
                      All ships use more refined silhouettes, stronger engine lighting, and cleaner materials for a higher-end presentation.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-white/50" />
                    <span>Minimal UI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-300/70" />
                    <span>3D Hero View</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-300/70" />
                    <span>Capital Ship Model</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
