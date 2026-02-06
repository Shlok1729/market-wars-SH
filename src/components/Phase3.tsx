import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AlertTriangle, Radio, Globe, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- MINI GRAPH COMPONENT ---
const LiveChart = ({ data, color }: { data: number[], color: string }) => {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const min = Math.min(...data) * 0.9;
    const max = Math.max(...data) * 1.1;
    const range = max - min;
    const width = 200;
    const height = 60;

    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(" ");
  }, [data]);

  return (
    <svg width="100%" height="60" viewBox="0 0 200 60" className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        points={points}
        className="transition-all duration-1000 ease-in-out"
      />
    </svg>
  );
};

export const Phase3 = () => {
  const [event, setEvent] = useState<any>(null);
  const [history, setHistory] = useState<any>({ lib: [10], piz: [10], gym: [10], inc: [10] });

const fetchData = async () => {
  console.log("PHASE_3: Fetching Global Broadcast Data...");

  try {
    // 1. Fetch Global Index from game_state
    const { data: state, error: stateError } = await supabase
      .from('game_state')
      .select('current_event_index')
      .eq('id', 1)
      .single();

    // FIXED: The "null check" guard
    if (stateError || !state) {
      console.error("STATE_ERROR: game_state row with ID 1 is missing.");
      return;
    }

    const index = state.current_event_index;

    // 2. Fetch the actual Event Text if an event is active
    if (index > 0) {
      const { data: eventData } = await supabase
        .from('phase3_events')
        .select('*')
        .eq('id', index)
        .maybeSingle();
      setEvent(eventData);
    } else {
      setEvent(null);
    }

    // 3. Fetch Price Logs to build the graph
    const { data: logs } = await supabase
      .from('price_logs')
      .select('*')
      .order('created_at', { ascending: true });

    if (logs && logs.length > 0) {
      const newHistory: any = { sft: [10], hog: [10], ecs: [10], atl: [10] };
      
      logs.forEach(log => {
        if (newHistory[log.asset_id]) {
          newHistory[log.asset_id].push(Number(log.price));
        }
      });
      
      // Limit to last 15 points per asset so graph doesn't get too crowded
      Object.keys(newHistory).forEach(key => {
        newHistory[key] = newHistory[key].slice(-15);
      });
      
      setHistory(newHistory);
    }
  } catch (err) {
    console.error("PHASE_3_CRITICAL_ERROR:", err);
  }
};

  useEffect(() => {
    fetchData();

    // LISTEN FOR UPDATES
    const channel = supabase.channel('chaos-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, fetchData)
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_logs' }, (p) => {
          setHistory((prev: any) => ({
              ...prev,
              [p.new.asset_id]: [...prev[p.new.asset_id], Number(p.new.price)].slice(-15) // Keep last 15 points
          }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!event) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 font-mono bg-black">
        <Globe className="mb-4 text-zinc-800 animate-pulse" size={64} />
        <p className="text-zinc-600 uppercase tracking-[0.5em] text-xs">Waiting_For_Global_Broadcast...</p>
    </div>
  );

  return (
  <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-3 font-mono text-white bg-black md:gap-8 md:p-4">

    {/* 1. NEWS BOX */}
    <div className="w-full max-w-3xl duration-500 animate-in zoom-in-95">
      <div className="bg-rose-600 text-black px-3 md:px-4 py-1 flex flex-col sm:flex-row justify-between items-start sm:items-center font-black text-[9px] sm:text-[10px] gap-1 sm:gap-0">
        <span className="flex items-center gap-2 text-lg tracking-widest sm:text-2xl">
          <Radio size={12} className="sm:hidden" />
          <Radio size={14} className="hidden sm:block" />
          LIVE_BREAKING_NEWS
        </span>
        <span className="text-sm sm:text-2xl">SYSTEM_PULSE_STABLE</span>
      </div>

      <div className="bg-zinc-950 border-x border-b border-rose-600/30 p-5 sm:p-8 md:p-10 shadow-[0_0_80px_rgba(225,29,72,0.1)]">
        <AlertTriangle
          className="mb-4 sm:mb-6 text-rose-600 animate-bounce"
          size={28}
        />

        <h1 className="mb-3 text-xl font-black leading-tight tracking-tighter uppercase sm:mb-4 sm:text-3xl md:text-4xl">
          {event.title}
        </h1>

        <p className="text-sm italic leading-relaxed uppercase sm:text-base md:text-lg text-zinc-400">
          "{event.description}"
        </p>
      </div>
    </div>

    {/* 2. LIVE GRAPH GRID */}
    
  </div>
)

};