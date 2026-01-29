import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Medal, PartyPopper, Star } from 'lucide-react';

export const WinnersCircle = () => {
  const [winners, setWinners] = useState<any[]>([]);

  useEffect(() => {
    const fetchWinners = async () => {
      const { data } = await supabase.from('winners_circle').select('*').order('rank', { ascending: true });
      if (data) setWinners(data);
    };
    fetchWinners();
    
    const sub = supabase.channel('victory-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'winners_circle' }, fetchWinners).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  if (winners.length === 0) return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono text-zinc-800 uppercase tracking-[1em] animate-pulse">
        Calculating_Final_Results...
    </div>
  );

  // Helper to get podium styles
  const getPodiumConfig = (rank: number) => {
    if (rank === 1) return { color: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', size: 'h-80', icon: <Trophy size={48} /> };
    if (rank === 2) return { color: 'text-zinc-300', border: 'border-zinc-400/50', bg: 'bg-zinc-400/10', size: 'h-64', icon: <Medal size={40} /> };
    return { color: 'text-orange-500', border: 'border-orange-600/50', bg: 'bg-orange-600/10', size: 'h-52', icon: <Medal size={32} /> };
  };

  const first = winners.find(w => w.rank === 1);
  const second = winners.find(w => w.rank === 2);
  const third = winners.find(w => w.rank === 3);

  return (
    <div className="min-h-screen bg-[#020202] text-white font-mono p-6 flex flex-col items-center justify-center overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 mb-16 space-y-4 text-center">
        <div className="flex justify-center gap-2 mb-4">
            <Star className="text-yellow-500 animate-spin-slow" size={20} fill="currentColor" />
            <Star className="text-yellow-500 animate-spin-slow" size={20} fill="currentColor" />
            <Star className="text-yellow-500 animate-spin-slow" size={20} fill="currentColor" />
        </div>
        <h1 className="text-6xl italic font-black tracking-tighter uppercase text-neon">Champions Circle</h1>
        <p className="text-zinc-500 tracking-[0.5em] uppercase text-xs">Market Wars v1.0 // Final Resolution</p>
      </div>

      <div className="relative z-10 flex items-end w-full max-w-5xl gap-4 px-4">
        
        {/* SECOND PLACE */}
        {second && (
          <div className="flex flex-col items-center flex-1 duration-1000 delay-300 animate-in slide-in-from-bottom-20">
            <div className={`w-full ${getPodiumConfig(2).bg} border-x border-t ${getPodiumConfig(2).border} rounded-t-[40px] ${getPodiumConfig(2).size} flex flex-col items-center justify-start pt-10 px-4 text-center`}>
                <div className={getPodiumConfig(2).color}>{getPodiumConfig(2).icon}</div>
                <h3 className="w-full mt-4 text-xl font-black uppercase truncate">{second.team_name}</h3>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold">{second.founder_asset}</p>
                <div className="mt-auto mb-6 bg-white/10 px-4 py-1 rounded-full text-[10px] font-black">{second.vote_count} VOTES</div>
            </div>
          </div>
        )}

        {/* FIRST PLACE */}
        {first && (
          <div className="relative flex flex-col items-center flex-1 duration-1000 -top-10 animate-in slide-in-from-bottom-32">
            <PartyPopper className="absolute text-yellow-500 -top-12 animate-bounce" size={40} />
            <div className={`w-full ${getPodiumConfig(1).bg} border-x border-t ${getPodiumConfig(1).border} rounded-t-[50px] ${getPodiumConfig(1).size} flex flex-col items-center justify-start pt-12 px-4 text-center shadow-[0_-20px_50px_rgba(234,179,8,0.1)]`}>
                <div className={`${getPodiumConfig(1).color} drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]`}>{getPodiumConfig(1).icon}</div>
                <h3 className="w-full mt-4 text-3xl font-black tracking-tighter text-yellow-400 uppercase truncate">{first.team_name}</h3>
                <p className="mt-1 text-xs font-black tracking-widest uppercase text-yellow-500/50">{first.founder_asset}</p>
                <div className="px-6 py-2 mt-auto mb-8 text-xs font-black text-black bg-yellow-500 rounded-full shadow-lg">WINNER // {first.vote_count} VOTES</div>
            </div>
          </div>
        )}

        {/* THIRD PLACE */}
        {third && (
          <div className="flex flex-col items-center flex-1 duration-1000 delay-500 animate-in slide-in-from-bottom-16">
            <div className={`w-full ${getPodiumConfig(3).bg} border-x border-t ${getPodiumConfig(3).border} rounded-t-[40px] ${getPodiumConfig(3).size} flex flex-col items-center justify-start pt-10 px-4 text-center`}>
                <div className={getPodiumConfig(3).color}>{getPodiumConfig(3).icon}</div>
                <h3 className="w-full mt-4 text-lg font-black uppercase truncate">{third.team_name}</h3>
                <p className="text-[10px] text-zinc-600 mt-1 uppercase font-bold">{third.founder_asset}</p>
                <div className="mt-auto mb-6 bg-white/5 px-4 py-1 rounded-full text-[10px] font-black">{third.vote_count} VOTES</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-20 text-zinc-800 text-[10px] font-bold uppercase tracking-[0.5em] animate-pulse">
        System_Shutdown_Sequence_Initiated
      </div>
    </div>
  );
};