import React, { useState } from 'react';
import { gameManager, UserData, ShipConfig } from '../services/gameManager';
import { Rocket, Shield, Zap, Target, Check, Lock, ChevronRight, Users } from 'lucide-react';
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Rocket className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Shipyard</h2>
              <p className="text-xs text-zinc-400">Upgrade your fleet and dominate the stars</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Your Resources</div>
              <div className="text-sm font-mono text-white">
                {userData?.commonResources}C / {userData?.rareResources}A
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <Lock className="rotate-45" size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {ships.map(ship => {
            const isOwned = currentShipType === ship.id;
            const canAfford = (userData?.commonResources || 0) >= ship.price.common && 
                             (userData?.rareResources || 0) >= ship.price.rare;

            return (
              <div 
                key={ship.id}
                className={`p-6 rounded-2xl border transition-all ${
                  isOwned 
                    ? 'bg-zinc-800/50 border-emerald-500/50 ring-1 ring-emerald-500/20' 
                    : 'bg-zinc-800/20 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{ship.name}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{ship.description}</p>
                  </div>
                  {isOwned && (
                    <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/20 uppercase tracking-widest">
                      Active Ship
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Shield size={14} className="text-blue-400" />
                      <span>Health: {ship.stats.health}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Zap size={14} className="text-yellow-400" />
                      <span>Speed: {ship.stats.speed}x</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Target size={14} className="text-red-400" />
                      <span>Damage: {ship.stats.damage}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <ChevronRight size={14} className="text-purple-400" />
                      <span>Agility: {ship.stats.agility}x</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Cost</span>
                    <span className="text-sm font-mono text-white">
                      {ship.price.common}C / {ship.price.rare}A
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleBuyShip(ship.id)}
                    disabled={isOwned || !canAfford || loading !== null}
                    className={`px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                      isOwned 
                        ? 'bg-emerald-500/10 text-emerald-500 cursor-default' 
                        : canAfford 
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {loading === ship.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isOwned ? (
                      <><Check size={16} /> Owned</>
                    ) : (
                      'Purchase'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Space Station Section */}
          <div className="col-span-full mt-8 mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Shield size={16} className="text-blue-400" /> Orbital Infrastructure
            </h3>
          </div>

          <div className="p-6 rounded-2xl border bg-zinc-800/20 border-zinc-800 hover:border-zinc-700 col-span-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Orbital Space Station</h3>
                <p className="text-sm text-zinc-500 mt-1">A massive mobile base that orbits planets. Can be piloted and serves as a transport.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Shield size={14} className="text-blue-400" />
                <span>Health: 5000</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Rocket size={14} className="text-emerald-400" />
                <span>Mobile Base & Transport</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Users size={14} className="text-blue-400" />
                <span>Clan Compatible</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Cost</span>
                <span className="text-sm font-mono text-white">
                  25000C / 10000A
                </span>
              </div>
              
              <button
                onClick={() => userData?.currentPlanetId && gameManager.buySpaceStation(userData.currentPlanetId)}
                disabled={loading !== null || (userData?.commonResources || 0) < 25000 || (userData?.rareResources || 0) < 10000}
                className="px-6 py-2 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all"
              >
                Purchase Station
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-zinc-900/80 border-t border-zinc-800">
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Common Resources (C)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Rare Resources (A)</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
