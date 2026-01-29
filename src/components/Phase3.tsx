import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AlertTriangle, Radio, Globe, Loader2 } from 'lucide-react';

export const Phase3 = () => {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = async () => {
    console.log("Checking for active chaos events...");
    
    // 1. Get the global index from Admin control
    const { data: state, error: stateError } = await supabase
      .from('game_state')
      .select('current_event_index')
      .eq('id', 1)
      .single();

    if (stateError || !state) {
      console.error("STATE_ERROR: Row with ID 1 might be missing in game_state table");
      setLoading(false);
      return;
    }

    const index = state.current_event_index;
    console.log("Current Event Index from DB:", index);

    // 2. Fetch the actual event text if index > 0
    if (index > 0) {
      const { data: eventData, error: eventError } = await supabase
        .from('phase3_events')
        .select('*')
        .eq('id', index)
        .maybeSingle();

      if (eventError) console.error("EVENT_FETCH_ERROR:", eventError.message);
      setEvent(eventData);
    } else {
      setEvent(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvent();

    // LISTEN FOR ADMIN CHANGES
    const channel = supabase.channel('phase3-sync')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'game_state', filter: 'id=eq.1' }, 
        (payload) => {
          console.log("Admin pushed update:", payload.new);
          fetchEvent();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen font-mono bg-black">
       <Loader2 className="mr-2 text-rose-500 animate-spin" />
       <span className="text-xs uppercase text-zinc-500">Connecting_To_News_Satellite...</span>
    </div>
  );

  // If Admin has not pushed an event yet (index is 0)
  if (!event) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 font-mono bg-black">
        <div className="space-y-4 text-center">
            <Globe className="mx-auto text-zinc-900 animate-pulse" size={64} />
            <h2 className="text-zinc-200 uppercase tracking-[0.5em] text-s">Waiting_For_Global_Broadcast...</h2>
            <p className="text-green-200  uppercase text-[20px]">Frequency: 144.800 MHz // Secure Connection</p>
        </div>
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-6 font-mono bg-black">
      <div className="w-full max-w-2xl duration-500 animate-in zoom-in-95">
        <div className="flex items-center justify-between px-4 py-1 text-xs font-black text-black bg-rose-600">
            <span className="flex items-center gap-2"><Radio size={14} /> LIVE_BREAKING_NEWS</span>
            <span>INTEL_FLIGHT_#{event.id}</span>
        </div>
        
        <div className="bg-zinc-950 border-x border-b border-rose-600/50 p-10 shadow-[0_0_100px_rgba(225,29,72,0.1)]">
            <AlertTriangle className="mb-6 text-rose-500" size={40} />
            <h1 className="mb-6 text-4xl font-black leading-none tracking-tighter text-white uppercase">
                {event.title}
            </h1>
            <p className="text-xl italic leading-relaxed uppercase text-zinc-400">
                "{event.description}"
            </p>
            
            <div className="flex items-center justify-between pt-8 mt-12 border-t border-zinc-900">
                <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                        <div key={i} className={`w-10 h-1 ${i <= event.id ? 'bg-rose-500' : 'bg-zinc-800'}`}></div>
                    ))}
                </div>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Volatility: EXTREME</p>
            </div>
        </div>
      </div>
    </div>
  );
};