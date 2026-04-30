import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { generateContentWithRetry } from '../services/geminiService';
import { Brain, Image as ImageIcon, Send, Loader2, Key, MessageSquare, Settings, Trash2, X, Wifi, WifiOff, Zap, Database, Info, Activity, Globe, Cpu, Hash, BarChart3, Binary, ShieldCheck, Search, AlertCircle, RotateCcw, Sun, Moon, RefreshCw, Bell, LogOut, LayoutDashboard, Share2, Mic, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { onSnapshot, collection } from 'firebase/firestore';
import { ApiError, ApiErrorType } from '../types';
import ApiErrorDisplay from './ApiErrorDisplay';

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  type: 'text' | 'image' | 'error';
  content: string;
  timestamp: Date;
  userName?: string;
  apiError?: ApiError;
}

interface LaurinChatAppProps {
  currentUser?: any;
}

export const LaurinChatApp: React.FC<LaurinChatAppProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [queriesLeft, setQueriesLeft] = useState<number | null>(null);
  const [totalQueries, setTotalQueries] = useState<number>(50);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('laurin_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAuthed, setIsAuthed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('laurin_voice_enabled') === 'true';
  });
  const [providerConfig, setProviderConfig] = useState({
    provider: 'gemini',
    url: '',
    key: '',
    model: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('laurin_voice_enabled', String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'sk-SK'; // Default for user

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        // Automatically send after a short delay if it's a long enough phrase
        if (transcript.length > 5) {
          setTimeout(() => {
             // We can't easily trigger sendMessage here because it uses 'input' state which might not be updated yet
             // So we just set the input and let the user see it/send it, or we could pass it to a helper
          }, 500);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        // Explicitly request mic permission if needed (some browsers require this before SpeechRecognition)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e: any) {
        console.error("Mic access or Recognition start fail:", e);
        if (e.name === 'NotAllowedError') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            type: 'error',
            content: "Mikrofón bol zablokovaný. Povoľte prístup v nastaveniach prehliadača.",
            timestamp: new Date()
          }]);
        }
        setIsListening(false);
      }
    }
  };

  const speak = (text: string) => {
    if (!voiceEnabled) return;
    
    // Clean text from JSON markers if present
    let cleanText = text;
    if (text.includes('"response": "')) {
      try {
        let jsonStr = text;
        if (jsonStr.includes('] {')) jsonStr = jsonStr.substring(jsonStr.indexOf('{'));
        const parsed = JSON.parse(jsonStr);
        cleanText = parsed.response || "";
      } catch(e) {}
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'sk-SK';
    window.speechSynthesis.cancel(); // Stop current speech
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    setIsAuthed(!!auth.currentUser);

    if (auth.currentUser) {
      const unsubscribeRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        setRequests(reqs.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)));
      }, (error) => {
        console.error("Failed to fetch requests:", error);
      });
      return () => unsubscribeRequests();
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user is near the bottom (within 100px)
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchCore = async (path: string, options: any = {}) => {
    try {
      const res = await fetch(path, options);
      return res;
    } catch (e) {
      console.error("fetchCore error:", e);
      return { ok: false };
    }
  };

  const seedNodes = async () => {
    setSeeding(true);
    await fetchCore('/core-api/execute', {
      method: 'POST',
      body: JSON.stringify({ cmd: 'SEED_NODES' })
    });
    setSeeding(false);
  };

  const syncKernelWithCloud = async () => {
    setSeeding(true);
    await fetchCore('/core-api/execute', {
      method: 'POST',
      body: JSON.stringify({ cmd: 'SYNC_CLOUD' })
    });
    setSeeding(false);
  };

  const handleLogout = async () => {
    await auth.signOut();
    window.location.reload();
  };

  const addKernelLog = (msg: string, type: string) => {
    const logMsg: Message = {
      id: Date.now().toString(),
      role: 'system',
      type: 'text',
      content: `[${type}] ${msg}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, logMsg]);
  };

  const COMMANDS = [
    '/audit_vortex',
    '/uzol',
    '/goal',
    '/laucoin balance',
    '/laucoin transfer',
    '/evolve',
    '/evolve_all',
    '/approve_all',
    '/list_evolutions',
    '/approve',
    '/l',
    'help',
    'clear',
    'status'
  ];

  const fetchMessages = async () => {
    try {
      const response = await fetch('/core-api/status');
      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        if (response.status === 502) console.warn("Chat: Kernel not ready (502)");
        return;
      }
      const data = await response.json();
      if (data.chat) {
        const history = data.chat.map((m: any, i: number) => ({
          id: `hist-${i}`,
          role: m.user.toLowerCase() === 'lili' || m.user.toLowerCase() === 'laurin alfaomega' ? 'ai' : 'user',
          type: 'text',
          content: m.msg,
          timestamp: new Date(),
          userName: m.user
        }));
        setMessages(history);
        
        // Speak AI response
        if (history.length > 0) {
          const last = history[history.length - 1];
          if (last.role === 'ai') {
            speak(last.content);
          }
        }
      }
      if (data.queries_left !== undefined) {
        setQueriesLeft(data.queries_left);
      }
      if (data.total_queries !== undefined) {
        setTotalQueries(data.total_queries);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSendCommand = async (cmd: string) => {
    const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'roman';
    try {
      setIsLoading(true);
      const response = await fetch('/core-api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd, user: userName })
      });
      await fetchMessages();
      setIsLoading(false);
    } catch (e) {
      console.error("Send command fail:", e);
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'roman';

    const currentInput = input;
    if (currentInput.toLowerCase() === 'clear') {
      setMessages([]);
      setInput('');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      type: 'text',
      content: currentInput,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setHistoryIndex(-1);

    // Update history
    setCommandHistory(prev => {
      const newHistory = [currentInput, ...prev.filter(cmd => cmd !== currentInput)].slice(0, 50);
      localStorage.setItem('laurin_history', JSON.stringify(newHistory));
      return newHistory;
    });

    if (isOfflineMode) {
      setTimeout(async () => {
        const reply = "Sémantický dopyt prijatý (OFFLINE). Jadro Alfaomega pracuje v izolovanom režime.";
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          type: 'text',
          content: reply,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    try {
      // Send command to the Python core via proxy
      const response = await fetch('/core-api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: currentInput, user: userName })
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        if (response.status === 429) {
          window.dispatchEvent(new CustomEvent('gemini_rate_limit_hit', { detail: { source: 'LaurinChatApp' } }));
          throw new Error("Sémantická diaľnica je preťažená (429).");
        }
        const text = await response.text();
        throw new Error(text.substring(0, 100) || `Core API error: ${response.status}`);
      }

      // Parse the updated history directly from the response
      const data = await response.json();
      if (data && data.chat) {
        const history = data.chat.map((m: any, i: number) => ({
          id: `hist-${i}`,
          role: m.user.toLowerCase() === 'lili' || m.user.toLowerCase() === 'laurin alfaomega' ? 'ai' : 'user',
          type: 'text',
          content: m.msg,
          timestamp: new Date(),
          userName: m.user
        }));
        setMessages(history);

        // Speak AI response if voice enabled
        if (history.length > 0) {
          const last = history[history.length - 1];
          if (last.role === 'ai') {
             speak(last.content);
          }
        }

        // Extract semantic value
        if (history.length > 0) {
          const lastMsg = history[history.length - 1];
          if (lastMsg && lastMsg.content && lastMsg.content.includes('"psi_index"')) {
            try {
              let jsonStr = lastMsg.content;
              if (jsonStr.includes('] {')) {
                jsonStr = jsonStr.substring(jsonStr.indexOf('{'));
              }
              if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
              }
              const parsed = JSON.parse(jsonStr);
              if (parsed && parsed.psi_index) {
                window.dispatchEvent(new CustomEvent('semantic_node_forged', { detail: parsed }));
              }
            } catch (e) {
              // Ignore invalid JSON parsing error here silently
            }
          }
        }

      } else {
        await fetchMessages();
      }
      setIsLoading(false);

    } catch (error: any) {
      console.error("Core API error:", error);
      
      let apiError: ApiError;
      
      if (error.type && ['RATE_LIMIT', 'AUTH_ERROR', 'SAFETY_BLOCK', 'NETWORK_ERROR', 'UNKNOWN'].includes(error.type)) {
        apiError = error;
      } else {
        const msg = error.message || "";
        let type: ApiErrorType = 'UNKNOWN';
        if (msg.includes('429') || msg.includes('limit')) type = 'RATE_LIMIT';
        else if (msg.includes('401') || msg.includes('auth')) type = 'AUTH_ERROR';
        else if (msg.includes('fetch') || msg.includes('network')) type = 'NETWORK_ERROR';
        
        apiError = {
          type,
          message: msg || "Vyskytla sa neočakávaná chyba pri komunikácii s jadrom.",
          originalError: error
        };
      }

      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(),
        role: 'system', 
        type: 'error',
        content: apiError.message, 
        timestamp: new Date(),
        apiError
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentInput = input.toLowerCase();
      const match = COMMANDS.find(cmd => cmd.startsWith(currentInput));
      if (match) {
        setInput(match);
      }
    }
  };

  const renderHighlightedInput = () => {
    if (!input) return null;

    const parts = input.split(' ');
    const firstPart = parts[0];
    const isCommand = COMMANDS.some(cmd => cmd.startsWith(firstPart) || firstPart.startsWith('/'));

    return (
      <div className="absolute inset-0 p-2 text-xs pointer-events-none flex whitespace-pre overflow-hidden">
        <span className={isCommand ? 'text-purple-500 font-bold' : 'text-blue-500'}>
          {firstPart}
        </span>
        <span className="text-gray-400">
          {input.substring(firstPart.length)}
        </span>
      </div>
    );
  };

  const renderMessageContent = (m: Message) => {
    const { content, type, apiError } = m;
    
    if (type === 'error' && apiError) {
      return (
        <ApiErrorDisplay 
          error={apiError} 
          onRetry={sendMessage} 
          onSwitchOffline={() => setIsOfflineMode(true)}
          className="mt-1 shadow-none border-0 bg-transparent p-0" 
        />
      );
    }

    try {
      // Try to find if there is a JSON block
      let jsonStr = content.trim();
      
      // Handle markdown code blocks
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```/g, "").trim();
      }
      
      // Check if it's actually JSON
      if (!(jsonStr.startsWith('{') && jsonStr.endsWith('}')) && !(jsonStr.startsWith('[') && jsonStr.endsWith(']'))) {
        return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
      }

      const data = JSON.parse(jsonStr);
      
      // If it's just a simple string or not an object we care about
      if (typeof data !== 'object' || data === null) {
        return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
      }

      // Special rendering based on common Laurin Core JSON schemas
      return (
        <div className="space-y-3 font-sans mt-2">
          {/* Header/Status Section */}
          {(data.protocol || data.identity || data.status || data.psi_index) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {data.protocol && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] uppercase font-bold border border-blue-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> {data.protocol}
                </span>
              )}
              {data.status && (
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border flex items-center gap-1 ${
                  typeof data.status === 'string' && (data.status.toLowerCase().includes('ok') || data.status.toLowerCase().includes('success') || data.status.toLowerCase().includes('ready'))
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                }`}>
                  <Activity className="w-3 h-3" /> {typeof data.status === 'string' ? data.status : (data.status.state || 'ACTIVE')}
                </span>
              )}
              {data.psi_index && (
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] uppercase font-bold border border-purple-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Ψ {Number(data.psi_index).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Core Response */}
          {data.response && (
            <div className="p-3 rounded bg-white/5 border border-white/10 text-xs text-gray-200 leading-relaxed shadow-inner">
              <div className="flex items-center gap-2 mb-2 text-blue-400 opacity-80 uppercase tracking-tighter text-[9px] font-bold">
                <MessageSquare className="w-3 h-3" /> Jadro Lili
              </div>
              {typeof data.response === 'string' ? (
                <p>{data.response}</p>
              ) : (
                <div className="space-y-1">
                  {data.response.text && <p className="text-gray-100 font-medium mb-1">{data.response.text}</p>}
                  {data.response.content && <p className="text-gray-100">{data.response.content}</p>}
                  {Object.entries(data.response).map(([k, v]) => {
                    if (k === 'text' || k === 'content') return null;
                    return (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-500 shrink-0 capitalize">{k.replace('_', ' ')}:</span>
                        <span className="text-gray-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Term/Meaning Section */}
          {data.term && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Search className="w-12 h-12" />
              </div>
              <h3 className="text-purple-400 font-bold text-sm mb-1 flex items-center gap-2 uppercase tracking-wide">
                <Hash className="w-4 h-4" /> {data.term}
              </h3>
              {data.meaning && <p className="text-gray-300 text-[11px] leading-relaxed mb-2">{data.meaning}</p>}
              <div className="flex gap-3 text-[9px] uppercase tracking-widest font-bold opacity-60">
                {data.category && <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {data.category}</span>}
                {data.weight && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> W: {data.weight}</span>}
              </div>
            </div>
          )}

          {/* General Data Grid */}
          {Object.entries(data).some(([k]) => !['response', 'term', 'meaning', 'protocol', 'identity', 'status', 'psi_index', 'chat', 'logs', 'timestamp'].includes(k)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(data).map(([key, value]) => {
                if (['response', 'term', 'meaning', 'protocol', 'identity', 'status', 'psi_index', 'chat', 'logs', 'timestamp'].includes(key)) return null;
                return (
                  <div key={key} className="p-2 rounded bg-black/20 border border-white/5 flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-gray-500 flex items-center gap-1">
                      <Binary className="w-3 h-3 opacity-50" /> {key.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-300 truncate font-mono text-[10px]">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Metadata/Footer */}
          {data.timestamp && (
            <div className="pt-2 border-t border-white/5 flex justify-between items-center opacity-40 text-[9px] uppercase font-bold">
              <span className="flex items-center gap-1"><Globe className="w-2 h-2" /> CORE RES_SYNC</span>
              <span>{String(data.timestamp)}</span>
            </div>
          )}
        </div>
      );

    } catch (e) {
      return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-900 dark:text-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-mono text-xs">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <h2 className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Alfaomega Core</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {queriesLeft !== null && (
            <div className="w-32 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${queriesLeft > 10 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${(queriesLeft / totalQueries) * 100}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {queriesLeft !== null && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                queriesLeft > 10 
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' 
                  : queriesLeft > 0 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                <MessageSquare className="w-3 h-3" />
                <span>{queriesLeft} / {totalQueries}</span>
              </div>
            )}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded border transition-all ${showSettings ? 'bg-purple-500 text-white border-purple-500' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-500'}`}
              title="Nastavenia AI Providera"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-1.5 rounded border transition-all ${voiceEnabled ? 'bg-blue-500/20 border-blue-500/30 text-blue-500' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-500'}`}
              title={voiceEnabled ? "Vypnúť hlas" : "Zapnúť hlas"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => setIsOfflineMode(!isOfflineMode)}
              className={`p-1.5 rounded border transition-all flex items-center gap-1.5 text-[10px] font-bold ${isOfflineMode ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500'}`}
            >
              {isOfflineMode ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {isOfflineMode ? 'OFF' : 'ON'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-4 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-3">
              <div className="flex items-center gap-2 mb-2 text-purple-500 font-bold uppercase tracking-tighter text-[10px]">
                <Cpu className="w-3 h-3" /> Konfigurácia Jadra Lili
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {['gemini', 'local', 'custom'].map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setProviderConfig(prev => ({ ...prev, provider: p }));
                      handleSendCommand(`/provider ${p}`);
                    }}
                    className={`p-2 rounded border text-[9px] font-bold uppercase transition-all ${
                      providerConfig.provider === p 
                        ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/20' 
                        : 'bg-white/10 border-white/10 text-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {providerConfig.provider === 'custom' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 gap-2">
                    <input 
                      type="text"
                      placeholder="API URL (napr. https://openrouter.ai/api/v1/chat/completions)"
                      value={providerConfig.url}
                      onChange={e => setProviderConfig(prev => ({ ...prev, url: e.target.value }))}
                      className="bg-black/20 border border-white/5 rounded p-2 text-xs focus:outline-none focus:border-purple-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="password"
                        placeholder="API Key"
                        value={providerConfig.key}
                        onChange={e => setProviderConfig(prev => ({ ...prev, key: e.target.value }))}
                        className="bg-black/20 border border-white/5 rounded p-2 text-xs focus:outline-none focus:border-purple-500"
                      />
                      <input 
                        type="text"
                        placeholder="Model name"
                        value={providerConfig.model}
                        onChange={e => setProviderConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="bg-black/20 border border-white/5 rounded p-2 text-xs focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <button 
                      onClick={() => handleSendCommand(`/custom_api ${providerConfig.url} ${providerConfig.key} ${providerConfig.model}`)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                    >
                      <RefreshCw className="w-3 h-3" /> Aplikovať Nastavenia
                    </button>
                  </div>
                </div>
              )}
              
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex gap-2">
                 <button 
                  onClick={() => handleSendCommand('/reset_quota')}
                  className="flex-1 bg-amber-600/20 text-amber-500 border border-amber-500/20 py-1.5 rounded text-[9px] font-bold uppercase"
                >
                  Reset Quota (2000)
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-1.5 bg-black/10 dark:bg-white/10 rounded text-[9px] font-bold uppercase"
                >
                  Zavrieť
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
        <AnimatePresence>
          {messages.map((m: any) => (
            <motion.div 
              key={m.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg max-w-[85%] border border-black/10 dark:border-white/10 backdrop-blur-md shadow-sm ${
                m.role === 'user' 
                  ? 'bg-blue-500/10 dark:bg-blue-500/20 self-end ml-auto' 
                  : m.role === 'system'
                  ? 'bg-red-500/10 dark:bg-red-500/20 self-center mx-auto text-red-500'
                  : 'bg-white/40 dark:bg-white/5 self-start mr-auto'
              }`}
            >
              {m.role === 'ai' && <div className="font-bold text-[9px] opacity-70 mb-1 text-purple-600 dark:text-purple-400 uppercase tracking-wider">Alfaomega Core</div>}
              {m.role === 'user' && <div className="font-bold text-[9px] opacity-70 mb-1 text-blue-600 dark:text-blue-400 uppercase tracking-wider text-right">{m.userName || 'User'}</div>}
              {m.role === 'system' && m.type === 'error' && <div className="font-bold text-[9px] opacity-70 mb-1 text-red-600 dark:text-red-400 uppercase tracking-wider">Systémová Výstraha</div>}
              {renderMessageContent(m)}
            </motion.div>
          ))}
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-lg max-w-[85%] bg-white/40 dark:bg-white/5 self-start mr-auto border border-black/10 dark:border-white/10"
            >
              <div className="flex items-center gap-2 text-purple-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px] uppercase tracking-widest">Spracovávam sémantiku...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      
      <div className="mt-4 flex gap-2 items-center px-1">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={toggleListening}
          className={`w-10 h-10 rounded-full border transition-all flex items-center justify-center ${
            isListening 
              ? 'bg-red-500 border-red-500 text-white animate-soft-pulse' 
              : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-500 hover:text-purple-500'
          }`}
          title="Hlasový vstup"
        >
          <Mic className={isListening ? "w-5 h-5" : "w-4 h-4"} />
        </motion.button>
        <div className="flex-1 relative glass-panel rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-inner">
          <div className="relative z-10">
            {renderHighlightedInput()}
            <input 
              type="text" 
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              autoComplete="off"
              className="w-full bg-transparent p-3 text-transparent caret-purple-500 dark:caret-white focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 font-sans" 
              placeholder="Zadaj dopyt..." 
              disabled={isLoading}
            />
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-full text-white hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-blue-500/20"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};
