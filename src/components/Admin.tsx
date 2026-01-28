import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
   Megaphone, Zap, RefreshCw, Trophy, 
  ShieldAlert, Activity, CheckCircle2, XCircle, Play, 
   BarChart3,
   ChevronRight,
   ChevronLeft, 
} from 'lucide-react';

export const Admin = ({ onBack }: { onBack: () => void }) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [ news, setNews] = useState<any[]>([]);
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);

const changeQuestion = async (newIndex: number) => {
  if (newIndex < 0 || newIndex > 3) return;
  const { error } = await supabase
    .from('game_state')
    .update({ current_q_index: newIndex })
    .eq('id', 1);

  if (!error) setCurrentQ(newIndex);
};

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
      const { data: mData } = await supabase.from('live_market').select('*').eq('is_active', true).maybeSingle();
      
      if (tData) setTeams(tData);
      if (nData) setNews(nData);
      if (mData) setMarket(mData); else setMarket(null);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    const channel = supabase.channel('admin-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_market' }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_news' }, () => refreshData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
  const eliminateDownTo = async (count: number) => {
    const confirm = window.confirm(`DANGER: This will permanently eliminate everyone except the Top ${count} teams. Their passwords will be changed. Proceed?`);
    if (!confirm) return;

    setLoading(true);

    try {
      // 1. Get all currently active teams sorted by balance
      const { data: allTeams, error: fetchError } = await supabase
        .from('teams')
        .select('id, team_name')
        .eq('status', 'active')
        .order('balance', { ascending: false });

      if (fetchError) throw fetchError;
      if (!allTeams || allTeams.length <= count) {
          alert(`Not enough teams to eliminate. Current active: ${allTeams?.length}`);
          setLoading(false);
          return;
      }

      // 2. Identify the Losers (everyone after the 'count' index)
      const losers = allTeams.slice(count);
      const loserIds = losers.map(l => l.id);

      // 3. Update losers in the Database
      // We change their password to a random string + 'LOCKED' to prevent re-login
      const { error: updateError } = await supabase
        .from('teams')
        .update({ 
            status: 'eliminated',
            password: `LOCKED_${Math.random().toString(36).slice(-8)}` 
        })
        .in('id', loserIds);

      if (updateError) throw updateError;

      alert(`PURGE COMPLETE: ${losers.length} teams eliminated. Top ${count} remain.`);
      refreshData();

    } catch (err: any) {
      alert("Purge Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 1. TEAM REGISTRATION & AUTO-STAKE ---
  const handleRegister = async () => {
  if (!teamName || !password) return alert("Fill all fields");
  setLoading(true);

  try {
    // 1. FETCH CURRENT DISTRIBUTION TO ENSURE BALANCE
    const { data: existingTeams } = await supabase
      .from('teams')
      .select('founder_asset');

    const assetOptions = ['lib', 'piz', 'gym', 'inc'];
    let founderAsset = '';

    if (!existingTeams || existingTeams.length === 0) {
      // If first team, pick truly random
      founderAsset = assetOptions[Math.floor(Math.random() * 4)];
    } else {
      // Count occurrences of each asset
      const counts: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
      existingTeams.forEach(t => {
        if (t.founder_asset) counts[t.founder_asset]++;
      });

      // Find the asset(s) with the minimum count
      const minCount = Math.min(...Object.values(counts) as number[]);
      const rarestAssets = assetOptions.filter(asset => counts[asset] === minCount);
      
      // Pick one from the rarest options
      founderAsset = rarestAssets[Math.floor(Math.random() * rarestAssets.length)];
    }

    console.log(`Balanced Selection: ${founderAsset.toUpperCase()}`);

    // 2. REGISTER THE TEAM
    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert([
        { 
          team_name: teamName.toUpperCase(), 
          password: password, 
          balance: 600, 
          founder_asset: founderAsset, 
          phase: 1 
        }
      ])
      .select();

    if (teamError) throw teamError;

    // 3. AUTO-STAKE THE 400 SHARES
    if (newTeam && newTeam.length > 0) {
      await supabase.from('transactions').insert([{ 
        team_id: newTeam[0].id, 
        asset_id: founderAsset, 
        amount: 400, 
        price_at_time: 1, 
        type: 'buy_equity' 
      }]);
      
      alert(`REGISTRATION SUCCESSFUL\nTeam: ${teamName.toUpperCase()}\nStake: ${founderAsset.toUpperCase()}`);
    }

    setTeamName('');
    setPassword('');
    refreshData();

  } catch (err: any) {
    alert("Error: " + err.message);
  } finally {
    setLoading(false);
  }
};
  

  // --- 2. PHASE 1 RESOLUTION (SCARCITY PAYOUT) ---
  const resolvePhase1 = async () => {
    const confirm = window.confirm("Calculate Scarcity Payouts? This will update all team balances!");
    if (!confirm) return;
    setLoading(true);

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
    alert("Phase 1 Scarcity Math Applied!");
    setLoading(false);
    refreshData();
  };

  // --- 3. PHASE 2: DYNAMIC PROBO MARKET ---
  const launchProboMarket = async () => {
    if (!marketQuestion) return alert("Enter a question");
    setLoading(true);
    
    // Deactivate old markets
    await supabase.from('live_market').update({ is_active: false }).eq('is_active', true);
    
    // Launch new with 50/50 virtual liquidity (Price starts at 500)
    const { error } = await supabase.from('live_market').insert([{
      question: marketQuestion.toUpperCase(),
      yes_pool: 50,
      no_pool: 50,
      is_active: true
    }]);

    if (error) alert(error.message);
    setMarketQuestion('');
    setLoading(false);
    refreshData();
  };

  const settleProboMarket = async (winner: 'yes' | 'no') => {
    if (!market) return;
    const confirm = window.confirm(`Settle market as ${winner.toUpperCase()}? Winners get Qty * $1000!`);
    if (!confirm) return;
    
    setLoading(true);
    const { data: trades } = await supabase.from('transactions').select('*').eq('asset_id', market.id);
    
    if (trades) {
        for (const trade of trades) {
            if (trade.type === `buy_${winner}`) {
                const payout = trade.amount * 1000; // THE $1000 PAYOUT MATH
                const { data: teamData } = await supabase.from('teams').select('balance').eq('id', trade.team_id).single();
                if (teamData) {
                    await supabase.from('teams').update({ balance: Number(teamData.balance) + payout }).eq('id', trade.team_id);
                }
            }
        }
    }

    await supabase.from('live_market').update({ is_active: false, resolved_winner: winner }).eq('id', market.id);
    alert(`Market Resolved! Winners paid $1000 per unit.`);
    setLoading(false);
    refreshData();
  };

const setGlobalPhase = async (p: number) => {
  const { error } = await supabase
    .from('teams')
    .update({ phase: p })
    .neq('status', 'god'); // Update everyone except you

  if (error) alert("Phase Update Failed: " + error.message);
  else console.log(`Market advanced to Phase ${p}`);
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
          <button onClick={refreshData} className={`p-2 border border-zinc-800 hover:bg-zinc-900 ${loading ? 'animate-spin' : ''}`}><RefreshCw size={18}/></button>
          <button onClick={onBack} className="px-6 py-2 text-xs font-black text-black uppercase transition-all bg-white hover:bg-emerald-500">Exit_Admin</button>
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
              <button onClick={handleRegister} className="w-full py-3 text-xs font-black text-black uppercase transition-all bg-emerald-600 hover:bg-emerald-400">Register_Unit</button>
            </div>
          </section>

          <section className="p-6 border rounded shadow-xl bg-zinc-950 border-zinc-900">
            <h2 className="text-[10px] font-black text-blue-500 mb-4 uppercase tracking-[0.2em]">Game_Flow_Control</h2>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setGlobalPhase(1)} className="border border-zinc-800 p-3 text-[12px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 1: Trade <span>{teams[0]?.phase === 1 && '●'}</span></button>
              <button onClick={() => setGlobalPhase(11)} className="border border-zinc-800 p-3 text-[12px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 1.5: Results <span>{teams[0]?.phase === 11 && '●'}</span></button>
              <button onClick={() => setGlobalPhase(2)} className="border border-zinc-800 p-3 text-[12px] hover:bg-zinc-900 text-left flex justify-between uppercase">Phase 2: Opinion Market <span>{teams[0]?.phase === 2 && '●'}</span></button>
            </div>
          </section>
          <section className="p-6 mt-6 border rounded shadow-xl bg-zinc-950 border-red-900/30">
  <h2 className="text-[10px] font-black text-red-500 mb-4 uppercase tracking-[0.2em] flex items-center gap-2">
    <ShieldAlert size={14} /> Elimination_Protocols
  </h2>
  <div className="grid grid-cols-1 gap-2">
    <button 
      onClick={() => eliminateDownTo(20)} 
      disabled={loading}
      className="bg-red-900/20 border border-red-900/50 text-red-500 p-3 text-[10px] font-bold hover:bg-red-600 hover:text-white transition-all uppercase"
    >
      Eliminate down to Top 20
    </button>
    <button 
      onClick={() => eliminateDownTo(8)} 
      disabled={loading}
      className="bg-red-900/20 border border-red-900/50 text-red-500 p-3 text-[10px] font-bold hover:bg-red-600 hover:text-white transition-all uppercase"
    >
      Eliminate down to Top 8
    </button>
  </div>
  <p className="mt-3 text-[8px] text-zinc-600 italic">
    *Note: Losers are immediately logged out and passwords locked.
  </p>
</section>

          <section className="p-6 border rounded bg-zinc-950 border-zinc-900">
             <h2 className="text-[10px] font-black text-orange-500 mb-4 uppercase flex items-center gap-2"><Megaphone size={14}/> Intel_Inject</h2>
             <div className="flex gap-2">
                <input value={rumor} onChange={e => setRumor(e.target.value)} placeholder="MESSAGE..." className="flex-1 p-2 text-xs text-white bg-black border outline-none border-zinc-800 focus:border-orange-500" />
                <button onClick={() => {
                  supabase.from('market_news').insert([{ message: rumor.toUpperCase() }]).then(() => {setRumor(''); refreshData();});
                }} className="bg-orange-600 px-4 text-black font-black text-[10px] uppercase">Flash</button>
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
                  placeholder="ENTER QUESTION (E.G. WILL SRI LANKA SCORE 23 RUNS?)" 
                  className="w-full h-48 p-4 text-xs text-white bg-black border outline-none resize-none border-zinc-800 focus:border-emerald-500"
                />
                <button onClick={launchProboMarket} className="flex items-center justify-center w-full gap-2 py-4 text-xs font-black text-black uppercase shadow-lg bg-emerald-600 shadow-emerald-600/20">
                  <Play size={16} fill="black" /> Launch_Market
                </button>
                <div className="pt-6 border-t border-zinc-900">
                  <button onClick={resolvePhase1} className="w-full bg-zinc-800 text-zinc-400 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 hover:text-white transition-all">
                    <BarChart3 size={14}/> Resolve_Phase1_Scarcity
                  </button>
                  <section className="p-6 mt-6 border bg-zinc-950 border-emerald-500/20 rounded-xl">
  <h2 className="text-[10px] font-black text-emerald-500 mb-6 uppercase tracking-widest">
    Global_Question_Controller
  </h2>
  <div className="flex items-center justify-between p-4 mb-4 bg-black border rounded-lg border-zinc-800">
    <button onClick={() => changeQuestion(currentQ - 1)} className="p-2 hover:text-white">
      <ChevronLeft />
    </button>
    <div className="text-center">
      <p className="text-[10px] text-zinc-500 uppercase">Active Question</p>
      <p className="text-xl font-black text-white">{currentQ + 1} / 4</p>
    </div>
    <button onClick={() => changeQuestion(currentQ + 1)} className="p-2 hover:text-white">
      <ChevronRight />
    </button>
  </div>
  <p className="text-[9px] text-zinc-600 text-center uppercase italic">
    Changing this will flip every student's screen instantly.
  </p>
</section>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="p-6 text-center border rounded bg-zinc-900 border-zinc-800">
                  <p className="text-[10px] text-zinc-500 mb-2 font-bold tracking-widest uppercase">Active_Poll</p>
                  <p className="text-lg italic font-bold leading-tight tracking-tight text-white uppercase">{market.question}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 text-center border rounded bg-zinc-900/40 border-zinc-900">
                    <p className="text-3xl font-black text-emerald-500">₹{((market.yes_pool / (market.yes_pool + market.no_pool)) * 1000).toFixed(1)}</p>
                    <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Yes_Price</p>
                  </div>
                  <div className="p-4 text-center border rounded bg-zinc-900/40 border-zinc-900">
                    <p className="text-3xl font-black text-rose-500">₹{(1000 - ((market.yes_pool / (market.yes_pool + market.no_pool)) * 1000)).toFixed(1)}</p>
                    <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">No_Price</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-10 border-t border-zinc-900">
                  <p className="text-[9px] text-center text-zinc-500 uppercase font-bold">Settle_Contract_Result:</p>
                  <button onClick={() => settleProboMarket('yes')} className="flex items-center justify-center gap-2 py-3 text-xs font-black text-black uppercase transition-all bg-emerald-600 hover:bg-emerald-400">
                    <CheckCircle2 size={16}/> Yes_Correct_Payout
                  </button>
                  <button onClick={() => settleProboMarket('no')} className="flex items-center justify-center gap-2 py-3 text-xs font-black text-black uppercase transition-all bg-rose-600 hover:bg-rose-400">
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
            <div className="flex items-center justify-between p-4 border-b bg-zinc-900 border-zinc-800">
               <h2 className="text-[10px] font-black text-white flex items-center gap-2 uppercase tracking-widest">
                 <Trophy size={14} className="text-yellow-500"/> Realtime_Leaderboard
               </h2>
               <span className="text-[9px] text-zinc-500 uppercase">{teams.length} Units</span>
            </div>
            <div className="max-h-[750px] overflow-y-auto">
              {teams.length > 0 ? teams.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 transition-all border-b border-zinc-900 hover:bg-emerald-500/5 group">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-700 font-black">#{idx + 1}</span>
                    <div>
                      <p className="font-bold text-white uppercase transition-colors text-s group-hover:text-emerald-500">{t.team_name}</p>
                      <p className="text-[12px] text-white uppercase">Stake: {t.founder_asset} // P{t.phase}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm font-bold text-emerald-500">
                    ${(Number(t.balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )) : (
                <div className="p-8 text-center text-[10px] text-zinc-700 uppercase italic">No teams detected...</div>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
};