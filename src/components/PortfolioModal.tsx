import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { X, PieChart } from "lucide-react";

type Stock = {
  symbol: string;
  name: string;
  current_price: number;
};

export const PortfolioModal = ({
  team,
  onClose,
}: {
  team: any;
  onClose: () => void;
}) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPortfolio = async () => {
      setLoading(true);

      /** 1️⃣ Fetch all stocks */
      const { data: stockData } = await supabase
        .from("stock_prices")
        .select("symbol, name, current_price");

      if (!stockData) return;

      setStocks(stockData);

      /** 2️⃣ Initialize holdings */
      const holdingMap: Record<string, number> = {};
      stockData.forEach((s) => (holdingMap[s.symbol] = 0));

      /** 3️⃣ Fetch transactions */
      const { data: txs } = await supabase
        .from("transactions")
        .select("asset_id, amount")
        .eq("team_id", team.id);

      txs?.forEach((t) => {
        if (holdingMap[t.asset_id] !== undefined) {
          holdingMap[t.asset_id] += t.amount;
        }
      });

      setHoldings(holdingMap);
      setLoading(false);
    };

    loadPortfolio();

    const sub = supabase
      .channel("portfolio-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_prices" },
        loadPortfolio
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [team.id]);

  /** Derived values */
  const stockValue = stocks.reduce(
    (sum, s) => sum + (holdings[s.symbol] || 0) * s.current_price,
    0
  );

  const netWorth = Number(team.balance) + stockValue;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-2 md:p-4">
      <div
        className="
          bg-zinc-950 border border-zinc-800 w-full md:max-w-lg
          rounded-t-[28px] md:rounded-[32px]
          overflow-hidden
          shadow-[0_0_100px_rgba(16,185,129,0.1)]
          animate-in slide-in-from-bottom duration-300
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b md:p-6 border-zinc-900 bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <PieChart className="text-emerald-500" size={18} />
            </div>
            <h2 className="text-xs font-black tracking-widest text-white uppercase md:text-sm">
              Asset_Inventory
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 transition rounded-full hover:bg-white/5"
          >
            <X size={18} className="text-red-800" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Net Worth */}
          <div className="py-3 text-center">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">
              Estimated_Net_Worth
            </p>

            <p className="mt-2 text-3xl font-black text-white md:text-5xl">
              ₹{netWorth.toLocaleString()}
            </p>

            <div className="flex flex-col items-center justify-center gap-4 mt-4 md:flex-row md:gap-6">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600">
                  Liquid_Cash
                </p>
                <p className="text-sm font-bold text-zinc-300">
                  ₹{Number(team.balance).toLocaleString()}
                </p>
              </div>

              <div className="hidden w-px h-8 md:block bg-zinc-800" />

              <div>
                <p className="text-xs font-bold uppercase text-zinc-600">
                  Stock_Equity
                </p>
                <p className="text-sm font-bold text-emerald-500">
                  ₹{stockValue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Asset Breakdown */}
          <div className="space-y-2">
            {stocks.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-3 transition border  md:p-4 bg-white/5 border-zinc-900 rounded-xl md:rounded-2xl hover:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 text-[10px] md:text-xs font-black uppercase bg-zinc-900 rounded-lg md:rounded-xl text-zinc-400">
                    {stock.symbol}
                  </div>

                  <div>
                    <p className="text-[10px] md:text-xs font-black uppercase text-emerald-500">
                      {stock.name}
                    </p>
                    <p className="text-xs font-bold md:text-sm text-zinc-400">
                      {holdings[stock.symbol] || 0} Shares
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-emerald-500">
                    ₹
                    {(
                      (holdings[stock.symbol] || 0) *
                      stock.current_price
                    ).toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-zinc-300">
                    Rate: ₹{stock.current_price}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 text-center border-t md:p-4 border-emerald-500/10 bg-emerald-500/5">
          <p className="text-[7px] md:text-[8px] text-emerald-500/50 font-bold uppercase tracking-widest">
            Live updates enabled via Market Oracle
          </p>
        </div>
      </div>
    </div>
  );
};
