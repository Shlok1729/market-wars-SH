import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { 
  TrendingUp, TrendingDown, Library, Pizza, Dumbbell, 
  Rocket, Wallet, Award, Plus, Minus, Zap 
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
  
  // Track inputs for each card separately
  const [tradeQtys, setTradeQtys] = useState<{ [key: string]: number }>({
    lib: 10, piz: 10, gym: 10, inc: 10
  });

  const assets = [
    { id: 'lib', name: 'CAMPUS LIBRARY', desc: 'The Safe Haven', icon: <Library size={20}/>, color: 'text-blue-400', border: 'border-blue-500/20' },
    { id: 'piz', name: 'LOCAL PIZZA SHOP', desc: 'Steady Performer', icon: <Pizza size={20}/>, color: 'text-orange-400', border: 'border-orange-500/20' },
    { id: 'gym', name: 'CAMPUS GYM', desc: 'Growth Asset', icon: <Dumbbell size={20}/>, color: 'text-emerald-400', border: 'border-emerald-500/20' },
    { id: 'inc', name: 'STARTUP INCUBATOR', desc: 'Volatile Wildcard', icon: <Rocket size={20}/>, color: 'text-purple-400', border: 'border-purple-500/20' },
  ];

  useEffect(() => {
    const loadMarketData = async () => {
      const { data: myTx } = await supabase.from('transactions').select('asset_id, amount').eq('team_id', team.id);
      if (myTx) {
        const h: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
        myTx.forEach(t => h[t.asset_id] += t.amount);
        setHoldings(h);
      }
      const { data: allTx } = await supabase.from('transactions').select('asset_id, amount');
      if (allTx) {
        const v: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
        allTx.forEach(t => v[t.asset_id] += t.amount);
        setMarketVolume(v);
      }
      const { data: newsItems } = await supabase.from('market_news').select('message').order('created_at', { ascending: false });
      if (newsItems) setNews(newsItems.map(n => n.message));
    };
    loadMarketData();

    const channel = supabase.channel('p1-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (p) => {
        setMarketVolume(prev => ({ ...prev, [p.new.asset_id]: (prev[p.new.asset_id] || 0) + p.new.amount }));
        if (p.new.team_id === team.id) {
          setHoldings(prev => ({ ...prev, [p.new.asset_id]: (prev[p.new.asset_id] || 0) + p.new.amount }));
        }
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

    return () => { supabase.removeChannel(channel); };
  }, [team.id]);

   const handleTrade = async (assetId: string, side: 'buy' | 'sell') => {
    const qty = tradeQtys[assetId];
    
    // 1. Validation
    if (!qty || qty <= 0) return alert("ENTER A VALID QUANTITY");
    
    const price = 10; 
    const totalCost = qty * price;

    if (side === 'buy' && team.balance < totalCost) {
      return alert("INSUFFICIENT FUNDS");
    }
    if (side === 'sell' && (holdings[assetId] || 0) < qty) {
      return alert("NOT ENOUGH SHARES TO SELL");
    }

    setLoading(assetId);
    console.log(`Attempting ${side} for ${assetId}: ${qty} shares`);

    try {
      // 2. Insert Transaction
      // Note: We use negative amount for sells
      const transactionAmount = side === 'buy' ? qty : -qty;
      
      const { error: txErr } = await supabase.from('transactions').insert([{
        team_id: team.id,
        asset_id: assetId,
        amount: transactionAmount,
        price_at_time: price,
        type: side === 'buy' ? 'buy_equity' : 'sell_equity'
      }]);

      if (txErr) throw txErr;

      // 3. Update Team Balance in Database
      const newBalance = side === 'buy' ? team.balance - totalCost : team.balance + totalCost;
      
      const { error: balErr } = await supabase
        .from('teams')
        .update({ balance: newBalance })
        .eq('id', team.id);

      if (balErr) throw balErr;

      // 4. Update Local State
      setTeam({ ...team, balance: newBalance });
      // We don't need to manually update holdings because the Realtime listener 
      // in useEffect will catch the transaction and update it automatically!
      
      console.log("Trade successful!");
    } catch (err: any) {
      console.error("TRADE ERROR:", err.message);
      alert("Trade Failed: " + err.message);
    } finally {
      setLoading(null);
    }
  };
const updateInput = (assetId: string, val: any) => {
    // Ensure we are working with a valid number
    const numericVal = parseInt(val);
    setTradeQtys(prev => ({ 
      ...prev, 
      [assetId]: isNaN(numericVal) ? 0 : Math.max(0, numericVal) 
    }));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-4 md:p-8 pb-24">
      
      {/* HEADER */}
      <div className="flex flex-col items-start justify-between max-w-6xl pb-8 mx-auto mb-10 border-b md:flex-row md:items-center border-zinc-900">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black tracking-tighter text-white">
            <span className="bg-emerald-500 text-black px-2 py-0.5 rounded text-xs font-bold uppercase">P1</span>
            <span className="text-emerald-500 uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{team.team_name}</span>
          </h1>
          <p className="text-[12px] text-zinc-200 mt-2 uppercase tracking-[0.4em]">Equity_Market_Protocol // Terminal_{team.id.substring(0,4)}</p>
        </div>

        <div className="flex items-center gap-4 px-6 py-4 mt-6 border md:mt-0 bg-zinc-900/20 border-zinc-800 rounded-xl backdrop-blur-md">
            <Wallet className="text-emerald-500" size={24} />
            <div>
              <p className="text-[12px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Available_Capital</p>
              <p className="text-2xl font-bold text-white">₹{team.balance.toLocaleString()}</p>
            </div>
        </div>
      </div>

      {/* ASSET GRID */}
      <div className="grid max-w-6xl grid-cols-1 gap-6 mx-auto md:grid-cols-2">
        {assets.map(asset => (
          <div key={asset.id} className={`relative bg-zinc-950 border ${asset.border} p-6 rounded-lg transition-all hover:bg-zinc-900/10 group`}>
            
            {team.founder_asset === asset.id && (
              <div className="absolute -top-3 left-6 bg-emerald-500 text-black text-[9px] font-black px-2 py-1 rounded flex items-center gap-1 shadow-lg shadow-emerald-500/40 z-10">
                <Award size={10} /> FOUNDER_STAKE (400)
              </div>
            )}

            <div className="flex items-start justify-between mb-6">
              <div className={`p-3 bg-zinc-900 border border-zinc-800 ${asset.color} rounded-lg`}>
                {asset.icon}
              </div>
              <div className="text-right">
                <p className="text-[12x] text-zinc-600 uppercase font-bold tracking-widest">Holdings</p>
                <p className={`text-2xl font-black font-mono ${holdings[asset.id] > 0 ? 'text-white' : 'text-zinc-800'}`}>
                  {holdings[asset.id].toLocaleString()} <span className="text-[12px] opacity-40">SHARES</span>
                </p>
              </div>
            </div>

            <h3 className="mb-1 text-lg font-bold tracking-tight text-white uppercase">{asset.name}</h3>
            <p className="text-[15px] text-zinc-500 mb-6 uppercase tracking-wider">{asset.desc} @ ₹10.00/Share</p>

            {/* SATURATION BAR */}
            {/* <div className="mb-8">
               <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                  <span className="flex items-center gap-1 text-zinc-500"><Activity size={10}/> Market_Saturation</span>
                  <span className="text-zinc-400">{marketVolume[asset.id].toLocaleString()} Circulating</span>
               </div>
               <div className="w-full h-1 overflow-hidden rounded-full bg-zinc-900">
                  <div 
                    className={`h-full transition-all duration-1000 ${marketVolume[asset.id] > 5000 ? 'bg-rose-500' : 'bg-emerald-500/40'}`}
                    style={{ width: `${Math.min((marketVolume[asset.id] / 10000) * 100, 100)}%` }}
                  ></div>
               </div>
            </div> */}

            {/* ORDER BOX */}
            <div className="flex flex-col gap-4 p-4 border bg-black/40 border-zinc-900 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Trade_Quantity</span>
                <div className="flex items-center p-1 border rounded-lg bg-zinc-900 border-zinc-800">
                  <button onClick={() => updateInput(asset.id, tradeQtys[asset.id] - 10)} className="flex items-center justify-center w-8 h-8 hover:text-white"><Minus size={14}/></button>
                  <input 
                    type="number" 
                    value={tradeQtys[asset.id]} 
                    onChange={(e) => updateInput(asset.id, parseInt(e.target.value))}
                    className="w-20 bg-transparent text-center text-sm font-bold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => updateInput(asset.id, tradeQtys[asset.id] + 10)} className="flex items-center justify-center w-8 h-8 hover:text-white"><Plus size={14}/></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  disabled={loading === asset.id}
                  onClick={() => handleTrade(asset.id, 'buy')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-black text-[11px] font-black py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <TrendingUp size={14}/> BUY
                </button>
                <button 
                  disabled={loading === asset.id}
                  onClick={() => handleTrade(asset.id, 'sell')}
                  className="border border-rose-900/50 text-rose-500 hover:bg-rose-950/30 text-[11px] font-black py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <TrendingDown size={14}/> SELL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER TICKER */}
      {/* <div className="fixed bottom-0 left-0 z-50 flex items-center w-full h-12 border-t bg-black/80 backdrop-blur-md border-emerald-500/20"> */}
          {/* <div className="flex items-center h-full px-6 text-xs font-black text-black bg-emerald-500">
            <span className="mr-2 text-lg animate-pulse">●</span> LIVE_FEED
          </div> */}
          {/* <marquee className="flex-1 text-sm font-bold text-emerald-400 tracking-[0.2em] uppercase" scrollamount="7">
            {news.length > 0 ? news.join('      ///      ') : "MARKET_OPEN // NO_DATA_STREAMING"}
          </marquee> */}
      {/* </div> */}

    </div>
  );
};