import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Wallet, TrendingUp, Info } from 'lucide-react';

export const Phase2 = ({ team, setTeam }: { team: any, setTeam: any }) => {
  const [market, setMarket] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMarket = async () => {
      const { data } = await supabase.from('live_market').select('*').eq('is_active', true).maybeSingle();
      setMarket(data);
    };
    fetchMarket();

    // REAL-TIME PRICE UPDATES
    const sub = supabase.channel('market-prices').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_market' }, (p) => {
      setMarket(p.new);
    }).subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  if (!market) return <div className="flex items-center justify-center min-h-screen font-sans tracking-widest uppercase bg-white text-zinc-400">Waiting for Market...</div>;

  // PRICE CALCULATION LOGIC (Probo Style)
  const totalPool = market.yes_pool + market.no_pool;
  const yesPrice = (market.yes_pool / totalPool) * 10;
  const noPrice = 10 - yesPrice;

  const handleTrade = async (side: 'yes' | 'no') => {
    const price = side === 'yes' ? yesPrice : noPrice;
    const totalCost = price * qty;

    if (team.balance < totalCost) return alert("Insufficient Balance");

    setLoading(true);
    // 1. Log Transaction
    await supabase.from('transactions').insert([{
      team_id: team.id,
      asset_id: market.id,
      amount: qty,
      price_at_time: price,
      type: `buy_${side}`
    }]);

    // 2. Update Global Price (Pools)
    await supabase.rpc('trade_yes_no', { q_id: market.id, side, qty });

    // 3. Update Team Balance
    const newBal = team.balance - totalCost;
    await supabase.from('teams').update({ balance: newBal }).eq('id', team.id);
    
    setTeam({ ...team, balance: newBal });
    setLoading(false);
    alert(`Bought ${qty} qty of ${side.toUpperCase()} at ₹${price.toFixed(1)}`);
  };

  return (
    <div className="min-h-screen p-4 font-sans bg-zinc-50">
      {/* Wallet Header */}
      <div className="flex items-center justify-between max-w-md p-4 mx-auto mb-6 bg-white border shadow-sm rounded-xl border-zinc-100">
        <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100">
                <Wallet size={16} className="text-emerald-600" />
            </div>
            <span className="font-bold text-zinc-800">₹{team.balance.toFixed(2)}</span>
        </div>
        <div className="text-[10px] bg-zinc-100 px-2 py-1 rounded font-bold text-zinc-500 uppercase">Phase 2: Live</div>
      </div>

      {/* Prediction Card (Probo Style) */}
      <div className="max-w-md mx-auto overflow-hidden bg-white border shadow-xl rounded-2xl border-zinc-100">
        <div className="p-5">
            <div className="flex items-start justify-between mb-4">
                <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">New</span>
                <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold">
                    <TrendingUp size={12} /> DYNAMIC MATCHING
                </div>
            </div>

            <h2 className="mb-6 text-lg font-bold leading-tight text-zinc-800">
                {market.question}
            </h2>

            {/* Price Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                    disabled={loading}
                    onClick={() => handleTrade('yes')}
                    className="flex flex-col items-center justify-center p-4 transition-all border rounded-xl bg-emerald-50 border-emerald-100 hover:bg-emerald-100 group"
                >
                    <span className="mb-1 text-sm font-black uppercase text-emerald-600">Yes | ₹{yesPrice.toFixed(1)}</span>
                </button>
                <button 
                    disabled={loading}
                    onClick={() => handleTrade('no')}
                    className="flex flex-col items-center justify-center p-4 transition-all border rounded-xl bg-rose-50 border-rose-100 hover:bg-rose-100 group"
                >
                    <span className="mb-1 text-sm font-black uppercase text-rose-600">No | ₹{noPrice.toFixed(1)}</span>
                </button>
            </div>

            {/* Opinion Meter */}
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                    <span>YES {((yesPrice/10)*100).toFixed(0)}%</span>
                    <span>NO {((noPrice/10)*100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full flex overflow-hidden">
                    <div className="h-full transition-all duration-500 bg-emerald-400" style={{ width: `${(yesPrice/10)*100}%` }}></div>
                    <div className="h-full transition-all duration-500 bg-rose-400" style={{ width: `${(noPrice/10)*100}%` }}></div>
                </div>
            </div>
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center justify-between p-4 border-t bg-zinc-50 border-zinc-100">
            <span className="text-xs font-bold text-zinc-500">Order Quantity</span>
            <div className="flex items-center gap-4 px-3 py-1 bg-white border rounded-lg border-zinc-200">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="font-bold text-zinc-400">-</button>
                <span className="font-bold text-zinc-800">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="font-bold text-zinc-400">+</button>
            </div>
        </div>
      </div>

      <div className="flex items-start max-w-md gap-2 p-2 mx-auto mt-6 text-zinc-400">
          <Info size={14} />
          <p className="text-[10px] leading-tight">Prices change based on market demand. Buying YES increases its price for the next person.</p>
      </div>
    </div>
  );
};