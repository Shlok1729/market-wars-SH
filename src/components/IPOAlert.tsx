import React from 'react';
import { Rocket, Star, ArrowUpRight, ShieldCheck } from 'lucide-react';

export const IPOAlert = () => {
  const ipos = [
    { name: 'QUANTUM LEAP AI', symbol: 'QNT', price: 100, sector: 'Deep Tech' },
    { name: 'SOLAR FLARE ENERGY', symbol: 'SLR', price: 65, sector: 'Green Energy' }
  ];

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center p-6 font-mono relative overflow-hidden">
      {/* Golden Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-[120px]"></div>

      <div className="z-10 w-full max-w-4xl space-y-10">
        <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 border rounded-full bg-yellow-500/10 border-yellow-500/20">
                <Star className="text-yellow-500 animate-spin-slow" size={14} fill="currentColor" />
                <span className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">New_Listing_Detected</span>
            </div>
            <h1 className="text-6xl italic font-black tracking-tighter text-white uppercase">IPO_ALERT</h1>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.4em]">Exchange Authority has approved 2 new high-value entities</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ipos.map(company => (
            <div key={company.symbol} className="bg-zinc-950 border-2 border-yellow-500/30 p-8 rounded-[40px] shadow-[0_0_50px_rgba(234,179,8,0.1)] hover:border-yellow-500 transition-all group">
                <div className="flex items-start justify-between mb-6">
                    <div className="p-3 text-black bg-yellow-500 rounded-2xl">
                        <Rocket size={24} />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">Listing_Price</p>
                        <p className="text-4xl font-black text-white">₹{company.price}</p>
                    </div>
                </div>

                <h3 className="mb-1 text-2xl font-black text-white uppercase">{company.name}</h3>
                <p className="mb-8 text-xs font-bold tracking-widest uppercase text-yellow-500/50">{company.sector} // ${company.symbol}</p>

                <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold uppercase py-3 border-t border-zinc-900">
                    <ShieldCheck size={14} className="text-emerald-500" /> Verified by Market Oracle
                </div>
            </div>
          ))}
        </div>

        <div className="pt-10 text-center">
            <p className="text-zinc-700 text-[10px] font-bold uppercase animate-pulse tracking-[0.5em]">
              Preparing Live Trading Floor... Get Ready
            </p>
        </div>
      </div>
    </div>
  );
};