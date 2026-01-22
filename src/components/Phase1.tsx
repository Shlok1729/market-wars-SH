import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  TrendingUp, 
  Library, 
  Pizza, 
  Dumbbell, 
  Rocket, 
  Wallet, 
  Activity,
  Award
} from 'lucide-react';

interface Phase1Props {
  team: any;
  setTeam: (team: any) => void;
}

export const Phase1: React.FC<Phase1Props> = ({ team, setTeam }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [news, setNews] = useState<string[]>([]);
  const [holdings, setHoldings] = useState<{ [key: string]: number }>({
    lib: 0, piz: 0, gym: 0, inc: 0
  });
  const [marketVolume, setMarketVolume] = useState<{ [key: string]: number }>({
    lib: 0, piz: 0, gym: 0, inc: 0
  });

  const assets = [
    { id: 'lib', name: 'CAMPUS LIBRARY', desc: 'The Safe Haven / Low Volatility', icon: <Library size={20}/>, color: 'text-blue-400', border: 'border-blue-500/20' },
    { id: 'piz', name: 'LOCAL PIZZA SHOP', desc: 'Steady Performer / Reliable Yield', icon: <Pizza size={20}/>, color: 'text-orange-400', border: 'border-orange-500/20' },
    { id: 'gym', name: 'CAMPUS GYM', desc: 'Growth Asset / High Momentum', icon: <Dumbbell size={20}/>, color: 'text-emerald-400', border: 'border-emerald-500/20' },
    { id: 'inc', name: 'STARTUP INCUBATOR', desc: 'The Volatile Wildcard / High Risk', icon: <Rocket size={20}/>, color: 'text-purple-400', border: 'border-purple-500/20' },
  ];

  // 1. DATA INITIALIZATION
  useEffect(() => {
  // 1. Initial Load Function
  const loadInitialData = async () => {
    // Get My Holdings
    const { data: myTx } = await supabase.from('transactions').select('asset_id, amount').eq('team_id', team.id);
    if (myTx) {
      const h: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
      myTx.forEach(t => h[t.asset_id] += t.amount);
      setHoldings(h);
    }

    // Get Global Volume
    const { data: allTx } = await supabase.from('transactions').select('asset_id, amount');
    if (allTx) {
      const v: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
      allTx.forEach(t => v[t.asset_id] += t.amount);
      setMarketVolume(v);
    }

    // Get News
    const { data: newsItems } = await supabase.from('market_news').select('message').order('created_at', { ascending: false });
    if (newsItems) setNews(newsItems.map(n => n.message));
  };

  loadInitialData();

  // 2. LIVE LISTENERS
  const channel = supabase
    .channel('phase1-updates')
    // Listen for News
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_news' }, (payload) => {
      setNews(prev => [payload.new.message, ...prev]);
    })
    // Listen for ALL transactions (Global Saturation)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
      const { asset_id, amount, team_id } = payload.new;
      
      // Update Global Saturation Bar
      setMarketVolume(prev => ({
        ...prev,
        [asset_id]: (prev[asset_id] || 0) + amount
      }));

      // Update Personal Holdings if the transaction belongs to THIS team
      if (team_id === team.id) {
        setHoldings(prev => ({
          ...prev,
          [asset_id]: (prev[asset_id] || 0) + amount
        }));
      }
    })
    // Listen for Team Balance changes (e.g., if Admin edits balance)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${team.id}` }, (payload) => {
      setTeam(payload.new); 
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [team.id]);

  // 3. INVESTMENT LOGIC
  const handleInvest = async (assetId: string) => {
    const amountStr = prompt(`ENTER AMOUNT TO INVEST IN ${assetId.toUpperCase()} ($1.00 PER SHARE):`);
    if (!amountStr) return;
    const amount = parseInt(amountStr);
    
    if (isNaN(amount) || amount <= 0) return alert("INVALID_AMOUNT");
    if (amount > team.balance) return alert("INSUFFICIENT_CAPITAL");

    setLoading(assetId);

    // Atomic update: Insert transaction + Update team balance
    const { error: txErr } = await supabase.from('transactions').insert([
      { team_id: team.id, asset_id: assetId, amount, price_at_time: 1, type: 'buy_equity' }
    ]);

    if (!txErr) {
      const newBalance = team.balance - amount;
      await supabase.from('teams').update({ balance: newBalance }).eq('id', team.id);
      setTeam({ ...team, balance: newBalance });
    }

    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-4 md:p-8 pb-20">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col items-start justify-between max-w-6xl pb-8 mx-auto mb-10 border-b md:flex-row md:items-center border-zinc-900">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black tracking-tighter text-white">
            <span className="bg-emerald-500 text-black px-2 py-0.5 rounded text-xs font-bold uppercase">Phase_01</span>
            <span className="text-emerald-500 uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{team.team_name}</span>
          </h1>
          <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-[0.4em]">
            Connection: Stable // Scarcity_Simulation_Active // Protocol_V4.2
          </p>
        </div>

        <div className="flex gap-4 mt-6 md:mt-0">
          <div className="px-6 py-4 border rounded-lg bg-zinc-900/30 border-zinc-800 backdrop-blur-md">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Liquid_Capital</p>
            <div className="flex items-center gap-3">
              <Wallet className="text-emerald-500" size={18} />
              <p className="font-mono text-2xl font-bold text-white">${(team.balance || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ASSETS GRID */}
      <div className="grid max-w-6xl grid-cols-1 gap-6 mx-auto md:grid-cols-2">
        {assets.map(asset => (
          <div key={asset.id} className={`relative bg-zinc-950 border ${asset.border} p-6 transition-all hover:bg-zinc-900/20 group`}>
            
            {/* Founder Tag */}
            {team.founder_asset === asset.id && (
              <div className="absolute -top-3 left-6 bg-emerald-500 text-black text-[9px] font-black px-2 py-1 rounded flex items-center gap-1 shadow-lg shadow-emerald-500/20">
                <Award size={10} /> FOUNDER_STAKE (400)
              </div>
            )}

            <div className="flex items-start justify-between mb-6">
              <div className={`p-3 bg-zinc-900 border border-zinc-800 ${asset.color} rounded`}>
                {asset.icon}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase">Personal_Holdings</p>
                <p className={`text-xl font-bold font-mono ${holdings[asset.id] > 0 ? 'text-white' : 'text-zinc-800'}`}>
                  {holdings[asset.id].toLocaleString()} <span className="text-xs opacity-50">QTY</span>
                </p>
              </div>
            </div>

            <h3 className="mb-1 text-lg font-bold tracking-tight text-white">{asset.name}</h3>
            <p className="mb-6 text-xs font-medium text-zinc-500">{asset.desc}</p>

            {/* SATURATION BAR (SCARCITY VISUALIZER) */}
            <div className="mb-8">
               <div className="flex justify-between text-[9px] font-bold uppercase mb-2">
                  <span className="flex items-center gap-1 tracking-widest text-zinc-500">
                    <Activity size={10}/> Market_Saturation
                  </span>
                  <span className="text-zinc-400">{marketVolume[asset.id].toLocaleString()} Shares Circulating</span>
               </div>
               <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${marketVolume[asset.id] > 3000 ? 'bg-rose-500' : 'bg-zinc-600'}`}
                    style={{ width: `${Math.min((marketVolume[asset.id] / 5000) * 100, 100)}%` }}
                  ></div>
               </div>
               <p className="text-[8px] text-zinc-700 mt-2 uppercase tracking-tighter text-right">
                 *Higher saturation reduces final share value
               </p>
            </div>

            <button 
              disabled={loading === asset.id}
              onClick={() => handleInvest(asset.id)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black hover:border-white transition-all active:scale-[0.98]"
            >
              {loading === asset.id ? "EXECUTING_TRADE..." : "Initialize_Purchase @ $1.00"}
            </button>
          </div>
        ))}
      </div>

      {/* NEON TICKER FOOTER */}
      <div className="fixed bottom-0 left-0 z-50 flex items-center w-full h-12 bg-black border-t border-emerald-500/20">
          <div className="flex items-center h-full px-6 text-xs font-black tracking-tighter text-black bg-emerald-500">
            <span className="mr-2 text-lg animate-pulse">●</span> LIVE_RUMORS
          </div>
          <marquee className="flex-1 text-sm font-bold text-emerald-400 tracking-[0.2em] uppercase" scrollamount="7">
            {news.length > 0 ? news.join('      ///      ') : "MARKET_OPEN // WAITING FOR INTEL // DIVERSIFY YOUR PORTFOLIO"}
          </marquee>
          <div className="hidden lg:flex px-6 h-full items-center border-l border-zinc-900 text-[9px] text-zinc-600 font-bold bg-zinc-950">
            SECURE_BOOT_v4 // NO_SHEEP_ZONE
          </div>
      </div>

    </div>
  );
};