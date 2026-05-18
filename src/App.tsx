import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, BatteryCharging, CloudSun, X, Minus, Square, Lock, Loader2, 
  LogOut, MessageSquare, BarChart2, Shield, Zap, Code, Terminal, 
  MessageCircle, LayoutGrid, Activity, Radar, Grid, Maximize2, 
  Users, Search, Brain, Clock, FileCode, Trash2, Settings, Share, Coins,
  Database, RefreshCw, Cpu, Sun, Moon, ShieldAlert, Globe
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { NetworkVisualizer } from './components/NetworkVisualizer';
import LauCoinApp from './LauCoinApp';
import { LaurinChatApp } from './components/LaurinChatApp';
import BeCreativeApp from './BeCreativeApp';
import GenericApp from './GenericApp';
import { SoulMapApp } from './components/SoulMapApp';
import { MessengerApp } from './components/MessengerApp';
import { SystemInfoApp } from './components/SystemInfoApp';
import { NetworkStatsChart } from './components/NetworkStatsChart';
import { KernelLogsApp } from './components/KernelLogsApp';
import { Window } from './components/Window';
import { PredatorApp } from './components/PredatorApp';
import { OSINTApp } from './components/OSINTApp';
import { ActiveUsersWidget } from './components/ActiveUsersWidget';
import { AuthScreen } from './components/AuthScreen';
import { doc, getDoc, getDocs, setDoc, serverTimestamp, collection, query, where, getCountFromServer, limit } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, onSnapshot } from './firebase';
import { SNAPPY_SPRING, SMOOTH_SPRING } from './constants';

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
  ips
}: DynamicIslandContentProps) => (
  <div 
    className="flex items-center justify-center h-10 w-full relative group shrink-0"
  >
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

      <div 
        className="flex items-center gap-4 transition-all duration-500"
        style={isAnyMaximized ? {
          textShadow: `0 0 8px ${activeMaximizedApp?.config.color || '#ffffff'}88`
        } : {}}
      >
        {/* 1. Time - Left Side */}
        <motion.div 
          key="system-time-display"
          layoutId="system-time"
          className="tracking-widest font-black text-sm min-w-[60px] text-right transform -translate-x-[15px]"
        >
          {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </motion.div>
        
        {/* 2. Notch Space / Physical Cutout Wrapper - Fixed Middle Area */}
        <div className="w-[80px] h-4 relative flex items-center justify-center mx-1">
          {isExpanding && (
             <motion.div 
               layoutId="pulse-ring"
               className="absolute inset-0 bg-purple-500/20 rounded-full animate-ping" 
             />
          )}
        </div>

        {/* 3. Indicators (Graph, Logo) - Right Side */}
        <div className="flex items-center gap-3 justify-end min-w-[80px]">
          {!isSubIslandOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="hidden md:flex transform scale-[0.8] origin-right"
            >
              <NetworkVisualizer />
            </motion.div>
          )}

          <motion.div 
            layout
            transition={SMOOTH_SPRING}
            animate={{
              scale: isSubIslandOpen ? 1.15 : 1,
              filter: isSubIslandOpen ? 'drop-shadow(0 0 10px rgba(168,85,247,0.8)) brightness(1.25)' : 'drop-shadow(0 0 0px rgba(168,85,247,0)) brightness(1)'
            }}
            className={`text-sm font-black transform translate-x-[2px]`}
          >
            <span className="text-purple-400">Laurin</span><span className="text-white">OS</span>
          </motion.div>
        </div>
      </div>
    </div>
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
  ips: number;
  activeNodesCount: number;
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
  isStandalone,
  ips,
  activeNodesCount
}: SubIslandContentProps & { setShowSystemHub: (val: boolean) => void }) => (
  <div className="relative overflow-hidden w-[280px] md:w-[340px]">
    <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full" />
    <div className="relative glass-panel rounded-[2.5rem] p-5 pb-4 border border-white/10 shadow-2xl">
      {/* Dynamic Island Expanded Stats */}
      <div className="flex items-center justify-center gap-6 mb-5 mt-1">
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${ips > 0 ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]' : 'bg-gray-700'}`} />
                <span className="text-[10px] font-bold text-blue-400 font-mono tracking-tighter">
                  {ips > 999 ? `${(ips/1000).toFixed(1)}k` : ips}
                </span>
            </div>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">IPS</span>
        </div>
        
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${activeNodesCount > 0 ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-gray-700'}`} />
                <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-tighter">
                  {activeNodesCount > 999 ? `${(activeNodesCount/1000).toFixed(1)}k` : activeNodesCount}
                </span>
            </div>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Nodes</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
      {/* 1. Brain/Expansion */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowExpansionConfirm(true)}
        disabled={isExpanding}
        className="flex flex-col items-center gap-2 group"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isExpanding ? 'bg-purple-500/40 text-white animate-spin' : 'bg-white/5 group-hover:bg-purple-500/20 text-gray-400 group-hover:text-purple-400'}`}>
          <Brain className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">BRAIN</span>
      </motion.button>

      {/* 2. Fullscreen */}
      {!isStandalone && (
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={toggleFullscreen}
          className="flex flex-col items-center gap-2 group"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isFullscreen ? 'bg-blue-500/40 text-white' : 'bg-white/5 group-hover:bg-blue-500/20 text-gray-400 group-hover:text-blue-400'}`}>
            <Maximize2 className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold opacity-60">FULL</span>
        </motion.button>
      )}

      {/* 3. Messenger */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => toggleWindow('messenger')}
        className="flex flex-col items-center gap-2 group relative"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${openWindows.includes('messenger') ? 'bg-purple-500/40 text-white' : 'bg-white/5 group-hover:bg-purple-500/20 text-gray-400 group-hover:text-purple-400'}`}>
          <MessageCircle className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">CHAT</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg border-2 border-[#1a1a1a]">
            {unreadCount}
          </span>
        )}
      </motion.button>

      {/* 4. Settings */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowSystemHub(true)}
        className="flex flex-col items-center gap-2 group"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-blue-500/20 text-gray-400 group-hover:text-blue-400 flex items-center justify-center transition-all">
          <Settings className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">CORES</span>
      </motion.button>

      {/* 5. Users */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsActiveUsersVisible(!isActiveUsersVisible)}
        className="flex flex-col items-center gap-2 group"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isActiveUsersVisible ? 'bg-blue-400/40 text-white' : 'bg-white/5 group-hover:bg-blue-400/20 text-gray-400 group-hover:text-blue-300'}`}>
          <Users className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">USERS</span>
      </motion.button>

      {/* 6. Widget */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsWidgetVisible(!isWidgetVisible)}
        className="flex flex-col items-center gap-2 group"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isWidgetVisible ? 'bg-green-500/40 text-green-400' : 'bg-white/5 group-hover:bg-green-500/20 text-gray-400 group-hover:text-green-400'}`}>
          <Activity className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">SENSORS</span>
      </motion.button>

      {/* 7. Network */}
       <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => toggleWindow('system')}
        className="flex flex-col items-center gap-2 group"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${openWindows.includes('system') ? 'bg-emerald-500/40 text-white' : 'bg-white/5 group-hover:bg-emerald-500/20 text-gray-400 group-hover:text-emerald-400'}`}>
          <BarChart2 className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">MONITOR</span>
      </motion.button>

      {/* 8. Logout */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowLogoutConfirm(true)}
        className="flex flex-col items-center gap-2 group"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-red-500/20 text-gray-400 group-hover:text-red-400 flex items-center justify-center transition-all">
          <LogOut className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-60">EXIT</span>
      </motion.button>
      </div>
    </div>
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
  const [activeNodesCount, setActiveNodesCount] = useState<number>(0);

  useEffect(() => {
    // Keep nodes count in sync - optimized to interval instead of real-time onSnapshot to save reads
    let isMounted = true;
    let interval: ReturnType<typeof setInterval>;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;
      if (user) {
        const fetchNodesCount = async () => {
          if (!isMounted) return;
          try {
            const countSnap = await getCountFromServer(collection(db, 'nodes'));
            if (isMounted) setActiveNodesCount(countSnap.data().count);
          } catch (e) {
            console.error('Failed to get active nodes count:', e);
          }
        };
        fetchNodesCount(); // initial fetch
        interval = setInterval(fetchNodesCount, 300000); // Refresh every 5 minutes
      } else {
        if (interval) clearInterval(interval);
      }
    });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      unsubscribeAuth();
    };
  }, []);

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
    { id: 'laucoin', name: 'LauCoin', icon: <Coins className="w-10 h-10 text-blue-400" />, prompt: '', hash: '', config: { name: 'LauCoin', description: '', uiType: 'list', color: '#3b82f6' } },
    { id: 'SoulMap', name: 'SoulMap', icon: <Brain className="w-10 h-10 text-cyan-400" />, prompt: '', hash: '', config: { name: 'SoulMap', description: 'Network Graph Explorer', uiType: 'dashboard', color: '#22d3ee' } },
    { id: 'lau_chat', name: 'Lau Chat', icon: <Terminal className="w-10 h-10 text-blue-400" />, prompt: '', hash: '', config: { name: 'Lau Chat', description: '', uiType: 'chat', color: '#3b82f6' } },
    { id: 'becreative', name: 'Be Creative', icon: <Zap className="w-10 h-10 text-amber-400" />, prompt: '', hash: '', config: { name: 'Be Creative', description: '', uiType: 'list', color: '#f59e0b' } },
    { id: 'messenger', name: 'Messenger', icon: <MessageCircle className="w-10 h-10 text-purple-400" />, prompt: '', hash: '', config: { name: 'Messenger', description: '', uiType: 'chat', color: '#a855f7' } },
    { id: 'system', name: 'Systémové Centrum', icon: <Activity className="w-10 h-10 text-emerald-400" />, prompt: '', hash: '', config: { name: 'Systémové Centrum', description: 'Monitorovanie sensorov a HW bridge', uiType: 'dashboard', color: '#10b981' } },
    { id: 'kernel', name: 'Kernel Logs', icon: <Terminal className="w-10 h-10 text-slate-400" />, prompt: '', hash: '', config: { name: 'Kernel Logs', description: 'System Kernel Logs', uiType: 'dashboard', color: '#94a3b8' } },
    { id: 'predator', name: 'Endpoint Predator', icon: <Radar className="w-10 h-10 text-orange-500" />, prompt: '', hash: '', config: { name: 'Endpoint Predator', description: 'APK Reverse Engineering & Semantic Extraction', uiType: 'dashboard', color: '#f97316' } },
    { id: 'osint', name: 'Lau Tracker', icon: <Search className="w-10 h-10 text-red-500" />, prompt: '', hash: '', config: { name: 'Lau Tracker', description: 'Global Hacker DOSSIER Lookup', uiType: 'dashboard', color: '#ef4444' } },
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
    let bmRef: any = null;
    let cancel = false;

    if ((navigator as any).getBattery) {
      (navigator as any).getBattery().then((bm: any) => {
        if (cancel) return;
        bmRef = bm;
        const update = () => {
          setBatteryLevel(Math.round(bm.level * 100));
          setIsCharging(bm.charging);
        };
        update();
        bm.addEventListener('levelchange', update);
        bm.addEventListener('chargingchange', update);
      });
    }

    // Geolocation permission (one-time check)
    navigator.geolocation.getCurrentPosition(
      () => {}, 
      () => {}
    );

    // Network Information API
    let connRef: any = null;
    const connection = (navigator as any).connection;
    if (connection) {
      connRef = connection;
      const handleConnChange = () => console.log('Network changed:', connection.effectiveType);
      connection.addEventListener('change', handleConnChange);
    }

    return () => {
      cancel = true;
      if (bmRef) {
        bmRef.removeEventListener('levelchange', () => {});
        bmRef.removeEventListener('chargingchange', () => {});
      }
      if (connRef) {
        connRef.removeEventListener('change', () => {});
      }
    };
  }, []);

  const [isSubIslandOpen, setIsSubIslandOpen] = useState(false);
  const [showSystemHub, setShowSystemHub] = useState(false);
  
  // System Configuration State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<'gemini' | 'custom' | 'local' | 'ollama'>('gemini');
  const [localModelPath, setLocalModelPath] = useState('');
  const [localModelUrl, setLocalModelUrl] = useState('');
  const [localModelTemp, setLocalModelTemp] = useState<number>(0.7);
  const [localModelMaxTokens, setLocalModelMaxTokens] = useState<number>(2048);
  const [localModelTopP, setLocalModelTopP] = useState<number>(0.9);
  const [seeding, setSeeding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{progress: number, status: string, error?: string} | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (downloading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/download-status');
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().startsWith('{')) {
              try {
                const data = JSON.parse(text);
                if (data && typeof data.progress === 'number') {
                  setDownloadProgress(data);
                  if (data.status === 'completed' || data.status === 'error') {
                    setDownloading(false);
                    if (data.status === 'completed') {
                      alert("Dolphin Agent úspešne stiahnutý.");
                      fetchLocalModels();
                    } else if (data.error) {
                      alert(`Chyba sťahovania: ${data.error}`);
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors from partially written files
              }
            }
          }
        } catch (err) {
          // Suppress noise if it's just a parse error during file write
          if (err instanceof Error && !err.message.includes('Unexpected')) {
            console.error("Failed to poll status:", err);
          }
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [downloading]);

  const [localModels, setLocalModels] = useState<string[]>([]);

  const fetchLocalModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        setLocalModels(data.models || []);
      }
    } catch (err) {
      console.error("Failed to fetch local models:", err);
    }
  };

  const applyLocalModel = async (modelName: string) => {
    setLocalModelPath(modelName);
    setPreferredProvider('local');
    
    try {
      await fetch('/core-api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gemini_api_key: geminiApiKey,
          custom_api_url: customApiUrl,
          custom_api_key: customApiKey,
          custom_model: customModel,
          preferred_provider: 'local',
          local_model_path: modelName, // use passed value not state
          local_model_temp: localModelTemp,
          local_model_max_tokens: localModelMaxTokens,
          local_model_top_p: localModelTopP
        })
      });
      setShowSystemHub(false);
      alert(`Model ${modelName} bol nastavený.`);
    } catch (err) {
      console.error("Failed to apply local model:", err);
    }
  };

  const deleteModel = async (filename: string) => {
    if (!confirm(`Naozaj chcete vymazať model ${filename}?`)) return;
    try {
      const res = await fetch(`/api/models/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLocalModels();
        alert("Model vymazaný.");
      } else {
        alert("Chyba pri mazaní modelu.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

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
        setLocalModelTemp(data.local_model_temp ?? 0.7);
        setLocalModelMaxTokens(data.local_model_max_tokens ?? 2048);
        setLocalModelTopP(data.local_model_top_p ?? 0.9);
        
        // Fetch real models
        fetchLocalModels();
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

  const validateGeminiKey = (key: string) => {
    if (!key) return "Kľúč nemôže byť prázdny";
    if (!key.startsWith('AIzaSy')) return "Neplatný formát kľúča (musí začínať na AIzaSy)";
    if (key.length < 38 || key.length > 45) return "Neplatná dĺžka kľúča";
    return null;
  };

  const saveSettings = async () => {
    if (preferredProvider === 'gemini') {
      const error = validateGeminiKey(geminiApiKey);
      if (error) {
        setApiKeyError(error);
        return;
      }
    }
    
    setApiKeyError(null);
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
          local_model_path: localModelPath,
          local_model_temp: localModelTemp,
          local_model_max_tokens: localModelMaxTokens,
          local_model_top_p: localModelTopP
        })
      });
      // Update local storage or trigger a refresh if needed
      setShowSystemHub(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const downloadModel = async () => {
    setDownloading(true);
    setDownloadProgress({ progress: 0, status: 'starting' });
    try {
      const res = await fetch('/api/download-model', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: localModelUrl || undefined,
          filename: localModelPath || undefined
        })
      });
      if (!res.ok) {
        alert("Chyba pri spúšťaní sťahovania.");
        setDownloading(false);
      }
    } catch (err) {
      console.error("Download failed:", err);
      setDownloading(false);
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

  // Global Kernel Polling - Optimized for stability
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout;

    const fetchKernelStatus = async () => {
      try {
        const response = await fetch('/core-api/status', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!isMounted) return;

        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            if (data && isMounted) {
              if (data.registers) setRegisters(data.registers);
              if (data.ips !== undefined) setIps(data.ips);
              if (data.ticks !== undefined) setTicks(data.ticks);
              
              if (typeof data.ips === 'number') {
                const load = Math.min(100, Math.floor((data.ips / 10000) * 100));
                setCpuLoad(load);
                setCpuTemp(40 + Math.floor(load / 5));
              }
            }
          } catch (parseErr) {
            console.warn("App: Kernel status parse warning", parseErr);
          }
        }
      } catch (err: any) {
        // Silent during normal cleanup, otherwise log core issues
        if (isMounted) {
          console.debug("App: Kernel sync delayed or failed", err.message);
        }
      } finally {
        if (isMounted) {
          pollInterval = setTimeout(fetchKernelStatus, 5000);
        }
      }
    };

    fetchKernelStatus();

    return () => {
      isMounted = false;
      clearTimeout(pollInterval);
    };
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
      // Logic for background tasks that don't conflict with real kernel data
      // For example, keeping the session or background checks
    }, 10000);
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

  const handleDockClick = (id: string) => {
    if (!openWindows.includes(id)) {
      setWindowStates(ws => ({ ...ws, [id]: { isMaximized: true, isMinimized: false } }));
      setOpenWindows(prev => [...prev, id]);
    } else {
      const state = windowStates[id] || { isMaximized: true, isMinimized: false };
      if (state.isMinimized) {
        setWindowStates(ws => ({ ...ws, [id]: { ...state, isMinimized: false } }));
        focusWindow(id);
      } else if (openWindows[openWindows.length - 1] !== id) {
        focusWindow(id);
      } else {
        minimizeWindow(id);
      }
    }
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
      where('read', '==', false),
      limit(50) // Limit to 50 unread messages for bubble count
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
    
    const fetchApps = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'apps'), limit(20)));
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
          const forbiddenIds = ['lookup', 'diffus', 'neon canvas', 'neon_canvas'];
          const forbiddenNames = ['Hacker Lookup', 'Diffus', 'Neon Canvas', 'neon canvas', 'hacker loo'];
          
          const newApps = restoredApps.filter((a: any) => 
            !existingIds.includes(a.id) && 
            !forbiddenIds.includes(a.id) &&
            !forbiddenNames.includes(a.name)
          );
          return [...prev, ...newApps];
        });
      } catch (error) {
        console.error("Failed to restore apps from Semantic Ledger in Firestore", error);
      }
    };

    fetchApps();
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
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transform-gpu">
        <motion.div 
          animate={(isAnyMaximized || isSubIslandOpen) ? { scale: 1.05, opacity: 0.7 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "circOut" }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-purple-950/40 to-black pointer-events-none" />
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-1000" />
        </motion.div>
      </div>

      {/* Click-outside listener for expanded island */}
      <AnimatePresence>
        {isSubIslandOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onPointerDown={() => setIsSubIslandOpen(false)}
            className="fixed inset-0 z-[7000] bg-black/60 transform-gpu"
          />
        )}
      </AnimatePresence>

      {/* Top Bar (Floating Pill) */}
      <div className={`fixed ${isStandalone || isFullscreen ? 'top-0' : 'top-[9px]'} left-1/2 transform -translate-x-1/2 z-[8000] flex items-center justify-center pointer-events-auto transition-all duration-500`}>
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
                    <Clock className="w-5 h-5" />
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

          {/* Combined Dynamic Island System */}
          <motion.div 
            layout
            transition={SMOOTH_SPRING}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              setIsSubIslandOpen(!isSubIslandOpen);
              e.stopPropagation();
            }}
            className={`relative z-10 rounded-[3rem] flex flex-col items-center justify-start text-xs font-medium text-slate-200 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/5 transform-gpu ${
              isSubIslandOpen 
                ? 'min-h-[220px] p-[6px] w-[300px] md:w-[360px]' 
                : isAnyMaximized 
                  ? 'h-10 w-[280px] md:w-[340px]' 
                  : 'h-10 w-[300px] md:w-[360px]'
            }`}
            style={{
              background: isSubIslandOpen 
                ? 'radial-gradient(150% 120% at 50% 0%, #000 15%, rgba(10, 25, 60, 0.9) 60%, #000 100%)' 
                : '#000000',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: isAnyMaximized 
                ? `0 0 40px ${activeMaximizedApp?.config.color || '#ffffff'}44, inset 0 0 20px ${activeMaximizedApp?.config.color || '#ffffff'}22` 
                : isSubIslandOpen 
                  ? '0 30px 60px -12px rgba(0,0,0,0.9), 0 18px 36px -18px rgba(0,0,0,0.9)'
                  : '0 8px 32px 0 rgba(0,0,0,0.8)',
              border: isAnyMaximized ? `1.5px solid ${activeMaximizedApp?.config.color || '#ffffff'}66` : '1px solid rgba(255,255,255,0.05)'
            }}
          >
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
            />

            <AnimatePresence>
              {isSubIslandOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={SMOOTH_SPRING}
                  className="mt-2 w-full flex justify-center"
                >
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
                    ips={ips}
                    activeNodesCount={activeNodesCount}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {isActiveUsersVisible && (
              <ActiveUsersWidget onClose={() => setIsActiveUsersVisible(false)} />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bottom Dock for Apps (Replacing Desktop Grid) */}
      <div className="fixed bottom-6 left-0 right-0 z-[6000] pointer-events-none flex justify-center px-4">
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="flex items-center gap-3 px-4 py-3 rounded-[2rem] bg-white/20 dark:bg-[#111111]/70 backdrop-blur-3xl border border-white/30 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] pointer-events-auto max-w-full overflow-x-auto hide-scrollbar"
        >
          {apps.filter(app => app.id !== 'messenger').map((app) => {
            const isOpen = openWindows.includes(app.id);
            const isFocused = openWindows[openWindows.length - 1] === app.id;
            const appColor = app.config?.color || '#ffffff';
            
            return (
              <motion.div
                key={`${app.id}-${currentUser?.email}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -6, scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                onClick={() => handleDockClick(app.id)}
                className="flex flex-col items-center justify-center group cursor-pointer relative"
              >
                {/* Dock Icon */}
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center relative shadow-lg transition-all duration-300 ${
                  isOpen 
                    ? 'ring-1 ring-white/30 bg-white/10' 
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
                style={{
                  boxShadow: isOpen 
                    ? `0 10px 20px ${appColor}33, inset 0 0 10px ${appColor}11` 
                    : undefined
                }}
                >
                  <div className="[&>svg]:w-6 [&>svg]:h-6 md:[&>svg]:w-7 md:[&>svg]:h-7 text-white drop-shadow-md">
                    {app.icon}
                  </div>
                </div>
                
                {/* Active Indicator */}
                {isOpen && (
                  <motion.div 
                    layoutId={`indicator-${app.id}`}
                    className="absolute -bottom-1.5 w-1 h-1 rounded-full shadow-[0_0_5px_white]" 
                    style={{ 
                      backgroundColor: isFocused ? '#ffffff' : appColor, 
                      boxShadow: isFocused ? '0 0 8px #ffffff' : `0 0 8px ${appColor}` 
                    }}
                  />
                )}

                {/* Tooltip on Hover */}
                <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform origin-bottom bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10 pointer-events-none whitespace-nowrap shadow-xl">
                  {app.name}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
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
        <div className="text-[10px] font-mono opacity-20 tracking-widest text-right">
          autor:romaniznan | {version}
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
              {id === 'SoulMap' && <SoulMapApp />}
              {id === 'lau_chat' && <LaurinChatApp currentUser={currentUser} />}
              {id === 'messenger' && <MessengerApp currentUser={currentUser} />}
              {id === 'system' && <SystemInfoApp />}
              {id === 'kernel' && <KernelLogsApp />}
              {id.startsWith('app_') && <GenericApp config={app!.config} />}
              {id === 'becreative' && <BeCreativeApp apps={apps} addApp={addApp} removeApp={removeApp} currentUser={currentUser} />}
              {id === 'predator' && <PredatorApp />}
              {id === 'osint' && <OSINTApp />}
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
                    <Settings className="w-5 h-5 text-blue-400" />
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
                  <X className="w-5 h-5" />
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
                      <Database className={`w-6 h-6 text-purple-400 ${seeding ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Cloud Seed</span>
                    </button>
                    <button 
                      onClick={syncKernelWithCloud}
                      disabled={seeding}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      <RefreshCw className={`w-6 h-6 text-emerald-400 ${seeding ? 'animate-spin' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Cloud Sync</span>
                    </button>
                    <button 
                      onClick={executeExpansion}
                      disabled={isExpanding}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      <Cpu className={`w-6 h-6 text-blue-400 ${isExpanding ? 'animate-pulse' : 'group-hover:scale-110'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">ASE Expansion</span>
                    </button>
                    <button 
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                    >
                      {theme === 'dark' ? <Sun className="w-6 h-6 text-amber-400" /> : <Moon className="w-6 h-6 text-slate-400" />}
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
                    <div className="grid grid-cols-2 gap-2">
                      {(['gemini', 'ollama', 'custom', 'local'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPreferredProvider(p)}
                          className={`py-2 px-1 rounded-lg border text-[10px] font-bold uppercase tracking-tighter transition-all ${
                            preferredProvider === p 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {p === 'gemini' ? 'Gemini 3.1' : p === 'ollama' ? 'Ollama' : p === 'custom' ? 'Custom API' : 'Local GGUF'}
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
                        <div className="space-y-1">
                          <input 
                            type="password" 
                            value={geminiApiKey}
                            onChange={(e) => {
                              setGeminiApiKey(e.target.value);
                              if (apiKeyError) setApiKeyError(null);
                            }}
                            placeholder="AIzaSy..."
                            className={`w-full bg-white/5 border rounded-xl py-3 px-4 text-sm text-white font-mono outline-none transition-all ${
                              apiKeyError ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-white/10 focus:border-blue-500/50'
                            }`}
                          />
                          <AnimatePresence>
                            {apiKeyError && (
                              <motion.p 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-[10px] text-red-400 font-bold ml-1"
                              >
                                {apiKeyError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}

                    {preferredProvider === 'ollama' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Ollama API URL</label>
                          <input 
                            type="url" 
                            value={customApiUrl || "http://localhost:11434"}
                            onChange={(e) => setCustomApiUrl(e.target.value)}
                            placeholder="http://localhost:11434"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Ollama Model</label>
                          <input 
                            type="text" 
                            value={customModel || "llama3"}
                            onChange={(e) => setCustomModel(e.target.value)}
                            placeholder="llama3"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white font-mono focus:border-blue-500/50 outline-none transition-all"
                          />
                        </div>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[9px] text-blue-300">
                          Pre lokálnu Ollamu mimo cloudu použite tunel (napr. Ngrok) a vložte verejnú URL.
                        </div>
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
                             <ShieldAlert className="w-4 h-4 text-purple-400" />
                             <span className="font-bold">KERNEL ROOT INTEGRATION ACTIVE</span>
                          </div>
                          Model je prepojený priamo so systémovými prostriedkami. Obchádzame štandardné portovanie pre maximálnu rýchlosť odozvy kernelu.
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Koreňový súbor modelu (.gguf)</label>
                          <div className="relative group">
                            <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 group-focus-within:text-blue-400 transition-colors" />
                            <input 
                              type="text" 
                              value={localModelPath}
                              onChange={(e) => setLocalModelPath(e.target.value)}
                              placeholder="napr. Qwen2.5-1.5b-instruct-q4_k_m.gguf"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white font-mono focus:border-purple-500/50 outline-none transition-all shadow-[inset_0_0_20px_rgba(147,51,234,0.05)]"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">URL na stiahnutie (HuggingFace apod.)</label>
                          <div className="relative group">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 group-focus-within:text-blue-400 transition-colors" />
                            <input 
                              type="url" 
                              value={localModelUrl}
                              onChange={(e) => setLocalModelUrl(e.target.value)}
                              placeholder="napr. https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white font-mono focus:border-purple-500/50 outline-none transition-all shadow-[inset_0_0_20px_rgba(147,51,234,0.05)]"
                            />
                          </div>
                        </div>

                        {localModelPath && (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter">Root Authority Established</span>
                              </div>
                              <Zap className="w-3 h-3 text-yellow-500 animate-pulse" />
                            </div>

                            <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-black/20 mt-2">
                              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Parametre jadra</div>
                              
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-gray-300">
                                  <span>Teplota (Kreativita)</span>
                                  <span className="font-mono text-purple-400">{localModelTemp.toFixed(1)}</span>
                                </div>
                                <input 
                                  type="range" min="0" max="2" step="0.1"
                                  value={localModelTemp} onChange={e => setLocalModelTemp(parseFloat(e.target.value))}
                                  className="w-full accent-purple-500 cursor-pointer" 
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-gray-300">
                                  <span>Max. kontext (Tokens)</span>
                                  <span className="font-mono text-purple-400">{localModelMaxTokens}</span>
                                </div>
                                <input 
                                  type="range" min="256" max="32768" step="256"
                                  value={localModelMaxTokens} onChange={e => setLocalModelMaxTokens(parseInt(e.target.value, 10))}
                                  className="w-full accent-purple-500 cursor-pointer" 
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-gray-300">
                                  <span>Top-P (Koncentrácia)</span>
                                  <span className="font-mono text-purple-400">{localModelTopP.toFixed(2)}</span>
                                </div>
                                <input 
                                  type="range" min="0" max="1" step="0.05"
                                  value={localModelTopP} onChange={e => setLocalModelTopP(parseFloat(e.target.value))}
                                  className="w-full accent-purple-500 cursor-pointer" 
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-3 mt-4">
                            <button
                              onClick={downloadModel}
                              disabled={downloading}
                              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                            >
                              {downloading ? 'Iniciujem sťahovanie...' : 'Stiahnuť Dolphin Agent'}
                            </button>

                            {downloadProgress && (downloading || downloadProgress.status === 'completed' || downloadProgress.status === 'error') && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter">
                                  <span className={downloadProgress.status === 'error' ? 'text-red-400' : 'text-purple-400'}>
                                    {downloadProgress.status === 'downloading' ? `Sťahujem: ${downloadProgress.progress}%` : 
                                     downloadProgress.status === 'completed' ? 'Dokončené' : 
                                     downloadProgress.status === 'error' ? 'Chyba' : 'Pripravujem...'}
                                  </span>
                                  {downloadProgress.status === 'downloading' && (
                                    <span className="text-gray-500 animate-pulse">Sťahovanie...</span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${downloadProgress.progress}%` }}
                                    className={`h-full rounded-full ${
                                      downloadProgress.status === 'error' ? 'bg-red-500' : 
                                      downloadProgress.status === 'completed' ? 'bg-green-500' : 'bg-purple-500'
                                    }`}
                                  />
                                </div>
                                {downloadProgress.error && (
                                  <p className="text-[8px] text-red-500/80 font-mono italic">{downloadProgress.error}</p>
                                )}
                              </div>
                            )}

                            {localModels.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Stiahnuté modely v kerneli</label>
                                <div className="space-y-1.5">
                                  {localModels.map((model) => (
                                    <div key={model} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-lg group hover:border-purple-500/30 transition-all">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <FileCode className="w-3 h-3 text-purple-400 shrink-0" />
                                        <span className="text-[10px] text-gray-300 font-mono truncate">{model}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={() => applyLocalModel(model)}
                                          className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-tighter px-2 py-1 bg-blue-500/10 rounded"
                                        >
                                          Nastaviť
                                        </button>
                                        <button 
                                          onClick={() => deleteModel(model)}
                                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                          title="Vymazať model"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Standalone Check for true Fullscreen */}
                  {isMobile && !isStandalone && (
                    <div className="mt-8 p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-100 flex flex-col gap-3">
                      <div className="flex items-center gap-2 font-bold text-blue-400">
                        <Share className="w-4 h-4" />
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
                <Brain className="w-8 h-8 text-purple-400" />
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
                <LogOut className="w-8 h-8 text-red-400" />
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

      {/* Home Indicator Bar */}
      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 w-36 h-1 bg-white/20 rounded-full z-[6000] mb-0.5" />
    </div>
  );
}
