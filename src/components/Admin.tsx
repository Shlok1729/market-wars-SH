import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
   Megaphone, Zap, RefreshCw, Trophy, 
  ShieldAlert, Activity, CheckCircle2, XCircle, Play, 
   BarChart3,
   ChevronRight,
   ChevronLeft,
   Radio, 
} from 'lucide-react';

export const Admin = ({ onBack }: { onBack: () => void }) => {
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const finalizeWinners = async () => {
    setLoading(true);
    try {
        // 1. Get all finalists
        const { data: finalists } = await supabase.from('teams').select('id, team_name, founder_asset').eq('is_finalist', true);
        
        // 2. Get all votes
        const { data: votes } = await supabase.from('final_votes').select('finalist_team_id');
        
        if (!finalists || !votes) return;

        // 3. Tally
        const tally = finalists.map(f => ({
            ...f,
            count: votes.filter(v => v.finalist_team_id === f.id).length
        })).sort((a, b) => b.count - a.count);

        // 4. Wipe old winners and insert top 3
        await supabase.from('winners_circle').delete().neq('rank', 0);
        
        const top3 = tally.slice(0, 3).map((team, index) => ({
            rank: index + 1,
            team_name: team.team_name,
            founder_asset: team.founder_asset,
            vote_count: team.count
        }));

        await supabase.from('winners_circle').insert(top3);

        // 5. Switch global phase to 5
        await supabase.from('teams').update({ phase: 5 }).neq('status', 'god');
        
        alert("GAME OVER: WINNERS CIRCLE IS LIVE!");
    } catch (err) {
        alert("Error finalizing: " + err);
    }
    setLoading(false);
};

const initializePhase4 = async () => {
  setLoading(true);
  try {
    // 1. Fetch current data
    const { data: teams } = await supabase.from('teams').select('*').eq('status', 'active');
    const { data: prices } = await supabase.from('stock_prices').select('*');
    const { data: txs } = await supabase.from('transactions').select('*');

    if (!teams || !prices || !txs) return;

    // 2. Calculate Net Worth and Sort Teams
    const pMap: any = {};
    prices.forEach(p => pMap[p.symbol] = Number(p.current_price));

    const rankedTeams = teams.map(t => {
      let equity = 0;
      txs.filter(tx => tx.team_id === t.id).forEach(tx => {
        equity += (Number(tx.amount) * (pMap[tx.asset_id] || 0));
      });
      return { id: t.id, netWorth: Number(t.balance) + equity };
    }).sort((a, b) => b.netWorth - a.netWorth);

    // 3. Sort ALL 6 Stocks by Price (High to Low)
    const rankedStocks = [...prices].sort((a, b) => Number(b.current_price) - Number(a.current_price));

    // 4. Select Top 6 Teams
    const top6 = rankedTeams.slice(0, 6);

    // 5. Reset previous finalists and then Map One-to-One
    await supabase.from('teams').update({ is_finalist: false, assigned_pitch_asset: null }).neq('status', 'god');

    for (let i = 0; i < top6.length; i++) {
      await supabase.from('teams').update({ 
        is_finalist: true, 
        assigned_pitch_asset: rankedStocks[i].symbol, // Mapping highest team to highest stock
        phase: 4 
      }).eq('id', top6[i].id);
    }

    // 6. Move non-finalists to Phase 4 to watch
    await supabase.from('teams').update({ phase: 4 }).eq('is_finalist', false).neq('status', 'god');

    alert("ELECTION INITIALIZED: Top 6 Teams mapped to Top 6 Assets.");
    refreshData();
  } catch (err) {
    alert("Error: " + err);
  }
  setLoading(false);
};

const toggleVoting = async (open: boolean) => {
    await supabase.from('game_state').update({ is_voting_open: open }).eq('id', 1);
    setIsVotingOpen(open);
};

  const [currentEvent, setCurrentEvent] = useState(0);

const startPhase3 = async () => {
    // Switch all active teams to Phase 3
    const { error } = await supabase.from('teams').update({ phase: 3 }).neq('status', 'god');
    if (!error) alert("ROOM TRANSITIONED TO PHASE 3: CHAOS ROUND");
};

const updateEventIndex = async (newIdx: number) => {
    if (newIdx < 0 || newIdx > 8) return;
    const { error } = await supabase
        .from('game_state')
        .update({ current_event_index: newIdx })
        .eq('id', 1);
    
    if (!error) setCurrentEvent(newIdx);
};

  const [eventIdx, setEventIdx] = useState(0);

const triggerNextEvent = async (newIdx: number) => {
  if (newIdx < 0 || newIdx > 8) return;
  const { error } = await supabase
    .from('game_state')
    .update({ current_event_index: newIdx })
    .eq('id', 1);

  if (!error) setEventIdx(newIdx);
};
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
    // 1. Fetch Teams, News, Active Market, Prices, and all Transactions
    const { data: tData } = await supabase.from('teams').select('*');
    const { data: nData } = await supabase.from('market_news').select('*').order('created_at', { ascending: false });
    const { data: mData } = await supabase.from('live_market').select('*').eq('is_active', true).maybeSingle();
    const { data: pData } = await supabase.from('stock_prices').select('*');
    const { data: allTxs } = await supabase.from('transactions').select('*');

    if (tData && pData && allTxs) {
      // Map prices for easy lookup
      const pMap: any = {};
      pData.forEach(p => pMap[p.symbol] = Number(p.current_price));

      // 2. Calculate Net Worth for every team
      const calculatedLeaderboard = tData.map(team => {
        let equityValue = 0;
        const teamTxs = allTxs.filter(tx => tx.team_id === team.id);
        
        // Sum up the value of their holdings
        teamTxs.forEach(tx => {
          const currentPrice = pMap[tx.asset_id] || 0;
          equityValue += (tx.amount * currentPrice);
        });

        return {
          ...team,
          equityValue,
          netWorth: Number(team.balance) + equityValue
        };
      });

      // 3. Sort by Net Worth (Wealthiest first)
      setTeams(calculatedLeaderboard.sort((a, b) => b.netWorth - a.netWorth));
    }

    if (nData) setNews(nData);
    if (mData) setMarket(mData); else setMarket(null);
  } catch (err) {
    console.error("Leaderboard Sync Error:", err);
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
  const confirm = window.confirm(`DANGER: This will purge everyone except the Top ${count} teams based on NET WORTH. Proceed?`);
  if (!confirm) return;

  setLoading(true);

  try {
    // 1. Fetch all necessary data for calculation
    const { data: allTeams } = await supabase.from('teams').select('*').eq('status', 'active');
    const { data: prices } = await supabase.from('stock_prices').select('*');
    const { data: allTxs } = await supabase.from('transactions').select('*');

    if (!allTeams || !prices || !allTxs) throw new Error("Could not fetch data for ranking.");

    // 2. Map prices for easy lookup
    const pMap: any = {};
    prices.forEach(p => pMap[p.symbol] = Number(p.current_price));

    // 3. Calculate Net Worth for every team
    const rankedTeams = allTeams.map(team => {
      let equityValue = 0;
      const teamTxs = allTxs.filter(tx => tx.team_id === team.id);
      
      // Calculate total holding value
      teamTxs.forEach(tx => {
        const currentPrice = pMap[tx.asset_id] || 0;
        equityValue += (Number(tx.amount) * currentPrice);
      });

      return {
        id: team.id,
        team_name: team.team_name,
        netWorth: Number(team.balance) + equityValue
      };
    });

    // 4. Sort by Net Worth (Wealthiest at the top)
    rankedTeams.sort((a, b) => b.netWorth - a.netWorth);

    if (rankedTeams.length <= count) {
      alert(`Operation aborted. Only ${rankedTeams.length} teams are active.`);
      setLoading(false);
      return;
    }

    // 5. Identify the Losers (everyone below the cut-off count)
    const losers = rankedTeams.slice(count);
    const loserIds = losers.map(l => l.id);

    console.log("Eliminating losers based on Net Worth:", losers);

    // 6. Update losers in the Database
    // Change status to 'eliminated' and lock passwords
    const { error: updateError } = await supabase
      .from('teams')
      .update({ 
          status: 'eliminated',
          password: `LOCKED_${Math.random().toString(36).slice(-8)}` 
      })
      .in('id', loserIds);

    if (updateError) throw updateError;

    alert(`BATTLE ROYALE COMPLETE: ${losers.length} teams eliminated. Top ${count} remain.`);
    refreshData();

  } catch (err: any) {
    console.error(err);
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

    const assetOptions = ['sft', 'atl', 'ecs', 'hog'];
    let founderAsset = '';

    if (!existingTeams || existingTeams.length === 0) {
      // If first team, pick truly random
      founderAsset = assetOptions[Math.floor(Math.random() * 4)];
    } else {
      // Count occurrences of each asset
      const counts: any = { sft: 0, atl: 0, ecs: 0, hog: 0 };
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
          balance: 6000, 
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
    const assets = ['sft', 'atl', 'ecs', 'hog'];

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
    alert("Phase 1 Scarcity Math Applied!!");
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
    alert(`Market Resolved! Winners paid ₹1000 per unit.`);
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
              <button 
  onClick={() => setGlobalPhase(200)} 
  className="w-full bg-indigo-600 text-white py-3 font-black text-[10px] uppercase mt-2 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
>
  Project Market Analytics
</button>
              <button 
  onClick={() => setGlobalPhase(33)} 
  className="w-full bg-red-600 text-white py-3 font-black text-[10px] uppercase mt-2 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
>
  Open Live Trading War
</button>
              <button onClick={finalizeWinners} className="w-full bg-yellow-500 text-black py-4 font-black uppercase text-xs mt-4 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
    Finalize Tally & Reveal Winners
</button>
              <section className="p-6 mt-6 border bg-zinc-950 border-emerald-500/20 rounded-xl">
    <h2 className="text-[10px] font-black text-emerald-500 mb-4 uppercase">Phase_4: The_Pitch</h2>
    <div className="space-y-3">
        <button onClick={initializePhase4} className="w-full py-3 text-xs font-black text-black uppercase bg-emerald-600">
            Identify Top 8 & Launch Phase 4
        </button>
        <div className="flex gap-2">
            <button onClick={() => toggleVoting(true)} className="flex-1 bg-zinc-800 text-white py-2 text-[10px] font-bold uppercase hover:bg-emerald-600 transition-all">Open Voting</button>
            <button onClick={() => toggleVoting(false)} className="flex-1 bg-zinc-800 text-white py-2 text-[10px] font-bold uppercase hover:bg-rose-600 transition-all">Close Voting</button>
        </div>
    </div>
</section>
              
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
<section className="p-6 mt-6 border shadow-xl bg-zinc-950 border-yellow-900/30 rounded-xl">
    <h2 className="text-[10px] font-black text-yellow-500 mb-4 uppercase tracking-[0.2em]">Listing_Authority</h2>
    <button 
        onClick={() => setGlobalPhase(31)} 
        className="w-full py-3 text-[10px] font-black text-black uppercase bg-yellow-500 hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)]"
    >
        Broadcast IPO Alert
    </button>
</section>
<section className="p-6 mt-6 border shadow-xl bg-zinc-950 border-rose-900/30 rounded-xl">
    <h2 className="text-[10px] font-black text-rose-500 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
        <Radio size={14} className="animate-pulse" /> Phase_3: Chaos_Controller
    </h2>
    
    <div className="space-y-4">
        {/* Step A: Switch the room */}
        <button 
            onClick={startPhase3}
            className="w-full py-3 text-xs font-black text-white uppercase transition-all border bg-zinc-900 border-rose-900/50 hover:bg-rose-900"
        >
            Activate Phase 3 UI
        </button>

        <div className="h-px bg-zinc-900"></div>

        {/* Step B: Control the Events */}
        <div className="flex items-center justify-between p-3 bg-black border rounded border-zinc-800">
            <button onClick={() => updateEventIndex(currentEvent - 1)} className="hover:text-rose-500">
                <ChevronLeft size={20} />
            </button>
            <div className="text-center">
                <p className="text-[9px] text-zinc-600 uppercase font-bold">Current_Event</p>
                <p className="text-xl font-black text-white">{currentEvent} / 8</p>
            </div>
            <button onClick={() => updateEventIndex(currentEvent + 1)} className="hover:text-rose-500">
                <ChevronRight size={20} />
            </button>
        </div>

        <p className="text-[8px] text-zinc-700 text-center uppercase">
            {currentEvent === 0 ? "No event active" : `Broadcasting Event #${currentEvent} to all terminals`}
        </p>

        {/* Reset Button */}
        <button 
            onClick={() => updateEventIndex(0)}
            className="w-full py-2 text-[9px] font-bold text-zinc-500 uppercase border border-zinc-900 hover:text-white"
        >
            Clear Screen / Reset Events
        </button>
    </div>
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
         <Trophy size={14} className="text-yellow-500"/> Realtime_Net_Worth_Leaderboard
       </h2>
       <span className="text-[9px] text-zinc-500 uppercase">{teams.length} Units</span>
    </div>
    <div className="max-h-[750px] overflow-y-auto">
      {teams.length > 0 ? teams.map((t, idx) => (
        <div key={t.id || idx} className="flex items-center justify-between p-4 transition-all border-b border-zinc-900 hover:bg-emerald-500/5 group">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-700 font-black">#{idx + 1}</span>
            <div>
              <p className="text-sm font-bold text-white uppercase transition-colors group-hover:text-emerald-500">
                {t.team_name}
                {t.is_finalist && <span className="ml-2 text-[8px] bg-yellow-500 text-black px-1 rounded">FINALIST</span>}
              </p>
              <p className="text-[12px] text-zinc-500 uppercase tracking-tighter">
                Stake: {t.founder_asset} // Ph{t.phase}
              </p>
              <div className="flex gap-2 mt-1 text-[14px] font-bold text-zinc-300 uppercase">
                <span>Purse: ₹{Number(t.balance).toFixed(0)}</span>
                <span>Equity: ₹{t.equityValue.toFixed(0)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Total_Valuation</p>
            <p className="font-mono text-base font-black tracking-tighter text-emerald-500">
              ₹{(t.netWorth || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )) : (
        <div className="p-12 text-center">
            <div className="w-6 h-6 mx-auto mb-4 border-2 rounded-full border-zinc-800 border-t-emerald-500 animate-spin"></div>
            <p className="text-[10px] text-zinc-700 uppercase italic tracking-widest">Awaiting Team Data...</p>
        </div>
      )}
    </div>
    <div className="p-3 text-center border-t bg-zinc-900/50 border-zinc-900">
        <p className="text-[8px] text-zinc-600 uppercase font-black tracking-[0.3em]">
          Ranking Algorithm: (Purse + Asset_Equity)
        </p>
    </div>
  </section>
</div>

      </div>
    </div>
  );
};