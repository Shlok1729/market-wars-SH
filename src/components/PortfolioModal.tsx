import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Wallet, BarChart3, PieChart, TrendingUp } from 'lucide-react';

export const PortfolioModal = ({ team, onClose }: { team: any, onClose: () => void }) => {
  const [holdings, setHoldings] = useState<any>({ lib: 0, piz: 0, gym: 0, inc: 0 });
  const [prices, setPrices] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPortfolio = async () => {
      // 1. Fetch current AI prices
      const { data: pData } = await supabase.from('stock_prices').select('*');
      const priceMap: any = {};
      pData?.forEach(p => priceMap[p.symbol] = Number(p.current_price));
      setPrices(priceMap);

      // 2. Fetch team transactions to calculate holdings
      const { data: txs } = await supabase.from('transactions').select('asset_id, amount').eq('team_id', team.id);
      const h: any = { lib: 0, piz: 0, gym: 0, inc: 0 };
      txs?.forEach(t => {
        if(h[t.asset_id] !== undefined) h[t.asset_id] += t.amount;
      });
      setHoldings(h);
      setLoading(false);
    };

    loadPortfolio();

    // Listen for AI price updates while the modal is open
    const sub = supabase.channel('portfolio-sync').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_prices' }, loadPortfolio).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [team.id]);

  const stockValue = (holdings.lib * (prices.lib || 0)) + 
                     (holdings.piz * (prices.piz || 0)) + 
                     (holdings.gym * (prices.gym || 0)) + 
                     (holdings.inc * (prices.inc || 0));
  
  const netWorth = Number(team.balance) + stockValue;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(16,185,129,0.1)] animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
                <PieChart className="text-emerald-500" size={20} />
            </div>
            <h2 className="text-sm font-black tracking-widest text-white uppercase text-neon">Asset_Inventory</h2>
          </div>
          <button onClick={onClose} className="p-2 transition-colors rounded-full hover:bg-white/5">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* NET WORTH DISPLAY */}
          <div className="py-4 text-center">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-1">Estimated_Net_Worth</p>
            <p className="text-5xl font-black tracking-tighter text-white">
                ₹{netWorth.toLocaleString(undefined, {minimumFractionDigits: 0})}
            </p>
            <div className="flex justify-center gap-4 mt-4">
                <div className="text-left">
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">Liquid_Cash</p>
                    <p className="text-sm font-bold text-zinc-300">₹{Number(team.balance).toLocaleString()}</p>
                </div>
                <div className="w-px h-8 bg-zinc-800"></div>
                <div className="text-left">
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">Stock_Equity</p>
                    <p className="text-sm font-bold text-emerald-500">₹{stockValue.toLocaleString()}</p>
                </div>
            </div>
          </div>

          {/* ASSET BREAKDOWN */}
          <div className="space-y-2">
            {['lib', 'piz', 'gym', 'inc'].map(symbol => (
              <div key={symbol} className="flex items-center justify-between p-4 transition-all border bg-white/5 border-zinc-900 rounded-2xl group hover:border-zinc-700">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 text-xs font-black uppercase bg-zinc-900 rounded-xl text-zinc-500">
                        {symbol}
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase">{symbol === 'lib' ? 'Library' : symbol === 'piz' ? 'Pizza' : symbol === 'gym' ? 'Gym' : 'Incubator'}</p>
                        <p className="text-[10px] text-zinc-500 font-bold">{holdings[symbol]} Shares owned</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-black text-white">₹{(holdings[symbol] * (prices[symbol] || 0)).toLocaleString()}</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase">Rate: ₹{prices[symbol] || '0.00'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 text-center border-t bg-emerald-500/5 border-emerald-500/10">
            <p className="text-[8px] text-emerald-500/50 font-bold uppercase tracking-widest">
              Live updates enabled via Market Oracle
            </p>
        </div>
      </div>
    </div>
  );
};