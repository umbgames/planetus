import React, { useState, useEffect } from 'react';
import { X, RefreshCw, ArrowRightLeft, Coins, Gem } from 'lucide-react';
import { gameManager, MarketOffer, UserData } from '../services/gameManager';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function SellerInfo({ sellerId, sellerName }: { sellerId: string, sellerName: string }) {
  const [resources, setResources] = useState<{ common: number, rare: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchResources = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', sellerId));
        if (userDoc.exists() && isMounted) {
          const data = userDoc.data() as UserData;
          setResources({ common: data.commonResources, rare: data.rareResources });
        }
      } catch (e) {
        console.error("Failed to fetch seller resources", e);
      }
    };
    fetchResources();
    return () => { isMounted = false; };
  }, [sellerId]);

  return (
    <div className="w-40">
      <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Merchant</div>
      <div className="text-sm font-black text-white truncate uppercase tracking-tighter">{sellerName}</div>
      {resources && (
        <div className="flex gap-3 mt-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-md border border-white/5">
            <Coins size={10} className="text-zinc-500" />
            <span className="text-[10px] font-mono font-bold text-zinc-400">{resources.common}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-fuchsia-500/5 rounded-md border border-fuchsia-500/10">
            <Gem size={10} className="text-fuchsia-500" />
            <span className="text-[10px] font-mono font-bold text-fuchsia-400">{resources.rare}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MarketUIProps {
  onClose: () => void;
  userData: UserData | null;
}

export function MarketUI({ onClose, userData }: MarketUIProps) {
  const [offers, setOffers] = useState<MarketOffer[]>([]);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  
  // Sell form state
  const [sellType, setSellType] = useState<'sell_common' | 'sell_rare'>('sell_common');
  const [amountOffered, setAmountOffered] = useState<number>(10);
  const [amountRequested, setAmountRequested] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to market offers
    const updateOffers = (newOffers: MarketOffer[]) => {
      setOffers(newOffers.filter(o => o.status === 'active' || (o.sellerId === userData?.uid && o.status === 'fulfilled')));
    };
    
    gameManager.onMarketOffersUpdate = updateOffers;
    updateOffers(gameManager.marketOffers);
    
    return () => {
      gameManager.onMarketOffersUpdate = null;
    };
  }, [userData]);

  const handleCreateOffer = async () => {
    try {
      setError(null);
      await gameManager.createMarketOffer(sellType, amountOffered, amountRequested);
      setActiveTab('buy');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleBuy = async (offerId: string) => {
    try {
      setError(null);
      await gameManager.buyMarketOffer(offerId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCancel = async (offerId: string) => {
    try {
      setError(null);
      await gameManager.cancelMarketOffer(offerId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClaim = async (offerId: string) => {
    try {
      setError(null);
      await gameManager.claimMarketOffer(offerId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-center justify-center">
              <ArrowRightLeft className="text-cyan-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">Galactic Exchange</h2>
              <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">Interstellar Trade Protocol</div>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tabs & Resources */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/10">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('buy')}
              className={`text-[10px] font-mono font-bold tracking-widest uppercase transition-all pb-2 border-b-2 ${activeTab === 'buy' ? 'text-cyan-400 border-cyan-400' : 'text-zinc-500 border-transparent hover:text-white'}`}
            >
              Market Listings
            </button>
            <button 
              onClick={() => setActiveTab('sell')}
              className={`text-[10px] font-mono font-bold tracking-widest uppercase transition-all pb-2 border-b-2 ${activeTab === 'sell' ? 'text-cyan-400 border-cyan-400' : 'text-zinc-500 border-transparent hover:text-white'}`}
            >
              Create Offer
            </button>
          </div>
          
          {userData && (
            <div className="flex gap-6">
              <div className="text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <div className="text-sm font-black font-mono text-white">{userData.commonResources} <span className="text-[10px] text-zinc-500">C</span></div>
                  <div className="text-sm font-black font-mono text-fuchsia-400">{userData.rareResources} <span className="text-[10px] text-zinc-500">A</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-mono uppercase tracking-widest">
              Error: {error}
            </div>
          )}

          {activeTab === 'buy' && (
            <div className="space-y-4">
              {offers.length === 0 ? (
                <div className="text-center py-20 bg-white/2 rounded-2xl border border-dashed border-white/5">
                  <ArrowRightLeft size={64} className="mx-auto mb-4 opacity-10 text-zinc-500" />
                  <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest">No active trade signals detected</p>
                </div>
              ) : (
                offers.map(offer => {
                  const isMine = offer.sellerId === userData?.uid;
                  const isFulfilled = offer.status === 'fulfilled';
                  
                  return (
                    <div key={offer.id} className={`p-6 rounded-2xl border transition-all flex items-center justify-between ${isMine ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                      <div className="flex items-center gap-8">
                        <SellerInfo sellerId={offer.sellerId} sellerName={offer.sellerName} />
                        
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                            <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Offer</div>
                            <div className="flex items-center gap-2 font-mono text-lg font-black">
                              {offer.offerType === 'sell_common' ? <Coins size={16} className="text-zinc-400"/> : <Gem size={16} className="text-fuchsia-400"/>}
                              <span className={offer.offerType === 'sell_common' ? 'text-white' : 'text-fuchsia-400'}>{offer.amountOffered}</span>
                            </div>
                          </div>
                          
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                            <ArrowRightLeft size={16} className="text-zinc-600" />
                          </div>
                          
                          <div className="flex flex-col items-start">
                            <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Request</div>
                            <div className="flex items-center gap-2 font-mono text-lg font-black">
                              {offer.offerType === 'sell_common' ? <Gem size={16} className="text-fuchsia-400"/> : <Coins size={16} className="text-zinc-400"/>}
                              <span className={offer.offerType === 'sell_common' ? 'text-fuchsia-400' : 'text-white'}>{offer.amountRequested}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        {isMine ? (
                          isFulfilled ? (
                            <button 
                              onClick={() => handleClaim(offer.id)}
                              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase border border-emerald-500/50"
                            >
                              Claim Assets
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleCancel(offer.id)}
                              className="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-[10px] font-black tracking-widest rounded-xl transition-all uppercase"
                            >
                              Abort
                            </button>
                          )
                        ) : (
                          <button 
                            onClick={() => handleBuy(offer.id)}
                            disabled={!userData || isFulfilled}
                            className="px-10 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-zinc-600 text-white text-[10px] font-black tracking-widest rounded-xl transition-all uppercase border border-blue-500/50"
                          >
                            {isFulfilled ? 'Fulfilled' : 'Authorize Trade'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'sell' && (
            <div className="max-w-md mx-auto py-4">
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Asset Selection</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSellType('sell_common')}
                      className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${sellType === 'sell_common' ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10'}`}
                    >
                      <Coins size={32} className={sellType === 'sell_common' ? 'text-white' : ''} />
                      <span className="text-[10px] font-black tracking-widest uppercase">Standard Credits</span>
                    </button>
                    <button
                      onClick={() => setSellType('sell_rare')}
                      className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${sellType === 'sell_rare' ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10'}`}
                    >
                      <Gem size={32} className={sellType === 'sell_rare' ? 'text-fuchsia-400' : ''} />
                      <span className="text-[10px] font-black tracking-widest uppercase">Anomalous Matter</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 items-end">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Offer Quantity</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        {sellType === 'sell_common' ? <Coins size={16} className="text-zinc-500"/> : <Gem size={16} className="text-fuchsia-400"/>}
                      </div>
                      <input 
                        type="number" 
                        min="1"
                        value={amountOffered}
                        onChange={(e) => setAmountOffered(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-6 text-white font-black font-mono focus:outline-none focus:border-cyan-500 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Request Quantity</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        {sellType === 'sell_common' ? <Gem size={16} className="text-fuchsia-400"/> : <Coins size={16} className="text-zinc-500"/>}
                      </div>
                      <input 
                        type="number" 
                        min="1"
                        value={amountRequested}
                        onChange={(e) => setAmountRequested(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-6 text-white font-black font-mono focus:outline-none focus:border-cyan-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateOffer}
                  disabled={!userData || amountOffered <= 0 || amountRequested <= 0}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black tracking-widest rounded-2xl transition-all disabled:bg-white/5 disabled:text-zinc-700 border border-blue-500/50 shadow-xl shadow-blue-500/20 uppercase text-xs mt-4"
                >
                  Broadcast Trade Offer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
