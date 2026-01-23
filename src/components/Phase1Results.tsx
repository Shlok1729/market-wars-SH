import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, TrendingUp, Users } from 'lucide-react';

export const Phase1Results = ({ team }: { team: any }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      // 1. Get Leaderboard
      const { data: teams } = await supabase.from('teams').select('team_name, balance').order('balance', { ascending: false });
      if (teams) setLeaderboard(teams);

      // 2. Get Global Asset Stats
      const { data: txs } = await supabase.from('transactions').select('asset_id, amount').eq('type', 'buy_equity');
      if (txs) {
    const counts: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
    txs.forEach(t => {
      if(counts[t.asset_id] !== undefined) counts[t.asset_id] += t.amount;
    });
    
    const totalPot = 10000; // Matches the SQL Pot
    const results = Object.keys(counts).map(key => ({
      id: key === 'lib' ? 'LIBRARY' : key === 'piz' ? 'PIZZA' : key === 'gym' ? 'GYM' : 'INCUBATOR',
      shares: counts[key],
      value: counts[key] > 0 ? (totalPot / counts[key]).toFixed(2) : "0.00"
    }));
        setStats(results);
      }
    };
    fetchResults();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* SECTION 1: SCARCITY REVEAL */}
        <section>
          <h1 className="flex items-center gap-2 mb-6 text-2xl font-black text-white">
            <TrendingUp className="text-emerald-500" /> MARKET_RESOLUTION_PHASE_01
          </h1>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map(s => (
              <div key={s.id} className="p-4 text-center border rounded bg-zinc-900/50 border-zinc-800">
                <p className="text-[10px] text-zinc-300">{s.id}</p>
                <p className="text-xl font-bold text-white">${s.value}</p>
                <p className="text-[12px] text-zinc-300 mt-1">{s.shares} TOTAL SHARES</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: LEADERBOARD */}
        <section className="overflow-hidden border rounded-lg bg-zinc-950 border-emerald-500/20">
          <div className="flex justify-between p-4 border-b bg-emerald-500/10 border-emerald-500/20">
            <h2 className="flex items-center gap-2 font-bold text-emerald-500">
              <Trophy size={18} /> GLOBAL_LEADERBOARD
            </h2>
            <span className="font-bold text-white">YOUR RANK: #{leaderboard.findIndex(t => t.team_name === team.team_name) + 1}</span>
          </div>
          <table className="w-full text-left">
            <thead className="text-[10px] text-white border-b border-zinc-900">
              <tr>
                <th className="p-4">RANK</th>
                <th className="p-4">TEAM_NAME</th>
                <th className="p-4 text-right">PURSE_VALUE</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((t, idx) => (
                <tr key={idx} className={`border-b border-zinc-900/50 ${t.team_name === team.team_name ? 'bg-emerald-500/5' : ''}`}>
                  <td className="p-4 text-zinc-500">#{idx + 1}</td>
                  <td className="p-4 font-bold text-white uppercase">{t.team_name}</td>
                  <td className="p-4 font-mono font-bold text-right text-emerald-400">
  ${Number(t.balance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        
        <p className="text-center text-zinc-600 text-[10px] animate-pulse">
          PREPARING FOR PHASE 02: THE OPINION MARKET... STAND BY
        </p>
      </div>
    </div>
  );
};