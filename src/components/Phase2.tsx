import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Wallet, TrendingUp, Info, Plus, Minus, X, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export const Phase2 = ({ team, setTeam }: { team: any, setTeam: any }) => {
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tradeSide, setTradeSide] = useState<'yes' | 'no' | null>(null);
  const [qty, setQty] = useState(1);
  const [holdings, setHoldings] = useState<any[]>([]);

  // 1. Fetch Market & Holdings
  const fetchData = async () => {
    const { data: mData } = await supabase.from('live_market').select('*').eq('is_active', true).maybeSingle();
    setMarket(mData);

    const { data: hData } = await supabase.from('transactions')
      .select('*')
      .eq('team_id', team.id)
      .eq('asset_id', mData?.id)
      .filter('type', 'ilike', 'buy_%');
    if (hData) setHoldings(hData);
  };

  useEffect(() => {
    fetchData();

    const sub = supabase.channel('p2-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_market' }, (p) => {
        setMarket(p.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_news' }, (payload) => {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-zinc-900 border-l-4 border-emerald-500 shadow-2xl p-4 flex items-start gap-3 pointer-events-auto ring-1 ring-black ring-opacity-5`}>
            <div className="p-2 rounded bg-emerald-500/10">
              <Zap size={20} className="text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">
                Incoming_Market_Flash
              </p>
              <p className="text-sm font-bold tracking-tight text-white uppercase">
                {payload.new.message}
              </p>
            </div>
          </div>
        ), { duration: 6000 }); // Stays for 6 seconds
      }
    )
    .subscribe();
      

    return () => { supabase.removeChannel(sub); };
  }, []);

  if (!market) return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans bg-white">
      <div className="w-12 h-12 mb-4 border-4 rounded-full border-zinc-100 border-t-emerald-500 animate-spin"></div>
      <p className="text-xs font-bold tracking-widest uppercase text-zinc-400">Waiting for Market to Open...</p>
    </div>
  );

  // --- MATH ENGINE (Base 1000) ---
  const totalPool = market.yes_pool + market.no_pool;
  const yesPrice = (market.yes_pool / totalPool) * 1000;
  const noPrice = 1000 - yesPrice;
  const currentPrice = tradeSide === 'yes' ? yesPrice : noPrice;
  const totalCost = currentPrice * qty;

  const handleExecuteTrade = async () => {
    if (!tradeSide) return;
    if (team.balance < totalCost) return alert("Insufficient Funds");

    setLoading(true);

    
    
    // 1. Update Global Pools
    const { error: rpcError } = await supabase.rpc('trade_yes_no', { 
        q_id: market.id, 
        side: tradeSide, 
        qty 
    });

    if (!rpcError) {
      // 2. Log Transaction
      await supabase.from('transactions').insert([{
        team_id: team.id,
        asset_id: market.id,
        amount: qty,
        price_at_time: currentPrice,
        type: `buy_${tradeSide}`
      }]);

      // 3. Update Balance
      const newBal = team.balance - totalCost;
      await supabase.from('teams').update({ balance: newBal }).eq('id', team.id);
      
      setTeam({ ...team, balance: newBal });
      setTradeSide(null);
      setQty(1);
      fetchData();
      alert(`TRADE SUCCESSFUL: BOUGHT ${qty} @ $${currentPrice.toFixed(0)}`);
    }
    setLoading(false);
  };

return (
    <div className="min-h-screen bg-[#F9FAFC] font-sans antialiased pb-20">
      
      {/* HEADER - Updated with Dynamic Status */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between max-w-md p-4 mx-auto">
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 shadow-lg bg-emerald-500 rounded-xl shadow-emerald-500/20">
                    <Wallet className="text-white" size={20} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">Liquid Purse</p>
                    <p className="text-lg font-black text-zinc-800">${team.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${market.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                   <div className={`w-1.5 h-1.5 rounded-full ${market.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div> 
                   {market.is_active ? 'Live Market' : 'Market Closed'}
                </span>
                <p className="text-[9px] text-zinc-400 uppercase font-bold mt-1">
                    {market.is_active ? 'Status: Open' : 'Status: Resolved'}
                </p>
            </div>
        </div>
      </div>

      <div className="max-w-md p-4 mx-auto space-y-4">
        
        {/* EVENT CARD - Updated with Conditional Trading */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-zinc-100">
            <div className="flex items-center justify-between mb-6">
                <span className="bg-zinc-100 text-zinc-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">Opinion Market</span>
                <Info size={16} className="text-zinc-300" />
            </div>

            <h2 className="mb-8 text-2xl font-extrabold leading-tight tracking-tight uppercase text-zinc-900">
                {market.question}
            </h2>

            {/* If Market is Active: Show Selection Boxes. If Settled: Show Winner */}
            {market.is_active ? (
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setTradeSide('yes')}
                        className={`flex flex-col items-center justify-center py-6 rounded-3xl transition-all border-2 ${tradeSide === 'yes' ? 'bg-emerald-500 border-emerald-600 shadow-xl shadow-emerald-500/30' : 'bg-emerald-50 border-emerald-100'}`}
                    >
                        <span className={`text-[10px] font-black uppercase mb-1 ${tradeSide === 'yes' ? 'text-white' : 'text-emerald-700'}`}>Yes Index</span>
                        <span className={`text-2xl font-black ${tradeSide === 'yes' ? 'text-white' : 'text-emerald-900'}`}>${yesPrice.toFixed(0)}</span>
                    </button>
                    <button 
                        onClick={() => setTradeSide('no')}
                        className={`flex flex-col items-center justify-center py-6 rounded-3xl transition-all border-2 ${tradeSide === 'no' ? 'bg-rose-500 border-rose-600 shadow-xl shadow-rose-500/30' : 'bg-rose-50 border-rose-100'}`}
                    >
                        <span className={`text-[10px] font-black uppercase mb-1 ${tradeSide === 'no' ? 'text-white' : 'text-rose-700'}`}>No Index</span>
                        <span className={`text-2xl font-black ${tradeSide === 'no' ? 'text-white' : 'text-rose-900'}`}>${noPrice.toFixed(0)}</span>
                    </button>
                </div>
            ) : (
                <div className="py-8 text-center border-4 border-dashed bg-zinc-50 rounded-3xl border-zinc-100">
                    <p className="mb-2 text-xs font-black tracking-widest uppercase text-zinc-400">Winning Side Resolved</p>
                    <p className={`text-5xl font-black uppercase tracking-tighter ${market.resolved_winner === 'yes' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {market.resolved_winner || 'Calculating...'}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400">
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-bold uppercase">Payouts Processed to Purse</span>
                    </div>
                </div>
            )}
        </div>

        {/* SENTIMENT METER */}
        <div className="bg-white p-5 rounded-[24px] border border-zinc-100">
            <div className="flex justify-between text-[11px] font-black mb-3 uppercase">
                <span className="tracking-tighter text-emerald-500">Yes Sentiment {((yesPrice/1000)*100).toFixed(0)}%</span>
                <span className="tracking-tighter text-rose-500">No Sentiment {((noPrice/1000)*100).toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full bg-zinc-100 rounded-full flex overflow-hidden p-0.5">
                <div className="h-full transition-all duration-700 rounded-full bg-emerald-500" style={{ width: `${(yesPrice/1000)*100}%` }}></div>
                <div className="h-full transition-all duration-700 rounded-full bg-rose-500" style={{ width: `${(noPrice/1000)*100}%` }}></div>
            </div>
        </div>

        {/* YOUR HOLDINGS */}
        <div className="space-y-2">
            <p className="px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Your Open Positions</p>
            {holdings.length > 0 ? holdings.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white border shadow-sm rounded-2xl border-zinc-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${h.type.includes('yes') ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {h.type.includes('yes') ? 'Y' : 'N'}
                        </div>
                        <div>
                            <p className="text-sm font-black text-zinc-800">{h.amount} Unit{h.amount > 1 ? 's' : ''}</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Avg Entry: ${Number(h.price_at_time).toFixed(0)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-300 uppercase">Settlement</p>
                        <p className="text-xs font-black text-zinc-800">$1,000/Unit</p>
                    </div>
                </div>
            )) : (
                <div className="p-10 text-center bg-white border border-dashed rounded-2xl border-zinc-200">
                    <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">No Active Positions Yet</p>
                </div>
            )}
        </div>
      </div>

      {/* TRADE CONFIRMATION MODAL - Added Market Check */}
      {(tradeSide && market.is_active) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-[40px] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black tracking-tighter uppercase text-zinc-900">Confirm Order</h3>
                    <button onClick={() => setTradeSide(null)} className="p-2 rounded-full bg-zinc-100"><X size={20}/></button>
                </div>

                <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-3xl">
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Market Rate</p>
                        <p className={`text-3xl font-black ${tradeSide === 'yes' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            ${currentPrice.toFixed(0)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Total Cost</p>
                        <p className="text-2xl font-black text-zinc-900">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-zinc-800">Contract Quantity</span>
                    <div className="flex items-center gap-6 p-2 bg-zinc-100 rounded-2xl">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="flex items-center justify-center w-10 h-10 text-lg font-bold bg-white shadow-sm rounded-xl active:scale-90"><Minus size={18}/></button>
                        <span className="text-2xl font-black text-zinc-800">{qty}</span>
                        <button onClick={() => setQty(qty + 1)} className="flex items-center justify-center w-10 h-10 text-lg font-bold bg-white shadow-sm rounded-xl active:scale-90"><Plus size={18}/></button>
                    </div>
                </div>

                <button 
                    disabled={loading}
                    onClick={handleExecuteTrade}
                    className={`w-full py-5 rounded-3xl font-black text-white text-lg shadow-2xl transition-all active:scale-95 ${tradeSide === 'yes' ? 'bg-emerald-600 shadow-emerald-500/40' : 'bg-rose-600 shadow-rose-500/40'}`}
                >
                    {loading ? "PROCESSING..." : `CONFIRM ${tradeSide.toUpperCase()} POSITION`}
                </button>
                
                <p className="text-[9px] text-center text-zinc-400 uppercase font-bold">
                    By confirming, you agree to lock ${totalCost.toFixed(0)} from your purse.
                </p>
            </div>
        </div>
      )}
    </div>
  );
};