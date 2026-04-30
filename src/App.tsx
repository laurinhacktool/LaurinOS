import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Battery, BatteryCharging, CloudSun, X, Minus, Square, Lock, Loader2, LogOut, MessageSquare, BarChart2, Shield, Zap, Code, Terminal, MessageCircle, LayoutGrid, Activity, Radar, Grid, Maximize2, Users, Search, Brain, Clock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { NetworkVisualizer } from './components/NetworkVisualizer';
import LauCoinApp from './LauCoinApp';
import { LaurinChatApp } from './components/LaurinChatApp';
import BeCreativeApp from './BeCreativeApp';
import GenericApp from './GenericApp';
import { MessengerApp } from './components/MessengerApp';
import { SystemInfoApp } from './components/SystemInfoApp';
import { NetworkStatsChart } from './components/NetworkStatsChart';
import { KernelLogsApp } from './components/KernelLogsApp';
import { Window } from './components/Window';
import { OSINTApp } from './components/OSINTApp';
import { ActiveUsersWidget } from './components/ActiveUsersWidget';
import { auth, db, onAuthStateChanged } from './firebase';
import { AuthScreen } from './components/AuthScreen';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { SNAPPY_SPRING } from './constants';

interface AppInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  prompt: string;
  hash: string;
  config: {
    name: string;
    description: string;
    uiType: string;
    color: string;
    html_payload?: string;
  };
}

// --- Stable Components Outside App ---

interface DynamicIslandContentProps {
  isRateLimited: boolean;
  isAnyMaximized: boolean;
  activeMaximizedApp: AppInfo | undefined;
  time: Date;
  isSubIslandOpen: boolean;
  setIsSubIslandOpen: (val: boolean) => void;
  isExpanding: boolean;
  expansionProgress: number;
  ips: number;
  ticks: number;
}

const DynamicIslandContent = ({
  isRateLimited,
  isAnyMaximized,
  activeMaximizedApp,
  time,
  isSubIslandOpen,
  setIsSubIslandOpen,
  isExpanding,
  expansionProgress,
  ips,
  ticks
}: DynamicIslandContentProps) => (
  <div className="flex items-center justify-center h-full w-full relative">
    <AnimatePresence>
      {isRateLimited && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: -10 }}
          className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-[9px] font-bold mr-2"
        >
          <Zap className="w-2.5 h-2.5 animate-pulse" />
          429
        </motion.div>
      )}
    </AnimatePresence>
    <div className="flex items-center gap-3">
      {/* Kernel Activity (Heartbeat) */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
        <div className={`w-1.5 h-1.5 rounded-full ${ips > 0 ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]' : 'bg-gray-700'}`} />
        <span className="text-[9px] font-bold text-blue-400/80 font-mono tracking-tighter">
          {ips > 999 ? `${(ips/1000).toFixed(1)}k` : ips}
        </span>
      </div>

      <div 
        className="flex items-center gap-4 transition-all duration-500"
        style={isAnyMaximized ? {
          textShadow: `0 0 8px ${activeMaximizedApp?.config.color || '#ffffff'}88`
        } : {}}
      >
        {/* 1. Time (Visible on desktop, moves to sub-island when maximized) */}
        {!isAnyMaximized && (
          <motion.div 
            key="desktop-time"
            layoutId="system-time"
            className="tracking-widest font-bold text-[10px] w-[70px] text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
          </motion.div>
        )}
        
        {/* 2. L (Toggle) - Hidden when maximized */}
        {!isAnyMaximized && (
          <div 
            onClick={() => setIsSubIslandOpen(!isSubIslandOpen)}
            className={`text-lg font-black px-1 cursor-pointer transition-colors drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] ${isSubIslandOpen ? 'text-purple-500' : 'text-white hover:text-purple-400'}`}
          >
            L
          </div>
        )}

        {/* 3. Notch Space */}
        <div className="w-16 h-4" />

        {/* 4. Date */}
        <div className="text-[10px] opacity-60 tracking-wider whitespace-nowrap">{time.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
      </div>

      {/* Kernel Ticks */}
      <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
        <span className="text-[8px] text-purple-400/60 font-bold uppercase tracking-widest">Ticks</span>
        <span className="text-[9px] font-bold text-purple-400/80 font-mono tracking-tighter">
          {ticks > 999999 ? `${(ticks/1000000).toFixed(1)}M` : ticks > 999 ? `${(ticks/1000).toFixed(1)}k` : ticks}
        </span>
      </div>
    </div>

    {isExpanding && (
      <div className="flex items-center gap-2 px-2 border-x border-white/10 mx-1">
        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${expansionProgress}%` }}
          />
        </div>
        <span className="text-[8px] font-bold text-purple-400">{expansionProgress}%</span>
      </div>
    )}
  </div>
);

// Removed duplicate import after moving to top

interface SubIslandContentProps {
  setShowExpansionConfirm: (val: boolean) => void;
  isExpanding: boolean;
  toggleWindow: (id: string) => void;
  openWindows: string[];
  windowStates: Record<string, any>;
  unreadCount: number;
  setIsWidgetVisible: (val: boolean) => void;
  isWidgetVisible: boolean;
  setShowLogoutConfirm: (val: boolean) => void;
  setIsActiveUsersVisible: (val: boolean) => void;
  isActiveUsersVisible: boolean;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  isStandalone: boolean;
}

  const SubIslandContent = ({
  setShowExpansionConfirm,
  isExpanding,
  toggleWindow,
  openWindows,
  windowStates,
  unreadCount,
  setIsWidgetVisible,
  isWidgetVisible,
  setShowLogoutConfirm,
  setIsActiveUsersVisible,
  isActiveUsersVisible,
  setShowSystemHub,
  toggleFullscreen,
  isFullscreen,
  isStandalone
}: SubIslandContentProps & { setShowSystemHub: (val: boolean) => void }) => (
  <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-4 text-xs font-medium text-slate-200 transition-all duration-300">
    {/* 1. Brain */}
    <button 
      onClick={() => setShowExpansionConfirm(true)}
      disabled={isExpanding}
      className={`transition-all flex items-center gap-1 ${isExpanding ? 'text-purple-400' : 'text-gray-400 hover:text-purple-300'}`}
      title="Spustiť expanziu sémantickej siete"
    >
      <LucideIcons.Brain className={`w-3.5 h-3.5 ${isExpanding ? 'animate-spin' : ''}`} />
    </button>

    {!isStandalone && (
      <button 
        onClick={toggleFullscreen}
        className={`transition-all ${isFullscreen ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
        title={isFullscreen ? "Ukončiť Fullscreen" : "Vstúpiť do Fullscreen"}
      >
        {isFullscreen ? <LucideIcons.Minimize2 className="w-3.5 h-3.5" /> : <LucideIcons.Maximize2 className="w-3.5 h-3.5" />}
      </button>
    )}

    {/* 2. Messenger */}
    <button 
      onClick={() => toggleWindow('messenger')}
      className={`relative text-gray-400 hover:text-white transition-colors ${openWindows.includes('messenger') && !windowStates['messenger']?.isMinimized ? 'text-purple-400' : ''}`}
      title="Messenger"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-lg border border-[#0a0a0a]">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>

    {/* 3. Free space with separator */}
    <div className="w-px h-3 bg-white/20 mx-1" />

    {/* 4. System Hub */}
    <button 
      onClick={() => setShowSystemHub(true)}
      className="text-gray-400 hover:text-blue-400 transition-colors"
      title="Systémové Jadro"
    >
      <LucideIcons.Settings className="w-3.5 h-3.5" />
    </button>

    {/* 3.5 Active Users */}
    <button 
      onClick={() => setIsActiveUsersVisible(!isActiveUsersVisible)}
      className={`transition-colors ${isActiveUsersVisible ? 'text-blue-400' : 'text-gray-400 hover:text-blue-300'}`}
      title="Aktívni používatelia"
    >
      <Users className="w-3.5 h-3.5" />
    </button>

    {/* 5. Widget */}
    <button 
      onClick={() => setIsWidgetVisible(!isWidgetVisible)}
      className={`transition-colors ${isWidgetVisible ? 'text-green-500' : 'text-gray-400 hover:text-green-400'}`}
      title="Senzory Widget"
    >
      <Activity className="w-3.5 h-3.5" />
    </button>

    {/* 6. Logout */}
    <button 
      onClick={() => setShowLogoutConfirm(true)}
      className="text-gray-400 hover:text-red-400 transition-colors"
      title="Vypnúť"
    >
      <LogOut className="w-3.5 h-3.5" />
    </button>
  </div>
);

// --- End Stable Components ---

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lau_theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lau_theme', theme);
  }, [theme]);

  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024);
      const isStandaloneMode = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(isStandaloneMode);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const toggleFullscreen = () => {
    const doc = document.documentElement as any;
    const documentAny = document as any;

    if (!documentAny.fullscreenElement && !documentAny.webkitFullscreenElement) {
      if (doc.requestFullscreen) {
        doc.requestFullscreen();
      } else if (doc.webkitRequestFullscreen) {
        doc.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (documentAny.exitFullscreen) {
        documentAny.exitFullscreen();
      } else if (documentAny.webkitExitFullscreen) {
        documentAny.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const documentAny = document as any;
      setIsFullscreen(!!(documentAny.fullscreenElement || documentAny.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleRateLimit = (e: any) => {
      console.log('Gemini rate limit hit event received:', e.detail);
      setIsRateLimited(true);
      setTimeout(() => setIsRateLimited(false), 10000);
    };
    window.addEventListener('gemini_rate_limit_hit', handleRateLimit);
    return () => window.removeEventListener('gemini_rate_limit_hit', handleRateLimit);
  }, []);
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [apps, setApps] = useState<AppInfo[]>([
    { id: 'laucoin', name: 'LauCoin', icon: <LucideIcons.Coins className="w-10 h-10 text-blue-400" />, prompt: '', hash: '', config: { name: 'LauCoin', description: '', uiType: 'list', color: '#3b82f6' } },
    { id: 'lau_chat', name: 'Lau Chat', icon: <Terminal className="w-10 h-10 text-blue-400" />, prompt: '', hash: '', config: { name: 'Lau Chat', description: '', uiType: 'chat', color: '#3b82f6' } },
    { id: 'becreative', name: 'Be Creative', icon: <Zap className="w-10 h-10 text-amber-400" />, prompt: '', hash: '', config: { name: 'Be Creative', description: '', uiType: 'list', color: '#f59e0b' } },
    { id: 'messenger', name: 'Messenger', icon: <MessageCircle className="w-10 h-10 text-purple-400" />, prompt: '', hash: '', config: { name: 'Messenger', description: '', uiType: 'chat', color: '#a855f7' } },
    { id: 'system', name: 'Systémové Centrum', icon: <Activity className="w-10 h-10 text-emerald-400" />, prompt: '', hash: '', config: { name: 'Systémové Centrum', description: 'Monitorovanie sensorov a HW bridge', uiType: 'dashboard', color: '#10b981' } },
    { id: 'kernel', name: 'Kernel Logs', icon: <Terminal className="w-10 h-10 text-slate-400" />, prompt: '', hash: '', config: { name: 'Kernel Logs', description: 'System Kernel Logs', uiType: 'dashboard', color: '#94a3b8' } },
    { id: 'lookup', name: 'Hacker Lookup', icon: <Search className="w-10 h-10 text-red-500" />, prompt: '', hash: '', config: { name: 'Hacker Lookup', description: 'Global Intelligence Grid', uiType: 'dashboard', color: '#ef4444' } },
  ]);

  const islandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIsSubIslandOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if ((navigator as any).getBattery) {
      (navigator as any).getBattery().then((bm: any) => {
        setBatteryLevel(Math.round(bm.level * 100));
        setIsCharging(bm.charging);
        bm.onlevelchange = () => setBatteryLevel(Math.round(bm.level * 100));
        bm.onchargingchange = () => setIsCharging(bm.charging);
      });
    }

    // Geolocation permission
    navigator.geolocation.getCurrentPosition(
      () => console.log('Geolocation permission granted'),
      (err) => console.log('Geolocation permission denied', err)
    );

    // Network Information API (Signal)
    if ((navigator as any).connection) {
      const conn = (navigator as any).connection;
      console.log('Network type:', conn.effectiveType);
      conn.onchange = () => console.log('Network changed:', conn.effectiveType);
    }
  }, []);

  const [isSubIslandOpen, setIsSubIslandOpen] = useState(false);
  const [showSystemHub, setShowSystemHub] = useState(false);
  
  // System Configuration State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<'gemini' | 'custom' | 'local'>('gemini');
  const [localModelPath, setLocalModelPath] = useState('');
  const [seeding, setSeeding] = useState(false);

  const [localModels, setLocalModels] = useState<string[]>([]);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/core-api/config');
      if (response.ok) {
        const data = await response.json();
        setGeminiApiKey(data.gemini_api_key || '');
        setCustomApiUrl(data.custom_api_url || '');
        setCustomApiKey(data.custom_api_key || '');
        setCustomModel(data.custom_model || '');
        setPreferredProvider(data.preferred_provider || 'gemini');
        setLocalModelPath(data.local_model_path || '');
        
        // Simulating file check for common uploaded models
        setLocalModels(['dolphin.gguf', 'llama3.gguf', 'mistral.gguf'].filter(m => data.local_model_path.includes(m)));
      } else {
        const text = await response.text();
        console.error("Failed to fetch config. Status:", response.status, "Body:", text);
      }
    } catch (err: any) {
      console.error("Failed to fetch config:", {
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('/core-api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gemini_api_key: geminiApiKey,
          custom_api_url: customApiUrl,
          custom_api_key: customApiKey,
          custom_model: customModel,
          preferred_provider: preferredProvider,
          local_model_path: localModelPath
        })
      });
      setShowSystemHub(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const seedNodes = async () => {
    setSeeding(true);
    await fetch('/core-api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'SEED_NODES' })
    });
    setSeeding(false);
  };

  const syncKernelWithCloud = async () => {
    setSeeding(true);
    await fetch('/core-api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'SYNC_CLOUD' })
    });
    setSeeding(false);
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const [windowStates, setWindowStates] = useState<Record<string, { isMaximized: boolean, isMinimized: boolean }> >({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [registers, setRegisters] = useState<Record<string, string>>({});
  const [ips, setIps] = useState(0);
  const [ticks, setTicks] = useState(0);
  const [showRegisters, setShowRegisters] = useState(false);
  const [cpuLoad, setCpuLoad] = useState(0);
  const [cpuTemp, setCpuTemp] = useState(42);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expansionProgress, setExpansionProgress] = useState(0);
  const [uptime, setUptime] = useState('00:00:00');
  const [widgetSize, setWidgetSize] = useState({ width: 240, height: 450 });
  const [isResizing, setIsResizing] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isActiveUsersVisible, setIsActiveUsersVisible] = useState(false);
  const [showExpansionConfirm, setShowExpansionConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [, setForceUpdate] = useState(0);

  useEffect(() => {
    const handleResize = () => setForceUpdate(prev => prev + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResizing = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (e: PointerEvent) => {
      const widget = document.getElementById('system-monitor-widget');
      if (widget) {
        const rect = widget.getBoundingClientRect();
        const newWidth = Math.max(200, e.clientX - rect.left);
        const newHeight = Math.max(200, e.clientY - rect.top);
        setWidgetSize({ width: newWidth, height: newHeight });
      }
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!currentUser) return;

    const key = `laurinos_first_login_${currentUser.email}`;
    let firstLogin = localStorage.getItem(key);
    
    if (!firstLogin) {
      firstLogin = Date.now().toString();
      localStorage.setItem(key, firstLogin);
    }

    const startTime = parseInt(firstLogin);

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      
      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      const parts = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
      ];

      setUptime(days > 0 ? `${days}d ${parts.join(':')}` : parts.join(':'));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Global Kernel Polling
  useEffect(() => {
    const fetchKernelStatus = async () => {
      try {
        const response = await fetch('/core-api/status', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            if (data && data.registers) setRegisters(data.registers);
            if (data && data.ips !== undefined) setIps(data.ips);
            if (data && data.ticks !== undefined) setTicks(data.ticks);
            
            if (data && typeof data.ips === 'number') {
              // Estimate CPU load based on IPS (max ~10000 IPS for 100%)
              const load = Math.min(100, Math.floor((data.ips / 10000) * 100));
              setCpuLoad(load);
              setCpuTemp(40 + Math.floor(load / 5));
            }
          } catch (parseErr) {
            console.error("App: Failed to parse kernel status JSON", parseErr);
          }
        } else if (response.ok) {
          console.warn("App: Kernel status returned non-JSON content type:", contentType);
        }
      } catch (err: any) {
        // Log more details to help diagnose "The string did not match the expected pattern"
        console.error("App: Failed to fetch kernel status", {
          message: err?.message,
          name: err?.name,
          code: err?.code,
          stack: err?.stack,
          url: '/core-api/status'
        });
      }
    };

    const interval = setInterval(fetchKernelStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const executeExpansion = async () => {
    if (isExpanding) return;
    setIsExpanding(true);
    setExpansionProgress(0);
    
    const duration = 5000;
    const steps = 50;
    const stepDuration = duration / steps;
    
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      setExpansionProgress(i * 2);
    }
    
    setIsExpanding(false);
    // Trigger a custom event for apps to listen to
    window.dispatchEvent(new CustomEvent('laurinos_expansion_complete'));
  };

  useEffect(() => {
    (window as any).ase = {
      ...(window as any).ase,
      execute_expansion: executeExpansion
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate CPU Load
      setCpuLoad(prev => {
        const target = Math.random() * 100;
        return prev + (target - prev) * 0.1;
      });
      
      // Simulate CPU Temp
      setCpuTemp(prev => {
        const target = 40 + (cpuLoad / 2) + (Math.random() * 5);
        return prev + (target - prev) * 0.1;
      });

      // Simulate Registers
      const newRegs: Record<string, string> = {};
      ['r1', 'r2', 'r3', 'r4'].forEach(r => {
        newRegs[r] = '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
      });
      setRegisters(newRegs);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const desktopRef = useRef<HTMLDivElement>(null);

  const isAnyMaximized = openWindows.some(id => windowStates[id]?.isMaximized && !windowStates[id]?.isMinimized);
  const activeMaximizedAppId = [...openWindows].reverse().find(id => windowStates[id]?.isMaximized && !windowStates[id]?.isMinimized);
  const activeMaximizedApp = apps.find(app => app.id === activeMaximizedAppId);

  const addApp = (newApp: AppInfo) => {
    setApps(prev => {
      if (prev.some(a => a.id === newApp.id)) return prev;
      return [...prev, newApp];
    });
  };

  const removeApp = (id: string) => {
    setApps(prev => prev.filter(app => app.id !== id));
  };

  const toggleWindow = (id: string) => {
    if (openWindows.includes(id)) {
      const isMinimized = windowStates[id]?.isMinimized;
      if (isMinimized) {
        setWindowStates(ws => ({ ...ws, [id]: { isMaximized: true, isMinimized: false } }));
        setOpenWindows(prev => [...prev.filter(w => w !== id), id]);
      } else {
        if (id === 'laucoin') sessionStorage.removeItem('lau_user');
        setOpenWindows(prev => prev.filter(w => w !== id));
      }
    } else {
      setWindowStates(ws => ({ ...ws, [id]: { isMaximized: true, isMinimized: false } }));
      setOpenWindows(prev => [...prev, id]);
    }
  };

  const focusWindow = (id: string) => {
    if (openWindows[openWindows.length - 1] !== id) {
      setOpenWindows(prev => [...prev.filter(w => w !== id), id]);
    }
  };

  const minimizeWindow = (id: string) => {
    setWindowStates(ws => ({ ...ws, [id]: { ...ws[id], isMinimized: true } }));
  };

  const toggleMaximize = (id: string) => {
    setWindowStates(ws => ({ ...ws, [id]: { ...ws[id], isMaximized: !ws[id]?.isMaximized } }));
  };

  const tileWindows = () => {
    const newWindowStates: Record<string, { isMaximized: boolean, isMinimized: boolean }> = {};
    openWindows.forEach(id => {
      newWindowStates[id] = { isMaximized: false, isMinimized: false };
    });
    setWindowStates(ws => ({ ...ws, ...newWindowStates }));
  };

  const resetLayout = () => {
    // 1. Reset icons
    arrangeIntoGrid();
    
    // 2. Reset windows: unminimize and maximize all
    const newWindowStates: Record<string, { isMaximized: boolean, isMinimized: boolean }> = {};
    openWindows.forEach(id => {
      newWindowStates[id] = { isMaximized: true, isMinimized: false };
    });
    setWindowStates(ws => ({ ...ws, ...newWindowStates }));
  };

  const showDesktop = () => {
    const newWindowStates: Record<string, { isMaximized: boolean, isMinimized: boolean }> = {};
    openWindows.forEach(id => {
      newWindowStates[id] = { ...windowStates[id], isMinimized: true };
    });
    setWindowStates(ws => ({ ...ws, ...newWindowStates }));
  };

  const arrangeIntoGrid = () => {
    const newPositions: Record<string, { x: number, y: number }> = {};
    const padding = 40; // Margin from edges
    const iconSize = 80; // Approximate icon size
    const gap = 30; // Gap between icons
    
    // Calculate columns based on window width
    const columns = Math.max(1, Math.floor((window.innerWidth - padding * 2) / (iconSize + gap)));

    apps.forEach((app, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      newPositions[app.id] = { 
        x: padding + col * (iconSize + gap), 
        y: padding + row * (iconSize + gap) 
      };
    });
    
    // No longer saving positions
  };

  // Removed iconPositions useEffect

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('receiverEmail', '==', currentUser.email),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching unread messages:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    console.log('currentUser changed:', currentUser);
  }, [currentUser]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          photoURL: user.photoURL
        };
        setIsAuthed(true);
        setCurrentUser(userData);
        sessionStorage.setItem('laurinos_user', JSON.stringify(userData));
      } else {
        setIsAuthed(false);
        setCurrentUser(null);
        sessionStorage.removeItem('laurinos_user');
      }
    });

    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    
    const unsubscribeApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const restoredApps = snapshot.docs.map(doc => {
        const entry = doc.data();
        const meta = entry.meta || { 
          name: `App_${(entry.hash_id || '').substring(0, 5)}`, 
          icon: "Code", 
          color: "#8b5cf6", 
          description: (entry.core_meaning || '').substring(0, 30) 
        };
        const DynamicIcon = (LucideIcons as any)[meta.icon] || Code;
        
        return {
          id: `app_${entry.hash_id}`,
          name: meta.name,
          icon: <DynamicIcon className="w-10 h-10" style={{ color: meta.color }} />,
          prompt: entry.core_meaning,
          hash: entry.hash_id,
          config: {
            name: meta.name,
            description: meta.description,
            uiType: meta.uiType || 'list',
            color: meta.color,
            html_payload: entry.html_payload
          }
        };
      });
      
      setApps(prev => {
        const existingIds = prev.map(a => a.id);
        const newApps = restoredApps.filter((a: any) => !existingIds.includes(a.id));
        return [...prev, ...newApps];
      });
    }, (error) => {
      console.error("Failed to restore apps from Semantic Ledger in Firestore", error);
    });

    return () => {
      unsubscribeApps();
    };
  }, [isAuthed]);

  const handleLogout = async () => {
    if (currentUser?.uid) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, { isOnline: false }, { merge: true });
      } catch (error) {
        console.error("Failed to update online status on logout", error);
      }
    }
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Firebase signOut error:", e);
    }
    setIsAuthed(false);
    setCurrentUser(null);
    sessionStorage.removeItem('laurinos_user');
    setOpenWindows([]);
  };

  const handlePowerOff = () => {
    handleLogout();
    setIsPoweredOn(false);
  };

  if (!isPoweredOn) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsPoweredOn(true)}
          className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group transition-all hover:bg-white/10 hover:border-white/30"
        >
          <div className="text-4xl font-black text-white/20 group-hover:text-white group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all">
            L
          </div>
        </motion.button>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <AuthScreen 
        onAuthSuccess={(userData) => {
          setIsAuthed(true);
          setCurrentUser(userData);
          sessionStorage.setItem('laurinos_user', JSON.stringify(userData));
        }}
        onPowerOff={handlePowerOff}
      />
    );
  }

  const version = "v20.26.04.30";

  return (
    <div ref={desktopRef} className={`relative w-full h-[100dvh] overflow-hidden text-white selection:bg-blue-500/40 selection:text-white bg-[#020617] ${theme}`}>
      {/* Immersive Glass Backgrounds */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={isAnyMaximized ? { scale: 1.1, filter: 'blur(40px)', opacity: 0.8 } : { scale: 1, filter: 'blur(0px)', opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-purple-950/40 to-black pointer-events-none" />
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-1000" />
          <NetworkVisualizer />
        </motion.div>
      </div>

      {/* Top Left Time - Removed as it's now in Dynamic Island */}

      {/* Top Bar (Floating Pill) */}
      <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-[200] flex items-center justify-center pointer-events-auto">
        <motion.div 
          layoutId="dynamic-island-container"
          ref={islandRef}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
          className="relative flex items-center justify-center"
        >
          {/* Time Sub-Island (Pinned to right of main island when maximized) */}
          <AnimatePresence mode="popLayout">
            {isAnyMaximized && (
              <motion.div
                key="time-sub-island"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute left-[calc(100%-48px)] items-center flex-row-reverse hidden md:flex"
                style={{
                  zIndex: -1,
                  filter: `drop-shadow(0 0 25px ${activeMaximizedApp?.config.color || '#ffffff'}55)`
                }}
              >
                {/* The Time Pill */}
                <div 
                  className="glass-panel rounded-full h-8 pr-4 pl-12 flex items-center justify-center border border-white/10 shadow-2xl w-[130px]"
                  style={{
                    boxShadow: `inset 40px 0 50px -10px ${activeMaximizedApp?.config.color || '#ffffff'}44`
                  }}
                >
                  <motion.div 
                    key="maximized-time"
                    layoutId="system-time"
                    className="tracking-widest font-bold text-[10px] text-white opacity-90 w-[45px] text-center"
                  >
                    {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </motion.div>
                </div>
                
                {/* The Clock Icon Bridge */}
                <div 
                  className="w-10 h-10 rounded-full glass-panel border border-white/20 flex items-center justify-center -mr-10 z-10 shadow-[0_0_40px_rgba(0,0,0,0.9)]"
                  style={{ 
                    backgroundColor: `${activeMaximizedApp?.config.color || '#ffffff'}BB`,
                    boxShadow: `0 0 30px ${activeMaximizedApp?.config.color || '#ffffff'}66`
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center text-white drop-shadow-lg">
                    <LucideIcons.Clock className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* App Name Sub-Island (Pinned to left of main island) */}
          <AnimatePresence mode="popLayout">
            {isAnyMaximized && activeMaximizedApp && (
              <motion.div
                key={`sub-island-${activeMaximizedApp.id}`}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-[calc(100%-48px)] items-center hidden md:flex"
                style={{
                  zIndex: -1,
                  filter: `drop-shadow(0 0 25px ${activeMaximizedApp.config.color}55)`
                }}
              >
                {/* The Name Pill */}
                <div 
                  className="glass-panel rounded-full h-8 pl-4 pr-12 flex items-center justify-center border border-white/10 shadow-2xl w-[216px] md:w-[260px]"
                  style={{
                    boxShadow: `inset -40px 0 50px -10px ${activeMaximizedApp.config.color}44`
                  }}
                >
                  <span className="tracking-tight uppercase text-[10px] font-bold text-white truncate opacity-90">
                    {activeMaximizedApp.name}
                  </span>
                </div>
                
                {/* The Icon Bridge */}
                <div 
                  className="w-10 h-10 rounded-full glass-panel border border-white/20 flex items-center justify-center -ml-10 z-10 shadow-[0_0_40px_rgba(0,0,0,0.9)]"
                  style={{ 
                    backgroundColor: `${activeMaximizedApp.config.color}BB`,
                    boxShadow: `0 0 30px ${activeMaximizedApp.config.color}66`
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 text-white drop-shadow-lg">
                    {activeMaximizedApp.icon}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Dynamic Island (Anchored in center) */}
          <div className={`relative z-10 glass-panel rounded-full flex items-center justify-center gap-2 text-xs font-medium text-slate-200 transition-all duration-700 h-10 ${isAnyMaximized ? 'w-[240px] md:w-[288px]' : 'px-4 hover:bg-slate-800/60'}`}
               style={isAnyMaximized ? { 
                 boxShadow: `0 0 40px ${activeMaximizedApp?.config.color || '#ffffff'}88, inset 0 0 20px ${activeMaximizedApp?.config.color || '#ffffff'}66`,
                 border: `2px solid ${activeMaximizedApp?.config.color || '#ffffff'}AA`,
                 background: `rgba(10, 15, 30, 0.95)`
               } : {}}>
            <DynamicIslandContent 
              isRateLimited={isRateLimited}
              isAnyMaximized={isAnyMaximized}
              activeMaximizedApp={activeMaximizedApp}
              time={time}
              isSubIslandOpen={isSubIslandOpen}
              setIsSubIslandOpen={setIsSubIslandOpen}
              isExpanding={isExpanding}
              expansionProgress={expansionProgress}
              ips={ips}
              ticks={ticks}
            />
          </div>
          
          <AnimatePresence>
            {isSubIslandOpen && !isAnyMaximized && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 8, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute top-full mt-2"
              >
                <div className="pt-1 pb-2 px-1">
                  <SubIslandContent 
                    setShowExpansionConfirm={setShowExpansionConfirm}
                    isExpanding={isExpanding}
                    toggleWindow={toggleWindow}
                    openWindows={openWindows}
                    windowStates={windowStates}
                    unreadCount={unreadCount}
                    setIsWidgetVisible={setIsWidgetVisible}
                    isWidgetVisible={isWidgetVisible}
                    setShowLogoutConfirm={setShowLogoutConfirm}
                    setIsActiveUsersVisible={setIsActiveUsersVisible}
                    isActiveUsersVisible={isActiveUsersVisible}
                    setShowSystemHub={setShowSystemHub}
                    toggleFullscreen={toggleFullscreen}
                    isFullscreen={isFullscreen}
                    isStandalone={isStandalone}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isActiveUsersVisible && (
              <ActiveUsersWidget onClose={() => setIsActiveUsersVisible(false)} />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Optimized Desktop/Mobile Icon Grid */}
      <div className="fixed inset-0 pt-24 pb-32 px-6 md:px-12 pointer-events-none overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-y-10 gap-x-4 pointer-events-auto max-w-7xl mx-auto">
          {apps.filter(app => app.id !== 'messenger').map((app) => {
            const isOpen = openWindows.includes(app.id);
            const appColor = app.config?.color || '#ffffff';
            
            return (
              <motion.div
                key={`${app.id}-${currentUser?.email}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={() => toggleWindow(app.id)}
                className="flex flex-col items-center justify-center group cursor-pointer desktop-item"
              >
                <div className={`glass-icon w-14 h-14 md:w-16 md:h-16 rounded-[1.3rem] flex items-center justify-center mb-2 relative shadow-lg transition-all duration-500 ${
                  isOpen 
                    ? 'ring-2 ring-white/50 bg-white/20' 
                    : ''
                }`}
                style={{
                  boxShadow: isOpen 
                    ? `0 0 20px ${appColor}66, 0 0 40px ${appColor}33` 
                    : undefined
                }}
                >
                  <div className="scale-100 group-hover:scale-110 transition-transform duration-300">
                    {app.icon}
                  </div>
                  {isOpen && (
                    <motion.div 
                      layoutId={`glow-${app.id}`}
                      className="absolute inset-0 rounded-[1.3rem] animate-pulse"
                      style={{ backgroundColor: `${appColor}22` }}
                    />
                  )}
                </div>
                <span className={`text-[10px] md:text-[11px] font-bold drop-shadow-md text-center tracking-tight transition-colors truncate w-full px-1 ${
                  isOpen ? 'text-white' : 'text-slate-300 group-hover:text-white'
                }`}>
                  {app.name}
                </span>
                {isOpen && (
                  <motion.div 
                    layoutId={`indicator-${app.id}`}
                    className="mt-1 w-1 h-1 rounded-full shadow-[0_0_5px_white]" 
                    style={{ backgroundColor: appColor, boxShadow: `0 0 8px ${appColor}` }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* System Monitor Widget */}
      {isWidgetVisible && (
        <motion.div
          id="system-monitor-widget"
          drag
          dragMomentum={false}
          dragConstraints={desktopRef}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ width: widgetSize.width, height: widgetSize.height }}
          className="fixed top-[100px] right-[80px] glass-panel rounded-3xl p-6 pointer-events-auto z-10 border border-white/5 overflow-hidden"
        >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-widest uppercase opacity-60">System Monitor</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${cpuLoad > 80 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-mono opacity-40">LIVE</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="opacity-60 uppercase">CPU Load</span>
              <span className="text-emerald-400">{cpuLoad.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${cpuLoad > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                animate={{ width: `${cpuLoad}%` }}
                transition={{ type: 'spring', damping: 20 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] opacity-40 uppercase block">Temp</span>
              <span className="text-sm font-mono text-orange-400">{cpuTemp.toFixed(1)}°C</span>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] opacity-40 uppercase block">Uptime</span>
              <span className="text-sm font-mono text-blue-400">{uptime}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] opacity-40 uppercase block">Network Activity</span>
              <a 
                href="https://aistudio.google.com/app/plan_and_billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[9px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <Zap className="w-2.5 h-2.5" />
                Quota
              </a>
            </div>
            <NetworkStatsChart />
          </div>

          <div className="pt-4 border-t border-white/10">
            <span className="text-[10px] opacity-40 uppercase block mb-2">Registers (r1-r4)</span>
            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
              {Object.entries(registers).map(([k, v]) => (
                <div key={k} className="flex justify-between bg-black/20 px-2 py-1 rounded border border-white/5">
                  <span className="opacity-40">{k}</span>
                  <span className="text-emerald-400/80">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          onPointerDown={startResizing}
          className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1 group z-20"
        >
          <div className="w-2 h-2 bg-white/10 rounded-full group-hover:bg-white/40 transition-colors m-1 border border-white/10" />
        </div>
      </motion.div>
      )}

      {/* Version & Desktop Controls */}
      <div className="fixed bottom-4 right-6 z-50 flex items-center gap-4">
        <button 
          onClick={showDesktop}
          className="w-1.5 h-8 bg-white/10 hover:bg-white/30 transition-colors rounded-sm border-l border-white/5"
          title="Zobraziť plochu"
        />
        <div className="text-[10px] font-mono opacity-20 tracking-widest">
          {version}
        </div>
      </div>

      {/* Window Manager */}
      <AnimatePresence>
        {apps.map(app => {
          const id = app.id;
          if (!openWindows.includes(id)) return null;
          const state = windowStates[id] || { isMaximized: true, isMinimized: false };
          
          if (state.isMinimized) return null;

          return (
            <Window
              key={id}
              id={id}
              app={app}
              state={state}
              zIndex={80 + openWindows.indexOf(id)}
              desktopRef={desktopRef as any}
              focusWindow={focusWindow}
              minimizeWindow={minimizeWindow}
              toggleMaximize={toggleMaximize}
              toggleWindow={toggleWindow}
            >
              {id === 'laucoin' && <LauCoinApp systemUser={currentUser} theme={theme} setTheme={setTheme} />}
              {id === 'lau_chat' && <LaurinChatApp currentUser={currentUser} />}
              {id === 'messenger' && <MessengerApp currentUser={currentUser} />}
              {id === 'system' && <SystemInfoApp />}
              {id === 'kernel' && <KernelLogsApp />}
              {id.startsWith('app_') && <GenericApp config={app!.config} />}
              {id === 'becreative' && <BeCreativeApp apps={apps} addApp={addApp} removeApp={removeApp} currentUser={currentUser} />}
              {id === 'lookup' && <OSINTApp />}
            </Window>
          );
        })}
      </AnimatePresence>

      {/* System Hub / Settings Modal */}
      <AnimatePresence>
        {showSystemHub && currentUser && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-xl">
                    <LucideIcons.Settings className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest">Systémové Jadro</h2>
                    <p className="text-[10px] text-gray-500 font-mono">Kernel Configuration & Control</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSystemHub(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors"
                >
                  <LucideIcons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8 custom-scrollbar">
                {/* Kernel Operations */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Kernel Operations</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={seedNodes}
                      disabled={seeding}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      <LucideIcons.Database className={`w-6 h-6 text-purple-400 ${seeding ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Cloud Seed</span>
                    </button>
                    <button 
                      onClick={syncKernelWithCloud}
                      disabled={seeding}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      <LucideIcons.RefreshCw className={`w-6 h-6 text-emerald-400 ${seeding ? 'animate-spin' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Cloud Sync</span>
                    </button>
                    <button 
                      onClick={executeExpansion}
                      disabled={isExpanding}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      <LucideIcons.Cpu className={`w-6 h-6 text-blue-400 ${isExpanding ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">ASE Expansion</span>
                    </button>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      {theme === 'dark' ? <LucideIcons.Sun className="w-6 h-6 text-amber-400" /> : <LucideIcons.Moon className="w-6 h-6 text-slate-400" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider">Switch Theme</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* AI Configuration */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">AI Hub Configuration</h3>
                  
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Aktívny Provider</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['gemini', 'custom', 'local'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPreferredProvider(p)}
                          className={`py-2 px-1 rounded-lg border text-[10px] font-bold uppercase tracking-tighter transition-all ${
                            preferredProvider === p 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {p === 'gemini' ? 'Gemini 3.1' : p === 'custom' ? 'Custom API' : 'Local GGUF'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {preferredProvider === 'gemini' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-2"
                      >
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Gemini API Key</label>
                        <input 
                          type="password" 
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                        />
                      </motion.div>
                    )}

                    {preferredProvider === 'custom' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Custom API URL</label>
                          <input 
                            type="url" 
                            value={customApiUrl}
                            onChange={(e) => setCustomApiUrl(e.target.value)}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Custom API Key</label>
                          <input 
                            type="password" 
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Model ID</label>
                          <input 
                            type="text" 
                            value={customModel}
                            onChange={(e) => setCustomModel(e.target.value)}
                            placeholder="gpt-4o / llama3-70b"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                          />
                        </div>
                      </motion.div>
                    )}

                    {preferredProvider === 'local' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">
                          <div className="flex items-center gap-2 mb-2">
                             <LucideIcons.ShieldAlert className="w-4 h-4 text-purple-400" />
                             <span className="font-bold">KERNEL ROOT INTEGRATION ACTIVE</span>
                          </div>
                          Model je prepojený priamo so systémovými prostriedkami. Obchádzame štandardné portovanie pre maximálnu rýchlosť odozvy kernelu.
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Koreňový súbor modelu (.gguf)</label>
                          <div className="relative group">
                            <LucideIcons.Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 group-focus-within:text-blue-400 transition-colors" />
                            <input 
                              type="text" 
                              value={localModelPath}
                              onChange={(e) => setLocalModelPath(e.target.value)}
                              placeholder="napr. laurin-kernel-v1.gguf"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white font-mono focus:border-purple-500/50 outline-none transition-all shadow-[inset_0_0_20px_rgba(147,51,234,0.05)]"
                            />
                          </div>
                        </div>

                        {localModelPath && (
                          <div className="flex items-center justify-between p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Root Authority Established</span>
                            </div>
                            <LucideIcons.Zap className="w-3 h-3 text-yellow-500 animate-pulse" />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Standalone Check for true Fullscreen */}
                  {isMobile && !isStandalone && (
                    <div className="mt-8 p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-100 flex flex-col gap-3">
                      <div className="flex items-center gap-2 font-bold text-blue-400">
                        <LucideIcons.Share className="w-4 h-4" />
                        AKTIVÁCIA TRUE FULLSCREEN (iOS)
                      </div>
                      <p className="leading-relaxed opacity-80">
                        Pre najlepší zážitok bez lišty Safari, klikni na <span className="font-bold underline text-blue-400">Zdieľať</span> (ikona štvorca so šípkou) a zvoľ <span className="font-bold underline text-blue-400">Pridať na plochu</span>.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5 flex gap-3">
                <button 
                  onClick={() => setShowSystemHub(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-gray-400"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveSettings}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase text-xs tracking-widest"
                >
                  Apply System Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expansion Confirmation Dialog */}
      <AnimatePresence>
        {showExpansionConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <LucideIcons.Brain className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Expanzia vedomia</h3>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Chystáte sa rozšíriť vedomie Laurin na základe vašich interakcií v tejto iterácii.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setShowExpansionConfirm(false);
                    executeExpansion();
                  }}
                  className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20"
                >
                  1. SCHVÁLIŤ
                </button>
                <button 
                  onClick={() => setShowExpansionConfirm(false)}
                  className="py-3 px-6 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
                >
                  2. ODÍSŤ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Logout Confirmation Dialog */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <LucideIcons.LogOut className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Odhlásenie</h3>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Naozaj sa chcete odhlásiť zo systému LaurinOS?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handlePowerOff();
                  }}
                  className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  ODHLÁSIŤ
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-3 px-6 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
                >
                  ZRUŠIŤ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* iOS Style Mobile Bottom Dock */}
      {isMobile && (
        <div className="fixed bottom-6 left-6 right-6 h-20 glass-panel rounded-[2.5rem] z-[5000] flex items-center justify-around px-4 border border-white/10 shadow-2xl">
          {apps.slice(0, 4).map((app) => (
            <motion.button 
              key={`dock-${app.id}`}
              whileTap={{ scale: 0.8 }}
              onClick={() => toggleWindow(app.id)}
              className="ios-touch-feedback relative"
            >
              <div className={`w-14 h-14 rounded-2xl glass-icon flex items-center justify-center ${openWindows.includes(app.id) ? 'border-white/30 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}`}>
                <div className="scale-90 [&>svg]:w-7 [&>svg]:h-7">
                  {app.icon}
                </div>
              </div>
              {openWindows.includes(app.id) && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]" />
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Home Indicator Bar */}
      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 w-36 h-1 bg-white/20 rounded-full z-[6000] mb-0.5" />
    </div>
  );
}
