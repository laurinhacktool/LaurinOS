import React, { useState, useEffect, useRef } from 'react';
import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryCharging, Mic, MicOff, Activity, Info, Cpu, HardDrive, Globe, Users, Wifi, Zap, Smartphone, ShieldCheck, RefreshCw, Loader2, CheckCircle2, AlertCircle, ExternalLink, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, doc, setDoc, onSnapshot, collection, query, orderBy, limit, serverTimestamp, handleFirestoreError, OperationType, Timestamp } from '../firebase';
import { hardwareBridge, HWDevice } from '../services/hardwareBridge';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: EventListener;
  onchargingtimechange: EventListener;
  ondischargingtimechange: EventListener;
  onlevelchange: EventListener;
}

interface NetworkNode {
  uid: string;
  email: string;
  batteryLevel: number;
  isCharging: boolean;
  platform: string;
  lastUpdate: any;
}

interface LearningTask {
  status: 'starting' | 'ingesting' | 'analyzing' | 'completed' | 'error';
  progress: number;
  entities: string[];
  start_time: number;
  error?: string;
}

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

export const SystemInfoApp: React.FC = () => {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isKernelSyncing, setIsKernelSyncing] = useState(false);
  const [hwDevices, setHwDevices] = useState<HWDevice[]>([]);
  const [learningTasks, setLearningTasks] = useState<Record<string, LearningTask>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Poll for kernel status (includes learning tasks)
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch('/core-api/status', {
          headers: {
            'Accept': 'application/json'
          }
        });
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          try {
            const data = await res.json();
            if (data && data.learning_tasks) setLearningTasks(data.learning_tasks);
          } catch (parseErr) {
            console.error("SystemInfoApp: JSON parse error", parseErr);
          }
        }
      } catch (err) {
        console.error("SystemInfoApp: Status poll failed", err);
      }
    };

    const timer = setInterval(pollStatus, 2000);
    pollStatus();
    return () => clearInterval(timer);
  }, []);

  // Battery monitoring and Firestore sync
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((bm) => {
        const updateBattery = () => {
          const level = bm.level * 100;
          const charging = bm.charging;
          setBattery({ level, charging });
          
          // Sync to Firestore if user is logged in
          if (auth.currentUser) {
            const nodeRef = doc(db, 'nodes', auth.currentUser.uid);
            setDoc(nodeRef, {
              uid: auth.currentUser.uid,
              email: auth.currentUser.email || 'Anonymous',
              batteryLevel: level,
              isCharging: charging,
              platform: navigator.platform,
              lastUpdate: serverTimestamp()
            }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, 'nodes/' + auth.currentUser?.uid));
          }
        };
        updateBattery();
        bm.onlevelchange = updateBattery;
        bm.onchargingchange = updateBattery;
      });
    }
  }, []);

  // Listen for other nodes
  useEffect(() => {
    if (!auth.currentUser) {
      setNetworkNodes([]);
      return;
    }

    const q = query(collection(db, 'nodes'), orderBy('lastUpdate', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const nodes: NetworkNode[] = [];
      snapshot.forEach((doc) => {
        nodes.push(doc.data() as NetworkNode);
      });
      setNetworkNodes(nodes);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes'));

    return () => unsubscribe();
  }, [auth.currentUser]);

  const toggleMic = async () => {
    if (isMicActive) {
      stopMic();
    } else {
      startMic();
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setIsMicActive(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setAudioLevel(average);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Prístup k mikrofónu bol zamietnutý.");
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.error("Error closing AudioContext:", err));
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMicActive(false);
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => stopMic();
  }, []);

  useEffect(() => {
    const unsubscribe = hardwareBridge.subscribe(setHwDevices);
    
    // Auto-pairing logic: Listen for USB connection events
    const handleConnect = async (event: USBConnectionEvent) => {
      console.log('USB Device connected:', event.device);
      // We attempt to pair it if it's a known device type
      try {
        await hardwareBridge.requestDevice();
      } catch (err) {
        console.log('Auto-pairing requires user gesture or previous authorization');
      }
    };

    if (navigator.usb) {
      navigator.usb.addEventListener('connect', handleConnect);
    }
    
    return () => {
      unsubscribe();
      if (navigator.usb) {
        navigator.usb.removeEventListener('connect', handleConnect);
      }
    };
  }, []);

  const totalAcceleration = hardwareBridge.getAccelerationMultiplier();

  const syncNow = async () => {
    if (!auth.currentUser || isSyncing) return;
    setIsSyncing(true);
    
    try {
      if (navigator.getBattery) {
        const bm = await navigator.getBattery();
        const level = bm.level * 100;
        const charging = bm.charging;
        
        const nodeRef = doc(db, 'nodes', auth.currentUser.uid);
        await setDoc(nodeRef, {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || 'Anonymous',
          batteryLevel: level,
          isCharging: charging,
          platform: navigator.platform,
          lastUpdate: serverTimestamp()
        }, { merge: true });
      }
      // Artificial delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.error("Manual sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncKernel = async () => {
    if (isKernelSyncing) return;
    setIsKernelSyncing(true);
    try {
      const response = await fetch('/core-api/laucoin/init', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: [] })
      });
      if (!response.ok) throw new Error('Kernel sync failed');
      const data = await response.json();
      console.log('Kernel Sync Success:', data);
      // Trigger a global event or just show success
      alert("Kernel a databáza boli úspešne synchronizované.");
    } catch (err) {
      console.error("Kernel sync error:", err);
      alert("Chyba pri synchronizácii kernelu.");
    } finally {
      setIsKernelSyncing(false);
    }
  };

  const getBatteryIcon = (level: number, charging: boolean) => {
    if (charging) return <BatteryCharging className="w-5 h-5 text-emerald-500" />;
    if (level > 80) return <BatteryFull className="w-5 h-5 text-emerald-500" />;
    if (level > 40) return <BatteryMedium className="w-5 h-5 text-yellow-500" />;
    return <BatteryLow className="w-5 h-5 text-red-500" />;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Práve teraz';
    try {
      const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'Neznámy čas';
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Chybný formát';
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-900 dark:text-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6 overflow-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <Activity className="w-6 h-6 text-blue-600 dark:text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Systémové Senzory</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Monitorovanie zariadenia v reálnom čase</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Battery Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Lokálna Batéria</h2>
              <p className="text-2xl font-black">{battery ? `${Math.round(battery.level)}%` : 'Neznáme'}</p>
            </div>
            {battery && getBatteryIcon(battery.level, battery.charging)}
          </div>
          <div className="w-full bg-black/5 dark:bg-white/5 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: battery ? `${battery.level}%` : '0%' }}
              className={`h-full ${battery?.level && battery.level < 20 ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
            />
          </div>
          <p className="text-[10px] text-gray-500 uppercase">
            Status: <span className={battery?.charging ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>
              {battery?.charging ? 'Nabíja sa' : 'Vybíja sa'}
            </span>
          </p>
        </motion.div>

        {/* Microphone Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
        >
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Mikrofón</h2>
              <p className="text-2xl font-black">{isMicActive ? 'Aktívny' : 'Neaktívny'}</p>
            </div>
            <button 
              onClick={toggleMic}
              className={`p-3 rounded-full transition-all ${isMicActive ? 'bg-red-500/20 text-red-600 dark:text-red-500' : 'bg-blue-500/20 text-blue-600 dark:text-blue-500 hover:bg-blue-500/30'}`}
            >
              {isMicActive ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
          </div>
          
          <div className="flex items-end gap-1 h-12 bg-black/5 dark:bg-black/40 rounded-lg p-2 overflow-hidden">
            {isMicActive ? (
              Array.from({ length: 20 }).map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ 
                    height: `${Math.max(10, (audioLevel / 100) * (50 + Math.random() * 50))}%`,
                    backgroundColor: audioLevel > 50 ? '#ef4444' : '#3b82f6'
                  }}
                  className="flex-1 rounded-t-sm"
                />
              ))
            ) : (
              <div className="w-full h-px bg-black/10 dark:bg-white/10 self-center" />
            )}
          </div>
          <p className="text-[10px] text-gray-500 uppercase">
            Citlivosť: <span className="text-blue-600 dark:text-blue-400">{Math.round(audioLevel)}%</span>
          </p>
        </motion.div>

        {/* Hardware Acceleration Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 md:col-span-2 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Hardware Akcelerácia</h2>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
              <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold uppercase">
                Boost: {((totalAcceleration - 1) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {hwDevices.length === 0 ? (
              <div className="col-span-full py-4 text-center text-[10px] text-gray-500 uppercase tracking-widest opacity-50">
                Žiadne externé HW zariadenia neboli detekované
              </div>
            ) : (
              hwDevices.map(device => (
                <div key={device.id} className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                  <div className={`p-2 rounded-lg ${device.type === 'INTERNAL' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                    {device.type === 'INTERNAL' ? <Smartphone className="w-4 h-4 text-emerald-500" /> : <Cpu className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-bold truncate">{device.name}</p>
                    <p className="text-[9px] text-emerald-500 font-mono">+{((device.accelerationFactor - 1) * 100).toFixed(0)}% Boost</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Semantic Learning Matrix Card */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 md:col-span-2 shadow-xl"
        >
          <div className="p-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${Object.values(learningTasks).some(t => t.status !== 'completed' && t.status !== 'error') ? 'text-purple-400 animate-pulse' : 'text-gray-500'}`} />
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Sémantická Matrica (Učenie)</h2>
            </div>
            {Object.values(learningTasks).some(t => t.status !== 'completed' && t.status !== 'error') && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {Object.keys(learningTasks).length === 0 ? (
                <div className="col-span-full py-8 text-center text-[10px] text-gray-500 uppercase tracking-widest opacity-50">
                  Žiadne aktívne sémantické ingescie
                </div>
              ) : (
                Object.entries(learningTasks).sort((a, b) => b[1].start_time - a[1].start_time).map(([url, task]) => (
                  <motion.div
                    key={url}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/5 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        ) : task.status === 'error' ? (
                          <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        ) : (
                          <Loader2 className="w-3 h-3 text-purple-400 animate-spin flex-shrink-0" />
                        )}
                        <span className="text-[10px] font-mono text-gray-400 truncate">{url}</span>
                      </div>
                      <a href={url} target="_blank" rel="noreferrer" className="p-1 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-white">
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] uppercase font-bold text-gray-600">
                        <span>{task.status}</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="h-1 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress}%` }}
                          className={`h-full ${
                            task.status === 'error' ? 'bg-red-500' : 
                            task.status === 'completed' ? 'bg-emerald-500' : 
                            'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                          }`}
                        />
                      </div>
                    </div>

                    {task.entities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {task.entities.map((e, i) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono capitalize">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Network Nodes Card */}
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 md:col-span-2 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-500" />
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Sieťové Uzly (Zdieľané Senzory)</h2>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={syncNow}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-bold uppercase
                  ${isSyncing 
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400 cursor-wait' 
                    : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 active:scale-95'
                  }`}
              >
                <motion.div
                  animate={isSyncing ? { rotate: 360 } : {}}
                  transition={isSyncing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
                >
                  <Activity className="w-3 h-3" />
                </motion.div>
                {isSyncing ? 'Synchronizujem...' : 'Vynútiť Aktualizáciu'}
              </button>
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                <Wifi className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{networkNodes.length} Online</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {networkNodes.map((node) => (
                <motion.div 
                  key={node.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-3 rounded-xl border ${node.uid === auth.currentUser?.uid ? 'bg-blue-500/10 border-blue-500/30' : 'bg-black/5 dark:bg-black/40 border-black/5 dark:border-white/5'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="truncate pr-2">
                      <p className="text-[10px] text-gray-500 uppercase font-bold truncate">
                        {node.uid === auth.currentUser?.uid ? 'Môj Uzol' : node.email.split('@')[0]}
                      </p>
                      <p className="text-[9px] text-gray-600 truncate">{node.platform}</p>
                    </div>
                    {getBatteryIcon(node.batteryLevel, node.isCharging)}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="w-full bg-black/10 dark:bg-white/5 h-1 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${node.batteryLevel < 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${node.batteryLevel}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold">{Math.round(node.batteryLevel)}%</span>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className={`text-[8px] uppercase font-bold ${node.isCharging ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                      {node.isCharging ? 'Nabíja sa' : 'Vybíja sa'}
                    </span>
                    <span className="text-[8px] text-gray-600 uppercase">{formatTime(node.lastUpdate)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Device Info Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-2xl p-6 flex flex-col gap-4 md:col-span-2 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-500" />
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Informácie o zariadení</h2>
            </div>
            <button 
              onClick={syncKernel}
              disabled={isKernelSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold uppercase
                ${isKernelSyncing 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 cursor-wait' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20 hover:border-emerald-500/30 active:scale-95 shadow-lg shadow-emerald-500/10'
                }`}
            >
              <motion.div
                animate={isKernelSyncing ? { rotate: 360 } : {}}
                transition={isKernelSyncing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
              {isKernelSyncing ? 'Synchronizujem Kernel...' : 'Synchronizovať Kernel & DB'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
              <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-500" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Procesor</p>
                <p className="text-xs font-bold truncate">{navigator.hardwareConcurrency || '8'} Jadier</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
              <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Pamäť (RAM)</p>
                <p className="text-xs font-bold truncate">~{(navigator as any).deviceMemory || '16'} GB</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-500" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Platforma</p>
                <p className="text-xs font-bold truncate">{navigator.platform}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-auto pt-8 flex justify-center">
        <p className="text-[10px] text-gray-600 uppercase tracking-tighter">
          Všetky dáta sú synchronizované cez LauNet Cloud • Laurinos v1.0
        </p>
      </div>
    </div>
  );
};
