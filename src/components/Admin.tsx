import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Users, Megaphone, Zap, Trash2, RefreshCw, Trophy, 
  ShieldAlert, Activity, CheckCircle2, XCircle, Play, 
  TrendingUp, BarChart3, ChevronRight 
} from 'lucide-react';

export const Admin = ({ onBack }: { onBack: () => void }) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Inputs
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [rumor, setRumor] = useState('');
  const [marketQuestion, setMarketQuestion] = useState('');

const refreshData = async () => {
  setLoading(true);
  try {
    const { data: tData } = await supabase.from('teams').select('*').order('balance', { ascending: false });
    const { data: nData } = await supabase.from('market_news').select('*').order('created_at', { ascending: false });
    
    // Specifically look for the active market
    const { data: mData, error: mError } = await supabase
      .from('live_market')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    
    if (tData) setTeams(tData);
    if (nData) setNews(nData);
    if (mData) setMarket(mData); else setMarket(null);
    
    if (mError) console.error("Market Fetch Error:", mError.message);
  } catch (err) {
    console.error("System Error:", err);
  }
  setLoading(false);
};


  useEffect(() => {
  refreshData();

  // Listen for EVERYTHING
  const channel = supabase.channel('admin-global-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => refreshData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_market' }, () => refreshData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_news' }, () => refreshData())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);


  // --- 1. TEAM REGISTRATION & AUTO-STAKE ---
  const handleRegister = async () => {
    if (!teamName || !password) return alert("Fill all fields");
    const assets = ['lib', 'piz', 'gym', 'inc'];
    const founder = assets[Math.floor(Math.random() * 4)];

    const { data: newTeam, error } = await supabase.from('teams').insert([
      { team_name: teamName.toUpperCase(), password, balance: 600, founder_asset: founder, phase: 1 }
    ]).select();

    if (error) return alert(error.message);
    if (newTeam) {
      await supabase.from('transactions').insert([{ 
        team_id: newTeam[0].id, asset_id: founder, amount: 400, price_at_time: 1, type: 'buy_equity' 
      }]);
    }
    setTeamName(''); setPassword(''); refreshData();
  };

  // --- 2. PHASE 1 RESOLUTION (SCARCITY PAYOUT) ---
  const resolvePhase1 = async () => {
    const confirm = window.confirm("Calculate Scarcity Payouts? This will update all team balances!");
    if (!confirm) return;
    setLoading(true);

    // Call the SQL Function logic via RPC or simple logic
    // Using a $10,000 pot per asset as discussed
    const totalPot = 10000;
    const assets = ['lib', 'piz', 'gym', 'inc'];

    for (const assetId of assets) {
        const { data: txs } = await supabase.from('transactions').select('team_id, amount').eq('asset_id', assetId).eq('type', 'buy_equity');
        if (txs && txs.length > 0) {
            const totalShares = txs.reduce((acc, curr) => acc + curr.amount, 0);
            const payoutPerShare = totalPot / totalShares;

            for (const tx of txs) {
                const { data: teamData } = await supabase.from('teams').select('balance').eq('id', tx.team_id).single();
                if (teamData) {
                    await supabase.from('teams').update({ 
                        balance: Number(teamData.balance) + (tx.amount * payoutPerShare) 
                    }).eq('id', tx.team_id);
                }
            }
        }
    }
    alert("Scarcity Math Applied!");
    setLoading(false);
    refreshData();
  };

  // --- 3. PHASE 2: DYNAMIC PROBO MARKET ---
const launchProboMarket = async () => {
  if (!marketQuestion) return alert("Please enter a question");
  setLoading(true);

  console.log("Launching Market:", marketQuestion);

  // A. Deactivate all existing markets
  const { error: deactivateError } = await supabase
    .from('live_market')
    .update({ is_active: false })
    .eq('is_active', true);

  if (deactivateError) console.error("Deactivation Error:", deactivateError.message);

  // B. Insert the new market
  const { data, error: insertError } = await supabase.from('live_market').insert([{
    question: marketQuestion.toUpperCase(),
    yes_pool: 50,
    no_pool: 50,
    is_active: true
  }]).select();

  if (insertError) {
    alert("Insert Failed: " + insertError.message);
  } else {
    console.log("Market Inserted Successfully:", data);
    setMarketQuestion('');
    // Manually trigger a refresh to show the new market card immediately
    await refreshData();
  }
  setLoading(false);
};

  const settleProboMarket = async (winner: 'yes' | 'no') => {
    if (!market) return;
    setLoading(true);

    const { data: trades } = await supabase.from('transactions').select('*').eq('asset_id', market.id);
    
    if (trades) {
        for (const trade of trades) {
            if (trade.type === `buy_${winner}`) {
                const payout = trade.amount * 10; // Fixed ₹10 payout per unit
                const { data: teamData } = await supabase.from('teams').select('balance').eq('id', trade.team_id).single();
                if (teamData) {
                    await supabase.from('teams').update({ balance: Number(teamData.balance) + payout }).eq('id', trade.team_id);
                }
            }
        }
    }

    await supabase.from('live_market').update({ is_active: false, resolved_winner: winner }).eq('id', market.id);
    setMarket(null);
    setLoading(false);
    refreshData();
    alert(`Market Settled! Winners paid ₹10.0 per unit.`);
  };

  // --- 4. PHASE SWITCHER ---
  const setGlobalPhase = async (p: number) => {
    await supabase.from('teams').update({ phase: p }).neq('status', 'god');
    refreshData();
  };

  return (
    <div className="min-h-screen bg-[#020202] text-zinc-400 font-mono p-4 md:p-8">
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between pb-6 mx-auto mb-8 border-b max-w-7xl border-zinc-900">
        <div className="flex items-center gap-3">
          <Zap className="text-emerald-500 fill-emerald-500" size={24} />
          <h1 className="text-xl font-black tracking-tighter text-white uppercase">War_Room_Command</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={refreshData} className="p-2 border border-zinc-800 hover:bg-zinc-900"><RefreshCw size={18}/></button>
          <button onClick={onBack} className="px-6 py-2 text-xs font-black text-black uppercase bg-white">Exit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 mx-auto max-w-7xl lg:grid-cols-12">
        
        {/* LEFT: MANAGEMENT */}
        <div className="space-y-6 lg:col-span-4">
          <section className="p-6 border rounded shadow-xl bg-zinc-950 border-zinc-900">
            <h2 className="text-[10px] font-black text-emerald-500 mb-4 uppercase tracking-[0.2em]">Add_Active_Team</h2>
            <div className="space-y-2">
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="TEAM NAME" className="w-full p-3 text-xs text-white bg-black border outline-none border-zinc-800 focus:border-emerald-500" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="PASSWORD" className="w-full p-3 text-xs text-white bg-black border outline-none border-zinc-800 focus:border-emerald-500" />
              <button onClick={handleRegister} className="w-full py-3 text-xs font-black text-black uppercase bg-emerald-600">Register_Unit</button>
            </div>
          </section>

          <section className="p-6 border rounded shadow-xl bg-zinc-950 border-zinc-900">
            <h2 className="text-[10px] font-black text-blue-500 mb-4 uppercase tracking-[0.2em]">Game_Flow_Control</h2>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setGlobalPhase(1)} className="border border-zinc-800 p-3 text-[10px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 1: Trade <span>{teams[0]?.phase === 1 && '●'}</span></button>
              <button onClick={() => setGlobalPhase(11)} className="border border-zinc-800 p-3 text-[10px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 1.5: Results <span>{teams[0]?.phase === 11 && '●'}</span></button>
              <button onClick={() => setGlobalPhase(2)} className="border border-zinc-800 p-3 text-[10px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 2: Probo <span>{teams[0]?.phase === 2 && '●'}</span></button>
            </div>
          </section>

          <section className="p-6 border rounded bg-zinc-950 border-zinc-900">
             <h2 className="text-[10px] font-black text-orange-500 mb-4 uppercase flex items-center gap-2"><Megaphone size={14}/> Intel_Inject</h2>
             <div className="flex gap-2">
                <input value={rumor} onChange={e => setRumor(e.target.value)} placeholder="MESSAGE..." className="flex-1 p-2 text-xs text-white bg-black border border-zinc-800" />
                <button onClick={() => {
                  supabase.from('market_news').insert([{ message: rumor.toUpperCase() }]).then(() => {setRumor(''); refreshData();});
                }} className="bg-orange-600 px-4 text-black font-black text-[10px]">FLASH</button>
             </div>
          </section>
        </div>

        {/* CENTER: DYNAMIC PROBO ENGINE */}
        <div className="space-y-6 lg:col-span-4">
          <section className="bg-zinc-950 border border-emerald-500/30 p-8 rounded-xl h-full shadow-[0_0_50px_rgba(16,185,129,0.05)]">
            <h2 className="text-[10px] font-black text-emerald-500 mb-8 uppercase tracking-[0.3em] flex items-center gap-2">
              <Activity size={16}/> Dynamic_Market_Engine
            </h2>
            
            {!market ? (
              <div className="space-y-6">
                <textarea 
                  value={marketQuestion} onChange={e => setMarketQuestion(e.target.value)}
                  placeholder="ENTER PROBO-STYLE QUESTION (E.G. WILL SRI LANKA SCORE 23 RUNS?)" 
                  className="w-full h-48 p-4 text-xs text-white bg-black border outline-none resize-none border-zinc-800 focus:border-emerald-500"
                />
                <button onClick={launchProboMarket} className="flex items-center justify-center w-full gap-2 py-4 text-xs font-black text-black uppercase bg-emerald-600">
                  <Play size={16} fill="black" /> Launch_Probo_Market
                </button>
                <div className="pt-6 border-t border-zinc-900">
                  <button onClick={resolvePhase1} className="w-full bg-zinc-800 text-zinc-400 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2">
                    <BarChart3 size={14}/> Resolve_Phase1_Scarcity
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="p-6 text-center border rounded bg-zinc-900 border-zinc-800">
                  <p className="text-[10px] text-zinc-500 mb-2">ACTIVE_PROBO_MARKET</p>
                  <p className="text-lg italic font-bold text-white uppercase">{market.question}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-black text-emerald-500">₹{((market.yes_pool / (market.yes_pool + market.no_pool)) * 10).toFixed(1)}</p>
                    <p className="text-[10px] text-zinc-600 uppercase">Yes_Price</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-rose-500">₹{(10 - ((market.yes_pool / (market.yes_pool + market.no_pool)) * 10)).toFixed(1)}</p>
                    <p className="text-[10px] text-zinc-600 uppercase">No_Price</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-10 border-t border-zinc-900">
                  <p className="text-[9px] text-center text-zinc-500 uppercase">Settle_Contract_Result:</p>
                  <button onClick={() => settleProboMarket('yes')} className="flex items-center justify-center gap-2 py-3 text-xs font-black text-black uppercase bg-emerald-600">
                    <CheckCircle2 size={16}/> Yes_Correct_Payout
                  </button>
                  <button onClick={() => settleProboMarket('no')} className="flex items-center justify-center gap-2 py-3 text-xs font-black text-black uppercase bg-rose-600">
                    <XCircle size={16}/> No_Correct_Payout
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: LIVE LEADERBOARD */}
        <div className="lg:col-span-4">
          <section className="overflow-hidden border rounded shadow-2xl bg-zinc-950 border-zinc-900">
            <div className="flex items-center justify-between p-4 bg-zinc-900">
               <h2 className="text-[10px] font-black text-white flex items-center gap-2 uppercase tracking-widest">
                 <Trophy size={14} className="text-yellow-500"/> Realtime_Leaderboard
               </h2>
               <span className="text-[9px] text-zinc-500">{teams.length} Units</span>
            </div>
            <div className="max-h-[750px] overflow-y-auto">
              {teams.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 transition-all border-b border-zinc-900 hover:bg-emerald-500/5 group">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-700 font-black">#{idx + 1}</span>
                    <div>
                      <p className="text-xs font-bold text-white uppercase transition-colors group-hover:text-emerald-500">{t.team_name}</p>
                      <p className="text-[8px] text-zinc-600 uppercase">Stake: {t.founder_asset} // P{t.phase}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-bold text-emerald-500">
                    ${(Number(t.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};