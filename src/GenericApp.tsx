import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export type UIElementType = 'header' | 'text' | 'row' | 'column' | 'card' | 'metric' | 'input' | 'button' | 'canvas' | 'list';

export interface UIElement {
  type: UIElementType;
  content?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  action?: string;
  id?: string;
  className?: string;
  children?: UIElement[];
  stateKey?: string;
  itemTemplate?: UIElement;
  showIf?: string;
}

export interface AppConfig {
  name: string;
  description: string;
  color: string;
  customCSS?: string;
  layout?: UIElement[];
  html_payload?: string;
}

export default function GenericApp({ config }: { config: AppConfig }) {
  const [appState, setAppState] = useState<Record<string, any>>({});
  
  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize Canvas
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [config.layout]);

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = config.color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const evalString = (str: string | undefined, context: any) => {
    if (!str) return '';
    if (!str.includes('${')) return str;
    try {
      const keys = Object.keys(context);
      const values = Object.values(context);
      const func = new Function(...keys, `return \`${str}\`;`);
      return func(...values);
    } catch (e) {
      console.error("Eval error", e, str);
      return str;
    }
  };

  const evalCondition = (str: string | undefined, context: any) => {
    if (!str) return true;
    try {
      const keys = Object.keys(context);
      const values = Object.values(context);
      const func = new Function(...keys, `return ${str};`);
      return func(...values);
    } catch (e) {
      console.error("Condition error", e, str);
      return false;
    }
  };

  const executeAction = (actionStr: string | undefined, context: any) => {
    if (!actionStr) return;
    try {
      let finalActionStr = actionStr;
      // If the AI accidentally used ${var} syntax in the action string, evaluate it as a template string first
      if (actionStr.includes('${')) {
         finalActionStr = evalString(actionStr, context);
      }
      const keys = Object.keys(context);
      const values = Object.values(context);
      const func = new Function(...keys, finalActionStr);
      func(...values);
    } catch (e) {
      console.error("Action error", e, actionStr);
    }
  };

  const renderElement = (el: UIElement, index: number, extraContext: any = {}): React.ReactNode => {
    const context = { state: appState, setState: setAppState, C_qc: 313307, PI: 314, ...extraContext };
    
    if (el.showIf && !evalCondition(el.showIf, context)) {
      return null;
    }

    const key = `${el.type}-${index}-${el.id || ''}`;
    const customClass = el.className || '';
    
    const content = evalString(el.content, context);
    const label = evalString(el.label, context);
    const value = evalString(el.value, context);
    const placeholder = evalString(el.placeholder, context);
    
    switch (el.type) {
      case 'header':
        return <h3 key={key} className={`text-xl font-bold text-white mt-2 ${customClass}`}>{content}</h3>;
      case 'text':
        return <p key={key} className={`text-neutral-400 text-sm leading-relaxed ${customClass}`}>{content}</p>;
      case 'row':
        return <div key={key} className={`flex flex-row gap-4 flex-wrap w-full ${customClass}`}>{el.children?.map((child, i) => renderElement(child, i, extraContext))}</div>;
      case 'column':
        return <div key={key} className={`flex flex-col gap-4 w-full ${customClass}`}>{el.children?.map((child, i) => renderElement(child, i, extraContext))}</div>;
      case 'card':
        return (
          <div key={key} className={`bg-black/40 p-5 rounded-xl border border-white/10 flex flex-col gap-3 flex-1 min-w-[200px] shadow-lg ${customClass}`}>
            {el.children?.map((child, i) => renderElement(child, i, extraContext))}
          </div>
        );
      case 'metric':
        return (
          <div key={key} className={`flex flex-col gap-1 ${customClass}`}>
            <div className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{label}</div>
            <div className="text-3xl font-black tracking-tighter" style={{ color: config.color }}>{value}</div>
          </div>
        );
      case 'input':
        const stateKey = el.id || key;
        return (
          <input 
            key={key}
            type="text" 
            placeholder={placeholder}
            value={appState[stateKey] || ''}
            onChange={e => setAppState({...appState, [stateKey]: e.target.value})}
            className={`bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 w-full transition-colors ${customClass}`}
          />
        );
      case 'button':
        return (
          <button 
            key={key}
            onClick={() => {
              executeAction(el.action, context);
              setAppState(prev => ({...prev, [key + '_click']: true}));
              setTimeout(() => setAppState(prev => ({...prev, [key + '_click']: false})), 200);
            }}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${customClass}`}
            style={{ 
              backgroundColor: appState[key + '_click'] ? '#ffffff' : config.color,
              color: appState[key + '_click'] ? '#000000' : '#ffffff'
            }}
          >
            {label}
          </button>
        );
      case 'list':
        const items = Array.isArray(appState[el.stateKey || '']) ? appState[el.stateKey || ''] : [];
        return (
          <div key={key} className={`flex flex-col gap-3 w-full ${customClass}`}>
            {items.map((item: any, i: number) => (
              <React.Fragment key={i}>
                {el.itemTemplate && renderElement(el.itemTemplate, i, { ...extraContext, item, index: i })}
              </React.Fragment>
            ))}
          </div>
        );
      case 'canvas':
        return (
          <div key={key} className={`flex flex-col gap-2 w-full h-full min-h-[300px] ${customClass}`}>
            <div className="flex justify-end">
              <button 
                onClick={() => {
                  const ctx = canvasRef.current?.getContext('2d');
                  if (ctx && canvasRef.current) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-2 transition-colors text-white"
              >
                <RefreshCw className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="flex-1 bg-black rounded-xl border border-white/10 overflow-hidden relative shadow-inner">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onMouseMove={draw}
                className="w-full h-full cursor-crosshair touch-none"
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] h-full flex flex-col gap-6 bg-transparent text-gray-900 dark:text-white overflow-y-auto relative">
      {config.customCSS && <style>{config.customCSS}</style>}
      <div className="flex items-center gap-4 shrink-0 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-md z-10">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black text-white shadow-lg" style={{ backgroundColor: config.color }}>
          {config.name.substring(0, 1).toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{config.name}</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{config.description}</p>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 relative">
        {config.html_payload ? (
          <iframe 
            srcDoc={config.html_payload} 
            className="w-full h-full border-0 rounded-xl bg-transparent"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          config.layout?.map((el, i) => renderElement(el, i))
        )}
      </div>
    </div>
  );
}
