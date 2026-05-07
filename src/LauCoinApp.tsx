import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LaurinLoginScreen } from './components/LaurinLoginScreen';
import { Search, Wallet, Shield, Activity, LogOut, Loader2, Globe, Database, Hash, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Clock, Send, AlertTriangle, Pickaxe, Coins, Zap, Bell, Check, X, Lock, Download, Terminal, Moon, Sun, Settings, LayoutDashboard, Share2, RefreshCw, ShieldCheck, Plus, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateNetwork, generateTransactionHash, getSemanticValue, generateVirtualNode } from './services/networkGenerator';
import { generateBitcoinWallet, getBitcoinBalance, deriveBitcoinWalletFromMnemonic } from './services/bitcoinService';
import { connectWallet, getTokenBalance, addWordToLexicon, getAlfaBalance, swapAlfaForLau } from './services/web3_bridge';
import { initializeNetwork } from './services/dbInitializer';
import { LauNode, Transaction, MiningSlot, LauRequest, Lease } from './types';
import { CoinDetail } from './components/CoinDetail';
import { db, auth } from './firebase';
import { collection, addDoc, query, orderBy, limit, doc, runTransaction, getDocs, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { onSnapshot } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-black/5 dark:bg-white/5 rounded ${className}`} />
);

import { NetworkGraph } from './components/NetworkGraph';
import { signTransaction } from './services/cryptoService';


export default function LauCoinApp({ systemUser, theme, setTheme }: { systemUser?: any, theme: 'light' | 'dark', setTheme: (t: 'light' | 'dark') => void }) {
  const [nodes, setNodes] = useState<LauNode[]>([]);
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'network' | 'leasing'>('dashboard');
  const [bitcoinWallet, setBitcoinWallet] = useState<{ address: string; mnemonic: string; privateKey: string; balance: number } | null>(() => {
    const saved = localStorage.getItem('bitcoinWallet');
    return saved ? JSON.parse(saved) : null;
  });
  const [bitcoinSubWallets, setBitcoinSubWallets] = useState<{ address: string; privateKey: string; index: number; balance: number }[]>(() => {
    const saved = localStorage.getItem('bitcoinSubWallets');
    return saved ? JSON.parse(saved) : [];
  });
  const [lauSubWallets, setLauSubWallets] = useState<{ address: string; privateKey: string; balance: number }[]>(() => {
    const saved = localStorage.getItem('lauSubWallets');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (bitcoinWallet) localStorage.setItem('bitcoinWallet', JSON.stringify(bitcoinWallet));
  }, [bitcoinWallet]);

  useEffect(() => {
    localStorage.setItem('bitcoinSubWallets', JSON.stringify(bitcoinSubWallets));
  }, [bitcoinSubWallets]);

  useEffect(() => {
    localStorage.setItem('lauSubWallets', JSON.stringify(lauSubWallets));
  }, [lauSubWallets]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number>(-1); // -1 for main wallet, >= 0 for sub-wallets

  const generateLauWallet = async () => {
    const randomBytes = new Uint8Array(18);
    crypto.getRandomValues(randomBytes);
    const rawAddr = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const address = `0xLau${rawAddr}`;
    
    const privBytes = new Uint8Array(24);
    crypto.getRandomValues(privBytes);
    const privHex = Array.from(privBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const privateKey = `LauPriv_${privHex}`;
    
    return { address, privateKey, balance: 0 };
  };
  const [bitcoinPriceHistory, setBitcoinPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [bitcoinStats, setBitcoinStats] = useState<{ blockHeight: number; hashRate: string; avgFee: number } | null>(null);
  const [cryptoWallets, setCryptoWallets] = useState<{ id: string; type: string; balance: number }[]>([]);
  const [semanticValue, setSemanticValue] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<LauNode | null>(null);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginAddr, setLoginAddr] = useState('');
  const [loginKey, setLoginKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<LauNode | null>(null);
  const [showRegistry, setShowRegistry] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModel, setCustomModel] = useState('');

  // Fetch initial config on load
  useEffect(() => {
    fetch('/core-api/config')
      .then(res => res.json())
      .then(data => {
        if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key);
        if (data.custom_api_url) setCustomApiUrl(data.custom_api_url);
        if (data.custom_api_key) setCustomApiKey(data.custom_api_key);
        if (data.custom_model) setCustomModel(data.custom_model);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout;

    const fetchStatus = async () => {
      if (!isMounted) return;
      try {
        const res = await fetchCore('/core-api/status', {}, 1, 1000); // 1 retry only for polling
        if (res && isMounted) {
          const nodesRes = await fetchCore('/core-api/laucoin/nodes', {}, 1, 1000);
          if (nodesRes && nodesRes.nodes && isMounted) {
            setNodes(nodesRes.nodes);
          }
          if (res.learning_tasks && isMounted) setLearningTasks(res.learning_tasks);
        }
      } catch (err) {
        if (isMounted) console.warn("LauCoinApp: Status sync delayed");
      } finally {
        if (isMounted) {
          pollTimer = setTimeout(fetchStatus, 8000);
        }
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
    };
  }, [isAuthed]);

  useEffect(() => {
    const handleSemanticNode = (e: any) => {
      if (e.detail && e.detail.psi_index) {
        // Calculate new semantic value based on psi_index (100 to 500000)
        // Normalize to a percentage (0.0 to 1.0) and add to current value
        const normalized = e.detail.psi_index / 500000;
        setSemanticValue(prev => {
          const current = prev !== null ? prev : (user ? getSemanticValue(user) : 0);
          return Math.min(1.5, current + (normalized * 0.1)); // Max 150%
        });
      }
    };

    window.addEventListener('semantic_node_forged', handleSemanticNode);
    return () => window.removeEventListener('semantic_node_forged', handleSemanticNode);
  }, [user]);

  // Removed auto-assignment of user based on systemUser
  /*
  useEffect(() => {
    const assignUser = async () => {
      if (systemUser && nodes.length > 0 && !user) {
        // Check if user has a node assigned in Firestore
        const userDocRef = doc(db, 'users', systemUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists() && userDocSnap.data().assignedNode) {
            const assignedNode = userDocSnap.data().assignedNode;
            setUser({ ...assignedNode, displayName: systemUser.displayName || 'User', email: systemUser.email || '' });
            setIsAuthed(true);
          } else {
            // Assign a new node
            const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
            const userWithMeta = { ...randomNode, displayName: systemUser.displayName || 'User', email: systemUser.email || '' };
            setUser(userWithMeta);
            await setDoc(userDocRef, { assignedNode: userWithMeta });
            setIsAuthed(true);
          }
        } catch (error) {
          handleFirestoreError(error, 'get', 'users/' + systemUser.uid);
        }
      }
    };
    assignUser();
  }, [systemUser, nodes, user]);
  */
  
  // Transaction Form State
  const [recipientAddr, setRecipientAddr] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isEthToLau, setIsEthToLau] = useState(true);
  const [sendCurrency, setSendCurrency] = useState<'LauCoin' | 'Ethereum' | 'Bitcoin'>('LauCoin');
  const [sending, setSending] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  // New features state
  const [isMining, setIsMining] = useState(false);
  const [miningProgress, setMiningProgress] = useState(0);
  const [miningSlots, setMiningSlots] = useState<MiningSlot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
  const [showMiningModal, setShowMiningModal] = useState(false);
  const [stakingRewards, setStakingRewards] = useState(0);
  const [mintAmount, setMintAmount] = useState('');
  const [mintBitcoinAmount, setMintBitcoinAmount] = useState('');
  const [minting, setMinting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [miningLogs, setMiningLogs] = useState<{ amount: number; hash: string; timestamp: number; isGolden?: boolean; isEmpty?: boolean }[]>([]);
  const [kernelLogs, setKernelLogs] = useState<{ id: string; timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; subsystem: string; message: string }[]>([]);
  const [nodeValidationStatuses, setNodeValidationStatuses] = useState<Record<string, 'Valid' | 'Invalid' | 'Pending' | null>>({});
  const [learningTasks, setLearningTasks] = useState<Record<string, any>>({});
  
  // Leasing state
  const [leases, setLeases] = useState<Lease[]>([]);
  const [showLeaseModal, setShowLeaseModal] = useState(false);
  const [leasePower, setLeasePower] = useState('0.5');
  const [leasePrice, setLeasePrice] = useState('10');
  const [leaseDuration, setLeaseDuration] = useState('24'); // hours
  const [isLeasing, setIsLeasing] = useState(false);

  const validateNodeHash = async (node: LauNode) => {
    if (!node || !node.address) return;
    setNodeValidationStatuses(prev => ({ ...prev, [node.address]: 'Pending' }));
    addKernelLog(`Starting validation for node ${node.address.substring(0, 10)}...`, 'VALIDATOR');
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate fetching current hash and comparing
    // 85% chance it's valid, 15% chance it's invalid
    const isValid = Math.random() > 0.15;
    const status = isValid ? 'Valid' : 'Invalid';
    
    setNodeValidationStatuses(prev => ({ ...prev, [node.address]: status }));
    addKernelLog(`Node ${(node.address || '').substring(0, 10)}... validation: ${status}`, 'VALIDATOR', isValid ? 'INFO' : 'ERROR');
  };

  const addKernelLog = (message: string, subsystem: string = 'NET', level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') => {
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      subsystem,
      message,
    };
    setKernelLogs(prev => [...prev.slice(-49), newLog]);
  };
  
  // Requests state
  const [requests, setRequests] = useState<LauRequest[]>([]);
  const [activeTransferTab, setActiveTransferTab] = useState<'send' | 'request'>('send');
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestFromAddr, setRequestFromAddr] = useState('');
  const [requesting, setRequesting] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeSlotRef = useRef<HTMLDivElement>(null);

  // Scroll to active slot when it changes
  useEffect(() => {
    if (activeSlotId && activeSlotRef.current) {
      activeSlotRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [activeSlotId]);

  // Swap rate calculation
  useEffect(() => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      setToAmount('');
      return;
    }
    const rate = 20000;
    if (isEthToLau) {
      setToAmount((amount * rate).toFixed(2));
    } else {
      setToAmount((amount / rate).toFixed(6));
    }
  }, [fromAmount, isEthToLau]);
  const lauChartData = useMemo(() => {
    let price = 105.00;
    return Array.from({ length: 20 }, () => {
      price = price * (0.999 + Math.random() * 0.002);
      return { value: price };
    });
  }, [user?.balance]);
  const ethChartData = useMemo(() => {
    let price = 2450.50;
    return Array.from({ length: 20 }, () => {
      price = price * (0.98 + Math.random() * 0.04);
      return { value: price };
    });
  }, [ethBalance]);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTx, setPendingTx] = useState<{
    from: string;
    to: string;
    amount: number;
    fee: number;
    hash: string;
    currency: 'LauCoin' | 'Ethereum' | 'Bitcoin';
  } | null>(null);

  const [showConfirmRequestModal, setShowConfirmRequestModal] = useState(false);

  const [pendingRequestTx, setPendingRequestTx] = useState<{
    from: string;
    to: string;
    amount: number;
    fee: number;
  } | null>(null);

  const [selectedNodeDetail, setSelectedNodeDetail] = useState<any>(null);
  const [showNodeDetailModal, setShowNodeDetailModal] = useState(false);
  const [showBitcoinWalletModal, setShowBitcoinWalletModal] = useState(false);

  const handleNodeDetailClick = (node: any) => {
    // Find the full LauNode if it's a network node
    const fullNode = nodes.find(n => n.address === node.address || n.address === node.id);
    if (fullNode) {
      setSelectedNodeDetail({ ...fullNode, semanticValue: node.semanticValue });
    } else {
      // It might be a chat or nuance node from the graph
      setSelectedNodeDetail(node);
    }
    setShowNodeDetailModal(true);
  };

  const selectedNodeTransactions = useMemo(() => {
    if (!selectedNodeDetail) return [];
    const addr = selectedNodeDetail.address || selectedNodeDetail.id;
    if (!addr) return [];
    return transactions.filter(tx => tx.from === addr || tx.to === addr)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [selectedNodeDetail, transactions]);

  const TREASURY_ADDR = '0xLauTreasury_000000000000000000000000000000';
  const ADMIN_EMAIL = 'plundry11@gmail.com';
  const ADMIN_ADDRESSES = ['0xLau96569c00101c111aa2a74d8695d2ebd64a797b71']; // Add your wallet address here
  const STAKING_RATE = 0.0000001; // Lau per second per Lau staked

  const isAuthorized = user && ((user as any).email === ADMIN_EMAIL || user.address === '0xLau96569c00101c111aa2a74d8695d2ebd64a797b71');
  const isRealAdmin = auth.currentUser?.email === ADMIN_EMAIL;

  const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    // Set user-friendly error for UI
    if (error?.code === 'permission-denied') {
      setError("Chyba prístupu k databáze. Skontrolujte svoje oprávnenia.");
    } else {
      setError(error?.message || "Vyskytla sa neočakávaná chyba databázy.");
    }

    // MUST throw for system diagnostics
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthLoading(false);
      if (firebaseUser) {
        setIsAuthed(true);
      } else {
        setIsAuthed(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Robust fetch helper for core API
  const fetchCore = async (path: string, options: RequestInit = {}, retries = 5, delay = 2000): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${window.location.origin}${path}`, options);
        
        if (response.status === 502 || response.status === 429) {
          const isRateLimit = response.status === 429;
          console.warn(`Core API ${path} ${isRateLimit ? 'rate limited (429)' : 'not ready (502)'}, retrying...`);
          await new Promise(r => setTimeout(r, isRateLimit ? delay * 2 : delay));
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          if (text.includes("Starting Server") || text.includes("<!doctype html>")) {
            console.warn(`Core API ${path} returned splash page, retrying...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          throw new TypeError(`Expected JSON from ${path} but got ${contentType || 'text/plain'}`);
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        console.error(`Fetch ${path} attempt ${i + 1} failed:`, err);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      addKernelLog('Initializing LauCoin Network Explorer...', 'BOOT');
      const { nodes: generatedNodes } = await generateNetwork();
      setNodes(generatedNodes);
      addKernelLog(`Network generated: 150,000,000,000,000 nodes active (Fractal Scaling Enabled)`, 'BOOT');
      
      // Fetch chat history for semantic graph
      try {
        const data = await fetchCore('/core-api/status');
        if (data && data.chat) {
          setChatHistory(data.chat);
        }
      } catch (err) {
        console.error("Failed to load chat history for graph:", err);
      }
      
      setLoading(false);
    };
    init();
  }, []);

  // Separate effect for cloud initialization (admin only)
  useEffect(() => {
    const isRealAdmin = auth.currentUser?.email === ADMIN_EMAIL;
    const checkCloudState = async () => {
      if (isAuthorized && !initializing && isRealAdmin) {
        try {
          addKernelLog('Checking cloud state...', 'SYNC');
          const nodesRef = collection(db, "nodes");
          const q = query(nodesRef, limit(1));
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            addKernelLog('Cloud database empty, seeding network...', 'SYNC', 'WARN');
            await initializeNetwork();
            addKernelLog('Cloud seeding complete', 'SYNC');
          } else {
            addKernelLog('Cloud state verified', 'SYNC');
          }
        } catch (err) {
          addKernelLog(`Cloud verification failed: ${err}`, 'SYNC', 'ERROR');
        }
      }
    };
    checkCloudState();
  }, [isAuthorized, initializing, auth.currentUser]);

  // Separate effect for real-time listeners that depends on auth state
  useEffect(() => {
    if (!isAuthed || !auth.currentUser) {
      return;
    }

    // Listen to real-time nodes for balance updates and new nodes - limited to save read units
    const unsubscribeNodes = onSnapshot(query(collection(db, 'nodes'), limit(100)), (snapshot) => {
      const cloudNodes = snapshot.docs.map(doc => ({
        address: doc.id,
        ...doc.data()
      })) as any[];
      
      setNodes(prev => {
        const newNodes = [...prev];
        cloudNodes.forEach(cloudNode => {
          const idx = newNodes.findIndex(n => n.address === cloudNode.address);
          if (idx !== -1) {
            newNodes[idx] = { ...newNodes[idx], ...cloudNode };
          } else {
            // New node from backend/kernel
            newNodes.push({
              id: cloudNode.id || newNodes.length + 1,
              address: cloudNode.address,
              private_key: cloudNode.private_key || '0xHidden',
              state_hash: cloudNode.state_hash || '0xPending',
              balance: cloudNode.balance || 0,
              displayName: cloudNode.displayName || cloudNode.address.substring(0, 15),
              ...cloudNode
            });
          }
        });
        return newNodes;
      });
    }, (error) => {
      handleFirestoreError(error, 'list', 'nodes');
    });

    // Listen to real-time transactions
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeTxs = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, 'list', 'transactions');
    });

    const unsubscribeMining = onSnapshot(query(collection(db, 'mining_slots'), limit(100)), (snapshot) => {
      const slots = snapshot.docs.map(doc => ({
        id: parseInt(doc.id),
        ...doc.data()
      })) as MiningSlot[];
      setMiningSlots(slots.sort((a, b) => a.id - b.id));
    }, (error) => {
      handleFirestoreError(error, 'list', 'mining_slots');
    });

    // Listen to real-time chat for semantic graph - limited toล่าสุด 50 messages
    const unsubscribeChat = onSnapshot(query(collection(db, 'chat'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      const chat = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(chat);
    }, (error) => {
      handleFirestoreError(error, 'list', 'chat');
    });

    // Listen to real-time leases - limited
    const unsubscribeLeases = onSnapshot(query(collection(db, 'leases'), limit(50)), (snapshot) => {
      const leaseData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lease[];
      setLeases(leaseData);
    }, (error) => {
      handleFirestoreError(error, 'list', 'leases');
    });

    return () => {
      unsubscribeNodes();
      unsubscribeTxs();
      unsubscribeMining();
      unsubscribeChat();
      unsubscribeLeases();
    };
  }, [isAuthed, auth.currentUser]);

  // Separate effect for requests listener that depends on auth state
  useEffect(() => {
    if (!isAuthed || !auth.currentUser) {
      setRequests([]);
      return;
    }

    const unsubscribeRequests = onSnapshot(query(collection(db, 'requests'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LauRequest[];
      setRequests(reqs.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => {
      handleFirestoreError(error, 'list', 'requests');
    });

    return () => unsubscribeRequests();
  }, [isAuthed, auth.currentUser]);

  // Staking rewards calculator
  useEffect(() => {
    if (user && user.balance > 0) {
      const interval = setInterval(() => {
        const lastClaimed = user.lastClaimed || Date.now();
        const elapsedSeconds = (Date.now() - lastClaimed) / 1000;
        const semanticValue = getSemanticValue(user);
        const rewards = user.balance * STAKING_RATE * elapsedSeconds * (1 + semanticValue);
        setStakingRewards(rewards);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Seeding function triggered after auth
  const seedNodes = async () => {
    if (!isAuthed || seeding) return;
    setSeeding(true);
    try {
      // Initialize Python Kernel
      addKernelLog('Initializing Python Kernel...', 'SYNC');
      const data = await fetchCore('/core-api/laucoin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes })
      });
      addKernelLog(`Kernel initialized: ${data.status}`, 'SYNC');

      const nodesSnap = await getDocs(query(collection(db, 'nodes'), limit(1)));
      if (nodesSnap.empty) {
        console.log("Seeding nodes to Firestore...");
        for (let i = 0; i < nodes.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = nodes.slice(i, i + 500);
          chunk.forEach(node => {
            const nodeRef = doc(db, 'nodes', node.address);
            batch.set(nodeRef, {
              address: node.address,
              balance: node.balance,
              state_hash: node.state_hash,
              displayName: node.displayName || ""
            });
          });
          await batch.commit();
        }
        alert("Sieť bola úspešne inicializovaná v cloude.");
      }
    } catch (error) {
      console.error("Seeding Error:", error);
      alert("Chyba pri inicializácii cloudu.");
    } finally {
      // Initialize Mining Grid if empty
      const gridSnapshot = await getDocs(query(collection(db, 'mining_slots'), limit(1)));
      if (gridSnapshot.empty) {
        console.log("Initializing Mining Grid...");
        const batchSize = 100;
        for (let i = 0; i < 1000; i += batchSize) {
          const batch = writeBatch(db);
          for (let j = 0; j < batchSize; j++) {
            const id = i + j;
            const slotRef = doc(db, 'mining_slots', id.toString());
            // Random initial state
            const cooldown = Math.floor(Math.random() * (3000000 - 300000 + 1)) + 300000;
            batch.set(slotRef, {
              id,
              lastMinedAt: Date.now() - cooldown, // Make some available immediately
              cooldownMs: cooldown,
              potentialReward: 0.01 * (cooldown / 300000),
              lastMiner: 'GENESIS'
            });
          }
          await batch.commit();
        }
        alert("Mriežka bola úspešne inicializovaná.");
      }

      setSeeding(false);
    }
  };

  const syncKernelWithCloud = async () => {
    if (!isAuthed || seeding) return;
    setSeeding(true);
    addKernelLog('Starting manual kernel-to-cloud synchronization...', 'SYNC');
    try {
      // 1. Get nodes from Python Kernel
      const data = await fetchCore('/core-api/laucoin/nodes');
      if (!data || !data.nodes) throw new Error("Failed to fetch nodes from kernel");
      
      const kernelNodes = data.nodes;
      addKernelLog(`Fetched ${kernelNodes.length} nodes from kernel. Updating cloud...`, 'SYNC');

      // 2. Update Firestore in batches
      for (let i = 0; i < kernelNodes.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = kernelNodes.slice(i, i + 500);
        chunk.forEach((node: any) => {
          const nodeRef = doc(db, 'nodes', node.address);
          batch.set(nodeRef, {
            address: node.address,
            balance: node.balance,
            state_hash: node.state_hash,
            displayName: node.displayName || "",
            lastSync: Date.now()
          }, { merge: true });
        });
        await batch.commit();
      }
      
      addKernelLog('Synchronization complete.', 'SYNC');
      alert("Synchronizácia prebehla úspešne.");
    } catch (error) {
      console.error("Sync Error:", error);
      addKernelLog(`Sync failed: ${error}`, 'SYNC');
      alert("Chyba pri synchronizácii.");
    } finally {
      setSeeding(false);
    }
  };

  // Update current user state when nodes list changes
  useEffect(() => {
    const isRealAdmin = auth.currentUser?.email === ADMIN_EMAIL;
    if (isAuthed && nodes.length > 0 && isAuthorized && isRealAdmin) {
      const checkAndSeed = async () => {
        try {
          const nodesSnap = await getDocs(query(collection(db, 'nodes'), limit(1)));
          const gridSnap = await getDocs(query(collection(db, 'mining_slots'), limit(1)));
          if (nodesSnap.empty || gridSnap.empty) {
            console.log("Database or Grid empty, triggering auto-seed...");
            await seedNodes();
          }
        } catch (e) {
          console.error("Auto-seed check failed:", e);
        }
      };
      checkAndSeed();
    }
  }, [isAuthed, nodes.length, isAuthorized, auth.currentUser]);

  // Update current user state when nodes list changes
  useEffect(() => {
    if (user) {
      const freshUser = nodes.find(n => n.address === user.address);
      if (freshUser && freshUser.balance !== user.balance) {
        setUser(freshUser);
        sessionStorage.setItem('lau_user', JSON.stringify(freshUser));
      }
      getAlfaBalance(user.address).then(setEthBalance);
    }
  }, [nodes, user]);

  // Passive semantic generation
  useEffect(() => {
    if (!user || !isAuthed) return;
    
    const interval = setInterval(async () => {
      const semanticValue = getSemanticValue(user);
      if (semanticValue <= 0) return;
      
      const passiveReward = 0.000001 * semanticValue;
      
      try {
        const userRef = doc(db, 'nodes', user.address);
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) return;
          transaction.update(userRef, { balance: userDoc.data().balance + passiveReward });
        });
      } catch (e) {
        // Silent fail for passive generation to avoid spamming
      }
    }, 60000); // Every 60 seconds to save read units
    
    return () => clearInterval(interval);
  }, [user?.address, isAuthed]);

  const handleLogin = async (providedAddr?: string, providedKey?: string) => {
    const addr = providedAddr || loginAddr;
    const key = providedKey || loginKey;

    const testUsers = [
      { address: '0xLau96569c00101c111aa2a74d8695d2ebd64a797b71', private_key: 'admin1', displayName: 'Admin', nodeIndex: 0 },
      { address: '0xLauNode_000000000000000000000000000001', private_key: 'admin1', displayName: 'Roman', nodeIndex: 1 },
      { address: '0xLauNode_000000000000000000000000000002', private_key: 'admin2', displayName: 'Lubos', nodeIndex: 2 },
      { address: '0xLauNode_000000000000000000000000000003', private_key: 'user123', displayName: 'Tomas', nodeIndex: 3 },
      { address: '0xLauNode_000000000000000000000000000004', private_key: 'user123', displayName: 'Danielka', nodeIndex: 4 }
    ];

    const testUser = testUsers.find(u => u.address === addr && u.private_key === key);
    
    if (testUser && nodes.length > testUser.nodeIndex) {
      const assignedNode = nodes[testUser.nodeIndex];
      // Add display name to the node object for UI purposes
      const userWithMeta = { ...assignedNode, displayName: testUser.displayName, address: testUser.address };
      setUser(userWithMeta);
      sessionStorage.setItem('lau_user', JSON.stringify(userWithMeta));
      addKernelLog(`User logged in: ${userWithMeta.displayName} (${(userWithMeta.address || '').substring(0, 10)}...)`, 'AUTH');
      
      // Sign in anonymously to satisfy Firestore rules if not already authed
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err: any) {
          if (err.code === 'auth/admin-restricted-operation') {
            console.warn("Anonymous Auth is disabled in Firebase Console. Using guest mode.");
            setIsAuthed(true); // Fallback if anon auth fails
          } else {
            console.error("Anon Auth Error:", err);
            setIsAuthed(true);
          }
        }
      } else {
        setIsAuthed(true);
      }
    } else {
      // Fallback to original node login
      const found = nodes.find(n => n.address === addr && n.private_key === key);
      if (found) {
        setUser(found);
        sessionStorage.setItem('lau_user', JSON.stringify(found));
        
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (err: any) {
            if (err.code === 'auth/admin-restricted-operation') {
              console.warn("Anonymous Auth is disabled in Firebase Console. Using guest mode.");
              setIsAuthed(true);
            } else {
              console.error("Anon Auth Error:", err);
              setIsAuthed(true);
            }
          }
        } else {
          setIsAuthed(true);
        }
      } else if (!providedAddr) {
        alert('Neplatné údaje.');
      }
    }
  };

  // Removed auto-login logic based on systemUser email
  /*
  useEffect(() => {
    if (systemUser && nodes.length > 0 && !isAuthed) {
      const email = systemUser.email;
      const testUsers = [
        { email: 'admin@admin.sk', password: 'admin1', displayName: 'Admin', nodeIndex: 0 },
        { email: 'roman@lau.mail', password: 'admin1', displayName: 'Roman', nodeIndex: 1 },
        { email: 'lubos@lau.mail', password: 'admin2', displayName: 'Lubos', nodeIndex: 2 },
        { email: 'tomas@lau.mail', password: 'user123', displayName: 'Tomas', nodeIndex: 3 },
        { email: 'Danielka@lau.mail', password: 'user123', displayName: 'Danielka', nodeIndex: 4 }
      ];
      
      const testUser = testUsers.find(u => u.email === email);
      if (testUser && nodes.length > testUser.nodeIndex) {
        const assignedNode = nodes[testUser.nodeIndex];
        const userWithMeta = { ...assignedNode, displayName: testUser.displayName, email: testUser.email };
        setUser(userWithMeta);
        sessionStorage.setItem('lau_user', JSON.stringify(userWithMeta));
        setIsAuthed(true);
      } else {
        // Check Firestore for existing assigned node
        const checkUserNode = async () => {
          try {
            const userDocRef = doc(db, 'users', systemUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists() && userDocSnap.data().assignedNode) {
              const savedNode = userDocSnap.data().assignedNode;
              const userWithMeta = { ...savedNode, displayName: systemUser.displayName || 'User', email: email || '' };
              setUser(userWithMeta);
              sessionStorage.setItem('lau_user', JSON.stringify(userWithMeta));
            } else {
              // Assign a new random node and save it
              const randomNodeIndex = Math.floor(Math.random() * (nodes.length - 5)) + 5;
              const assignedNode = nodes[randomNodeIndex] || nodes[0];
              const userWithMeta = { ...assignedNode, displayName: systemUser.displayName || 'User', email: email || '' };
              setUser(userWithMeta);
              sessionStorage.setItem('lau_user', JSON.stringify(userWithMeta));
              
              // Save to Firestore
              await setDoc(userDocRef, {
                email: email,
                displayName: systemUser.displayName,
                assignedNode: assignedNode
              }, { merge: true });
            }
          } catch (err) {
            console.error("Error fetching user node:", err);
            // Fallback to local storage if Firestore fails
            const localNode = localStorage.getItem(`lau_user_${systemUser.uid}`);
            if (localNode) {
              const savedNode = JSON.parse(localNode);
              setUser(savedNode);
              sessionStorage.setItem('lau_user', JSON.stringify(savedNode));
            } else {
              const randomNodeIndex = Math.floor(Math.random() * (nodes.length - 5)) + 5;
              const assignedNode = nodes[randomNodeIndex] || nodes[0];
              const userWithMeta = { ...assignedNode, displayName: systemUser.displayName || 'User', email: email || '' };
              setUser(userWithMeta);
              sessionStorage.setItem('lau_user', JSON.stringify(userWithMeta));
              localStorage.setItem(`lau_user_${systemUser.uid}`, JSON.stringify(userWithMeta));
            }
          }
          setIsAuthed(true);
        };
        checkUserNode();
      }
    }
  }, [systemUser, nodes, isAuthed]);
  */

  const handleLogout = async () => {
    try {
      setUser(null);
      sessionStorage.removeItem('lau_user');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleSearch = async () => {
    const found = nodes.find(n => n.address === searchQuery || n.state_hash === searchQuery);
    if (found) {
      setSearchResult(found);
    } else if (searchQuery.startsWith('0xLau')) {
      // Generate virtual node for the 150 trillion scale
      const virtual = await generateVirtualNode(searchQuery);
      setSearchResult(virtual);
    } else {
      setSearchResult(null);
      if (searchQuery) {
        alert('Adresa sa v Kerneli nenachádza.');
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isAuthed) {
      alert("Pre vykonanie transakcie sa musíte prihlásiť.");
      return;
    }
    
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Zadajte platnú sumu.');
      return;
    }

    let fee = 0;
    let fromAddress = user.address;

    if (sendCurrency === 'LauCoin') {
      const recipient = nodes.find(n => n.address === recipientAddr);
      if (!recipient) {
        alert('Príjemca neexistuje v sieti.');
        return;
      }

      if (recipient.address === user.address) {
        alert('Nemôžete poslať LauCoin sami sebe.');
        return;
      }

      if (amount > user.balance) {
        alert('Nedostatočný zostatok LauCoin.');
        return;
      }
      fee = 0.0001;
    } else if (sendCurrency === 'Ethereum') {
      if (!recipientAddr.startsWith('0x') || recipientAddr.length !== 42) {
        alert('Neplatná Ethereum adresa.');
        return;
      }
      if (amount > ethBalance) {
        alert('Nedostatočný zostatok Ethereum.');
        return;
      }
      fee = 0.001; // Simulated ETH fee
    } else if (sendCurrency === 'Bitcoin') {
      if (!recipientAddr.startsWith('1') && !recipientAddr.startsWith('3') && !recipientAddr.startsWith('bc1')) {
        alert('Neplatná Bitcoin adresa.');
        return;
      }
      const btcBalance = bitcoinWallet ? bitcoinWallet.balance : 0;
      if (amount > btcBalance) {
        alert('Nedostatočný zostatok Bitcoin.');
        return;
      }
      fromAddress = bitcoinWallet ? bitcoinWallet.address : user.address;
      fee = 0.00005; // Simulated BTC fee
    }

    try {
      const txHash = await generateTransactionHash(fromAddress, recipientAddr);
      setPendingTx({
        from: fromAddress,
        to: recipientAddr,
        amount: amount,
        fee: fee,
        hash: `0x${txHash}`,
        currency: sendCurrency
      });
      setShowConfirmModal(true);
    } catch (error) {
      console.error("Hash generation error:", error);
    }
  };

  const [confirmPrivKey, setConfirmPrivKey] = useState('');

  useEffect(() => {
    if (showConfirmModal && user) {
      setConfirmPrivKey(user.private_key || '');
    }
  }, [showConfirmModal, user]);

  const confirmTransaction = async () => {
    if (!pendingTx || !user) return;
    
    setSending(true);
    try {
      if (pendingTx.currency === 'LauCoin') {
        // 1. Sign the transaction
        addKernelLog('Signing transaction with private key...', 'SEC');
        const txData = JSON.stringify({
          from: pendingTx.from,
          to: pendingTx.to,
          amount: pendingTx.amount,
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7)
        });
        
        const { signature, publicKey } = await signTransaction(confirmPrivKey || user.private_key, txData);
        addKernelLog('Transaction signed successfully.', 'SEC');

        // 2. Call Backend API for validation and ledger update
        addKernelLog('Performing secure transfer via Python Kernel...', 'SYNC');
        const result = await fetchCore('/core-api/laucoin/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: user.address,
            receiver: pendingTx.to,
            amount: pendingTx.amount,
            context: `Transfer from ${user.displayName || user.address}`,
            signature: signature,
            message: txData,
            publicKey: publicKey
          })
        });
        
        addKernelLog(`Transfer successful: ${result.data.tx_hash}`, 'SYNC');

        // 2. Update Firestore to sync UI for all users
        const senderRef = doc(db, 'nodes', pendingTx.from);
        const recipientRef = doc(db, 'nodes', pendingTx.to);
        const treasuryRef = doc(db, 'nodes', TREASURY_ADDR);
        const txRef = doc(collection(db, 'transactions'));

        await runTransaction(db, async (transaction) => {
          const senderDoc = await transaction.get(senderRef);
          const recipientDoc = await transaction.get(recipientRef);
          const treasuryDoc = await transaction.get(treasuryRef);

          if (!senderDoc.exists()) {
            throw new Error("Váš účet (odosielateľ) nebol nájdený v cloude.");
          }
          if (!recipientDoc.exists()) {
            // If recipient doesn't exist in Firestore, we create it (backend already handled it)
            transaction.set(recipientRef, { address: pendingTx.to, balance: pendingTx.amount });
          } else {
            transaction.update(recipientRef, { balance: recipientDoc.data().balance + pendingTx.amount });
          }

          const senderBalance = senderDoc.data().balance;
          const totalDeduction = pendingTx.amount + pendingTx.fee;

          transaction.update(senderRef, { balance: senderBalance - totalDeduction });
          
          if (treasuryDoc.exists()) {
            transaction.update(treasuryRef, { balance: treasuryDoc.data().balance + pendingTx.fee });
          } else {
            transaction.set(treasuryRef, { address: TREASURY_ADDR, balance: pendingTx.fee });
          }

          // Record transaction
          transaction.set(txRef, {
            from: pendingTx.from,
            to: pendingTx.to,
            amount: pendingTx.amount,
            timestamp: Date.now(),
            hash: result.data.tx_hash || pendingTx.hash,
            type: 'transfer',
            kernel_node: result.data.new_node,
            currency: 'LauCoin'
          });
        });
        addKernelLog(`Transaction successful: ${pendingTx.amount} LAU. Kernel Node: ${result.data.new_node}`, 'TX');
      } else if (pendingTx.currency === 'Ethereum') {
        try {
          addKernelLog(`Initiating Ethereum mainnet transfer via MetaMask...`, 'TX');
          const { sendEth } = await import('./services/web3_bridge');
          const txHash = await sendEth(pendingTx.to, pendingTx.amount.toString());
          
          setEthBalance(prev => prev - pendingTx.amount - pendingTx.fee);
          addKernelLog(`Ethereum transfer successful: ${pendingTx.amount} ETH to ${pendingTx.to}. Hash: ${txHash}`, 'TX');
          
          // Record transaction
          const txRef = doc(collection(db, 'transactions'));
          await runTransaction(db, async (transaction) => {
            transaction.set(txRef, {
              from: pendingTx.from,
              to: pendingTx.to,
              amount: pendingTx.amount,
              timestamp: Date.now(),
              hash: txHash,
              type: 'transfer',
              currency: 'Ethereum'
            });
          });
        } catch (err: any) {
          addKernelLog(`Ethereum transfer failed: ${err.message}`, 'ERROR');
          alert(`Ethereum transfer failed: ${err.message}`);
          return;
        }
      } else if (pendingTx.currency === 'Bitcoin') {
        if (bitcoinWallet && bitcoinWallet.address === pendingTx.from) {
          setBitcoinWallet({ ...bitcoinWallet, balance: bitcoinWallet.balance - pendingTx.amount - pendingTx.fee });
        } else {
          setBitcoinSubWallets(prev => prev.map(sub => sub.address === pendingTx.from ? { ...sub, balance: sub.balance - pendingTx.amount - pendingTx.fee } : sub));
        }
        addKernelLog(`Bitcoin transfer successful: ${pendingTx.amount} BTC to ${pendingTx.to}`, 'TX');
        // Record transaction
        const txRef = doc(collection(db, 'transactions'));
        await runTransaction(db, async (transaction) => {
          transaction.set(txRef, {
            from: pendingTx.from,
            to: pendingTx.to,
            amount: pendingTx.amount,
            timestamp: Date.now(),
            hash: pendingTx.hash,
            type: 'transfer',
            currency: 'Bitcoin'
          });
        });
      }

      setRecipientAddr('');
      setSendAmount('');
      setShowConfirmModal(false);
      setPendingTx(null);
      alert('Transakcia prebehla úspešne.');
    } catch (error: any) {
      console.error("Chyba pri transakcii:", error);
      alert(error.message || 'Chyba pri zápise do blockchainu.');
    } finally {
      setSending(false);
    }
  };

  const handleRequestLau = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const amount = parseFloat(requestAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Zadajte platnú sumu.');
      return;
    }

    const target = nodes.find(n => n.address === requestFromAddr);
    if (!target) {
      alert('Adresa nebola nájdená v sieti.');
      return;
    }

    if (target.address === user.address) {
      alert('Nemôžete žiadať LauCoin od seba.');
      return;
    }

    if (user.balance < 0.0001) {
      alert('Nedostatočný zostatok na zaplatenie poplatku za žiadosť (0.0001 LAU).');
      return;
    }

    setPendingRequestTx({
      from: user.address,
      to: target.address,
      amount: amount,
      fee: 0.0001
    });
    setShowConfirmRequestModal(true);
  };

  const confirmRequestTransaction = async () => {
    if (!pendingRequestTx || !user) return;
    
    setRequesting(true);
    try {
      const requesterRef = doc(db, 'nodes', pendingRequestTx.from);
      const treasuryRef = doc(db, 'nodes', TREASURY_ADDR);
      
      await runTransaction(db, async (transaction) => {
        const requesterDoc = await transaction.get(requesterRef);
        const treasuryDoc = await transaction.get(treasuryRef);

        if (!requesterDoc.exists()) {
          throw new Error("Váš účet nebol nájdený.");
        }

        const requesterBalance = requesterDoc.data().balance;
        if (requesterBalance < pendingRequestTx.fee) {
          throw new Error("Nedostatočný zostatok na poplatok.");
        }

        // Deduct fee
        transaction.update(requesterRef, { balance: requesterBalance - pendingRequestTx.fee });
        
        // Add fee to treasury
        if (treasuryDoc.exists()) {
          transaction.update(treasuryRef, { balance: treasuryDoc.data().balance + pendingRequestTx.fee });
        } else {
          transaction.set(treasuryRef, { address: TREASURY_ADDR, balance: pendingRequestTx.fee });
        }

        // Create request document
        const newReqRef = doc(collection(db, 'requests'));
        transaction.set(newReqRef, {
          from: pendingRequestTx.from,
          to: pendingRequestTx.to,
          amount: pendingRequestTx.amount,
          timestamp: Date.now(),
          status: 'pending'
        });
      });

      alert(`Žiadosť o ${pendingRequestTx.amount} LAU bola odoslaná na adresu ${pendingRequestTx.to}`);
      setRequestAmount('');
      setRequestFromAddr('');
      setShowConfirmRequestModal(false);
      setPendingRequestTx(null);
    } catch (error) {
      console.error("Request error:", error);
      handleFirestoreError(error, 'write', 'requests');
    } finally {
      setRequesting(false);
    }
  };

  const handleAcceptRequest = async (req: LauRequest) => {
    if (!user) return;
    
    // Check balance
    if (user.balance < req.amount) {
      alert("Nedostatočný zostatok na splnenie tejto žiadosti.");
      return;
    }

    setSending(true);
    try {
      const txHash = await generateTransactionHash(user.address, req.from);
      const senderRef = doc(db, 'nodes', user.address);
      const recipientRef = doc(db, 'nodes', req.from);
      const txRef = doc(collection(db, 'transactions'));
      const reqRef = doc(db, 'requests', req.id);

      await runTransaction(db, async (transaction) => {
        const senderDoc = await transaction.get(senderRef);
        const recipientDoc = await transaction.get(recipientRef);
        
        if (!senderDoc.exists() || !recipientDoc.exists()) {
          throw new Error("Uzly neboli nájdené.");
        }

        const senderBalance = senderDoc.data().balance;
        if (senderBalance < req.amount) throw new Error("Nedostatočný zostatok.");

        transaction.update(senderRef, { balance: senderBalance - req.amount });
        transaction.update(recipientRef, { balance: recipientDoc.data().balance + req.amount });
        
        transaction.set(txRef, {
          from: user.address,
          to: req.from,
          amount: req.amount,
          timestamp: Date.now(),
          hash: `0x${txHash}`,
          type: 'transfer'
        });

        transaction.update(reqRef, { status: 'accepted' });
      });

      alert("Žiadosť bola úspešne splnená.");
    } catch (error) {
      console.error("Accept request error:", error);
      alert("Chyba pri plnení žiadosti.");
    } finally {
      setSending(false);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const reqRef = doc(db, 'requests', reqId);
        transaction.update(reqRef, { status: 'rejected' });
      });
    } catch (error) {
      console.error("Reject request error:", error);
    }
  };

  const downloadNetworkData = () => {
    // Nodes CSV
    const nodesHeader = ["ID", "Address", "Balance", "State Hash"];
    const nodesRows = nodes.map(node => [
      node.id,
      `"${node.address}"`,
      node.balance,
      `"${node.state_hash}"`
    ]);
    
    // Transactions CSV
    const txsHeader = ["Hash", "From", "To", "Amount", "Timestamp", "Type"];
    const txsRows = transactions.map(tx => [
      `"${tx.hash}"`,
      `"${tx.from}"`,
      `"${tx.to}"`,
      tx.amount,
      `"${new Date(tx.timestamp).toISOString()}"`,
      `"${tx.type}"`
    ]);

    const csvContent = [
      "--- NODES ---",
      nodesHeader.join(","),
      ...nodesRows.map(row => row.join(",")),
      "",
      "--- TRANSACTIONS ---",
      txsHeader.join(","),
      ...txsRows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laucoin_network_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [autoMining, setAutoMining] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [kernelLogs]);

  // Auto-mining effect to handle sequential mining and avoid stale closures
  // Auto-mining effect to handle sequential mining and avoid stale closures
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (autoMining && !isMining && showMiningModal) {
      timeout = setTimeout(() => {
        mineNextSlot();
      }, 1000);
    }
    return () => clearTimeout(timeout);
  }, [autoMining, isMining, showMiningModal, miningSlots]);

  useEffect(() => {
    if (activeMainTab === 'dashboard') {
      if (bitcoinPriceHistory.length === 0) {
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7')
          .then(res => res.json())
          .then(data => {
            const prices = data.map((candle: any[]) => ({
              time: new Date(candle[0]).toLocaleDateString(),
              price: parseFloat(candle[4])
            }));
            setBitcoinPriceHistory(prices);
          })
          .catch(err => {
            console.warn("Could not fetch BTC price, using fallback.");
            setBitcoinPriceHistory([
              { time: '1', price: 90000 },
              { time: '2', price: 91000 },
              { time: '3', price: 90500 },
              { time: '4', price: 92000 },
              { time: '5', price: 93500 },
              { time: '6', price: 94000 },
              { time: '7', price: 95500 }
            ]);
          });
      }

      if (!bitcoinStats) {
        Promise.all([
          fetch('https://blockchain.info/q/getblockcount').then(res => res.text()).then(text => parseInt(text) || 0),
          fetch('https://blockchain.info/q/hashrate').then(res => res.text()).then(text => parseInt(text) || 0),
          fetch('https://mempool.space/api/v1/fees/recommended').then(res => res.json()).catch(() => ({ hourFee: 0 }))
        ])
        .then(([height, hashRate, fees]) => {
          setBitcoinStats({
            blockHeight: height,
            hashRate: (hashRate / 1e9).toFixed(2) + ' EH/s',
            avgFee: fees.hourFee || 0
          });
        })
        .catch(err => console.error("Error fetching BTC stats:", err));
      }
    }
  }, [activeMainTab, bitcoinPriceHistory, bitcoinStats]);

  const handleStartMining = () => {
    if (!user || isMining) return;
    setAutoMining(true);
  };

  const mineNextSlot = () => {
    if (!user || !showMiningModal) return;
    
    const availableSlots = miningSlots
      .filter(slot => Date.now() > slot.lastMinedAt + slot.cooldownMs);
    
    if (availableSlots.length === 0) {
      if (!autoMining) {
        alert("Všetky políčka sú v cooldown režime.");
      }
      return;
    }

    // Pick a random slot from available ones
    const randomIndex = Math.floor(Math.random() * availableSlots.length);
    const nextSlot = availableSlots[randomIndex];
    startMiningProcess(nextSlot);
  };

  const startMiningProcess = (slot: MiningSlot) => {
    setActiveSlotId(slot.id);
    setIsMining(true);
    setMiningProgress(0);

    const duration = 2000; 
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setMiningProgress((currentStep / steps) * 100);
      if (currentStep >= steps) {
        clearInterval(timer);
        finalizeMining(slot);
      }
    }, interval);
  };

  const finalizeMining = async (slot: MiningSlot) => {
    if (!user) return;
    try {
      // New reward logic: 
      // 1 in 33 chance for Golden Mine
      // 1 in 8 chance for Empty Mine (0 reward)
      const rand = Math.random();
      const isGolden = rand < (1/33);
      const isEmpty = !isGolden && rand > 0.875; // ~12.5% chance for empty if not golden
      
      const semanticValue = getSemanticValue(user);
      const baseReward = isGolden 
        ? Math.random() * (1.25 - 0.75) + 0.75 
        : isEmpty 
          ? 0 
          : Math.random() * (0.001 - 0.00001) + 0.00001;
      
      // Modified reward logic to include node count and leasing multiplier
      const nodeMultiplier = 1 + (nodes.length / 1000); 
      
      // Calculate active leasing multiplier
      const activeLeases = leases.filter(l => l.lessee === user.address && l.status === 'active' && (l.expiresAt || 0) > Date.now());
      const leaseMultiplier = activeLeases.reduce((acc, l) => acc + l.power, 0);
      
      const reward = baseReward * (1 + semanticValue) * nodeMultiplier * (1 + leaseMultiplier);

      const userRef = doc(db, 'nodes', user.address);
      const slotRef = doc(db, 'mining_slots', slot.id.toString());
      const txRef = doc(collection(db, 'transactions'));
      const txHash = await generateTransactionHash(`MINING_SLOT_${slot.id}`, user.address);

      const nextCooldown = Math.floor(Math.random() * (3000000 - 300000 + 1)) + 300000;
      const nextReward = 0.0005; 

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const slotDoc = await transaction.get(slotRef);
        
        if (!userDoc.exists()) throw new Error("Node not found");
        if (!slotDoc.exists()) throw new Error("Slot not found");

        const sData = slotDoc.data() as MiningSlot;
        if (Date.now() < sData.lastMinedAt + sData.cooldownMs) {
          throw new Error("Slot už bol vyťažený iným uzlom.");
        }
        
        transaction.update(userRef, { balance: userDoc.data().balance + reward });
        transaction.update(slotRef, {
          lastMinedAt: Date.now(),
          cooldownMs: nextCooldown,
          potentialReward: nextReward,
          lastMiner: user.address,
          lastResultEmpty: isEmpty,
          isGolden: isGolden
        });

        transaction.set(txRef, {
          from: isGolden ? `GOLDEN_MINING_SLOT_${slot.id}` : isEmpty ? `EMPTY_MINING_SLOT_${slot.id}` : `KERNEL_MINING_SLOT_${slot.id}`,
          to: user.address,
          amount: reward,
          timestamp: Date.now(),
          hash: `0x${txHash}`,
          type: 'mine'
        });
      });

      setMiningLogs(prev => [{ amount: reward, hash: `0x${txHash}`, timestamp: Date.now(), isGolden, isEmpty }, ...prev].slice(0, 50));
      addKernelLog(`Mining successful: ${reward.toFixed(6)} LAU ${isGolden ? '(GOLDEN!)' : isEmpty ? '(EMPTY)' : ''}`, 'MINE');
    } catch (e: any) {
      handleFirestoreError(e, 'write', `mining_slots/${slot.id}`);
    } finally {
      setIsMining(false);
      setMiningProgress(0);
      setActiveSlotId(null);
    }
  };

  const handleClaimStaking = async () => {
    if (!user || stakingRewards <= 0) return;
    try {
      const userRef = doc(db, 'nodes', user.address);
      const txRef = doc(collection(db, 'transactions'));
      const txHash = await generateTransactionHash('KERNEL_STAKING', user.address);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Node not found");
        
        const currentRewards = stakingRewards;
        transaction.update(userRef, { 
          balance: userDoc.data().balance + currentRewards,
          lastClaimed: Date.now()
        });
        transaction.set(txRef, {
          from: 'KERNEL_STAKING',
          to: user.address,
          amount: currentRewards,
          timestamp: Date.now(),
          hash: `0x${txHash}`,
          type: 'staking'
        });
      });
      setStakingRewards(0);
      alert('Odmeny za staking boli pripísané.');
    } catch (e) {
      console.error("Staking error:", e);
    }
  };

  const handleVerifyAllNodes = async () => {
    if (!isAuthorized || !isRealAdmin) return;
    
    const unverifiedNodes = nodes.filter(n => !n.isVerified);
    if (unverifiedNodes.length === 0) {
      alert("Všetky uzly sú už overené.");
      return;
    }

    if (!confirm(`Naozaj chcete hromadne overiť ${unverifiedNodes.length} uzlov?`)) return;

    setInitializing(true);
    try {
      const batch = writeBatch(db);
      unverifiedNodes.forEach(node => {
        const nodeRef = doc(db, 'nodes', node.address);
        batch.update(nodeRef, { isVerified: true });
      });
      await batch.commit();
      addKernelLog(`Hromadné overenie ${unverifiedNodes.length} uzlov úspešné.`, 'ADMIN', 'INFO');
      addKernelLog(`AKTIVÁCIA 150,000,000,000,000 ENTÍT DOKONČENÁ. Globálna sémantická sieť je plne synchronizovaná.`, 'SYSTEM', 'INFO');
      alert(`Úspešne overených ${unverifiedNodes.length} uzlov a aktivovaných 150 biliónov entít.`);
    } catch (err) {
      console.error("Bulk verify error:", err);
      alert("Chyba pri hromadnom overovaní.");
    } finally {
      setInitializing(false);
    }
  };

  const handleAdminMint = async () => {
    if (!user || !isAuthorized) return;
    const amount = parseFloat(mintAmount);
    if (isNaN(amount) || amount <= 0) return;

    setMinting(true);
    try {
      const userRef = doc(db, 'nodes', user.address);
      const txRef = doc(collection(db, 'transactions'));
      const txHash = await generateTransactionHash('KERNEL_ADMIN_MINT', user.address);

      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Node not found");
        
        const semanticValue = getSemanticValue(user);
        const finalAmount = amount * (1 + semanticValue);
        
        transaction.update(userRef, { balance: userDoc.data().balance + finalAmount });
        transaction.set(txRef, {
          from: 'KERNEL_ADMIN_MINT',
          to: user.address,
          amount: finalAmount,
          timestamp: Date.now(),
          hash: `0x${txHash}`,
          type: 'mint'
        });
      });
      setMintAmount('');
      alert(`Úspešne vyrazené: ${(amount * (1 + getSemanticValue(user))).toFixed(6)} Lau (vrátane sémantického bonusu)`);
    } catch (e) {
      console.error("Minting error:", e);
    } finally {
      setMinting(false);
    }
  };

  const handleCreateLease = async () => {
    if (!user) return;
    const power = parseFloat(leasePower);
    const price = parseFloat(leasePrice);
    const duration = parseFloat(leaseDuration);

    if (isNaN(power) || isNaN(price) || isNaN(duration)) return;

    setIsLeasing(true);
    try {
      const leaseRef = collection(db, 'leases');
      await addDoc(leaseRef, {
        lessor: user.address,
        lessee: null,
        power,
        price,
        durationMs: duration * 3600000,
        expiresAt: null,
        status: 'available',
        createdAt: Date.now()
      });
      addKernelLog(`Lease offer created: ${power * 100}% boost for ${price} LAU`, 'LEASE');
      setShowLeaseModal(false);
    } catch (e: any) {
      handleFirestoreError(e, 'create', 'leases');
    } finally {
      setIsLeasing(false);
    }
  };

  const handleAcceptLease = async (lease: Lease) => {
    if (!user || lease.status !== 'available') return;
    if (user.balance < lease.price) {
      alert("Nedostatok prostriedkov na prenájom.");
      return;
    }

    setIsLeasing(true);
    try {
      const lessorRef = doc(db, 'nodes', lease.lessor);
      const lesseeRef = doc(db, 'nodes', user.address);
      const leaseRef = doc(db, 'leases', lease.id);
      const txRef = doc(collection(db, 'transactions'));
      const txHash = await generateTransactionHash(`LEASE_PAYMENT_${lease.id}`, lease.lessor);

      await runTransaction(db, async (transaction) => {
        const lessorDoc = await transaction.get(lessorRef);
        const lesseeDoc = await transaction.get(lesseeRef);
        const leaseDoc = await transaction.get(leaseRef);

        if (!lessorDoc.exists() || !lesseeDoc.exists() || !leaseDoc.exists()) {
          throw new Error("Data not found");
        }

        if (leaseDoc.data().status !== 'available') {
          throw new Error("Lease is no longer available");
        }

        if (lesseeDoc.data().balance < lease.price) {
          throw new Error("Insufficient balance");
        }

        transaction.update(lesseeRef, { balance: lesseeDoc.data().balance - lease.price });
        transaction.update(lessorRef, { balance: lessorDoc.data().balance + lease.price });
        transaction.update(leaseRef, {
          lessee: user.address,
          status: 'active',
          expiresAt: Date.now() + lease.durationMs
        });

        transaction.set(txRef, {
          from: user.address,
          to: lease.lessor,
          amount: lease.price,
          timestamp: Date.now(),
          hash: `0x${txHash}`,
          type: 'transfer',
          message: `Lease payment for ${lease.power * 100}% boost`
        });
      });

      addKernelLog(`Lease accepted: ${lease.power * 100}% boost activated`, 'LEASE');
    } catch (e: any) {
      handleFirestoreError(e, 'write', `leases/${lease.id}`);
    } finally {
      setIsLeasing(false);
    }
  };

  const handleAdminMintBitcoin = async () => {
    if (!user || !isAuthorized || !bitcoinWallet) return;
    const amount = parseFloat(mintBitcoinAmount);
    if (isNaN(amount) || amount <= 0) return;

    setMinting(true);
    try {
      const isMainWallet = selectedWalletIndex === -1;
      const targetAddress = isMainWallet ? bitcoinWallet.address : bitcoinSubWallets[selectedWalletIndex].address;

      console.log(`Minting ${amount} BTC to ${targetAddress}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (isMainWallet) {
        setBitcoinWallet(prev => prev ? { ...prev, balance: prev.balance + amount } : null);
      } else {
        setBitcoinSubWallets(prev => prev.map((sub, i) => i === selectedWalletIndex ? { ...sub, balance: sub.balance + amount } : sub));
      }
      
      setMintBitcoinAmount('');
      addKernelLog(`Successfully minted ${amount} BTC to ${targetAddress}`, 'BITCOIN', 'INFO');
    } catch (e) {
      console.error("Bitcoin minting error:", e);
      addKernelLog(`Error minting BTC: ${e}`, 'BITCOIN', 'ERROR');
    } finally {
      setMinting(false);
    }
  };

  const handleSeedNetwork = async () => {
    if (!isAuthorized) return;
    setInitializing(true);
    try {
      await initializeNetwork();
      alert("Network initialized successfully!");
    } catch (err) {
      console.error("Initialization error:", err);
      alert("Failed to initialize network.");
    } finally {
      setInitializing(false);
    }
  };

  const nodeTransactions = useMemo(() => {
    if (!searchResult) return [];
    return transactions.filter(tx => tx.from === searchResult.address || tx.to === searchResult.address);
  }, [searchResult, transactions]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-blue-600 dark:text-blue-500 font-mono text-sm animate-pulse">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
        
        {/* Dynamic Island for Login - Floating Pill */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-white dark:bg-black/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 px-8 py-3 rounded-full flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-600 dark:bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.2em]">LauCoin Kernel</span>
                <span className="text-[8px] text-blue-500 dark:text-blue-400/50 font-mono uppercase">v20.26.04.30</span>
              </div>
            </div>
            
            <div className="h-6 w-[1px] bg-black/10 dark:bg-white/10" />
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-600 dark:text-gray-400 uppercase font-bold tracking-wider">Secure Node</span>
              </div>
              <Shield className="w-4 h-4 text-gray-600 dark:text-gray-400 opacity-50" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          className="w-full max-w-md bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10 relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)] mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="text-4xl font-black text-gray-900 dark:text-white italic">L</div>
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">LauCoin Network</h1>
            <p className="text-[10px] text-blue-600 dark:text-blue-500 font-mono uppercase tracking-[0.3em]">Fractal Valuator Protocol</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Wallet Address</label>
              <div className="relative group">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-blue-600 dark:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  value={loginAddr}
                  onChange={(e) => setLoginAddr(e.target.value)}
                  placeholder="0xLau..."
                  className="w-full bg-black/5 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-sm text-[#0f0] font-mono focus:border-blue-500/50 focus:bg-white dark:focus:bg-black outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-800"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Private Key</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-red-600 dark:text-red-500 transition-colors" />
                <input 
                  type="password" 
                  value={loginKey}
                  onChange={(e) => setLoginKey(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/5 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-sm text-[#f00] font-mono focus:border-red-500/50 focus:bg-white dark:focus:bg-black outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-800"
                />
              </div>
            </div>

            <button 
              onClick={() => handleLogin()}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] mt-4 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group"
            >
              Vstúpiť do Siete
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                →
              </motion.div>
            </button>

            <div className="mt-6 p-4 bg-blue-600/5 dark:bg-blue-500/5 rounded-2xl border border-blue-600/10 dark:border-blue-500/10">
              <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 mb-2 uppercase tracking-widest text-center">Available Test Nodes</p>
              <div className="grid grid-cols-1 gap-1.5">
                <div 
                  className="flex justify-between items-center text-[9px] font-mono text-gray-500 bg-white/40 dark:bg-black/40 backdrop-blur-md p-2 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer hover:bg-white/60 dark:hover:bg-black/60 transition-colors"
                  onClick={() => handleLogin('0xLau96569c00101c111aa2a74d8695d2ebd64a797b71', 'admin1')}
                >
                  <span className="text-blue-600 dark:text-blue-500/70">ADMIN_01</span>
                  <span className="text-gray-600 dark:text-gray-400">0xLau9656...</span>
                  <span className="text-gray-900 dark:text-white/20">admin1</span>
                </div>
                <div 
                  className="flex justify-between items-center text-[9px] font-mono text-gray-500 bg-white/40 dark:bg-black/40 backdrop-blur-md p-2 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer hover:bg-white/60 dark:hover:bg-black/60 transition-colors"
                  onClick={() => handleLogin('0xLauNode_000000000000000000000000000001', 'admin1')}
                >
                  <span className="text-blue-600 dark:text-blue-500/70">NODE_001</span>
                  <span className="text-gray-600 dark:text-gray-400">0xLauNode_0...1</span>
                  <span className="text-gray-900 dark:text-white/20">admin1</span>
                </div>
              </div>
            </div>

            <a href="/consciousness.html" className="block text-center text-[10px] text-gray-600 hover:text-blue-600 dark:text-blue-500 mt-6 uppercase tracking-widest transition-colors">
              Consciousness Epicenter Access
            </a>
          </div>
          
          <div className="mt-10 pt-6 border-t border-black/5 dark:border-white/5 text-center">
            <div className="flex justify-center gap-4 mb-2">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-green-500 rounded-full" />
                <span className="text-[8px] text-gray-600 uppercase">Mainnet</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-blue-600 dark:bg-blue-500 rounded-full" />
                <span className="text-[8px] text-gray-600 uppercase">v20.26.04.30</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-500 dark:text-gray-700 font-mono">
              © 2026 LAUCOIN FOUNDATION | ALL RIGHTS RESERVED
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-900 dark:text-[#eee] font-mono selection:bg-blue-600/30 dark:selection:bg-blue-500/30 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-0">
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-4 text-center font-bold flex items-center justify-center gap-4"
          >
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs transition-colors"
            >
              Zavrieť
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Requests Modal */}
      <AnimatePresence>
        {showRequestsModal && user && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequestsModal(false)}
              className="absolute inset-0 bg-white dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-[#333] flex items-center justify-between bg-white/30 dark:bg-black/30 backdrop-blur-md">
                <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest">
                  Žiadosti o platbu
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-blue-600 dark:text-blue-500 transition-colors relative"
                  >
                    <Bell className="w-4 h-4" />
                    {requests.filter(r => r.to === user.address && r.status === 'pending').length > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-gray-50 dark:border-[#1a1a1a]" />
                    )}
                  </button>
                  <button 
                    onClick={() => setShowRequestsModal(false)}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-gray-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                {requests.filter(r => r.to === user.address && r.status === 'pending').length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-xs text-gray-600 uppercase tracking-widest">Žiadne nové žiadosti</p>
                  </div>
                ) : (
                  requests.filter(r => r.to === user.address && r.status === 'pending').map(req => (
                    <div key={req.id} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase">Od adresy</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-500 font-mono truncate max-w-[200px]">{req.from}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase">Suma</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{req.amount.toFixed(2)} LAU</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => {
                            handleAcceptRequest(req);
                            setShowRequestsModal(false);
                          }}
                          disabled={sending}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <Check className="w-3 h-3" /> Prijať
                        </button>
                        <button 
                          onClick={() => handleRejectRequest(req.id)}
                          className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-600 dark:text-red-500 text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-3 h-3" /> Odmietnuť
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 bg-black/5 dark:bg-black/50 border-t border-gray-200 dark:border-[#333]">
                <p className="text-[9px] text-gray-600 uppercase text-center">
                  Všetky žiadosti sú spracované v reálnom čase na LauCoin Kerneli
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 pt-24 space-y-8">
        {/* Main Navigation Tabs */}
        <div className="flex items-center gap-4 border-b border-black/10 dark:border-white/10 pb-4">
          <button 
            onClick={() => setActiveMainTab('dashboard')}
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeMainTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            <LayoutDashboard className="w-3 h-3" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveMainTab('network')}
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeMainTab === 'network' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            <Share2 className="w-3 h-3" />
            Network Map
          </button>
          <button 
            onClick={() => setActiveMainTab('leasing')}
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeMainTab === 'leasing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10'}`}
          >
            <Cpu className="w-3 h-3" />
            Leasing
          </button>
        </div>

        {activeMainTab === 'leasing' ? (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">Distributed Computing Leasing</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Lease computing power from other nodes to boost your mining efficiency</p>
              </div>
              <button 
                onClick={() => setShowLeaseModal(true)}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/20 font-bold uppercase text-xs transition-all hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                Vytvoriť Ponuku
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Dostupné Ponuky</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {leases.filter(l => l.status === 'available' && l.lessor !== user?.address).map(lease => (
                    <div key={lease.id} className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Cpu className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">Node Power</p>
                            <p className="text-[10px] text-gray-500 font-mono">{lease.lessor.substring(0, 15)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-blue-600 dark:text-blue-500">+{lease.power * 100}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Boost</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{lease.price} LAU</p>
                          <p className="text-[10px] text-gray-500 uppercase">Cena / {lease.durationMs / 3600000}h</p>
                        </div>
                        <button 
                          onClick={() => handleAcceptLease(lease)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all"
                        >
                          Prenajať
                        </button>
                      </div>
                    </div>
                  ))}
                  {leases.filter(l => l.status === 'available' && l.lessor !== user?.address).length === 0 && (
                    <div className="col-span-2 py-12 text-center opacity-40">
                      <Cpu className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-sm uppercase tracking-widest">Žiadne dostupné ponuky</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Moje Aktívne Prenájmy</h3>
                <div className="space-y-4">
                  {leases.filter(l => l.lessee === user?.address && l.status === 'active' && (l.expiresAt || 0) > Date.now()).map(lease => (
                    <div key={lease.id} className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">AKTÍVNY BOOST</span>
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">+{lease.power * 100}%</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase">
                        <span>Končí o:</span>
                        <span className="font-mono">{new Date(lease.expiresAt || 0).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                  {leases.filter(l => l.lessee === user?.address && l.status === 'active' && (l.expiresAt || 0) > Date.now()).length === 0 && (
                    <div className="py-8 text-center border border-dashed border-black/10 dark:border-white/10 rounded-2xl opacity-40">
                      <p className="text-[10px] uppercase tracking-widest">Nemáte aktívne prenájmy</p>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-8">Moje Ponuky</h3>
                <div className="space-y-4">
                  {leases.filter(l => l.lessor === user?.address).map(lease => (
                    <div key={lease.id} className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">Boost {lease.power * 100}%</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${lease.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {lease.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 uppercase">Cena: {lease.price} LAU</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        ) : activeMainTab === 'network' ? (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">Network Topology</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Real-time force-directed graph of LauCoin nodes</p>
              </div>
              <div className="flex items-center gap-4">
                {isAuthorized && (
                  <button 
                    onClick={async () => {
                      if (confirm("Naozaj chcete resetovať sieť? Všetky zostatky budú vynulované a pridajú sa sémantické uzly.")) {
                        addKernelLog('Initiating Network Reset...', 'ADMIN', 'WARN');
                        const batchSize = 500;
                        for (let i = 0; i < nodes.length; i += batchSize) {
                          const batch = writeBatch(db);
                          const chunk = nodes.slice(i, i + batchSize);
                          chunk.forEach(node => {
                            const nodeRef = doc(db, 'nodes', node.address);
                            batch.set(nodeRef, {
                              address: node.address,
                              balance: 0,
                              state_hash: node.state_hash
                            });
                          });
                          await batch.commit();
                        }
                        addKernelLog('Network Reset Complete', 'ADMIN');
                        alert("Sieť bola resetovaná.");
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-colors text-xs font-bold uppercase"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Sieť
                  </button>
                )}
                <div className="flex items-center gap-4 text-[10px] text-gray-500 uppercase font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Admins</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Nodes</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="h-[600px] w-full">
              <NetworkGraph 
                nodes={nodes} 
                validationStatuses={nodeValidationStatuses}
                chatHistory={chatHistory} 
                transactions={transactions} 
                miningSlots={miningSlots} 
                onNodeInspect={handleNodeDetailClick}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 p-4 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Total Active Nodes</p>
                <p className="text-xl font-black text-gray-900 dark:text-white">150,000,000,000,000</p>
              </div>
              <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 p-4 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Network Connectivity</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-500">99.9%</p>
              </div>
              <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 p-4 rounded-xl">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Consensus Protocol</p>
                <p className="text-xl font-black text-blue-600 dark:text-blue-500">Fractal-V</p>
              </div>
            </div>
          </motion.section>
        ) : (
          <>
            {/* Bitcoin Wallet Section - Moved to Modal */}

            {/* User Wallet Section */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl p-6 relative overflow-hidden group"
                >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet className="w-32 h-32" />
            </div>
            
            <h2 className="text-lg font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" /> Moja Peňaženka
              </div>
              <div className="flex items-center gap-2">
                {user && (
                  <button 
                    onClick={() => setShowRequestsModal(true)}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:text-blue-500 transition-all relative"
                  >
                    <Bell className="w-5 h-5" />
                    {requests.filter(r => r.to === user.address && r.status === 'pending').length > 0 && (
                      <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-gray-900 dark:text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {requests.filter(r => r.to === user.address && r.status === 'pending').length}
                      </span>
                    )}
                  </button>
                )}
                {user && (
                  <button 
                    onClick={handleLogout}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:text-red-500 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                )}
              </div>
            </h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] text-gray-500 uppercase mb-1">Adresa</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500/80 break-all font-mono">{user.address}</p>
                <p className="text-[10px] text-gray-500 uppercase mt-2 mb-1">Private Key (Hidden)</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500/80 break-all font-mono blur-sm hover:blur-none transition-all">{user.private_key}</p>
              </div>

              {lauSubWallets.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-xs text-gray-500 uppercase font-bold">LauCoin Sub-wallets</h3>
                  {lauSubWallets.map((sub, idx) => (
                    <div key={idx} className="p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">Address #{idx + 1}</p>
                      <p className="font-mono text-xs break-all">{sub.address}</p>
                      <p className="text-[10px] text-gray-500 uppercase mt-1">Private Key (Hidden)</p>
                      <p className="font-mono text-xs break-all blur-sm hover:blur-none transition-all">{sub.privateKey}</p>
                      <p className="font-bold text-blue-600 dark:text-blue-500 mt-1">{sub.balance} LAU</p>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={async () => {
                  const newWallet = await generateLauWallet();
                  setLauSubWallets([...lauSubWallets, newWallet]);
                  addKernelLog(`Generated new LauCoin sub-wallet: ${newWallet.address}`, 'SYSTEM', 'INFO');
                }}
                className="text-xs px-3 py-1.5 bg-blue-600/10 text-blue-600 dark:text-blue-500 rounded hover:bg-blue-600/20 transition-colors flex items-center gap-1 w-fit"
              >
                <Plus className="w-3 h-3" />
                Generate LauCoin Wallet
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10">
                  <p className="text-[10px] text-gray-500 uppercase mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Sémantická Hodnota
                  </p>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-500">
                    {((semanticValue !== null ? semanticValue : getSemanticValue(user)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">Ovplyvňuje rýchlosť ťažby a odmeny</p>
                </div>
                <CoinDetail 
                  name="LauCoin" 
                  symbol="LAU" 
                  balance={user.balance} 
                  priceEur={105.00} 
                  data={lauChartData}
                />
                <CoinDetail 
                  name="Ethereum" 
                  symbol="ETH" 
                  balance={ethBalance} 
                  priceEur={2450.50} 
                  data={ethChartData}
                />
                <CoinDetail 
                  name="Bitcoin" 
                  symbol="BTC" 
                  balance={bitcoinWallet?.balance || 0} 
                  priceEur={65000.00} 
                  data={[{ value: 0 }, { value: 0 }]}
                  onClick={() => setShowBitcoinWalletModal(true)}
                />
              </div>
              <button 
                onClick={() => setShowMiningModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Pickaxe className="w-4 h-4" /> Otvoriť Ťažbu
              </button>
            </div>
          </motion.div>
        </div>
      </section>

        {/* Sending and Swap Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send/Request LauCoin Form */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-[#333] pb-4">
              <button 
                onClick={() => setActiveTransferTab('send')}
                className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative ${activeTransferTab === 'send' ? 'text-blue-600 dark:text-blue-500' : 'text-gray-600 hover:text-gray-600 dark:text-gray-400'}`}
              >
                <Send className="w-4 h-4" /> Odoslať LauCoin
                {activeTransferTab === 'send' && <motion.div layoutId="tab-underline" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />}
              </button>
              <button 
                onClick={() => setActiveTransferTab('request')}
                className={`text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative ${activeTransferTab === 'request' ? 'text-blue-600 dark:text-blue-500' : 'text-gray-600 hover:text-gray-600 dark:text-gray-400'}`}
              >
                <ArrowDownLeft className="w-4 h-4" /> Prijať LauCoin
                {activeTransferTab === 'request' && <motion.div layoutId="tab-underline" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTransferTab === 'send' ? (
                <motion.form 
                  key="send"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSend} 
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Mena</label>
                    <select
                      value={sendCurrency}
                      onChange={(e) => setSendCurrency(e.target.value as any)}
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                    >
                      <option value="LauCoin">LauCoin (LAU)</option>
                      <option value="Ethereum">Ethereum (ETH)</option>
                      <option value="Bitcoin">Bitcoin (BTC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Adresa Príjemcu</label>
                    <input 
                      type="text" 
                      value={recipientAddr}
                      onChange={(e) => setRecipientAddr(e.target.value)}
                      placeholder="0xLau..."
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Suma</label>
                    <input 
                      type="number" 
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={sending}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? 'Zapisujem...' : 'Odoslať'}
                  </button>
                </motion.form>
              ) : (
                <motion.form 
                  key="request"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleRequestLau} 
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Žiadať od adresy</label>
                    <input 
                      type="text" 
                      value={requestFromAddr}
                      onChange={(e) => setRequestFromAddr(e.target.value)}
                      placeholder="0xLau..."
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Suma na vyžiadanie</label>
                    <input 
                      type="number" 
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={requesting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
                    {requesting ? 'Odosielam žiadosť...' : 'Vyžiadať LauCoin'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Swap Coins Form */}
          {isAuthorized && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl p-6"
            >
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Zameniť Coiny
              </h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                const amount = parseFloat(fromAmount);
                if (isNaN(amount) || amount <= 0) return;

                try {
                  if (isEthToLau) {
                    // Simulated Swap ETH -> LAU
                    if (amount > ethBalance) {
                      alert("Nedostatočný zostatok ETH.");
                      return;
                    }
                    
                    const lauReward = amount * 20000; // 1 ETH = 20,000 LAU (simulated rate)
                    const userRef = doc(db, 'nodes', user.address);
                    const txRef = doc(collection(db, 'transactions'));
                    const txHash = await generateTransactionHash('KERNEL_SWAP_ETH_LAU', user.address);

                    await runTransaction(db, async (transaction) => {
                      const userDoc = await transaction.get(userRef);
                      if (!userDoc.exists()) throw new Error("Node not found");
                      
                      transaction.update(userRef, { balance: userDoc.data().balance + lauReward });
                      transaction.set(txRef, {
                        from: 'KERNEL_SWAP_CONTRACT',
                        to: user.address,
                        amount: lauReward,
                        timestamp: Date.now(),
                        hash: `0x${txHash}`,
                        type: 'swap'
                      });
                    });
                    
                    // Update local ETH balance (simulated)
                    setEthBalance(prev => prev - amount);
                    alert(`Swap úspešný! Získali ste ${lauReward.toFixed(2)} LAU.`);
                  } else {
                    // Simulated Swap LAU -> ETH
                    if (amount > user.balance) {
                      alert("Nedostatočný zostatok LAU.");
                      return;
                    }

                    const ethReward = amount / 20000;
                    const userRef = doc(db, 'nodes', user.address);
                    const txRef = doc(collection(db, 'transactions'));
                    const txHash = await generateTransactionHash('KERNEL_SWAP_LAU_ETH', user.address);

                    await runTransaction(db, async (transaction) => {
                      const userDoc = await transaction.get(userRef);
                      if (!userDoc.exists()) throw new Error("Node not found");
                      
                      transaction.update(userRef, { balance: userDoc.data().balance - amount });
                      transaction.set(txRef, {
                        from: user.address,
                        to: 'KERNEL_SWAP_CONTRACT',
                        amount: amount,
                        timestamp: Date.now(),
                        hash: `0x${txHash}`,
                        type: 'swap'
                      });
                    });

                    setEthBalance(prev => prev + ethReward);
                    alert(`Swap úspešný! Získali ste ${ethReward.toFixed(6)} ETH.`);
                  }
                  setFromAmount('');
                } catch (error) {
                  console.error("Swap error:", error);
                  alert("Chyba pri swape.");
                }
              }} className="space-y-4">
                <div className="relative space-y-2">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Z</label>
                    <input 
                      type="number" 
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-3 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                      required
                    />
                    <span className="absolute top-[38px] right-4 text-emerald-600 dark:text-emerald-500 text-xs font-bold">{isEthToLau ? 'ETH' : 'LAU'}</span>
                  </div>
                  
                  <div className="flex justify-center">
                    <button 
                      type="button"
                      onClick={() => setIsEthToLau(!isEthToLau)}
                      className="bg-gray-200 dark:bg-[#222] hover:bg-gray-300 dark:hover:bg-[#333] p-2 rounded-full transition-all"
                    >
                      <motion.div
                        whileHover={{ rotate: 180 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-500 rotate-90" />
                      </motion.div>
                    </button>
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Na</label>
                    <input 
                      type="number" 
                      value={toAmount}
                      readOnly
                      placeholder="0.00"
                      className="w-full bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#333] rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 outline-none cursor-not-allowed"
                    />
                    <span className="absolute bottom-[18px] right-4 text-blue-600 dark:text-blue-500 text-xs font-bold">{isEthToLau ? 'LAU' : 'ETH'}</span>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-all shadow-lg shadow-blue-500/20"
                >
                  Zameniť {isEthToLau ? 'ETH na LAU' : 'LAU na ETH'}
                </motion.button>
              </form>
            </motion.div>
          )}
        </section>

        {/* Admin Minting Panel */}
        {isAuthorized && (
          <section>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-blue-600/5 dark:bg-blue-500/5 border border-blue-600/20 dark:border-blue-500/20 rounded-xl p-6"
            >
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Admin Minting
              </h2>
              <div className="space-y-4">
                <p className="text-[10px] text-gray-500">
                  Ako administrátor siete môžete vyraziť nové LauCoiny priamo do vášho uzla.
                </p>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Suma na vyrazenie (LauCoin)</label>
                  <input 
                    type="number" 
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 outline-none"
                  />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAdminMint}
                  disabled={minting || !mintAmount}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {minting ? 'Minting...' : 'Mint LauCoin'}
                </motion.button>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Cieľová peňaženka</label>
                  <select
                    value={selectedWalletIndex}
                    onChange={(e) => setSelectedWalletIndex(Number(e.target.value))}
                    className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-orange-500 outline-none"
                  >
                    <option value={-1}>Hlavná peňaženka ({bitcoinWallet?.address.slice(0, 8)}...)</option>
                    {bitcoinSubWallets.map((sub, idx) => (
                      <option key={sub.index} value={idx}>Podpeňaženka #{sub.index} ({sub.address.slice(0, 8)}...)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Suma na vyrazenie (Bitcoin)</label>
                  <input 
                    type="number" 
                    value={mintBitcoinAmount}
                    onChange={(e) => setMintBitcoinAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg p-2 text-sm text-gray-900 dark:text-white focus:border-orange-500 outline-none"
                  />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAdminMintBitcoin}
                  disabled={minting || !mintBitcoinAmount}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-orange-500/20"
                >
                  {minting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {minting ? 'Minting...' : 'Mint Bitcoin'}
                </motion.button>
                
                <div className="pt-4 border-t border-blue-600/10 dark:border-blue-500/10">
                  <p className="text-[10px] text-gray-500 mb-2">
                    Inicializácia siete (iba ak je databáza prázdna):
                  </p>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSeedNetwork}
                    disabled={initializing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {initializing ? 'Initializing...' : 'Seed Network State'}
                  </motion.button>

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleVerifyAllNodes}
                    disabled={initializing}
                    className="w-full mt-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-600 dark:text-blue-500 font-bold py-2 rounded-lg border border-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Verify All Nodes
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </section>
        )}


        {/* Explorer Section */}
        <section className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4" /> LauExplorer (Vyhľadávanie v sieti)
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={downloadNetworkData}
                  className="text-[10px] text-emerald-600 dark:text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded uppercase tracking-tighter transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </button>

              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zadaj adresu alebo stavový hash..."
                  className="w-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-lg py-3 pl-10 pr-4 text-gray-900 dark:text-white focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                Hľadať
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {searchResult && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-8 border-t border-gray-200 dark:border-[#333] pt-8 space-y-6"
                >
                  <div className="bg-white/30 dark:bg-black/30 backdrop-blur-md rounded-xl p-6">
                    <h3 className="text-gray-900 dark:text-white font-bold mb-6 flex items-center gap-2">
                      <Hash className="w-4 h-4 text-blue-600 dark:text-blue-500" /> Informácie o uzle
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-6">
                        <div className="bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-lg p-4">
                          <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase mb-2 font-bold flex items-center gap-2">
                            <Hash className="w-3 h-3" /> Adresa Uzla
                          </p>
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-mono break-all bg-white dark:bg-black/60 p-2 rounded border border-emerald-500/10">
                            {searchResult.address}
                          </p>
                        </div>
                        
                        <div className="bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-lg p-4">
                          <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase mb-2 font-bold flex items-center gap-2">
                            <Shield className="w-3 h-3" /> Stavový Hash (Kernel State)
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-300 break-all font-mono leading-relaxed">
                            {searchResult.state_hash}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-lg p-4">
                            <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase mb-1 font-bold">Sieťový Status</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                              <p className="text-xs text-gray-900 dark:text-white font-bold uppercase tracking-tighter">Aktívny / Online</p>
                            </div>
                          </div>
                          <div className="bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-lg p-4">
                            <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase mb-1 font-bold">Validácia</p>
                            <p className="text-xs text-gray-900 dark:text-white font-bold uppercase tracking-tighter">Verified by Pi</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="bg-blue-600/10 border border-blue-600/20 dark:border-blue-500/20 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                          <Coins className="w-8 h-8 text-blue-600 dark:text-blue-500 mb-2" />
                          <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase font-bold mb-1">Aktuálny Zostatok</p>
                          <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">
                            {searchResult.balance.toFixed(6)} <span className="text-xs text-blue-500 dark:text-blue-400">LAU</span>
                          </p>
                        </div>



                        <div className="bg-white/40 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-lg p-4">
                          <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase mb-2 font-bold">Sieťová Aktivita</p>
                          <div className="flex gap-1 h-8 items-end">
                            {Array.from({ length: 12 }).map((_, i) => (
                              <motion.div 
                                key={i}
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.random() * 100}%` }}
                                transition={{ repeat: Infinity, duration: 2, repeatType: 'reverse', delay: i * 0.1 }}
                                className="flex-1 bg-blue-600/30 dark:bg-blue-500/30 rounded-t-sm"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction History for searched node */}
                  <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-[#333] bg-white/30 dark:bg-black/30 backdrop-blur-md flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <ArrowRightLeft className="w-3 h-3" /> História Transakcií
                      </h3>
                      <span className="text-[10px] text-gray-600">{nodeTransactions.length} záznamov</span>
                    </div>
                    
                    <div className="divide-y divide-[#222]">
                      {transactions.length === 0 ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="p-4 space-y-3">
                            <div className="flex justify-between">
                              <div className="flex gap-3">
                                <Skeleton className="w-10 h-10" />
                                <div className="space-y-2">
                                  <Skeleton className="h-4 w-24" />
                                  <Skeleton className="h-3 w-32" />
                                </div>
                              </div>
                              <Skeleton className="h-6 w-20" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                          </div>
                        ))
                      ) : nodeTransactions.length > 0 ? (
                        nodeTransactions.map(tx => (
                          <div key={tx.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                {tx.from === searchResult.address ? (
                                  <div className="p-2 bg-red-500/10 rounded text-red-600 dark:text-red-500">
                                    <ArrowUpRight className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <div className="p-2 bg-emerald-500/10 rounded text-emerald-600 dark:text-emerald-500">
                                    <ArrowDownLeft className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {tx.from === searchResult.address ? 'Odoslané' : 'Prijaté'}
                                  </p>
                                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {new Date(tx.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-lg font-bold ${tx.from === searchResult.address ? 'text-red-600 dark:text-red-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                                  {tx.from === searchResult.address ? '-' : '+'}{tx.amount.toFixed(6)} <span className="text-[10px]">Lau</span>
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[#222] flex flex-col gap-1">
                              <p className="text-[9px] text-gray-600 uppercase tracking-tighter">TX HASH: <span className="text-gray-600 dark:text-gray-400">{tx.hash}</span></p>
                              <p className="text-[9px] text-gray-600 uppercase tracking-tighter flex items-center gap-1">
                                {tx.from === searchResult.address ? 'TO: ' : 'FROM: '}
                                <span className="text-blue-600 dark:text-blue-500 font-mono truncate max-w-[150px]">{tx.from === searchResult.address ? tx.to : tx.from}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center">
                          <p className="text-xs text-gray-600 uppercase tracking-widest">Žiadne transakcie nenájdené</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Kernel Console Section */}
          <section className="space-y-8 mt-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Kernel System Console
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono uppercase tracking-tighter">System Live</span>
                  </div>
                  <button 
                    onClick={() => setKernelLogs([])}
                    className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-tighter"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div 
                ref={consoleRef}
                className="h-[300px] overflow-y-auto p-6 font-mono text-[11px] leading-relaxed space-y-1.5 scrollbar-thin scrollbar-thumb-white/10"
              >
                {kernelLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-700 italic">
                    No active logs in buffer...
                  </div>
                ) : (
                  kernelLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 group">
                      <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                      <span className={`shrink-0 w-12 font-bold ${
                        log.level === 'ERROR' ? 'text-red-600 dark:text-red-500' : 
                        log.level === 'WARN' ? 'text-yellow-600 dark:text-yellow-500' : 
                        'text-emerald-600 dark:text-emerald-500'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-blue-600 dark:text-blue-500 shrink-0">[{log.subsystem}]</span>
                      <span className="text-gray-700 dark:text-gray-300 break-all group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="px-6 py-2 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[9px] text-gray-600 font-mono uppercase tracking-widest">
                <div className="flex gap-4">
                  <span>Buffer: {kernelLogs.length}/50</span>
                  <span>Status: Operational</span>
                </div>
                <div className="text-emerald-600 dark:text-emerald-500/50">
                  LauNet Kernel v20.26.04.30
                </div>
              </div>
            </motion.div>
          </section>

          {/* Full Genesis Registry */}
          <AnimatePresence>
            {showRegistry && isAuthorized && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-xl overflow-hidden"
              >
                <div className="p-6 border-b border-gray-200 dark:border-[#333] bg-white/30 dark:bg-black/30 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest">Genesis Registry</h2>
                    <p className="text-[10px] text-gray-500 font-mono">KOMPLETNÝ ZOZNAM UZLOV SIETE (999)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-900 dark:text-white font-bold">LauCoin Kernel</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500">VERIFIED BY PI</p>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white/30 dark:bg-black/30 backdrop-blur-md z-10">
                      <tr className="border-b border-gray-200 dark:border-[#333]">
                        <th className="sticky top-0 bg-white/30 dark:bg-black/30 backdrop-blur-md z-10 p-4 text-[10px] text-gray-500 uppercase font-mono">ID</th>
                        <th className="p-4 text-[10px] text-gray-500 uppercase font-mono">Adresa</th>
                        <th className="p-4 text-[10px] text-red-600 dark:text-red-500/70 uppercase font-mono">Private Key</th>
                        <th className="p-4 text-[10px] text-gray-500 uppercase font-mono">Zostatok</th>
                        <th className="p-4 text-[10px] text-gray-500 uppercase font-mono text-right">Validácia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {nodes.length === 0 ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i}>
                            <td className="p-4"><Skeleton className="h-4 w-8" /></td>
                            <td className="p-4"><Skeleton className="h-4 w-48" /></td>
                            <td className="p-4"><Skeleton className="h-4 w-64" /></td>
                            <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                            <td className="p-4"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          </tr>
                        ))
                      ) : (
                        nodes.map(node => {
                          const validationStatus = nodeValidationStatuses[node.address];
                          const isInvalid = validationStatus === 'Invalid';
                          
                          return (
                            <tr 
                              key={node.id} 
                              onClick={() => handleNodeDetailClick(node)}
                              className={`transition-colors cursor-pointer group ${isInvalid ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-white/[0.02]'}`}
                            >
                              <td className="p-4 text-xs text-gray-500 font-mono">#{node.id}</td>
                              <td className="p-4 text-xs text-emerald-600 dark:text-emerald-500/80 font-mono truncate max-w-[200px]">{node.address}</td>
                              <td className="p-4 text-[10px] text-red-600 dark:text-red-500/40 font-mono break-all max-w-[300px] group-hover:text-red-600 dark:text-red-500/80 transition-colors">
                                {node.private_key}
                              </td>
                              <td className="p-4 text-xs text-gray-900 dark:text-white font-bold">{node.balance.toFixed(6)} Lau</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  {validationStatus && (
                                    <span className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded ${
                                      validationStatus === 'Valid' ? 'bg-emerald-500/20 text-emerald-500' :
                                      validationStatus === 'Invalid' ? 'bg-red-500/20 text-red-500' :
                                      'bg-blue-500/20 text-blue-500 animate-pulse'
                                    }`}>
                                      {validationStatus === 'Pending' ? (
                                        <span className="flex items-center gap-1">
                                          <RefreshCw className="w-2 h-2 animate-spin" />
                                          Overujem
                                        </span>
                                      ) : validationStatus}
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      validateNodeHash(node);
                                    }}
                                    disabled={validationStatus === 'Pending'}
                                    className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-gray-500 hover:text-blue-500 transition-all"
                                    title="Validovať State Hash"
                                  >
                                    <Shield className={`w-3.5 h-3.5 ${validationStatus === 'Pending' ? 'animate-pulse' : ''}`} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-8 text-center border-t border-gray-200 dark:border-[#333] mt-12">
        <p className="text-[10px] text-gray-600 font-mono uppercase tracking-[0.3em]">
          &copy; 2026 LauCoin Network Protocol | Decentralized Fractal Validation
        </p>
      </footer>

      {/* Bitcoin Wallet Modal */}
      <AnimatePresence>
        {showBitcoinWalletModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowBitcoinWalletModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-black/5 dark:bg-white/5">
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-orange-500" />
                  Bitcoin Wallet (Mainnet)
                </h2>
                <button 
                  onClick={() => setShowBitcoinWalletModal(false)}
                  className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {bitcoinStats && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Block Height</p>
                      <p className="font-bold">{bitcoinStats.blockHeight}</p>
                    </div>
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Hash Rate</p>
                      <p className="font-bold">{bitcoinStats.hashRate}</p>
                    </div>
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg">
                      <p className="text-[10px] text-gray-500 uppercase">Avg Fee (sat/vB)</p>
                      <p className="font-bold">{bitcoinStats.avgFee}</p>
                    </div>
                  </div>
                )}

                <div className="h-64 mb-6 bg-black/5 dark:bg-white/5 rounded-lg p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bitcoinPriceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="time" stroke="#888" />
                      <YAxis stroke="#888" domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
                      <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {!bitcoinWallet ? (
                  <button
                    onClick={async () => {
                      const wallet = await generateBitcoinWallet();
                      const balance = await getBitcoinBalance(wallet.address);
                      setBitcoinWallet({ ...wallet, balance });
                    }}
                    className="w-full px-6 py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Pickaxe className="w-5 h-5" />
                    Generate Bitcoin Wallet
                  </button>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-black/10 dark:bg-white/10 rounded-lg relative group">
                      <p className="text-xs text-gray-500 uppercase">Main Address</p>
                      <p className="font-mono text-sm break-all">{bitcoinWallet.address}</p>
                      <p className="text-xs text-gray-500 uppercase mt-2">Private Key (Hidden)</p>
                      <p className="font-mono text-xs break-all blur-sm group-hover:blur-none transition-all">{bitcoinWallet.privateKey}</p>
                      <p className="text-xl font-bold mt-2 text-orange-500">{bitcoinWallet.balance} BTC</p>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Sub-wallets
                      </h3>
                      {bitcoinSubWallets.map((sub) => (
                        <div key={sub.index} className="p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 relative group">
                          <p className="text-xs text-gray-500 uppercase">Address #{sub.index}</p>
                          <p className="font-mono text-xs break-all">{sub.address}</p>
                          <p className="text-xs text-gray-500 uppercase mt-2">Private Key (Hidden)</p>
                          <p className="font-mono text-xs break-all blur-sm group-hover:blur-none transition-all">{sub.privateKey}</p>
                          <p className="font-bold text-orange-500 mt-2">{sub.balance} BTC</p>
                        </div>
                      ))}
                      <button
                        onClick={async () => {
                          const newIndex = bitcoinSubWallets.length + 1;
                          const subWallet = await deriveBitcoinWalletFromMnemonic(bitcoinWallet.mnemonic, newIndex);
                          const balance = await getBitcoinBalance(subWallet.address);
                          setBitcoinSubWallets([...bitcoinSubWallets, { ...subWallet, balance }]);
                        }}
                        className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Generate Sub-wallet
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        const balance = await getBitcoinBalance(bitcoinWallet.address);
                        setBitcoinWallet(prev => prev ? { ...prev, balance } : null);
                        // Refresh sub-wallets
                        const updatedSubs = await Promise.all(bitcoinSubWallets.map(async (sub) => ({
                          ...sub,
                          balance: await getBitcoinBalance(sub.address)
                        })));
                        setBitcoinSubWallets(updatedSubs);
                      }}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Balances
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Node Detail Modal */}
      <AnimatePresence>
        {showNodeDetailModal && selectedNodeDetail && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNodeDetailModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Globe className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Detail Uzla</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">LauCoin Network Explorer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowNodeDetailModal(false)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Node Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Adresa Uzla</p>
                    <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all">{selectedNodeDetail.address || selectedNodeDetail.id}</p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Zostatok</p>
                    <p className="text-xl font-black text-gray-900 dark:text-white">
                      {selectedNodeDetail.balance?.toFixed(6) || '0.000000'} <span className="text-xs font-normal text-gray-500">LAU</span>
                    </p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">State Hash</p>
                    <p className="text-xs font-mono text-blue-500 break-all">{selectedNodeDetail.state_hash || 'N/A'}</p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Sémantická Hodnota</p>
                    <p className="text-xl font-black text-purple-500">
                      {(selectedNodeDetail.semanticValue !== undefined ? selectedNodeDetail.semanticValue : getSemanticValue(selectedNodeDetail)).toFixed(2)} <span className="text-xs font-normal text-gray-500">SV</span>
                    </p>
                  </div>
                  
                  {/* Validation Status Section */}
                  <div className={`p-4 rounded-2xl border col-span-1 md:col-span-2 ${nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Invalid' ? 'bg-red-500/10 border-red-500/20' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-4 h-4 ${nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Valid' ? 'text-emerald-500' : nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Invalid' ? 'text-red-500' : 'text-gray-400'}`} />
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Validation Status</p>
                      </div>
                      {nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                          nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Valid' ? 'bg-emerald-500/20 text-emerald-500' : 
                          nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Invalid' ? 'bg-red-500/20 text-red-500' : 
                          'bg-blue-500/20 text-blue-500 animate-pulse'
                        }`}>
                          {nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id]}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => validateNodeHash(selectedNodeDetail as any)}
                      disabled={nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Pending'}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      {nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] === 'Pending' ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {nodeValidationStatuses[selectedNodeDetail.address || selectedNodeDetail.id] ? 'Re-Validate Node Integrity' : 'Initialize State Validation'}
                    </button>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <ArrowRightLeft className="w-3 h-3" />
                    Nedávne Transakcie
                  </h4>
                  <div className="space-y-2">
                    {selectedNodeTransactions.length > 0 ? (
                      selectedNodeTransactions.map((tx: any) => {
                        const nodeAddr = selectedNodeDetail.address || selectedNodeDetail.id;
                        const isOutgoing = tx.from === nodeAddr;
                        return (
                          <div key={tx.id} className="bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/5 flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${isOutgoing ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                {isOutgoing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                              </div>
                              <div>
                                <p className="font-mono text-gray-400">
                                  {isOutgoing ? `To: ${(tx.to || '').substring(0, 10)}...` : `From: ${(tx.from || '').substring(0, 10)}...`}
                                </p>
                                <p className="text-gray-500">{new Date(tx.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                            <p className={`font-black ${isOutgoing ? 'text-red-500' : 'text-emerald-500'}`}>
                              {isOutgoing ? '-' : '+'}{tx.amount.toFixed(4)} LAU
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Žiadne transakcie nenájdené</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-black/5 dark:bg-white/5 flex justify-end">
                <button 
                  onClick={() => setShowNodeDetailModal(false)}
                  className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  Zavrieť
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && pendingTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !sending && setShowConfirmModal(false)}
              className="absolute inset-0 bg-white dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-gradient-x" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-600/10 dark:bg-blue-500/10 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Potvrdenie Transakcie</h3>
                  <p className="text-xs text-gray-500 font-mono uppercase">Review Network Operation</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Odosielateľ</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500/80 font-mono truncate">{pendingTx.from}</p>
                  </div>
                  
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl p-2 rounded-full">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-500 rotate-90" />
                    </div>
                  </div>

                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Príjemca</p>
                    <p className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate">{pendingTx.to}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-widest">Suma</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{pendingTx.amount.toFixed(6)} <span className="text-[10px] text-blue-600 dark:text-blue-500">Lau</span></p>
                  </div>
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-widest">Poplatok</p>
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{pendingTx.fee.toFixed(6)} <span className="text-[10px] text-blue-600 dark:text-blue-500">Lau</span></p>
                  </div>
                </div>

                <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Transaction Hash (Preview)</p>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 font-mono break-all bg-white dark:bg-black p-2 rounded border border-gray-200 dark:border-[#333]">{pendingTx.hash}</p>
                </div>

                <div className="bg-blue-600/5 dark:bg-blue-500/5 border border-blue-600/20 dark:border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-3 h-3 text-blue-600 dark:text-blue-500" />
                    <p className="text-[10px] text-blue-600 dark:text-blue-500 uppercase font-bold tracking-widest">Podpis Transakcie</p>
                  </div>
                  <input 
                    type="password"
                    value={confirmPrivKey}
                    onChange={(e) => setConfirmPrivKey(e.target.value)}
                    placeholder="Vložte privátny kľúč pre podpis"
                    className="w-full bg-white dark:bg-black/50 border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                  />
                  <p className="text-[9px] text-gray-500 mt-2 italic">
                    * Transakcia bude digitálne podpísaná týmto kľúčom. Kľúč sa neodosiela na server, odosiela sa len podpis.
                  </p>
                </div>

                <p className="text-[10px] text-gray-500 font-mono text-center italic">
                  * Poplatok bude odoslaný do Kernel Treasury na zabezpečenie siete.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  disabled={sending}
                  className="px-6 py-3 rounded-xl border border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400 font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
                >
                  Zrušiť
                </button>
                <button 
                  onClick={confirmTransaction}
                  disabled={sending}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-gray-900 dark:text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Zapisujem...' : 'Potvrdiť'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Confirmation Modal */}
      <AnimatePresence>
        {showConfirmRequestModal && pendingRequestTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !requesting && setShowConfirmRequestModal(false)}
              className="absolute inset-0 bg-white dark:bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl rounded-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 animate-gradient-x" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <ArrowDownLeft className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Potvrdenie Žiadosti</h3>
                  <p className="text-xs text-gray-500 font-mono uppercase">Review Payment Request</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Žiadateľ (Vy)</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500/80 font-mono truncate">{pendingRequestTx.from}</p>
                  </div>
                  
                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-white/40 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xl p-2 rounded-full">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                    </div>
                  </div>

                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Platca (Cieľ)</p>
                    <p className="text-xs text-blue-500 dark:text-blue-400 font-mono truncate">{pendingRequestTx.to}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-widest">Suma na vyžiadanie</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{pendingRequestTx.amount.toFixed(6)} <span className="text-[10px] text-emerald-600 dark:text-emerald-500">Lau</span></p>
                  </div>
                  <div className="bg-black/5 dark:bg-black/50 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-widest">Poplatok (platíte vy)</p>
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{pendingRequestTx.fee.toFixed(6)} <span className="text-[10px] text-emerald-600 dark:text-emerald-500">Lau</span></p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmRequestModal(false)}
                  disabled={requesting}
                  className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Zrušiť
                </button>
                <button 
                  onClick={confirmRequestTransaction}
                  disabled={requesting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
                  {requesting ? 'Odosielam...' : 'Potvrdiť žiadosť'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mining Modal */}
      <AnimatePresence>
        {showMiningModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isMining && setShowMiningModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full h-full sm:h-auto sm:max-w-2xl bg-[#0a0a0a] rounded-none sm:rounded-2xl p-6 sm:p-8 shadow-2xl overflow-y-auto border border-blue-500/20 font-mono"
            >
              <div className="flex items-center justify-between mb-8 border-b border-blue-500/20 pb-4">
                <h2 className="text-sm font-bold text-blue-500 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Terminal className="w-5 h-5 animate-pulse" /> 
                  <span>LauNet Leasing & Mining Terminal</span>
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-500 uppercase tracking-tighter">Kernel Link: Active</span>
                  </div>
                  <button 
                    onClick={() => setShowMiningModal(false)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Grid & Progress */}
                <div className="space-y-6">
                  <div className="bg-black/40 border border-blue-500/10 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest">Leasing Grid Status</p>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-emerald-500/50 rounded-sm" />
                          <span className="text-[8px] text-gray-500">FREE</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-rose-500/20 rounded-sm" />
                          <span className="text-[8px] text-gray-500">BUSY</span>
                        </div>
                      </div>
                    </div>
                    
                    <div 
                      ref={gridContainerRef}
                      className="grid grid-cols-10 gap-1 max-h-[200px] overflow-y-auto p-2 bg-black/60 rounded-lg border border-white/5 shadow-inner custom-scrollbar"
                    >
                      {miningSlots.map(slot => {
                        const isAvailable = Date.now() > slot.lastMinedAt + slot.cooldownMs;
                        const isActive = activeSlotId === slot.id;
                        
                        return (
                          <div
                            key={slot.id}
                            ref={isActive ? activeSlotRef : null}
                            className={`w-full aspect-square rounded-[1px] flex items-center justify-center transition-all duration-300 ${
                              isActive 
                                ? 'bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)] border border-white z-10 scale-125' 
                                : slot.isGolden
                                  ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-amber-300'
                                  : isAvailable 
                                    ? 'bg-emerald-500/30 border border-emerald-500/20 hover:bg-emerald-500/50 cursor-pointer' 
                                    : slot.lastResultEmpty
                                      ? 'bg-rose-600/40 border border-rose-500/50'
                                      : 'bg-rose-500/10 border border-rose-500/10 opacity-40'
                            }`}
                            title={`Unit #${slot.id.toString().padStart(4, '0')} - ${isAvailable ? 'Available' : 'Cooldown'}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border transition-all duration-500 ${isMining ? 'bg-blue-600/10 border-blue-600/30' : 'bg-black/40 border-white/5'}`}>
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest mb-1">
                          {isMining ? 'Lease Operation in Progress' : 'System Standby'}
                        </p>
                        <p className="text-[9px] text-gray-500">
                          {isMining ? `Allocating unit #${activeSlotId?.toString().padStart(4, '0')}...` : 'Waiting for lease command'}
                        </p>
                      </div>
                      <span className={`text-lg font-bold ${isMining ? 'text-blue-500' : 'text-gray-700'}`}>
                        {miningProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${miningProgress}%` }}
                        className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                      <p className="text-[8px] text-gray-500 uppercase mb-1">Total Units</p>
                      <p className="text-sm font-bold text-white">{miningSlots.length}</p>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                      <p className="text-[8px] text-emerald-500 uppercase mb-1">Available</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {miningSlots.filter(s => Date.now() > s.lastMinedAt + s.cooldownMs).length}
                      </p>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                      <p className="text-[8px] text-rose-500 uppercase mb-1">Cooldown</p>
                      <p className="text-sm font-bold text-rose-400">
                        {miningSlots.filter(s => Date.now() <= s.lastMinedAt + s.cooldownMs).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Console & Controls */}
                <div className="space-y-6 flex flex-col">
                  <div className="flex-1 bg-black/60 rounded-xl border border-blue-500/10 p-4 h-[320px] overflow-y-auto font-mono text-[9px] custom-scrollbar relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    </div>
                    
                    {miningLogs.length === 0 ? (
                      <div className="text-gray-700 italic flex flex-col gap-2">
                        <p>{'>'} Initializing LauNet Terminal...</p>
                        <p>{'>'} Kernel connection established.</p>
                        <p>{'>'} Waiting for lease command...</p>
                        <span className="animate-pulse">_</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {miningLogs.map((log, i) => (
                          <div key={i} className={`border-l-2 pl-2 py-1 ${
                            log.isGolden ? 'border-amber-400 bg-amber-400/5' : 
                            log.isEmpty ? 'border-rose-500 bg-rose-500/5' : 
                            'border-blue-500/20'
                          }`}>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className={
                                log.isGolden ? 'text-amber-500 font-bold' : 
                                log.isEmpty ? 'text-rose-400 font-bold' : 
                                'text-blue-400/80'
                              }>
                                [{new Date(log.timestamp).toLocaleTimeString()}] {log.isGolden && '✨ GOLDEN'} {log.isEmpty && '⚠️ EMPTY'}
                              </span>
                              <span className={`${
                                log.isGolden ? 'text-amber-400 font-black' : 
                                log.isEmpty ? 'text-rose-500 font-bold' : 
                                'text-emerald-400 font-bold'
                              }`}>
                                {log.isEmpty ? '0.000000' : `+${log.amount.toFixed(log.isGolden ? 4 : 6)}`} LAU
                              </span>
                            </div>
                            <div className="text-[8px] text-gray-600 truncate">
                              HASH: {log.hash}
                            </div>
                          </div>
                        ))}
                        <div className="animate-pulse text-blue-500">{'>'} _</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={handleStartMining}
                      disabled={isMining || autoMining}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 group"
                    >
                      <Zap className={`w-5 h-5 ${autoMining ? 'animate-pulse text-amber-400' : ''}`} /> 
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-widest leading-none">Initialize Lease</p>
                        <p className="text-[8px] font-normal opacity-70 tracking-tighter">Decentralized Fractal Mining</p>
                      </div>
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setAutoMining(!autoMining)}
                        className={`py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${autoMining ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
                      >
                        {autoMining ? 'Auto: ON' : 'Auto: OFF'}
                      </button>
                      <button 
                        onClick={() => {
                          setAutoMining(false);
                          setShowMiningModal(false);
                        }}
                        className="py-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-blue-500/10 flex items-center justify-between text-[8px] text-gray-600 uppercase tracking-widest">
                <div className="flex gap-4">
                  <span>Network Load: 42.8%</span>
                  <span>Lease Demand: High</span>
                </div>
                <div className="text-blue-500/50">
                  LauNet Kernel v20.26.04.30
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lease Modal */}
      <AnimatePresence>
        {showLeaseModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isLeasing && setShowLeaseModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#111] rounded-2xl p-8 shadow-2xl border border-black/10 dark:border-white/10"
            >
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tighter">Vytvoriť Ponuku Prenájmu</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Výkon (Boost Multiplier)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0.1" 
                      max="2.0" 
                      step="0.1"
                      value={leasePower}
                      onChange={(e) => setLeasePower(e.target.value)}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-500 w-12 text-right">+{parseFloat(leasePower) * 100}%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Cena (LAU)</label>
                  <input 
                    type="number" 
                    value={leasePrice}
                    onChange={(e) => setLeasePrice(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="Napr. 10"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-2 font-bold tracking-widest">Trvanie (Hodiny)</label>
                  <select 
                    value={leaseDuration}
                    onChange={(e) => setLeaseDuration(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  >
                    <option value="1">1 hodina</option>
                    <option value="6">6 hodín</option>
                    <option value="12">12 hodín</option>
                    <option value="24">24 hodín</option>
                    <option value="48">48 hodín</option>
                    <option value="168">1 týždeň</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setShowLeaseModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    Zrušiť
                  </button>
                  <button 
                    onClick={handleCreateLease}
                    disabled={isLeasing}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLeasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Vytvoriť
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
