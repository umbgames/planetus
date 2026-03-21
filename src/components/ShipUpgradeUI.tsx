import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { gameManager, UserData } from '../services/gameManager';
import { Rocket, Shield, Zap, Target, Check, ChevronRight, Users, Plus, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface ShipUpgradeUIProps {
  userData: UserData | null;
  onClose: () => void;
}

type ShipEntry = {
  id: 'scout' | 'fighter' | 'interceptor' | 'bomber';
  name: string;
  description: string;
  price: { common: number; rare: number };
  stats: { health: number; speed: number; agility: number; damage: number };
  color: string;
};

function ShipPreviewModel({ type }: { type: ShipEntry['id'] }) {
  const emissive = new THREE.Color('#6ee7ff');
  const hull = new THREE.Color(type === 'bomber' ? '#7b8798' : type === 'interceptor' ? '#66758a' : '#768398');
  const accent = new THREE.Color(type === 'fighter' ? '#34d399' : type === 'interceptor' ? '#fbbf24' : type === 'bomber' ? '#fb7185' : '#60a5fa');

  return (
    <group rotation={[0.2, Math.PI, 0]}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={type === 'bomber' ? [1.2, 0.55, 3.8] : type === 'interceptor' ? [0.72, 0.32, 2.9] : type === 'fighter' ? [0.95, 0.42, 3.2] : [0.8, 0.34, 2.4]} />
        <meshStandardMaterial color={hull} metalness={0.76} roughness={0.24} emissive={'#121826'} emissiveIntensity={0.22} />
      </mesh>

      <mesh position={[0, 0.3, -0.3]} castShadow>
        <boxGeometry args={type === 'bomber' ? [0.62, 0.35, 1.2] : [0.45, 0.26, 1]} />
        <meshStandardMaterial color={'#9ae6ff'} emissive={emissive} emissiveIntensity={0.7} metalness={0.88} roughness={0.06} transparent opacity={0.92} />
      </mesh>

      <mesh position={[0, 0, type === 'bomber' ? -2.2 : -1.8]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={type === 'bomber' ? [0.42, 1.2, 5] : [0.32, 1, 5]} />
        <meshStandardMaterial color={'#697586'} metalness={0.72} roughness={0.26} emissive={'#111827'} emissiveIntensity={0.18} />
      </mesh>

      <mesh position={[0, 0, 0.25]} castShadow>
        <boxGeometry args={type === 'interceptor' ? [4.2, 0.04, 0.7] : type === 'bomber' ? [5.5, 0.08, 1.1] : [4.8, 0.05, 0.9]} />
        <meshStandardMaterial color={accent} metalness={0.62} roughness={0.32} emissive={accent} emissiveIntensity={0.18} />
      </mesh>

      <mesh position={[-0.4, 0.34, 1.05]} castShadow>
        <boxGeometry args={[0.08, 0.75, 0.55]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} metalness={0.36} roughness={0.4} />
      </mesh>
      <mesh position={[0.4, 0.34, 1.05]} castShadow>
        <boxGeometry args={[0.08, 0.75, 0.55]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} metalness={0.36} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0, 1.8]}>
        <boxGeometry args={[0.5, 0.18, 0.08]} />
        <meshStandardMaterial color={'#d8fbff'} emissive={emissive} emissiveIntensity={4.5} />
      </mesh>
    </group>
  );
}

function ShipPreviewStage({ ship }: { ship: ShipEntry }) {
  return (
    <div className="relative h-[280px] w-full rounded-2xl overflow-hidden border border-white/10 bg-black/30">
      <Canvas camera={{ position: [0, 1.2, 7], fov: 38 }} shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#05070b']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 8, 5]} intensity={1.6} castShadow />
        <pointLight position={[0, 1.2, 2.8]} intensity={2.4} color="#7dd3fc" />
        <ShipPreviewModel type={ship.id} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
          <circleGeometry args={[8, 48]} />
          <meshStandardMaterial color="#081018" roughness={1} metalness={0} />
        </mesh>
        <OrbitControls enablePan={false} minDistance={4.5} maxDistance={9} autoRotate autoRotateSpeed={1.2} />
        <Environment preset="night" />
      </Canvas>
      <div className="absolute left-4 top-4 bg-black/50 border border-white/10 rounded-xl px-3 py-2">
        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.25em]">Interactive Drydock</div>
        <div className="text-sm font-black text-white mt-1">{ship.name}</div>
      </div>
    </div>
  );
}

export const ShipUpgradeUI: React.FC<ShipUpgradeUIProps> = ({ userData, onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const ships = useMemo<ShipEntry[]>(() => [
    {
      id: 'scout',
      name: 'Scout',
      description: 'Light and fast exploration vessel.',
      price: { common: 0, rare: 0 },
      stats: { health: 100, speed: 1.0, agility: 1.0, damage: 10 },
      color: 'blue'
    },
    {
      id: 'fighter',
      name: 'Fighter',
      description: 'Balanced combat ship for general defense.',
      price: { common: 2000, rare: 500 },
      stats: { health: 250, speed: 1.2, agility: 0.8, damage: 25 },
      color: 'emerald'
    },
    {
      id: 'interceptor',
      name: 'Interceptor',
      description: 'High-speed vessel designed for quick strikes.',
      price: { common: 5000, rare: 1500 },
      stats: { health: 150, speed: 2.0, agility: 1.5, damage: 15 },
      color: 'amber'
    },
    {
      id: 'bomber',
      name: 'Bomber',
      description: 'Heavy armor and massive firepower.',
      price: { common: 10000, rare: 3000 },
      stats: { health: 500, speed: 0.7, agility: 0.4, damage: 60 },
      color: 'rose'
    }
  ], []);

  const activeShip = ships[activeIndex] ?? ships[0];

  const handleBuyShip = async (type: string) => {
    setLoading(type);
    try {
      await gameManager.buyShip(type as ShipEntry['id']);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const currentShipType = userData?.shipConfig?.type || 'scout';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-black/20 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <Rocket className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Shipyard Terminal</h2>
              <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Fleet Acquisition, Preview & Refit</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Available Credits</div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="text-sm font-black font-mono text-white">{userData?.commonResources} <span className="text-[10px] text-zinc-500">C</span></div>
                <div className="text-sm font-black font-mono text-fuchsia-400">{userData?.rareResources} <span className="text-[10px] text-zinc-500">A</span></div>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all">
              <Plus className="rotate-45" size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
            <div className="space-y-4">
              <ShipPreviewStage ship={activeShip} />
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setActiveIndex((value) => (value - 1 + ships.length) % ships.length)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-black text-white uppercase tracking-wider"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <div className="text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Model Switcher</div>
                  <div className="text-sm text-white font-semibold">{activeIndex + 1} / {ships.length}</div>
                </div>
                <button
                  onClick={() => setActiveIndex((value) => (value + 1) % ships.length)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-black text-white uppercase tracking-wider"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.25em]">Selected Hull</div>
                  <h3 className="text-3xl font-black tracking-tighter text-white uppercase mt-1">{activeShip.name}</h3>
                  <p className="text-sm text-zinc-400 mt-2">{activeShip.description}</p>
                </div>
                {currentShipType === activeShip.id && (
                  <div className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-2 py-1 rounded border border-emerald-500/30 uppercase tracking-[0.2em]">
                    Active Deployment
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-2"><Shield size={12} className="text-blue-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Integrity</span></div>
                  <div className="text-lg font-black font-mono text-white">{activeShip.stats.health}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-2"><Zap size={12} className="text-yellow-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Velocity</span></div>
                  <div className="text-lg font-black font-mono text-white">{activeShip.stats.speed}x</div>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-2"><Target size={12} className="text-red-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Firepower</span></div>
                  <div className="text-lg font-black font-mono text-white">{activeShip.stats.damage}</div>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-2"><ChevronRight size={12} className="text-purple-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Agility</span></div>
                  <div className="text-lg font-black font-mono text-white">{activeShip.stats.agility}x</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 border-t border-white/5 gap-4">
                <div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Acquisition Cost</div>
                  <div className="flex gap-3">
                    <span className="text-sm font-black font-mono text-white">{activeShip.price.common} <span className="text-[10px] text-zinc-500">C</span></span>
                    <span className="text-sm font-black font-mono text-fuchsia-400">{activeShip.price.rare} <span className="text-[10px] text-zinc-500">A</span></span>
                  </div>
                </div>
                <button
                  onClick={() => handleBuyShip(activeShip.id)}
                  disabled={currentShipType === activeShip.id || loading !== null || (userData?.commonResources || 0) < activeShip.price.common || (userData?.rareResources || 0) < activeShip.price.rare}
                  className={`px-6 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all flex items-center gap-2 uppercase border ${
                    currentShipType === activeShip.id
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 shadow-lg shadow-blue-500/20 disabled:bg-white/5 disabled:text-zinc-600 disabled:border-white/5'
                  }`}
                >
                  {loading === activeShip.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : currentShipType === activeShip.id ? <><Check size={14} /> Deployed</> : 'Initialize Purchase'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {ships.map((ship, index) => {
              const isOwned = currentShipType === ship.id;
              return (
                <button
                  key={ship.id}
                  onClick={() => setActiveIndex(index)}
                  className={`text-left p-4 rounded-2xl border transition-all ${activeShip.id === ship.id ? 'bg-cyan-500/10 border-cyan-400/40' : 'bg-white/5 border-white/5 hover:border-white/10'} `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black text-white uppercase tracking-tight">{ship.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{ship.description}</div>
                    </div>
                    {isOwned && <Check size={16} className="text-emerald-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="col-span-full mt-10 mb-2">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2 whitespace-nowrap">
                <Shield size={14} className="text-blue-400" /> Strategic Assets
              </h3>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          </div>

          <div className="p-8 rounded-2xl border bg-blue-600/5 border-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5"><Rocket size={200} /></div>
            <div className="relative z-10 flex justify-between items-start mb-8 gap-6 flex-wrap">
              <div>
                <h3 className="text-3xl font-black tracking-tighter text-white uppercase">Orbital Command Station</h3>
                <p className="text-sm text-zinc-500 mt-2 font-mono uppercase tracking-wider max-w-xl">Massive mobile infrastructure capable of planetary orbit and multi-sector transport. Serves as a mobile base of operations for high-tier fleets.</p>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-black/40 rounded-xl p-4 border border-white/5"><div className="flex items-center gap-2 mb-2"><Shield size={14} className="text-blue-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Hull Integrity</span></div><div className="text-2xl font-black font-mono text-white">50,000</div></div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/5"><div className="flex items-center gap-2 mb-2"><Rocket size={14} className="text-emerald-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Class</span></div><div className="text-2xl font-black font-mono text-white">MOBILE BASE</div></div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/5"><div className="flex items-center gap-2 mb-2"><Users size={14} className="text-blue-400" /><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Capacity</span></div><div className="text-2xl font-black font-mono text-white">CLAN SCALE</div></div>
            </div>

            <div className="relative z-10 flex items-center justify-between pt-8 border-t border-white/5 gap-4 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Asset Valuation</span>
                <div className="flex gap-4">
                  <span className="text-xl font-black font-mono text-white">25,000 <span className="text-xs text-zinc-500">C</span></span>
                  <span className="text-xl font-black font-mono text-fuchsia-400">10,000 <span className="text-xs text-zinc-500">A</span></span>
                </div>
              </div>
              <button
                onClick={() => userData?.currentPlanetId && gameManager.buySpaceStation(userData.currentPlanetId)}
                disabled={loading !== null || (userData?.commonResources || 0) < 25000 || (userData?.rareResources || 0) < 10000}
                className="px-10 py-4 rounded-xl font-black text-xs tracking-widest bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-xl shadow-blue-500/20 disabled:bg-white/5 disabled:text-zinc-600 disabled:border-white/5 transition-all uppercase"
              >
                Authorize Construction
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-black/40 border-t border-white/5">
          <div className="flex items-center gap-8 text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex-wrap">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-white/20" /><span>Standard Credits (C)</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-fuchsia-500/50" /><span>Anomalous Matter (A)</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500/50" /><span>Touch + drag to inspect models</span></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
