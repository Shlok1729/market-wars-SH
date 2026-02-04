import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { TrendingUp, TrendingDown, Wallet, Activity, Plus, Minus, Zap } from 'lucide-react';

export const Phase3Dynamic = ({ team, setTeam }: { team: any, setTeam: any }) => {
  const [prices, setPrices] = useState<any>({});
  const [holdings, setHoldings] = useState<any>({ lib: 0, piz: 0, gym: 0, inc: 0, qnt: 0, slr: 0 });
  const [tradeQtys, setTradeQtys] = useState<any>({ lib: 10, piz: 10, gym: 10, inc: 10, qnt: 10, slr: 10 });
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const loadMarket = async () => {
      // 1. Fetch Prices
      const { data: pData } = await supabase.from('stock_prices').select('*');
      const pMap: any = {};
      pData?.forEach(p => pMap[p.symbol] = Number(p.current_price));
      setPrices(pMap);

      // 2. Fetch Personal Holdings
      const { data: txs } = await supabase.from('transactions').select('asset_id, amount').eq('team_id', team.id);
      const h: any = { lib: 0, piz: 0, gym: 0, inc: 0 , qnt: 0, slr: 0 };
      txs?.forEach(t => { if(h[t.asset_id] !== undefined) h[t.asset_id] += t.amount; });
      setHoldings(h);
    };
    loadMarket();

    // REAL-TIME SYNC
    const channel = supabase.channel('market-war')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_prices' }, (p) => {
        setPrices((prev: any) => ({ ...prev, [p.new.symbol]: Number(p.new.current_price) }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (p) => {
        if (p.new.team_id === team.id) {
            setHoldings((prev: any) => ({ ...prev, [p.new.asset_id]: (prev[p.new.asset_id] || 0) + p.new.amount }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [team.id]);

  const handleTrade = async (assetId: string, side: 'buy' | 'sell') => {
    const qty = tradeQtys[assetId];
    const price = prices[assetId];
    const cost = qty * price;

    if (side === 'buy' && team.balance < cost) return toast.error("INS_FUNDS");
    if (side === 'sell' && holdings[assetId] < qty) return toast.error("INS_SHARES");

    setLoading(assetId);
    const change = side === 'buy' ? qty : -qty;

    try {
      // 1. Shift Price globally
      await supabase.rpc('execute_dynamic_trade', { p_asset_id: assetId, p_qty: change });
      
      // 2. Log Trade
      await supabase.from('transactions').insert([{
        team_id: team.id, asset_id: assetId, amount: change, price_at_time: price, type: `dynamic_${side}`
      }]);

      // 3. Update Balance
      const newBal = side === 'buy' ? Number(team.balance) - cost : Number(team.balance) + cost;
      await supabase.from('teams').update({ balance: newBal }).eq('id', team.id);
      setTeam({ ...team, balance: newBal });

      toast.success(`${side.toUpperCase()} SUCCESSFUL`);
    } catch (e) { toast.error("TRADE_FAILED"); }
    setLoading(null);
  };

  return (
    <div className="min-h-screen p-4 pb-20 font-mono text-white bg-black md:p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between max-w-6xl pb-6 mx-auto mb-10 border-b border-zinc-800">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <span className="bg-red-600 px-2 py-0.5 text-xs animate-pulse">WAR_ZONE</span>
            OPEN_MARKET_TRADING
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Real-time Supply/Demand Pricing Enabled</p>
        </div>
        <div className="p-4 border bg-zinc-900 border-zinc-800 rounded-xl">
           <p className="text-[9px] text-zinc-500 uppercase">Available_Purse</p>
           <p className="text-xl font-bold text-emerald-400">₹{Number(team.balance).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid max-w-6xl grid-cols-1 gap-6 mx-auto md:grid-cols-2">
        {['lib', 'piz', 'gym', 'inc', 'qnt', 'slr'].map(id => (
          <div key={id} className="p-6 transition-all border bg-zinc-950 border-zinc-900 rounded-2xl hover:border-zinc-700">
            <div className="flex items-start justify-between mb-6">
               <span className="text-xs font-bold tracking-tighter uppercase text-zinc-400">{id === 'lib' ? 'Library' : id === 'piz' ? 'Pizza' : id === 'gym' ? 'Gym' : id === 'slr' ? 'Solar' : id === 'qnt' ? 'Quantum' : 'Incubator'}</span>
               <div className="text-right">
                  <p className="text-[9px] text-zinc-600 uppercase">Current_Rate</p>
                  <p className="text-3xl font-black text-white">₹{prices[id]?.toFixed(2)}</p>
               </div>
            </div>

            <div className="flex items-center justify-between p-4 mb-8 border bg-zinc-900/50 rounded-xl border-zinc-800">
               <div>
                  <p className="text-[9px] text-zinc-500 uppercase">Your_Holdings</p>
                  <p className="text-lg font-bold">{holdings[id]} <span className="text-xs opacity-30">QTY</span></p>
               </div>
               <div className="flex items-center gap-2">
                  <button onClick={() => setTradeQtys((p:any)=>({...p, [id]: Math.max(0, p[id]-10)}))} className="flex items-center justify-center w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700"><Minus size={14}/></button>
                  <span className="w-12 font-bold text-center">{tradeQtys[id]}</span>
                  <button onClick={() => setTradeQtys((p:any)=>({...p, [id]: p[id]+10}))} className="flex items-center justify-center w-8 h-8 rounded bg-zinc-800 hover:bg-zinc-700"><Plus size={14}/></button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button disabled={!!loading} onClick={() => handleTrade(id, 'buy')} className="flex items-center justify-center gap-2 py-4 text-xs font-black uppercase transition-all bg-emerald-600 hover:bg-emerald-500 rounded-xl active:scale-95">
                 <TrendingUp size={16}/> Market_Buy
              </button>
              <button disabled={!!loading} onClick={() => handleTrade(id, 'sell')} className="flex items-center justify-center gap-2 py-4 text-xs font-black uppercase transition-all border border-rose-600/30 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl active:scale-95">
                 <TrendingDown size={16}/> Market_Sell
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};