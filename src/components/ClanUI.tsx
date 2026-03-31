import React, { useState, useEffect } from 'react';
import { gameManager, Clan, UserData } from '../services/gameManager';
import { Users, Plus, UserPlus, LogOut, Shield, Trophy, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  const userClan = clans.find(c => c.id === userData?.clanId);
  const filteredClans = clans.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (userClan) {
      const fetchNames = async () => {
        const names: Record<string, string> = {};
        for (const memberId of userClan.members) {
          if (memberId === userData?.uid) {
            names[memberId] = userData.displayName;
          } else {
            try {
              const userSnap = await getDoc(doc(db, 'users', memberId));
              if (userSnap.exists()) {
                names[memberId] = userSnap.data().displayName || memberId.substring(0, 8);
              } else {
                names[memberId] = memberId.substring(0, 8);
              }
            } catch (e) {
              names[memberId] = memberId.substring(0, 8);
            }
          }
        }
        setMemberNames(names);
      };
      fetchNames();
    }
  }, [userClan, userData]);

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

  const handleLeaveClan = async () => {
    if (!userClan) return;
    setLoading(true);
    try {
      await gameManager.leaveClan(userClan.id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center">
              <Users className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Clan Command</h2>
              <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Sector Hegemony Protocol</div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {userClan ? (
            <div className="space-y-8">
              <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={120} />
                </div>
                
                <div className="relative z-10 flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-4xl font-black tracking-tighter text-white mb-2">{userClan.name.toUpperCase()}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 tracking-widest uppercase">
                        ID: {userClan.id.substring(0, 8)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Active Status: Nominal</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Clan Treasury</div>
                    <div className="flex flex-col gap-1">
                      <div className="text-xl font-black font-mono text-white">{userClan.commonResources} <span className="text-[10px] text-zinc-500">C</span></div>
                      <div className="text-xl font-black font-mono text-fuchsia-400">{userClan.rareResources} <span className="text-[10px] text-zinc-500">A</span></div>
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 grid grid-cols-3 gap-4">
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Personnel</div>
                    <div className="text-2xl font-black font-mono text-white">{userClan.members.length}</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Sector Rank</div>
                    <div className="text-2xl font-black font-mono text-white">#12</div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Combat Power</div>
                    <div className="text-2xl font-black font-mono text-white">8.4K</div>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={handleLeaveClan}
                    disabled={loading}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-mono font-bold tracking-widest py-3 px-6 rounded-xl transition-all flex items-center gap-2 border border-red-500/20 uppercase"
                  >
                    <LogOut size={14} /> Abandon Clan
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-4 mb-6">
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Personnel Manifest</h4>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {userClan.members.map(memberId => (
                    <div key={memberId} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${memberId === userClan.leaderId ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                          {memberId === userClan.leaderId ? <Trophy size={18} /> : <Users size={18} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black tracking-tight text-white">{memberNames[memberId] || (memberId === userData?.uid ? 'YOU' : memberId.toUpperCase())}</span>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">{memberId === userClan.leaderId ? 'Commanding Officer' : 'Fleet Member'}</span>
                        </div>
                      </div>
                      {memberId === userClan.leaderId && (
                        <div className="text-[8px] font-mono bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/20 tracking-widest uppercase font-bold">Leader</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {isCreating ? (
                <div className="bg-white/5 p-8 rounded-2xl border border-white/10 space-y-6">
                  <h3 className="text-2xl font-black tracking-tighter text-white uppercase">Establish New Clan</h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Designation</label>
                    <input 
                      type="text" 
                      value={clanName}
                      onChange={(e) => setClanName(e.target.value)}
                      placeholder="ENTER CLAN NAME..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-6 py-4 text-white font-black tracking-tight focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-700"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleCreateClan}
                      disabled={loading || !clanName.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-black tracking-widest py-4 rounded-xl transition-all uppercase text-xs"
                    >
                      {loading ? 'Processing...' : 'Confirm Establishment'}
                    </button>
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="px-8 bg-white/5 hover:bg-white/10 text-white font-black tracking-widest py-4 rounded-xl transition-all uppercase text-xs"
                    >
                      Abort
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="SEARCH SECTOR CLANS..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 py-4 text-white font-black tracking-tight focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <button 
                      onClick={() => setIsCreating(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-4 rounded-xl flex items-center gap-2 transition-all uppercase text-xs tracking-widest"
                    >
                      <Plus size={18} /> Create
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Available Factions</h4>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {filteredClans.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {filteredClans.map(clan => (
                          <div key={clan.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center hover:border-white/20 transition-all group">
                            <div className="flex flex-col">
                              <h5 className="text-lg font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">{clan.name.toUpperCase()}</h5>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-mono text-zinc-500 uppercase">{clan.members.length} Personnel</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                <span className="text-[10px] font-mono text-zinc-500 uppercase">Est. {new Date(clan.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleJoinClan(clan.id)}
                              disabled={loading}
                              className="bg-white/5 hover:bg-blue-600 text-white font-black text-[10px] tracking-widest py-3 px-6 rounded-xl transition-all flex items-center gap-2 border border-white/10 hover:border-blue-500 uppercase"
                            >
                              <UserPlus size={14} /> Join Faction
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 bg-white/2 rounded-2xl border border-dashed border-white/5">
                        <Users className="mx-auto text-zinc-800 mb-4 opacity-20" size={64} />
                        <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest">No matching factions detected in this sector</p>
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
