import React, { useState } from 'react';
import { motion, useDragControls } from 'motion/react';
import { SPRING_PRESET } from '../constants';
import { X, Minus, Square, Grip } from 'lucide-react';

interface WindowProps {
  id: string;
  app: any;
  state: { isMaximized: boolean, isMinimized: boolean };
  zIndex: number;
  desktopRef: React.RefObject<HTMLDivElement>;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  toggleWindow: (id: string) => void;
  children: React.ReactNode;
}

export const Window: React.FC<WindowProps> = ({
  id,
  app,
  state,
  zIndex,
  desktopRef,
  focusWindow,
  minimizeWindow,
  toggleMaximize,
  toggleWindow,
  children
}) => {
  const dragControls = useDragControls();
  const [size, setSize] = useState({ width: 1000, height: 650 });

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSize({ width: window.innerWidth * 0.95, height: window.innerHeight * 0.8 });
      } else if (window.innerWidth < 1024) {
        setSize({ width: window.innerWidth * 0.8, height: window.innerHeight * 0.7 });
      } else {
        setSize({ width: 1000, height: 650 });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = window.innerWidth < 1024;

  return (
    <motion.div
      key={id}
      onPointerDownCapture={() => focusWindow(id)}
      drag={!state.isMaximized && !isMobile}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={desktopRef}
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, scale: 0.95, y: isMobile ? 100 : 20 }}
      animate={state.isMaximized || isMobile ? { 
        opacity: 1, 
        scale: 1, 
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        borderRadius: 0
      } : {
        opacity: 1, 
        scale: 1, 
        width: size.width,
        height: size.height,
        top: '50%',
        left: '50%',
        x: '-50%',
        y: '-50%',
        borderRadius: '1.2rem'
      }}
      exit={{ opacity: 0, scale: 0.95, y: isMobile ? 100 : 20 }}
      transition={{...SPRING_PRESET, duration: isMobile ? 0.5 : 0.4 }}
      className={`${(state.isMaximized || isMobile) ? 'fixed inset-0' : 'absolute shadow-[0_20px_50px_rgba(0,0,0,0.5)]'} bg-white/20 dark:bg-[#060606]/90 backdrop-blur-3xl flex flex-col overflow-hidden ${(state.isMaximized || isMobile) ? '' : 'border border-white/20 dark:border-white/10'}`}
      style={{ zIndex }}
    >
      {/* Window Header */}
      <div 
        onPointerDown={(e) => {
          if (!isMobile) {
            focusWindow(id);
            dragControls.start(e);
            e.stopPropagation();
          }
        }}
        className={`window-header flex items-center justify-between px-4 shrink-0 relative z-[100] transition-all duration-500 ${
          (state.isMaximized || isMobile) 
            ? 'h-14 pt-safe bg-white/5 dark:bg-black/40 border-b border-white/5' 
            : 'h-12 bg-gradient-to-b from-white/40 to-white/20 dark:from-white/10 dark:to-white/5 border-b border-white/10 cursor-grab active:cursor-grabbing'
        }`}>
        
        {/* Modern OS Window Controls (Left side) */}
        <div className="flex items-center w-1/3">
          {!isMobile && (
            <div className="flex items-center gap-2 group/controls p-2 -ml-1">
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => toggleWindow(id)} 
                className="w-3 h-3 rounded-full bg-red-400 border border-red-500/50 flex items-center justify-center transition-all"
                title="Close"
              >
                <X className="w-2 h-2 text-red-900 opacity-0 group-hover/controls:opacity-100" />
              </button>
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => minimizeWindow(id)} 
                className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500/50 flex items-center justify-center transition-all"
                title="Minimize"
              >
                <Minus className="w-2 h-2 text-amber-900 opacity-0 group-hover/controls:opacity-100" />
              </button>
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => toggleMaximize(id)} 
                className="w-3 h-3 rounded-full bg-green-400 border border-green-500/50 flex items-center justify-center transition-all"
                title={state.isMaximized ? "Restore" : "Maximize"}
              >
                <Square className="w-1.5 h-1.5 text-green-900 opacity-0 group-hover/controls:opacity-100" />
              </button>
            </div>
          )}
        </div>
        
        {/* Center: App Branding */}
        <div className="flex-1 flex justify-center items-center gap-2 pointer-events-none">
          <div className="w-5 h-5 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4 opacity-70">
            {app?.icon}
          </div>
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-200 tracking-wide truncate">
            {app?.name}
          </span>
        </div>

        {/* Right Side: Mobile control or blank */}
        <div className="flex items-center justify-end w-1/3 gap-4">
          {isMobile ? (
            <button 
              onClick={() => toggleWindow(id)}
              className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full active:scale-95 transition-all"
            >
              HOTOVO
            </button>
          ) : null}
        </div>
      </div>
      {/* Window Content */}
      <div className="flex-1 overflow-auto relative">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700 pointer-events-none" />
        
        <div className="relative z-10 h-full">
          {children}
        </div>
      </div>
      
      {!state.isMaximized && (
        <motion.div
          drag
          dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={(_, info) => {
            setSize(prev => ({
              width: Math.max(300, prev.width + info.delta.x),
              height: Math.max(200, prev.height + info.delta.y)
            }));
          }}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-900 dark:hover:text-white z-50"
        >
          <Grip className="w-4 h-4 rotate-45" />
        </motion.div>
      )}
    </motion.div>
  );
};
