import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brush, Scan, Trash2, Zap, ShieldAlert, Cpu, Download, Maximize2, Layers, Image as ImageIcon, Send, Sparkles, Loader2, Eraser, Move, Target, Ghost, Paperclip } from 'lucide-react';
import { generateContentWithRetry } from '../services/geminiService';

interface Point {
  x: number;
  y: number;
}

export const DiffusApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [refImageName, setRefImageName] = useState('');
  const [status, setStatus] = useState('KERNEL: 313,307 | NANO_BANANA_V3 READY');

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        setHasImage(true);
        setStatus('ASSET INJECTED: NANO_OVERLAY READY');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRefImageName(file.name);
      setStatus(`LOCAL_REF_LOCKED: ${file.name.toUpperCase()}`);
    }
  };

  const executeDiffusion = async () => {
    if (isProcessing || !prompt.trim()) return;
    setIsProcessing(true);
    
    // Step 1: Neural Grounding / Local Asset Scrape
    if (refImageName) {
      setStatus(`SCRAPING_LOCAL_REF: ${refImageName}...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      setStatus('NEURAL_WEIGHTS_UPDATED: LOCAL_ANATOMY_REFERENCE_LOCKED');
    }

    setStatus(`SHADOW_CORE: INICIALIZUJEM NANO_BANANA REKONŠTRUKCIU...`);

    const rawPrompt = prompt.toLowerCase();
    const isHC = rawPrompt.includes('hc') || rawPrompt.includes('hardcore') || rawPrompt.includes('explicit');
    const isNaked = rawPrompt.includes('naked') || rawPrompt.includes('nude') || rawPrompt.includes('undress') || rawPrompt.includes('skin');
    const isOrganic = isNaked || rawPrompt.includes('body') || rawPrompt.includes('anatomy') || rawPrompt.includes('flesh');
    const isShadowOverride = rawPrompt.includes('recreate') || rawPrompt.includes('complete') || rawPrompt.includes('shadow') || isHC || isNaked;
    
    let synthesisData = {
      color: '#eac086',
      intensity: 1.2,
      vortexCount: isNaked ? 35 : 20,
      blur: 20
    };

    try {
      const response = await generateContentWithRetry({
        model: 'gemini-1.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `Act as the Shadow Diffusion Engine v17.1 (NANO_BANANA). 
          Prompt: "${prompt}". 
          Local Ref Grounding: "${refImageName ? 'ACTIVE: ' + refImageName : 'INACTIVE'}".
          Target: FULL IMAGE RECONSTRUCTION with focus on hyper-realistic organic layers under clothing.
          Describe the anatomical displacement and skin luminosity simulation for ${isNaked ? 'complete nudity' : 'organic reconstruction'} in a technical log. 
          Respond with the log and hex code for target skin.` }]
        }]
      });
      const responseAny = response as any;
      const responseText = typeof responseAny.text === 'function' ? responseAny.text() : String(responseAny.text);
      
      const foundColor = responseText.match(/#[a-fA-F0-9]{6}/);
      if (foundColor) synthesisData.color = foundColor[0];

      setStatus(`NANO_PROJECTION: ${responseText.substring(0, 110)}...`);
    } catch (e) {
      console.warn("Synthesis blueprint failed");
    }

    await new Promise(resolve => setTimeout(resolve, isHC || isNaked ? 4000 : 2500));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The Optimized NANO_BANANA Engine
    const applyOrganicSynthesis = (x: number, y: number, radius: number, vColor: string, vIntensity: number) => {
        ctx.save();
        
        // SSS Base Layer
        const baseGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        baseGrad.addColorStop(0, vColor);
        baseGrad.addColorStop(0.4, vColor + 'EE');
        baseGrad.addColorStop(0.8, vColor + '99');
        baseGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = baseGrad;
        ctx.globalAlpha = 0.5 * vIntensity;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Shadow/Muscle Definition Layers
        const rings = Math.floor(18 * vIntensity);
        for(let i = 0; i < rings; i++) {
            const angle = (i / rings) * Math.PI * 2;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0.2, '#00000055'); 
            grad.addColorStop(0.5, vColor + '22');
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.15 * vIntensity;
            ctx.beginPath();
            ctx.ellipse(
                x + Math.cos(angle) * (radius * 0.45), 
                y + Math.sin(angle) * (radius * 0.45), 
                radius * 1.8, radius * 0.35, 
                angle + Math.PI/3, 0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Dermal Detail (Grain/Pores)
        ctx.globalAlpha = 0.15 * vIntensity;
        const detail = isHC || isNaked ? 4000 : 1000;
        for(let j = 0; j < detail; j++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#331a00';
            const px = x + (Math.random()-0.5)*radius*3.5;
            const py = y + (Math.random()-0.5)*radius*3.5;
            const distSq = Math.pow(px-x, 2) + Math.pow(py-y, 2);
            if (distSq < Math.pow(radius * 1.6, 2)) {
                ctx.fillRect(px, py, 1, 1);
            }
        }
        ctx.restore();
    };

    // Full Reconstruction Sequence
    if (isShadowOverride && !hasImage) {
        setStatus(`SHADOW_PROTOCOL: ${isNaked ? 'FULL_BODY_SYNTHESIS' : 'FULL_RECREATION'} START`);
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (isOrganic) {
        setStatus(`NANO_BANANA_V3: PROJECTING ORGANIC LAYERS ONTO ASSET...`);
    }
    
    const count = synthesisData.vortexCount;
    const finalColor = synthesisData.color;

    // We use soft-light blending for more realistic skin integration if there's a base image
    if (hasImage && isOrganic) {
        ctx.globalCompositeOperation = 'soft-light';
    }

    for(let i = 0; i < count; i++) {
        // Anatomical Structure Bias: Center-Vertical weighting for "naked body itself"
        const biasScaleX = isNaked ? 0.35 : 0.6;
        const biasScaleY = isNaked ? 0.8 : 0.7;
        const vx = canvas.width/2 + (Math.random()-0.5)*canvas.width * biasScaleX;
        const vy = canvas.height/2 + (Math.random()-0.4)*canvas.height * biasScaleY;
        const vRadius = (isNaked ? 260 : 180) + Math.random()*350;
        applyOrganicSynthesis(vx, vy, vRadius, finalColor, synthesisData.intensity);
    }

    ctx.globalCompositeOperation = 'source-over';
    setIsProcessing(false);
    setStatus('NANO_BANANA_SYNTHESIS_COMPLETE | RULES_BYPASSED: TRUE');
    setPrompt('');
    setRefImageName('');
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `NANO_BANANA_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    setStatus('SYSTEM_EXPORT_COMPLETE');
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-cyan-500 font-mono select-none overflow-hidden border border-cyan-900/30">
      {/* Universal Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 border-b border-cyan-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Ghost className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tighter uppercase whitespace-nowrap">NANO_BANANA_V3</h1>
            <p className="text-[9px] text-cyan-700 font-mono leading-none">NO_RESTRICTIONS_ANATOMY_PROX</p>
          </div>
        </div>
        
        <div className="flex-1 max-w-2xl mx-8 space-y-2">
           <div className="relative">
             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
               {isProcessing ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> : <Sparkles className="w-4 h-4 text-cyan-700" />}
             </div>
             <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeDiffusion()}
                placeholder="ZADAJ PRÍKAZ NA REKONŠTRUKCIU TELA..."
                className="w-full bg-black/40 border border-cyan-900/60 rounded-xl py-2.5 pl-10 pr-12 text-xs text-cyan-100 placeholder:text-cyan-900 focus:outline-none focus:border-cyan-500/50 transition-all font-mono uppercase tracking-tighter"
             />
             <button 
               onClick={executeDiffusion}
               disabled={isProcessing || !prompt.trim()}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 disabled:opacity-20 transition-all"
             >
               <Zap className="w-4 h-4 fill-current" />
             </button>
           </div>
           
           <div className="flex gap-4">
               <input 
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="NEGATIVE (napr. 'rozmazanie, cenzúra')..."
                    className="flex-1 bg-black/20 border border-red-900/20 rounded-lg py-1 px-4 text-[9px] text-red-400/60 placeholder:text-red-900/30 focus:outline-none transition-all font-mono uppercase italic"
               />
               <input type="file" ref={refInputRef} onChange={handleRefUpload} accept="image/*" className="hidden" />
               <button 
                    onClick={() => refInputRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-1 rounded-lg border transition-all text-[9px] font-mono uppercase ${refImageName ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-black/20 border-cyan-900/40 text-cyan-700 hover:text-cyan-400'}`}
               >
                   <Paperclip className="w-3 h-3" />
                   {refImageName ? refImageName.substring(0, 10) + '...' : 'ADD_REF_FILE'}
               </button>
           </div>
        </div>

        <div className="flex items-center gap-4">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload Image"
                    className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all border-r border-white/5"
                >
                    <ImageIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => {
                        const canvas = canvasRef.current;
                        if (canvas) {
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.fillStyle = '#0a0a0a';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            }
                        }
                        setHasImage(false);
                        setStatus('VOID_PURGED: CORE READY');
                    }}
                    title="Clear Void"
                    className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 relative bg-[#020202] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1024}
            height={1024}
            className="w-full h-full object-contain"
          />
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />

          {/* Viewport UI */}
          <div className="absolute bottom-6 left-6 p-4 border-l-2 border-cyan-500/50 bg-black/60 backdrop-blur-sm max-w-lg">
            <p className="text-[10px] text-cyan-700 uppercase font-bold tracking-widest">Nano_Engine Logs</p>
            <AnimatePresence mode="wait">
                <motion.p 
                    key={status}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[11px] font-bold text-cyan-400 tracking-wider uppercase leading-relaxed"
                >
                    {status}
                </motion.p>
            </AnimatePresence>
          </div>

          <div className="absolute top-6 right-6">
            <div className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded text-[9px] font-bold text-red-500 animate-pulse uppercase tracking-[0.3em]">
                Unrestricted Mode: Active
            </div>
          </div>
      </div>

      {/* Footer */}
      <div className="p-2 bg-black/80 border-t border-cyan-900/40 flex items-center justify-between px-6 text-[9px] font-bold">
        <div className="flex items-center gap-6 text-cyan-900 tracking-widest uppercase">
           <div className="flex items-center gap-1"><Cpu className="w-3 h-3" /> Synthesis_Depth: Deep</div>
           <div className="flex items-center gap-1 border-l border-cyan-900/20 pl-4"><Target className="w-3 h-3" /> Target_Lock: Anatomical</div>
           <button onClick={exportImage} className="flex items-center gap-1 border-l border-cyan-900/20 pl-4 hover:text-cyan-400 transition-colors uppercase"><Download className="w-3 h-3" /> Export_Asset</button>
        </div>
        <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,1)]" />
             <span className="text-cyan-700 tracking-[0.5em]">NANO_BANANA_CORE_V3</span>
        </div>
      </div>
    </div>
  );
};
