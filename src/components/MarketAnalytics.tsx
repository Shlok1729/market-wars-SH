import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BarChart3, TrendingUp, Users, Info } from 'lucide-react';

export const MarketAnalytics = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    // 1. Fetch Prices
    const { data: prices } = await supabase.from('stock_prices').select('*');
    
    // 2. Fetch All Transactions to calculate Total Investment (Global Volume)
    const { data: txs } = await supabase.from('transactions').select('asset_id, amount');

    if (prices && txs) {
      const stats = prices.map(stock => {
        const totalShares = txs
          .filter(t => t.asset_id === stock.symbol)
          .reduce((acc, curr) => acc + Number(curr.amount), 0);

        return {
          symbol: stock.symbol,
          name: stock.name,
          price: Number(stock.current_price),
          volume: totalShares
        };
      });

      // Sort by volume so the most invested company is first
      setData(stats.sort((a, b) => b.volume - a.volume));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();

    // Listen for trades or price changes to update the graph live
    const channel = supabase.channel('analytics-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_prices' }, fetchAnalytics)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center font-mono text-emerald-500 animate-pulse uppercase tracking-[0.5em]">Fetching_Market_Data...</div>;

  // Find max values to scale the bars correctly
  const maxVolume = Math.max(...data.map(d => d.volume), 1);
  const maxPrice = Math.max(...data.map(d => d.price), 1);

  return (
    <div className="min-h-screen bg-[#020202] text-white font-mono p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <div className="flex flex-col items-end justify-between pb-8 border-b md:flex-row border-zinc-900">
            <div className="max-w-full">
  <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter break-words  sm:gap-3 sm:text-3xl md:text-4xl">
    <BarChart3
      className="text-emerald-500 shrink-0"
      size={20}
    />

    <span className="leading-tight">
      MARKET_DEPTH
      <span className="block sm:inline">_ANALYTICS</span>
    </span>
  </h1>

  <p className="
    text-zinc-500
    text-[10px] sm:text-xs
    mt-2
    uppercase
    tracking-[0.25em] sm:tracking-[0.3em]
  ">
    Global Share Volume vs. Real-time Valuation
  </p>
</div>

            <div className="flex gap-6 mt-4 md:mt-0">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Share Volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-sm"></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Stock Price</span>
                </div>
            </div>
        </div>

        {/* BARS GRID */}
        <div className="grid grid-cols-1 gap-10">
          {data.map((item) => (
            <div key={item.symbol} className="group">
              <div className="flex items-end justify-between mb-4">
                <div>
                    <h3 className="text-xl font-black tracking-tight text-white uppercase transition-colors group-hover:text-emerald-400">
                        {item.name}
                    </h3>
                    <p className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Entity_ID: ${item.symbol}</p>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <p className="text-[8px] text-zinc-500 uppercase font-bold">Invested_Shares</p>
                        <p className="text-lg font-black text-white">{item.volume.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[8px] text-zinc-500 uppercase font-bold">Current_Rate</p>
                        <p className="text-lg font-black text-indigo-400">₹{item.price.toFixed(2)}</p>
                    </div>
                </div>
              </div>

              {/* THE GRAPH BARS */}
              <div className="space-y-3">
                {/* Volume Bar (Emerald) */}
                <div className="relative w-full h-4 overflow-hidden rounded-full bg-zinc-900/50">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        style={{ width: `${(item.volume / maxVolume) * 100}%` }}
                    ></div>
                </div>
                {/* Price Bar (Indigo) */}
                <div className="relative w-full h-2 overflow-hidden rounded-full bg-zinc-900/30">
                    <div 
                        className="h-full bg-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                        style={{ width: `${(item.price / maxPrice) * 100}%` }}
                    ></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* INSIGHT BOX */}
        <div className="flex items-start gap-4 p-6 mt-20 border bg-zinc-900/20 border-zinc-800 rounded-3xl">
            <Info className="text-zinc-600 shrink-0" size={20} />
            <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider">
                Note: A high <span className="text-emerald-500">Volume bar</span> compared to a low <span className="text-indigo-500">Price bar</span> indicates a highly crowded asset with potential scarcity risk. Strategic investors look for companies with rising prices but low volume.
            </p>
        </div>

      </div>
    </div>
  );
};