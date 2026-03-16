import React, { useState } from 'react';
import { gameManager, Clan, UserData } from '../services/gameManager';
import { Users, Plus, UserPlus, LogOut, Shield, Trophy, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClanUIProps {
  userData: UserData | null;
  clans: Clan[];
  onClose: () => void;
}

export const ClanUI: React.FC<ClanUIProps> = ({ userData, clans, onClose }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [clanName, setClanName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const userClan = clans.find(c => c.id === userData?.clanId);
  const filteredClans = clans.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClan = async () => {
    if (!clanName.trim()) return;
    setLoading(true);
    try {
      await gameManager.createClan(clanName);
      setIsCreating(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    setLoading(true);
    try {
      await gameManager.joinClan(clanId);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Clan Command</h2>
              <p className="text-xs text-zinc-400">United we dominate the sector</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {userClan ? (
            <div className="space-y-6">
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{userClan.name}</h3>
                    <p className="text-sm text-blue-400 flex items-center gap-1">
                      <Shield size={14} /> Clan ID: {userClan.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Treasury</div>
                    <div className="text-lg font-mono text-white">{userClan.commonResources}C / {userClan.rareResources}A</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">Members</div>
                    <div className="text-xl font-bold text-white">{userClan.members.length}</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">Rank</div>
                    <div className="text-xl font-bold text-white">#12</div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase mb-1">Power</div>
                    <div className="text-xl font-bold text-white">8.4k</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Clan Members</h4>
                <div className="space-y-2">
                  {userClan.members.map(memberId => (
                    <div key={memberId} className="flex justify-between items-center p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {memberId === userClan.leaderId ? <Trophy size={14} className="text-yellow-500" /> : <Users size={14} />}
                        </div>
                        <span className="text-sm text-white">{memberId === userData?.uid ? 'You' : memberId.substring(0, 8)}</span>
                      </div>
                      {memberId === userClan.leaderId && (
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20">LEADER</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isCreating ? (
                <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700 space-y-4">
                  <h3 className="text-lg font-bold text-white">Establish New Clan</h3>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-2">Clan Name</label>
                    <input 
                      type="text" 
                      value={clanName}
                      onChange={(e) => setClanName(e.target.value)}
                      placeholder="Enter clan name..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={handleCreateClan}
                      disabled={loading || !clanName.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-bold py-2 rounded-lg transition-colors"
                    >
                      {loading ? 'Establishing...' : 'Confirm Establishment'}
                    </button>
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search clans..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button 
                      onClick={() => setIsCreating(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus size={18} /> Create
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Available Clans</h4>
                    {filteredClans.length > 0 ? (
                      filteredClans.map(clan => (
                        <div key={clan.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-800 flex justify-between items-center hover:border-zinc-600 transition-colors">
                          <div>
                            <h5 className="font-bold text-white">{clan.name}</h5>
                            <p className="text-xs text-zinc-500">{clan.members.length} Members • Created {new Date(clan.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button 
                            onClick={() => handleJoinClan(clan.id)}
                            disabled={loading}
                            className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <UserPlus size={14} /> Join
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 bg-zinc-800/20 rounded-xl border border-dashed border-zinc-800">
                        <Users className="mx-auto text-zinc-700 mb-3" size={48} />
                        <p className="text-zinc-500">No clans found matching your search.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
