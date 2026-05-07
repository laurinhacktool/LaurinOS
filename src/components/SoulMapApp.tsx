import React, { useState, useEffect, useRef } from 'react';
import { NetworkGraph } from './NetworkGraph';
import { db } from '../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { onSnapshot } from '../firebase';
import { LauNode, Transaction, MiningSlot } from '../types';
import { motion } from 'motion/react';
import { Maximize2, Shield, Search, X, Globe } from 'lucide-react';

import { generateNetwork } from '../services/networkGenerator';

export function SoulMapApp() {
  const [nodes, setNodes] = useState<LauNode[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [miningSlots, setMiningSlots] = useState<MiningSlot[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Robust fetch helper for core API
  const fetchCore = async (path: string, options: RequestInit = {}, retries = 5, delay = 2000): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${window.location.origin}${path}`, options);
        if (response.status === 502 || response.status === 429) {
          const isRateLimit = response.status === 429;
          await new Promise(r => setTimeout(r, isRateLimit ? delay * 2 : delay));
          continue;
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          if (text.includes("Starting Server") || text.includes("<!doctype html>")) {
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new TypeError(`Expected JSON from ${path}`);
        }
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error(err);
          return null; // Return null on failure instead of throwing to avoid breaking UI
        }
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  
  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout;

    const init = async () => {
      const { nodes: generatedNodes } = await generateNetwork();
      setNodes(generatedNodes);
      
      try {
        const data = await fetchCore('/core-api/status', {}, 2, 1000);
        if (data && data.chat) {
          setChatHistory(data.chat);
        }
      } catch (err) {
        console.error("Failed to load chat history for graph:", err);
      }
    };
    init();

    const fetchStatus = async () => {
      if (!isMounted) return;
      try {
        const res = await fetchCore('/core-api/status', {}, 1, 1000);
        if (res && res.chat && isMounted && chatHistory.length === 0) {
           // setChatHistory(res.chat) // could load if empty
        }
        if (isMounted) {
          const nodesRes = await fetchCore('/core-api/laucoin/nodes', {}, 1, 1000);
          if (nodesRes && nodesRes.nodes && isMounted) {
            setNodes(nodesRes.nodes);
          }
        }
      } catch (err) {
        if (isMounted) console.warn("SoulMapApp: Status sync delayed");
      } finally {
        if (isMounted) {
          pollTimer = setTimeout(fetchStatus, 8000);
        }
      }
    };
    fetchStatus();

    const unsubscribeNodes = onSnapshot(query(collection(db, 'nodes'), limit(100)), (snapshot) => {
      const cloudNodes = snapshot.docs.map(doc => ({
        address: doc.id,
        ...doc.data()
      })) as any[];
      
      setNodes(prev => {
        const merged = [...prev];
        cloudNodes.forEach(cn => {
          const idx = merged.findIndex(n => n.address === cn.address);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...cn };
          } else {
            merged.push({
              id: cn.id || merged.length + 1,
              address: cn.address,
              private_key: cn.private_key || '0xHidden',
              state_hash: cn.state_hash || '0xPending',
              balance: cn.balance || 0,
              displayName: cn.displayName || cn.address.substring(0, 15),
              ...cn
            });
          }
        });
        return merged;
      });
    });

    const txQ = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeTxs = onSnapshot(txQ, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    });

    const unsubscribeMining = onSnapshot(query(collection(db, 'mining_slots'), limit(100)), (snapshot) => {
      const slots = snapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as MiningSlot[];
      setMiningSlots(slots);
    });

    const unsubscribeChat = onSnapshot(query(collection(db, 'chat'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      const chat = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(chat);
    });

    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
      unsubscribeNodes();
      unsubscribeTxs();
      unsubscribeMining();
      unsubscribeChat();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#050510] text-slate-200 overflow-hidden">
      <div className="flex-1 relative min-h-0 overflow-hidden" ref={containerRef}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <div className="absolute inset-0">
            <NetworkGraph 
              nodes={nodes}
              chatHistory={chatHistory}
              transactions={transactions}
              miningSlots={miningSlots}
              width={dimensions.width}
              height={dimensions.height}
              autoZoomRefresh={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
