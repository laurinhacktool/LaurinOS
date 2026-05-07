import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, Shield, Search, Code, Terminal, Zap, Loader2, Copy, Check, Terminal as TerminalIcon, FileCode, Upload, FileArchive, ChevronRight, X } from 'lucide-react';
import JSZip from 'jszip';

export const PredatorApp: React.FC = () => {
  const [inputCode, setInputCode] = useState('');
  const [fileName, setFileName] = useState('AndroidManifest.xml');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  
  // APK Upload States
  const [isExtracting, setIsExtracting] = useState(false);
  const [apkFiles, setApkFiles] = useState<{ path: string; file: any }[]>([]);
  const [showApkBrowser, setShowApkBrowser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setApkFiles([]);

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const files: { path: string; file: any }[] = [];
      
      contents.forEach((relativePath, file) => {
        files.push({ path: relativePath, file });
      });

      setApkFiles(files);
      setShowApkBrowser(true);

      // Auto-find AndroidManifest.xml
      const manifest = files.find(f => f.path.toLowerCase().includes('androidmanifest.xml'));
      if (manifest) {
        extractFile(manifest.path, manifest.file);
      }
    } catch (err) {
      console.error("APK Extract Error:", err);
      alert("Nepodarilo sa načítať APK ako archív.");
    } finally {
      setIsExtracting(false);
    }
  };

  const extractFile = async (path: string, zipFile: any) => {
    try {
      const content = await zipFile.async("string");
      setInputCode(content);
      setFileName(path);
      // If it's binary XML (common in APKs), it might look messy, 
      // but we send it to Gemini who can usually make sense of it or recognize the patterns.
    } catch (err) {
      console.error("File Extract Error:", err);
    }
  };

  const analyzeEndpoint = async () => {
    if (!inputCode.trim()) return;
    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('/core-api/predator/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_data: inputCode,
          filename: fileName
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const err = await response.text();
        setResult({ error: `Chyba pri analýze: ${err}` });
      }
    } catch (error) {
      setResult({ error: `Chyba spojenia: ${error}` });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.2)]">
              <Radar className="w-6 h-6 text-orange-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Endpoint Predator</h1>
              <p className="text-xs text-orange-400 font-mono opacity-60">PREDATOR.BRAIN v16.26.1 | Eviscerator Mode</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 uppercase tracking-widest text-[9px] font-bold opacity-60">
              <Shield className="w-3 h-3" />
              Reverse Engineering Enabled
            </div>
            <p className="text-[8px] text-gray-500 italic">"Roman, sedím tu ako pavúk v strede siete..." - Lili</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Upload & Source Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* APK Upload Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="lg:col-span-1 p-8 border-2 border-dashed border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-orange-500/30 rounded-3xl transition-all cursor-pointer group flex flex-col items-center justify-center text-center gap-4"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".apk,.zip" 
              className="hidden" 
            />
            <div className="p-4 bg-orange-500/10 rounded-full group-hover:scale-110 transition-transform">
              {isExtracting ? (
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-orange-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-200">Vložiť APK / ZIP</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">Analyzuj sémantické vnútro</p>
            </div>
          </div>

          {/* Code Textarea Area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <FileCode className="w-3 h-3" />
                Zdrojový segment
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono opacity-40">Objekt:</span>
                <input 
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="bg-transparent border-b border-white/10 text-[10px] font-mono focus:border-orange-500/50 outline-none w-48 text-orange-300"
                  placeholder="AndroidManifest.xml"
                />
              </div>
            </div>
            
            <div className="relative group">
              <textarea 
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Vložte surový kód alebo nahrajte APK..."
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-mono text-gray-300 focus:border-orange-500/50 outline-none transition-all resize-none shadow-inner"
              />
              {inputCode && (
                 <button 
                   onClick={() => { setInputCode(''); setApkFiles([]); setShowApkBrowser(false); }}
                   className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-md text-gray-500 transition-colors"
                 >
                   <X className="w-3.5 h-3.5" />
                 </button>
               )}
            </div>
          </div>
        </div>

        {/* APK Internal Browser */}
        <AnimatePresence>
          {showApkBrowser && apkFiles.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden"
            >
              <div className="p-4 bg-white/5 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-orange-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eviscerovaný obsah APK ({apkFiles.length} objektov)</span>
                </div>
                <button onClick={() => setShowApkBrowser(false)} className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase font-bold tracking-widest">Skryť</button>
              </div>
              <div className="max-h-60 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 custom-scrollbar">
                {apkFiles.slice(0, 100).map((f, idx) => (
                  <button 
                    key={idx}
                    onClick={() => extractFile(f.path, f.file)}
                    className={`flex items-center gap-3 p-2 rounded-xl text-left transition-all border ${fileName === f.path ? 'bg-orange-500/10 border-orange-500/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${fileName === f.path ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-500'}`}>
                      <FileCode className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-mono truncate ${fileName === f.path ? 'text-orange-300' : 'text-gray-400'}`}>{f.path.split('/').pop()}</p>
                      <p className="text-[8px] text-gray-600 truncate">{f.path}</p>
                    </div>
                    {fileName === f.path && <ChevronRight className="w-3 h-3 text-orange-400" />}
                  </button>
                ))}
                {apkFiles.length > 100 && <div className="p-2 text-[9px] text-gray-600 italic">... a ďalších {apkFiles.length - 100} súborov</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={analyzeEndpoint}
          disabled={isAnalyzing || !inputCode.trim()}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl font-bold text-sm tracking-widest uppercase shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Anihilujem extrakt...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current" />
              Anihilovať dáta
            </>
          )}
        </button>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {result.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-mono">
                   [ERROR]: {result.error}
                </div>
              ) : (
                <>
                  {/* [LOG] */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Terminal className="w-4 h-4 text-orange-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">[LOG]</span>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-gray-300 leading-relaxed italic">
                      {result.log || 'Žiadny log nie je k dispozícii.'}
                    </div>
                  </div>

                  {/* [EXTRACTED_APIS] */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Search className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">[EXTRACTED_APIS]</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {result.apis && result.apis.length > 0 ? result.apis.map((api: string, idx: number) => (
                        <div key={idx} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] font-mono text-blue-300 flex items-center justify-between group">
                          <code className="truncate mr-4">{api}</code>
                          <button onClick={() => copyToClipboard(api)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )) : (
                        <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-gray-500 italic">
                          Neboli nájdené žiadne koncové body.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* [SECURITY_KEYS] */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">[SECURITY_KEYS]</span>
                    </div>
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                      {result.keys && Object.keys(result.keys).length > 0 ? Object.entries(result.keys).map(([name, val]: [string, any], idx: number) => (
                        <div key={idx} className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <Code className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{name}</p>
                              <code className="text-xs text-emerald-300 font-mono">{String(val)}</code>
                            </div>
                          </div>
                      </div>
                      )) : (
                        <div className="p-4 text-[10px] text-gray-500 italic">
                          Neboli nájdené žiadne bezpečnostné kľúče.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* [KERNEL_CODE] */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">[KERNEL_CODE]</span>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(result.kernel_code || '')}
                        className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded-md text-[9px] font-bold text-purple-400 hover:bg-purple-500/30 transition-all"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'SKOPÍROVANÉ' : 'SKOPÍROVAŤ KÓD'}
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/5 blur-xl rounded-full" />
                      <pre className="relative p-5 bg-[#050505] border border-purple-500/20 rounded-2xl text-[10px] font-mono text-purple-300/90 leading-relaxed overflow-x-auto shadow-2xl">
                        <code>{result.kernel_code || '# Žiadna integrácia nie je k dispozícii.'}</code>
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Status */}
      <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between px-6 mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-gray-500 tracking-wider">UPSTREAM: AI STUDIO PREDATOR CLUSTER</span>
        </div>
        <span className="text-[9px] font-mono text-gray-600">v16.JADRO.EVISCERATOR</span>
      </div>
    </div>
  );
};
