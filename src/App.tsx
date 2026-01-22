import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './components/Login'
import { Phase1 } from './components/Phase1'
import { Phase2 } from './components/Phase2'
import { Admin } from './components/Admin'
import { Phase1Results } from './components/Phase1Results' // We will create this

function App() {
  const [team, setTeam] = useState<any>(null)
  const [view, setView] = useState<'game' | 'admin'>('game')

  useEffect(() => {
    if (!team) return;

    // Listen for changes to THIS team's data (Phase or Balance)
    const channel = supabase
      .channel(`team-sync-${team.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${team.id}` }, 
        (payload) => {
          console.log("Team Data Updated:", payload.new);
          setTeam(payload.new); // This triggers the phase switch automatically
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [team?.id]);

  if (view === 'admin') return <Admin onBack={() => setView('game')} />;

  if (!team) {
    return <Login onLogin={(data) => setTeam(data)} onAdminClick={() => setView('admin')} />
  }

  // PHASE ROUTING
  // phase 1: Investing
  // phase 1.5: Leaderboard & Scarcity Results (We use 11 as a code for 1.5)
  // phase 2: Prediction Market
  return (
    <>
      {team.phase === 1 && <Phase1 team={team} setTeam={setTeam} />}
      {team.phase === 11 && <Phase1Results team={team} />} 
      {team.phase === 2 && <Phase2 team={team} setTeam={setTeam} />}
    </>
  )
}

export default App