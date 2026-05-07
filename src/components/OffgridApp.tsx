import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Signal, Cpu, Shield, Activity, WifiOff, Globe, Send, Zap, Server } from 'lucide-react';

export function OffgridApp() {
  const [nodes, setNodes] = useState<{ id: string, name: string, distance: string, strength: number, type: string, lastSeen: string }[]>([
    { id: 'usr_891', name: 'Alpha-Relay', distance: '12m', strength: 92, type: 'Bluetooth LE', lastSeen: 'now' },
    { id: 'usr_422', name: 'Zeta-Mesh', distance: '45m', strength: 78, type: 'WiFi Direct', lastSeen: '2s ago' },
    { id: 'usr_109', name: 'Node-X9', distance: '1.2km', strength: 40, type: 'LoRaWAN', lastSeen: '1m ago' },
    { id: 'sys_001', name: 'Core Backbone', distance: 'Local', strength: 100, type: 'Serial', lastSeen: 'now' },
  ]);

  const [isScanning, setIsScanning] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setSyncStatus('syncing');
        setTimeout(() => setSyncStatus('synced'), 2000);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setNodes(prev => [
        { id: `usr_${Math.floor(Math.random() * 999)}`, name: `Node-${Math.floor(Math.random() * 99)}`, distance: `${Math.floor(Math.random() * 50)}m`, strength: Math.floor(Math.random() * 60) + 20, type: 'Bluetooth LE', lastSeen: 'now' },
        ...prev
      ].slice(0, 8));
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f0d] text-emerald-500 font-mono overflow-hidden rounded-xl border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-950/40 border-b border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="w-5 h-5 text-emerald-400" />
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`} />
          </div>
          <h2 className="text-sm font-bold tracking-widest text-emerald-400 uppercase">Offgrid Core</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-emerald-600">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            <span>MESH ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            <span>ENCRYPTED</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Server className="w-8 h-8 text-emerald-400 mb-2" />
            <div className="text-2xl font-black text-white">{nodes.length}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Active Nodes</div>
          </div>
          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <WifiOff className="w-8 h-8 text-emerald-400 mb-2" />
            <div className="text-2xl font-black text-white">0.00 <span className="text-sm text-emerald-500">KB/s</span></div>
            <div className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Inet Uplink</div>
          </div>
          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Zap className="w-8 h-8 text-emerald-400 mb-2" />
            <div className="text-2xl font-black text-white">{syncStatus === 'synced' ? 'Idle' : 'Sync'}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Queue Status</div>
          </div>
        </div>

        {/* Node Scanner */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-80 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Local Topology
            </h3>
            <button 
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Activity className="w-3 h-3" />
                  Sweep Network
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {nodes.map(node => (
              <motion.div 
                key={node.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-emerald-900/10 border border-emerald-500/10 rounded-lg hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center relative">
                    <Signal className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{node.name}</div>
                    <div className="text-[10px] mt-0.5 opacity-60 flex items-center gap-3">
                      <span className="text-emerald-300">{node.type}</span>
                      <span>ID: {node.id}</span>
                      <span>Dist: {node.distance}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[10px] opacity-70">{node.lastSeen}</div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <div 
                        key={i} 
                        className={`w-1.5 h-3 rounded-full ${i * 20 <= node.strength ? 'bg-emerald-500' : 'bg-emerald-500/20'}`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Action Area */}
        <div className="mt-8 border border-emerald-500/20 rounded-lg p-1 bg-[#050806] flex mb-8">
          <input 
            type="text" 
            placeholder="Broadcast encrypted message over mesh..." 
            className="flex-1 bg-transparent px-4 py-3 outline-none text-sm placeholder:text-emerald-700"
          />
          <button className="px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition-colors flex items-center justify-center">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
