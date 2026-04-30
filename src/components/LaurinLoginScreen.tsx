import React from 'react';
import { motion } from 'motion/react';

interface Props {
  handleLogin: () => void;
  loginAddr: string;
  setLoginAddr: (addr: string) => void;
  loginKey: string;
  setLoginKey: (key: string) => void;
}

export const LaurinLoginScreen: React.FC<Props> = ({ handleLogin, loginAddr, setLoginAddr, loginKey, setLoginKey }) => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      
      {/* Laurin Login Screen */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="z-50 w-full max-w-md"
      >
        <div className="bg-white dark:bg-black/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 px-8 py-8 rounded-3xl flex flex-col items-center gap-6 shadow-2xl">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xl font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.2em]">Laurin Login</span>
            <span className="text-xs text-blue-500 dark:text-blue-400/50 font-mono uppercase">v20.26.04.30</span>
          </div>
          
          <div className="w-full space-y-4">
            <input 
              type="text" 
              value={loginAddr}
              onChange={(e) => setLoginAddr(e.target.value)}
              placeholder="Adresa uzla"
              className="w-full bg-black/5 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white font-mono focus:border-blue-500/50 outline-none transition-all"
            />
            <input 
              type="password" 
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="Privátny kľúč"
              className="w-full bg-black/5 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white font-mono focus:border-blue-500/50 outline-none transition-all"
            />
          </div>

          <button 
            onClick={() => handleLogin()}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20"
          >
            Vstúpiť do Siete
          </button>
        </div>
      </motion.div>
    </div>
  );
};
