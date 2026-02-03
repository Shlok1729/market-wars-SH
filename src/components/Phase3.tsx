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
      const newHistory: any = { lib: [10], piz: [10], gym: [10], inc: [10] };
      
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4 font-mono text-white bg-black">
      
      {/* 1. NEWS BOX */}
      <div className="w-full max-w-3xl duration-500 animate-in zoom-in-95">
        <div className="bg-rose-600 text-black px-4 py-1 flex justify-between items-center font-black text-[10px]">
            <span className="flex items-center gap-2 text-2xl tracking-widest"><Radio size={14} /> LIVE_BREAKING_NEWS</span>
            <span className='text-2xl'>SYSTEM_PULSE_STABLE</span>
        </div>
        <div className="bg-zinc-950 border-x border-b border-rose-600/30 p-10 shadow-[0_0_80px_rgba(225,29,72,0.1)]">
            <AlertTriangle className="mb-6 text-rose-600 animate-bounce" size={40} />
            <h1 className="mb-4 text-4xl font-black leading-none tracking-tighter text-white uppercase">{event.title}</h1>
            <p className="text-lg italic leading-relaxed uppercase text-zinc-400">"{event.description}"</p>
        </div>
      </div>

      {/* 2. LIVE GRAPH GRID */}
      <div className="grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
        {['lib', 'piz', 'gym', 'inc'].map((id) => {
           const prices = history[id];
           const current = prices[prices.length - 1];
           const previous = prices[prices.length - 2] || current;
           const isUp = current >= previous;

           return (
             <div key={id} className="flex flex-col justify-between p-4 border bg-zinc-900/30 border-zinc-800 rounded-2xl">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">{id}</p>
                    <div className={`flex items-center text-[10px] font-black ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                        {current > 0 ? (((current - previous)/previous)*100).toFixed(1) : 0}%
                    </div>
                </div>
                
                <p className="mb-4 text-2xl font-black text-white">₹{current.toFixed(1)}</p>
                
                {/* THE GRAPH */}
                <div className="mt-auto opacity-80">
                    <LiveChart data={prices} color={isUp ? '#10b981' : '#f43f5e'} />
                </div>
             </div>
           )
        })}
      </div>

    </div>
  );
};