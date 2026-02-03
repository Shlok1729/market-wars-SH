import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Medal, PartyPopper, Star, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const WinnersCircle = () => {
  const [winners, setWinners] = useState<any[]>([]);

  useEffect(() => {
    const fetchWinners = async () => {
      const { data } = await supabase.from('winners_circle').select('*').order('rank', { ascending: true });
      if (data) setWinners(data);
    };
    fetchWinners();
    
    const sub = supabase.channel('victory-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'winners_circle' }, fetchWinners)
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
  <div className="min-h-screen bg-[#020202] text-white font-mono px-4 sm:p-6 flex flex-col items-center justify-center overflow-hidden relative">

    {/* Background Glow */}
    <div className="
      absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
      w-[400px] h-[400px]
      sm:w-[600px] sm:h-[600px]
      md:w-[800px] md:h-[800px]
      bg-emerald-500/5 rounded-full blur-[100px] sm:blur-[120px]
      pointer-events-none
    " />

    {/* HEADER */}
    <div className="relative z-10 mb-10 space-y-3 text-center sm:mb-16 sm:space-y-4">
      <div className="flex justify-center gap-1 mb-2 sm:gap-2 sm:mb-4">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            className="text-yellow-500 animate-spin-slow"
            size={14}
            fill="currentColor"
          />
        ))}
      </div>

      <h1 className="text-3xl italic font-black tracking-tighter uppercase sm:text-5xl md:text-6xl text-neon">
        Champions Circle
      </h1>

      <p className="text-zinc-500 tracking-[0.3em] sm:tracking-[0.5em] uppercase text-[10px] sm:text-xs">
        Market Wars v1.0 // Final Resolution
      </p>
    </div>

    {/* PODIUM */}
    <div className="relative z-10 flex flex-col items-end w-full max-w-5xl gap-4 sm:flex-row">

      {/* SECOND */}
      {second && (
        <div className="flex flex-col items-center w-full sm:flex-1 animate-in slide-in-from-bottom-20">
          <div className={`w-full ${getPodiumConfig(2).bg} border-x border-t ${getPodiumConfig(2).border}
            rounded-t-3xl sm:rounded-t-[40px]
            h-[180px] sm:${getPodiumConfig(2).size}
            flex flex-col items-center pt-6 sm:pt-10 px-3 sm:px-4 text-center`}>
            <div className={getPodiumConfig(2).color}>{getPodiumConfig(2).icon}</div>
            <h3 className="w-full mt-2 text-sm font-black uppercase truncate sm:text-xl">
              2nd {second.team_name}
            </h3>
            <p className="text-[9px] sm:text-[10px] text-zinc-500 mt-1 uppercase font-bold">
              {second.founder_asset}
            </p>
            <div className="mt-auto mb-4 sm:mb-6 bg-white/10 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black">
              {second.vote_count} VOTES
            </div>
          </div>
        </div>
      )}

      {/* FIRST */}
      {first && (
        <div className="relative flex flex-col items-center w-full sm:flex-1 sm:-top-10 animate-in slide-in-from-bottom-32">
          <PartyPopper
            className="absolute text-yellow-500 -top-8 sm:-top-12 animate-bounce"
            size={28}
          />
          <div className={`w-full ${getPodiumConfig(1).bg} border-x border-t ${getPodiumConfig(1).border}
            rounded-t-4xl sm:rounded-t-[50px]
            h-[220px] sm:${getPodiumConfig(1).size}
            flex flex-col items-center pt-8 sm:pt-12 px-3 sm:px-4 text-center
            shadow-[0_-20px_50px_rgba(234,179,8,0.1)]`}>
            <div className={`${getPodiumConfig(1).color} drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]`}>
              {getPodiumConfig(1).icon}
            </div>
            <h3 className="w-full mt-2 text-lg font-black tracking-tighter text-yellow-400 uppercase truncate sm:mt-4 sm:text-3xl">
              1st {first.team_name}
            </h3>
            <p className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-yellow-500/50">
              {first.founder_asset}
            </p>
            <div className="px-4 sm:px-6 py-1.5 sm:py-2 mt-auto mb-5 sm:mb-8 text-[10px] sm:text-xs font-black text-black bg-yellow-500 rounded-full shadow-lg">
              WINNER // {first.vote_count} VOTES
            </div>
          </div>
        </div>
      )}

      {/* THIRD */}
      {third && (
        <div className="flex flex-col items-center w-full sm:flex-1 animate-in slide-in-from-bottom-16">
          <div className={`w-full ${getPodiumConfig(3).bg} border-x border-t ${getPodiumConfig(3).border}
            rounded-t-3xl sm:rounded-t-[40px]
            h-[160px] sm:${getPodiumConfig(3).size}
            flex flex-col items-center pt-6 sm:pt-10 px-3 sm:px-4 text-center`}>
            <div className={getPodiumConfig(3).color}>{getPodiumConfig(3).icon}</div>
            <h3 className="w-full mt-0 text-sm font-black uppercase truncate sm:text-lg">
              3rd {third.team_name}
            </h3>
            <p className="text-[9px] sm:text-[10px] text-zinc-600 mt-1 uppercase font-bold">
              {third.founder_asset}
            </p>
            <div className="mt-auto mb-4 sm:mb-6 bg-white/5 px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black">
              {third.vote_count} VOTES
            </div>
          </div>
        </div>
      )}
    </div>

    {/* FOOTER */}
    <div className="mt-12 sm:mt-20 text-zinc-800 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] animate-pulse">
      System_Shutdown_Sequence_Initiated
    </div>
  </div>
)

};