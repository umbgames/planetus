import React, { useState } from 'react';
import { gameManager, UserData, ShipConfig } from '../services/gameManager';
import { Rocket, Shield, Zap, Target, Check, Lock, ChevronRight, Users, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface ShipUpgradeUIProps {
  userData: UserData | null;
  onClose: () => void;
}

export const ShipUpgradeUI: React.FC<ShipUpgradeUIProps> = ({ userData, onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);

  const ships = [
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
  ];

  const handleBuyShip = async (type: string) => {
    setLoading(type);
    try {
      await gameManager.buyShip(type as any);
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
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <Rocket className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Shipyard Terminal</h2>
              <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Fleet Acquisition & Refit Protocol</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
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

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">
          {ships.map(ship => {
            const isOwned = currentShipType === ship.id;
            const canAfford = (userData?.commonResources || 0) >= ship.price.common && 
                             (userData?.rareResources || 0) >= ship.price.rare;

            return (
              <div 
                key={ship.id}
                className={`p-6 rounded-2xl border transition-all relative overflow-hidden group ${
                  isOwned 
                    ? 'bg-emerald-500/5 border-emerald-500/30' 
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter text-white uppercase">{ship.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">{ship.description}</p>
                  </div>
                  {isOwned && (
                    <div className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-2 py-1 rounded border border-emerald-500/30 uppercase tracking-[0.2em] animate-pulse">
                      Active Deployment
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield size={12} className="text-blue-400" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Integrity</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">{ship.stats.health}</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={12} className="text-yellow-400" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Velocity</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">{ship.stats.speed}x</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={12} className="text-red-400" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Firepower</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">{ship.stats.damage}</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronRight size={12} className="text-purple-400" />
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Agility</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">{ship.stats.agility}x</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Acquisition Cost</span>
                    <div className="flex gap-3">
                      <span className="text-sm font-black font-mono text-white">{ship.price.common} <span className="text-[10px] text-zinc-500">C</span></span>
                      <span className="text-sm font-black font-mono text-fuchsia-400">{ship.price.rare} <span className="text-[10px] text-zinc-500">A</span></span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleBuyShip(ship.id)}
                    disabled={isOwned || !canAfford || loading !== null}
                    className={`px-8 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all flex items-center gap-2 uppercase border ${
                      isOwned 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default' 
                        : canAfford 
                          ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 shadow-lg shadow-blue-500/20' 
                          : 'bg-white/5 text-zinc-600 border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {loading === ship.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isOwned ? (
                      <><Check size={14} /> Deployed</>
                    ) : (
                      'Initialize Purchase'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Space Station Section */}
          <div className="col-span-full mt-12 mb-6">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2 whitespace-nowrap">
                <Shield size={14} className="text-blue-400" /> Strategic Assets
              </h3>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          </div>

          <div className="p-8 rounded-2xl border bg-blue-600/5 border-blue-500/20 col-span-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Rocket size={200} />
            </div>
            
            <div className="relative z-10 flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black tracking-tighter text-white uppercase">Orbital Command Station</h3>
                <p className="text-sm text-zinc-500 mt-2 font-mono uppercase tracking-wider max-w-xl">Massive mobile infrastructure capable of planetary orbit and multi-sector transport. Serves as a mobile base of operations for high-tier fleets.</p>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-blue-400" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Hull Integrity</span>
                </div>
                <div className="text-2xl font-black font-mono text-white">50,000</div>
              </div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Class</span>
                </div>
                <div className="text-2xl font-black font-mono text-white">MOBILE BASE</div>
              </div>
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-blue-400" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Capacity</span>
                </div>
                <div className="text-2xl font-black font-mono text-white">CLAN SCALE</div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between pt-8 border-t border-white/5">
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
          <div className="flex items-center gap-8 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span>Standard Credits (C)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-fuchsia-500/50" />
              <span>Anomalous Matter (A)</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
