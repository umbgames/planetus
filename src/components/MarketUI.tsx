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
    <div className="w-32">
      <div className="text-xs text-zinc-500 mb-1">Seller</div>
      <div className="text-sm font-medium text-white truncate">{sellerName}</div>
      {resources && (
        <div className="flex gap-2 mt-1 text-[10px]">
          <div className="flex items-center gap-1 text-zinc-400">
            <Coins size={10} />
            <span>{resources.common}</span>
          </div>
          <div className="flex items-center gap-1 text-cyan-400">
            <Gem size={10} />
            <span>{resources.rare}</span>
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
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="text-cyan-400" size={24} />
            <h2 className="text-2xl font-bold text-white tracking-tight">Galactic Market</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs & Resources */}
        <div className="flex justify-between items-center p-4 border-b border-white/5 bg-zinc-900/50">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('buy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'buy' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              Market Listings
            </button>
            <button 
              onClick={() => setActiveTab('sell')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'sell' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              Create Offer
            </button>
          </div>
          
          {userData && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1 text-zinc-300">
                <Coins size={14} className="text-zinc-400" />
                <span>{userData.commonResources}</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-300">
                <Gem size={14} className="text-fuchsia-400" />
                <span>{userData.rareResources}</span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {activeTab === 'buy' && (
            <div className="space-y-3">
              {offers.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No active offers on the market.</p>
                </div>
              ) : (
                offers.map(offer => {
                  const isMine = offer.sellerId === userData?.uid;
                  const isFulfilled = offer.status === 'fulfilled';
                  
                  return (
                    <div key={offer.id} className={`p-4 rounded-xl border flex items-center justify-between ${isMine ? 'bg-cyan-950/20 border-cyan-900/50' : 'bg-black/40 border-white/5'}`}>
                      <div className="flex items-center gap-6">
                        <SellerInfo sellerId={offer.sellerId} sellerName={offer.sellerName} />
                        
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <div className="text-xs text-zinc-500 mb-1">Offering</div>
                            <div className="flex items-center gap-1 font-mono text-sm">
                              {offer.offerType === 'sell_common' ? <Coins size={14} className="text-zinc-400"/> : <Gem size={14} className="text-fuchsia-400"/>}
                              <span className={offer.offerType === 'sell_common' ? 'text-zinc-300' : 'text-fuchsia-400'}>{offer.amountOffered}</span>
                            </div>
                          </div>
                          
                          <ArrowRightLeft size={16} className="text-zinc-600" />
                          
                          <div className="flex flex-col items-start">
                            <div className="text-xs text-zinc-500 mb-1">Requesting</div>
                            <div className="flex items-center gap-1 font-mono text-sm">
                              {offer.offerType === 'sell_common' ? <Gem size={14} className="text-fuchsia-400"/> : <Coins size={14} className="text-zinc-400"/>}
                              <span className={offer.offerType === 'sell_common' ? 'text-fuchsia-400' : 'text-zinc-300'}>{offer.amountRequested}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        {isMine ? (
                          isFulfilled ? (
                            <button 
                              onClick={() => handleClaim(offer.id)}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                            >
                              Claim Resources
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleCancel(offer.id)}
                              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          )
                        ) : (
                          <button 
                            onClick={() => handleBuy(offer.id)}
                            disabled={!userData || isFulfilled}
                            className="px-6 py-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
                          >
                            {isFulfilled ? 'Sold' : 'Buy'}
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
            <div className="max-w-md mx-auto py-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">I want to sell</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSellType('sell_common')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${sellType === 'sell_common' ? 'bg-zinc-800 border-zinc-500 text-white' : 'bg-black/40 border-white/5 text-zinc-400 hover:bg-white/5'}`}
                    >
                      <Coins size={24} className={sellType === 'sell_common' ? 'text-zinc-300' : ''} />
                      <span className="text-sm font-medium">Common</span>
                    </button>
                    <button
                      onClick={() => setSellType('sell_rare')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${sellType === 'sell_rare' ? 'bg-fuchsia-950/40 border-fuchsia-500/50 text-white' : 'bg-black/40 border-white/5 text-zinc-400 hover:bg-white/5'}`}
                    >
                      <Gem size={24} className={sellType === 'sell_rare' ? 'text-fuchsia-400' : ''} />
                      <span className="text-sm font-medium">Aetherium</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 items-end">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Amount to offer</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {sellType === 'sell_common' ? <Coins size={16} className="text-zinc-500"/> : <Gem size={16} className="text-cyan-500"/>}
                      </div>
                      <input 
                        type="number" 
                        min="1"
                        value={amountOffered}
                        onChange={(e) => setAmountOffered(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Amount to request</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {sellType === 'sell_common' ? <Gem size={16} className="text-cyan-500"/> : <Coins size={16} className="text-zinc-500"/>}
                      </div>
                      <input 
                        type="number" 
                        min="1"
                        value={amountRequested}
                        onChange={(e) => setAmountRequested(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateOffer}
                  disabled={!userData || amountOffered <= 0 || amountRequested <= 0}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  Post Offer to Market
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
