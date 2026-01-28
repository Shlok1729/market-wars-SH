import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './components/Login'
import { AdminGate } from './components/AdminGate'
import { Phase1 } from './components/Phase1'
import { Phase1Results } from './components/Phase1Results'
import { Phase2 } from './components/Phase2'
import { Admin } from './components/Admin'
import { BarChart3, LogOut,} from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { PortfolioModal } from './components/PortfolioModal'

function App() {
  const [showPortfolio, setShowPortfolio] = useState(false);
  // 1. Load everything from localStorage on startup
  const [team, setTeam] = useState<any>(null);
  const [view, setView] = useState<'game' | 'admin'>(() => {
    return (localStorage.getItem('market_wars_view') as 'game' | 'admin') || 'game';
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('admin_authenticated') === 'true';
  });
  const [loading, setLoading] = useState(true);

  // 2. Initial Session Check
  useEffect(() => {
    const checkSession = async () => {
      const savedTeamId = localStorage.getItem('market_wars_team_id');
      if (savedTeamId) {
        const { data } = await supabase.from('teams').select('*').eq('id', savedTeamId).maybeSingle();
        if (data) setTeam(data);
      }
      setLoading(false);
    };
    checkSession();
  }, []);
  // 3. Real-time Team Sync (With Force Logout Logic)
  useEffect(() => {
    if (!team) return;
    const channel = supabase.channel(`team-sync-${team.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${team.id}` }, (p) => {
        
        // --- NEW: THE KILL SWITCH ---
        if (p.new.status === 'eliminated') {
            localStorage.clear(); // Wipe their session
            setTeam(null); // Kick to login
            alert("TERMINAL_DEACTIVATED: Your team has been eliminated due to low performance.");
            window.location.reload(); // Refresh to clean state
            return;
        }
        // -----------------------------

        setTeam(p.new);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [team?.id]);

  // 3. Real-time Team Sync (Keeps Balance/Phase updated live)
// 3. AGGRESSIVE REAL-TIME SYNC
  useEffect(() => {
    if (!team?.id) return;

    console.log("INITIALIZING_REALTIME_LINK for Team:", team.team_name);

    const channel = supabase
      .channel(`sync-${team.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'teams', 
          filter: `id=eq.${team.id}` 
        },
        (payload) => {
          console.log("SERVER_PUSH_RECEIVED:", payload.new);
          
          // 1. Check for Elimination (Kill-switch)
          if (payload.new.status === 'eliminated') {
            localStorage.clear();
            setTeam(null);
            alert("TERMINAL_DEACTIVATED: You have been eliminated.");
            window.location.reload();
            return;
          }

          // 2. Update local state (This triggers the Phase change)
          setTeam(payload.new);
        }
      )
      .subscribe((status) => {
        console.log("Realtime Subscription Status:", status);
      });

    return () => {
      console.log("CLOSING_REALTIME_LINK");
      supabase.removeChannel(channel);
    };
  }, [team?.id]); // Re-run only if the Team ID changes

  // 4. Persistence Sync
  useEffect(() => {
    localStorage.setItem('market_wars_view', view);
  }, [view]);

  // --- HANDLERS ---
  const handleLogin = (data: any) => {
    localStorage.setItem('market_wars_team_id', data.id);
    setTeam(data);
  };

  const handleAdminSuccess = () => {
    setIsAdminAuthenticated(true);
    localStorage.setItem('admin_authenticated', 'true');
  };

  const handleLogout = () => {
    if(window.confirm("Terminate this session?")) {
        localStorage.clear(); // Clears Team ID, Admin Auth, and View
        setTeam(null);
        setIsAdminAuthenticated(false);
        setView('game');
        window.location.reload(); // Hard refresh to clean states
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500 font-mono tracking-[0.5em]">RESTORING_SESSION...</div>;

  // --- ADMIN ROUTING ---
  if (view === 'admin') {
    if (!isAdminAuthenticated) {
      return <AdminGate onSuccess={handleAdminSuccess} onCancel={() => setView('game')} />;
    }
    return <Admin onBack={() => setView('game')} />;
  }

  // --- TEAM ROUTING ---
  if (!team) {
    return <Login onLogin={handleLogin} onAdminClick={() => setView('admin')} />;
  }

  return (
    <div className="relative min-h-screen bg-black">
      <Toaster position="top-right" />
      <button 
        onClick={() => setShowPortfolio(true)}
        className="fixed bottom-6 right-6 z-[150] bg-emerald-500 text-black w-14 h-14 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
      >
        <BarChart3 size={24} className="transition-transform group-hover:rotate-12" />
        <span className="absolute -top-1 -right-1 bg-white text-[8px] font-black px-1.5 py-0.5 rounded-full">LIVE</span>
      </button>

      {/* 2. THE MODAL */}
      {showPortfolio && (
        <PortfolioModal team={team} onClose={() => setShowPortfolio(false)} />
      )}
      
      {/* GLOBAL HUD CONTROLS */}
      <div className="fixed top-4 right-4 z-[100] flex gap-2">
        {/* <button 
          onClick={() => setView('admin')} 
          className="p-2 transition-all border rounded-lg bg-zinc-900/80 backdrop-blur text-zinc-500 border-zinc-800 hover:text-emerald-500"
        >
          <Shield size={18} />
        </button> */}
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 px-3 py-2 transition-all border rounded-lg bg-zinc-900/80 backdrop-blur text-zinc-500 border-zinc-800 hover:text-rose-500"
        >
          <LogOut size={16} />
          <span className="text-[9px] font-black uppercase hidden md:inline">Terminate</span>
        </button>
      </div>

      {/* DYNAMIC CONTENT BY PHASE */}
      <div className="duration-700 animate-in fade-in">
        {team.phase === 1 && <Phase1 team={team} setTeam={setTeam} />}
        {team.phase === 11 && <Phase1Results team={team} />}
        {team.phase === 2 && <Phase2 team={team} setTeam={setTeam} />}
      </div>
    </div>
  );
}

export default App;