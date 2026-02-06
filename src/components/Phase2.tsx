import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BrainCircuit, ArrowRight, Users, Loader2, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

const QUESTIONS = [
  { 
    id: 'sft', 
    company: 'Making Space a Destination (SKYFORGE TECH)', 
    q: "A reusable launch vehicle recently completed a successful test mission, reducing future launch costs. What is the most likely short-term market reaction?", 
    options: [
      "Lower interest because space missions become less exclusive", 
      "Higher investor confidence due to improved cost efficiency", 
      "No major impact since space projects take many years", 
      "Reduced demand for satellites as space becomes more congested"
    ] 
  },
  { 
    id: 'hog', 
    company: 'Precision That Commands the Battlefield (ATLAS TECH)', 
    q: "New trade rules and compliance requirements have made cross-border business more complex.How does this situation most likely affect a global trade advisory firm?", 
    options: [
      "Reduced demand due to higher trade barriers", 
      "Increased demand for compliance and market-entry support", 
      "Complete halt in international trade activity", 
      "Shift of businesses to informal trade channels"
    ] 
  },
  { 
    id: 'ecs', 
    company: 'Where Networks Meet Tomorrow (EDGECELL NETWORKS)', 
    q: "Governments announced stricter security reviews for telecom network equipment. How could this affect a major telecom infrastructure provider?", 
    options: [
      "Loss of all existing contracts",   
      "Increased costs but higher long-term trust in approved suppliers", 
      "Immediate shutdown of network operations.", 
      "No impact on telecom companies"
    ] 
  },
  { 
    id: 'atl', 
    company: 'Connecting Markets. Creating Momentum (HORIZON GLOBAL)', 
    q: "Defense budgets are being increased following rising regional security concerns. What is the most realistic outcome for a defense manufacturer?", 
    options: [
      "Instant revenue growth within days", 
      "Gradual increase in orders through long-term contracts", 
      "Reduced government spending on weapons", 
      "No effect because defense markets are fixed"
    ] 
  }
];

export const Phase2 = ({ team }: { team: any }) => {
  const [step, setStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ [key: string]: number }>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [done, setDone] = useState(false);

  // 1. THE HEART OF THE COMPONENT: SYNC EVERYTHING
  const refreshUI = async (forceIdx?: number) => {
    // A. Get Global Index from Admin State
    const { data: state } = await supabase.from('game_state').select('current_q_index').eq('id', 1).single();
    const activeIdx = forceIdx !== undefined ? forceIdx : (state?.current_q_index || 0);
    
    // Check if we reached the end
    if (activeIdx > 3) {
      setDone(true);
      setInitializing(false);
      return;
    }

    setStep(activeIdx);
    setDone(false);

    // B. Check if THIS team has voted for the ACTIVE question
    const { data: myVote } = await supabase
      .from('team_responses')
      .select('*')
      .eq('team_id', team.id)
      .eq('asset_symbol', QUESTIONS[activeIdx].id)
      .maybeSingle();

    if (myVote) {
      setShowResults(true);
      // C. Fetch all votes for the bars
      const assetId = QUESTIONS[activeIdx].id;
      const { data: allVotes } = await supabase.from('team_responses').select('selected_option').eq('asset_symbol', assetId);
      
      if (allVotes) {
        const counts: any = {};
        QUESTIONS[activeIdx].options.forEach(opt => counts[opt] = 0);
        allVotes.forEach(row => { if (counts[row.selected_option] !== undefined) counts[row.selected_option]++; });
        setResults(counts);
        setTotalVotes(allVotes.length);
      }
    } else {
      setShowResults(false);
    }
    setInitializing(false);
  };

  useEffect(() => {
    // Initial load
    refreshUI();

    // 2. THE AGGRESSIVE REAL-TIME LISTENER
    const channel = supabase.channel('market-war-room')
      // Listen for Admin changing the Question Index
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, (payload) => {
        console.log("ADMIN_SYNC: New Question Received", payload.new.current_q_index);
        refreshUI(payload.new.current_q_index);
      })
      // Listen for any Team voting (Updates the Menti bars live)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_responses' }, () => {
        console.log("VOTE_SYNC: Refreshing Bars...");
        refreshUI();
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
        
      })
      .subscribe((status) => {
        console.log("REALTIME_CONNECTION:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [team.id]);

  const submitAnswer = async (option: string) => {
    const { error } = await supabase.from('team_responses').upsert({
      team_id: team.id,
      asset_symbol: QUESTIONS[step].id,
      selected_option: option
    });
    
    if (!error) {
      setShowResults(true);
      refreshUI();
    } else {
      alert("Submission Error: " + error.message);
    }
  };

  if (initializing) return (
    <div className="flex flex-col items-center justify-center min-h-screen font-mono bg-black">
        <Loader2 className="mb-4 animate-spin text-emerald-500" size={32} />
        <span className="text-zinc-600 uppercase tracking-[0.4em] text-[10px]">Syncing_With_War_Room_State...</span>
    </div>
  );

  if (done) return (
    <div className="flex items-center justify-center min-h-screen p-6 font-mono text-white bg-black">
      <div className="max-w-md p-10 text-center border shadow-2xl border-zinc-800 rounded-3xl bg-zinc-950">
        <BrainCircuit className="mx-auto mb-6 text-emerald-500 animate-pulse" size={64} />
        <h1 className="text-2xl font-black tracking-widest uppercase">Sentiment_Locked</h1>
        <p className="mt-4 text-xs leading-relaxed uppercase text-zinc-500">
            The market analysis round is complete. <br/>
            Gemini is now recalculating equity values based on your collective vision.
        </p>
        <div className="pt-8 mt-8 border-t border-zinc-900">
            <p className="text-[10px] text-emerald-500 font-bold uppercase animate-bounce">Stand by for Market Resolution</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-6 font-mono text-white bg-black">
      <div className="w-full max-w-xl">
        {!showResults ? (
          <div className="duration-700 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between pb-4 mb-8 border-b border-zinc-900">
                <div className="flex items-center gap-2 text-emerald-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase">Phase_02 // Live_Market_Polling</p>
                </div>
                <span className="text-4xl font-black leading-none text-zinc-900">0{step + 1}</span>
            </div>
            <p className="text-[14px] text-green-500 uppercase font-bold mb-2 tracking-widest">Target_Asset: {QUESTIONS[step].company}</p>
            <h1 className="mb-10 text-3xl font-black tracking-normal uppercase textleading-tight text-zinc-300">{QUESTIONS[step].q}</h1>
            <div className="grid grid-cols-1 gap-3">
              {QUESTIONS[step].options.map((opt) => (
                <button 
                    key={opt} 
                    onClick={() => submitAnswer(opt)} 
                    className="flex items-center justify-between p-5 tracking-normal text-left transition-all border bg-zinc-900 border-zinc-800 rounded-2xl hover:border-emerald-500 hover:bg-emerald-500/5 group"
                >
                  <span className="text-sm font-bold uppercase group-hover:text-emerald-400">{opt}</span>
                  <ArrowRight size={18} className="transition-all text-zinc-700 group-hover:text-emerald-500 group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="duration-500 animate-in zoom-in-95">
             <div className="mb-10 text-center">
                <h2 className="text-xl font-black tracking-tighter text-white uppercase">Sentiment_Analysis: {QUESTIONS[step].company}</h2>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full mt-4 border border-emerald-500/20">
                    <Users size={12} className="text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">{totalVotes} Teams Transmitting</span>
                </div>
             </div>
             
             <div className="p-8 mb-12 space-y-6 border bg-zinc-950/50 border-zinc-900 rounded-3xl">
                {QUESTIONS[step].options.map(opt => {
                    const count = results[opt] || 0;
                    const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                    return (
                        <div key={opt}>
                            <div className="flex justify-between text-[14px] font-bold uppercase mb-2">
                                <span className={count > 0 ? 'text-zinc-200' : 'text-zinc-700'}>{opt}</span>
                                <span className="text-xs font-black text-emerald-500">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-2 overflow-hidden border rounded-full bg-zinc-900 border-zinc-800">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                                    style={{ width: `${pct}%` }}
                                ></div>
                            </div>
                        </div>
                    )
                })}
             </div>
             
             <div className="p-6 text-center border border-dashed bg-zinc-900/30 border-zinc-800 rounded-2xl">
                <p className="text-[10px] text-zinc-400 font-bold uppercase animate-pulse tracking-[0.2em]">
                  Incoming Transmission Standby... 
                </p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};