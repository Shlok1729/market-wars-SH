import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onLogin: (team: any) => void;
  onAdminClick: () => void; // Added this
}

export const Login: React.FC<LoginProps> = ({ onLogin, onAdminClick }) => {
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('team_name', teamName)
      .eq('password', password)
      .maybeSingle();

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    if (!data) {
      alert("Invalid Credentials");
    } else {
      onLogin(data);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black font-mono">
      <div className="p-8 border border-zinc-800 bg-zinc-950 rounded-lg w-96 shadow-2xl shadow-emerald-500/10">
        <h1 className="text-xl font-bold text-white mb-6 text-center tracking-tighter uppercase">
          Market Wars Terminal
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">ID_INPUT</label>
            <input 
              type="text" placeholder="TEAM NAME" 
              className="w-full bg-black border border-zinc-800 p-2 text-white focus:border-emerald-500 outline-none transition-colors"
              value={teamName} onChange={e => setTeamName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">KEY_INPUT</label>
            <input 
              type="password" placeholder="ACCESS CODE" 
              className="w-full bg-black border border-zinc-800 p-2 text-white focus:border-emerald-500 outline-none transition-colors"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button className="w-full bg-white text-black font-bold py-3 hover:bg-emerald-500 transition-all active:scale-95">
            INITIALIZE SESSION
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-900 text-center">
          <button 
            onClick={onAdminClick}
            className="text-[10px] text-zinc-600 hover:text-emerald-500 transition-colors uppercase tracking-widest"
          >
            — Access Admin Console —
          </button>
        </div>
      </div>
    </div>
  );
};