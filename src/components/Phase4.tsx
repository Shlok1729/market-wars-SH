import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mic2, Lock, CheckCircle2, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export const Phase4 = ({ team }: { team: any }) => {
  const [finalists, setFinalists] = useState<any[]>([]);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const fetchData = async () => {
    // 1. Fetch Finalists
    const { data: fData } = await supabase.from('teams').select('id, team_name, assigned_pitch_asset').eq('is_finalist', true);
    
    // 2. Fetch stock names for the display
    const { data: pData } = await supabase.from('stock_prices').select('symbol, name');
    const nameMap: any = {};
    pData?.forEach(p => nameMap[p.symbol] = p.name);

    setFinalists(fData?.map(f => ({
        ...f,
        assetName: nameMap[f.assigned_pitch_asset] || 'Unknown'
    })) || []);

    // 3. Sync Voting State
    const { data: state } = await supabase.from('game_state').select('is_voting_open').eq('id', 1).single();
    setIsVotingOpen(state?.is_voting_open || false);

    // 4. Check if team voted
    const { data: myVote } = await supabase.from('final_votes').select('*').eq('voter_team_id', team.id).maybeSingle();
    setHasVoted(!!myVote);
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('election-sync').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, (p) => {
        setIsVotingOpen(p.new.is_voting_open);
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const castVote = async (targetId: string) => {
    if (targetId === team.id) return toast.error("You cannot vote for your own pitch!");
    
    const { error } = await supabase.from('final_votes').insert([{
      voter_team_id: team.id,
      finalist_team_id: targetId
    }]);

    if (error) toast.error("Error casting vote");
    else {
      toast.success("VOTE RECORDED");
      setHasVoted(true);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 font-mono text-white bg-black">
      <div className="w-full max-w-4xl py-10">
        <div className="mb-12 text-center">
            <Mic2 className="mx-auto mb-4 text-emerald-500" size={48} />
            <h1 className="text-4xl italic font-black tracking-tighter uppercase">The Grand Election</h1>
            <p className="text-zinc-500 text-[10px] mt-2 tracking-[0.4em] uppercase">Phase 4: Pitching & Popularity Ballot</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {finalists.map((f) => (
            <div key={f.id} className={`p-6 border-2 rounded-3xl transition-all ${f.id === team.id ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-900 bg-zinc-950'}`}>
              <p className="text-[10px] text-zinc-600 font-black uppercase mb-1">Finalist Unit</p>
              <h3 className="mb-4 text-xl font-black text-white uppercase">{f.team_name} {f.id === team.id && "(YOU)"}</h3>
              
              <div className="p-4 mb-6 border bg-white/5 rounded-2xl border-white/5">
                 <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">Assigned Stock</p>
                 <p className="text-sm font-bold text-zinc-300">{f.assetName}</p>
              </div>

              {!isVotingOpen ? (
                <div className="text-[9px] text-zinc-700 font-bold uppercase flex items-center gap-2">
                    <Lock size={12}/> Waiting for Admin to open polls...
                </div>
              ) : (
                <button 
                  disabled={hasVoted || f.id === team.id}
                  onClick={() => castVote(f.id)}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    hasVoted ? 'bg-zinc-800 text-zinc-600' : f.id === team.id ? 'bg-zinc-900 text-zinc-800' : 'bg-white text-black hover:bg-emerald-500'
                  }`}
                >
                  {hasVoted ? 'Ballot Cast' : f.id === team.id ? 'Self Voting Prohibited' : 'Vote for Pitch'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};