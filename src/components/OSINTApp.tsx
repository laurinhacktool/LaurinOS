import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Shield, User, Globe, Mail, Phone, Lock, Terminal, AlertTriangle, Database, Activity, Cpu, Binary, Zap, Eye, EyeOff, Hash, Save, Trash2, Plus, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateContentWithRetry } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface OSINTReport {
  id: string;
  target: string;
  type: 'email' | 'phone' | 'alias';
  content: string;
  timestamp: Date;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export const OSINTApp: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<OSINTReport[]>(() => {
    const saved = localStorage.getItem('laurinos_osint_reports');
    return saved ? JSON.parse(saved).map((r: any) => ({ ...r, timestamp: new Date(r.timestamp) })) : [];
  });
  const [activeReport, setActiveReport] = useState<OSINTReport | null>(null);
  const [isMasked, setIsMasked] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('laurinos_osint_reports', JSON.stringify(reports));
  }, [reports]);

  const detectType = (val: string): 'email' | 'phone' | 'alias' => {
    if (val.includes('@')) return 'email';
    if (/^\+?[0-9\s-]{8,}$/.test(val)) return 'phone';
    return 'alias';
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    const targetType = detectType(query);
    
    try {
      const prompt = `Act as a professional OSINT (Open Source Intelligence) cyber-security tool called "Lau Tracker". 
      Your task is to analyze the following target: "${query}" (Type: ${targetType}).
      
      Generate a realistic-sounding intelligence dossier. 
      Include:
      1. Target Identity (Alias mapping, likely real name placeholders)
      2. Connected Accounts (Social media, specialized forums, leaked databases)
      3. Digital Footprint (Geographic clusters, active timezones)
      4. Data Breaches (List 2-3 realistic-sounding data breaches like "Canva 2019", "Exploit.in", "LauLeak v2")
      5. Risk Assessment (Low, Medium, High, or Critical) with reasoning.
      
      IMPORTANT: This is for a themed simulation environment. Do NOT use real personal private data if you happen to know it. Make it professional, technical, and "hacker" style.
      
      Format your response in Markdown with clear sections.`;

      const response = await generateContentWithRetry({
        model: "gemini-2.0-flash", // Use a fast model
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      // @ts-ignore - Handle potential difference between text() method and text property
      const content = typeof response.text === 'function' ? response.text() : response.text;
      // Heuristic risk detection
      let risk: OSINTReport['risk'] = 'low';
      if (content.toLowerCase().includes('critical')) risk = 'critical';
      else if (content.toLowerCase().includes('high')) risk = 'high';
      else if (content.toLowerCase().includes('medium')) risk = 'medium';

      const newReport: OSINTReport = {
        id: Date.now().toString(),
        target: query,
        type: targetType,
        content,
        timestamp: new Date(),
        risk
      };

      setReports(prev => [newReport, ...prev]);
      setActiveReport(newReport);
      setQuery('');
    } catch (error) {
      console.error("OSINT search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    if (activeReport?.id === id) setActiveReport(null);
  };

  const getRiskColor = (risk: OSINTReport['risk']) => {
    switch (risk) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500 animate-pulse';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="flex h-full bg-[#0a0a0a] text-slate-300 font-mono text-sm overflow-hidden select-none">
      {/* Sidebar: History */}
      <div className="w-64 border-r border-white/5 flex flex-col bg-[#050505] shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-red-500" />
            <span className="font-bold tracking-tighter text-red-500">DOSSIER_DB</span>
          </div>
          <button 
            onClick={() => setReports([])}
            className="p-1 hover:bg-white/5 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-gray-600 italic text-[10px]">
              No active traces found.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {reports.map(report => (
                <div
                  key={report.id}
                  onClick={() => setActiveReport(report)}
                  className={`w-full text-left p-2 rounded transition-all group relative overflow-hidden cursor-pointer ${activeReport?.id === report.id ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                  aria-selected={activeReport?.id === report.id}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveReport(report); }}
                >
                  <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <span className={`truncate font-bold ${activeReport?.id === report.id ? 'text-red-400' : 'text-slate-400'}`}>
                      {report.target}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 focus:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] opacity-60">
                    <span className="uppercase">{report.type}</span>
                    <span className={getRiskColor(report.risk)}>{report.risk.toUpperCase()}</span>
                  </div>
                  {activeReport?.id === report.id && (
                    <motion.div 
                      layoutId="active-indicator" 
                      className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" 
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* System Stats Footer */}
        <div className="p-3 bg-[#0d0d0d] border-t border-white/5 space-y-2">
          <div className="flex justify-between items-center text-[9px] text-gray-500">
            <span>NODES: 4,092</span>
            <span>UPTIME: 99.9%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: ['20%', '60%', '40%', '80%', '30%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="h-full bg-red-500/30"
            />
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header / Search */}
        <div className="h-16 border-b border-white/5 bg-[#080808] flex items-center px-6 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h1 className="font-black text-red-500 tracking-tighter uppercase leading-none">Lau Tracker</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Global Intelligence Grid</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex-1 relative max-w-xl ml-4">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ENTER ALIAS, EMAIL OR PHONE NUMBER..."
              className="w-full bg-[#111] border border-white/10 rounded-md py-2 px-10 text-xs focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all outline-none text-red-400 placeholder:text-gray-700 font-bold"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            {isLoading ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />
            ) : (
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-red-400 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMasked(!isMasked)}
              className={`flex items-center gap-2 p-2 rounded border transition-all text-[10px] font-bold ${isMasked ? 'border-amber-500/30 text-amber-500 bg-amber-500/10' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'}`}
              title={isMasked ? "Unmask PII" : "Mask PII"}
            >
              {isMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isMasked ? 'MASKED' : 'UNMASKED'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/5" ref={scrollRef}>
          <AnimatePresence mode="wait">
            {!activeReport ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center opacity-20 pointer-events-none grayscale"
              >
                <div className="relative mb-6">
                  <Globe className="w-24 h-24 text-red-500 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-red-500" />
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-black text-lg tracking-tighter">WAITING FOR TARGET INPUT</div>
                  <div className="flex items-center gap-4 justify-center">
                    <span>IP_LOOKUP: REAY</span>
                    <span>BREACH_MODULE: ONLINE</span>
                    <span>SOCIAL_GRAPH: SYNCED</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeReport.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                {/* Dossier Header Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="col-span-2 bg-[#111] border border-white/5 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                      <User className="w-24 h-24 text-red-500" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="bg-red-500 text-black text-[10px] font-black px-2 py-0.5 rounded">DOSSIER</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeReport.id}</span>
                      </div>
                      <h2 className="text-3xl font-black text-white tracking-tighter mb-2 overflow-hidden text-ellipsis">
                        {isMasked ? activeReport.target.replace(/./g, (c, i) => i > 2 && i < activeReport.target.length - 3 ? '*' : c) : activeReport.target}
                      </h2>
                      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase">
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3" />
                          <span>{activeReport.type}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3 h-3" />
                          <span className={getRiskColor(activeReport.risk)}>RISK: {activeReport.risk}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3 h-3 transition-colors group-hover:text-red-500" />
                          <span>Verified Status: Positive</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Integrity</span>
                        <span className="text-emerald-500 font-black">94.8%</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Exposure</span>
                        <span className={getRiskColor(activeReport.risk)}>Critical</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4">
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-gray-400">
                        <Binary className="w-3 h-3" />
                        <span>ENTROPY_SIGNATURE</span>
                      </div>
                      <div className="grid grid-cols-8 gap-1">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div key={i} className={`h-1.5 rounded-full ${Math.random() > 0.5 ? 'bg-red-500/40' : 'bg-white/5'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Content */}
                <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 bg-[#161616] border-b border-white/5 flex items-center gap-3">
                    <Terminal className="w-4 h-4 text-red-500" />
                    <span className="font-bold text-xs uppercase tracking-widest">Analysis Results</span>
                  </div>
                  <div className="p-6 prose prose-invert prose-red max-w-none prose-sm font-sans">
                    <ReactMarkdown 
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-lg font-black text-red-500 border-b border-red-500/20 pb-1 mb-4 uppercase tracking-tighter" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-bold text-red-400/80 mb-3 mt-6 uppercase" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-bold text-white mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="text-slate-400 leading-relaxed mb-4 font-mono text-[13px]" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-4 text-slate-400 font-mono text-[13px]" {...props} />,
                        li: ({node, ...props}) => <li className="marker:text-red-500" {...props} />,
                        code: ({node, ...props}) => <code className="bg-red-500/10 text-red-400 px-1 rounded font-mono" {...props} />
                      }}
                    >
                      {activeReport.content}
                    </ReactMarkdown>
                  </div>
                  <div className="px-6 py-3 bg-[#0d0d0d] border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500">
                    <span>Generated by Alphaomega Core Engine</span>
                    <span>{activeReport.timestamp.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="text-center space-y-4">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-t-2 border-r-2 border-red-500"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-8 h-8 rounded bg-red-500 animate-pulse flex items-center justify-center"
                    >
                      <Binary className="w-5 h-5 text-black" />
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-black text-red-500 tracking-widest text-xs uppercase animate-pulse">Scanning Global Nodes...</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2 justify-center">
                    <span className="w-12 h-0.5 bg-white/5 rounded-full overflow-hidden relative">
                      <motion.div animate={{ x: [-50, 50] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 bg-red-500" />
                    </span>
                    <span>Accessing Leaked DB v2.04</span>
                    <span className="w-12 h-0.5 bg-white/5 rounded-full overflow-hidden relative">
                       <motion.div animate={{ x: [50, -50] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 bg-red-500" />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
