import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { RefreshCw, Plus, Minus, Maximize2, Cpu, Search, X, Activity, Zap, Shield, Database, Clock, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LauNode } from '../types';
import { hardwareBridge } from '../services/hardwareBridge';

interface NetworkGraphProps {
  nodes: LauNode[];
  validationStatuses?: Record<string, 'Valid' | 'Invalid' | 'Pending' | null>;
  chatHistory?: any[];
  transactions?: any[];
  miningSlots?: any[];
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
  onNodeInspect?: (node: any) => void;
  autoZoomRefresh?: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'node' | 'admin' | 'chat' | 'hash' | 'nuance-node';
  balance?: number;
  msg?: string;
  timestamp?: string;
  state_hash?: string;
  isValidated?: boolean;
  isInvalid?: boolean;
  isPending?: boolean;
  isMining?: boolean;
  semanticValue?: number;
  psi_index?: number;
  weight?: number;
  val?: number; // Size for force graph
  color?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  type?: 'network' | 'semantic' | 'hash-link' | 'core-link' | 'similarity-link' | 'proximity-link' | 'transaction';
  speed?: number;
  color?: string;
}

// 2D Drawing helpers
const drawFractalCloud = (ctx: CanvasRenderingContext2D, width: number, height: number, globalScale: number, time: number) => {
  const density = Math.min(300, Math.max(100, 500 / globalScale));
  const seed = 42;
  const rng = (i: number) => {
    const x = Math.sin(i + seed) * 10000;
    return x - Math.floor(x);
  };

  const pulse = Math.sin(time / 1000) * 0.5 + 0.5;

  ctx.save();
  ctx.globalAlpha = Math.min(0.2, (0.1 + pulse * 0.1) / globalScale);
  ctx.fillStyle = '#10b981';

  const sScale = 1 / globalScale;
  for (let i = 0; i < density; i++) {
    const x = (rng(i * 1.1) - 0.5) * width * 5;
    const y = (rng(i * 1.2) - 0.5) * height * 5;
    const size = rng(i * 1.3) * (1.5 + pulse * 0.5) * sScale;
    
    ctx.fillRect(x, y, size, size);
    
    if (rng(i * 1.4) > 0.98) {
      ctx.save();
      ctx.globalAlpha = (0.4 + pulse * 0.4) / globalScale;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x - size, y - size, size * 3, size * 3);
      ctx.restore();
    }
  }
  ctx.restore();
};

const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number, isHighlighted: boolean, isNeighbor: boolean, hasSelection: boolean) => {
  if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || !isFinite(node.x) || !isFinite(node.y)) return;
  
  const { type, val, color, isMining, isValidated, isInvalid, isPending, label } = node;
  const time = (window as any).graphTime || Date.now();
  const pulse = Math.sin(time / 400 + (node.x + node.y) / 100) * 0.5 + 0.5;
  const radius = (val || 5) * (isHighlighted ? 1.2 : 1) * (isMining ? 1 + pulse * 0.1 : 1);
  
  if (!isFinite(radius) || radius <= 0) return;
  
  ctx.save();
  
  // Dimming effect if something else is selected
  const opacity = hasSelection ? (isHighlighted || isNeighbor ? 1 : 0.15) : 1;
  ctx.globalAlpha = opacity;
  
  // Glow effect
  if (isMining || type === 'admin' || isHighlighted || isInvalid) {
    ctx.beginPath();
    const glowRadius = isHighlighted ? radius * 4 : radius * 3;
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
    const glowColor = isMining ? `rgba(251, 191, 36, ${0.1 + pulse * 0.2})` : (isHighlighted ? 'rgba(96, 165, 250, 0.4)' : (isInvalid ? 'rgba(239, 68, 68, 0.4)' : `${color}44`));
    gradient.addColorStop(0, glowColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Ring for mining nodes
  if (isMining) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 2 / globalScale;
    ctx.arc(node.x, node.y, radius + (2 + pulse * 4) / globalScale, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = isInvalid ? '#ef4444' : (isPending ? '#3b82f6' : color);
  
  if (isHighlighted || isInvalid) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = isInvalid ? '#ef4444' : '#60a5fa';
  }

  if (type === 'nuance-node') {
    // Diamond
    ctx.moveTo(node.x, node.y - radius);
    ctx.lineTo(node.x + radius, node.y);
    ctx.lineTo(node.x, node.y + radius);
    ctx.lineTo(node.x - radius, node.y);
    ctx.closePath();
  } else if (type === 'chat') {
    // Square
    ctx.rect(node.x - radius, node.y - radius, radius * 2, radius * 2);
  } else if (type === 'admin') {
    // Hexagon
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = node.x + radius * Math.cos(angle);
      const y = node.y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    // Circle
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
  }
  
  ctx.fill();

  // Validation Ring
  if (type === 'node' || type === 'admin') {
    ctx.beginPath();
    ctx.strokeStyle = isInvalid ? '#ef4444' : (isPending ? '#3b82f6' : (isValidated ? '#22c55e' : 'rgba(255,255,255,0.1)'));
    ctx.lineWidth = 1 / globalScale;
    ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI);
    ctx.stroke();
  }

  // Label - Only show if node is highlighted or neighbor, or if nothing is selected
  if (globalScale > 1.5 && (!hasSelection || isHighlighted || isNeighbor)) {
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHighlighted ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(label, node.x, node.y + radius + 10 / globalScale);
  }

  ctx.restore();
};

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  nodes, 
  validationStatuses = {},
  chatHistory = [], 
  transactions = [],
  miningSlots = [],
  width = 800, 
  height = 600,
  onNodeClick,
  onNodeInspect,
  autoZoomRefresh
}) => {
  const fgRef = useRef<any>(null);
  const [localGraphData, setLocalGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const [isInitialized, setIsInitialized] = useState(false);
  const [hwBoost, setHwBoost] = useState(1.0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [neighbors, setNeighbors] = useState<Set<string>>(new Set());
  const [currentScale, setCurrentScale] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return localGraphData.nodes;
    const q = searchQuery.toLowerCase();
    return localGraphData.nodes.filter(n => 
      n.label.toLowerCase().includes(q) || 
      n.id.toLowerCase().includes(q)
    );
  }, [localGraphData.nodes, searchQuery]);

  useEffect(() => {
    const unsubscribe = hardwareBridge.subscribe(() => {
      setHwBoost(hardwareBridge.getAccelerationMultiplier());
    });
    return unsubscribe;
  }, []);

  // Generate data function
  const generateData = useCallback(() => {
    const displayNodes = [...nodes].sort((a, b) => a.address.localeCompare(b.address));
    
    const semanticIndices = displayNodes
      .map((n, i) => (n.address.startsWith('0xLaurinCore') || n.address.startsWith('0xLau96569')) ? i : -1)
      .filter(i => i !== -1);

    const gNodes: GraphNode[] = displayNodes.map((n, i) => {
      const status = validationStatuses[n.address];
      const isCore = n.address && (n.address.startsWith('0xLaurinCore') || n.address.startsWith('0xLau96569'));
      const isNuance = n.address && n.address.startsWith('0xLaurinNuance');
      const recentMiner = miningSlots.some(s => s.lastMiner === n.address && (Date.now() - s.lastMinedAt < 30000));

      let color = '#10b981'; // Emerald
      if (n.address && n.address.startsWith('0xLau96569')) color = '#3b82f6'; // Blue
      if (isCore) color = '#3b82f6';
      if (isNuance) color = '#8b5cf6';

      return {
        id: n.address || `unknown_${i}`,
        label: n.displayName || (n.address && n.address.startsWith('0xLaurinCore') ? n.address.split('_')[1].toUpperCase() : (n.address || '').substring(0, 6) + "..."),
        type: (n.address || '').startsWith('0xLau96569') ? 'admin' : 'node',
        balance: n.balance,
        state_hash: n.state_hash,
        isValidated: status === 'Valid',
        isInvalid: status === 'Invalid',
        isPending: status === 'Pending',
        isMining: recentMiner,
        val: isCore ? 12 : (isNuance ? 8 : 5),
        color: color
      };
    });

    const gLinks: GraphLink[] = [];
    
    // Optimization: Pre-group nodes by prefix for proximity links
    const prefixMap = new Map<string, string[]>();
    displayNodes.forEach(node => {
      const prefix = (node.address || '').substring(0, 8);
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
      prefixMap.get(prefix)!.push(node.address);
    });

    displayNodes.forEach((node, i) => {
      // Link to core nodes with lower probability to keep graph clean
      if (semanticIndices.length > 0 && !semanticIndices.includes(i)) {
        if (i % 3 === 0) { // Only 33% of nodes link to a core node directly
          const targetIndex = semanticIndices[i % semanticIndices.length];
          gLinks.push({
            source: node.address,
            target: displayNodes[targetIndex].address,
            value: 2,
            type: 'network',
            speed: 0.8,
            color: '#a855f7'
          });
        }
      }

      if (node.address.startsWith('0xLaurinNuance')) {
        const corePrefix = (node.displayName || "").split('_')[1];
        const coreNode = displayNodes.find(n => n.address.startsWith('0xLaurinCore') && n.displayName?.includes(corePrefix));
        if (coreNode) {
          gLinks.push({
            source: node.address,
            target: coreNode.address,
            value: 4,
            type: 'core-link',
            speed: 1.0,
            color: '#3b82f6'
          });
        }
      }

      // Optimized proximity links - only for a subset to avoid clutter
      if (i % 2 === 0) {
        const prefix = (node.address || '').substring(0, 8);
        const similarAddresses = prefixMap.get(prefix) || [];
        similarAddresses.slice(0, 2).forEach(targetAddr => { // Limit to 2 similar nodes
          if (targetAddr !== node.address && targetAddr > node.address) {
            gLinks.push({
              source: node.address,
              target: targetAddr,
              value: 1.5,
              type: 'proximity-link',
              speed: 0.5,
              color: '#10b981'
            });
          }
        });
      }

      // Random network links - more sparse
      const nodeSeed = node.address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      if (nodeSeed % 5 === 0) { // Only 20% of nodes have random links
        const targetIndex = (nodeSeed * 13) % displayNodes.length;
        if (targetIndex !== i) {
          gLinks.push({
            source: node.address,
            target: displayNodes[targetIndex].address,
            value: 1,
            type: 'network',
            speed: 0.1,
            color: '#444'
          });
        }
      }
    });

    chatHistory.forEach((chat, idx) => {
      const isNewNode = chat.msg?.includes('NEW_NODE:');
      let parsedNodeData = null;
      if (isNewNode) {
        try {
          const jsonStr = chat.msg.replace('NEW_NODE: ', '');
          parsedNodeData = JSON.parse(jsonStr);
        } catch (e) {}
      }

      const chatId = `chat_${idx}`;
      if (parsedNodeData) {
        const psi = parsedNodeData.psi_index || 0.1;
        const weight = parsedNodeData.weight || 10;
        const semanticValue = psi * weight;
        const generatedCoins = parsedNodeData.minted_lau !== undefined ? parsedNodeData.minted_lau : Math.floor(semanticValue * 100);

        gNodes.push({
          id: chatId,
          label: parsedNodeData.category ? parsedNodeData.category.toUpperCase() : 'NUANCE',
          type: 'nuance-node',
          msg: `PSI: ${psi} | W: ${weight}`,
          timestamp: chat.timestamp,
          psi_index: psi,
          weight: weight,
          balance: generatedCoins,
          semanticValue: semanticValue,
          val: 8,
          color: '#8b5cf6'
        });

        if (parsedNodeData.connected_to && Array.isArray(parsedNodeData.connected_to)) {
          parsedNodeData.connected_to.forEach((targetId: string) => {
            let targetNode = displayNodes.find(n => n.address === targetId || n.id.toString() === targetId);
            if (!targetNode && displayNodes.length > 0) {
              targetNode = displayNodes[idx % displayNodes.length];
            }
            if (targetNode) {
              gLinks.push({
                source: chatId,
                target: targetNode.address,
                value: 4,
                type: 'semantic',
                speed: 0.6,
                color: '#a855f7'
              });
            }
          });
        }
      } else {
        gNodes.push({
          id: chatId,
          label: chat.user.toUpperCase(),
          type: 'chat',
          msg: chat.msg,
          timestamp: chat.timestamp,
          val: 6,
          color: '#a855f7'
        });

        const anchorNode = displayNodes[idx % displayNodes.length];
        if (anchorNode) {
          gLinks.push({
            source: chatId,
            target: anchorNode.address,
            value: 2,
            type: 'semantic',
            speed: 0.6,
            color: '#a855f7'
          });
        }
      }
    });

    transactions.slice(0, 15).forEach((tx, idx) => {
      const fromNode = displayNodes.find(n => n.address === tx.from);
      const toNode = displayNodes.find(n => n.address === tx.to);
      if (fromNode && toNode) {
        gLinks.push({
          source: tx.from,
          target: tx.to,
          value: 3,
          type: 'transaction',
          speed: 1.2,
          color: '#f43f5e'
        });
      }
    });

    return { nodes: gNodes, links: gLinks };
  }, [nodes, chatHistory, transactions, miningSlots]);

  useEffect(() => {
    if (!isInitialized) {
      const data = generateData();
      setLocalGraphData(data);
      setIsInitialized(true);
      
      // Warmup simulation to prevent initial "explosion"
      if (fgRef.current) {
        fgRef.current.d3Force('charge').strength(-120);
        fgRef.current.d3Force('link').distance(50);
        fgRef.current.d3Force('center').strength(0.1);
      }
      
      // Initial zoom
      setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoom(2, 2000);
        }
      }, 500);
    }
  }, [isInitialized, generateData]);

  useEffect(() => {
    if (autoZoomRefresh && isInitialized) {
      const interval = setInterval(() => {
        if (fgRef.current) {
          const currentData = fgRef.current.graphData();
          if (currentData && currentData.nodes && currentData.nodes.length > 0) {
            const highGravityNode = currentData.nodes.reduce((max: any, n: any) => ((n.val || 0) > (max.val || 0)) ? n : max, currentData.nodes[0]);
            if (highGravityNode && highGravityNode.x !== undefined && highGravityNode.y !== undefined) {
              fgRef.current.centerAt(highGravityNode.x, highGravityNode.y, 1000);
            }
          }

          const currentZoom = fgRef.current.zoom();
          fgRef.current.zoom(currentZoom * 0.5, 1000); 
        }
      }, 3140);
      
      return () => clearInterval(interval);
    }
  }, [autoZoomRefresh, isInitialized]);

  const handleZoom = useCallback((factor: number) => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * factor, 400);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.centerAt(0, 0, 800);
      fgRef.current.zoom(2, 800);
    }
    setSelectedNode(null);
    setNeighbors(new Set());
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    if (selectedNode?.id === node.id) {
      setSelectedNode(null);
      setNeighbors(new Set());
      setIsSidebarOpen(false);
    } else {
      setSelectedNode(node);
      setIsSidebarOpen(true);
      const neighborIds = new Set<string>();
      localGraphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        
        if (sourceId === node.id) neighborIds.add(targetId);
        if (targetId === node.id) neighborIds.add(sourceId);
      });
      setNeighbors(neighborIds);
      
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 1000);
        fgRef.current.zoom(4, 1000);
      }
    }

    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [selectedNode, localGraphData.links, onNodeClick]);

  const handleSearchSelect = (node: any) => {
    setSearchQuery('');
    handleNodeClick(node);
  };

  return (
    <div className="w-full h-full bg-[#050505] rounded-2xl overflow-hidden border border-white/5 relative group">
      {/* Search Input */}
      <div className="absolute top-4 left-4 z-10 w-64">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search network nodes..."
            className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono"
          />
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
              {filteredNodes.length > 0 ? (
                filteredNodes.slice(0, 10).map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleSearchSelect(n)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: n.color }} />
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-white uppercase tracking-wider">{n.label}</div>
                      <div className="text-[8px] font-mono text-gray-500 truncate">{n.id}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-[10px] text-gray-500 text-center uppercase font-bold italic">No nodes found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Node Detail Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && selectedNode && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="absolute top-4 bottom-4 right-4 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col z-20 shadow-2xl overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: selectedNode.color }} />
                <h3 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[150px]">
                  {selectedNode.label}
                </h3>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {/* Core Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] text-gray-500 uppercase font-black mb-1 flex items-center gap-1">
                    <Database size={8} /> Balance
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {selectedNode.balance?.toLocaleString() || 0} <span className="text-[8px] opacity-60">LAU</span>
                  </div>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="text-[8px] text-gray-500 uppercase font-black mb-1 flex items-center gap-1">
                    <Activity size={8} /> Type
                  </div>
                  <div className="text-xs font-mono font-bold text-purple-400 capitalize">
                    {selectedNode.type}
                  </div>
                </div>
              </div>

              {/* Address / Hash Section */}
              <div className="space-y-3">
                <div>
                  <div className="text-[8px] text-gray-500 uppercase font-black mb-1 flex items-center gap-1">
                    <Shield size={8} /> Network Address
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-[9px] font-mono text-gray-400 break-all select-all">
                    {selectedNode.id}
                  </div>
                </div>
                {selectedNode.state_hash && (
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-black mb-1 flex items-center gap-1">
                      <Zap size={8} /> State Hash
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-[9px] font-mono text-blue-400/70 break-all">
                      {selectedNode.state_hash}
                    </div>
                  </div>
                )}
              </div>

              {/* Semantic Metadata (if applicable) */}
              {(selectedNode.psi_index || selectedNode.semanticValue) && (
                <div className="space-y-4 pt-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Semantic Node Properties</div>
                  
                  <div className="space-y-3">
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] uppercase font-bold text-gray-500">PSI Efficiency</span>
                        <span className="text-[8px] font-mono text-emerald-400">{((selectedNode.psi_index || 0) * 100).toFixed(2)}%</span>
                      </div>
                      <div className="overflow-hidden h-1 text-xs flex rounded bg-white/5">
                        <div style={{ width: `${(selectedNode.psi_index || 0) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"></div>
                      </div>
                    </div>
                    
                    <div className="relative pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] uppercase font-bold text-gray-500">Weight Factor</span>
                        <span className="text-[8px] font-mono text-purple-400">{(selectedNode.weight || 0).toFixed(2)}</span>
                      </div>
                      <div className="overflow-hidden h-1 text-xs flex rounded bg-white/5">
                        <div style={{ width: `${(selectedNode.weight || 0) * 10}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Activity (Contextual) */}
              <div className="space-y-3 pt-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <Clock size={10} /> Node Transactions
                </div>
                {transactions.filter(tx => tx.from === selectedNode.id || tx.to === selectedNode.id).length > 0 ? (
                  <div className="space-y-2">
                    {transactions
                      .filter(tx => tx.from === selectedNode.id || tx.to === selectedNode.id)
                      .slice(0, 5)
                      .map((tx, i) => (
                        <div key={i} className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded ${tx.from === selectedNode.id ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'} uppercase font-black`}>
                              {tx.from === selectedNode.id ? 'Sent' : 'Received'}
                            </span>
                            <span className="text-[8px] font-mono text-gray-500">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-gray-300">{tx.amount.toLocaleString()} LAU</span>
                            <ArrowRightLeft size={10} className="text-gray-600" />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-[9px] text-gray-600 italic font-medium p-4 border border-dashed border-white/5 rounded-xl text-center">
                    No recent transaction activity found for this node endpoint.
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-2">
              <button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all shadow-lg active:scale-95"
                onClick={() => {
                  if (onNodeInspect) onNodeInspect(selectedNode);
                }}
              >
                Inspect Core
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ForceGraph2D
        ref={fgRef}
        graphData={localGraphData}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const isHighlighted = selectedNode?.id === node.id;
          const isNeighbor = neighbors.has(node.id);
          drawNode(node, ctx, globalScale, isHighlighted, isNeighbor, !!selectedNode);
        }}
        nodeRelSize={4}
        nodeLabel={node => {
          const n = node as GraphNode;
          return `
            <div class="bg-black/90 border border-white/10 p-3 rounded-xl backdrop-blur-md shadow-2xl min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-2 h-2 rounded-full" style="background-color: ${n.color}"></div>
                <span class="text-white font-black text-xs uppercase tracking-widest">${n.label}</span>
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between text-[10px]">
                  <span class="text-gray-500 uppercase font-bold">Balance</span>
                  <span class="text-emerald-400 font-mono">${n.balance?.toLocaleString() || 0} LAU</span>
                </div>
                ${n.state_hash ? `
                <div class="flex justify-between text-[10px] gap-4">
                  <span class="text-gray-500 uppercase font-bold">State Hash</span>
                  <span class="text-blue-400 font-mono truncate max-w-[100px]">${n.state_hash}</span>
                </div>
                ` : ''}
                <div class="flex justify-between text-[10px]">
                  <span class="text-gray-500 uppercase font-bold">Type</span>
                  <span class="text-gray-300 uppercase">${n.type}</span>
                </div>
                ${n.msg ? `
                <div class="mt-2 pt-2 border-t border-white/5 text-[10px] text-gray-400 italic">
                  "${n.msg}"
                </div>
                ` : ''}
              </div>
            </div>
          `;
        }}
        linkDirectionalParticles={d => {
          const l = d as any;
          const isRelated = selectedNode && (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
          const isTransaction = l.type === 'transaction';
          
          // Base particles - reduced for performance
          let particles = (isRelated || isTransaction) ? Math.round(2 * hwBoost) : 0;
          
          // Optimization: Reduce animated particles significantly when zoomed out
          if (currentScale < 0.5 && particles > 0) {
            particles = 0;
          }
          
          return particles;
        }}
        linkDirectionalParticleSpeed={d => (d as GraphLink).speed! * 0.01 * hwBoost}
        linkDirectionalParticleWidth={d => {
          const l = d as any;
          const isRelated = selectedNode && (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
          return isRelated ? 3 : 2;
        }}
        linkDirectionalParticleColor={() => '#60a5fa'}
        linkColor={d => {
          const l = d as any;
          const isRelated = selectedNode && (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
          if (selectedNode && !isRelated) return 'rgba(30, 41, 59, 0.05)';
          const baseColor = (d as GraphLink).color || '#1e293b';
          return isRelated ? '#60a5fa' : `${baseColor}22`; // Reduced opacity
        }}
        linkWidth={d => {
          const l = d as any;
          const isRelated = selectedNode && (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
          return isRelated ? 2 : 1;
        }}
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        height={height}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          setSelectedNode(null);
          setNeighbors(new Set());
        }}
        onRenderFramePre={(ctx, globalScale) => {
          drawFractalCloud(ctx, width, height, globalScale, performance.now());
        }}
        onZoom={({ k }) => setCurrentScale(k)}
        enableNodeDrag={false} // Disable dragging for more stability
        enableZoomInteraction={true}
        enablePanInteraction={true}
        warmupTicks={20}
        cooldownTicks={10}
        d3AlphaDecay={0.1}
        d3VelocityDecay={0.4}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-[10px] space-y-2 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-gray-300 uppercase font-black tracking-wider">Admin Core</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-gray-300 uppercase font-black tracking-wider">Aktívne Uzly</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-3 bg-purple-500 rounded-sm shadow-[0_0_8rgba(168,85,247,0.5)]" />
          <span className="text-gray-300 uppercase font-black tracking-wider">Sémantický Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rotate-45 bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
          <span className="text-gray-300 uppercase font-black tracking-wider">Nuance Node</span>
        </div>
        <div className="pt-2 mt-2 border-t border-white/10">
          <div className="text-gray-500 italic font-medium flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>{localGraphData.nodes.length} Aktívnych Entít</span>
              {hwBoost > 1 && (
                <span className="text-blue-400 flex items-center gap-1 animate-pulse">
                  <Cpu size={10} />
                  HW BOOST {((hwBoost - 1) * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-emerald-400 font-mono text-[8px] animate-pulse">
              <span>150,000,000,000,000 ENTÍT AKTIVOVANÝCH</span>
              <span>GLOBAL SYNC: ONLINE</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Control Buttons Panel */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <button 
            onClick={() => setIsInitialized(false)}
            title="Refresh Network"
            className="bg-white/5 hover:bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 text-gray-400 transition-all"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={handleReset}
            title="Reset Camera"
            className="bg-white/5 hover:bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 text-gray-400 transition-all"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
          <button 
            onClick={() => handleZoom(1.2)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
          >
            <Plus size={16} />
          </button>
          <div className="h-px bg-white/10 mx-2" />
          <button 
            onClick={() => handleZoom(0.8)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
          >
            <Minus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

