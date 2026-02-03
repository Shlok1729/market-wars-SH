import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trophy, Wallet, BarChart3, TrendingUp } from 'lucide-react';

export const Phase1Results = ({ team }: { team: any }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [prices, setPrices] = useState<any>({});

  useEffect(() => {
    const fetchFinalData = async () => {
      // 1. Get Latest AI Prices
      const { data: pData } = await supabase.from('stock_prices').select('*');
      const pMap: any = {};
      pData?.forEach(p => pMap[p.symbol] = Number(p.current_price));
      setPrices(pMap);

      // 2. Get All Teams and All Transactions to calculate Net Worth
      const { data: allTeams } = await supabase.from('teams').select('*');
      const { data: allTxs } = await supabase.from('transactions').select('*');

      if (allTeams && allTxs) {
        const calculatedRankings = allTeams.map(t => {
            let stockEquity = 0;
            const myTxs = allTxs.filter(tx => tx.team_id === t.id);
            
            myTxs.forEach(tx => {
                const currentPrice = pMap[tx.asset_id] || 0;
                stockEquity += (tx.amount * currentPrice);
            });

            return {
                name: t.team_name,
                netWorth: Number(t.balance) + stockEquity,
                cash: Number(t.balance),
                equity: stockEquity
            };
        });

        // Sort by Net Worth
        setLeaderboard(calculatedRankings.sort((a, b) => b.netWorth - a.netWorth));
      }
    };

    fetchFinalData();
  }, [team.id]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-4 md:p-10">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* TOP HEADER */}
        <div className="space-y-2 text-center">
            <h1 className="flex items-center justify-center gap-3 text-4xl font-black tracking-tighter text-white">
                <Trophy className="text-yellow-500" size={32} />
                FINAL_MARKET_REPORT
            </h1>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.4em]">Equity Settlement & Vision Valuation Complete</p>
        </div>

        {/* CURRENT PRICES REVEAL */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Object.entries(prices).map(([symbol, price]: any) => (
                <div key={symbol} className="p-4 text-center border bg-zinc-900/30 border-zinc-800 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">{symbol}</p>
                    <p className="text-xl font-black text-emerald-400">₹{price.toFixed(2)}</p>
                </div>
            ))}
        </div>

        {/* THE LEADERBOARD */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl">
            <table className="w-full text-left">
                <thead className="bg-zinc-900/50 border-b border-zinc-800 text-[10px] text-zinc-500 font-black">
                    <tr>
                        <th className="p-6">RANK</th>
                        <th className="p-6">UNIT_IDENTIFIER</th>
                        <th className="p-6 -ml-10 ">TOTAL_NET_WORTH</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                    {leaderboard.map((t, idx) => (
                        <tr key={idx} className={`${t.name === team.team_name ? 'bg-emerald-500/5' : ''} group transition-colors`}>
                            <td className="p-6 font-black text-zinc-500">
                                {idx < 3 ? <span className="text-yellow-500">#0{idx+1}</span> : `#${idx+1}`}
                            </td>
                            <td className="p-6">
                                <p className="font-bold text-white uppercase transition-colors group-hover:text-emerald-400">{t.name}</p>
                                <div className="flex gap-3 text-[14px] text-zinc-400 mt-1 uppercase font-bold">
                                    <span>Cash: ₹{t.cash.toFixed(0)}</span>
                                    <span>Equity: ₹{t.equity.toFixed(0)}</span>
                                </div>
                            </td>
                            <td className="p-4 pr-10 text-center">
                                <p className="text-2xl font-black tracking-tighter text-white">
                                    ₹{t.netWorth.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* FINAL DE-BRIEF */}
        <div className="py-10 text-center">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest leading-relaxed">
                Market Closed // All Assets Liquidated // Thank you for participating in Market Wars v1.0
            </p>
        </div>
      </div>
    </div>
  );
};