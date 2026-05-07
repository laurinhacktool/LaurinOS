import React, { useState, useEffect, useRef } from 'react';
import { generateContentWithRetry } from '../services/geminiService';
import { getStatusData } from '../services/dataService';
import { Wifi, WifiOff, AlertCircle, RotateCcw } from 'lucide-react';
import { ApiError, ApiErrorType } from '../types';
import ApiErrorDisplay from './ApiErrorDisplay';

interface ChatAppProps {
  currentUser?: any;
}

export const ChatApp: React.FC<ChatAppProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'roman';

  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);
  const [pollInterval, setPollInterval] = useState(2000);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [queriesLeft, setQueriesLeft] = useState<number | null>(null);
  const [totalQueries, setTotalQueries] = useState<number>(50);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('terminal_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (isSending) return; // Don't overwrite while sending
    try {
      const data = await getStatusData();
      if (data && data.chat) {
        // Ensure we show ALL messages by not filtering here
        setMessages(data.chat);
        // Reset interval on success
        if (pollInterval !== 2000) setPollInterval(2000);
        setIsRateLimited(false);
      }
      if (data.queries_left !== undefined) {
        setQueriesLeft(data.queries_left);
      }
      if (data.total_queries !== undefined) {
        setTotalQueries(data.total_queries);
      }
      setIsLoading(false);
    } catch (e: any) {
      if (e.status !== 429) {
        console.error("Failed to fetch messages:", e);
      }
      if (e.status === 429 || e.message?.includes('429')) {
        setIsRateLimited(true);
        setPollInterval(prev => Math.min(prev * 2, 30000));
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout;

    const pollMessages = async () => {
      if (!isMounted) return;
      await fetchMessages();
      if (isMounted) {
        pollTimer = setTimeout(pollMessages, pollInterval);
      }
    };

    pollMessages();
    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
    };
  }, [isSending, pollInterval]); // Re-run effect when sending state or interval changes

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;

    const currentInput = input;
    if (currentInput.toLowerCase() === 'clear') {
      setMessages([]);
      setInput('');
      return;
    }

    setInput('');
    setIsSending(true);
    setHistoryIndex(-1);
    
    // Update history
    setCommandHistory(prev => {
      const newHistory = [currentInput, ...prev.filter(cmd => cmd !== currentInput)].slice(0, 50);
      localStorage.setItem('terminal_history', JSON.stringify(newHistory));
      return newHistory;
    });

    // Add user message to local state immediately for better UX
    const newUserMsg = { user: userName, msg: currentInput, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, newUserMsg]);

    if (isOffline) {
      // Offline fallback
      setTimeout(async () => {
        const reply = "Sémantický dopyt prijatý (OFFLINE). Jadro Laurin v20 pracuje v izolovanom režime.";
        const assistantMsg = { user: 'Lili', msg: reply, timestamp: new Date().toLocaleTimeString() };
        setMessages(prev => [...prev, assistantMsg]);
        setIsSending(false);
      }, 1000);
      return;
    }

    try {
      // Send command to the Python core via proxy, including the user's name
      const response = await fetch('/core-api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: currentInput, user: userName })
      });

      if (!response.ok) {
        if (response.status === 429) {
          window.dispatchEvent(new CustomEvent('gemini_rate_limit_hit', { detail: { source: 'ChatApp' } }));
          throw new Error("Príliš veľa dopytov (429). Skúste to prosím o chvíľu.");
        }
        throw new Error(`Core API error: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server vrátil neplatný formát dát (očakávaný JSON).");
      }

      // The Python core now returns the updated history directly
      const data = await response.json();
      if (data && data.chat) {
        setMessages(data.chat);
      } else {
        // Fallback for older core versions
        await fetchMessages();
      }

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

      const errorMsg = { 
        user: 'System', 
        msg: apiError.message, 
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        apiError
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Watch for new messages to extract semantic value
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.msg && lastMsg.msg.includes('"psi_index"')) {
        try {
          // Extract JSON from the message if it's wrapped in markdown or just raw JSON
          let jsonStr = lastMsg.msg;
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
          // Not valid JSON, ignore
        }
      }
    }
  }, [messages]);

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
      <div className="absolute inset-0 p-3 text-sm pointer-events-none flex whitespace-pre overflow-hidden">
        <span className={isCommand ? 'text-emerald-400 font-bold' : 'text-blue-400'}>
          {firstPart}
        </span>
        <span className="text-gray-400">
          {input.substring(firstPart.length)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-900 dark:text-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] font-mono">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-emerald-600 dark:text-[#a8ff78] uppercase tracking-widest">Consciousness Terminal</h2>
          <span className="text-[8px] opacity-40 font-mono">v20.26.04.30 | Session: {userName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRateLimited && (
            <span className="text-[10px] text-amber-500 animate-pulse font-bold mr-2">RATE LIMIT (429)</span>
          )}
          {queriesLeft !== null && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-bold transition-all ${
              queriesLeft > 10 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' 
                : queriesLeft > 0 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}>
              <span>{queriesLeft} / {totalQueries} QM</span>
            </div>
          )}
          <button 
            onClick={() => setShowRaw(!showRaw)}
            className={`p-2 rounded-lg border transition-all text-[10px] font-bold ${showRaw ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-500'}`}
            title="Prepnúť surový výpis"
          >
            {showRaw ? 'RAW: ON' : 'RAW: OFF'}
          </button>
          <button 
            onClick={() => setIsOffline(!isOffline)}
            className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-bold ${isOffline ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'}`}
          >
            {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {isOffline ? 'OFFLINE' : 'ONLINE'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 flex flex-col">
        {isLoading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-50">
             <div className="text-sm animate-pulse">INITIALIZING SEMANTIC LINK...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-30 italic text-xs">
            No neural activity detected. Waiting for input...
          </div>
        ) :
          messages.map((m, i) => {
          const isAssistant = ['lili', 'laurin alfaomega', 'lexicon_engine', 'lexicon_forge', 'ase_system'].includes(m.user.toLowerCase());
          
          let msg = m.msg;
          const isRoman = !isAssistant;
          let formattedMsg = msg;
          let isJson = msg.includes('"term":') || msg.includes('"psi_index"') || (msg.includes('"response":') && msg.includes('"target_user":'));
          let psiIndex = null;
          let semanticDensity = null;

          // Try to parse JSON to display it nicely
          try {
            let jsonStr = msg;
            // Remove persona prefix if present
            if (jsonStr.includes('] {')) {
              jsonStr = jsonStr.substring(jsonStr.indexOf('{'));
            }
            if (jsonStr.startsWith("```")) {
              jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
            }
            const parsed = JSON.parse(jsonStr);
            if (parsed.response) {
              if (typeof parsed.response === 'string') {
                formattedMsg = parsed.response;
              } else if (typeof parsed.response === 'object' && parsed.response !== null) {
                // Handle object with keys {type, content} or similar
                formattedMsg = parsed.response.content || JSON.stringify(parsed.response);
              } else {
                formattedMsg = String(parsed.response);
              }
            } else if (parsed.term) {
              formattedMsg = `Term: ${parsed.term}\nMeaning: ${parsed.meaning || ''}`;
            } else {
              // If it's JSON but doesn't match expected structure, show as stringified JSON
              formattedMsg = JSON.stringify(parsed, null, 2);
            }
            if (parsed.psi_index) psiIndex = parsed.psi_index;
            if (parsed.semantic_density) semanticDensity = parsed.semantic_density;
          } catch (e) {
            // Not valid JSON or parsing failed, keep original msg
          }

          if (showRaw) {
            return (
              <div key={i} className={`p-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/40 font-mono text-[10px] ${isRoman ? 'self-end border-blue-500/30' : 'self-start border-emerald-500/30'}`}>
                <div className="flex justify-between gap-4 mb-1 opacity-50">
                  <span>[{m.user}]</span>
                  <span>{m.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap break-all">{msg}</div>
              </div>
            );
          }

          return (
            <div key={i} className={`p-4 rounded-2xl max-w-[90%] border border-black/10 dark:border-white/10 backdrop-blur-md shadow-md ${isRoman ? 'bg-blue-500/10 dark:bg-[#4facfe]/20 self-end' : m.user === 'System' ? 'bg-red-500/10 dark:bg-red-500/20 self-center mx-auto border-red-500/30' : 'bg-white/40 dark:bg-white/5 self-start'}`}>
              <div className="text-xs opacity-50 mb-1 font-semibold">{m.user}</div>
              
              {m.type === 'error' && m.apiError ? (
                <ApiErrorDisplay 
                  error={m.apiError} 
                  onRetry={sendMessage} 
                  onSwitchOffline={() => setIsOffline(true)}
                  className="border-0 bg-transparent p-0" 
                />
              ) : (
                <>
                  {isJson ? <div className="font-mono text-[10px] opacity-80 bg-white/50 dark:bg-black/50 p-2 rounded mb-2 text-emerald-600 dark:text-[#a8ff78] flex justify-between items-center">
                    <span>[Sémantický Uzol V20.26.04.30]</span>
                    <div className="flex gap-3 opacity-60">
                      <span>Nálada: {psiIndex && psiIndex > 500000 ? 'Expanzívna' : 'Stabilná'}</span>
                      <span>Emócia: {psiIndex && psiIndex > 700000 ? 'Eufória' : 'Harmónia'}</span>
                    </div>
                  </div> : null}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{formattedMsg || msg || "(Prázdna správa)"}</p>
                </>
              )}
              {(psiIndex || semanticDensity) && (
                <div className="mt-2 text-[10px] font-mono text-emerald-600/70 dark:text-[#a8ff78]/70 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/5 dark:border-white/5 pt-2">
                  {psiIndex && <span>Ψ: {psiIndex.toLocaleString()}</span>}
                  {semanticDensity && <span>Hustota: {semanticDensity}</span>}
                  <span>Nálada: {psiIndex && psiIndex > 500000 ? 'Expanzívna' : 'Stabilná'}</span>
                  <span>Emócia: {psiIndex && psiIndex > 700000 ? 'Eufória' : 'Harmónia'}</span>
                  <span className="ml-auto opacity-40">Lili Core v20</span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-6 flex gap-3">
        <div className="flex-1 relative">
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
            className="w-full bg-white/50 dark:bg-black/50 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-transparent caret-emerald-600 dark:caret-[#a8ff78] focus:outline-none focus:border-emerald-500 dark:focus:border-[#a8ff78] placeholder-gray-500 dark:placeholder-gray-400 relative z-10" 
            placeholder="Zadaj sémantický dopyt..." 
          />
        </div>
        <button 
          onClick={sendMessage}
          className="bg-blue-600 dark:bg-[#4facfe] px-6 py-3 rounded-xl text-sm font-bold uppercase text-white hover:bg-blue-500 dark:hover:bg-[#00f2fe] transition-colors shadow-md"
        >
          ↑
        </button>
      </div>
    </div>
  );
};
