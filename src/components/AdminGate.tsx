import React, { useState } from 'react';
import { ShieldAlert, Lock, ChevronRight } from 'lucide-react';

export const AdminGate = ({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) => {
  const [code, setCode] = useState('');
  const MASTER_CODE = "soja3.14jake"; // Change this to your secret code!

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === MASTER_CODE) {
      onSuccess();
    } else {
      alert("ACCESS_DENIED: INVALID_MASTER_CODE");
      setCode('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 font-mono bg-black">
      <div className="max-w-sm w-full bg-zinc-950 border border-red-900/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(153,27,27,0.1)]">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 mb-4 border rounded-full bg-red-900/20 border-red-900/50">
            <ShieldAlert className="text-red-600 animate-pulse" size={32} />
          </div>
          <h1 className="font-black tracking-widest text-center text-white uppercase">System_Entry_Required</h1>
          <p className="text-[10px] text-zinc-500 mt-2 text-center uppercase">God_Mode_Is_Restricted</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 flex items-center left-3 text-zinc-600">
              <Lock size={14} />
            </div>
            <input 
              type="password"
              autoFocus
              placeholder="ENTER_MASTER_CODE"
              className="w-full py-3 pl-10 pr-4 text-xs text-white transition-all bg-black border rounded-lg outline-none border-zinc-800 focus:border-red-600 placeholder:text-zinc-800"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          
          <button className="flex items-center justify-center w-full gap-2 py-3 text-xs font-black text-red-500 transition-all border rounded-lg bg-red-900/20 border-red-900/50 hover:bg-red-600 hover:text-white">
            INITIALIZE_SUDO <ChevronRight size={14} />
          </button>
        </form>

        <button 
          onClick={onCancel}
          className="w-full mt-6 text-[9px] text-zinc-600 uppercase font-bold hover:text-zinc-400 transition-colors"
        >
          — Abort_And_Return —
        </button>
      </div>
    </div>
  );
};