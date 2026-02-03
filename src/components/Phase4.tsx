import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mic2, Trophy, Lock, UserCheck, Flame, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export const Phase4 = ({ team }: { team: any }) => {
  const [finalists, setFinalists] = useState<any[]>([]);
  const [isVotingOpen, setIsVotingOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // 1. Get the 8 Finalists
    const { data: fData } = await supabase
      .from('teams')
      .select('id, team_name, founder_asset')
      .eq('is_finalist', true)
      .order('team_name', { ascending: true });
    
    setFinalists(fData || []);

    // 2. Check if Admin has opened the polls
    const { data: state } = await supabase.from('game_state').select('is_voting_open').eq('id', 1).single();
    setIsVotingOpen(state?.is_voting_open || false);

    // 3. Check if this team has already voted
    const { data: myVote } = await supabase
      .from('final_votes')
      .select('*')
      .eq('voter_team_id', team.id)
      .maybeSingle();
    
    setHasVoted(!!myVote);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Sync voting status if admin flips the switch
    const sub = supabase.channel('p4-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, (p) => {
        setIsVotingOpen(p.new.is_voting_open);
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
      
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleVote = async (targetId: string, targetName: string) => {
    if (targetId === team.id) {
        toast.error("VOTING_ERROR: Self-voting is prohibited.");
        return;
    }

    const confirm = window.confirm(`Confirm your final vote for ${targetName}? This cannot be undone.`);
    if (!confirm) return;

    const { error } = await supabase.from('final_votes').insert([{
      voter_team_id: team.id,
      finalist_team_id: targetId
    }]);

    if (error) {
      toast.error("VOTING_LOCKED: You have already cast your ballot.");
    } else {
      toast.success("VOTE_TRANSMITTED_SUCCESSFULLY");
      setHasVoted(true);
    }
  };

  if (loading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#020202] text-white font-mono p-4 md:p-10">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="mb-16 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 border rounded-full bg-emerald-500/10 border-emerald-500/20">
                <Flame className="text-emerald-500 animate-pulse" size={14} />
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest text-neon">Final_Resolution_Protocol</span>
            </div>
            <h1 className="text-5xl italic font-black tracking-tighter uppercase">The Boardroom Pitch</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.3em]">8 Finalists // 1 Ballot // No Self-Votes</p>
        </div>

        {/* FINALIST GRID */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {finalists.map((f) => (
            <div key={f.id} className={`group relative p-8 border-2 rounded-[32px] transition-all duration-500 ${f.id === team.id ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-900 bg-zinc-950/50 hover:border-zinc-700'}`}>
              
              {/* Founder Asset Badge */}
              <div className="absolute px-4 py-1 border rounded-full -top-3 right-8 bg-zinc-900 border-zinc-800">
                <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
                  Representing: <span className="ml-1 text-green-700">{f.founder_asset}</span>
                </p>
              </div>

              <div className="mb-8">
                <p className="text-[14px] text-zinc-600 font-bold uppercase mb-1">Finalist_Unit</p>
                <h3 className="text-3xl font-black tracking-tighter uppercase transition-colors group-hover:text-emerald-400">
                    {f.team_name}
                    {f.id === team.id && <span className="ml-2 text-xs text-emerald-500">(YOU)</span>}
                </h3>
              </div>

              {!isVotingOpen ? (
                <div className="flex items-center gap-2 text-zinc-700 text-[10px] font-black uppercase">
                    <Lock size={12} /> Voting_Encrypted_By_Admin
                </div>
              ) : (
                <button 
                  disabled={hasVoted || f.id === team.id}
                  onClick={() => handleVote(f.id, f.team_name)}
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    hasVoted 
                    ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800' 
                    : f.id === team.id 
                      ? 'bg-zinc-950 text-zinc-800 border border-zinc-900 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-emerald-500 active:scale-95 shadow-xl hover:shadow-emerald-500/20'
                  }`}
                >
                  {hasVoted ? 'Ballot_Submitted' : f.id === team.id ? 'Self_Voting_Disabled' : 'Cast_Global_Vote'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* BOTTOM DEBRIEF */}
        <div className="pt-10 mt-20 text-center border-t border-zinc-900">
            <p className="text-[10px] text-zinc-700 uppercase leading-loose max-w-lg mx-auto">
                All votes are final and anonymous. Finalist unit with the highest global sentiment score will be crowned the winner of Market Wars v1.0
            </p>
        </div>
      </div>
    </div>
  );
};