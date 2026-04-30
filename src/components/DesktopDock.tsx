import React from 'react';
import { motion } from 'motion/react';
import { Grid } from 'lucide-react';

interface DesktopDockProps {
  apps: any[];
  openWindows: string[];
  windowStates: Record<string, { isMaximized: boolean, isMinimized: boolean }>;
  toggleWindow: (id: string) => void;
  onAlignGrid?: () => void;
}

export const DesktopDock: React.FC<DesktopDockProps> = ({ apps, openWindows, windowStates, toggleWindow, onAlignGrid }) => {
  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 transform -translate-x-1/2 z-[70] glass-panel rounded-2xl p-2 flex items-center gap-2 shadow-2xl border border-white/10"
    >
      {onAlignGrid && (
        <button
          onClick={onAlignGrid}
          className="w-12 h-12 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all text-gray-400 hover:text-white"
          title="Zarovnať do mriežky"
        >
          <Grid className="w-6 h-6" />
        </button>
      )}
      <div className="w-px h-8 bg-white/10 mx-1" />
      {apps.filter(app => openWindows.includes(app.id)).map((app) => {
        const isOpen = openWindows.includes(app.id);
        const isMinimized = windowStates[app.id]?.isMinimized;
        const isActive = isOpen && !isMinimized;

        return (
          <motion.button
            key={app.id}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleWindow(app.id)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center relative transition-all ${
              isActive ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            title={app.name}
          >
            <div className="w-8 h-8">
              {React.cloneElement(app.icon as React.ReactElement, { className: "w-full h-full" } as any)}
            </div>
            {isOpen && (
              <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full shadow-[0_0_5px_white]" />
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
};
